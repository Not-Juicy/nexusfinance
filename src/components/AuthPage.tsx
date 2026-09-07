import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  Lock, 
  User, 
  Phone, 
  HelpCircle, 
  RefreshCw,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  Network,
  Target,
  QrCode,
  Send,
  MonitorSmartphone,
  FileText,
  Briefcase,
  CheckCircle2,
  Mail,
  Globe,
  MessageCircle,
  MapPin,
  Clock,
  X
} from 'lucide-react';
import { showToast } from './Toast';
import { API } from '../api';
import { useCurrency } from '../context/CurrencyContext';

interface AuthPageProps {
  onLoginSuccess: (token: string) => void;
}

type AuthView = 'login' | 'register' | 'forgot';

export default function AuthPage({ onLoginSuccess }: AuthPageProps) {
  const { language, setLanguage, isKhmer } = useCurrency();
  const [view, setView] = useState<AuthView>('login');
  const [emailVerificationRequired, setEmailVerificationRequired] = useState<boolean | null>(null);

  // Dedicated URL Subscriber (e.g. /kako or ?org=kako)
  const [dedicatedTenant, setDedicatedTenant] = useState<{ id: number; name: string; slug: string; logo_url: string | null } | null>(null);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [tenantError, setTenantError] = useState<string | null>(null);

  // Detect subscriber slug from pathname or ?org= query parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orgParam = params.get('org') || params.get('tenant') || params.get('subscriber');
    const pathPart = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
    
    // System routes to ignore
    const systemRoutes = ['login', 'register', 'forgot', 'payment', 'tg-share-phone', 'privacy', 'terms', 'api'];
    const candidateSlug = orgParam || (pathPart && !systemRoutes.includes(pathPart.toLowerCase()) ? pathPart : null);

    if (candidateSlug) {
      setTenantLoading(true);
      fetch(`${API}/tenants/lookup/${encodeURIComponent(candidateSlug)}`)
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'Subscriber organization not found');
          }
          setDedicatedTenant(data);
          // If accessing via dedicated URL, default to create account view for seamless onboarding
          if (window.location.pathname !== '/' && window.location.pathname !== '') {
            setView('register');
          }
        })
        .catch((err: any) => {
          console.warn('Tenant lookup note:', err.message);
          setTenantError(err.message);
        })
        .finally(() => {
          setTenantLoading(false);
        });
    }
  }, []);

  // Support Modal States
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportName, setSupportName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportSent, setSupportSent] = useState(false);

  useEffect(() => {
    fetch(`${API}/diag`)
      .then(res => res.json())
      .then(data => {
        if (data && data.configRecord) {
          setEmailVerificationRequired(data.configRecord.emailVerificationRequired !== false);
        } else {
          setEmailVerificationRequired(true);
        }
      })
      .catch(err => {
        console.error('Failed to load email verification config:', err);
        setEmailVerificationRequired(true);
      });
  }, []);
  
  // Login states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Login → unverified email states
  const [loginVerifyEmail, setLoginVerifyEmail] = useState('');
  const [loginOtpSent, setLoginOtpSent] = useState(false);
  const [loginOtpCode, setLoginOtpCode] = useState('');
  const [loginOtpTimer, setLoginOtpTimer] = useState(0);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');

  // Register states
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');

  // Password visibility states
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);

  // Loading states
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  // Register OTP states
  const [registerOtpSent, setRegisterOtpSent] = useState(false);
  const [registerOtpCode, setRegisterOtpCode] = useState('');
  const [registerOtpTimer, setRegisterOtpTimer] = useState(0);

  // Telegram/SMS verification states
  const [verifyMethod, setVerifyMethod] = useState<'email' | 'telegram' | 'sms'>('telegram');
  const [registeredUserId, setRegisteredUserId] = useState<number | null>(null);
  const [telegramLinked, setTelegramLinked] = useState<boolean | null>(null);
  const [tgOtpSent, setTgOtpSent] = useState(false);
  const [tgOtpCode, setTgOtpCode] = useState('');
  const [tgOtpTimer, setTgOtpTimer] = useState(0);
  const [tgSessionId, setTgSessionId] = useState('');
  const [tgCheckLoading, setTgCheckLoading] = useState(false);

  // Forgot / reset states
  const [forgotOtpSent, setForgotOtpSent] = useState(false);
  const [forgotOtpCode, setForgotOtpCode] = useState('');
  const [forgotOtpTimer, setForgotOtpTimer] = useState(0);
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');

  // Support Message Submission
  const handleSendSupportMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportName || !supportEmail || !supportMessage) {
      return showToast(isKhmer ? 'សូមបំពេញព័ត៌មានទាំងអស់' : 'Please fill in all fields', 'error');
    }
    setSupportLoading(true);
    try {
      const res = await fetch(`${API}/support/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: supportName, email: supportEmail, message: supportMessage }),
      });
      if (!res.ok) throw new Error('Failed to send support message');
      setSupportSent(true);
      showToast(isKhmer ? 'សាររបស់អ្នកត្រូវបានផ្ញើដោយជោគជ័យ!' : 'Message sent successfully! Our team will respond shortly.', 'success');
      setTimeout(() => {
        setSupportSent(false);
        setSupportName('');
        setSupportEmail('');
        setSupportMessage('');
        setShowSupportModal(false);
      }, 2000);
    } catch (err: any) {
      showToast(err?.message || 'Failed to send message', 'error');
    } finally {
      setSupportLoading(false);
    }
  };

  // 8 Main Features with rich popup details
  const features3D = [
    {
      id: 'debt_collection',
      icon: ShieldCheck,
      gradient: 'from-emerald-500 to-teal-500',
      glowColor: 'rgba(16, 185, 129, 0.35)',
      titleEn: 'Bad Debt Collection',
      titleKh: 'ការទារបំណុលយឺតយ៉ាវ',
      descEn: 'Automated recovery workflows, multi-stage reminders via SMS & Telegram, and delinquent tracking.',
      descKh: 'ប្រព័ន្ធស្វ័យប្រវត្តតាមដានការសងប្រាក់យឺតយ៉ាវ ផ្ញើសាររំលឹក និងគ្រប់គ្រងបំណុលទាន់ពេលវេលា។',
      tagsEn: ['Auto Sweep', 'Telegram Alerts', 'Escalation Logs'],
      tagsKh: ['រំលឹកស្វ័យប្រវត្ត', 'ផ្ញើសារ Telegram', 'តាមដានបំណុល'],
      borderGlow: 'hover:border-emerald-400 hover:shadow-emerald-500/25',
    },
    {
      id: 'broadcasting',
      icon: Send,
      gradient: 'from-indigo-500 to-violet-500',
      glowColor: 'rgba(99, 102, 241, 0.35)',
      titleEn: 'Broadcasting Setup',
      titleKh: 'ប្រព័ន្ធផ្ញើសារស្វ័យប្រវត្ត',
      descEn: 'Instant bulk messaging, transactional SMS, and Telegram notification pipeline with customizable templates.',
      descKh: 'ប្រព័ន្ធផ្ញើសារជូនដំណឹងជាក្រុម តាមទូរស័ព្ទ SMS និង Telegram ដោយស្វ័យប្រវត្ត។',
      tagsEn: ['Telegram Bot', 'Twilio SMS', 'Custom Templates'],
      tagsKh: ['Telegram Bot', 'សារ SMS', 'ទម្រង់សារតាមចិត្ត'],
      borderGlow: 'hover:border-indigo-400 hover:shadow-indigo-500/25',
    },
    {
      id: 'org_structure',
      icon: Network,
      gradient: 'from-teal-500 to-emerald-600',
      glowColor: 'rgba(20, 184, 166, 0.35)',
      titleEn: 'Loan Org Structure Setup',
      titleKh: 'រចនាសម្ព័ន្ធស្ថាប័នឥណទាន',
      descEn: 'Multi-tier role permissions, loan officer hierarchy, branch segregation, and action audit trails.',
      descKh: 'រៀបចំឋានានុក្រមបុគ្គលិកឥណទាន កំណត់សិទ្ធិមន្ត្រីសាខា និងតាមដានសកម្មភាព។',
      tagsEn: ['Role Hierarchy', 'Branch Access', 'Audit Logs'],
      tagsKh: ['ឋានានុក្រមសិទ្ធិ', 'បែងចែកសាខា', 'ប្រវត្តិសកម្មភាព'],
      borderGlow: 'hover:border-teal-400 hover:shadow-teal-500/25',
    },
    {
      id: 'loan_agreement',
      icon: FileText,
      gradient: 'from-blue-500 to-cyan-500',
      glowColor: 'rgba(59, 130, 246, 0.35)',
      titleEn: 'Loan Agreement Setup',
      titleKh: 'កិច្ចសន្យាឥណទានខ្មែរ',
      descEn: 'Official Cambodian legal contracts, print-ready PDF generation, and auto-populated amortization annexes.',
      descKh: 'បង្កើតកិច្ចសន្យាឥណទានភាសាខ្មែរត្រឹមត្រូវតាមច្បាប់ បោះពុម្ពភ្លាមៗ និងមានសុវត្ថិភាព។',
      tagsEn: ['Khmer Legal Format', 'Auto Print / PDF', 'Amortization Annex'],
      tagsKh: ['ទម្រង់ច្បាប់ខ្មែរ', 'បោះពុម្ព PDF ភ្លាមៗ', 'តារាងបង់ប្រាក់'],
      borderGlow: 'hover:border-blue-400 hover:shadow-blue-500/25',
    },
    {
      id: 'biz_consultant',
      icon: Briefcase,
      gradient: 'from-emerald-600 to-teal-600',
      glowColor: 'rgba(5, 150, 105, 0.35)',
      titleEn: 'Loan Biz Consultant',
      titleKh: 'ការប្រឹក្សាយោបល់អាជីវកម្ម',
      descEn: 'Financial portfolio advisory, risk mitigation strategy, and underwriting optimization consultation.',
      descKh: 'ផ្តល់ការប្រឹក្សាយោបល់យុទ្ធសាស្ត្រឥណទាន គ្រប់គ្រងហានិភ័យ និងពង្រីកទំហំផលប័ត្រ។',
      tagsEn: ['Portfolio Growth', 'Risk Modeling', 'Underwriting'],
      tagsKh: ['ពង្រីកផលប័ត្រ', 'គ្រប់គ្រងហានិភ័យ', 'យុទ្ធសាស្ត្រ'],
      borderGlow: 'hover:border-emerald-500 hover:shadow-emerald-600/25',
    },
    {
      id: 'loan_software',
      icon: MonitorSmartphone,
      gradient: 'from-violet-500 to-purple-500',
      glowColor: 'rgba(139, 92, 246, 0.35)',
      titleEn: 'Loan Software for Web & App',
      titleKh: 'កម្មវិធីគ្រប់គ្រង Web & App',
      descEn: 'Cloud-native loan management portal with real-time customer ledger, repayment schedules, and approvals.',
      descKh: 'កម្មវិធីគ្រប់គ្រងឥណទានលើ Cloud ពេញលេញ ប្រើប្រាស់បានលើ Web និងទូរស័ព្ទដៃ។',
      tagsEn: ['Cross-Platform', 'Live Ledger', 'Real-Time Sync'],
      tagsKh: ['Web & App', 'ទិន្នន័យផ្ទាល់', 'ស៊ីសង្វាក់រហ័ស'],
      borderGlow: 'hover:border-violet-400 hover:shadow-violet-500/25',
    },
    {
      id: 'digital_strategy',
      icon: Target,
      gradient: 'from-cyan-500 to-blue-500',
      glowColor: 'rgba(6, 182, 212, 0.35)',
      titleEn: 'Lead Digital Strategy Setup',
      titleKh: 'យុទ្ធសាស្ត្រទាក់ទាញអតិថិជន',
      descEn: 'Customer acquisition funnels, digital onboarding workflows, and automated credit scoring models.',
      descKh: 'យុទ្ធសាស្ត្រទាក់ទាញអតិថិជនខ្ចីប្រាក់តាមឌីជីថល និងវាយតម្លៃពិន្ទុឥណទានស្វ័យប្រវត្ត។',
      tagsEn: ['Lead Funnel', 'Digital Onboarding', 'Credit Scoring'],
      tagsKh: ['ទាក់ទាញអតិថិជន', 'ចុះឈ្មោះឌីជីថល', 'ពិន្ទុឥណទាន'],
      borderGlow: 'hover:border-cyan-400 hover:shadow-cyan-500/25',
    },
    {
      id: 'payment_gateway',
      icon: QrCode,
      gradient: 'from-sky-500 to-indigo-500',
      glowColor: 'rgba(14, 165, 233, 0.35)',
      titleEn: 'Payment Gateway',
      titleKh: 'ច្រកទូទាត់ប្រាក់ឌីជីថល',
      descEn: 'Bakong KHQR dynamic payment processing, instant repayment webhook reconciliation, and automated receipts.',
      descKh: 'ទទួលការទូទាត់ប្រាក់តាម KHQR បាគង (Bakong) ភ្លាមៗ និងផ្ទៀងផ្ទាត់ស្វ័យប្រវត្ត។',
      tagsEn: ['Bakong KHQR', 'Instant Webhook', 'Auto Receipt'],
      tagsKh: ['បាគង KHQR', 'ទូទាត់ភ្លាមៗ', 'វិក្កយបត្រស្វ័យប្រវត្ត'],
      borderGlow: 'hover:border-sky-400 hover:shadow-sky-500/25',
    },
  ];

  // Login handler — email + password
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return showToast('Enter phone/email and password', 'error');
    setLoginLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'EMAIL_NOT_VERIFIED') {
          setLoginVerifyEmail(loginEmail);
          setVerifyMethod('telegram');
          const rawPhone = loginEmail.replace('@nexus.local', '').replace(/\D/g, '');
          if (rawPhone) {
            checkTelegramLink(true, rawPhone);
          }
          await sendLoginVerifyOtp(loginEmail);
          showToast(isKhmer ? 'គណនីមិនទាន់បានផ្ទៀងផ្ទាត់ — សូមផ្ទៀងផ្ទាត់តាម Telegram ឬ SMS' : 'Account not verified — please verify via Telegram or SMS.', 'info');
          return;
        }
        throw new Error(data.error || 'Invalid phone/email or password.');
      }
      onLoginSuccess(data.token);
    } catch (err: any) {
      showToast(err?.message || 'Invalid phone/email or password.', 'error');
    } finally {
      setLoginLoading(false);
    }
  };

  // Send OTP for the login verification step
  const sendLoginVerifyOtp = async (emailOrPhone: string) => {
    try {
      const isPhoneOnly = emailOrPhone.includes('@nexus.local');
      const endpoint = isPhoneOnly ? `${API}/auth/send-otp-phone` : `${API}/auth/send-otp`;
      const body = isPhoneOnly
        ? { phone: emailOrPhone.replace('@nexus.local', '') }
        : { email: emailOrPhone };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send the verification code.');
      setLoginOtpSent(true);
      setLoginOtpTimer(300);
      const interval = setInterval(() => {
        setLoginOtpTimer(prev => { if (prev <= 1) clearInterval(interval); return prev - 1; });
      }, 1000);
    } catch (err: any) {
      showToast(err?.message || 'Failed to send the verification code.', 'error');
    }
  };

  const handleVerifyLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginOtpCode || loginOtpCode.length < 6) return showToast('Enter the 6-digit code', 'error');
    setLoginLoading(true);
    try {
      const isPhoneOnly = loginVerifyEmail.includes('@nexus.local');
      const endpoint = isPhoneOnly ? `${API}/auth/verify-otp-phone` : `${API}/auth/verify-otp`;
      const body = isPhoneOnly
        ? { phone: loginVerifyEmail.replace('@nexus.local', ''), code: loginOtpCode }
        : { email: loginVerifyEmail, code: loginOtpCode };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid or expired code.');
      setLoginVerifyEmail('');
      setLoginOtpSent(false);
      setLoginOtpCode('');
      showToast('Verified! Login to continue.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Invalid or expired code.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Helper to send SMS OTP code during registration
  const sendRegisterSmsOtp = async (phoneVal: string) => {
    try {
      const res = await fetch(`${API}/auth/send-otp-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneVal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send SMS OTP.');
      setRegisterOtpTimer(300);
      const interval = setInterval(() => {
        setRegisterOtpTimer(prev => { if (prev <= 1) clearInterval(interval); return prev - 1; });
      }, 1000);
      showToast('OTP code sent to your phone via SMS!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to send SMS OTP.', 'error');
    }
  };

  // Register handler — creates user then sends OTP
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerPassword !== registerConfirmPassword) return showToast('Passwords do not match', 'error');
    if (!emailVerificationRequired && !registerPhone) {
      return showToast('Phone number is required.', 'error');
    }
    setRegisterLoading(true);
    try {
      const targetEmail = emailVerificationRequired 
        ? registerEmail 
        : `${registerPhone.replace(/\D/g, '')}@nexus.local`;
      const targetPhone = registerPhone;
      
      const registerRes = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: registerName, 
          email: targetEmail, 
          password: registerPassword, 
          phone: targetPhone,
          tenant_id: dedicatedTenant ? dedicatedTenant.id : 1,
        }),
      });
      const registerData = await registerRes.json();
      if (!registerRes.ok) throw new Error(registerData.error || 'Registration failed.');

      if (emailVerificationRequired) {
        const otpRes = await fetch(`${API}/auth/send-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: targetEmail }),
        });
        const otpData = await otpRes.json();
        if (!otpRes.ok) throw new Error(otpData.error || 'Failed to send the verification code.');

        setRegisterOtpSent(true);
        setRegisterOtpTimer(300);
        const interval = setInterval(() => {
          setRegisterOtpTimer(prev => { if (prev <= 1) clearInterval(interval); return prev - 1; });
        }, 1000);
        showToast('OTP sent to your email!', 'success');
      } else {
        if (registerData.user && registerData.user.id) {
          setRegisteredUserId(registerData.user.id);
        }
        setRegisterOtpSent(true);
        setVerifyMethod('telegram');
        checkTelegramLink(true);
      }
    } catch (err: any) {
      showToast(err?.message || 'Registration failed.', 'error');
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleVerifyRegisterOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerOtpCode || registerOtpCode.length < 6) return showToast('Enter the 6-digit code', 'error');
    setRegisterLoading(true);
    try {
      const isSms = verifyMethod === 'sms';
      const endpoint = isSms ? `${API}/auth/verify-otp-phone` : `${API}/auth/verify-otp`;
      
      const targetUserEmail = emailVerificationRequired 
        ? registerEmail 
        : `${registerPhone.replace(/\D/g, '')}@nexus.local`;

      const body = isSms
        ? { phone: registerPhone, code: registerOtpCode }
        : { email: targetUserEmail, code: registerOtpCode };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Wrong code. Try again.');
      setView('login');
      showToast('Account created! Login with your phone/email and password.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Wrong code. Try again.', 'error');
      setRegisterOtpCode('');
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleResendRegisterOtp = async () => {
    setRegisterLoading(true);
    try {
      const isSms = verifyMethod === 'sms';
      const endpoint = isSms ? `${API}/auth/send-otp-phone` : `${API}/auth/send-otp`;
      
      const targetUserEmail = emailVerificationRequired 
        ? registerEmail 
        : `${registerPhone.replace(/\D/g, '')}@nexus.local`;

      const body = isSms
        ? { phone: registerPhone }
        : { email: targetUserEmail };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resend OTP.');
      setRegisterOtpTimer(300);
      showToast('New OTP sent!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to resend OTP.', 'error');
    } finally {
      setRegisterLoading(false);
    }
  };

  const getActivePhone = () => {
    if (registerPhone) return registerPhone;
    if (loginVerifyEmail) {
      if (loginVerifyEmail.includes('@nexus.local')) {
        return loginVerifyEmail.replace('@nexus.local', '');
      }
      if (!loginVerifyEmail.includes('@')) {
        return loginVerifyEmail;
      }
    }
    return '';
  };

  const handleTabChange = (method: 'email' | 'telegram' | 'sms') => {
    setVerifyMethod(method);
    const phoneToUse = getActivePhone();
    if (method === 'telegram') {
      checkTelegramLink(true, phoneToUse);
    } else if (method === 'sms') {
      if (phoneToUse) {
        sendRegisterSmsOtp(phoneToUse);
      }
    }
  };

  const checkTelegramLink = async (silent = false, customPhone?: string) => {
    const phoneToUse = customPhone || getActivePhone();
    if (!phoneToUse) return;
    if (!silent) setTgCheckLoading(true);
    try {
      const res = await fetch(`${API}/auth/check-link?phone=${encodeURIComponent(phoneToUse)}`);
      const data = await res.json();
      setTelegramLinked(!!data.linked);
      if (data.linked && !silent) {
        showToast('Telegram account linked successfully!', 'success');
      } else if (!data.linked && !silent) {
        showToast('Telegram account not linked yet. Please open the bot first.', 'warning');
      }
    } catch (e) {
      console.error('Failed to check Telegram link:', e);
    } finally {
      if (!silent) setTgCheckLoading(false);
    }
  };

  const handleSendTgOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const phoneToUse = getActivePhone();
    if (!phoneToUse) return showToast('Phone number is required for Telegram OTP', 'error');
    setRegisterLoading(true);
    try {
      const res = await fetch(`${API}/v1/auth/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneToUse, channel: 'telegram' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send Telegram OTP.');
      
      setTgSessionId(data.data.session_id);
      setTgOtpSent(true);
      setTgOtpTimer(300);
      const interval = setInterval(() => {
        setTgOtpTimer(prev => { if (prev <= 1) clearInterval(interval); return prev - 1; });
      }, 1000);
      showToast('OTP sent to your Telegram!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to send Telegram OTP.', 'error');
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleVerifyTgOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tgOtpCode || tgOtpCode.length < 6) return showToast('Enter the 6-digit code', 'error');
    const phoneToUse = getActivePhone();
    setRegisterLoading(true);
    try {
      const res = await fetch(`${API}/v1/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneToUse, session_id: tgSessionId, code: tgOtpCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid or expired OTP.');
      
      showToast('Account verified successfully!', 'success');
      if (data.data && data.data.auth_token) {
        onLoginSuccess(data.data.auth_token);
      } else {
        setLoginVerifyEmail('');
        setRegisterOtpSent(false);
        setView('login');
      }
    } catch (err: any) {
      showToast(err?.message || 'Invalid or expired OTP.', 'error');
      setTgOtpCode('');
    } finally {
      setRegisterLoading(false);
    }
  };

  // Forgot password OTP handlers
  const handleSendForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = forgotEmail;
    if (!input) return showToast('Enter your email or phone number', 'error');
    setForgotLoading(true);
    try {
      const isPhone = !input.includes('@');
      const endpoint = isPhone ? `${API}/auth/forgot-password-phone` : `${API}/auth/send-otp`;
      const body = isPhone ? { phone: input } : { email: input };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP.');
      setForgotOtpSent(true);
      setForgotOtpTimer(300);
      const interval = setInterval(() => {
        setForgotOtpTimer(prev => { if (prev <= 1) clearInterval(interval); return prev - 1; });
      }, 1000);
      showToast('Verification code sent!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to send OTP.', 'error');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotOtpCode || forgotOtpCode.length < 6) return showToast('Enter the 6-digit code', 'error');
    setForgotLoading(true);
    try {
      const input = forgotEmail;
      const isPhone = !input.includes('@');
      const endpoint = isPhone ? `${API}/auth/verify-otp-phone` : `${API}/auth/verify-otp`;
      const body = isPhone
        ? { phone: input, code: forgotOtpCode }
        : { email: input, code: forgotOtpCode };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid or expired code.');
      setShowResetForm(true);
    } catch (err: any) {
      showToast(err?.message || 'Invalid or expired code.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPassword || resetPassword.length < 6) return showToast('Password must be at least 6 characters', 'error');
    if (resetPassword !== resetConfirmPassword) return showToast('Passwords do not match', 'error');
    setForgotLoading(true);
    try {
      const input = forgotEmail;
      const isPhone = !input.includes('@');
      const body = isPhone
        ? { phone: input, newPassword: resetPassword }
        : { email: input, newPassword: resetPassword };
      const res = await fetch(`${API}/auth/update-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to reset password.'); }
      showToast('Password reset! Login with your new password.', 'success');
      setShowResetForm(false);
      setForgotOtpSent(false);
      setForgotOtpCode('');
      setResetPassword('');
      setResetConfirmPassword('');
      setView('login');
    } catch (err: any) {
      showToast(err?.message || 'Failed to reset password.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResendForgotOtp = async () => {
    setForgotLoading(true);
    try {
      const input = forgotEmail;
      const isPhone = !input.includes('@');
      const endpoint = isPhone ? `${API}/auth/forgot-password-phone` : `${API}/auth/send-otp`;
      const body = isPhone ? { phone: input } : { email: input };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resend OTP.');
      setForgotOtpTimer(300);
      showToast('New OTP sent!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to resend OTP.', 'error');
    } finally {
      setForgotLoading(false);
    }
  };

  if (emailVerificationRequired === null) {
    return (
      <div className="h-screen w-full relative bg-[#f8fcfa] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full relative bg-gradient-to-br from-[#f8fcfa] via-[#eef8f5] to-[#f0f6ff] text-slate-800 font-sans select-none overflow-hidden flex flex-col">
      {/* Precision Hover Pause & Rich Interactive Tooltip Popover */}
      <style>{`
        .circular-orbiting-card {
          animation: orbit-harmonic-2d 32s linear infinite;
          will-change: transform, opacity;
          pointer-events: auto !important;
          cursor: pointer;
        }

        /* Stop spinning ONLY when cursor hovers directly on an actual card */
        .orbit-cards-container:has(.circular-orbiting-card:hover) .circular-orbiting-card {
          animation-play-state: paused;
        }

        .circular-orbiting-card:hover {
          opacity: 1 !important;
          z-index: 9999 !important;
        }

        .circular-orbiting-card:hover .card-inner-box {
          transform: scale(1.12);
          opacity: 1 !important;
          background-color: #ffffff !important;
          box-shadow: 0 20px 35px -8px rgba(16, 185, 129, 0.35) !important;
          border-color: rgba(16, 185, 129, 0.7) !important;
        }

        /* 16 Pure Trigonometric Steps on Standard Plane */
        @keyframes orbit-harmonic-2d {
          0% {
            transform: translate(260px, 0px) scale(1.00);
            opacity: 0.95;
            z-index: 20;
          }
          6.25% {
            transform: translate(240px, 52px) scale(1.06);
            opacity: 0.98;
            z-index: 30;
          }
          12.50% {
            transform: translate(184px, 95px) scale(1.11);
            opacity: 1.00;
            z-index: 35;
          }
          18.75% {
            transform: translate(100px, 125px) scale(1.15);
            opacity: 1.00;
            z-index: 40;
          }
          25.00% {
            transform: translate(0px, 135px) scale(1.16);
            opacity: 1.00;
            z-index: 45;
          }
          31.25% {
            transform: translate(-100px, 125px) scale(1.15);
            opacity: 1.00;
            z-index: 40;
          }
          37.50% {
            transform: translate(-184px, 95px) scale(1.11);
            opacity: 1.00;
            z-index: 35;
          }
          43.75% {
            transform: translate(-240px, 52px) scale(1.06);
            opacity: 0.98;
            z-index: 30;
          }
          50.00% {
            transform: translate(-260px, 0px) scale(1.00);
            opacity: 0.95;
            z-index: 20;
          }
          56.25% {
            transform: translate(-240px, -52px) scale(0.94);
            opacity: 0.90;
            z-index: 10;
          }
          62.50% {
            transform: translate(-184px, -95px) scale(0.89);
            opacity: 0.86;
            z-index: 8;
          }
          68.75% {
            transform: translate(-100px, -125px) scale(0.85);
            opacity: 0.83;
            z-index: 6;
          }
          75.00% {
            transform: translate(0px, -135px) scale(0.84);
            opacity: 0.82;
            z-index: 5;
          }
          81.25% {
            transform: translate(100px, -125px) scale(0.85);
            opacity: 0.83;
            z-index: 6;
          }
          87.50% {
            transform: translate(184px, -95px) scale(0.89);
            opacity: 0.86;
            z-index: 8;
          }
          93.75% {
            transform: translate(240px, -52px) scale(0.94);
            opacity: 0.90;
            z-index: 10;
          }
          100.00% {
            transform: translate(260px, 0px) scale(1.00);
            opacity: 0.95;
            z-index: 20;
          }
        }

        /* 3D Planet Gyro Ring Rotations */
        @keyframes planet-ring-spin-1 {
          0% { transform: rotateX(68deg) rotateY(15deg) rotateZ(0deg); }
          100% { transform: rotateX(68deg) rotateY(15deg) rotateZ(360deg); }
        }

        @keyframes planet-ring-spin-2 {
          0% { transform: rotateX(-65deg) rotateY(-20deg) rotateZ(0deg); }
          100% { transform: rotateX(-65deg) rotateY(-20deg) rotateZ(-360deg); }
        }

        @keyframes planet-float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-5px) scale(1.02); }
        }

        @keyframes pulse-ring {
          0% { transform: scale(0.92); opacity: 0.8; }
          50% { transform: scale(1.08); opacity: 0.3; }
          100% { transform: scale(0.92); opacity: 0.8; }
        }

        @keyframes pulse-glow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.15); }
        }
        @keyframes aurora-spin {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.1); }
          100% { transform: rotate(360deg) scale(1); }
        }
        
        .anim-planet-core { animation: planet-float 6s ease-in-out infinite; }
        .anim-planet-ring-1 { animation: planet-ring-spin-1 18s linear infinite; }
        .anim-planet-ring-2 { animation: planet-ring-spin-2 24s linear infinite; }
        .anim-ring-pulse { animation: pulse-ring 6s ease-in-out infinite; }
        .anim-glow { animation: pulse-glow 8s ease-in-out infinite; }
        .anim-aurora { animation: aurora-spin 25s linear infinite; }
        
        .dot-matrix-light {
          background-image: radial-gradient(rgba(15, 23, 42, 0.05) 1.2px, transparent 1.2px);
          background-size: 26px 26px;
        }

        /* 3D Realistic Planet Radial Gradient */
        .planet-sphere-3d {
          background: radial-gradient(circle at 35% 28%, #6ee7b7 0%, #10b981 35%, #059669 68%, #064e3b 100%);
          box-shadow: 
            inset -8px -10px 20px rgba(2, 44, 34, 0.8),
            inset 5px 6px 12px rgba(255, 255, 255, 0.7),
            0 12px 28px -4px rgba(16, 185, 129, 0.45);
        }
      `}</style>

      {/* 1. Ambient Background Layer with Animated Glowing Pastel Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 bg-transparent">
        <div className="absolute inset-0 dot-matrix-light opacity-80 pointer-events-none" />
        <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-emerald-400/20 blur-[130px] anim-aurora pointer-events-none" />
        <div className="absolute bottom-[-15%] right-[-5%] w-[650px] h-[650px] rounded-full bg-cyan-400/20 blur-[140px] anim-aurora pointer-events-none" style={{ animationDuration: '30s', animationDirection: 'reverse' }} />
        <div className="absolute top-[35%] left-[30%] w-[450px] h-[450px] rounded-full bg-teal-300/20 blur-[120px] anim-glow pointer-events-none" />
        <div className="absolute top-[65%] left-[10%] w-[350px] h-[350px] rounded-full bg-indigo-300/15 blur-[100px] pointer-events-none" />
      </div>

      {/* 2. Scrollable Viewport Container */}
      <div className="absolute inset-0 overflow-y-auto w-full h-full flex flex-col z-10">
        
        {/* Global Navigation Header with Official Brand Logo or Dedicated Subscriber Logo */}
        <header className="relative z-20 px-4 py-3 sm:px-8 md:px-12 sm:py-4 flex justify-between items-center bg-white/60 backdrop-blur-md border-b border-slate-200/70 shadow-xs">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {dedicatedTenant?.logo_url ? (
              <img 
                src={dedicatedTenant.logo_url} 
                alt={dedicatedTenant.name} 
                className="w-8 h-8 sm:w-10 sm:h-10 object-contain rounded-xl sm:rounded-2xl shadow-md shadow-emerald-500/20 shrink-0 bg-white p-0.5 border border-slate-200"
              />
            ) : (
              <img 
                src="/logo-nexus-finance.png" 
                alt="Nexus Finance Logo" 
                className="w-8 h-8 sm:w-10 sm:h-10 object-contain rounded-xl sm:rounded-2xl shadow-md shadow-emerald-500/20 shrink-0"
              />
            )}
            <div className="flex flex-col min-w-0">
              <span className="font-sans text-[17px] sm:text-[20px] tracking-tight flex items-center leading-none">
                {dedicatedTenant ? (
                  <>
                    <span className="text-slate-900 font-extrabold truncate">{dedicatedTenant.name}</span>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 ml-2 shrink-0">
                      Partner Portal
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-slate-900 font-extrabold">Nexus</span>
                    <span className="text-emerald-600 font-semibold ml-0.5">Finance</span>
                  </>
                )}
              </span>
              <span className="hidden sm:block text-[10px] text-slate-500 font-bold tracking-wider uppercase mt-1 truncate">
                {dedicatedTenant ? `Powered by Nexus Finance • ${dedicatedTenant.slug}` : 'All-in-One FinTech Ecosystem'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-[12px] font-bold shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Systems Online</span>
            </div>

            {/* Sliding Language Switcher (EN <-> KH) */}
            <div className="relative flex items-center bg-slate-100/90 border border-slate-200/80 rounded-xl p-0.5 sm:p-1 shadow-xs select-none">
              <div 
                className="absolute top-0.5 bottom-0.5 sm:top-1 sm:bottom-1 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 shadow-sm shadow-emerald-500/25 transition-all duration-300 ease-out"
                style={{
                  width: 'calc(50% - 2px)',
                  left: language === 'en' ? '2px' : 'calc(50%)',
                }}
              />
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`relative z-10 px-2.5 py-1 sm:px-3.5 sm:py-1 rounded-lg text-[11px] sm:text-[11.5px] font-extrabold transition-colors duration-200 cursor-pointer ${
                  language === 'en'
                    ? 'text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('kh')}
                className={`relative z-10 px-2.5 py-1 sm:px-3.5 sm:py-1 rounded-lg text-[11px] sm:text-[11.5px] font-extrabold transition-colors duration-200 cursor-pointer ${
                  language === 'kh'
                    ? 'text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                KH
              </button>
            </div>

            {/* Interactive Support Modal Trigger Button */}
            <button 
              type="button"
              onClick={() => setShowSupportModal(true)}
              className="flex items-center gap-1.5 text-slate-700 hover:text-emerald-700 font-bold text-[12px] sm:text-[13px] transition px-2.5 py-1.5 sm:px-3.5 sm:py-1.5 rounded-xl hover:bg-slate-100/80 cursor-pointer border border-slate-200/80 hover:border-emerald-300 shadow-xs"
            >
              <HelpCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="hidden xs:inline sm:inline">{isKhmer ? 'ជំនួយ' : 'Support'}</span>
            </button>
          </div>
        </header>

        {/* 3. Main Split Hero & Auth Card Section */}
        <main className="relative z-10 flex-grow flex items-center justify-center px-4 sm:px-8 lg:px-12 py-3 max-w-7xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center w-full">

            {/* ========================================================================= */}
            {/* LEFT COLUMN: 3D Planet & Revolving Cards with Rich Detail Popups */}
            {/* ========================================================================= */}
            <div className="lg:col-span-7 hidden lg:flex flex-col items-center justify-center space-y-1.5 pr-2">
              
              {/* Badge & Headline */}
              <div className="space-y-1.5 text-center lg:text-left w-full">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-[12px] font-bold tracking-wide shadow-xs">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{isKhmer ? 'ប្រព័ន្ធអេកូឡូស៊ីហិរញ្ញវត្ថុពេញលេញ (All-in-One)' : 'ALL-IN-ONE FINTECH ECOSYSTEM'}</span>
                </div>

                <h1 className="text-[32px] xl:text-[36px] font-black text-slate-900 tracking-tight leading-[1.15]">
                  {isKhmer ? (
                    <>
                      ដំណោះស្រាយឥណទានសម័យថ្មី <br />
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600">
                        ស្វ័យប្រវត្ត លឿន និងមានសុវត្ថិភាពខ្ពស់
                      </span>
                    </>
                  ) : (
                    <>
                      Next-Gen Lending. <br />
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600">
                        Automated, Compliant & Instant.
                      </span>
                    </>
                  )}
                </h1>
              </div>

              {/* Stage Container */}
              <div className="relative w-full h-[460px] flex items-center justify-center select-none overflow-visible pointer-events-none">
                
                {/* Dynamic Cyber Concentric Orbital Halo Guides (Strictly pointer-events-none) */}
                <div className="absolute w-[530px] h-[290px] rounded-[100%] border border-emerald-400/20 pointer-events-none anim-ring-pulse" />
                <div className="absolute w-[490px] h-[270px] rounded-[100%] border-2 border-dashed border-emerald-500/30 pointer-events-none" />
                <div className="absolute w-[450px] h-[240px] rounded-[100%] bg-gradient-to-b from-emerald-400/15 via-teal-400/10 to-cyan-400/15 blur-2xl pointer-events-none" />

                {/* ========================================================= */}
                {/* 3D HOLOGRAPHIC FINTECH PLANET (Center Hub, z-index: 15) */}
                {/* ========================================================= */}
                <div className="absolute flex flex-col items-center justify-center pointer-events-none select-none anim-planet-core z-15">
                  
                  {/* Planet Sphere with Atmospheric Aura */}
                  <div className="relative w-24 h-24 flex items-center justify-center">
                    
                    {/* Atmospheric Corona Glow */}
                    <div className="absolute -inset-3 rounded-full bg-gradient-to-tr from-emerald-400 via-teal-300 to-cyan-400 opacity-50 blur-xl anim-glow pointer-events-none" />

                    {/* Gyroscopic Planetary Orbit Ring 1 (Tilted Saturn Style) */}
                    <div className="anim-planet-ring-1 absolute w-32 h-32 rounded-full border border-cyan-400/60 border-t-emerald-300 border-b-transparent shadow-xs pointer-events-none" />

                    {/* Gyroscopic Planetary Orbit Ring 2 (Counter-Rotating Angle) */}
                    <div className="anim-planet-ring-2 absolute w-35 h-35 rounded-full border border-teal-300/40 border-l-cyan-300 border-r-transparent pointer-events-none" />

                    {/* 3D Shaded Planet Orb */}
                    <div className="planet-sphere-3d relative w-20 h-20 rounded-full flex items-center justify-center overflow-hidden border border-emerald-300/40">
                      
                      {/* Top Light Dome Reflection */}
                      <div className="absolute top-1 left-2 w-8 h-5 bg-white/45 rounded-full blur-[2px] transform -rotate-12 pointer-events-none" />

                      {/* 3D Inner Glowing Core Letter 'N' */}
                      <div className="relative z-10 flex items-center justify-center w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs border border-white/40 shadow-inner">
                        <span className="text-white font-black text-xl tracking-tighter drop-shadow-md">N</span>
                      </div>

                    </div>

                  </div>

                  {/* Sleek Floating Glass Pod Badge */}
                  <div className="mt-2 px-2.5 py-0.5 bg-white/90 backdrop-blur-md rounded-full border border-emerald-300/80 shadow-md shadow-emerald-500/20 flex items-center gap-1.5 pointer-events-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10.5px] font-black text-slate-900 tracking-tight">Nexus Core</span>
                    <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200 ml-0.5">
                      Hub
                    </span>
                  </div>

                </div>

                {/* 8 Feature Cards Revolving with Interleaved Alternating Colors & Detail Popups */}
                <div className="orbit-cards-container relative w-full h-full flex items-center justify-center pointer-events-none">
                  {features3D.map((feat, idx) => {
                    const Icon = feat.icon;
                    // Stagger 8 cards evenly across the 32s circular orbit (4.0s each)
                    const delaySeconds = (idx * -4.0);
                    const tags = isKhmer ? feat.tagsKh : feat.tagsEn;

                    return (
                      <div
                        key={feat.id}
                        className="circular-orbiting-card group absolute"
                        style={{
                          animationDelay: `${delaySeconds}s`,
                        }}
                      >
                        {/* Compact Frosted Glass Revolving Card */}
                        <div className={`card-inner-box relative bg-white/95 hover:bg-white backdrop-blur-2xl border border-slate-200/90 ${feat.borderGlow} rounded-2xl p-2 sm:p-2.5 shadow-lg hover:shadow-2xl transition-all duration-150 cursor-pointer flex items-center gap-2 w-[165px] sm:w-[172px]`}>
                          
                          {/* 3D Glass Light Sheen */}
                          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/50 via-transparent to-emerald-50/20 pointer-events-none" />

                          {/* Gradient Icon Squircle Badge */}
                          <div 
                            className={`w-7.5 h-7.5 rounded-xl flex items-center justify-center shrink-0 shadow-md bg-gradient-to-tr ${feat.gradient} text-white group-hover:scale-110 transition-transform duration-200`}
                            style={{ boxShadow: `0 5px 12px -2px ${feat.glowColor}` }}
                          >
                            <Icon className="w-4 h-4 stroke-[2.2]" />
                          </div>

                          {/* Clean Main Title */}
                          <div className="flex flex-col min-w-0 pr-0.5 flex-grow">
                            <span className="text-[11px] sm:text-[11.5px] font-extrabold text-slate-900 group-hover:text-emerald-700 transition-colors leading-snug truncate">
                              {isKhmer ? feat.titleKh : feat.titleEn}
                            </span>
                          </div>

                        </div>

                        {/* ========================================================= */}
                        {/* SLEEK GLASSMORPHIC HOVER DETAIL POPOVER */}
                        {/* ========================================================= */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3.5 w-[265px] sm:w-[285px] p-3.5 rounded-2xl bg-slate-900/95 backdrop-blur-2xl border border-slate-700/80 shadow-2xl shadow-slate-950/60 opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 pointer-events-none transition-all duration-200 ease-out z-[10000] text-left">
                          
                          {/* Top Header Row with Icon & Title */}
                          <div className="flex items-center gap-2.5 mb-2 pb-2 border-b border-slate-800">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-tr ${feat.gradient} text-white shrink-0 shadow-xs`}>
                              <Icon className="w-4 h-4 stroke-[2.2]" />
                            </div>
                            <div className="min-w-0 flex-grow">
                              <h4 className="text-[12.5px] font-extrabold text-white leading-tight truncate">
                                {isKhmer ? feat.titleKh : feat.titleEn}
                              </h4>
                              <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider flex items-center gap-1 mt-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                                {isKhmer ? 'មុខងារស្នូល' : 'Core Module'}
                              </span>
                            </div>
                          </div>

                          {/* Detailed Description */}
                          <p className="text-[11.5px] text-slate-300 font-medium leading-relaxed mb-2.5">
                            {isKhmer ? feat.descKh : feat.descEn}
                          </p>

                          {/* Feature Highlight Pills */}
                          <div className="flex flex-wrap gap-1.5">
                            {tags.map((tag, tIdx) => (
                              <span 
                                key={tIdx} 
                                className="inline-flex items-center gap-1 text-[9.5px] font-bold text-slate-200 bg-slate-800/90 border border-slate-700/80 px-2 py-0.5 rounded-md"
                              >
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 stroke-[2.5]" />
                                <span>{tag}</span>
                              </span>
                            ))}
                          </div>

                          {/* Bottom Pointer Arrow Notch */}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-0 h-0 border-x-6 border-x-transparent border-t-6 border-t-slate-900/95" />

                        </div>

                      </div>
                    );
                  })}
                </div>

              </div>

            </div>

            {/* ========================================================================= */}
            {/* RIGHT COLUMN: Modern Crisp Light Glassmorphic Auth Form Card with Sliding Transitions */}
            {/* ========================================================================= */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end w-full">
              <div className="w-full max-w-md bg-white/95 backdrop-blur-2xl rounded-[32px] p-8 sm:p-9 border border-slate-200/90 shadow-2xl shadow-slate-300/50 relative z-10 transition-all overflow-hidden">
                
                {/* ------------------------------------------------------------- */}
                {/* VIEW A & B: DUAL-PANEL SLIDING SWITCHER (Sign In <-> Create Account) */}
                {/* ------------------------------------------------------------- */}
                {view !== 'forgot' && !loginVerifyEmail && !registerOtpSent ? (
                  <div>
                    {/* Sliding Tab Switcher Header */}
                    <div className="relative flex bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/70 mb-6 select-none">
                      
                      {/* Sliding Pill Indicator */}
                      <div 
                        className="absolute top-1.5 bottom-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 shadow-md shadow-emerald-500/25 transition-all duration-300 ease-in-out"
                        style={{
                          width: 'calc(50% - 6px)',
                          transform: view === 'login' ? 'translateX(0%)' : 'translateX(100%)',
                          left: '3px'
                        }}
                      />

                      <button
                        type="button"
                        onClick={() => setView('login')}
                        className={`relative z-10 flex-1 py-2.5 rounded-xl text-[13.5px] font-bold transition-colors duration-200 cursor-pointer text-center ${
                          view === 'login' ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {isKhmer ? 'ចូលប្រើប្រាស់' : 'Sign In'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setView('register')}
                        className={`relative z-10 flex-1 py-2.5 rounded-xl text-[13.5px] font-bold transition-colors duration-200 cursor-pointer text-center ${
                          view === 'register' ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {isKhmer ? 'បង្កើតគណនី' : 'Create Account'}
                      </button>
                    </div>

                    {/* Sliding Dual-Track Form Viewport */}
                    <div className="overflow-hidden w-full">
                      <div 
                        className="w-[200%] flex transition-transform duration-350 ease-out"
                        style={{
                          transform: view === 'login' ? 'translateX(0%)' : 'translateX(-50%)',
                        }}
                      >
                        
                        {/* PANEL 1: SIGN IN FORM */}
                        <div className="w-1/2 shrink-0 pr-3">
                          {dedicatedTenant && (
                            <div className="mb-4 p-3 rounded-2xl bg-emerald-50/90 border border-emerald-200/80 flex items-center gap-3">
                              {dedicatedTenant.logo_url ? (
                                <img 
                                  src={dedicatedTenant.logo_url} 
                                  alt={dedicatedTenant.name} 
                                  className="w-9 h-9 object-contain rounded-xl bg-white p-1 border border-emerald-100 shadow-xs shrink-0" 
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm shrink-0">
                                  {dedicatedTenant.name.charAt(0)}
                                </div>
                              )}
                              <div className="min-w-0 text-left">
                                <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">
                                  {isKhmer ? 'ច្រកចូលដៃគូ' : 'Partner Portal'}
                                </p>
                                <p className="text-[13px] font-bold text-slate-800 truncate">
                                  {dedicatedTenant.name}
                                </p>
                              </div>
                            </div>
                          )}

                          <div className="text-left mb-4">
                            <h2 className="text-[25px] font-black text-slate-900 tracking-tight">
                              {dedicatedTenant 
                                ? (isKhmer ? `ស្វាគមន៍មកកាន់ ${dedicatedTenant.name}` : `Welcome to ${dedicatedTenant.name}`)
                                : (isKhmer ? 'ស្វាគមន៍ការចូលប្រើ' : 'Welcome Back')}
                            </h2>
                            <p className="text-[13px] text-slate-500 font-medium mt-1">
                              {dedicatedTenant
                                ? (isKhmer ? `ចូលប្រើប្រាស់គណនីអតិថិជន ${dedicatedTenant.name}` : `Sign in to access your ${dedicatedTenant.name} account`)
                                : (isKhmer ? 'បញ្ចូលព័ត៌មានគណនីដើម្បីចូលទៅកាន់ផ្ទាំងគ្រប់គ្រង' : 'Access your loans, ledger, and repayments')}
                            </p>
                          </div>

                          <form onSubmit={handleLoginSubmit} className="space-y-4">
                            {/* Phone / Email Field */}
                            <div className="space-y-1.5">
                              <label className="block text-[11px] font-extrabold uppercase text-slate-600 tracking-wider">
                                {emailVerificationRequired 
                                  ? (isKhmer ? 'ឈ្មោះ, អ៊ីមែល ឬ លេខទូរស័ព្ទ' : 'Username, Email, or Phone') 
                                  : (isKhmer ? 'ឈ្មោះ ឬ លេខទូរស័ព្ទ' : 'Username or Phone Number')}
                              </label>
                              <div className="relative">
                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                                  <User className="w-4.5 h-4.5" />
                                </div>
                                <input
                                  type="text"
                                  value={loginEmail}
                                  onChange={(e) => setLoginEmail(e.target.value)}
                                  placeholder={emailVerificationRequired ? (isKhmer ? "ឈ្មោះ, អ៊ីមែល ឬ លេខទូរស័ព្ទ" : "Username, email, or phone") : (isKhmer ? "ឈ្មោះ ឬ លេខទូរស័ព្ទ" : "Username or phone number")}
                                  className="w-full rounded-2xl bg-slate-50/90 border border-slate-200 focus:bg-white pl-12 pr-4 py-3.5 text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 font-medium transition-all"
                                  required={view === 'login'}
                                />
                              </div>
                            </div>

                            {/* Password Field */}
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center">
                                <label className="block text-[11px] font-extrabold uppercase text-slate-600 tracking-wider">
                                  {isKhmer ? 'ពាក្យសម្ងាត់' : 'Password'}
                                </label>
                                <button 
                                  type="button" 
                                  onClick={() => { setForgotEmail(loginEmail); setView('forgot'); }} 
                                  className="text-[12px] text-emerald-600 hover:text-emerald-700 font-bold cursor-pointer transition hover:underline"
                                >
                                  {isKhmer ? 'ភ្លេចពាក្យសម្ងាត់?' : 'Forgot Password?'}
                                </button>
                              </div>
                              <div className="relative">
                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                                  <Lock className="w-4.5 h-4.5" />
                                </div>
                                <input
                                  type={showLoginPassword ? 'text' : 'password'}
                                  value={loginPassword}
                                  onChange={(e) => setLoginPassword(e.target.value)}
                                  placeholder="••••••••••••"
                                  className="w-full rounded-2xl bg-slate-50/90 border border-slate-200 focus:bg-white pl-12 pr-12 py-3.5 text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 font-medium transition-all"
                                  required={view === 'login'}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                                  className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer select-none"
                                >
                                  {showLoginPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                                </button>
                              </div>
                            </div>

                            {/* Magnetic FinTech Pulse Submit Button */}
                            <div className="pt-2">
                              <button
                                type="submit"
                                disabled={loginLoading}
                                className="group relative w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:via-teal-600 hover:to-emerald-700 text-white font-black text-[15px] tracking-wide py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-[0_10px_25px_-5px_rgba(16,185,129,0.38)] hover:shadow-[0_14px_28px_-5px_rgba(16,185,129,0.52)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.985] transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
                              >
                                {loginLoading ? (
                                  <span className="flex items-center gap-2"><RefreshCw className="w-4.5 h-4.5 animate-spin" /> LOGGING IN...</span>
                                ) : (
                                  <>
                                    <span>{isKhmer ? 'ចូលប្រើប្រាស់' : 'LOG IN'}</span>
                                    <ArrowRight className="w-5 h-5 stroke-[2.5] group-hover:translate-x-1.5 transition-transform duration-200 ease-out" />
                                  </>
                                )}
                              </button>
                            </div>
                          </form>

                          {/* Divider */}
                          <div className="flex items-center gap-3 my-4">
                            <div className="h-[1px] bg-slate-200 flex-grow" />
                            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">or</span>
                            <div className="h-[1px] bg-slate-200 flex-grow" />
                          </div>

                          {/* Google OAuth Button */}
                          <button
                            type="button"
                            onClick={() => window.location.href = API + '/auth/google'}
                            className="w-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 font-bold text-[13px] py-3 px-6 rounded-2xl flex items-center justify-center gap-2.5 transition active:scale-98 cursor-pointer shadow-xs"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.61c-.29 1.5-.14 3.01-.97 4.29l3.1 2.4c1.8-1.66 2.8-4.11 2.8-6.54z" />
                              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.1-2.4c-.9.6-2.01.99-3.23.99-3.11 0-5.74-2.11-6.68-4.96l-3.2 2.48C5.69 21.09 8.63 24 12 24z" />
                              <path fill="#FBBC05" d="M5.32 14.72a7.16 7.16 0 0 1 0-4.55l-3.2-2.48a11.94 11.94 0 0 0 0 10.43l3.2-2.4c-.38-.3-.38-.7-.38-1z" />
                              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 8.63 0 5.69 2.91 3.72 6.79l3.2 2.48C7.86 6.36 10.49 4.75 12 4.75z" />
                            </svg>
                            <span>{isKhmer ? 'ចូលតាមរយៈ Google' : 'Sign in with Google'}</span>
                          </button>
                        </div>

                        {/* PANEL 2: CREATE ACCOUNT FORM */}
                        <div className="w-1/2 shrink-0 pl-3">
                          {dedicatedTenant && (
                            <div className="mb-4 p-3 rounded-2xl bg-emerald-50/90 border border-emerald-200/80 flex items-center gap-3">
                              {dedicatedTenant.logo_url ? (
                                <img 
                                  src={dedicatedTenant.logo_url} 
                                  alt={dedicatedTenant.name} 
                                  className="w-9 h-9 object-contain rounded-xl bg-white p-1 border border-emerald-100 shadow-xs shrink-0" 
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm shrink-0">
                                  {dedicatedTenant.name.charAt(0)}
                                </div>
                              )}
                              <div className="min-w-0 text-left">
                                <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">
                                  {isKhmer ? 'ចុះឈ្មោះជាមួយដៃគូ' : 'Partner Registration'}
                                </p>
                                <p className="text-[13px] font-bold text-slate-800 truncate">
                                  {dedicatedTenant.name}
                                </p>
                              </div>
                            </div>
                          )}

                          <div className="text-left mb-4">
                            <h2 className="text-[25px] font-black text-slate-900 tracking-tight">
                              {dedicatedTenant 
                                ? (isKhmer ? `ចូលរួមជាមួយ ${dedicatedTenant.name}` : `Join ${dedicatedTenant.name}`)
                                : (isKhmer ? 'បង្កើតគណនីថ្មី' : 'Create Account')}
                            </h2>
                            <p className="text-[13px] text-slate-500 font-medium mt-1">
                              {dedicatedTenant 
                                ? (isKhmer ? `បង្កើតគណនីអតិថិជនផ្លូវការជាមួយ ${dedicatedTenant.name}` : `Register your official borrower account with ${dedicatedTenant.name}`)
                                : (isKhmer ? 'ចាប់ផ្តើមដំណើរការឥណទាន និងការគ្រប់គ្រងហិរញ្ញវត្ថុ' : 'Get started in less than 2 minutes')}
                            </p>
                          </div>

                          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                            {/* Full Name */}
                            <div className="space-y-1">
                              <label className="block text-[11px] font-extrabold uppercase text-slate-600 tracking-wider">
                                {isKhmer ? 'ឈ្មោះពេញ' : 'Full Name'}
                              </label>
                              <div className="relative">
                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                                  <User className="w-4 h-4" />
                                </div>
                                <input
                                  type="text"
                                  value={registerName}
                                  onChange={(e) => setRegisterName(e.target.value)}
                                  placeholder={isKhmer ? "ឈ្មោះពេញ" : "Full Name"}
                                  className="w-full bg-slate-50/90 border border-slate-200 focus:bg-white rounded-2xl pl-11 pr-4 py-3 text-[13.5px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 font-medium transition-all"
                                  required={view === 'register'}
                                />
                              </div>
                            </div>

                            {/* Email Address (if enabled) */}
                            {emailVerificationRequired && (
                              <div className="space-y-1">
                                <label className="block text-[11px] font-extrabold uppercase text-slate-600 tracking-wider">
                                  {isKhmer ? 'អាសយដ្ឋានអ៊ីមែល' : 'Email Address'}
                                </label>
                                <div className="relative">
                                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                                    <span className="text-[15px] font-light select-none">@</span>
                                  </div>
                                  <input
                                    type="email"
                                    value={registerEmail}
                                    onChange={(e) => setRegisterEmail(e.target.value)}
                                    placeholder="name@domain.com"
                                    className="w-full bg-slate-50/90 border border-slate-200 focus:bg-white rounded-2xl pl-11 pr-4 py-3 text-[13.5px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 font-medium transition-all"
                                    required={view === 'register'}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Phone Number */}
                            <div className="space-y-1">
                              <label className="block text-[11px] font-extrabold uppercase text-slate-600 tracking-wider">
                                {isKhmer ? 'លេខទូរស័ព្ទ' : 'Phone Number'}
                              </label>
                              <div className="relative">
                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                                  <Phone className="w-4 h-4" />
                                </div>
                                <input
                                  type="tel"
                                  value={registerPhone}
                                  onChange={(e) => setRegisterPhone(e.target.value)}
                                  placeholder={isKhmer ? "លេខទូរស័ព្ទ" : "Phone number"}
                                  className="w-full bg-slate-50/90 border border-slate-200 focus:bg-white rounded-2xl pl-11 pr-4 py-3 text-[13.5px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 font-medium transition-all"
                                  required={view === 'register'}
                                />
                              </div>
                            </div>

                            {/* Password & Confirm */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="block text-[11px] font-extrabold uppercase text-slate-600 tracking-wider">
                                  {isKhmer ? 'ពាក្យសម្ងាត់' : 'Password'}
                                </label>
                                <div className="relative">
                                  <input
                                    type={showRegisterPassword ? 'text' : 'password'}
                                    value={registerPassword}
                                    onChange={(e) => setRegisterPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-slate-50/90 border border-slate-200 focus:bg-white rounded-2xl pl-3.5 pr-9 py-3 text-[13.5px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 font-mono transition-all"
                                    required={view === 'register'}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                                    className="absolute inset-y-0 right-2.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer select-none"
                                  >
                                    {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="block text-[11px] font-extrabold uppercase text-slate-600 tracking-wider">
                                  {isKhmer ? 'ផ្ទៀងផ្ទាត់' : 'Confirm'}
                                </label>
                                <div className="relative">
                                  <input
                                    type={showRegisterConfirmPassword ? 'text' : 'password'}
                                    value={registerConfirmPassword}
                                    onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-slate-50/90 border border-slate-200 focus:bg-white rounded-2xl pl-3.5 pr-9 py-3 text-[13.5px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 font-mono transition-all"
                                    required={view === 'register'}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowRegisterConfirmPassword(!showRegisterConfirmPassword)}
                                    className="absolute inset-y-0 right-2.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer select-none"
                                  >
                                    {showRegisterConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Magnetic FinTech Pulse Submit Button */}
                            <div className="pt-2">
                              <button
                                type="submit"
                                disabled={registerLoading}
                                className="group relative w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:via-teal-600 hover:to-emerald-700 text-white font-black text-[15px] tracking-wide py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-[0_10px_25px_-5px_rgba(16,185,129,0.38)] hover:shadow-[0_14px_28px_-5px_rgba(16,185,129,0.52)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.985] transition-all duration-200 cursor-pointer disabled:opacity-50 select-none"
                              >
                                {registerLoading ? (
                                  <span className="flex items-center gap-2"><RefreshCw className="w-4.5 h-4.5 animate-spin" /> CREATING ACCOUNT...</span>
                                ) : (
                                  <>
                                    <span>{isKhmer ? 'បង្កើតគណនី' : 'CREATE ACCOUNT'}</span>
                                    <ArrowRight className="w-5 h-5 stroke-[2.5] group-hover:translate-x-1.5 transition-transform duration-200 ease-out" />
                                  </>
                                )}
                              </button>
                            </div>
                          </form>
                        </div>

                      </div>
                    </div>
                  </div>
                ) : null}

                {/* ------------------------------------------------------------- */}
                {/* UNIFIED VERIFICATION OTP STEP (Registration + Unverified Login) */}
                {/* ------------------------------------------------------------- */}
                {(registerOtpSent || loginVerifyEmail) && (
                  <div className="space-y-5 animate-in fade-in duration-300">
                    <div className="text-left mb-5">
                      <h2 className="text-[25px] font-black text-slate-900 tracking-tight">
                        {isKhmer ? 'ផ្ទៀងផ្ទាត់គណនី' : 'Verify Your Account'}
                      </h2>
                      <p className="text-[13px] text-slate-500 font-medium mt-1">
                        {isKhmer ? 'សូមជ្រើសរើស Telegram ឬ SMS ដើម្បីផ្ទៀងផ្ទាត់គណនី' : 'Choose Telegram or SMS to verify your account'}
                      </p>
                    </div>

                    {/* Method Selector Tabs */}
                    <div className="flex bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 gap-1 select-none">
                      {/* 1. Telegram Tab (Shown First) */}
                      <button
                        type="button"
                        onClick={() => handleTabChange('telegram')}
                        className={`flex-1 py-2 px-3 text-[12.5px] font-extrabold rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                          verifyMethod === 'telegram' 
                            ? 'bg-white text-[#1c8ad4] shadow-sm border border-slate-200/90' 
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <svg className="w-4 h-4 text-[#229ED9] shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.52 2.77-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                        </svg>
                        <span>Telegram</span>
                      </button>

                      {/* 2. SMS or Email Tab (Shown Second) */}
                      {emailVerificationRequired ? (
                        <button
                          type="button"
                          onClick={() => handleTabChange('email')}
                          className={`flex-1 py-2 px-3 text-[12.5px] font-extrabold rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                            verifyMethod === 'email' 
                              ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/90' 
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Mail className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Email OTP</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleTabChange('sms')}
                          className={`flex-1 py-2 px-3 text-[12.5px] font-extrabold rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                            verifyMethod === 'sms' 
                              ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/90' 
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>SMS OTP</span>
                        </button>
                      )}
                    </div>

                    {/* Content for SMS or Email */}
                    {verifyMethod === 'email' || verifyMethod === 'sms' ? (
                      <form onSubmit={loginVerifyEmail ? handleVerifyLoginOtp : handleVerifyRegisterOtp} className="space-y-4">
                        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-center">
                          <p className="text-[12px] text-slate-600 font-medium">
                            Code sent to <strong className="text-emerald-700">{verifyMethod === 'sms' ? getActivePhone() : (loginVerifyEmail || registerEmail)}</strong>
                          </p>
                        </div>
                        <input
                          type="text"
                          maxLength={6}
                          value={loginVerifyEmail ? loginOtpCode : registerOtpCode}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                            if (loginVerifyEmail) setLoginOtpCode(val);
                            else setRegisterOtpCode(val);
                          }}
                          placeholder="000000"
                          className="w-full text-center text-[26px] tracking-[8px] font-mono rounded-2xl bg-slate-50 border border-slate-200 px-6 py-3.5 text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-inner font-bold"
                          required
                        />
                        <button
                          type="submit"
                          disabled={(loginVerifyEmail ? loginLoading : registerLoading) || (loginVerifyEmail ? loginOtpCode.length < 6 : registerOtpCode.length < 6)}
                          className="group relative w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:via-teal-600 hover:to-emerald-700 text-white font-black text-[14.5px] py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-[0_10px_25px_-5px_rgba(16,185,129,0.38)] hover:shadow-[0_14px_28px_-5px_rgba(16,185,129,0.52)] active:scale-98 transition-all cursor-pointer disabled:opacity-50 select-none"
                        >
                          {(loginVerifyEmail ? loginLoading : registerLoading) ? (
                            <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> VERIFYING...</span>
                          ) : (
                            <>{isKhmer ? 'ផ្ទៀងផ្ទាត់កូដ' : 'VERIFY CODE'} <ArrowRight className="w-5 h-5 stroke-[2.5] group-hover:translate-x-1 transition-transform" /></>
                          )}
                        </button>
                        <div className="flex justify-between items-center text-[12px]">
                          <button 
                            type="button" 
                            onClick={loginVerifyEmail ? () => sendLoginVerifyOtp(loginVerifyEmail) : handleResendRegisterOtp} 
                            disabled={(loginVerifyEmail ? loginOtpTimer : registerOtpTimer) > 0}
                            className="text-slate-500 hover:text-emerald-700 cursor-pointer disabled:opacity-40 font-semibold"
                          >
                            Resend code {(loginVerifyEmail ? loginOtpTimer : registerOtpTimer) > 0 && `(${Math.floor((loginVerifyEmail ? loginOtpTimer : registerOtpTimer) / 60)}:${String((loginVerifyEmail ? loginOtpTimer : registerOtpTimer) % 60).padStart(2, '0')})`}
                          </button>
                          <button 
                            type="button" 
                            onClick={() => { setRegisterOtpSent(false); setLoginVerifyEmail(''); setRegisterOtpCode(''); setLoginOtpCode(''); }}
                            className="text-slate-500 hover:text-slate-900 cursor-pointer font-medium"
                          >
                            Back to login
                          </button>
                        </div>
                      </form>
                    ) : (
                      /* Content for Telegram */
                      <div className="space-y-4">
                        {!emailVerificationRequired ? (
                          <div className="relative overflow-hidden bg-gradient-to-br from-sky-50/80 via-white to-blue-50/50 rounded-3xl p-5 border border-sky-100/90 shadow-sm text-center space-y-3.5">
                            {/* Ambient Glow */}
                            <div className="absolute -top-10 -right-10 w-36 h-36 bg-sky-400/15 rounded-full blur-2xl pointer-events-none" />
                            
                            {/* Hero Icon */}
                            <div className="relative z-10 flex flex-col items-center">
                              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#1c8ad4] to-[#36b8ff] text-white flex items-center justify-center shadow-lg shadow-sky-500/30 mb-2">
                                <svg className="w-6.5 h-6.5" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.52 2.77-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                                </svg>
                              </div>
                              <h4 className="text-[14.5px] font-extrabold text-slate-900 tracking-tight">
                                {isKhmer ? 'ភ្ជាប់ Telegram ដើម្បីដំណើរការគណនី' : 'Link Telegram to Activate Profile'}
                              </h4>
                              <p className="text-[12px] text-slate-500 font-medium max-w-xs mt-0.5 leading-relaxed">
                                {isKhmer 
                                  ? 'ចុចប៊ូតុងខាងក្រោមដើម្បីបើក Telegram Bot និងចែករំលែកលេខទូរស័ព្ទដើម្បីដំណើរការភ្លាមៗ' 
                                  : 'Tap below to open our Telegram Bot and share your contact for 1-click instant activation.'}
                              </p>
                            </div>

                            {/* Status Indicator */}
                            <div className="relative z-10 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100/70 border border-sky-200/80 text-sky-800 text-[11px] font-bold">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                              </span>
                              <span>{isKhmer ? 'កំពុងរង់ចាំការភ្ជាប់ Telegram...' : 'Listening for Telegram Link...'}</span>
                            </div>

                            {/* Action Button */}
                            <a
                              href={registeredUserId ? `https://t.me/nexusfinancefintech_bot?start=${registeredUserId}` : `https://t.me/nexusfinancefintech_bot`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => {
                                const pollInterval = setInterval(async () => {
                                  try {
                                    const activePhone = getActivePhone();
                                    const q = registeredUserId ? `userId=${registeredUserId}` : `phone=${encodeURIComponent(activePhone)}`;
                                    const res = await fetch(`${API}/auth/check-link?${q}`);
                                    const data = await res.json();
                                    if (data.linked) {
                                      clearInterval(pollInterval);
                                      showToast(isKhmer ? 'គណនីត្រូវបានភ្ជាប់ Telegram ដោយជោគជ័យ!' : 'Telegram account linked and verified successfully!', 'success');
                                      if (data.token) onLoginSuccess(data.token);
                                      else { setView('login'); setRegisterOtpSent(false); setLoginVerifyEmail(''); }
                                    }
                                  } catch (e) { console.error(e); }
                                }, 2000);
                                setTimeout(() => clearInterval(pollInterval), 300000);
                              }}
                              className="group relative z-10 w-full bg-gradient-to-r from-[#1c8ad4] via-[#229ED9] to-[#0088cc] hover:from-[#197bc0] hover:to-[#0077b5] text-white font-extrabold text-[14px] tracking-wide py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-[0_10px_25px_-5px_rgba(28,138,212,0.4)] hover:shadow-[0_14px_28px_-5px_rgba(28,138,212,0.55)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.985] transition-all cursor-pointer select-none text-center"
                            >
                              <svg className="w-5 h-5 fill-current shrink-0 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.52 2.77-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                              </svg>
                              <span>{isKhmer ? 'បើក Telegram Bot ឥឡូវនេះ' : 'Open Telegram Bot'}</span>
                              <ArrowRight className="w-4.5 h-4.5 group-hover:translate-x-1 transition-transform" />
                            </a>
                          </div>
                        ) : !tgOtpSent ? (
                          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                            <h4 className="text-[13px] font-bold text-slate-900 flex items-center gap-2">
                              <span>🔗 Link Telegram & Receive OTP</span>
                            </h4>
                            <p className="text-[11.5px] text-slate-600 leading-relaxed font-medium">
                              Link your Telegram account to phone <strong className="text-emerald-700">{getActivePhone()}</strong> to get your verification code instantly:
                            </p>
                            <a
                              href="https://t.me/nexusfinancefintech_bot"
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => {
                                setTgOtpSent(true);
                                setTgOtpTimer(300);
                                const interval = setInterval(() => {
                                  setTgOtpTimer(prev => { if (prev <= 1) clearInterval(interval); return prev - 1; });
                                }, 1000);
                                const pollInterval = setInterval(async () => {
                                  try {
                                    const res = await fetch(`${API}/auth/check-link?phone=${encodeURIComponent(getActivePhone())}`);
                                    const data = await res.json();
                                    if (data.linked) {
                                      setTelegramLinked(true);
                                      clearInterval(pollInterval);
                                    }
                                  } catch (e) { console.error(e); }
                                }, 2000);
                                setTimeout(() => clearInterval(pollInterval), 300000);
                              }}
                              className="w-full bg-[#1c8ad4] hover:bg-[#197bc0] text-white font-bold text-[13.5px] py-3 rounded-2xl flex items-center justify-center gap-2 transition shadow-md cursor-pointer text-center"
                            >
                              💬 Link & Get Code on Telegram
                            </a>
                          </div>
                        ) : (
                          <form onSubmit={handleVerifyTgOtp} className="space-y-3.5">
                            {telegramLinked ? (
                              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl p-2.5 text-[12px] font-bold flex items-center justify-center gap-2">
                                <span>✅ Telegram linked successfully!</span>
                              </div>
                            ) : (
                              <div className="bg-slate-50 border border-slate-200 text-slate-600 rounded-2xl p-2.5 text-[12px] font-semibold flex items-center justify-center gap-2">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-600" />
                                <span>Waiting for Telegram link & code...</span>
                              </div>
                            )}
                            <input
                              type="text"
                              maxLength={6}
                              value={tgOtpCode}
                              onChange={(e) => setTgOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              placeholder="000000"
                              className="w-full text-center text-[26px] tracking-[8px] font-mono rounded-2xl bg-slate-50 border border-slate-200 px-6 py-3.5 text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-inner font-bold"
                              required
                            />
                            <button
                              type="submit"
                              disabled={registerLoading || tgOtpCode.length < 6}
                              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-[14.5px] py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-98 transition cursor-pointer disabled:opacity-50"
                            >
                              {registerLoading ? (
                                <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> VERIFYING...</span>
                              ) : (
                                <>{isKhmer ? 'ផ្ទៀងផ្ទាត់កូដ' : 'VERIFY CODE'} <ArrowRight className="w-5 h-5 stroke-[2.5]" /></>
                              )}
                            </button>
                            <div className="flex justify-between items-center text-[12px]">
                              <button type="button" onClick={() => handleSendTgOtp()} disabled={tgOtpTimer > 0}
                                className="text-slate-500 hover:text-emerald-700 cursor-pointer disabled:opacity-40 font-semibold"
                              >
                                Resend code {tgOtpTimer > 0 && `(${Math.floor(tgOtpTimer / 60)}:${String(tgOtpTimer % 60).padStart(2, '0')})`}
                              </button>
                              <button type="button" onClick={() => { setRegisterOtpSent(false); setLoginVerifyEmail(''); setTgOtpSent(false); }}
                                className="text-slate-500 hover:text-slate-900 cursor-pointer font-medium"
                              >
                                Back to login
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    )}

                  </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* VIEW C: FORGOT PASSWORD FORM */}
                {/* ------------------------------------------------------------- */}
                {view === 'forgot' && (
                  <div className="space-y-5 animate-in fade-in duration-300">
                    
                    <div className="text-left mb-5">
                      <h2 className="text-[25px] font-black text-slate-900 tracking-tight">
                        {showResetForm 
                          ? (isKhmer ? 'កំណត់ពាក្យសម្ងាត់ថ្មី' : 'Set New Password') 
                          : (isKhmer ? 'សង្គ្រោះពាក្យសម្ងាត់' : 'Reset Password')}
                      </h2>
                      <p className="text-[13px] text-slate-500 font-medium mt-1">
                        {isKhmer ? 'យើងនឹងផ្ញើលេខកូដសម្ងាត់ដើម្បីផ្ទៀងផ្ទាត់គណនីរបស់អ្នក' : 'Recover your account access safely'}
                      </p>
                    </div>

                    {!forgotOtpSent && !showResetForm ? (
                      /* Step 1: Input email or phone */
                      <form onSubmit={handleSendForgotOtp} className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-extrabold uppercase text-slate-600 tracking-wider">
                            {emailVerificationRequired 
                              ? (isKhmer ? 'អ៊ីមែល ឬ លេខទូរស័ព្ទ' : 'Email or Phone Number') 
                              : (isKhmer ? 'លេខទូរស័ព្ទ' : 'Phone Number')}
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                              <Phone className="w-4.5 h-4.5" />
                            </div>
                            <input
                              type={emailVerificationRequired ? 'text' : 'tel'}
                              placeholder={emailVerificationRequired ? (isKhmer ? "លេខទូរស័ព្ទ ឬ អ៊ីមែល" : "Phone number or email") : (isKhmer ? "លេខទូរស័ព្ទ" : "Phone number")}
                              value={forgotEmail}
                              onChange={(e) => setForgotEmail(e.target.value)}
                              className="w-full pl-12 pr-4 py-3.5 bg-slate-50/90 border border-slate-200 focus:bg-white rounded-2xl text-[14px] font-medium text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                              required
                            />
                          </div>
                        </div>
                        <button
                          type="submit"
                          disabled={forgotLoading}
                          className="group relative w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:via-teal-600 hover:to-emerald-700 text-white font-black text-[15px] py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-[0_10px_25px_-5px_rgba(16,185,129,0.38)] hover:shadow-[0_14px_28px_-5px_rgba(16,185,129,0.52)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.985] transition-all duration-200 cursor-pointer disabled:opacity-50 select-none"
                        >
                          {forgotLoading ? (
                            <span className="flex items-center gap-2"><RefreshCw className="w-4.5 h-4.5 animate-spin" /> SENDING OTP...</span>
                          ) : (
                            <>{isKhmer ? 'ផ្ញើលេខកូដ OTP' : 'SEND OTP CODE'} <ArrowRight className="w-5 h-5 stroke-[2.5] group-hover:translate-x-1.5 transition-transform duration-200 ease-out" /></>
                          )}
                        </button>
                      </form>
                    ) : forgotOtpSent && !showResetForm ? (
                      /* Step 2: Input OTP */
                      <form onSubmit={handleVerifyForgotOtp} className="space-y-4">
                        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-center">
                          <p className="text-[12px] text-slate-600 font-medium">
                            Enter the code sent to <strong className="text-emerald-700">{forgotEmail}</strong>
                          </p>
                        </div>
                        <input
                          type="text"
                          maxLength={6}
                          value={forgotOtpCode}
                          onChange={(e) => setForgotOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="000000"
                          className="w-full text-center text-[26px] tracking-[8px] font-mono rounded-2xl bg-slate-50 border border-slate-200 px-6 py-3.5 text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-inner font-bold"
                          required
                        />
                        <button
                          type="submit"
                          disabled={forgotLoading || forgotOtpCode.length < 6}
                          className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-[14.5px] py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-98 transition cursor-pointer disabled:opacity-50"
                        >
                          {forgotLoading ? (
                            <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> VERIFYING...</span>
                          ) : (
                            <>{isKhmer ? 'ផ្ទៀងផ្ទាត់' : 'VERIFY CODE'} <ArrowRight className="w-5 h-5 stroke-[2.5]" /></>
                          )}
                        </button>
                        <div className="flex justify-between items-center text-[12px]">
                          <button type="button" onClick={handleResendForgotOtp} disabled={forgotOtpTimer > 0}
                            className="text-slate-500 hover:text-emerald-700 cursor-pointer disabled:opacity-40 font-semibold"
                          >
                            Resend code {forgotOtpTimer > 0 && `(${Math.floor(forgotOtpTimer / 60)}:${String(forgotOtpTimer % 60).padStart(2, '0')})`}
                          </button>
                          <button type="button" onClick={() => { setForgotOtpSent(false); setForgotOtpCode(''); }}
                            className="text-slate-500 hover:text-slate-900 cursor-pointer font-medium"
                          >
                            Change input
                          </button>
                        </div>
                      </form>
                    ) : (
                      /* Step 3: New Password Input */
                      <form onSubmit={handleResetPassword} className="space-y-3.5">
                        <div className="space-y-1">
                          <label className="block text-[11px] font-extrabold uppercase text-slate-600 tracking-wider">
                            {isKhmer ? 'ពាក្យសម្ងាត់ថ្មី' : 'New Password'}
                          </label>
                          <input 
                            type="password" 
                            value={resetPassword} 
                            onChange={(e) => setResetPassword(e.target.value)} 
                            placeholder="Min 6 characters" 
                            className="w-full px-4 py-3 bg-slate-50/90 border border-slate-200 focus:bg-white rounded-2xl text-[13.5px] font-medium text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all" 
                            required 
                            minLength={6} 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[11px] font-extrabold uppercase text-slate-600 tracking-wider">
                            {isKhmer ? 'ផ្ទៀងផ្ទាត់ពាក្យសម្ងាត់ថ្មី' : 'Confirm New Password'}
                          </label>
                          <input 
                            type="password" 
                            value={resetConfirmPassword} 
                            onChange={(e) => setResetConfirmPassword(e.target.value)} 
                            placeholder="Re-enter new password" 
                            className="w-full px-4 py-3 bg-slate-50/90 border border-slate-200 focus:bg-white rounded-2xl text-[13.5px] font-medium text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all" 
                            required 
                            minLength={6} 
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={forgotLoading}
                          className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-[14.5px] py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-98 transition cursor-pointer disabled:opacity-50"
                        >
                          {forgotLoading ? (
                            <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> SAVING...</span>
                          ) : (
                            <>{isKhmer ? 'រក្សាទុកពាក្យសម្ងាត់' : 'SAVE NEW PASSWORD'} <ArrowRight className="w-5 h-5 stroke-[2.5]" /></>
                          )}
                        </button>
                      </form>
                    )}

                    {/* Back to login trigger */}
                    <div className="text-center pt-1.5">
                      <button
                        type="button"
                        onClick={() => { setView('login'); setForgotOtpSent(false); setShowResetForm(false); }}
                        className="text-[12.5px] font-bold text-slate-500 hover:text-slate-900 cursor-pointer transition inline-flex items-center gap-1.5"
                      >
                        ← {isKhmer ? 'ត្រឡប់ទៅការចូលប្រើ' : 'Back to Login'}
                      </button>
                    </div>

                  </div>
                )}

              </div>
            </div>

          </div>
        </main>

        {/* Global Footer */}
        <footer className="relative z-20 px-6 py-4 sm:px-12 border-t border-slate-200/60 bg-white/40 backdrop-blur-xs flex flex-col md:flex-row justify-between items-center gap-3 text-[12px] font-medium text-slate-500">
          <div>
            <p>© 2026 Nexus Finance Inc. All rights reserved.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <a href="/privacy" className="hover:text-slate-800 transition">Privacy Policy</a>
            <a href="/terms" className="hover:text-slate-800 transition">Terms of Service</a>
            <a href="/privacy" className="hover:text-slate-800 transition">Regulatory Disclosure</a>
            <a href="/privacy" className="hover:text-slate-800 transition">Bank-Grade Security</a>
          </div>
        </footer>

      </div>

      {/* ========================================================================= */}
      {/* 4. PREMIUM FLOATING SUPPORT & CUSTOMER CARE MODAL */}
      {/* ========================================================================= */}
      {showSupportModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          
          {/* Backdrop Blur */}
          <div 
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-md transition-opacity"
            onClick={() => setShowSupportModal(false)}
          />

          {/* Dialog Container */}
          <div className="relative w-full max-w-4xl bg-white/95 backdrop-blur-3xl rounded-[32px] border border-slate-200/90 shadow-2xl shadow-slate-950/40 overflow-hidden z-10 flex flex-col max-h-[90vh]">
            
            {/* Top Modal Header */}
            <div className="relative px-6 py-5 sm:px-8 sm:py-6 border-b border-slate-200/80 bg-gradient-to-r from-emerald-50/50 via-teal-50/30 to-transparent flex justify-between items-start">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100/70 border border-emerald-200 text-emerald-800 text-[11.5px] font-extrabold tracking-wide uppercase">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{isKhmer ? 'សេវាអតិថិជន & មជ្ឈមណ្ឌលជំនួយ' : 'Support & Customer Care'}</span>
                </div>
                <h3 className="text-[22px] sm:text-[24px] font-black text-slate-900 tracking-tight">
                  {isKhmer ? 'ទាក់ទងមកកាន់ក្រុមការងារយើងខ្ញុំ' : 'How can we help you today?'}
                </h3>
                <p className="text-[13px] text-slate-500 font-medium">
                  {isKhmer ? 'ទាក់ទងតាមបណ្តាញសង្គម ឬ ផ្ញើសារផ្ទាល់មកកាន់ក្រុមជំនួយបច្ចេកទេស' : 'Get in touch with our helpdesk or send a direct inquiry to our team.'}
                </p>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowSupportModal(false)}
                className="w-9 h-9 rounded-2xl bg-slate-100 hover:bg-slate-200/80 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-all cursor-pointer border border-slate-200/80 active:scale-95 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Two-Column Split Layout */}
            <div className="p-6 sm:p-8 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              
              {/* Left Column: Direct Contact Channels (5 Cols) */}
              <div className="lg:col-span-5 flex flex-col justify-between space-y-4 bg-slate-50/80 border border-slate-200/80 rounded-3xl p-5">
                <div className="space-y-3.5">
                  <h4 className="text-[14px] font-extrabold text-slate-900 flex items-center gap-2">
                    <span>📍 {isKhmer ? 'ព័ត៌មានទំនាក់ទំនង' : 'Get in Touch'}</span>
                  </h4>

                  <div className="space-y-2">
                    {/* Phone Channel */}
                    <a 
                      href="tel:+85581968581" 
                      className="flex items-center gap-3 p-2.5 rounded-2xl bg-white hover:bg-emerald-50/60 border border-slate-200/80 hover:border-emerald-300 transition group shadow-2xs cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Phone className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0 flex-grow">
                        <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">
                          {isKhmer ? 'លេខទូរស័ព្ទ' : 'Phone Number'}
                        </span>
                        <span className="text-[13px] font-bold text-slate-900 group-hover:text-emerald-700 transition-colors truncate block">
                          +855 81 968 581
                        </span>
                      </div>
                    </a>

                    {/* Telegram Channel */}
                    <a 
                      href="https://t.me/Nexusfinance_Support" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex items-center gap-3 p-2.5 rounded-2xl bg-white hover:bg-cyan-50/60 border border-slate-200/80 hover:border-cyan-300 transition group shadow-2xs cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <MessageCircle className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0 flex-grow">
                        <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">
                          {isKhmer ? 'តេឡេក្រាមជំនួយ' : 'Telegram Support'}
                        </span>
                        <span className="text-[13px] font-bold text-slate-900 group-hover:text-cyan-700 transition-colors truncate block">
                          @Nexusfinance_Support
                        </span>
                      </div>
                    </a>

                    {/* Email Channel */}
                    <a 
                      href="mailto:support@nexusfinance.asia" 
                      className="flex items-center gap-3 p-2.5 rounded-2xl bg-white hover:bg-emerald-50/60 border border-slate-200/80 hover:border-emerald-300 transition group shadow-2xs cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Mail className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0 flex-grow">
                        <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">
                          {isKhmer ? 'អ៊ីមែលជំនួយ' : 'Email Support'}
                        </span>
                        <span className="text-[13px] font-bold text-slate-900 group-hover:text-emerald-700 transition-colors truncate block">
                          support@nexusfinance.asia
                        </span>
                      </div>
                    </a>

                    {/* Official Website */}
                    <a 
                      href="https://www.nexusfinance.asia" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex items-center gap-3 p-2.5 rounded-2xl bg-white hover:bg-slate-100 border border-slate-200/80 hover:border-slate-300 transition group shadow-2xs cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Globe className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0 flex-grow">
                        <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">
                          {isKhmer ? 'គេហទំព័រផ្លូវការ' : 'Official Website'}
                        </span>
                        <span className="text-[13px] font-bold text-slate-900 group-hover:text-emerald-700 transition-colors truncate block">
                          www.nexusfinance.asia
                        </span>
                      </div>
                    </a>
                  </div>
                </div>

                {/* Address & Hours Footer in Left Column */}
                <div className="pt-2 border-t border-slate-200/80 space-y-2 text-slate-600">
                  <div className="flex items-center gap-2 text-[12px]">
                    <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold text-slate-700 truncate">OCIC, Phnom Penh, Cambodia</span>
                  </div>
                  <div className="flex items-center gap-2 text-[12px]">
                    <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-medium text-slate-600">Mon–Fri, 8:00 AM – 5:00 PM ICT</span>
                  </div>
                </div>

              </div>

              {/* Right Column: Interactive Send Message Form (7 Cols) */}
              <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between">
                <div>
                  <h4 className="text-[15px] font-extrabold text-slate-900 flex items-center gap-2 mb-1">
                    <span>✉️ {isKhmer ? 'ផ្ញើសារមកកាន់យើង' : 'Send us a Message'}</span>
                  </h4>
                  <p className="text-[12.5px] text-slate-500 font-medium mb-4">
                    {isKhmer ? 'យើងនឹងឆ្លើយតបក្នុងរយៈពេលយ៉ាងយូរ ២៤ ម៉ោង។' : 'Leave your inquiry below and our helpdesk will get back to you promptly.'}
                  </p>

                  <form onSubmit={handleSendSupportMessage} className="space-y-3.5">
                    {/* Name & Email Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-extrabold uppercase text-slate-600 tracking-wider">
                          {isKhmer ? 'ឈ្មោះរបស់អ្នក' : 'Your Name'}
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-slate-400">
                            <User className="w-4 h-4" />
                          </div>
                          <input
                            type="text"
                            value={supportName}
                            onChange={(e) => setSupportName(e.target.value)}
                            placeholder={isKhmer ? "បញ្ចូលឈ្មោះ" : "Enter your name"}
                            className="w-full bg-slate-50/90 border border-slate-200 focus:bg-white rounded-2xl pl-10 pr-3.5 py-2.5 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 font-medium transition-all"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-extrabold uppercase text-slate-600 tracking-wider">
                          {isKhmer ? 'អ៊ីមែលរបស់អ្នក' : 'Email Address'}
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-slate-400">
                            <Mail className="w-4 h-4" />
                          </div>
                          <input
                            type="email"
                            value={supportEmail}
                            onChange={(e) => setSupportEmail(e.target.value)}
                            placeholder="name@domain.com"
                            className="w-full bg-slate-50/90 border border-slate-200 focus:bg-white rounded-2xl pl-10 pr-3.5 py-2.5 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 font-medium transition-all"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* Message Textarea */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-extrabold uppercase text-slate-600 tracking-wider">
                        {isKhmer ? 'ខ្លឹមសារសារ' : 'Message Details'}
                      </label>
                      <textarea
                        rows={4}
                        value={supportMessage}
                        onChange={(e) => setSupportMessage(e.target.value)}
                        placeholder={isKhmer ? "សូមសរសេរសំណួរ ឬបញ្ហារបស់អ្នកនៅទីនេះ..." : "Describe how we can assist you with loans, accounts, or payments..."}
                        className="w-full bg-slate-50/90 border border-slate-200 focus:bg-white rounded-2xl p-3.5 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 font-medium transition-all resize-none"
                        required
                      />
                    </div>

                    {/* Send Message Button */}
                    <div className="pt-1">
                      <button
                        type="submit"
                        disabled={supportLoading || supportSent}
                        className="group relative w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:via-teal-600 hover:to-emerald-700 text-white font-black text-[14px] tracking-wide py-3 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-[0_8px_20px_-4px_rgba(16,185,129,0.35)] hover:shadow-[0_12px_24px_-4px_rgba(16,185,129,0.48)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.985] transition-all duration-200 cursor-pointer disabled:opacity-50 select-none"
                      >
                        {supportLoading ? (
                          <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> {isKhmer ? 'កំពុងផ្ញើ...' : 'SENDING MESSAGE...'}</span>
                        ) : supportSent ? (
                          <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-white" /> {isKhmer ? 'បានផ្ញើជោគជ័យ!' : 'MESSAGE SENT!'}</span>
                        ) : (
                          <>
                            <span>{isKhmer ? 'ផ្ញើសារឥឡូវនេះ' : 'Send Message'}</span>
                            <Send className="w-4 h-4 stroke-[2.3] group-hover:translate-x-1 group-hover:-translate-y-0.5 transition-transform duration-200 ease-out" />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
