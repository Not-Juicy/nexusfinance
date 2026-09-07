import React, { useState, useEffect } from 'react';
import { 
  Settings2, 
  Activity, 
  ShieldCheck, 
  ArrowUpRight,
  Database,
  Users,
  FileCheck2,
  TrendingUp,
  FileText,
  Building2,
  QrCode,
  Check,
  Upload,
  CreditCard
} from 'lucide-react';
import { PlatformConfig, PlatformStats, Tenant } from '../types';
import Modal from './Modal';
import { apiFetch } from '../api';
import { showToast } from './Toast';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { useCurrency } from '../context/CurrencyContext';

interface AuditLog {
  id: number; action: string; details: string; userEmail: string; timestamp: string;
}

interface SuperAdminDashboardProps {
  config: PlatformConfig;
  stats: PlatformStats;
  auditLogs: AuditLog[];
  onUpdateConfig: (newConfig: PlatformConfig) => void;
  view?: 'dashboard' | 'settings';
  applications?: any[];
  setActiveMenu?: (menu: string) => void;
}

export default function SuperAdminDashboard({
  config,
  stats,
  auditLogs,
  onUpdateConfig,
  view = 'dashboard',
  applications = [],
  setActiveMenu
}: SuperAdminDashboardProps) {
  const [editingConfig, setEditingConfig] = useState<PlatformConfig>({ ...config });
  const [savedMessage, setSavedMessage] = useState(false);
  const [selectedStat, setSelectedStat] = useState<'volume' | 'customers' | 'outstanding' | 'yields' | null>(null);
  const { t, formatCurrency, formatCurrencyShort } = useCurrency();

  // Tenant self-management state
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [tenantName, setTenantName] = useState('');
  const [tenantLogoUrl, setTenantLogoUrl] = useState('');
  const [tenantPaymentProvider, setTenantPaymentProvider] = useState<'bakong' | 'aba_payway'>('bakong');
  const [tenantBakongId, setTenantBakongId] = useState('');
  const [tenantMerchantName, setTenantMerchantName] = useState('');
  const [tenantPaywayMerchantId, setTenantPaywayMerchantId] = useState('');
  const [tenantPaywayApiKey, setTenantPaywayApiKey] = useState('');
  const [savingTenant, setSavingTenant] = useState(false);
  const [tenantSavedMsg, setTenantSavedMsg] = useState(false);

  useEffect(() => {
    setEditingConfig({ ...config });
  }, [config]);

  useEffect(() => {
    const fetchCurrentTenant = async () => {
      try {
        const savedId = localStorage.getItem('nexus_selected_tenant_id');
        const tenants: Tenant[] = await apiFetch('/tenants');
        if (Array.isArray(tenants) && tenants.length > 0) {
          const matched = (savedId && savedId !== 'all')
            ? tenants.find(t => String(t.id) === savedId) || tenants[0]
            : tenants[0];
          setCurrentTenant(matched);
          setTenantName(matched.name || '');
          setTenantLogoUrl(matched.logo_url || '');
          setTenantPaymentProvider(matched.payment_provider || (matched.payway_merchant_id ? 'aba_payway' : 'bakong'));
          setTenantBakongId(matched.bakong_account_id || '');
          setTenantMerchantName(matched.merchant_name || '');
          setTenantPaywayMerchantId(matched.payway_merchant_id || '');
          setTenantPaywayApiKey(matched.payway_api_key || '');
        }
      } catch { /* ignored */ }
    };
    if (view === 'settings') {
      fetchCurrentTenant();
    }
  }, [view]);

  const handleTenantSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTenant) return;
    setSavingTenant(true);
    try {
      const updated = await apiFetch(`/tenants/${currentTenant.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: tenantName,
          logo_url: tenantLogoUrl.trim() || '',
          payment_provider: tenantPaymentProvider,
          bakong_account_id: tenantPaymentProvider === 'bakong' ? tenantBakongId.trim() : '',
          merchant_name: tenantMerchantName.trim() || '',
          payway_merchant_id: tenantPaymentProvider === 'aba_payway' ? tenantPaywayMerchantId.trim() : '',
          payway_api_key: tenantPaymentProvider === 'aba_payway' ? tenantPaywayApiKey.trim() : '',
        }),
      });
      setCurrentTenant(updated);
      setTenantSavedMsg(true);
      showToast('Organization branding & payment gateway details updated!', 'success');
      // If user profile belongs to this tenant, sync tenant branding immediately
      const savedUserStr = localStorage.getItem('nexus_user');
      if (savedUserStr) {
        try {
          const userObj = JSON.parse(savedUserStr);
          if (userObj.tenant_id === currentTenant.id) {
            userObj.tenant_name = updated.name;
            userObj.tenant_logo_url = updated.logo_url;
            localStorage.setItem('nexus_user', JSON.stringify(userObj));
          }
        } catch { /* ignored */ }
      }
      setTimeout(() => {
        setTenantSavedMsg(false);
        // Soft reload to apply branding across the entire portal immediately
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      showToast(err.message || 'Failed to update organization details', 'error');
    } finally {
      setSavingTenant(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateConfig(editingConfig);
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2000);
  };

  const currentStatsItems = [
    { id: 'volume', label: t('total_volume'), value: formatCurrency(stats.totalVolume), change: '+14% mom', icon: Database },
    { id: 'customers', label: t('active_customers'), value: stats.activeCustomers.toString(), change: '+8 this week', icon: Users },
    { id: 'outstanding', label: t('outstanding_portfolio'), value: formatCurrency(stats.outstandingBalanceValue), change: '-5% repayments', icon: FileCheck2 },
    { id: 'yields', label: t('gross_yields'), value: formatCurrency(stats.interestEarned), change: '+18% yoy', icon: TrendingUp },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-200 font-sans">
      
      {/* Title */}
      <div>
        <h2 className="text-[32px] md:text-[36px] font-sans font-extrabold text-[var(--text-primary)] tracking-tight">{t('super_admin_hub')}</h2>
        <p className="text-[14.5px] text-[var(--text-secondary)] font-medium mt-0.5">{t('super_admin_desc')}</p>
      </div>

      {/* Stats Cards metrics — shown only in dashboard view */}
      {view === 'dashboard' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 select-none">
          {currentStatsItems.map((st, i) => {
            const Icon = st.icon;
            return (
              <div
                key={i}
                onClick={() => setSelectedStat(st.id as any)}
                className={`stagger-${i + 1} bg-[var(--surface-card)] border border-[var(--border-primary)] hover:border-[var(--accent)]/80 rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`}
              >
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[12px] font-bold text-[var(--text-secondary)] tracking-wider uppercase">
                    {st.label}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[26px] font-black font-mono block leading-tight text-[var(--text-primary)] tracking-tight">
                    {st.value}
                  </span>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      <ArrowUpRight className="w-3 h-3 stroke-[2.5]" />
                      {st.change}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === 'dashboard' && (
        <div className="space-y-6">
          {/* Row 2: Graph + System Info (KYC and Quick status) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Recharts Area Chart (Spans 8) */}
            <div className="lg:col-span-8 bg-[var(--surface-card)] border border-[var(--border-primary)] rounded-2xl p-6 space-y-4">
              <div>
                <h3 className="text-[17px] font-sans font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[var(--accent)]" /> {t('portfolio_trend')}
                </h3>
                <p className="text-[12px] text-[var(--text-secondary)]">{t('portfolio_trend_desc')}</p>
              </div>
              
              <div className="h-[260px] w-full text-[12px] select-none">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={(() => {
                      const totalVol = stats.totalVolume || 0;
                      const outstanding = stats.outstandingBalanceValue || 0;
                      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
                      if (totalVol === 0 && outstanding === 0) {
                        return months.map(m => ({ month: m, volume: 0, portfolio: 0 }));
                      }
                      const stepVol = totalVol / months.length;
                      const stepPort = outstanding / months.length;
                      return months.map((m, idx) => {
                        const isLast = idx === months.length - 1;
                        return {
                          month: m,
                          volume: isLast ? totalVol : Math.round(stepVol * (idx + 0.3)),
                          portfolio: isLast ? outstanding : Math.round(stepPort * (idx + 0.2)),
                        };
                      });
                    })()}
                    margin={{ top: 10, right: 10, left: 15, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" vertical={false} />
                    <XAxis dataKey="month" stroke="var(--text-secondary)" tickLine={false} axisLine={false} dy={8} />
                    <YAxis stroke="var(--text-secondary)" tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrencyShort(v)} dx={-8} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--surface-card)', 
                        borderColor: 'var(--border-primary)',
                        borderRadius: '16px',
                        color: 'var(--text-primary)',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
                        padding: '12px'
                      }} 
                      itemStyle={{ color: 'var(--text-primary)', padding: '2px 0' }}
                      labelStyle={{ fontWeight: 'bold', marginBottom: '4px', color: 'var(--text-secondary)' }}
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" />
                    <Area type="monotone" name={t('total_volume')} dataKey="volume" stroke="var(--accent)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorVolume)" activeDot={{ r: 6, stroke: 'var(--surface-card)', strokeWidth: 2 }} />
                    <Area type="monotone" name={t('outstanding_portfolio')} dataKey="portfolio" stroke="#3B82F6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPortfolio)" activeDot={{ r: 6, stroke: 'var(--surface-card)', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right: Quick Action & System Health Info (Spans 4) */}
            <div className="lg:col-span-4 bg-[var(--surface-card)] border border-[var(--border-primary)] rounded-2xl p-6 flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <h3 className="text-[17px] font-sans font-bold text-[var(--text-primary)]">
                  ⚙️ {t('system_health')}
                </h3>
                
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between text-[13px] border-b border-[var(--border-primary)] pb-2.5">
                    <span className="text-[var(--text-secondary)] font-medium">{t('sweep_schedule')}</span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-500/10 text-green-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span> {t('active')} ({config.reminder_time || '07:00'})
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[13px] border-b border-[var(--border-primary)] pb-2.5">
                    <span className="text-[var(--text-secondary)] font-medium">{t('bot_status')}</span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-500/10 text-green-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span> {t('live_linked')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[13px] border-b border-[var(--border-primary)] pb-2.5">
                    <span className="text-[var(--text-secondary)] font-medium">Underwriting Policy</span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      100% Officer Review
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-[var(--text-secondary)] font-medium">Email Verification</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${config.emailVerificationRequired !== false ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>
                      {config.emailVerificationRequired !== false ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-[var(--border-primary)] pt-4 space-y-2 select-none">
                <span className="text-[11px] uppercase tracking-wider font-bold text-[var(--text-tertiary)] block mb-2">{t('shortcuts')}</span>
                <div className="grid grid-cols-2 gap-2 text-[12px] font-bold text-center">
                  <button
                    onClick={() => setActiveMenu && setActiveMenu('reminders')}
                    className="py-2.5 rounded-lg border border-[var(--border-primary)] hover:bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer"
                  >
                    {t('reminders')}
                  </button>
                  <button
                    onClick={() => setActiveMenu && setActiveMenu('broadcast')}
                    className="py-2.5 rounded-lg border border-[var(--border-primary)] hover:bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer"
                  >
                    {t('broadcast')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Pending applications + Audit logs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Recent Applications List */}
            <div className="bg-[var(--surface-card)] border border-[var(--border-primary)] rounded-2xl p-6 space-y-4">
              <div>
                <h3 className="text-[17px] font-sans font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[var(--accent)]" /> {t('loan_review')}
                </h3>
                <p className="text-[12px] text-[var(--text-secondary)]">Recent loan applications and their current status.</p>
              </div>

              <div className="divide-y divide-[var(--border-primary)] text-[13px] max-h-[260px] overflow-y-auto pr-1">
                {applications.length === 0 ? (
                  <p className="text-[var(--text-tertiary)] text-[13px] py-10 text-center bg-[var(--surface-secondary)]/10 rounded-xl">{t('no_applications')}</p>
                ) : (
                  applications.slice(0, 5).map((app: any) => (
                    <div key={app.id} className="py-3.5 flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-[var(--text-primary)]">{app.applicantName}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-[var(--surface-tertiary)] text-[var(--text-secondary)]">#{app.id.startsWith('#') ? app.id.substring(1) : app.id}</span>
                        </div>
                        <span className="text-[11px] text-[var(--text-tertiary)] mt-0.5 block">{app.type} · Applied {new Date(app.date).toLocaleDateString()}</span>
                      </div>
                      <div className="text-right space-y-1">
                        <span className="font-mono font-bold text-[var(--text-primary)] block">{formatCurrency(app.amount)}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                          app.status === 'Approved' ? 'bg-green-500/10 text-green-400' :
                          app.status === 'Rejected' ? 'bg-red-500/10 text-red-400' :
                          app.status === 'Hold' ? 'bg-yellow-500/10 text-yellow-400' :
                          'bg-blue-500/10 text-blue-400'
                        }`}>
                          {app.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right: Audit Logs */}
            <div className="bg-[var(--surface-card)] border border-[var(--border-primary)] rounded-2xl p-6 space-y-4">
              <div>
                <h3 className="text-[17px] font-sans font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[var(--accent)]" /> {t('audit_trail')}
                </h3>
                <p className="text-[12px] text-[var(--text-secondary)]">{t('audit_trail_desc')}</p>
              </div>

              <div className="divide-y divide-[var(--border-primary)] text-[12.5px] max-h-[260px] overflow-y-auto pr-1">
                {auditLogs.length === 0 ? (
                  <p className="text-[var(--text-tertiary)] text-[13px] py-10 text-center bg-[var(--surface-secondary)]/10 rounded-xl">{t('no_logs')}</p>
                ) : (
                  auditLogs.slice(0, 4).map((log) => (
                    <div key={log.id} className="py-3.5 space-y-1">
                      <span className="text-[var(--text-primary)] font-bold block leading-tight">{formatAuditDetails(log.details)}</span>
                      <div className="flex items-center justify-between text-[11px] text-[var(--text-tertiary)]">
                        <span className="font-semibold text-[var(--text-secondary)]">{log.userEmail}</span>
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'settings' && <div className="space-y-6">
        
        {/* Organization Profile & White-labeling (Available to both Super Admin and Tenant Admin) */}
        {currentTenant && (
          <form onSubmit={handleTenantSave} className="bg-[var(--surface-card)] border border-[var(--border-primary)] rounded-2xl p-6 sm:p-8 space-y-5">
            <div className="border-b border-[var(--border-primary)] pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-[18px] font-sans font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[var(--accent)]" /> Organization Profile & Branding
                </h3>
                <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                  Configure white-label appearance and payment merchant credentials for <strong>{currentTenant.name}</strong> (#{currentTenant.id}).
                </p>
              </div>
              <span className="text-[11px] font-bold uppercase px-2.5 py-1 rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
                {currentTenant.plan} Plan
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-[13px] font-bold text-[var(--text-primary)] mb-1.5">Institution Name</label>
                <input
                  type="text"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  placeholder="Please input Institution Name"
                  className="w-full bg-[var(--surface-secondary)] border border-[var(--border-primary)] p-3 rounded-lg text-[14px] focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[var(--text-primary)] mb-1.5 flex items-center justify-between">
                  <span>Custom Logo (White-labeling)</span>
                  <span className="text-[11px] font-medium text-[var(--text-tertiary)]">PNG, JPG, SVG, WebP</span>
                </label>
                <div className="flex items-center gap-3">
                  {/* Image Preview thumbnail */}
                  <div className="w-12 h-12 rounded-xl border border-[var(--border-primary)] bg-white flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-2xs">
                    {tenantLogoUrl ? (
                      <img src={tenantLogoUrl} alt="Logo Preview" className="w-full h-full object-contain" onError={(e) => { (e.target as any).style.display = 'none'; }} />
                    ) : (
                      <Building2 className="w-6 h-6 text-[var(--accent)]" />
                    )}
                  </div>

                  {/* Upload button & clean status */}
                  <div className="flex-1 flex items-center gap-2">
                    <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-primary)] hover:bg-[var(--surface-secondary)] hover:border-[var(--accent)] text-[13px] font-bold text-[var(--text-primary)] transition-all cursor-pointer shadow-2xs shrink-0">
                      <Upload className="w-4 h-4 text-[var(--accent)]" />
                      <span>{tenantLogoUrl ? 'Change Image' : 'Upload Image'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 2 * 1024 * 1024) {
                              showToast('Image must be under 2MB', 'error');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = (uploadEvent) => {
                              const base64 = uploadEvent.target?.result as string;
                              if (base64) {
                                setTenantLogoUrl(base64);
                                showToast('Logo image selected! Click "Update Organization Profile" below to save.', 'success');
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>

                    {tenantLogoUrl ? (
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-[12px] font-medium text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl truncate">
                          ✓ Image ready to save
                        </span>
                        <button
                          type="button"
                          onClick={() => setTenantLogoUrl('')}
                          className="px-3 py-1.5 rounded-xl border border-[var(--border-primary)] text-[11px] font-bold text-rose-500 hover:bg-rose-500/10 hover:border-rose-300 transition-colors cursor-pointer bg-[var(--surface-primary)] shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <input
                        type="url"
                        value={tenantLogoUrl}
                        onChange={(e) => setTenantLogoUrl(e.target.value)}
                        placeholder="Or paste external image URL..."
                        className="flex-1 bg-[var(--surface-secondary)] border border-[var(--border-primary)] px-3 py-2 rounded-xl text-[13px] focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)] min-w-0"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Payment Gateway Provider Selector */}
              <div className="pt-2 border-t border-[var(--border-primary)] space-y-4">
                <div>
                  <label className="block text-[13px] font-bold text-[var(--text-primary)] mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">💳 Payment Gateway & Merchant Setup</span>
                    <span className="text-[11px] font-medium text-[var(--text-tertiary)]">Choose which provider to use</span>
                  </label>
                  <p className="text-[11.5px] text-[var(--text-secondary)] mb-3">
                    Select whether your organization receives customer payments via National Bakong KHQR or ABA PayWay.
                  </p>

                  {/* Provider Toggle Pill Switcher */}
                  <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--surface-secondary)] border border-[var(--border-primary)] rounded-xl max-w-md">
                    <button
                      type="button"
                      onClick={() => setTenantPaymentProvider('bakong')}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-[13px] font-bold transition-all cursor-pointer ${
                        tenantPaymentProvider === 'bakong'
                          ? 'bg-[var(--surface-primary)] text-[var(--accent)] shadow-xs border border-[var(--border-primary)]'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Bakong KHQR</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTenantPaymentProvider('aba_payway')}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-[13px] font-bold transition-all cursor-pointer ${
                        tenantPaymentProvider === 'aba_payway'
                          ? 'bg-[var(--surface-primary)] text-[var(--accent)] shadow-xs border border-[var(--border-primary)]'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>ABA PayWay</span>
                    </button>
                  </div>
                </div>

                {/* Bakong KHQR Configuration */}
                {tenantPaymentProvider === 'bakong' && (
                  <div className="p-4 bg-[var(--surface-secondary)]/50 border border-[var(--border-primary)] rounded-xl space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--text-primary)]">
                      <QrCode className="w-4 h-4 text-[var(--accent)]" />
                      <span>Bakong KHQR Settings</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[12.5px] font-semibold text-[var(--text-primary)] mb-1">
                          Bakong Account ID
                        </label>
                        <input
                          type="text"
                          value={tenantBakongId}
                          onChange={(e) => setTenantBakongId(e.target.value)}
                          placeholder="Please input Bakong Account ID"
                          className="w-full bg-[var(--surface-primary)] border border-[var(--border-primary)] p-2.5 rounded-lg text-[13px] font-mono focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]"
                        />
                        <p className="text-[11px] text-[var(--text-tertiary)] mt-1">KHQR payments will be credited directly to this Bakong merchant ID.</p>
                      </div>

                      <div>
                        <label className="block text-[12.5px] font-semibold text-[var(--text-primary)] mb-1">
                          Merchant Name (displayed on KHQR)
                        </label>
                        <input
                          type="text"
                          value={tenantMerchantName}
                          onChange={(e) => setTenantMerchantName(e.target.value)}
                          placeholder="Please input Merchant Name"
                          className="w-full bg-[var(--surface-primary)] border border-[var(--border-primary)] p-2.5 rounded-lg text-[13px] focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]"
                        />
                        <p className="text-[11px] text-[var(--text-tertiary)] mt-1">Shown in the Bakong / banking app when customers scan the QR code.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ABA PayWay Configuration */}
                {tenantPaymentProvider === 'aba_payway' && (
                  <div className="p-4 bg-[var(--surface-secondary)]/50 border border-[var(--border-primary)] rounded-xl space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--text-primary)]">
                      <CreditCard className="w-4 h-4 text-[var(--accent)]" />
                      <span>ABA PayWay Gateway Settings</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[12.5px] font-semibold text-[var(--text-primary)] mb-1">
                          ABA PayWay Merchant ID
                        </label>
                        <input
                          type="text"
                          value={tenantPaywayMerchantId}
                          onChange={(e) => setTenantPaywayMerchantId(e.target.value)}
                          placeholder="Please input ABA PayWay Merchant ID"
                          className="w-full bg-[var(--surface-primary)] border border-[var(--border-primary)] p-2.5 rounded-lg text-[13px] font-mono focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]"
                        />
                        <p className="text-[11px] text-[var(--text-tertiary)] mt-1">Your registered ABA PayWay merchant identifier.</p>
                      </div>

                      <div>
                        <label className="block text-[12.5px] font-semibold text-[var(--text-primary)] mb-1">
                          ABA PayWay API Key
                        </label>
                        <input
                          type="password"
                          value={tenantPaywayApiKey}
                          onChange={(e) => setTenantPaywayApiKey(e.target.value)}
                          placeholder="Please input ABA PayWay API Key"
                          className="w-full bg-[var(--surface-primary)] border border-[var(--border-primary)] p-2.5 rounded-lg text-[13px] font-mono focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]"
                        />
                        <p className="text-[11px] text-[var(--text-tertiary)] mt-1">Secret API key used to generate cryptographic transaction signatures.</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[12.5px] font-semibold text-[var(--text-primary)] mb-1">
                        Merchant Name (optional display override)
                      </label>
                      <input
                        type="text"
                        value={tenantMerchantName}
                        onChange={(e) => setTenantMerchantName(e.target.value)}
                        placeholder="Please input Merchant Name"
                        className="w-full max-w-md bg-[var(--surface-primary)] border border-[var(--border-primary)] p-2.5 rounded-lg text-[13px] focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]"
                      />
                      <p className="text-[11px] text-[var(--text-tertiary)] mt-1">Displayed to customers on checkout receipts and invoices.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[var(--border-primary)]">
              {tenantSavedMsg ? (
                <span className="text-[13px] font-bold text-emerald-500 flex items-center gap-1.5 animate-in fade-in">
                  <Check className="w-4 h-4" /> Organization settings saved successfully!
                </span>
              ) : <div />}
              <button
                type="submit"
                disabled={savingTenant}
                className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] font-bold text-[13.5px] px-6 py-2.5 rounded-lg transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {savingTenant ? 'Saving...' : 'Update Organization Profile'}
              </button>
            </div>
          </form>
        )}

        {/* Form panel configuring parameters */}
        <form onSubmit={handleSave} className="bg-[var(--surface-card)] border border-[var(--border-primary)] rounded-2xl p-6 sm:p-8 space-y-6">
          <h3 className="text-[18px] font-sans font-bold text-[var(--text-primary)] border-b pb-2 flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-[var(--text-primary)]" /> {t('system_parameters_adjustments')}
          </h3>



          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-[13px] font-bold text-[var(--text-primary)] mb-1">{t('annual_interest_rate')}</label>
              <p className="text-[11px] text-[var(--text-secondary)] mb-2 leading-tight">{t('annual_interest_rate_desc')}</p>
              <input
                type="number"
                step="0.05"
                value={editingConfig.baseInterestRate}
                onChange={(e) => setEditingConfig((p) => ({ ...p, baseInterestRate: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-[var(--surface-secondary)] border border-[var(--border-primary)] p-3 rounded-lg text-[14px] font-mono focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-all text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-[13px] font-bold text-[var(--text-primary)] mb-1">{t('maximum_loan_limit')}</label>
              <p className="text-[11px] text-[var(--text-secondary)] mb-2 leading-tight">{t('maximum_loan_limit_desc')}</p>
              <input
                type="number"
                step="50000"
                value={editingConfig.maxLoanAmount}
                onChange={(e) => setEditingConfig((p) => ({ ...p, maxLoanAmount: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-[var(--surface-secondary)] border border-[var(--border-primary)] p-3 rounded-lg text-[14px] font-mono focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-all text-[var(--text-primary)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-[13px] font-bold text-[var(--text-primary)] mb-1">{t('require_email_verification')}</label>
              <p className="text-[11px] text-[var(--text-secondary)] mb-2 leading-tight">{t('require_email_verification_desc')}</p>
              <div className="flex items-center gap-2.5 mt-3.5 select-none">
                <input
                  type="checkbox"
                  id="emailVerificationToggle"
                  checked={editingConfig.emailVerificationRequired !== false}
                  onChange={(e) => setEditingConfig((p) => ({ ...p, emailVerificationRequired: e.target.checked }))}
                  className="w-5 h-5 text-[var(--accent)] focus:ring-[var(--accent)] border-[var(--border-primary)] rounded"
                />
                <label htmlFor="emailVerificationToggle" className="text-[13.5px] font-semibold text-[var(--text-primary)]">{t('active_enabled')}</label>
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--border-primary)] pt-5 space-y-4">
            <h4 className="text-[14px] font-extrabold text-[var(--text-primary)] flex items-center gap-1.5">
              🤖 {t('telegram_bot_admin_controls')}
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-[13px] font-bold text-[var(--text-primary)] mb-1.5">{t('telegram_admin_chat_id')}</label>
                <input
                  type="text"
                  value={editingConfig.telegram_admin_id || ''}
                  onChange={(e) => setEditingConfig((p) => ({ ...p, telegram_admin_id: e.target.value }))}
                  placeholder="e.g. 182736452"
                  className="w-full bg-[var(--surface-secondary)] border border-[var(--border-primary)] p-3 rounded-lg text-[14px] font-mono focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-all text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[var(--text-primary)] mb-1.5">{t('reminder_summary_reports')}</label>
                <div className="flex items-center gap-2.5 mt-3 select-none">
                  <input
                    type="checkbox"
                    id="adminReportsToggle"
                    checked={editingConfig.enable_admin_reports !== false}
                    onChange={(e) => setEditingConfig((p) => ({ ...p, enable_admin_reports: e.target.checked }))}
                    className="w-5 h-5 text-[var(--accent)] focus:ring-[var(--accent)] border-[var(--border-primary)] rounded"
                  />
                  <label htmlFor="adminReportsToggle" className="text-[13.5px] font-semibold text-[var(--text-primary)]">{t('send_sweep_reports')}</label>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--border-primary)] pt-5 space-y-4">
            <div>
              <h4 className="text-[14px] font-extrabold text-[var(--text-primary)] flex items-center gap-1.5">
                💳 Subscription Tier Monthly Pricing ($/month)
              </h4>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                Configure the baseline monthly subscription rates charged to subscribing organizations. Updates live across Subscriber Management.
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3.5 bg-[var(--surface-secondary)]/50 border border-[var(--border-primary)] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    Basic Plan
                  </span>
                  <span className="text-[11px] text-[var(--text-secondary)]">Up to 50 users</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-sm font-bold text-[var(--text-secondary)]">$</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editingConfig.plan_basic_price !== undefined ? editingConfig.plan_basic_price : 49}
                    onChange={(e) => setEditingConfig((p) => ({ ...p, plan_basic_price: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-[var(--surface-primary)] border border-[var(--border-primary)] py-2.5 pl-7 pr-3 rounded-lg text-[14px] font-mono font-bold focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]"
                    placeholder="49"
                  />
                </div>
              </div>

              <div className="p-3.5 bg-[var(--surface-secondary)]/50 border border-[var(--border-primary)] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    Standard Plan
                  </span>
                  <span className="text-[11px] text-[var(--text-secondary)]">Up to 200 users</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-sm font-bold text-[var(--text-secondary)]">$</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editingConfig.plan_standard_price !== undefined ? editingConfig.plan_standard_price : 149}
                    onChange={(e) => setEditingConfig((p) => ({ ...p, plan_standard_price: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-[var(--surface-primary)] border border-[var(--border-primary)] py-2.5 pl-7 pr-3 rounded-lg text-[14px] font-mono font-bold focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]"
                    placeholder="149"
                  />
                </div>
              </div>

              <div className="p-3.5 bg-[var(--surface-secondary)]/50 border border-[var(--border-primary)] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    Premium Plan
                  </span>
                  <span className="text-[11px] text-[var(--text-secondary)]">Unlimited volume</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-sm font-bold text-[var(--text-secondary)]">$</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editingConfig.plan_premium_price !== undefined ? editingConfig.plan_premium_price : 349}
                    onChange={(e) => setEditingConfig((p) => ({ ...p, plan_premium_price: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-[var(--surface-primary)] border border-[var(--border-primary)] py-2.5 pl-7 pr-3 rounded-lg text-[14px] font-mono font-bold focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]"
                    placeholder="349"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--border-primary)] pt-5 space-y-4">
            <h4 className="text-[14px] font-extrabold text-[var(--text-primary)] flex items-center gap-1.5">
              💬 {t('brevo_sms_gateway')}
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-[13px] font-bold text-[var(--text-primary)] mb-1.5">{t('brevo_api_key')}</label>
                <input
                  type="password"
                  value={editingConfig.brevo_api_key || ''}
                  onChange={(e) => setEditingConfig((p) => ({ ...p, brevo_api_key: e.target.value }))}
                  placeholder="xkeysib-..."
                  className="w-full bg-[var(--surface-secondary)] border border-[var(--border-primary)] p-3 rounded-lg text-[14px] font-mono focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)] bg-[var(--surface-secondary)]"
                />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-[var(--text-primary)] mb-1.5">{t('brevo_sender_name')}</label>
                <input
                  type="text"
                  value={editingConfig.brevo_sender_name || ''}
                  onChange={(e) => setEditingConfig((p) => ({ ...p, brevo_sender_name: e.target.value }))}
                  placeholder="e.g. NexusFinance (max 11 chars)"
                  className="w-full bg-[var(--surface-secondary)] border border-[var(--border-primary)] p-3 rounded-lg text-[14px] font-mono focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)] bg-[var(--surface-secondary)]"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-[var(--border-primary)]">
            <div>
              {savedMessage && (
                <span className="font-bold text-[13px] flex items-center gap-1 animate-pulse" style={{color: 'var(--success-text)'}}>
                  <ShieldCheck className="w-4 h-4" /> {t('parameters_saved')}
                </span>
              )}
            </div>
            
            <button
              type="submit"
              className="px-6 py-3 premium-btn-primary text-white rounded-lg text-[13.5px] font-bold cursor-pointer"
            >
              {t('apply_system_parameters')}
            </button>
          </div>
        </form>

      </div>}

      {/* Stats Detail Modals */}
      {selectedStat !== null && (
        <Modal
          isOpen={selectedStat !== null}
          onClose={() => setSelectedStat(null)}
          maxWidth="max-w-3xl"
        >
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center pb-2 border-b border-[var(--border-primary)]">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                {selectedStat === 'volume'
                  ? 'Total Cash Disbursed'
                  : selectedStat === 'customers'
                  ? 'Active Customers Directory'
                  : selectedStat === 'outstanding'
                  ? 'Total Owed by Customers'
                  : 'Projected Interest (1 Year)'}
              </h3>
            </div>

            <div className="space-y-4">
              <p className="text-[13px] text-[var(--text-secondary)]">
                {selectedStat === 'volume'
                  ? 'History of all disbursed loans contributing to total cash outlays.'
                  : selectedStat === 'customers'
                  ? 'Directory of registered customer profiles active on the platform.'
                  : selectedStat === 'outstanding'
                  ? 'Current active principal debt balances owed by platform customers.'
                  : 'Annualized projected gross interest yield generated by current outstanding balances.'}
              </p>

              <div className="overflow-x-auto max-h-[400px] overflow-y-auto border border-[var(--border-primary)] rounded-2xl custom-scrollbar">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead className="bg-[var(--surface-secondary)] sticky top-0 z-10 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border-primary)]">
                    {selectedStat === 'volume' && (
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">ID</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                      </tr>
                    )}
                    {selectedStat === 'customers' && (
                      <tr>
                        <th className="px-4 py-3">ID</th>
                        <th className="px-4 py-3">Name</th>
                        {config.emailVerificationRequired !== false && <th className="px-4 py-3">Email</th>}
                        <th className="px-4 py-3">Phone</th>
                      </tr>
                    )}
                    {selectedStat === 'outstanding' && (
                      <tr>
                        <th className="px-4 py-3">Customer</th>
                        {config.emailVerificationRequired !== false && <th className="px-4 py-3">Email</th>}
                        <th className="px-4 py-3">Phone</th>
                        <th className="px-4 py-3 text-right">Outstanding Balance</th>
                      </tr>
                    )}
                    {selectedStat === 'yields' && (
                      <tr>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3 text-right">Balance</th>
                        <th className="px-4 py-3 text-center">APR</th>
                        <th className="px-4 py-3 text-right">Projected Yield</th>
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-[var(--border-secondary)] text-[var(--text-primary)]">
                    {selectedStat === 'volume' && (
                      (!stats.volumeTransactions || stats.volumeTransactions.length === 0) ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-[var(--text-tertiary)]">No disbursements found.</td>
                        </tr>
                      ) : stats.volumeTransactions.map((tx: any) => (
                        <tr key={tx.id} className="hover:bg-[var(--surface-secondary)]/50 transition-colors">
                          <td className="px-4 py-3 font-mono">{tx.date}</td>
                          <td className="px-4 py-3 font-mono text-[var(--text-tertiary)]">{tx.id}</td>
                          <td className="px-4 py-3">
                            <span className="font-bold block">{tx.userName}</span>
                            <span className="text-[11px] text-[var(--text-tertiary)] block">{tx.userPhone || tx.userEmail}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-extrabold font-mono text-emerald-600">
                            +{formatCurrency(Math.abs(tx.amount))}
                          </td>
                        </tr>
                      ))
                    )}

                    {selectedStat === 'customers' && (
                      (!stats.customerList || stats.customerList.length === 0) ? (
                        <tr>
                          <td colSpan={config.emailVerificationRequired !== false ? 4 : 3} className="px-4 py-8 text-center text-[var(--text-tertiary)]">No customers found.</td>
                        </tr>
                      ) : stats.customerList.map((c: any) => (
                        <tr key={c.id} className="hover:bg-[var(--surface-secondary)]/50 transition-colors">
                          <td className="px-4 py-3 font-mono text-[var(--text-tertiary)]">{c.id}</td>
                          <td className="px-4 py-3 font-bold">{c.name}</td>
                          {config.emailVerificationRequired !== false && <td className="px-4 py-3 font-mono text-[var(--text-tertiary)]">{c.email}</td>}
                          <td className="px-4 py-3 font-mono">{c.phone || '-'}</td>
                        </tr>
                      ))
                    )}

                    {selectedStat === 'outstanding' && (
                      (!stats.outstandingCustomers || stats.outstandingCustomers.length === 0) ? (
                        <tr>
                          <td colSpan={config.emailVerificationRequired !== false ? 4 : 3} className="px-4 py-8 text-center text-[var(--text-tertiary)]">No outstanding balances.</td>
                        </tr>
                      ) : stats.outstandingCustomers.map((c: any, index: number) => (
                        <tr key={index} className="hover:bg-[var(--surface-secondary)]/50 transition-colors">
                          <td className="px-4 py-3 font-bold">{c.name}</td>
                          {config.emailVerificationRequired !== false && <td className="px-4 py-3 font-mono text-[var(--text-tertiary)]">{c.email}</td>}
                          <td className="px-4 py-3 font-mono">{c.phone || '-'}</td>
                          <td className="px-4 py-3 text-right font-extrabold font-mono text-[var(--text-primary)]">
                            {formatCurrency(c.balance)}
                          </td>
                        </tr>
                      ))
                    )}

                    {selectedStat === 'yields' && (
                      (!stats.yieldCustomers || stats.yieldCustomers.length === 0) ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-[var(--text-tertiary)]">No yields active.</td>
                        </tr>
                      ) : stats.yieldCustomers.map((c: any, index: number) => (
                        <tr key={index} className="hover:bg-[var(--surface-secondary)]/50 transition-colors">
                          <td className="px-4 py-3 font-bold">{c.name}</td>
                          <td className="px-4 py-3 text-right font-mono text-[var(--text-secondary)]">
                            {formatCurrency(c.balance)}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-[var(--accent)]">
                            {c.rate}%
                          </td>
                          <td className="px-4 py-3 text-right font-extrabold font-mono text-emerald-600">
                            {formatCurrency(c.annualYield)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-2 border-t border-[var(--border-primary)]">
                <button
                  onClick={() => setSelectedStat(null)}
                  className="px-4 py-2 text-[13px] font-bold bg-[var(--surface-secondary)] text-[var(--text-primary)] rounded-xl border border-[var(--border-primary)] hover:bg-[var(--surface-tertiary)] transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function formatAuditDetails(details: string): string {
  if (details.startsWith('Platform config updated:')) {
    try {
      const jsonStr = details.replace('Platform config updated:', '').trim();
      const configObj = JSON.parse(jsonStr);
      const parts: string[] = [];

      const formatVal = (item: any, formatter: (val: any) => string) => {
        if (item === undefined || item === null) return '';
        if (typeof item === 'object' && 'from' in item && 'to' in item) {
          if (item.from === item.to) return formatter(item.to);
          return `${formatter(item.from)} ➔ ${formatter(item.to)}`;
        }
        return formatter(item);
      };

      if (configObj.baseInterestRate !== undefined) {
        const valStr = formatVal(configObj.baseInterestRate, (v) => `${v}%`);
        if (valStr) parts.push(`APR: ${valStr}`);
      }
      if (configObj.autoApproveLimit !== undefined) {
        const valStr = formatVal(configObj.autoApproveLimit, (v) => `$${Number(v).toLocaleString()}`);
        if (valStr) parts.push(`Auto-Approve Limit: ${valStr}`);
      }
      if (configObj.kycRequired !== undefined) {
        const valStr = formatVal(configObj.kycRequired, (v) => v ? 'Mandatory' : 'Optional');
        if (valStr) parts.push(`KYC: ${valStr}`);
      }
      if (configObj.reminder_time !== undefined) {
        const valStr = formatVal(configObj.reminder_time, (v) => String(v));
        if (valStr) parts.push(`Sweep Time: ${valStr}`);
      }
      if (configObj.telegram_admin_id !== undefined) {
        const valStr = formatVal(configObj.telegram_admin_id, (v) => v ? String(v) : 'None');
        if (valStr) parts.push(`Telegram Admin: ${valStr}`);
      }
      if (configObj.enable_admin_reports !== undefined) {
        const valStr = formatVal(configObj.enable_admin_reports, (v) => v ? 'On' : 'Off');
        if (valStr) parts.push(`Reports: ${valStr}`);
      }
      return `Updated Platform Config (${parts.join(', ')})`;
    } catch {
      return details;
    }
  }
  return details;
}
