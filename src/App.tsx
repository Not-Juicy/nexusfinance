import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { ShieldCheck, ArrowUpDown, X, LayoutDashboard, Landmark, CheckSquare, Settings, Users, HelpCircle, LogOut, User, PlusCircle, ClipboardList, ChevronDown, QrCode, Mail, HelpCircle as HelpIcon, Download, FileText, Calculator, Bell, Megaphone, AlertTriangle, Building2 } from 'lucide-react';
import AuthPage from './components/AuthPage';
import Toast, { showToast } from './components/Toast';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import PortalSelection from './components/PortalSelection';
import { SkeletonTable } from './components/Skeleton';
import Pagination from './components/Pagination';
import Modal from './components/Modal';
import EmptyState from './components/EmptyState';
import StatusBadge from './components/StatusBadge';
import Heading from './components/Heading';
import Table from './components/Table';
import LoansLedgerSection from './components/LoansLedgerSection';
import ComplianceTasksSection from './components/ComplianceTasksSection';
import { LoanApplication, Task, Transaction, PlatformConfig, PlatformStats, PortalType, Tenant } from './types';
import { DEFAULT_CONFIG, DEFAULT_STATS } from './data';
import { API, apiFetch } from './api';
import { downloadCSV } from './utils';
import { translations, useCurrency } from './context/CurrencyContext';

const CustomerDashboard = lazy(() => import('./components/CustomerDashboard'));
const LoanOfficerDashboard = lazy(() => import('./components/LoanOfficerDashboard'));
const SuperAdminDashboard = lazy(() => import('./components/SuperAdminDashboard'));
const ProfilePage = lazy(() => import('./components/ProfilePage'));
const ApplicationDetailsModal = lazy(() => import('./components/ApplicationDetailsModal'));
const ApplyLoanModal = lazy(() => import('./components/ApplyLoanModal'));
const RepayModal = lazy(() => import('./components/RepayModal'));
const LiveMeetingModal = lazy(() => import('./components/LiveMeetingModal'));
const AuditLogView = lazy(() => import('./components/AuditLogView'));
const KHQRPage = lazy(() => import('./components/KHQRPage'));
const KYCDocumentsPage = lazy(() => import('./components/KYCDocumentsPage'));
const LoanCalculator = lazy(() => import('./components/LoanCalculator'));
const LoanManagement = lazy(() => import('./components/LoanManagement'));
const SupportView = lazy(() => import('./components/SupportView'));
const UsersView = lazy(() => import('./components/UsersView'));
const OfficerRepaymentsView = lazy(() => import('./components/OfficerRepaymentsView'));
const ReminderSettingsView = lazy(() => import('./components/ReminderSettingsView'));
const ReportsView = lazy(() => import('./components/ReportsView'));
const AmortizationScheduleModal = lazy(() => import('./components/AmortizationScheduleModal'));
const BroadcastView = lazy(() => import('./components/BroadcastView'));
const TenantManagement = lazy(() => import('./components/TenantManagement'));
const TgSharePhone = lazy(() => import('./components/TgSharePhone'));
const PrivacyPolicy = lazy(() => import('./components/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./components/TermsOfService'));

const enc = (id: string) => encodeURIComponent(id);

function PaymentResult() {
  const params = new URLSearchParams(window.location.search);
  const tranId = params.get('tran_id');
  const isCancel = window.location.pathname === '/payment/cancel';

  useEffect(() => {
    const timer = setTimeout(() => {
      window.history.replaceState({}, '', '/');
      window.location.reload();
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--surface-primary)' }}>
      <div className="max-w-md w-full text-center space-y-6 p-8 rounded-3xl border" style={{ backgroundColor: 'var(--surface-card)', borderColor: 'var(--border-primary)' }}>
        <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center" style={{ backgroundColor: isCancel ? 'var(--warning-bg)' : 'var(--success-bg)' }}>
          {isCancel ? (
            <svg className="w-8 h-8" style={{ color: 'var(--warning-text)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          ) : (
            <svg className="w-8 h-8" style={{ color: 'var(--success-text)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {isCancel ? 'Payment Cancelled' : 'Payment Successful!'}
          </h1>
          <p className="text-sm mt-2" style={{ color: 'var(--text-tertiary)' }}>
            {isCancel
              ? 'Your payment was cancelled. You can try again from the dashboard.'
              : tranId
                ? `Transaction ${tranId} has been processed.`
                : 'Your payment has been processed successfully.'}
          </p>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Redirecting to dashboard in 5 seconds...</p>
      </div>
    </div>
  );
}
export default function App() {
  const [language, setLanguageState] = useState(() => localStorage.getItem('nexus_language') || 'en');
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'nexus_language' && e.newValue) {
        setLanguageState(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage as any);
    return () => window.removeEventListener('storage', handleStorage as any);
  }, []);

  const t = (key: string) => {
    const entry = translations[key];
    if (!entry) return key;
    return language === 'kh' ? entry.kh : entry.en;
  };

  const [token, setToken] = useState<string | null>(() => localStorage.getItem('nexus_token'));
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => localStorage.getItem('nexus_token') !== null);
  const [currentPortal, setCurrentPortal] = useState<PortalType>(() => {
    return (localStorage.getItem('nexus_portal') as PortalType) || 'portal-selection';
  });
  const [activeMenu, setActiveMenu] = useState(() => localStorage.getItem('nexus_active_menu') || 'dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [outstandingBalance, setOutstandingBalance] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [config, setConfig] = useState<PlatformConfig>(DEFAULT_CONFIG);
  const [stats, setStats] = useState<PlatformStats>(DEFAULT_STATS);

  const [userData, setUserData] = useState<{ id: number; name: string; email: string; role: string; tenant_id: number; tenant_name: string; tenant_slug: string; tenant_plan: string; tenant_logo_url?: string | null } | null>(null);

  const [selectedTenantId, setSelectedTenantId] = useState<string>(() => {
    return localStorage.getItem('nexus_selected_tenant_id') || 'all';
  });
  const [tenantsList, setTenantsList] = useState<Tenant[]>([]);

  const portalUser = useMemo(() => userData || (() => {
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        id: Number(payload.id),
        name: (payload as any).name || 'User',
        email: (payload as any).email || '',
        role: (payload as any).role || 'customer',
        tenant_id: (payload as any).tenant_id || 1,
        tenant_name: 'Default',
        tenant_slug: 'default',
        tenant_plan: 'founding',
        tenant_logo_url: null,
      };
    } catch { return null; }
  })(), [token, userData]);

  // Compute active tenant branding:
  // - If logged in as tenant admin, always display their organization's custom branding
  // - If logged in as root super-admin, display the selected tenant scope or fallback to platform branding
  const activeTenantBranding = useMemo(() => {
    const isTenantAdmin = portalUser?.role === 'admin';
    if (isTenantAdmin && portalUser?.tenant_id) {
      // Prioritize loaded tenant list if available
      const found = tenantsList.find(t => t.id === portalUser.tenant_id);
      if (found) {
        return { name: found.name, logo: found.logo_url || null };
      }
      return {
        name: portalUser.tenant_name || 'NexusFinance',
        logo: portalUser.tenant_logo_url || null,
      };
    }

    if (currentPortal === 'super-admin') {
      if (selectedTenantId === 'all') {
        return { name: 'NexusFinance', logo: null };
      }
      const found = tenantsList.find(t => String(t.id) === selectedTenantId);
      if (found) {
        return { name: found.name, logo: found.logo_url || null };
      }
    }
    return {
      name: portalUser?.tenant_name || 'NexusFinance',
      logo: portalUser?.tenant_logo_url || null,
    };
  }, [currentPortal, selectedTenantId, tenantsList, portalUser]);

  const [searchTermInvoice, setSearchTermInvoice] = useState('');
  const [selectedApplication, setSelectedApplication] = useState<LoanApplication | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [isRepayOpen, setIsRepayOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [viewingScheduleLoan, setViewingScheduleLoan] = useState<LoanApplication | null>(null);
  const [isMeetingOpen, setIsMeetingOpen] = useState(false);
  const [loanPage, setLoanPage] = useState(1);
  const [txPage, setTxPage] = useState(1);
  const [taskPage, setTaskPage] = useState(1);
  const [isInitialLoaded, setIsInitialLoaded] = useState(false);

  const calcBalance = (txs: Transaction[]) =>
    txs.reduce((sum, t) => sum + t.amount, 0);

  const refetchAll = async () => {
    const defaults = { loans: [], txs: [], tasks: [], config: null, stats: null, audit: [] };
    const [loans, txs, tasksData, configData, statsData, auditData] = await Promise.all([
      apiFetch('/loans').catch(() => defaults.loans),
      apiFetch('/transactions').catch(() => defaults.txs),
      apiFetch('/tasks').catch(() => defaults.tasks),
      apiFetch('/config?cb=' + Date.now()).catch((err) => { console.error('Config fetch failed:', err); return null; }),
      apiFetch('/stats?cb=' + Date.now()).catch(() => null),
      apiFetch('/audit/logs?cb=' + Date.now()).catch(() => []),
    ]);
    if (!localStorage.getItem('nexus_token')) { handleLogout(); return; }
    setApplications(loans.map((l: any) => ({ ...l, assignedToMe: l.assignedTo === portalUser?.id })));
    setTransactions(txs);
    setOutstandingBalance(Math.abs(calcBalance(txs)));
    setWalletBalance(txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0));
    setTasks(tasksData);
    setConfig(configData || DEFAULT_CONFIG);
    setStats(statsData || DEFAULT_STATS);
    setAuditLogs(auditData);
    setIsInitialLoaded(true);
  };

  useEffect(() => {
    if (!token) return;
    refetchAll();
    fetchUserData(token);
  }, [token]);

  // Fetch tenants for super-admin and tenant admin portal, and auto-select if URL matches a slug
  useEffect(() => {
    if (token && (currentPortal === 'super-admin' || portalUser?.role === 'super-admin' || portalUser?.role === 'admin')) {
      apiFetch('/tenants')
        .then(data => {
          if (Array.isArray(data)) {
            setTenantsList(data);

            // Check if URL pathname or search param matches any tenant slug
            const pathPart = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/')[0]?.toLowerCase();
            const params = new URLSearchParams(window.location.search);
            const orgParam = params.get('org') || params.get('tenant') || params.get('subscriber');
            const targetSlug = (orgParam || pathPart)?.toLowerCase();

            const systemRoutes = ['login', 'register', 'forgot', 'payment', 'tg-share-phone', 'privacy', 'terms', 'api'];
            if (targetSlug && !systemRoutes.includes(targetSlug)) {
              const matchedTenant = data.find(
                t => t.slug?.toLowerCase() === targetSlug || String(t.id) === targetSlug
              );
              if (matchedTenant) {
                const tidStr = String(matchedTenant.id);
                setSelectedTenantId(tidStr);
                localStorage.setItem('nexus_selected_tenant_id', tidStr);
                refetchAll();
              }
            }
          }
        })
        .catch(() => {});
    }
  }, [token, currentPortal, portalUser?.role]);

  useEffect(() => {
    ['nexus_applications','nexus_tasks','nexus_transactions','nexus_outstanding_bal','nexus_config','nexus_stats','nexus_is_logged_in']
      .forEach(k => localStorage.removeItem(k));
    const savedPortal = localStorage.getItem('nexus_portal');
    const savedMenu = localStorage.getItem('nexus_active_menu');
    if (savedPortal && savedPortal !== 'portal-selection') {
      setCurrentPortal(savedPortal as PortalType);
    } else if (portalUser) {
      const target = (portalUser.role === 'super-admin' || portalUser.role === 'admin') ? 'super-admin' : (portalUser.role as PortalType);
      setCurrentPortal(target);
      localStorage.setItem('nexus_portal', target);
    }
    if (savedMenu) setActiveMenu(savedMenu);

    // Check for Google OAuth callback token
    const params = new URLSearchParams(window.location.search);
    const googleToken = params.get('google_token');
    const googleError = params.get('error');
    if (googleToken) {
      handleLoginSuccess(googleToken);
      window.history.replaceState({}, '', window.location.pathname);
    } else if (googleError) {
      console.error('Google OAuth error:', googleError);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (portalUser && portalUser.role) {
      const targetPortal: PortalType = (portalUser.role === 'super-admin' || portalUser.role === 'admin') ? 'super-admin' : (portalUser.role as PortalType);
      if (currentPortal !== targetPortal) {
        setCurrentPortal(targetPortal);
        localStorage.setItem('nexus_portal', targetPortal);
      }
    }
  }, [portalUser, currentPortal]);

  const saveToStorage = (key: string, val: string) => localStorage.setItem(key, val);

  async function fetchUserData(newToken: string) {
    try {
      const res = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${newToken}` } });
      const data = await res.json();
      if (res.ok && data.role) {
        setUserData(data);
        if (data.role === 'customer') handleSetPortal('customer');
        else if (data.role === 'loan-officer') handleSetPortal('loan-officer');
        else handleSetPortal('super-admin');
      }
    } catch { /* fallback */ }
  }

  const handleLoginSuccess = (newToken: string) => {
    localStorage.setItem('nexus_token', newToken);
    localStorage.removeItem('nexus_portal');
    localStorage.removeItem('nexus_active_menu');
    setToken(newToken);
    setIsLoggedIn(true);
    fetchUserData(newToken);
  };

  const handleLogout = async () => {
    document.documentElement.classList.remove('dark');
    setIsLoggedIn(false);
    setToken(null);
    ['nexus_token', 'nexus_portal', 'nexus_active_menu'].forEach(k => localStorage.removeItem(k));
    setCurrentPortal('customer');
    setMobileMenuOpen(false);
    setApplications([]);
    setTasks([]);
    setTransactions([]);
    setOutstandingBalance(0);
    setWalletBalance(0);
    setConfig(DEFAULT_CONFIG);
    setStats(DEFAULT_STATS);
    setAuditLogs([]);
    setIsInitialLoaded(false);
  };

  const handleSetPortal = (portal: PortalType) => {
    if (!portalUser) return;
    if (portal === 'super-admin' && portalUser.role !== 'super-admin' && portalUser.role !== 'admin') return;
    if (portal === 'loan-officer' && portalUser.role !== 'loan-officer' && portalUser.role !== 'super-admin' && portalUser.role !== 'admin') return;
    if (portal === 'portal-selection' && portalUser.role !== 'super-admin' && portalUser.role !== 'admin') return;
    setCurrentPortal(portal);
    saveToStorage('nexus_portal', portal);
    if (portal === 'loan-officer') setActiveMenu('dashboard');
    else if (portal === 'customer') setActiveMenu('dashboard');
    else if (portal === 'super-admin') setActiveMenu('dashboard');
    setMobileMenuOpen(false);
  };

  const handleSetActiveMenu = (menu: string) => {
    setActiveMenu(menu);
    saveToStorage('nexus_active_menu', menu);
    setMobileMenuOpen(false);
  };

  const reloadLoans = async () => {
    try {
      const data = await apiFetch('/loans');
      const userId = portalUser?.id;
      setApplications(data.map((l: any) => ({ ...l, assignedToMe: l.assignedTo === userId })));
    } catch {}
  };
  const reloadTransactions = async () => {
    try {
      const data = await apiFetch('/transactions');
      setTransactions(data);
      setOutstandingBalance(Math.abs(calcBalance(data)) || 1200);
    } catch {}
  };

  const handleApproveApplication = async (id: string) => {
    try {
      await apiFetch(`/loans/${enc(id)}/approve`, { method: 'PATCH' });
      await Promise.all([reloadLoans(), reloadTransactions()]);
    } catch (e: any) {
      showToast(e.message || 'Failed to approve loan', 'error');
    }
  };

  const handleRejectApplication = async (id: string) => {
    try {
      await apiFetch(`/loans/${enc(id)}/reject`, { method: 'PATCH' });
      await reloadLoans();
    } catch (e: any) {
      showToast(e.message || 'Failed to reject loan', 'error');
    }
  };

  const handleHoldApplication = async (id: string) => {
    try {
      await apiFetch(`/loans/${enc(id)}/hold`, { method: 'PATCH' });
      await reloadLoans();
    } catch (e: any) {
      showToast(e.message || 'Failed to hold loan', 'error');
    }
  };

  const handleCompleteMeetingKyc = async () => {
    if (!selectedTask) return;
    try {
      await apiFetch(`/tasks/${selectedTask.id}/complete`, { method: 'PATCH' });
      const data = await apiFetch('/tasks');
      setTasks(data);
      showToast('KYC completed successfully');
    } catch (e: any) {
      showToast(e.message || 'Failed to complete KYC', 'error');
    }
  };

  const handleUpdateConfig = async (newConfig: PlatformConfig) => {
    try {
      await apiFetch('/config', { method: 'PATCH', body: JSON.stringify(newConfig) });
      const [configData, auditData] = await Promise.all([
        apiFetch('/config?cb=' + Date.now()),
        apiFetch('/audit/logs?cb=' + Date.now()).catch(() => [])
      ]);
      setConfig(configData);
      setAuditLogs(auditData);
      showToast('Configuration updated successfully');
    } catch (e: any) {
      showToast(e.message || 'Failed to update config', 'error');
    }
  };

  const handleApplyLoanSubmit = async (appData: Partial<LoanApplication>) => {
    try {
      await apiFetch('/loans', { method: 'POST', body: JSON.stringify(appData) });
      await reloadLoans();
      setIsApplyOpen(false);
      showToast('Loan application submitted');
    } catch (e: any) {
      showToast(e.message || 'Failed to submit loan application', 'error');
    }
  };

  const handleRepayConfirm = async (amount: number) => {
    try {
      await apiFetch('/transactions/repay', { method: 'POST', body: JSON.stringify({ amount }) });
      await reloadTransactions();
      setIsRepayOpen(false);
      showToast('Repayment successful');
    } catch (e: any) {
      showToast(e.message || 'Repayment failed', 'error');
    }
  };

  const handleInstantApprovedFastCash = async (amount: number) => {
    try {
      await apiFetch('/transactions/disburse', { method: 'POST', body: JSON.stringify({ amount }) });
      await reloadTransactions();
      showToast(`$${amount} Fast Cash disbursed`);
    } catch (e: any) {
      showToast(e.message || 'Fast Cash disbursement failed', 'error');
    }
  };

  const handleOpenApplicationDetails = (app: LoanApplication) => {
    setSelectedApplication(app);
    setIsDetailOpen(true);
  };

  const handleJoinMeeting = (task: Task) => {
    setSelectedTask(task);
    setIsMeetingOpen(true);
  };


  const isPaymentResult = window.location.pathname === '/payment/success' || window.location.pathname === '/payment/cancel';
  const isTgSharePhone = window.location.pathname === '/tg-share-phone';
  const isPrivacy = window.location.pathname === '/privacy';
  const isTerms = window.location.pathname === '/terms';

  return (
    <div className="min-h-screen bg-[var(--surface-secondary)] app-root">
      <Toast />
      {isPaymentResult ? (
        <PaymentResult />
      ) : isTgSharePhone ? (
        <Suspense fallback={<div className="p-8 text-center text-white">Loading...</div>}>
          <TgSharePhone />
        </Suspense>
      ) : isPrivacy ? (
        <Suspense fallback={<div className="p-8 text-center text-[var(--text-secondary)]">Loading...</div>}>
          <PrivacyPolicy />
        </Suspense>
      ) : isTerms ? (
        <Suspense fallback={<div className="p-8 text-center text-[var(--text-secondary)]">Loading...</div>}>
          <TermsOfService />
        </Suspense>
      ) : !isLoggedIn ? (
        <AuthPage onLoginSuccess={handleLoginSuccess} />
      ) : currentPortal === 'portal-selection' ? (
        <PortalSelection onSelectPortal={handleSetPortal} userRole={portalUser?.role || 'customer'} />
      ) : (
      <>
      <Sidebar
        currentPortal={currentPortal}
        userRole={portalUser?.role}
        activeMenu={activeMenu}
        setActiveMenu={handleSetActiveMenu}
        onApplyForLoan={() => setIsApplyOpen(true)}
        onLogout={handleLogout}
        tenantName={activeTenantBranding.name}
        tenantLogo={activeTenantBranding.logo}
      />

      <div className="md:pl-72 app-content min-h-screen flex flex-col">
        <Header
          currentPortal={currentPortal}
          searchTermInvoice={searchTermInvoice}
          setSearchTermInvoice={setSearchTermInvoice}
          onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
          isMobileMenuOpen={mobileMenuOpen}
          onPortalSwitchClick={() => handleSetPortal('portal-selection')}
          userName={portalUser?.name}
          userRole={portalUser?.role}
          onProfileClick={() => handleSetActiveMenu('profile')}
          onLogout={handleLogout}
          selectedTenantId={selectedTenantId}
          tenants={tenantsList}
          onTenantChange={(tid) => {
            setSelectedTenantId(tid);
            refetchAll();
          }}
        />

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <>
            <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={() => setMobileMenuOpen(false)} />
            <div className="fixed top-0 left-0 h-full w-72 z-50 animate-slide-in-left duration-200 md:hidden overflow-y-auto"
              style={{ backgroundColor: 'var(--surface-secondary)', borderRight: '1px solid var(--sidebar-border)' }}
            >
              <div className="flex items-center justify-between px-5 py-5 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
                <div className="flex items-center gap-3.5">
                  <span className="font-sans text-[18px] tracking-tight flex items-center">
                    <span className="font-extrabold" style={{ color: 'var(--sidebar-header-text)' }}>Nexus</span>
                    <span className="font-light" style={{ color: 'var(--sidebar-header-muted)' }}>finance</span>
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--accent-muted)', color: 'var(--accent)' }}
                  >
                    {currentPortal === 'loan-officer' ? 'Corporate' : currentPortal === 'super-admin' ? 'Admin' : 'Client'}
                  </span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-lg cursor-pointer" style={{ color: 'var(--sidebar-text-muted)' }}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              {currentPortal === 'customer' && (
                <div className="px-4 pt-4 pb-2">
                  <button
                    onClick={() => { setIsApplyOpen(true); setMobileMenuOpen(false); }}
                    className="w-full premium-btn-primary font-bold text-[14px] py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <PlusCircle className="w-4.5 h-4.5" /> {t('apply_loan')}
                  </button>
                </div>
              )}

              <div className="px-3 py-3 space-y-0.5">
                {(() => {
                  const isSuperAdmin = portalUser?.role === 'super-admin';
                  const items = currentPortal === 'loan-officer'
                    ? [
                        { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
                        { id: 'repayments', label: t('repayments_checklist'), icon: ClipboardList }
                      ]
                    : currentPortal === 'super-admin'
                    ? [
                        { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
                        ...(isSuperAdmin ? [{ id: 'tenants', label: t('tenants'), icon: Building2 }] : []),
                        { id: 'users', label: t('users'), icon: Users },
                        { id: 'reminders', label: t('reminders'), icon: Bell },
                        { id: 'broadcast', label: t('broadcast'), icon: Megaphone },
                        { id: 'audit', label: t('audit'), icon: ClipboardList },
                        { id: 'settings', label: t('settings'), icon: Settings }
                      ]
                    : [{ id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard }, { id: 'loans', label: t('loans'), icon: Landmark }, { id: 'khqr', label: t('khqr_payment'), icon: QrCode }];
                  return items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeMenu === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => { handleSetActiveMenu(item.id); setMobileMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 cursor-pointer ${isActive ? 'bg-[var(--accent)]/20 text-[var(--text-primary)] border border-[var(--accent)]/40 shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] border border-transparent hover:border-[var(--border-primary)]'}`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${isActive ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface-secondary)] text-[var(--text-tertiary)]'}`}
                          style={isActive ? undefined : undefined}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        {item.label}
                      </button>
                    );
                  });
                })()}
              </div>
              <div className="px-3 py-3 border-t space-y-0.5" style={{ borderColor: 'var(--sidebar-border)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest px-3 pb-1" style={{ color: 'var(--sidebar-text-muted)' }}>{t('account')}</p>
                <button
                  onClick={() => { setActiveMenu('profile'); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 cursor-pointer group hover:bg-[var(--sidebar-active-bg)]"
                  style={{ color: activeMenu === 'profile' ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)' }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 group-hover:bg-[var(--sidebar-icon-bg)]"
                    style={{ backgroundColor: activeMenu === 'profile' ? 'var(--sidebar-icon-active-bg)' : 'var(--sidebar-icon-bg)', color: activeMenu === 'profile' ? 'var(--sidebar-icon-active-text)' : 'var(--sidebar-icon-text)' }}
                  >
                    <User className="w-4 h-4" />
                  </div>
                  {t('profile')}
                </button>
                <button
                  onClick={() => { setActiveMenu('support'); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 cursor-pointer group hover:bg-[var(--sidebar-active-bg)]"
                  style={{ color: activeMenu === 'support' ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)' }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 group-hover:bg-[var(--sidebar-icon-bg)]"
                    style={{ backgroundColor: activeMenu === 'support' ? 'var(--sidebar-icon-active-bg)' : 'var(--sidebar-icon-bg)', color: activeMenu === 'support' ? 'var(--sidebar-icon-active-text)' : 'var(--sidebar-icon-text)' }}
                  >
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  {t('support')}
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 cursor-pointer group hover:bg-red-500/10"
                  style={{ color: 'rgba(239, 68, 68, 0.6)' }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 group-hover:bg-red-500/10"
                    style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'rgba(239, 68, 68, 0.6)' }}
                  >
                    <LogOut className="w-4 h-4" />
                  </div>
                  Logout
                </button>
              </div>
            </div>
          </>
        )}

        <main className="p-4 md:p-8 w-full max-w-7xl mx-auto animate-content-enter flex-1 flex flex-col justify-start">
          {!isInitialLoaded ? (
            <div className="flex-1 flex items-center justify-center min-h-[50vh] p-4 select-none animate-in fade-in duration-300">
              <style>{`
                @keyframes shimmer-bar {
                  0% { transform: translateX(-100%); }
                  100% { transform: translateX(300%); }
                }
              `}</style>
              <div className="max-w-sm w-full bg-[var(--surface-card)] border border-[var(--border-primary)] rounded-3xl p-8 flex flex-col items-center text-center space-y-6 relative overflow-hidden shadow-xl">
                {/* Glowing backgrounds */}
                <div className="absolute -top-12 -left-12 w-24 h-24 rounded-full bg-[var(--accent)]/10 blur-xl"></div>
                <div className="absolute -bottom-12 -right-12 w-24 h-24 rounded-full bg-[var(--accent)]/10 blur-xl"></div>
                
                {/* Stylized animated orbit loader */}
                <div className="relative w-16 h-16 flex items-center justify-center">
                  {/* Outer spinning gradient ring */}
                  <div className="absolute inset-0 border-[3px] border-t-[var(--accent)] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin duration-1000"></div>
                  {/* Middle counter-spinning ring */}
                  <div className="absolute inset-1.5 border-[2px] border-b-[var(--accent)]/55 border-t-transparent border-r-transparent border-l-transparent rounded-full animate-spin duration-1500 reverse"></div>
                  {/* Inner pulsing solid core */}
                  <div className="w-6 h-6 rounded-full bg-[var(--accent)]/20 flex items-center justify-center animate-pulse">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent)]"></span>
                  </div>
                </div>

                <div className="space-y-1.5 relative z-10">
                  <h3 className="font-sans font-extrabold text-[15.5px] tracking-tight text-[var(--text-primary)]">Syncing Ledger Node</h3>
                  <p className="text-[12px] text-[var(--text-secondary)] font-medium max-w-[240px] mx-auto leading-relaxed">
                    Loading platform parameters, reminder rules, and transaction history...
                  </p>
                </div>

                {/* Pulsing horizontal progress line */}
                <div className="w-32 h-[3.5px] bg-[var(--surface-secondary)] border border-[var(--border-primary)] rounded-full overflow-hidden relative">
                  <div className="absolute top-0 left-0 h-full w-1/3 bg-[var(--accent)] rounded-full"
                    style={{ animation: 'shimmer-bar 1.5s infinite linear' }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <Suspense fallback={<div className="p-8"><SkeletonTable rows={4} /></div>}>
          {currentPortal === 'loan-officer' && (
            activeMenu === 'dashboard' ? (
              <LoanOfficerDashboard
                applications={applications}
                tasks={tasks}
                searchTerm={searchTermInvoice}
                onOpenDetails={handleOpenApplicationDetails}
                onJoinMeeting={handleJoinMeeting}
              />
            ) : activeMenu === 'manage' ? (
              <LoanManagement applications={applications} onRefresh={refetchAll} />
            ) : activeMenu === 'repayments' ? (
              <OfficerRepaymentsView loans={applications} onRefresh={refetchAll} onViewSchedule={setViewingScheduleLoan} />
            ) : activeMenu.startsWith('report_') ? (
              <ReportsView activeReport={activeMenu} loans={applications} transactions={transactions} onViewSchedule={setViewingScheduleLoan} />
            ) : null
          )}

          {currentPortal === 'customer' && (
            activeMenu === 'dashboard' ? (
              <CustomerDashboard
                userName={portalUser?.name || 'Customer'}
                outstandingBalance={outstandingBalance}
                walletBalance={walletBalance}
                transactions={transactions}
                onApplyLoanClick={() => setIsApplyOpen(true)}
                onSetActiveMenu={handleSetActiveMenu}
                onInstantApprovedFastCash={handleInstantApprovedFastCash}
                applications={applications}
              />
            ) : activeMenu === 'loans' ? (
              <LoansLedgerSection applications={applications} loanPage={loanPage} setLoanPage={setLoanPage} userEmail={portalUser?.email} transactions={transactions} txPage={txPage} setTxPage={setTxPage} />
            ) : activeMenu === 'documents' ? (
              <KYCDocumentsPage />
            ) : activeMenu === 'calculator' ? (
              <LoanCalculator />
            ) : activeMenu === 'khqr' ? (
              <KHQRPage />
            ) : null
          )}

          {currentPortal === 'super-admin' && (
            activeMenu === 'dashboard' ? (
              <SuperAdminDashboard
                key={selectedTenantId}
                config={config}
                stats={stats}
                auditLogs={auditLogs}
                onUpdateConfig={handleUpdateConfig}
                view="dashboard"
                applications={applications}
                setActiveMenu={handleSetActiveMenu}
                userRole={portalUser?.role}
              />
            ) : activeMenu === 'tenants' ? (
              portalUser?.role === 'super-admin' ? (
                <TenantManagement selectedTenantId={selectedTenantId} />
              ) : (
                <SuperAdminDashboard
                  key={selectedTenantId}
                  config={config}
                  stats={stats}
                  auditLogs={auditLogs}
                  onUpdateConfig={handleUpdateConfig}
                  view="dashboard"
                  applications={applications}
                  setActiveMenu={handleSetActiveMenu}
                  userRole={portalUser?.role}
                />
              )
            ) : activeMenu === 'users' ? (
              <UsersView key={selectedTenantId} userRole={portalUser?.role} />
            ) : activeMenu === 'audit' ? (
              <AuditLogView key={selectedTenantId} />
            ) : activeMenu === 'manage' ? (
              <LoanManagement key={selectedTenantId} applications={applications} onRefresh={refetchAll} />
            ) : activeMenu === 'reminders' ? (
              <ReminderSettingsView key={selectedTenantId} />
            ) : activeMenu === 'broadcast' ? (
              <BroadcastView key={selectedTenantId} />
            ) : activeMenu === 'settings' ? (
              <SuperAdminDashboard
                key={selectedTenantId}
                config={config}
                stats={stats}
                auditLogs={auditLogs}
                onUpdateConfig={handleUpdateConfig}
                view="settings"
                applications={applications}
                userRole={portalUser?.role}
              />
            ) : null
          )}

          {activeMenu === 'profile' && (
            <ProfilePage token={token} user={portalUser} onProfileUpdate={(updated) => setUserData(prev => prev ? { ...prev, ...updated } : prev)} />
          )}

          {activeMenu === 'support' && (
            <SupportView />
          )}
          </Suspense>
          )}
        </main>
      </div>

      <Suspense fallback={null}>
      {viewingScheduleLoan && (
        <AmortizationScheduleModal
          loan={viewingScheduleLoan}
          onClose={() => setViewingScheduleLoan(null)}
        />
      )}
      <ApplicationDetailsModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        application={selectedApplication}
        onApprove={handleApproveApplication}
        onReject={handleRejectApplication}
        onHold={handleHoldApplication}
      />

      <ApplyLoanModal
        isOpen={isApplyOpen}
        onClose={() => setIsApplyOpen(false)}
        onSubmit={handleApplyLoanSubmit}
        userName={portalUser?.name}
        userEmail={portalUser?.email}
      />

      <RepayModal
        isOpen={isRepayOpen}
        onClose={() => setIsRepayOpen(false)}
        outstandingBalance={outstandingBalance}
        onRepayConfirm={handleRepayConfirm}
      />

      <LiveMeetingModal
        isOpen={isMeetingOpen}
        onClose={() => { setIsMeetingOpen(false); setSelectedTask(null); }}
        applicantName={selectedTask?.applicant || ''}
        regardingLoan={selectedTask?.regarding || ''}
        onCompleteKyc={handleCompleteMeetingKyc}
      />
      </Suspense>
      </>)}
    </div>
  );
}
