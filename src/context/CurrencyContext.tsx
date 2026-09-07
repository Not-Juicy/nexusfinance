import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CurrencyCode, EXCHANGE_RATE_KHR } from '../types';

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  formatCurrency: (amount: number) => string;
  formatCurrencyShort: (amount: number) => string;
  exchangeRate: number;
  t: (key: string) => string;
  isKhmer: boolean;
  language: 'en' | 'kh';
  setLanguage: (lang: 'en' | 'kh') => void;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const translations: Record<string, { en: string; kh: string }> = {
  // Sidebar & Navigation
  'dashboard': { en: 'Dashboard', kh: 'ផ្ទាំងគ្រប់គ្រង' },
  'tenants': { en: 'Subscribers', kh: 'ស្ថាប័នជាវសេវា (Subscribers)' },
  'users': { en: 'Users', kh: 'អ្នកប្រើប្រាស់' },
  'reminders': { en: 'Reminders', kh: 'ការរំលឹកបំណុល' },
  'broadcast': { en: 'Broadcast', kh: 'ការផ្សព្វផ្សាយ' },
  'audit': { en: 'Audit Log', kh: 'កំណត់ត្រាសវនកម្ម' },
  'settings': { en: 'Settings', kh: 'ការកំណត់' },
  'logout': { en: 'Logout', kh: 'ចាកចេញ' },
  'menu': { en: 'Menu', kh: 'ម៉ឺនុយ' },
  'account': { en: 'Account', kh: 'គណនី' },
  'profile': { en: 'Profile', kh: 'ប្រវត្តិរូប' },
  'support': { en: 'Support', kh: 'ការគាំទ្រ' },
  'repayments_checklist': { en: 'Repayments Checklist', kh: 'បញ្ជីផ្ទៀងផ្ទាត់ការសងប្រាក់' },
  'loans': { en: 'Loans', kh: 'ឥណទាន' },
  'khqr_payment': { en: 'KHQR Payment', kh: 'ការទូទាត់តាម KHQR' },
  'reports': { en: 'Reports', kh: 'របាយការណ៍' },
  'reports_menu': { en: 'Reports Menu', kh: 'ម៉ឺនុយរបាយការណ៍' },
  'report_outstanding': { en: 'Outstanding Report', kh: 'របាយការណ៍សមតុល្យជំពាក់' },
  'report_payments': { en: 'Payments Report', kh: 'របាយការណ៍ការសងប្រាក់' },
  'report_late': { en: 'Loan Late Report', kh: 'របាយការណ៍ឥណទានយឺតយ៉ាវ' },
  'report_paid_off': { en: 'Paid Off Report', kh: 'របាយការណ៍ឥណទានរួចរាល់' },

  // Loan Officer Dashboard / Pending queue translation keys
  'corporate_workspace': { en: 'Corporate Workspace', kh: 'កន្លែងធ្វើការរួម' },
  'pending_applications': { en: 'Pending Applications', kh: 'ពាក្យស្នើសុំរង់ចាំការអនុម័ត' },
  'pending_applications_desc': { en: 'Manage and review your assigned loan requests.', kh: 'គ្រប់គ្រង និងពិនិត្យមើលសំណើកម្ចីដែលបានបែងចែកមកលោកអ្នក។' },
  'applications_by_status': { en: 'Applications by Status', kh: 'ពាក្យស្នើសុំតាមស្ថានភាព' },
  'total_recorded_label': { en: 'Total Recorded', kh: 'កត់ត្រាសរុប' },
  'applications_label': { en: 'Applications', kh: 'ពាក្យស្នើសុំ' },
  'pending_queue': { en: 'Pending Queue', kh: 'ជួររង់ចាំ' },
  'assigned_to_me': { en: 'Assigned to Me', kh: 'បែងចែកមកខ្ញុំ' },
  'urgent_action': { en: 'Urgent Action', kh: 'សកម្មភាពបន្ទាន់' },
  'all_applications': { en: 'All Applications', kh: 'ពាក្យស្នើសុំទាំងអស់' },
  'urgent': { en: 'Urgent', kh: 'បន្ទាន់' },
  'assigned_to_me_tab': { en: 'Assigned to me', kh: 'បែងចែកមកខ្ញុំ' },
  'applicant_reference': { en: 'Applicant / Reference', kh: 'អ្នកស្នើសុំ / លេខយោង' },
  'loan_value': { en: 'Loan Value', kh: 'ទំហំឥណទាន' },
  
  // Dashboard Titles & Descriptions
  'super_admin_hub': { en: 'Super Admin Hub', kh: 'មជ្ឈមណ្ឌលអភិបាលជាន់ខ្ពស់' },
  'super_admin_desc': { en: 'Executive overview, real-time ledger intelligence, and core platform analytics.', kh: 'ទិដ្ឋភាពទូទៅប្រតិបត្តិ ស្ថិតិសៀវភៅបញ្ជីផ្ទាល់ និងការវិភាគប្រព័ន្ធស្នូល។' },
  
  // Stats Cards
  'total_volume': { en: 'Total Cash Disbursed', kh: 'ទឹកប្រាក់បានបើកផ្តល់សរុប' },
  'active_customers': { en: 'Active Customers', kh: 'អតិថិជនសកម្ម' },
  'outstanding_portfolio': { en: 'Total Owed by Customers', kh: 'ទឹកប្រាក់អតិថិជនជំពាក់សរុប' },
  'gross_yields': { en: 'Projected Interest (1 Year)', kh: 'ការប្រាក់រំពឹងទុក (១ ឆ្នាំ)' },
  
  // Stats Descriptions
  'volume_desc': { en: 'Total value of all disbursed loans', kh: 'តម្លៃដើមសរុបនៃកម្ចីទាំងអស់ដែលបានបើកផ្តល់' },
  'outstanding_desc': { en: 'Total unpaid principal customer owes (Debt)', kh: 'ប្រាក់ដើមសរុបដែលអតិថិជនមិនទាន់សង (បំណុល)' },
  'yields_desc': { en: 'Projected annual interest return (What we earn)', kh: 'ផលចំណេញការប្រាក់ប្រចាំឆ្នាំប៉ាន់ស្មាន (ប្រាក់រកបាន)' },
  
  // Layout headers & widgets
  'portfolio_trend': { en: 'Platform Growth & Portfolio Trend', kh: 'កំណើនវេទិកា និងនិន្នាការផលប័ត្រឥណទាន' },
  'portfolio_trend_desc': { en: 'Overview of total cash disbursed and active outstanding balance (USD).', kh: 'ទិដ្ឋភាពទូទៅនៃទឹកប្រាក់បើកផ្តល់សរុប និងប្រាក់ដែលអតិថិជនជំពាក់សរុប (ដុល្លារ)។' },
  'system_health': { en: 'System Core Health', kh: 'សុខភាពស្នូលប្រព័ន្ធ' },
  'sweep_schedule': { en: 'Automatic Sweep Schedule', kh: 'កាលវិភាគត្រួតពិនិត្យស្វ័យប្រវត្តិ' },
  'bot_status': { en: 'Telegram Bot Status', kh: 'ស្ថានភាពតេឡេក្រាមបូត' },
  'kyc_enforcement': { en: 'Video KYC Enforcement', kh: 'ការអនុវត្តវីដេអូ KYC' },
  'auto_approve': { en: 'Auto-Approve Limit', kh: 'ដែនកំណត់អនុម័តស្វ័យប្រវត្តិ' },
  'shortcuts': { en: 'Shortcuts & Diagnostics', kh: 'ផ្លូវកាត់ និងការវិភាគប្រព័ន្ធ' },
  
  // Review & Audit lists
  'loan_review': { en: 'Loan Origination Review', kh: 'ការពិនិត្យពាក្យសុំឥណទានថ្មី' },
  'loan_review_desc': { en: 'New and review applications awaiting admin or officer verdict.', kh: 'ពាក្យស្នើសុំថ្មី និងកំពុងពិនិត្យដែលរង់ចាំការសម្រេចចិត្តពីអភិបាលឬមន្ត្រីឥណទាន។' },
  'audit_trail': { en: 'Core Security Audit Trail', kh: 'កំណត់ត្រាសវនកម្មសុវត្ថិភាពស្នូល' },
  'audit_trail_desc': { en: 'Recent operational changes and administrative actions ledger.', kh: 'កំណត់ត្រាសកម្មភាពអភិបាលកិច្ច និងការផ្លាស់ប្តូរប្រតិបត្តិការថ្មីៗ។' },
  
  // Alert/Badge Statuses
  'active': { en: 'Active', kh: 'សកម្ម' },
  'live_linked': { en: 'Live & Linked', kh: 'ដំណើរការ និងតភ្ជាប់' },
  'mandatory': { en: 'Mandatory', kh: 'កាតព្វកិច្ច' },
  'optional': { en: 'Optional', kh: 'មិនបង្ខំ' },
  'no_logs': { en: 'No logs recorded yet.', kh: 'មិនទាន់មានកំណត់ត្រាប្រតិបត្តិការនៅឡើយទេ។' },
  'no_applications': { en: 'No pending applications found.', kh: 'រកមិនឃើញពាក្យស្នើសុំដែលរង់ចាំការអនុម័តទេ។' },

  // Reports filters & table columns
  'search_placeholder': { en: 'Search by borrower, email, or reference...', kh: 'ស្វែងរកតាមរយៈអ្នកខ្ចី អ៊ីមែល ឬលេខយោង...' },
  'excel_export': { en: 'Excel Export', kh: 'ទាញយកជា Excel' },
  'print_report': { en: 'Print Report', kh: 'បោះពុម្ពរបាយការណ៍' },
  'loan_id': { en: 'Loan ID', kh: 'លេខកូដឥណទាន' },
  'borrower': { en: 'Borrower', kh: 'អ្នកខ្ចី' },
  'original_amount': { en: 'Original Amount', kh: 'ទឹកប្រាក់ដើមសរុប' },
  'total_repaid': { en: 'Total Repaid', kh: 'ប្រាក់សងសរុប' },
  'outstanding_balance': { en: 'Outstanding Balance', kh: 'សមតុល្យជំពាក់' },
  'loan_duration': { en: 'Loan Duration', kh: 'រយៈពេលឥណទាន' },
  'next_due_date': { en: 'Next Due Date', kh: 'កាលបរិច្ឆេទសងបន្ទាប់' },

  // Report descriptions
  'report_outstanding_desc': { en: 'Dynamic view of current active accounts and unpaid principal/interest balances.', kh: 'ទិដ្ឋភាពថាមវន្តនៃគណនីសកម្មបច្ចុប្បន្ន និងសមតុល្យប្រាក់ដើម/ការប្រាក់មិនទាន់បង់។' },
  'report_payments_desc': { en: 'Audit log of repayment transaction history and client installment credits.', kh: 'កំណត់ត្រាសវនកម្មនៃប្រវត្តិប្រតិបត្តិការសងប្រាក់ និងឥណទានបង់រំលស់របស់អតិថិជន។' },
  'report_late_desc': { en: 'Delinquency tracker listing accounts behind schedule with accumulated penalties.', kh: 'ប្រព័ន្ធតាមដានការយឺតយ៉ាវដោយរាយបញ្ជីគណនីយឺតជាងកាលវិភាគជាមួយនឹងប្រាក់ពិន័យបន្ថែម។' },
  'report_paid_off_desc': { en: 'Settle history recording all loans successfully closed out and completed.', kh: 'ប្រវត្តិនៃការទូទាត់រួចរាល់ដោយកត់ត្រាកម្ចីទាំងអស់ដែលត្រូវបានបិទ និងបញ្ចប់ដោយជោគជ័យ។' },
  'transaction_id': { en: 'Transaction ID', kh: 'លេខកូដប្រតិបត្តិការ' },
  'repayment_description': { en: 'Repayment Description', kh: 'ពិពណ៌នាការសងប្រាក់' },
  'amount_paid': { en: 'Amount Paid', kh: 'ទឹកប្រាក់បានសង' },
  'payment_date': { en: 'Payment Date', kh: 'កាលបរិច្ឆេទសងប្រាក់' },
  'log_type': { en: 'Log Type', kh: 'ប្រភេទកំណត់ត្រា' },
  'borrower_name_label': { en: 'Borrower Name', kh: 'ឈ្មោះអ្នកខ្ចី' },
  'unpaid_installments': { en: 'Unpaid Installments', kh: 'ចំនួនការសងមិនទាន់បង់' },
  'overdue_duration': { en: 'Overdue Duration', kh: 'រយៈពេលហួសកំណត់' },
  'accrued_penalty': { en: 'Accrued Penalty', kh: 'ប្រាក់ពិន័យបន្ថែម' },
  'interest_rate': { en: 'Interest Rate', kh: 'អត្រាការប្រាក់' },
  'original_loan_amount': { en: 'Original Loan Amount', kh: 'ទឹកប្រាក់ដើមឥណទាន' },
  'total_repayments_collected': { en: 'Total Repayments Collected', kh: 'ប្រាក់សងសរុបប្រមូលបាន' },
  'total_interest_earned': { en: 'Total Interest Earned', kh: 'ការប្រាក់សរុបទទួលបាន' },
  'settled_status': { en: 'Settled Status', kh: 'ស្ថានភាពទូទាត់រួច' },
  'no_outstanding_loans': { en: 'No outstanding loans match your filters.', kh: 'គ្មានឥណទានសមតុល្យជំពាក់ណាត្រូវនឹងតម្រងរបស់អ្នកឡើយ។' },
  'no_repayment_logs': { en: 'No repayment logs match your filters.', kh: 'គ្មានកំណត់ត្រាប្រតិបត្តិការសងប្រាក់ណាត្រូវនឹងតម្រងរបស់អ្នកឡើយ។' },
  'no_overdue_accounts': { en: 'No overdue accounts match your filters.', kh: 'គ្មានគណនីយឺតយ៉ាវណាត្រូវនឹងតម្រងរបស់អ្នកឡើយ។' },
  'no_settled_loans': { en: 'No settled/paid-off loans match your filters.', kh: 'គ្មានឥណទានរួចរាល់ណាត្រូវនឹងតម្រងរបស់អ្នកឡើយ។' },

  // Amortization Schedule modal labels
  'loan_amortization_schedule': { en: 'Loan Amortization Schedule', kh: 'កាលវិភាគបង់រំលស់ឥណទាន' },
  'schedule_desc': { en: 'Database pre-calculated installments tracker.', kh: 'ប្រព័ន្ធតាមដានការបង់ប្រាក់រំលស់ប្រចាំខែពីទិន្នន័យ។' },
  'payment_schedule': { en: 'Payment Schedule', kh: 'កាលវិភាគទូទាត់' },
  'application_no': { en: 'Application No', kh: 'ពាក្យស្នើសុំលេខ' },
  'reference_no': { en: 'Reference No', kh: 'លេខយោង' },
  'loan_amount': { en: 'Loan Amount', kh: 'ចំនួនប្រាក់កម្ចី' },
  'term': { en: 'Term', kh: 'រយៈពេល' },
  'repayment_freq': { en: 'Repayment Freq', kh: 'ភពញឹកញាប់បង់' },
  'disbursed_date': { en: 'Disbursed Date', kh: 'ថ្ងៃបើកផ្តល់ប្រាក់' },
  'borrower_phone': { en: 'Borrower Phone', kh: 'លេខទូរស័ព្ទអ្នកខ្ចី' },
  'monthly_30d': { en: 'Monthly (30d)', kh: 'ប្រចាំខែ (៣០ថ្ងៃ)' },
  'months': { en: 'Months', kh: 'ខែ' },
  'due_date': { en: 'Due Date', kh: 'ថ្ងៃកំណត់បង់' },
  'interest': { en: 'Interest', kh: 'ការប្រាក់' },
  'principal': { en: 'Principal', kh: 'ប្រាក់ដើម' },
  'payment': { en: 'Payment', kh: 'ត្រូវបង់សរុប' },
  'balance': { en: 'Balance', kh: 'សមតុល្យនៅសល់' },
  'status': { en: 'Status', kh: 'ស្ថានភាព' },
  'close': { en: 'Close', kh: 'បិទ' },
  'print_khmer_contract': { en: 'Print Khmer Contract', kh: 'បោះពុម្ពកិច្ចសន្យាខ្មែរ' },
  'print_schedule': { en: 'Print Schedule', kh: 'បោះពុម្ពកាលវិភាគ' },
  'unpaid': { en: 'Unpaid', kh: 'មិនទាន់បង់' },
  'paid': { en: 'Paid', kh: 'បានបង់រួច' },
  'overdue': { en: 'Overdue', kh: 'ហួសកំណត់' },
  'clear': { en: 'Clear', kh: 'គ្មាន' },
  'loan_progress': { en: 'Loan Progress', kh: 'វឌ្ឍនភាពឥណទាន' },
  'started': { en: 'Started', kh: 'បានចាប់ផ្តើម' },
  'completed': { en: 'Completed', kh: 'បានបញ្ចប់' },
  'complete': { en: 'complete', kh: 'បានសម្រេច' },
  'month': { en: 'Month', kh: 'ខែទី' },
  'of': { en: 'of', kh: 'នៃ' },

  // Customer Portal Details
  'welcome': { en: 'Welcome', kh: 'សូមស្វាគមន៍' },
  'access_balances': { en: 'Access your balances, active requests and more.', kh: 'ពិនិត្យមើលសមតុល្យ ឥណទានសកម្ម និងសកម្មភាពផ្សេងៗ។' },
  'balance_label': { en: 'Balance', kh: 'សមតុល្យឥណទាន' },
  'due': { en: 'Due', kh: 'កាលបរិច្ឆេទបង់' },
  'days_left': { en: 'days left', kh: 'ថ្ងៃទៀតហួសកំណត់' },
  'repay': { en: 'Repay', kh: 'សងប្រាក់' },
  'apply_loan': { en: 'Apply Loan', kh: 'ស្នើសុំឥណទាន' },
  'recent_history': { en: 'Recent History', kh: 'ប្រវត្តិកាលសងថ្មីៗ' },
  'view_all': { en: 'View All', kh: 'មើលទាំងអស់' },
  'export_csv': { en: 'Export CSV', kh: 'ទាញយកជា CSV' },
  'id_header': { en: 'ID', kh: 'លេខកូដ' },
  'amount_header': { en: 'Amount', kh: 'ទឹកប្រាក់' },
  'type_header': { en: 'Type', kh: 'ប្រភេទ' },
  'status_header': { en: 'Status', kh: 'ស្ថានភាព' },
  'date_header': { en: 'Date', kh: 'កាលបរិច្ឆេទ' },
  'transaction_history': { en: 'Transaction History', kh: 'ប្រវត្តិប្រតិបត្តិការ' },
  'title_header': { en: 'Title', kh: 'ចំណងជើង' },
  'loan_repayment': { en: 'Loan Repayment', kh: 'ការសងប្រាក់ឥណទាន' },
  'pay_securely_via_aba': { en: 'Pay securely via ABA PayWay', kh: 'ទូទាត់ប្រាក់ដោយសុវត្ថិភាពតាមរយៈ ABA PayWay' },
  'next_installment_due': { en: 'Next Installment Due', kh: 'ការបង់រំលស់បន្ទាប់' },
  'due_by': { en: 'Due by', kh: 'ត្រូវបង់នៅត្រឹម' },
  'payment_amount_label': { en: 'Payment Amount', kh: 'ចំនួនទឹកប្រាក់ត្រូវទូទាត់' },
  'amount_label': { en: 'Amount', kh: 'ចំនួនប្រាក់' },
  'pay_next_installment': { en: 'Pay Next Installment', kh: 'បង់រំលស់បន្ទាប់' },
  'standard_monthly_payment': { en: 'Standard monthly payment', kh: 'ការទូទាត់ប្រចាំខែធម្មតា' },
  'pay_full_balance': { en: 'Pay Full Balance', kh: 'បង់ផ្តាច់សមតុល្យសរុប' },
  'clear_entire_loan_early': { en: 'Clear your entire loan early', kh: 'បង់ផ្តាច់កម្ចីទាំងស្រុងមុនកាលកំណត់' },
  'custom_amount': { en: 'Custom Amount', kh: 'ទឹកប្រាក់កំណត់ផ្ទាល់ខ្លួន' },
  'enter_amount_to_pay': { en: 'Enter any amount to pay', kh: 'បញ្ចូលទឹកប្រាក់ណាមួយដើម្បីទូទាត់' },
  'scan_with_aba': { en: 'Scan with ABA Mobile or any KHQR supported banking app', kh: 'ស្កែនជាមួយ ABA Mobile ឬកម្មវិធីធនាគារដែលគាំទ្រ KHQR' },
  'pay_in_aba_mobile': { en: 'Pay in ABA Mobile', kh: 'ទូទាត់ក្នុងកម្មវិធី ABA Mobile' },
  'repayment_status_paid': { en: 'Paid', kh: 'បានបង់រួច' },
  'repayment_status_overdue': { en: 'Overdue', kh: 'ហួសកំណត់' },
  'repayment_status_ontime': { en: 'On Time', kh: 'ទៀងទាត់' },
  'loan_disbursement': { en: 'Loan Disbursement', kh: 'ការបើកផ្តល់ប្រាក់កម្ចី' },
  'repayment': { en: 'Repayment', kh: 'ការសងប្រាក់' },
  'recent_payments': { en: 'Recent Payments', kh: 'ការទូទាត់ថ្មីៗ' },
  'no_payment_history': { en: 'No payment history yet', kh: 'មិនទាន់មានប្រវត្តិទូទាត់ប្រាក់នៅឡើយទេ' },
  'waiting_payment_verification': { en: 'Waiting for payment verification...', kh: 'កំពុងរង់ចាំការផ្ទៀងផ្ទាត់ការទូទាត់...' },
  'secure_via_aba_payway': { en: 'Secure via ABA PayWay', kh: 'សុវត្ថិភាពតាមរយៈ ABA PayWay' },
  'dynamic_khqr': { en: 'Dynamic KHQR', kh: 'KHQR ថាមវន្ត' },

  // Profile Page
  'profile_settings': { en: 'Profile Settings', kh: 'ការកំណត់ប្រវត្តិរូប' },
  'profile_settings_desc': { en: 'Manage your identity, settings, credentials, and verification channels.', kh: 'គ្រប់គ្រងអត្តសញ្ញាណ ការកំណត់ ព័ត៌មានសម្ងាត់ និងបណ្តាញផ្ទៀងផ្ទាត់របស់អ្នក។' },
  'personal_information': { en: 'Personal Information', kh: 'ព័ត៌មានផ្ទាល់ខ្លួន' },
  'full_name': { en: 'Full Name', kh: 'ឈ្មោះ​ពេញ' },
  'phone_contact': { en: 'Phone Contact', kh: 'លេខទូរស័ព្ទទំនាក់ទំនង' },
  'access_clearance': { en: 'Access Clearance', kh: 'កម្រិតសិទ្ធិដំណើរការ' },
  'save_profile_changes': { en: 'Save Profile Changes', kh: 'រក្សាទុកការផ្លាស់ប្តូរ' },
  'saving': { en: 'Saving...', kh: 'កំពុងរក្សាទុក...' },
  'change_security_password': { en: 'Change Security Password', kh: 'ផ្លាស់ប្តូរលេខសម្ងាត់សុវត្ថិភាព' },
  'change_password_desc': { en: 'To modify your account password, you will be redirected to our Telegram bot where you can securely verify your identity and set a new password.', kh: 'ដើម្បីកែប្រែលេខសម្ងាត់គណនីរបស់អ្នក លោកអ្នកនឹងត្រូវបានបញ្ជូនទៅកាន់ Telegram bot របស់យើង ដែលលោកអ្នកអាចផ្ទៀងផ្ទាត់អត្តសញ្ញាណ និងកំណត់លេខសម្ងាត់ថ្មីដោយសុវត្ថិភាព។' },
  'change_password_via_telegram': { en: 'Change Password via Telegram', kh: 'ផ្លាស់ប្តូរលេខសម្ងាត់តាម Telegram' },
  'verified_client': { en: 'Verified Client', kh: 'អតិថិជនបានផ្ទៀងផ្ទាត់' },
  'active_status': { en: 'Active', kh: 'សកម្ម' },
  'no_phone_set': { en: 'No phone set', kh: 'មិនទាន់កំណត់លេខទូរស័ព្ទ' },
  'root_administrator': { en: 'Root Administrator', kh: 'អភិបាលជាន់ខ្ពស់' },
  'administrator': { en: 'Administrator', kh: 'អភិបាលកិច្ច' },
  'operations_officer': { en: 'Operations Officer', kh: 'មន្ត្រីប្រតិបត្តិការ' },

  // Support Page
  'support_and_customer_care': { en: 'Support & Customer Care', kh: 'ការគាំទ្រ និងថែទាំអតិថិជន' },
  'support_desc': { en: 'Get in touch with our support desk or send a message directly to our team.', kh: 'ទាក់ទងមកកាន់ផ្នែកគាំទ្ររបស់យើង ឬផ្ញើសារផ្ទាល់ទៅកាន់ក្រុមការងាររបស់យើង។' },
  'get_in_touch': { en: 'Get in Touch', kh: 'ទាក់ទងមកយើង' },
  'phone_number': { en: 'Phone Number', kh: 'លេខទូរស័ព្ទ' },
  'telegram_support': { en: 'Telegram Support', kh: 'តេឡេក្រាមគាំទ្រ' },
  'email_support': { en: 'Email Support', kh: 'អ៊ីមែលគាំទ្រ' },
  'official_website': { en: 'Official Website', kh: 'គេហទំព័រផ្លូវការ' },
  'corporate_address': { en: 'Corporate Address', kh: 'អាសយដ្ឋានក្រុមហ៊ុន' },
  'business_hours': { en: 'Business Hours', kh: 'ម៉ោងធ្វើការ' },
  'send_a_message': { en: 'Send a Message', kh: 'ផ្ញើសារ' },
  'send_message_desc': { en: 'Leave us a message, and our helpdesk will respond to you within 24 hours.', kh: 'ផ្ញើសារមកកាន់យើង ហើយភ្នាក់ងាររបស់យើងនឹងឆ្លើយតបទៅលោកអ្នកវិញក្នុងរយៈពេល២៤ម៉ោង។' },
  'your_name': { en: 'Your Name', kh: 'ឈ្មោះរបស់អ្នក' },
  'your_email_address': { en: 'Your Email Address', kh: 'អាសយដ្ឋានអ៊ីមែលរបស់អ្នក' },
  'message_details': { en: 'Message Details', kh: 'ព័ត៌មានលម្អិតនៃសារ' },
  'enter_your_name': { en: 'Enter your name', kh: 'បញ្ចូលឈ្មោះរបស់អ្នក' } ,
  'enter_your_email': { en: 'Enter your email', kh: 'បញ្ចូលអ៊ីមែលរបស់អ្នក' },
  'enter_your_message': { en: 'Enter your message', kh: 'បញ្ចូលសាររបស់អ្នក' },
  'send_message_btn': { en: 'Send Message', kh: 'ផ្ញើសារ' },
  'message_sent': { en: 'Message Sent!', kh: 'សារត្រូវបានផ្ញើ!' },

  // Apply Loan Modal
  'apply_loan_desc': { en: 'Complete the application in two steps', kh: 'បំពេញពាក្យសុំក្នុងពីរជំហាន' },
  'personal_info': { en: 'Personal Info', kh: 'ព័ត៌មានផ្ទាល់ខ្លួន' },
  'loan_details': { en: 'Loan Details', kh: 'ព័ត៌មានលម្អិតឥណទាន' },
  'next_step': { en: 'Next Step', kh: 'ជំហានបន្ទាប់' },
  'monthly_income': { en: 'Monthly Income', kh: 'ប្រាក់ចំណូលប្រចាំខែ' },
  'loan_category': { en: 'Loan Category', kh: 'ប្រភេទឥណទាន' },
  'duration': { en: 'Duration', kh: 'រយៈពេលកម្ចី' },
  'loan_purpose': { en: 'Loan Purpose', kh: 'គោលបំណងកម្ចី' },
  'enter_loan_amount': { en: 'Enter loan amount', kh: 'បញ្ចូលចំនួនប្រាក់កម្ចី' },
  'enter_monthly_income': { en: 'Enter monthly income', kh: 'បញ្ចូលប្រាក់ចំណូលប្រចាំខែ' },
  'describe_loan_purpose': { en: 'Describe the purpose of this loan...', kh: 'រៀបរាប់ពីគោលបំណងនៃកម្ចីនេះ...' },
  'back': { en: 'Back', kh: 'ត្រឡប់ក្រោយ' },
  'submit_application': { en: 'Submit Application', kh: 'ដាក់ពាក្យស្នើសុំ' },
  'enter_full_name': { en: 'Enter your full name', kh: 'បញ្ចូលឈ្មោះពេញរបស់អ្នក' },
  'processing': { en: 'Processing...', kh: 'កំពុងដំណើរការ...' },
  'estimated_payment': { en: 'Estimated Payment', kh: 'ការទូទាត់ប៉ាន់ស្មាន' },
  'total_repayment': { en: 'Total repayment', kh: 'ការសងប្រាក់សរុប' },
  'application_submitted': { en: 'Application Submitted!', kh: 'ពាក្យស្នើសុំត្រូវបានដាក់រួចរាល់!' },
  'application_submitted_desc': { en: 'Your application has been filed.', kh: 'ពាក្យស្នើសុំរបស់អ្នកត្រូវបានដាក់រួចរាល់។' },
  'underwriters_verification': { en: 'Underwriters will perform verification shortly.', kh: 'ភ្នាក់ងាររបស់យើងខ្ញុំនឹងផ្ទៀងផ្ទាត់ក្នុងពេលឆាប់ៗនេះ។' },
  'back_to_portal': { en: 'Back to Portal', kh: 'ត្រឡប់ទៅផ្ទាំងដើម' },
  'months_label': { en: 'Months', kh: 'ខែ' },
  'year_label': { en: 'year', kh: 'ឆ្នាំ' },
  'years_label': { en: 'years', kh: 'ឆ្នាំ' },

  // User Management
  'user_management': { en: 'User Management', kh: 'ការគ្រប់គ្រងអ្នកប្រើប្រាស់' },
  'create_loan_officer': { en: 'Create Loan Officer', kh: 'បង្កើតមន្ត្រីឥណទាន' },
  'new_loan_officer': { en: 'New Loan Officer', kh: 'មន្ត្រីឥណទានថ្មី' },
  'create_officer': { en: 'Create Officer', kh: 'បង្កើតមន្ត្រី' },
  'creating': { en: 'Creating...', kh: 'កំពុងបង្កើត...' },
  'name_header': { en: 'Name', kh: 'ឈ្មោះ' },
  'email_header': { en: 'Email', kh: 'អ៊ីមែល' },
  'phone_header': { en: 'Phone', kh: 'ទូរស័ព្ទ' },
  'role_header': { en: 'Role', kh: 'តួនាទី' },
  'reset_pw': { en: 'Reset PW', kh: 'កំណត់លេខសម្ងាត់ឡើងវិញ' },
  'reset_user_password': { en: 'Reset User Password', kh: 'កំណត់លេខសម្ងាត់អ្នកប្រើប្រាស់ឡើងវិញ' },
  'send_reset_link': { en: 'Send Reset Link', kh: 'ផ្ញើតំណភ្ជាប់កំណត់ឡើងវិញ' },
  'set_password': { en: 'Set Password', kh: 'កំណត់លេខសម្ងាត់' },
  'password_placeholder': { en: 'Password', kh: 'លេខសម្ងាត់' },
  'or_set_manually': { en: 'Or set manually', kh: 'ឬកំណត់ដោយដៃផ្ទាល់' },
  'reset_pw_desc': { en: 'Send a reset link via email, or set a new password directly.', kh: 'ផ្ញើតំណភ្ជាប់កំណត់ឡើងវិញតាមរយៈអ៊ីមែល ឬកំណត់លេខសម្ងាត់ថ្មីដោយផ្ទាល់។' },
  'reset_pw_email_desc': { en: 'User receives an email to set their own password', kh: 'អ្នកប្រើប្រាស់នឹងទទួលបានអ៊ីមែលដើម្បីកំណត់លេខសម្ងាត់ដោយខ្លួនឯង' },
  'loan_officer_label': { en: 'Loan Officer', kh: 'មន្ត្រីឥណទាន' },
  'admin_role': { en: 'Admin', kh: 'អភិបាល' },
  'customer_role': { en: 'Customer', kh: 'អតិថិជន' },
  'no_users_registered': { en: 'No users registered', kh: 'មិនទាន់មានអ្នកប្រើប្រាស់បានចុះឈ្មោះនៅឡើយទេ' },
  'no_users_desc': { en: 'Users will appear here once they sign up through the registration page.', kh: 'អ្នកប្រើប្រាស់នឹងបង្ហាញនៅទីនេះ នៅពេលពួកគេចុះឈ្មោះតាមរយៈទំព័រចុះឈ្មោះរួច។' },

  // Custom Reminders
  'custom_reminders': { en: 'Custom Reminders', kh: 'ការរំលឹកតាមបំណង' },
  'custom_reminders_desc': { en: 'Configure scheduled push alerts and notifications for active loans.', kh: 'កំណត់រចនាសម្ព័ន្ធការជូនដំណឹងជំរុញតាមកាលវិភាគសម្រាប់កម្ចីសកម្ម។' },
  'create_reminder_rule': { en: 'Create Reminder Rule', kh: 'បង្កើតច្បាប់រំលឹក' },
  'automated_sweep_schedule': { en: 'Automated Sweep Schedule', kh: 'កាលវិភាគស្កែនស្វ័យប្រវត្ត' },
  'sweep_schedule_desc': { en: 'Daily reminder scans will run automatically at your configured time.', kh: 'ការស្កែនរំលឹកប្រចាំថ្ងៃនឹងដំណើរការដោយស្វ័យប្រវត្តិតាមពេលវេលាដែលអ្នកបានកំណត់។' },
  'trigger_time_label': { en: 'Trigger Time:', kh: 'ពេលវេលាដំណើរការ៖' },
  'rule_name_header': { en: 'Rule Name', kh: 'ឈ្មោះច្បាប់' },
  'days_relative_to_due': { en: 'Days Relative to Due', kh: 'ចំនួនថ្ងៃធៀបនឹងថ្ងៃកំណត់' },
  'delivery_channels': { en: 'Delivery Channels', kh: 'បណ្តាញបញ្ជូន' },
  'active_status_header': { en: 'Active Status', kh: 'ស្ថានភាពសកម្ម' },
  'actions_header': { en: 'Actions', kh: 'សកម្មភាព' },
  'no_reminder_rules': { en: 'No reminder rules configured yet. Click "Create Reminder Rule" to get started.', kh: 'មិនទាន់មានច្បាប់រំលឹកត្រូវបានកំណត់រចនាសម្ព័ន្ធនៅឡើយទេ។ ចុច "បង្កើតច្បាប់រំលឹក" ដើម្បីចាប់ផ្តើម។' },
  'days_label': { en: 'days', kh: 'ថ្ងៃ' },
  'days_overdue_label': { en: 'days overdue', kh: 'ថ្ងៃហួសកំណត់' },
  'telegram_only': { en: 'Telegram Only', kh: 'តេឡេក្រាមតែប៉ុណ្ណោះ' },
  'in_app_only': { en: 'In-App Only', kh: 'ក្នុងប្រព័ន្ធតែប៉ុណ្ណោះ' },
  'telegram_in_app': { en: 'Telegram & In-App', kh: 'តេឡេក្រាម & ក្នុងប្រព័ន្ធ' },
  'disabled_status': { en: 'Disabled', kh: 'បានបិទ' },
  'edit_reminder_rule': { en: 'Edit Reminder Rule', kh: 'កែសម្រួលច្បាប់រំលឹក' },
  'trigger_days_before': { en: 'Trigger (Days before due)', kh: 'លក្ខខណ្ឌដំណើរការ (ចំនួនថ្ងៃមុនថ្ងៃកំណត់)' },
  'message_template_label': { en: 'Message Template', kh: 'ទម្រង់គំរូសារ' },
  'template_vars_helper': { en: 'Template Variables Helper', kh: 'ជំនួយការប្រើប្រាស់អថេរគំរូសារ' },

  // Debt Collection & Delinquent Tracker
  'collections': { en: 'Debt Collections', kh: 'ការទារបំណុលហួសកំណត់' },
  'delinquent_tracker': { en: 'Delinquent Debt Tracker', kh: 'ការតាមដានបំណុលហួសកំណត់' },
  'collection_policy': { en: 'Collection & Late Penalty Policy', kh: 'គោលការណ៍ទារបំណុល & ពិន័យយឺតយ៉ាវ' },
  'grace_period': { en: 'Grace Period (Days)', kh: 'រយៈពេលអនុគ្រោះ (ថ្ងៃ)' },
  'grace_period_desc': { en: 'Buffer days before late penalties begin', kh: 'ចំនួនថ្ងៃអនុគ្រោះមុនពេលចាប់ផ្តើមគិតប្រាក់ពិន័យ' },
  'late_penalty_daily': { en: 'Daily Late Fee ($/day)', kh: 'ប្រាក់ពិន័យប្រចាំថ្ងៃ ($/ថ្ងៃ)' },
  'late_penalty_daily_desc': { en: 'Accrues daily after grace period expires', kh: 'កើនឡើងជារៀងរាល់ថ្ងៃបន្ទាប់ពីរយៈពេលអនុគ្រោះផុតកំណត់' },
  'load_standard_presets': { en: 'Load 3 Standard Rules', kh: 'ផ្ទុកច្បាប់ស្តង់ដារ ៣' },
  'rules_tab': { en: 'Automated Rules & Sweep', kh: 'ច្បាប់ស្វ័យប្រវត្ត & ស្កែន' },
  'nudge_btn': { en: 'Send Nudge', kh: 'ផ្ញើសារដាស់តឿន' },
  'nudging': { en: 'Nudging...', kh: 'កំពុងផ្ញើ...' },
  'mild_risk': { en: '1–15 Days (Mild)', kh: '១–១៥ ថ្ងៃ (ស្រាល)' },
  'medium_risk': { en: '16–30 Days (Medium)', kh: '១៦–៣០ ថ្ងៃ (មធ្យម)' },
  'severe_risk': { en: '30+ Days (High Risk)', kh: '៣០+ ថ្ងៃ (ហានិភ័យខ្ពស់)' },
  'click_insert_vars': { en: 'Click to Insert Variables', kh: 'ចុចដើម្បីបញ្ចូលអថេរ' },
  'enable_rule_immediately': { en: 'Enable this reminder rule immediately', kh: 'បើកដំណើរការច្បាប់រំលឹកនេះភ្លាមៗ' },

  // Broadcast Desk
  'broadcast_desk': { en: 'Broadcast Desk', kh: 'ការផ្សព្វផ្សាយជាក្រុម' },
  'broadcast_desk_desc': { en: 'Send real-time alerts and bulk messages to platform users.', kh: 'ផ្ញើសារជូនដំណឹងភ្លាមៗ និងសារជាក្រុមទៅកាន់អ្នកប្រើប្រាស់ប្រព័ន្ធ។' },
  'compose_broadcast': { en: 'Compose Broadcast', kh: 'សរសេរសារផ្សព្វផ្សាយ' },
  'target_audience': { en: 'Target Audience', kh: 'ក្រុមគោលដៅ' },
  'alert_channel': { en: 'Alert Channel', kh: 'បណ្តាញជូនដំណឹង' },
  'message_body': { en: 'Message Body', kh: 'ខ្លឹមសារសារ' },
  'all_registered_users': { en: 'All Registered Users', kh: 'អ្នកប្រើប្រាស់ចុះឈ្មោះទាំងអស់' },
  'telegram_in_app_alerts': { en: 'Telegram & In-App Alerts', kh: 'តេឡេក្រាម & ការជូនដំណឹងក្នុងប្រព័ន្ធ' },
  'type_message_here': { en: 'Type your message here... (Markdown supported for Telegram)', kh: 'សរសេរសាររបស់អ្នកនៅទីនេះ... (គាំទ្រការប្រើប្រាស់ Markdown សម្រាប់តេឡេក្រាម)' },
  'characters_label': { en: 'characters', kh: 'តួអក្សរ' },
  'markdown_tip': { en: 'Use standard markdown formatting for links and bolding', kh: 'ប្រើប្រាស់ទម្រង់ Markdown ធម្មតាសម្រាប់តំណភ្ជាប់ និងអក្សរដិត' },
  'send_broadcast_btn': { en: 'Send Broadcast', kh: 'ផ្ញើសារផ្សព្វផ្សាយ' },
  'broadcast_logs_history': { en: 'Broadcast Logs & History', kh: 'ប្រវត្តិកំណត់ត្រានៃការផ្សព្វផ្សាយ' },
  'telegram_linked_users': { en: 'Telegram Linked Users Only', kh: 'អ្នកភ្ជាប់តេឡេក្រាមតែប៉ុណ្ណោះ' },
  'customers_only': { en: 'Customers Only', kh: 'អតិថិជនតែប៉ុណ្ណោះ' },
  'loan_officers_only': { en: 'Loan Officers Only', kh: 'មន្ត្រីឥណទានតែប៉ុណ្ណោះ' },
  'selected_customer': { en: 'Selected Customer...', kh: 'អតិថិជនបានជ្រើសរើស...' },
  'telegram_direct_only': { en: 'Telegram Direct Messages Only', kh: 'សារតេឡេក្រាមផ្ទាល់តែប៉ុណ្ណោះ' },
  'in_app_feed_only': { en: 'In-App Notification Feed Only', kh: 'ការជូនដំណឹងក្នុងប្រព័ន្ធតែប៉ុណ្ណោះ' },
  'no_broadcast_history': { en: 'No broadcast history found.', kh: 'រកមិនឃើញប្រវត្តិនៃការផ្សព្វផ្សាយឡើយ។' },
  'confirm_broadcast_dispatch': { en: 'Confirm Broadcast Dispatch', kh: 'បញ្ជាក់ការបញ្ជូនការផ្សព្វផ្សាយ' },
  'confirm_broadcast_desc': { en: 'You are about to broadcast this alert to all users matching the selection criteria. This operation cannot be undone.', kh: 'លោកអ្នកកំពុងផ្សព្វផ្សាយសារនេះទៅកាន់អ្នកប្រើប្រាស់ទាំងអស់ដែលត្រូវនឹងលក្ខខណ្ឌ។ ប្រតិបត្តិការនេះមិនអាចត្រឡប់ក្រោយបានទេ។' },
  'confirm_dispatch': { en: 'Confirm & Dispatch', kh: 'បញ្ជាក់ & បញ្ជូន' },
  'select_customers': { en: 'Select Customers', kh: 'ជ្រើសរើសអតិថិជន' },
  'select_customers_desc': { en: 'Search and select one or more customers to receive the broadcast alert.', kh: 'ស្វែងរក និងជ្រើសរើសអតិថិជនម្នាក់ ឬច្រើននាក់ដើម្បីទទួលសារផ្សព្វផ្សាយ។' },
  'search_users_placeholder': { en: 'Search by name, email, or phone number...', kh: 'ស្វែងរកតាមឈ្មោះ អ៊ីមែល ឬលេខទូរស័ព្ទ...' },
  'deselect_all': { en: 'Deselect All Search Results', kh: 'ដកការជ្រើសរើសលទ្ធផលស្វែងរកទាំងអស់' },
  'select_all_results': { en: 'Select All Search Results', kh: 'ជ្រើសរើសលទ្ធផលស្វែងរកទាំងអស់' },
  'save_selection': { en: 'Save Selection', kh: 'រក្សាទុកការជ្រើសរើស' },

  // Audit Log
  'audit_log': { en: 'Audit Log', kh: 'កំណត់ត្រាសវនកម្ម' },
  'audit_log_desc': { en: 'Real-time ledger audit trail of platform events, configuration changes, and actions.', kh: 'ការតាមដានសវនកម្មលើព្រឹត្តិការណ៍ប្រព័ន្ធ ការផ្លាស់ប្តូរការកំណត់រចនាសម្ព័ន្ធ និងសកម្មភាពនានា។' },
  'action_header': { en: 'Action', kh: 'សកម្មភាព' },
  'details_header': { en: 'Details', kh: 'ព័ត៌មានលម្អិត' },
  'by_header': { en: 'By', kh: 'ដោយ' },
  'time_header': { en: 'Time', kh: 'ពេលវេលា' },

  // Audit Actions
  'loan_approved': { en: 'Loan Approved', kh: 'ឥណទានត្រូវបានអនុម័ត' },
  'loan_rejected': { en: 'Loan Rejected', kh: 'ឥណទានត្រូវបានបដិសេធ' },
  'loan_held': { en: 'Loan Held', kh: 'ឥណទានត្រូវបានផ្អាក' },
  'role_changed': { en: 'Role Changed', kh: 'បានប្តូរតួនាទី' },
  'config_updated': { en: 'Config Updated', kh: 'បានធ្វើបច្ចុប្បន្នភាពការកំណត់' },
  'reminder_created': { en: 'Reminder Created', kh: 'បានបង្កើតការរំលឹក' },
  'reminder_updated': { en: 'Reminder Updated', kh: 'បានធ្វើបច្ចុប្បន្នភាពការរំលឹក' },
  'reminder_deleted': { en: 'Reminder Deleted', kh: 'បានលុបការរំលឹក' },
  'broadcast_sent': { en: 'Broadcast Sent', kh: 'បានផ្ញើសារផ្សព្វផ្សាយ' },
  'webhook_registered': { en: 'Webhook Registered', kh: 'បានចុះឈ្មោះ Webhook' },
  'reset_link_sent': { en: 'Reset Link Sent', kh: 'បានផ្ញើតំណភ្ជាប់កំណត់ឡើងវិញ' },
  'document_uploaded': { en: 'Document Uploaded', kh: 'បានបង្ហោះឯកសារ' },
  'payment_approved': { en: 'Payment Approved', kh: 'ការបង់ប្រាក់ត្រូវបានអនុម័ត' },
  'otp_sent': { en: 'OTP Sent', kh: 'បានផ្ញើ OTP' },
  'otp_verified': { en: 'OTP Verified', kh: 'បានផ្ទៀងផ្ទាត់ OTP' },
  'user_login': { en: 'User Login', kh: 'អ្នកប្រើប្រាស់ចូលគណនី' },

  // System Parameter Settings
  'system_parameters_adjustments': { en: 'System Parameters Adjustments', kh: 'ការកែសម្រួលប៉ារ៉ាម៉ែត្រប្រព័ន្ធ' },
  'annual_interest_rate': { en: 'Annual Interest Rate (APR %)', kh: 'អត្រាការប្រាក់ប្រចាំឆ្នាំ (APR %)' },
  'annual_interest_rate_desc': { en: 'The default yearly interest rate applied to all new loan packages.', kh: 'អត្រាការប្រាក់ប្រចាំឆ្នាំលំនាំដើមដែលត្រូវអនុវត្តចំពោះកញ្ចប់កម្ចីថ្មីទាំងអស់។' },
  'auto_approval_limit': { en: 'Auto-Approval Limit (USD)', kh: 'ដែនកំណត់អនុម័តស្វ័យប្រវត្ត (USD)' },
  'auto_approval_limit_desc': { en: 'Maximum loan amount that can be auto-approved instantly without officer review.', kh: 'ចំនួនប្រាក់កម្ចីអតិបរមាដែលអាចត្រូវបានអនុម័តដោយស្វ័យប្រវត្តភ្លាមៗដោយមិនចាំបាច់មានការពិនិត្យពីមន្ត្រី។' },
  'underwriting_mode': { en: 'Loan Approval & Underwriting Mode', kh: 'ទម្រង់អនុម័តកម្ចី & វាយតម្លៃឥណទាន' },
  'manual_approval_only': { en: 'Strict Manual Officer Review Only (Recommended)', kh: 'ពិនិត្យ និងអនុម័តដោយមន្ត្រីកម្ចីប៉ុណ្ណោះ (ណែនាំ)' },
  'manual_approval_only_desc': { en: '100% human-verified. All loan requests enter as New/Pending and require manual assessment & approval by a designated Loan Officer.', kh: 'ការផ្ទៀងផ្ទាត់ដោយមនុស្ស ១០០%។ រាល់សំណើកម្ចីទាំងអស់នឹងចូលក្នុងបញ្ជីរង់ចាំ ហើយទាមទារការវាយតម្លៃ និងការអនុម័តដោយផ្ទាល់ពីមន្ត្រីកម្ចី។' },
  'enable_auto_approval_toggle': { en: 'Enable Instant Auto-Approval for Low-Risk Micro-Loans', kh: 'បើកដំណើរការអនុម័តស្វ័យប្រវត្តសម្រាប់កម្ចីខ្នាតតូចដែលមានហានិភ័យទាប' },
  'enable_auto_approval_desc': { en: 'When turned on, loans below the limit with credit scores ≥ 700 will be auto-approved without waiting for officer review.', kh: 'នៅពេលបើក កម្ចីដែលមានចំនួនក្រោមដែនកំណត់ និងមានពិន្ទុឥណទាន ≥ ៧០០ នឹងត្រូវអនុម័តភ្លាមៗដោយមិនបាច់រង់ចាំមន្ត្រី។' },
  'maximum_loan_limit': { en: 'Maximum Loan Limit (USD)', kh: 'ដែនកំណត់កម្ចីអតិបរមា (USD)' },
  'maximum_loan_limit_desc': { en: 'The absolute maximum amount a single customer can borrow in total.', kh: 'ចំនួនទឹកប្រាក់អតិបរមាដាច់ខាតដែលអតិថិជនម្នាក់អាចខ្ចីបានសរុប។' },
  'require_email_verification': { en: 'Require Email Verification & Alerts', kh: 'តម្រូវឱ្យផ្ទៀងផ្ទាត់អ៊ីមែល & ជូនដំណឹង' },
  'require_email_verification_desc': { en: 'Enforces email verification checks on login/registration and enables SMTP/Brevo dispatches.', kh: 'តម្រូវឱ្យមានការត្រួតពិនិត្យការផ្ទៀងផ្ទាត់អ៊ីមែលលើការចូល/ការចុះឈ្មោះ និងបើកដំណើរការបញ្ជូន SMTP/Brevo។' },
  'active_enabled': { en: 'Active & Enabled', kh: 'សកម្ម & បើកដំណើរការ' },
  'telegram_bot_admin_controls': { en: 'Telegram Bot Admin Controls', kh: 'ការគ្រប់គ្រងអភិបាល Telegram Bot' },
  'telegram_admin_chat_id': { en: 'Telegram Admin Chat ID', kh: 'លេខសម្គាល់ក្រុមប្រឹក្សាភិបាល Telegram' },
  'reminder_summary_reports': { en: 'Reminder Summary Reports', kh: 'របាយការណ៍សង្ខេបការរំលឹក' },
  'send_sweep_reports': { en: 'Send Sweep Reports to Admin', kh: 'ផ្ញើរបាយការណ៍ស្កែនទៅកាន់អភិបាល' },
  'brevo_sms_gateway': { en: 'Brevo SMS Gateway Configuration', kh: 'ការកំណត់រចនាសម្ព័ន្ធផ្លូវចេញចូល Brevo SMS' },
  'brevo_api_key': { en: 'Brevo API Key', kh: 'កូនសោ Brevo API' },
  'brevo_sender_name': { en: 'Brevo Sender Name', kh: 'ឈ្មោះអ្នកផ្ញើ Brevo' },
  'apply_system_parameters': { en: 'Apply System Parameters', kh: 'អនុវត្តប៉ារ៉ាម៉ែត្រប្រព័ន្ធ' },
  'parameters_saved': { en: 'Parameters saved successfully!', kh: 'ប៉ារ៉ាម៉ែត្រត្រូវបានរក្សាទុកដោយជោគជ័យ!' },
};

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<'en' | 'kh'>(() => {
    const saved = localStorage.getItem('nexus_language');
    if (saved) return saved as 'en' | 'kh';
    const oldCurrency = localStorage.getItem('nexus_currency');
    return oldCurrency === 'KHR' ? 'kh' : 'en';
  });

  const setLanguage = useCallback((lang: 'en' | 'kh') => {
    localStorage.setItem('nexus_language', lang);
    localStorage.setItem('nexus_currency', lang === 'kh' ? 'KHR' : 'USD');
    setLanguageState(lang);
    window.dispatchEvent(new StorageEvent('storage', { key: 'nexus_currency', newValue: lang === 'kh' ? 'KHR' : 'USD' }));
  }, []);

  const isKhmer = language === 'kh';
  const currency: CurrencyCode = 'USD';

  const setCurrency = useCallback((c: CurrencyCode) => {
    setLanguage(c === 'KHR' ? 'kh' : 'en');
  }, [setLanguage]);

  const formatCurrency = useCallback((amount: number) => {
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, []);

  const formatCurrencyShort = useCallback((amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toFixed(0)}`;
  }, []);

  const t = useCallback((key: string) => {
    const entry = translations[key];
    if (!entry) return key;
    return isKhmer ? entry.kh : entry.en;
  }, [isKhmer]);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatCurrency, formatCurrencyShort, exchangeRate: EXCHANGE_RATE_KHR, t, isKhmer, language, setLanguage }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}
