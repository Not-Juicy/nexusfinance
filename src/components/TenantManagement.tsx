import React, { useState, useEffect } from 'react';
import { Plus, Building2, Users, Landmark, Settings, Trash2, Edit2, X, Check, Download, QrCode, Upload, CreditCard } from 'lucide-react';
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

  const handleDeactivate = async (tenant: Tenant) => {
    if (!confirm(`Deactivate "${tenant.name}"? Users from this subscriber will lose access.`)) return;
    try {
      await apiFetch(`/tenants/${tenant.id}`, { method: 'DELETE' });
      showToast('Subscriber deactivated', 'success');
      fetchTenants();
    } catch (err: any) {
      showToast(err.message || 'Failed to deactivate subscriber', 'error');
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

      {/* Tenant Cards */}
      {(() => {
        const visibleTenants = (selectedTenantId && selectedTenantId !== 'all')
          ? tenants.filter(t => String(t.id) === selectedTenantId)
          : tenants;
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleTenants.map(tenant => {
          const stats = tenantStats[tenant.id];
          return (
            <div
              key={tenant.id}
              className="rounded-2xl border p-5 transition-all hover:shadow-md"
              style={{
                backgroundColor: 'var(--surface-primary)',
                borderColor: tenant.is_active ? 'var(--border-primary)' : '#fca5a5',
                opacity: tenant.is_active ? 1 : 0.6,
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden border border-[var(--border-primary)]" style={{ backgroundColor: 'var(--surface-secondary)' }}>
                    {tenant.logo_url ? (
                      <img src={tenant.logo_url} alt={tenant.name} className="w-full h-full object-contain p-1" />
                    ) : (
                      <Building2 className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{tenant.name}</h3>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>/{tenant.slug}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${planColors[tenant.plan] || 'bg-gray-100 text-gray-700'}`}>
                  {tenant.plan}
                </span>
              </div>

              {/* Stats */}
              {stats && (
                <div className="grid grid-cols-3 gap-2 mb-4 py-3 border-t border-b" style={{ borderColor: 'var(--border-primary)' }}>
                  <div className="text-center">
                    <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{stats.total_users}</p>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Users</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{stats.total_loans}</p>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Loans</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>${stats.total_volume?.toLocaleString() || 0}</p>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Volume</p>
                  </div>
                </div>
              )}

              {/* Limits */}
              <div className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
                Max {tenant.max_users} users, {tenant.max_loans} loans
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(tenant)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border cursor-pointer transition-colors hover:bg-[var(--surface-secondary)]"
                  style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </button>
                {tenant.id !== 1 && (
                  <button
                    onClick={() => handleDeactivate(tenant)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-red-200 text-red-600 cursor-pointer transition-colors hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
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
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { setShowCreate(false); setEditingTenant(null); }}>
          <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl" style={{ backgroundColor: 'var(--surface-primary)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {editingTenant ? 'Edit Subscriber' : 'Create Subscriber'}
              </h3>
              <button onClick={() => { setShowCreate(false); setEditingTenant(null); }} className="p-1.5 rounded-lg cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Organization Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                  style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--surface-secondary)', color: 'var(--text-primary)' }}
                  placeholder="e.g. Khmer Microfinance"
                />
              </div>

              {!editingTenant && formName && (
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Slug (auto-generated)</label>
                  <div className="w-full px-3 py-2.5 rounded-xl text-sm border font-mono" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--surface-secondary)', color: 'var(--text-secondary)' }}>
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
                  <div className="w-10 h-10 rounded-xl border border-[var(--border-primary)] flex items-center justify-center p-1 bg-white overflow-hidden shrink-0">
                    {formLogoUrl ? (
                      <img src={formLogoUrl} alt="Preview" className="w-full h-full object-contain" onError={(e) => { (e.target as any).style.display = 'none'; }} />
                    ) : (
                      <Building2 className="w-5 h-5 text-[var(--accent)]" />
                    )}
                  </div>

                  <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-primary)] hover:border-[var(--accent)] text-xs font-bold text-[var(--text-primary)] cursor-pointer shrink-0 transition-all">
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
                      <span className="text-[11px] font-medium text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg truncate">
                        ✓ Image ready
                      </span>
                      <button
                        type="button"
                        onClick={() => setFormLogoUrl('')}
                        className="px-2 py-1 rounded-lg border border-[var(--border-primary)] text-[11px] font-bold text-rose-500 hover:bg-rose-500/10 hover:border-rose-300 transition-colors cursor-pointer bg-[var(--surface-primary)] shrink-0"
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

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Plan</label>
                <select
                  value={formPlan}
                  onChange={e => setFormPlan(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none cursor-pointer"
                  style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--surface-secondary)', color: 'var(--text-primary)' }}
                >
                  <option value="founding">Founding (Free)</option>
                  <option value="basic">Basic ($49/mo)</option>
                  <option value="standard">Standard ($149/mo)</option>
                  <option value="premium">Premium ($349/mo)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Max Users</label>
                  <input
                    type="number"
                    value={formMaxUsers}
                    onChange={e => setFormMaxUsers(parseInt(e.target.value) || 50)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                    style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--surface-secondary)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Max Loans</label>
                  <input
                    type="number"
                    value={formMaxLoans}
                    onChange={e => setFormMaxLoans(parseInt(e.target.value) || 500)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                    style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--surface-secondary)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              {/* KHQR & Bakong Routing */}
              {/* Payment Gateway Setup */}
              <div className="pt-2 border-t border-[var(--border-primary)] space-y-3">
                <label className="block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Payment Gateway Provider</label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl border" style={{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--border-primary)' }}>
                  <button
                    type="button"
                    onClick={() => setFormPaymentProvider('bakong')}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      formPaymentProvider === 'bakong'
                        ? 'bg-[var(--surface-primary)] text-[var(--accent)] shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Bakong KHQR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormPaymentProvider('aba_payway')}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      formPaymentProvider === 'aba_payway'
                        ? 'bg-[var(--surface-primary)] text-[var(--accent)] shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>ABA PayWay</span>
                  </button>
                </div>

                {/* Bakong KHQR Fields */}
                {formPaymentProvider === 'bakong' && (
                  <div className="space-y-3 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Bakong Account ID</label>
                      <input
                        type="text"
                        value={formBakongAccountId}
                        onChange={e => setFormBakongAccountId(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                        style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--surface-secondary)', color: 'var(--text-primary)' }}
                        placeholder="Please input Bakong Account ID"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Merchant Name</label>
                      <input
                        type="text"
                        value={formMerchantName}
                        onChange={e => setFormMerchantName(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                        style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--surface-secondary)', color: 'var(--text-primary)' }}
                        placeholder="Please input Merchant Name"
                      />
                    </div>
                  </div>
                )}

                {/* ABA PayWay Fields */}
                {formPaymentProvider === 'aba_payway' && (
                  <div className="space-y-3 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>ABA PayWay Merchant ID</label>
                      <input
                        type="text"
                        value={formPaywayMerchantId}
                        onChange={e => setFormPaywayMerchantId(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 font-mono"
                        style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--surface-secondary)', color: 'var(--text-primary)' }}
                        placeholder="Please input ABA PayWay Merchant ID"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>ABA PayWay API Key</label>
                      <input
                        type="password"
                        value={formPaywayApiKey}
                        onChange={e => setFormPaywayApiKey(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none focus:ring-2 font-mono"
                        style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--surface-secondary)', color: 'var(--text-primary)' }}
                        placeholder="Please input ABA PayWay API Key"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Merchant Name (Optional Override)</label>
                      <input
                        type="text"
                        value={formMerchantName}
                        onChange={e => setFormMerchantName(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl text-sm border outline-none focus:ring-2"
                        style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--surface-secondary)', color: 'var(--text-primary)' }}
                        placeholder="Please input Merchant Name"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowCreate(false); setEditingTenant(null); }}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border cursor-pointer"
                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={editingTenant ? handleUpdate : handleCreate}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <Check className="w-4 h-4" />
                {editingTenant ? 'Save Changes' : 'Create Subscriber'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
