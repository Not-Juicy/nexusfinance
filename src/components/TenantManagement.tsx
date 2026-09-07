import React, { useState, useEffect, useRef } from 'react';
import { Plus, Building2, Users, Landmark, Settings, Trash2, Edit2, X, Check, Download, QrCode, Upload, CreditCard, RotateCcw, AlertTriangle, ShieldAlert, ChevronDown, Sparkles } from 'lucide-react';
import { apiFetch } from '../api';
import { showToast } from './Toast';
import { downloadCSV } from '../utils';
import type { Tenant, TenantStats } from '../types';

interface TenantManagementProps {
  selectedTenantId?: string;
}

export default function TenantManagement({ selectedTenantId }: TenantManagementProps = {}) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [tenantStats, setTenantStats] = useState<Record<number, TenantStats>>({});
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [subscriberToPurge, setSubscriberToPurge] = useState<Tenant | null>(null);
  const [purgeConfirmInput, setPurgeConfirmInput] = useState('');
  const [purging, setPurging] = useState(false);
  const [subscriberToSuspend, setSubscriberToSuspend] = useState<Tenant | null>(null);
  const [suspending, setSuspending] = useState(false);
  const [isPlanDropdownOpen, setIsPlanDropdownOpen] = useState(false);
  const planDropdownRef = useRef<HTMLDivElement>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formLogoUrl, setFormLogoUrl] = useState('');
  const [formPlan, setFormPlan] = useState('basic');
  const [formMaxUsers, setFormMaxUsers] = useState(50);
  const [formMaxLoans, setFormMaxLoans] = useState(500);
  const [formPaymentProvider, setFormPaymentProvider] = useState<'bakong' | 'aba_payway'>('bakong');
  const [formBakongAccountId, setFormBakongAccountId] = useState('');
  const [formMerchantName, setFormMerchantName] = useState('');
  const [formPaywayMerchantId, setFormPaywayMerchantId] = useState('');
  const [formPaywayApiKey, setFormPaywayApiKey] = useState('');

  const fetchTenants = async () => {
    try {
      const data = await apiFetch('/tenants');
      setTenants(data);
      // Fetch stats for each tenant
      for (const tenant of data) {
        try {
          const stats = await apiFetch(`/tenants/${tenant.id}/stats`);
          setTenantStats(prev => ({ ...prev, [tenant.id]: stats }));
        } catch { /* stats fetch failed */ }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load tenants', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTenants(); }, []);

  const handleCreate = async () => {
    if (!formName) {
      showToast('Organization name is required', 'error');
      return;
    }
    const autoSlug = formName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    try {
      await apiFetch('/tenants', {
        method: 'POST',
        body: JSON.stringify({
          name: formName,
          slug: autoSlug,
          logo_url: formLogoUrl.trim() || undefined,
          plan: formPlan,
          max_users: formMaxUsers,
          max_loans: formMaxLoans,
          payment_provider: formPaymentProvider,
          bakong_account_id: formPaymentProvider === 'bakong' ? formBakongAccountId.trim() || undefined : undefined,
          merchant_name: formMerchantName.trim() || undefined,
          payway_merchant_id: formPaymentProvider === 'aba_payway' ? formPaywayMerchantId.trim() || undefined : undefined,
          payway_api_key: formPaymentProvider === 'aba_payway' ? formPaywayApiKey.trim() || undefined : undefined,
        }),
      });
      showToast('Subscriber created successfully', 'success');
      setShowCreate(false);
      resetForm();
      fetchTenants();
    } catch (err: any) {
      showToast(err.message || 'Failed to create subscriber', 'error');
    }
  };

  const handleUpdate = async () => {
    if (!editingTenant) return;
    try {
      await apiFetch(`/tenants/${editingTenant.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: formName,
          logo_url: formLogoUrl.trim() || '',
          plan: formPlan,
          max_users: formMaxUsers,
          max_loans: formMaxLoans,
          payment_provider: formPaymentProvider,
          bakong_account_id: formPaymentProvider === 'bakong' ? formBakongAccountId.trim() : '',
          merchant_name: formMerchantName.trim() || '',
          payway_merchant_id: formPaymentProvider === 'aba_payway' ? formPaywayMerchantId.trim() : '',
          payway_api_key: formPaymentProvider === 'aba_payway' ? formPaywayApiKey.trim() : '',
        }),
      });
      showToast('Subscriber updated successfully', 'success');
      setEditingTenant(null);
      resetForm();
      fetchTenants();
    } catch (err: any) {
      showToast(err.message || 'Failed to update subscriber', 'error');
    }
  };

  const handleExportReport = () => {
    if (!tenants.length) return;
    const reportData = tenants.map(t => {
      const st = tenantStats[t.id];
      return {
        'Subscriber ID': t.id,
        'Organization Name': t.name,
        'Slug': t.slug,
        'Plan': t.plan,
        'Status': t.is_active ? 'Active' : 'Inactive',
        'Total Users': st?.total_users || 0,
        'Total Loans': st?.total_loans || 0,
        'Total Volume (USD)': st?.total_volume || 0,
        'Payment Provider': t.payment_provider === 'aba_payway' ? 'ABA PayWay' : 'Bakong KHQR',
        'Bakong Account': t.bakong_account_id || 'Global Platform',
        'Merchant Name': t.merchant_name || t.name,
        'PayWay Merchant ID': t.payway_merchant_id || 'Global Platform',
        'Created Date': new Date(t.created_at).toLocaleDateString(),
      };
    });
    downloadCSV(reportData, `nexus_subscribers_report_${new Date().toISOString().slice(0,10)}.csv`);
    showToast('Subscribers report exported successfully', 'success');
  };

  const handleSuspendConfirm = async () => {
    if (!subscriberToSuspend) return;
    setSuspending(true);
    try {
      await apiFetch(`/tenants/${subscriberToSuspend.id}`, { method: 'DELETE' });
      showToast(`Subscriber "${subscriberToSuspend.name}" has been suspended`, 'success');
      setSubscriberToSuspend(null);
      fetchTenants();
    } catch (err: any) {
      showToast(err.message || 'Failed to suspend subscriber', 'error');
    } finally {
      setSuspending(false);
    }
  };

  const handleReactivate = async (tenant: Tenant) => {
    try {
      await apiFetch(`/tenants/${tenant.id}/reactivate`, { method: 'POST' });
      showToast(`Subscriber "${tenant.name}" has been reactivated!`, 'success');
      fetchTenants();
    } catch (err: any) {
      showToast(err.message || 'Failed to reactivate subscriber', 'error');
    }
  };

  const handlePurgeConfirm = async () => {
    if (!subscriberToPurge) return;
    setPurging(true);
    try {
      await apiFetch(`/tenants/${subscriberToPurge.id}?purge=true`, { method: 'DELETE' });
      showToast(`Subscriber "${subscriberToPurge.name}" has been permanently deleted`, 'success');
      setSubscriberToPurge(null);
      setPurgeConfirmInput('');
      fetchTenants();
    } catch (err: any) {
      showToast(err.message || 'Failed to permanently delete subscriber', 'error');
    } finally {
      setPurging(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormSlug('');
    setFormLogoUrl('');
    setFormPlan('basic');
    setFormMaxUsers(50);
    setFormMaxLoans(500);
    setFormPaymentProvider('bakong');
    setFormBakongAccountId('');
    setFormMerchantName('');
    setFormPaywayMerchantId('');
    setFormPaywayApiKey('');
  };

  const startEdit = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setFormName(tenant.name);
    setFormLogoUrl(tenant.logo_url || '');
    setFormPlan(tenant.plan);
    setFormMaxUsers(tenant.max_users);
    setFormMaxLoans(tenant.max_loans);
    setFormPaymentProvider(tenant.payment_provider || (tenant.payway_merchant_id ? 'aba_payway' : 'bakong'));
    setFormBakongAccountId(tenant.bakong_account_id || '');
    setFormMerchantName(tenant.merchant_name || '');
    setFormPaywayMerchantId(tenant.payway_merchant_id || '');
    setFormPaywayApiKey(tenant.payway_api_key || '');
  };

  const planOptions = [
    { id: 'founding', label: 'Founding', price: 'Free', badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300', desc: 'Full founding tier privileges' },
    { id: 'basic', label: 'Basic', price: '$49/mo', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', desc: 'Up to 50 users & 500 loans' },
    { id: 'standard', label: 'Standard', price: '$149/mo', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', desc: 'Up to 200 users & 2,000 loans' },
    { id: 'premium', label: 'Premium', price: '$349/mo', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', desc: 'Unlimited enterprise volume' },
  ];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (planDropdownRef.current && !planDropdownRef.current.contains(e.target as Node)) {
        setIsPlanDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const planColors: Record<string, string> = {
    founding: 'bg-purple-100 text-purple-700',
    basic: 'bg-blue-100 text-blue-700',
    standard: 'bg-green-100 text-green-700',
    premium: 'bg-amber-100 text-amber-700',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Subscriber Management</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Manage subscribing organizations</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportReport}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold border cursor-pointer hover:bg-[var(--surface-secondary)] transition-colors"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
            title="Download CSV performance summary"
          >
            <Download className="w-4 h-4 text-[var(--accent)]" /> Export Report
          </button>
          <button
            onClick={() => { resetForm(); setShowCreate(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <Plus className="w-4 h-4" /> Add Subscriber
          </button>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border-primary)] pb-3">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            statusFilter === 'all'
              ? 'bg-[var(--accent)] text-white shadow-xs'
              : 'text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <span>All Subscribers</span>
          <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${statusFilter === 'all' ? 'bg-white/25 text-white' : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)]'}`}>
            {tenants.length}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('active')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            statusFilter === 'active'
              ? 'bg-emerald-500 text-white shadow-xs'
              : 'text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Active</span>
          <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${statusFilter === 'active' ? 'bg-white/25 text-white' : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)]'}`}>
            {tenants.filter(t => t.is_active).length}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('suspended')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            statusFilter === 'suspended'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span>Suspended</span>
          <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${statusFilter === 'suspended' ? 'bg-white/25 text-white' : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)]'}`}>
            {tenants.filter(t => !t.is_active).length}
          </span>
        </button>
      </div>

      {/* Tenant Cards */}
      {(() => {
        let visibleTenants = (selectedTenantId && selectedTenantId !== 'all')
          ? tenants.filter(t => String(t.id) === selectedTenantId)
          : tenants;

        if (statusFilter === 'active') {
          visibleTenants = visibleTenants.filter(t => t.is_active);
        } else if (statusFilter === 'suspended') {
          visibleTenants = visibleTenants.filter(t => !t.is_active);
        }

        if (visibleTenants.length === 0) {
          return (
            <div className="text-center py-16 border border-dashed border-[var(--border-primary)] rounded-2xl bg-[var(--surface-secondary)]/30">
              <Building2 className="w-10 h-10 mx-auto text-[var(--text-tertiary)] mb-2 opacity-50" />
              <p className="text-sm font-semibold text-[var(--text-primary)]">No subscribers found</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {statusFilter === 'suspended' ? 'There are no suspended subscribers.' : 'No subscribers match the current filter.'}
              </p>
            </div>
          );
        }

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleTenants.map(tenant => {
          const stats = tenantStats[tenant.id];
          return (
            <div
              key={tenant.id}
              className={`rounded-2xl border p-5 transition-all hover:shadow-md relative ${
                !tenant.is_active ? 'bg-[var(--surface-secondary)]/40 border-amber-500/30' : 'bg-[var(--surface-primary)] border-[var(--border-primary)]'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden border border-[var(--border-primary)] bg-[var(--surface-secondary)] shrink-0">
                    {tenant.logo_url ? (
                      <img src={tenant.logo_url} alt={tenant.name} className="w-full h-full object-contain p-1" />
                    ) : (
                      <Building2 className="w-5 h-5 text-[var(--accent)]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-[var(--text-primary)] truncate">{tenant.name}</h3>
                    <p className="text-xs text-[var(--text-secondary)] truncate">/{tenant.slug}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Status badge */}
                  {tenant.is_active ? (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Suspended
                    </span>
                  )}
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${planColors[tenant.plan] || 'bg-gray-100 text-gray-700'}`}>
                    {tenant.plan}
                  </span>
                </div>
              </div>

              {/* Stats */}
              {stats && (
                <div className="grid grid-cols-3 gap-2 mb-4 py-3 border-t border-b border-[var(--border-primary)]">
                  <div className="text-center">
                    <p className="text-lg font-bold text-[var(--text-primary)]">{stats.total_users}</p>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Users</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-[var(--text-primary)]">{stats.total_loans}</p>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Loans</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-[var(--text-primary)]">${stats.total_volume?.toLocaleString() || 0}</p>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Volume</p>
                  </div>
                </div>
              )}

              {/* Limits */}
              <div className="text-xs mb-4 flex items-center justify-between text-[var(--text-secondary)]">
                <span>Max {tenant.max_users} users, {tenant.max_loans} loans</span>
                {tenant.payment_provider && (
                  <span className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase">
                    {tenant.payment_provider === 'aba_payway' ? 'ABA PayWay' : 'KHQR'}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(tenant)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-[var(--border-primary)] text-[var(--text-secondary)] cursor-pointer transition-colors hover:bg-[var(--surface-secondary)]"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </button>

                {tenant.id !== 1 && (
                  <>
                    {tenant.is_active ? (
                      <button
                        onClick={() => setSubscriberToSuspend(tenant)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-amber-500/30 text-amber-600 cursor-pointer transition-colors hover:bg-amber-500/10"
                        title="Suspend subscriber access"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Suspend</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReactivate(tenant)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-emerald-500/30 text-emerald-600 cursor-pointer transition-colors hover:bg-emerald-500/10"
                        title="Reactivate subscriber"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reactivate</span>
                      </button>
                    )}

                    {/* Permanent Delete Button */}
                    <button
                      onClick={() => {
                        setSubscriberToPurge(tenant);
                        setPurgeConfirmInput('');
                      }}
                      className="p-2 rounded-lg text-rose-500 border border-rose-200 hover:bg-rose-500/10 cursor-pointer transition-colors"
                      title="Permanently Delete Subscriber"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      );
    })()}

      {/* Create/Edit Modal */}
      {(showCreate || editingTenant) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }}
          onClick={() => { setShowCreate(false); setEditingTenant(null); }}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] relative"
            style={{ backgroundColor: 'var(--surface-primary)', borderColor: 'var(--border-primary)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4.5 border-b shrink-0" style={{ borderColor: 'var(--border-primary)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                    {editingTenant ? 'Edit Subscriber' : 'Create Subscriber'}
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {editingTenant ? `Configure settings for ${editingTenant.name}` : 'Register a new tenant organization on the platform'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowCreate(false); setEditingTenant(null); }}
                className="p-2 rounded-xl hover:bg-[var(--surface-secondary)] cursor-pointer transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body - 2 Columns rectangular layout */}
            <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
              {/* Left Column: Organization Profile & Plan */}
              <div className="space-y-4">
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--accent)] flex items-center gap-1.5">
                  <span>General Information</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Organization Name
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
                    style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--surface-secondary)', color: 'var(--text-primary)' }}
                    placeholder="e.g. Khmer Microfinance"
                  />
                </div>

                {!editingTenant && formName && (
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                      Portal Slug
                    </label>
                    <div className="w-full px-3.5 py-2.5 rounded-xl text-sm border font-mono" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--surface-secondary)', color: 'var(--text-secondary)' }}>
                      /{formName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold mb-1.5 flex items-center justify-between" style={{ color: 'var(--text-secondary)' }}>
                    <span>Logo (White-labeling)</span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">PNG, JPG, SVG, WebP</span>
                  </label>
                  <div className="flex items-center gap-2.5">
                    <div className="w-12 h-12 rounded-xl border border-[var(--border-primary)] flex items-center justify-center p-1.5 bg-white overflow-hidden shrink-0 shadow-xs">
                      {formLogoUrl ? (
                        <img src={formLogoUrl} alt="Preview" className="w-full h-full object-contain" onError={(e) => { (e.target as any).style.display = 'none'; }} />
                      ) : (
                        <Building2 className="w-6 h-6 text-[var(--accent)]" />
                      )}
                    </div>

                    <label className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-primary)] hover:border-[var(--accent)] text-xs font-bold text-[var(--text-primary)] cursor-pointer shrink-0 transition-all shadow-xs">
                      <Upload className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 2 * 1024 * 1024) return showToast('Image must be under 2MB', 'error');
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              if (ev.target?.result) {
                                setFormLogoUrl(ev.target.result as string);
                                showToast('Logo image loaded!', 'success');
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>

                    {formLogoUrl ? (
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-[11px] font-medium text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg truncate">
                          ✓ Image ready
                        </span>
                        <button
                          type="button"
                          onClick={() => setFormLogoUrl('')}
                          className="px-2.5 py-1.5 rounded-lg border border-[var(--border-primary)] text-[11px] font-bold text-rose-500 hover:bg-rose-500/10 hover:border-rose-300 transition-colors cursor-pointer bg-[var(--surface-primary)] shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <input
                        type="url"
                        value={formLogoUrl}
                        onChange={e => setFormLogoUrl(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl text-xs border outline-none focus:ring-2 min-w-0"
                        style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--surface-secondary)', color: 'var(--text-primary)' }}
                        placeholder="Or paste external URL"
                      />
                    )}
                  </div>
                </div>

                {/* Premium Custom Plan Dropdown */}
                <div className="relative" ref={planDropdownRef}>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Subscription Plan
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsPlanDropdownOpen(!isPlanDropdownOpen)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm border flex items-center justify-between cursor-pointer transition-all duration-150 hover:border-[var(--accent)]"
                    style={{
                      borderColor: isPlanDropdownOpen ? 'var(--accent)' : 'var(--border-primary)',
                      backgroundColor: 'var(--surface-secondary)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {(() => {
                      const cur = planOptions.find(p => p.id === formPlan) || planOptions[1];
                      return (
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${cur.badge}`}>
                            {cur.label}
                          </span>
                          <span className="text-xs font-semibold text-[var(--text-primary)]">{cur.price}</span>
                          <span className="text-xs text-[var(--text-secondary)] truncate hidden sm:inline">· {cur.desc}</span>
                        </div>
                      );
                    })()}
                    <ChevronDown className={`w-4 h-4 text-[var(--text-secondary)] transition-transform duration-200 shrink-0 ml-2 ${isPlanDropdownOpen ? 'rotate-180 text-[var(--accent)]' : ''}`} />
                  </button>

                  {/* Dropdown Menu Popper */}
                  {isPlanDropdownOpen && (
                    <div
                      className="absolute left-0 right-0 top-full mt-1.5 rounded-2xl border shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                      style={{
                        backgroundColor: 'var(--surface-primary)',
                        borderColor: 'var(--border-primary)',
                      }}
                    >
                      <div className="space-y-1">
                        {planOptions.map((opt) => {
                          const isSelected = formPlan === opt.id;
                          return (
                            <div
                              key={opt.id}
                              onClick={() => {
                                setFormPlan(opt.id);
                                setIsPlanDropdownOpen(false);
                              }}
                              className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all duration-150 ${
                                isSelected
                                  ? 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30'
                                  : 'hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${opt.badge}`}>
                                  {opt.label}
                                </span>
                                <div>
                                  <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                                    {opt.price}
                                  </p>
                                  <p className="text-[11px] text-[var(--text-secondary)] leading-tight">
                                    {opt.desc}
                                  </p>
                                </div>
                              </div>
                              {isSelected && (
                                <Check className="w-4 h-4 text-[var(--accent)] shrink-0 ml-2" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Max Users</label>
                    <input
                      type="number"
                      value={formMaxUsers}
                      onChange={e => setFormMaxUsers(parseInt(e.target.value) || 50)}
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                      style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--surface-secondary)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Max Loans</label>
                    <input
                      type="number"
                      value={formMaxLoans}
                      onChange={e => setFormMaxLoans(parseInt(e.target.value) || 500)}
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                      style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--surface-secondary)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Payment Gateway Routing */}
              <div className="space-y-4">
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--accent)] flex items-center gap-1.5">
                  <span>Payment Gateway Configuration</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Payment Gateway Provider
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-1.5 rounded-xl border" style={{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--border-primary)' }}>
                    <button
                      type="button"
                      onClick={() => setFormPaymentProvider('bakong')}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        formPaymentProvider === 'bakong'
                          ? 'bg-[var(--surface-primary)] text-[var(--accent)] shadow-sm'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Bakong KHQR</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormPaymentProvider('aba_payway')}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        formPaymentProvider === 'aba_payway'
                          ? 'bg-[var(--surface-primary)] text-[var(--accent)] shadow-sm'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>ABA PayWay</span>
                    </button>
                  </div>
                </div>

                {/* Bakong KHQR Fields */}
                {formPaymentProvider === 'bakong' && (
                  <div className="space-y-3.5 p-4 rounded-xl border bg-[var(--surface-secondary)]/40 border-[var(--border-primary)] animate-in fade-in duration-150">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                        Bakong Account ID
                      </label>
                      <input
                        type="text"
                        value={formBakongAccountId}
                        onChange={e => setFormBakongAccountId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--surface-primary)', color: 'var(--text-primary)' }}
                        placeholder="Please input Bakong Account ID"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                        Merchant Name
                      </label>
                      <input
                        type="text"
                        value={formMerchantName}
                        onChange={e => setFormMerchantName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--surface-primary)', color: 'var(--text-primary)' }}
                        placeholder="Please input Merchant Name"
                      />
                    </div>
                  </div>
                )}

                {/* ABA PayWay Fields */}
                {formPaymentProvider === 'aba_payway' && (
                  <div className="space-y-3 p-4 rounded-xl border bg-[var(--surface-secondary)]/40 border-[var(--border-primary)] animate-in fade-in duration-150">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                        ABA PayWay Merchant ID
                      </label>
                      <input
                        type="text"
                        value={formPaywayMerchantId}
                        onChange={e => setFormPaywayMerchantId(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl text-sm border outline-none focus:ring-2 font-mono"
                        style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--surface-primary)', color: 'var(--text-primary)' }}
                        placeholder="Please input ABA PayWay Merchant ID"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                        ABA PayWay API Key
                      </label>
                      <input
                        type="password"
                        value={formPaywayApiKey}
                        onChange={e => setFormPaywayApiKey(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl text-sm border outline-none focus:ring-2 font-mono"
                        style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--surface-primary)', color: 'var(--text-primary)' }}
                        placeholder="Please input ABA PayWay API Key"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                        Merchant Name (Optional Override)
                      </label>
                      <input
                        type="text"
                        value={formMerchantName}
                        onChange={e => setFormMerchantName(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl text-sm border outline-none focus:ring-2"
                        style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--surface-primary)', color: 'var(--text-primary)' }}
                        placeholder="Please input Merchant Name"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--surface-secondary)' }}>
              <button
                onClick={() => { setShowCreate(false); setEditingTenant(null); }}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold border cursor-pointer hover:bg-[var(--surface-primary)] transition-colors"
                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={editingTenant ? handleUpdate : handleCreate}
                className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer shadow-sm hover:opacity-90 transition-opacity"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <Check className="w-4 h-4" />
                {editingTenant ? 'Save Changes' : 'Create Subscriber'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Confirmation Modal */}
      {subscriberToSuspend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div
            className="w-full max-w-md rounded-2xl border p-6 shadow-2xl relative"
            style={{ backgroundColor: 'var(--surface-primary)', borderColor: 'var(--border-primary)' }}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  Suspend Subscriber?
                </h3>
                <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Are you sure you want to suspend <strong className="text-[var(--text-primary)]">"{subscriberToSuspend.name}"</strong>?
                </p>
                <div className="mt-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    Impact of suspension:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 opacity-90">
                    <li>All admin & user logins for this subscriber will be blocked.</li>
                    <li>All subscriber loans and data are kept safely intact.</li>
                    <li>You can reactivate this subscriber at any time.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setSubscriberToSuspend(null)}
                disabled={suspending}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border cursor-pointer hover:bg-[var(--surface-secondary)] transition-colors"
                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSuspendConfirm}
                disabled={suspending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 cursor-pointer transition-colors"
              >
                {suspending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  'Suspend Access'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Purge Modal */}
      {subscriberToPurge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div
            className="w-full max-w-md rounded-2xl border p-6 shadow-2xl relative"
            style={{ backgroundColor: 'var(--surface-primary)', borderColor: 'var(--border-primary)' }}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6 text-red-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-red-600 dark:text-red-400">
                  Permanently Delete Subscriber
                </h3>
                <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  This action is <strong className="text-red-500 uppercase tracking-wide">irreversible</strong>. You are about to permanently purge:
                </p>
                <div className="mt-2 p-2.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-primary)] text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {subscriberToPurge.name} <span className="text-xs font-normal opacity-60">({subscriberToPurge.slug})</span>
                </div>

                <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-700 dark:text-red-300 space-y-1">
                  <p className="font-semibold">Destructive consequences:</p>
                  <ul className="list-disc list-inside space-y-0.5 opacity-90">
                    <li>Database records, subscriber configs, and users will be deleted.</li>
                    <li>If active loans exist, deletion will be blocked by system guardrails.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Type <span className="font-mono font-bold text-red-500">{subscriberToPurge.name}</span> to confirm:
              </label>
              <input
                type="text"
                value={purgeConfirmInput}
                onChange={e => setPurgeConfirmInput(e.target.value)}
                placeholder={subscriberToPurge.name}
                className="w-full px-3 py-2 rounded-xl text-sm border font-mono outline-none focus:ring-2 focus:ring-red-500"
                style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--surface-secondary)', color: 'var(--text-primary)' }}
                autoFocus
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setSubscriberToPurge(null); setPurgeConfirmInput(''); }}
                disabled={purging}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border cursor-pointer hover:bg-[var(--surface-secondary)] transition-colors"
                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={handlePurgeConfirm}
                disabled={purging || purgeConfirmInput.trim().toLowerCase() !== subscriberToPurge.name.trim().toLowerCase()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                {purging ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Permanently
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
