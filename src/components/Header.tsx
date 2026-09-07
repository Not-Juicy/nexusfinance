import React, { useState, useEffect } from 'react';
import { Search, Bell, Menu, X, User, LogOut, Layers, Sun, Moon, DollarSign, Building2, ChevronDown } from 'lucide-react';
import { PortalType, Tenant } from '../types';
import { API, apiFetch } from '../api';
import { useCurrency } from '../context/CurrencyContext';

interface HeaderProps {
  currentPortal: PortalType;
  searchTermInvoice: string;
  setSearchTermInvoice: (val: string) => void;
  onNotificationsClick?: () => void;
  onPortalSwitchClick?: () => void;
  onMobileMenuToggle?: () => void;
  isMobileMenuOpen?: boolean;
  userName?: string;
  userRole?: string;
  onProfileClick?: () => void;
  onLogout?: () => void;
  onTenantChange?: (tenantId: string) => void;
  selectedTenantId?: string;
  tenants?: Tenant[];
}

export default function Header({
  currentPortal,
  searchTermInvoice,
  setSearchTermInvoice,
  onNotificationsClick,
  onPortalSwitchClick,
  onMobileMenuToggle,
  isMobileMenuOpen = false,
  userName,
  userRole,
  onProfileClick,
  onLogout,
  onTenantChange,
  selectedTenantId: propSelectedTenantId,
  tenants: propTenants,
}: HeaderProps) {
  const [internalTenants, setInternalTenants] = useState<Tenant[]>([]);
  const [internalSelectedTenantId, setInternalSelectedTenantId] = useState<string>(() => {
    return localStorage.getItem('nexus_selected_tenant_id') || 'all';
  });

  const tenants = propTenants || internalTenants;
  const selectedTenantId = propSelectedTenantId !== undefined ? propSelectedTenantId : internalSelectedTenantId;

  const [showTenantDropdown, setShowTenantDropdown] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { currency, setCurrency, formatCurrencyShort, language, setLanguage } = useCurrency();
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('nexus_dark_mode');
    if (saved !== null) {
      const isDark = saved === 'true';
      document.documentElement.classList.toggle('dark', isDark);
      return isDark;
    }
    return document.documentElement.classList.contains('dark');
  });

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('nexus_dark_mode', String(next));
  };

  useEffect(() => {
    const poll = () => {
      const t = localStorage.getItem('nexus_token');
      if (!t) { setNotifications([]); return; }
      apiFetch('/notifications').then(setNotifications).catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, []);

  // Fetch tenants for super-admin switcher
  useEffect(() => {
    if (currentPortal === 'super-admin' && !propTenants) {
      apiFetch('/tenants')
        .then(data => {
          if (Array.isArray(data)) setInternalTenants(data);
        })
        .catch(() => {});
    }
  }, [currentPortal, propTenants]);

  // SSE real-time notifications
  useEffect(() => {
    const t = localStorage.getItem('nexus_token');
    if (!t) return;
    let es: EventSource;
    try {
      es = new EventSource(`${API}/notifications/stream?token=${encodeURIComponent(t)}`);
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'notification') {
            setNotifications(prev => [{ id: Date.now(), text: data.text, time: data.time, unread: true }, ...prev]);
          }
        } catch {}
      };
    } catch {}
    return () => { es?.close(); };
  }, []);

  const unreadCount = notifications.filter(n => n.unread).length;

  const handleMarkRead = async (id: number) => {
    await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' }).catch(() => {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n));
  };

  const handleNotificationClick = () => {
    setShowNotificationsDropdown(!showNotificationsDropdown);
  };

  const roleLabel = currentPortal === 'super-admin' ? (userRole === 'super-admin' ? 'Super Admin' : 'Admin') : currentPortal === 'loan-officer' ? 'Loan Officer' : 'Customer';

  return (
    <div className="sticky top-4 z-30 px-4 md:px-6 w-full mb-8">
      <header className="flex justify-between items-center px-4 md:px-8 h-16 w-full bg-[var(--surface-card)] backdrop-blur-2xl border border-[var(--border-primary)] rounded-[20px] shadow-sm transition-all duration-300">
        {/* Mobile Menu Trigger & Logo */}
        <div className="flex items-center gap-3 md:hidden">
          <button 
            onClick={onMobileMenuToggle}
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileMenuOpen}
            className="p-1 rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] focus:outline-none cursor-pointer"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <div className="flex items-center gap-2 select-none">
            <h1 className="font-sans text-[17px] tracking-tight flex items-center">
              <span className="text-[var(--text-primary)] font-black">Nexus</span>
              <span className="text-[var(--text-primary)] font-light">finance</span>
            </h1>
          </div>
        </div>

        {/* Action Tray */}
        <div className="flex items-center gap-2 relative ml-auto">
          {/* Tenant Switcher (Root Super Admin Only) */}
          {currentPortal === 'super-admin' && userRole === 'super-admin' && (
            <div className="relative">
              <button
                onClick={() => setShowTenantDropdown(!showTenantDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-secondary)]/70 hover:bg-[var(--surface-secondary)] text-[12px] font-bold transition-all cursor-pointer shadow-xs"
                title="Switch Organization / Tenant"
              >
                <div className="w-5 h-5 rounded-md bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center shrink-0">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <span className="max-w-[130px] truncate text-[var(--text-primary)]">
                  {selectedTenantId === 'all'
                    ? 'All Subscribers'
                    : (tenants.find(t => String(t.id) === selectedTenantId)?.name || `Subscriber #${selectedTenantId}`)}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0" />
              </button>

              {showTenantDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowTenantDropdown(false)} />
                  <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-56 bg-[var(--surface-card)] border border-[var(--border-primary)] rounded-2xl shadow-xl py-1.5 z-50 animate-dropdown-enter backdrop-blur-xl">
                    <div className="px-3 py-1.5 border-b border-[var(--border-primary)] text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--text-tertiary)]">
                      Subscriber Scope
                    </div>
                    
                    {/* All Subscribers Option */}
                    <button
                      onClick={() => {
                        setInternalSelectedTenantId('all');
                        localStorage.setItem('nexus_selected_tenant_id', 'all');
                        setShowTenantDropdown(false);
                        if (onTenantChange) onTenantChange('all');
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 text-[12.5px] font-semibold text-left transition-colors cursor-pointer ${
                        selectedTenantId === 'all'
                          ? 'bg-[var(--accent)]/15 text-[var(--accent)] font-bold'
                          : 'text-[var(--text-primary)] hover:bg-[var(--surface-secondary)]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 opacity-70" />
                        <span>All Subscribers</span>
                      </div>
                      {selectedTenantId === 'all' && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />}
                    </button>

                    {/* Specific Subscribers */}
                    {tenants.map((tenant) => (
                      <button
                        key={tenant.id}
                        onClick={() => {
                          const tidStr = String(tenant.id);
                          setInternalSelectedTenantId(tidStr);
                          localStorage.setItem('nexus_selected_tenant_id', tidStr);
                          setShowTenantDropdown(false);
                          if (onTenantChange) onTenantChange(tidStr);
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 text-[12.5px] font-semibold text-left transition-colors cursor-pointer ${
                          selectedTenantId === String(tenant.id)
                            ? 'bg-[var(--accent)]/15 text-[var(--accent)] font-bold'
                            : 'text-[var(--text-primary)] hover:bg-[var(--surface-secondary)]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {tenant.logo_url ? (
                            <img src={tenant.logo_url} alt="" className="w-4 h-4 rounded-xs object-contain" />
                          ) : (
                            <Building2 className="w-4 h-4 opacity-70 shrink-0" />
                          )}
                          <span className="truncate">{tenant.name}</span>
                        </div>
                        {selectedTenantId === String(tenant.id) && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] rounded-full transition-colors cursor-pointer"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* Language Toggle */}
          <button
            onClick={() => setLanguage(language === 'en' ? 'kh' : 'en')}
            aria-label="Toggle language"
            className="group flex items-center gap-2 px-3 py-1.5 text-[12px] font-bold rounded-xl transition-all duration-300 border border-[var(--border-primary)] bg-[var(--surface-card)] hover:border-[var(--text-tertiary)] hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 cursor-pointer"
          >
            <div className="flex items-center gap-1">
              <span className={language === 'en' ? 'text-[var(--accent)] font-extrabold' : 'text-[var(--text-tertiary)]'}>EN</span>
              <span className="text-[var(--border-primary)]">|</span>
              <span className={language === 'kh' ? 'text-[var(--accent)] font-extrabold' : 'text-[var(--text-tertiary)]'}>KH</span>
            </div>
          </button>

          {/* Notifications */}
          <div className="relative">
            <button 
              onClick={handleNotificationClick}
              aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
              aria-expanded={showNotificationsDropdown}
              aria-haspopup="true"
              className="p-2 text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] rounded-full transition-colors cursor-pointer relative"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] text-[10px] font-bold bg-red-600 text-white rounded-full flex items-center justify-center px-1 border-2 border-[var(--surface-card)] animate-check-bounce">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotificationsDropdown && (
              <div className="fixed md:absolute left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-0 top-20 md:top-auto md:mt-2 w-[calc(100vw-2rem)] md:w-80 bg-[var(--surface-elevated)] border border-[var(--border-primary)] rounded-[20px] shadow-xl py-2 z-50 animate-dropdown-enter">
                <div className="px-4 py-2 border-b border-[var(--border-primary)] flex justify-between items-center bg-[var(--surface-secondary)] rounded-t-[20px]">
                  <span className="font-bold text-[14px] text-[var(--text-primary)]">Notifications</span>
                  {unreadCount > 0 && <span className="text-[11px] text-[var(--text-inverse)] bg-[var(--accent)] font-bold px-2 py-0.5 rounded-[8px]">{unreadCount} new</span>}
                </div>
                <div className="divide-y divide-[var(--border-primary)] max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-[var(--text-tertiary)] text-[13px]">No notifications yet</div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => { if (notif.unread) handleMarkRead(notif.id); }}
                        className={`p-3 text-[13px] hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer ${notif.unread ? 'bg-[var(--accent-muted)]' : ''}`}
                      >
                        <p className={`text-[var(--text-primary)] ${notif.unread ? 'font-semibold' : ''}`}>{notif.text}</p>
                        <span className="text-[10px] text-[var(--text-tertiary)] mt-1 block">{notif.time}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-2 text-center text-[12px] bg-[var(--surface-secondary)]/50 border-t border-[var(--border-primary)] rounded-b-[20px]">
                  <button onClick={() => setShowNotificationsDropdown(false)} className="text-[var(--text-secondary)] font-bold hover:underline cursor-pointer">Close</button>
                </div>
              </div>
            )}
          </div>

          {/* User Info + Avatar */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              aria-label="User menu"
              aria-expanded={showUserMenu}
              aria-haspopup="true"
              className="flex items-center gap-2.5 cursor-pointer"
            >
              <div className="hidden md:block text-right">
                <p className="text-[13px] font-bold text-[var(--text-primary)] leading-tight">{userName || 'User'}</p>
                <p className="text-[11px] font-semibold text-[var(--text-tertiary)] leading-tight">{roleLabel}</p>
              </div>
              <div className="w-10 h-10 rounded-[14px] overflow-hidden border-2 border-[var(--border-primary)] hover:border-[var(--accent)] transition-colors flex items-center justify-center"
                style={{ backgroundColor: 'var(--avatar-bg)', color: 'var(--avatar-text)' }}
              >
                <User className="w-5 h-5" />
              </div>
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-[var(--surface-card)] border border-[var(--border-primary)] rounded-[16px] shadow-xl py-1 z-50 animate-dropdown-enter backdrop-blur-xl">
                  <button
                    onClick={() => { setShowUserMenu(false); if (onProfileClick) onProfileClick(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] cursor-pointer"
                  >
                    <User className="w-4 h-4 text-[var(--text-secondary)]" /> Profile
                  </button>

                  <hr className="border-[var(--border-primary)] my-1" />
                  <button
                    onClick={() => { setShowUserMenu(false); if (onLogout) onLogout(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] font-semibold text-[var(--error-text)] hover:bg-[var(--error-bg)] cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
    </div>
  );
}
