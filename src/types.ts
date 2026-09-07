/**
 * Nexusfinance Dashboard State Types
 */

export type PortalType = 'portal-selection' | 'customer' | 'loan-officer' | 'super-admin';

export interface Tenant {
  id: number;
  name: string;
  slug: string;
  logo_url: string;
  plan: string;
  max_users: number;
  max_loans: number;
  config: Record<string, any>;
  payment_provider?: 'bakong' | 'aba_payway';
  bakong_account_id?: string;
  merchant_name?: string;
  payway_merchant_id?: string;
  payway_api_key?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantStats {
  tenant_id: number;
  total_users: number;
  total_loans: number;
  total_volume: number;
}

export interface LoanApplication {
  id: string; // e.g., "#77281"
  applicantName: string;
  applicantEmail: string;
  initials: string;
  amount: number;
  type: 'SME Loan' | 'Housing' | 'Personal' | 'Auto';
  status: 'New' | 'Review' | 'Final' | 'Hold' | 'Approved' | 'Rejected';
  urgency: 'Normal' | 'Urgent';
  assignedToMe: boolean;
  date: string;
  purpose: string;
  creditScore: number;
  monthlyIncome: number;
  durationMonths: number;
  monthlyPayment?: number;
  overdueCount?: number;
  nextPaymentDate?: string | null;
  repaymentStatus?: 'On Time' | 'Overdue' | 'Paid';
}

export interface Task {
  id: string;
  title: string;
  applicant: string;
  regarding: string;
  time: string;
  completed: boolean;
}

export interface Transaction {
  id: string;
  title: string;
  date: string;
  amount: number; // Positive for disbursement, negative for payment/repayment or fee
  type: 'Repayment' | 'Loan Disbursement' | 'Fee' | 'Internal Transfer';
}

export interface PlatformConfig {
  baseInterestRate: number; // e.g., 5.4%
  maxLoanAmount: number; // e.g., 500000
  kycRequired: boolean;
  autoApproveLimit: number; // e.g., 2000
  enable_auto_approval?: boolean;
  reminder_time?: string;
  telegram_admin_id?: string;
  enable_admin_reports?: boolean;
  sms_gateway?: string;
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  twilio_phone_number?: string;
  brevo_api_key?: string;
  brevo_sender_name?: string;
  vonage_api_key?: string;
  vonage_api_secret?: string;
  vonage_from_number?: string;
  grace_period_days?: number;
  late_penalty_daily?: number;
  emailVerificationRequired?: boolean;
  plan_basic_price?: number;
  plan_standard_price?: number;
  plan_premium_price?: number;
}

export interface PlatformStats {
  totalVolume: number;
  activeCustomers: number;
  outstandingBalanceValue: number;
  interestEarned: number;
  volumeTransactions?: any[];
  customerList?: any[];
  outstandingCustomers?: any[];
  yieldCustomers?: any[];
}

export type CurrencyCode = 'USD' | 'KHR';

export const EXCHANGE_RATE_KHR = 4100; // 1 USD = 4,100 KHR (approximate)

// ── KHQR Types ──────────────────────────────────────────────

export interface KHQRGenerateRequest {
  bakongAccountId: string;
  merchantName: string;
  merchantCity: string;
  currency: '840' | '116';
  amount?: number;
  countryCode?: string;
  storeLabel?: string;
  phone?: string;
  email?: string;
}

export interface KHQRGenerateResponse {
  success: boolean;
  khqrString: string;
  referenceId: string;
  merchantInfo: {
    name: string;
    city: string;
    currency: string;
    amount?: number;
  };
  crc: string;
}

export interface KHQRVerifyResponse {
  success: boolean;
  responseCode: number;
  responseMessage: string;
  valid: boolean;
}

export interface KHQRDecodeResponse {
  success: boolean;
  data: Record<string, string>;
  merchantInfo: {
    accountId?: string;
    name?: string;
    city?: string;
    currency?: string;
    amount?: string;
    country?: string;
  };
  crcValid: boolean;
}

export interface KHQRDeeplinkResponse {
  success: boolean;
  deeplink: string;
  md5: string;
}

export interface KHQRTransactionCheckResponse {
  success: boolean;
  transactionStatus: string;
  responseCode: number;
  responseMessage: string;
  transactionId?: string;
}
