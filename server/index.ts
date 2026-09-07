// ============================================================
// NEXUSFINANCE BACKEND API — Supabase-backed Express server
// ============================================================

import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { db } from './db.js';
import { createOtpForUser, verifyOtpForUser, requireOtpVerified, clearOtpVerified, createOtpForUserByPhone, verifyOtpForUserByPhone, requireOtpVerifiedByPhone, clearOtpVerifiedByPhone } from './otp.js';
import { sendSMS } from './sms.js';
import { verifyKHQR, decodeKHQR, generateDeeplink } from './khqr.js';
import { generateKHQR, checkTransaction } from './bakong.js';
import * as payway from './payway.js';
import { sendEmail, emailTemplates } from './email.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import bot, { setNotifyUserCallback } from './bot.js';
import cron from 'node-cron';
import TelegramBot from 'node-telegram-bot-api';

dotenv.config();

declare global {
  namespace Express {
    interface Request {
      user?: { id: number; email: string; name: string; role: string; tenant_id: number };
      tenantId?: number;
    }
  }
}

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) { console.error('FATAL: JWT_SECRET environment variable is required.'); process.exit(1); }

const requiredEnv = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE'];
for (const key of requiredEnv) {
  if (!process.env[key]) { console.error(`FATAL: ${key} is not set in .env`); process.exit(1); }
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again later.' },
});

const otpSessions = new Map<string, { phone: string; expiresAt: number; attempts: number }>();

app.set('trust proxy', 1);
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
app.use(cors({
  origin: corsOrigin,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id', 'Cache-Control', 'Pragma'],
  exposedHeaders: ['X-Tenant-Id'],
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Prevent caching on API routes by CDNs and edge networks
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

function logAudit(action: string, details: string, user: any) {
  db.from('nexus_audit_logs').insert({ action, details, userId: user.id, userEmail: user.email, tenant_id: user.tenant_id || 1 }).then(null, (err) => console.error('logAudit failed:', err));
}

let notifyUser = function(userId: number, text: string, tenantId?: number) {
  const time = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Phnom_Penh', hour: '2-digit', minute: '2-digit', hour12: false });
  db.from('nexus_notifications').insert({ userId, text, time, tenant_id: tenantId || 1 }).then(null, (err) => console.error('notifyUser failed:', err));
  sendTelegramNotificationToUser(userId, text);
};

async function sendTelegramNotificationToUser(userId: number, text: string) {
  try {
    const { data: user } = await db.from('nexus_users').select('telegram_chat_id').eq('id', userId).maybeSingle();
    if (user && user.telegram_chat_id && bot) {
      const chatId = parseInt(user.telegram_chat_id, 10);
      if (chatId) {
        await bot.sendMessage(chatId, `🔔 *NexusFinance Notification*\n\n${text}`, { parse_mode: 'Markdown' });
      }
    }
  } catch (err) {
    console.error('Failed to send Telegram notification to user:', err);
  }
}

async function notifyAdminOfNewLoan(loan: any) {
  const tenantId = loan.tenant_id || 1;
  try {
    const { data: config } = await db.from('nexus_config').select('telegram_admin_id').eq('tenant_id', tenantId).maybeSingle();
    if (config && config.telegram_admin_id && bot) {
      const adminChatId = parseInt(config.telegram_admin_id, 10);
      if (adminChatId) {
        const isApproved = loan.status === 'Approved' || loan.status === 'approved';
        const statusText = isApproved ? '🟢 Auto-Approved & Disbursed' : '⏳ Pending Underwriting Review';
        
        const message = `🔔 *New Loan Application Received!*\n\n` +
          `• *Applicant*: ${loan.applicantName}\n` +
          `• *Loan ID*: ${loan.id}\n` +
          `• *Amount*: $${Number(loan.amount).toLocaleString()}\n` +
          `• *Loan Type*: ${loan.type}\n` +
          `• *Purpose*: ${loan.purpose || 'Not specified'}\n` +
          `• *Credit Score*: ${loan.creditScore || 'N/A'}\n` +
          `• *Status*: *${statusText}*\n\n` +
          `Please review the application on the platform dashboard.`;
        
        await bot.sendMessage(adminChatId, message, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '🚀 View Applications', web_app: { url: 'https://nexusfinancefintech.vercel.app' } }]]
          }
        });
      }
    }
  } catch (err) {
    console.error('Failed to notify admin of new loan via Telegram:', err);
  }

  try {
    const { data: staff } = await db.from('nexus_users').select('name, email').in('role', ['super-admin', 'loan-officer']).eq('tenant_id', tenantId);
    if (staff && staff.length > 0) {
      const isApproved = loan.status === 'Approved' || loan.status === 'approved';
      const statusText = isApproved ? 'Auto-Approved & Disbursed' : 'Pending Underwriting Review';

      const emailPromises = staff.map(member => {
        const subject = `[NexusFinance] New Loan Application: ${loan.id}`;
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #0d9488; margin: 0;">NexusFinance</h2>
              <p style="color: #666666; margin: 5px 0 0 0; font-size: 14px;">Smart Lending Platform Notification</p>
            </div>
            
            <div style="padding: 20px; background-color: #f9f9f9; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="margin-top: 0; color: #111827;">New Loan Application Received</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666666; font-weight: bold; width: 40%;">Applicant Name:</td>
                  <td style="padding: 8px 0; color: #111827; font-weight: bold;">${loan.applicantName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666666; font-weight: bold;">Loan ID:</td>
                  <td style="padding: 8px 0; color: #111827; font-family: monospace;">${loan.id}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666666; font-weight: bold;">Requested Amount:</td>
                  <td style="padding: 8px 0; color: #0d9488; font-weight: bold;">$${Number(loan.amount).toLocaleString()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666666; font-weight: bold;">Loan Type:</td>
                  <td style="padding: 8px 0; color: #111827;">${loan.type}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666666; font-weight: bold;">Purpose:</td>
                  <td style="padding: 8px 0; color: #111827;">${loan.purpose || 'Not specified'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666666; font-weight: bold;">Credit Score:</td>
                  <td style="padding: 8px 0; color: #111827;">${loan.creditScore || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666666; font-weight: bold;">Status:</td>
                  <td style="padding: 8px 0; color: ${isApproved ? '#10b981' : '#f59e0b'}; font-weight: bold;">${statusText}</td>
                </tr>
              </table>
            </div>
            
            <div style="text-align: center;">
              <a href="https://nexusfinancefintech.vercel.app" style="display: inline-block; padding: 12px 24px; background-color: #0d9488; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">Review Application</a>
            </div>
          </div>
        `;
        return sendEmail(member.email, subject, html).catch(() => null);
      });
      return Promise.all(emailPromises);
    }
  } catch (err) {
    console.error('Failed to send new loan email notifications:', err);
  }
}

let reminderCronTask: any = null;

export function scheduleReminderCron(timeStr: string) {
  const [hourStr, minStr] = (timeStr || '07:00').split(':');
  const hour = parseInt(hourStr, 10) || 0;
  const minute = parseInt(minStr, 10) || 0;

  if (reminderCronTask) {
    reminderCronTask.stop();
  }

  const cronPattern = `${minute} ${hour} * * *`;
  reminderCronTask = cron.schedule(cronPattern, async () => {
    console.log(`  📬 Running daily payment reminders (Scheduled at ${timeStr} Cambodia time)...`);
    try {
      const { sendPaymentReminders } = await import('./bot.js');
      const ADMIN_ID = parseInt(process.env.TELEGRAM_ADMIN_ID || '0', 10);
      if (ADMIN_ID) {
        await sendPaymentReminders(undefined, ADMIN_ID);
      } else {
        await sendPaymentReminders(undefined);
      }
    } catch (e) {
      console.error('  ❌ Payment reminder cron failed:', e);
    }
  }, { timezone: 'Asia/Phnom_Penh' });

  console.log(`  ⏰ Daily payment reminder cron scheduled (${timeStr} Cambodia time)`);
}

function authMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided. Login first.' });
  }
  try {
    req.user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    // Allow super-admins to dynamically switch tenant context via X-Tenant-Id header or ?tenantId= query param
    if (req.user?.role === 'super-admin') {
      const customTenant = req.headers['x-tenant-id'] || req.query.tenantId;
      if (customTenant && customTenant !== 'all') {
        const parsedTid = parseInt(String(customTenant), 10);
        if (!isNaN(parsedTid)) {
          req.user.tenant_id = parsedTid;
          req.selectedTenantId = parsedTid;
        }
      } else if (customTenant === 'all') {
        req.selectedTenantId = 'all';
      }
    }
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

// Role guard — must run AFTER authMiddleware
function requireRole(...roles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
}

// Tenant guard — extracts tenant_id from JWT and attaches to req
// Must run AFTER authMiddleware for protected routes
function tenantMiddleware(req: any, res: any, next: any) {
  // Skip for auth endpoints (login, register, OTP, etc.)
  if (req.path.startsWith('/api/auth/')) return next();
  // Skip for diag
  if (req.path === '/api/diag') return next();
  // Skip for support
  if (req.path === '/api/support/message') return next();
  // Skip for SMS send (uses its own config lookup)
  if (req.path === '/api/sms/send') return next();
  
  if (!req.user) return next();
  
  const tenantId = req.user.tenant_id;
  if (!tenantId) {
    return res.status(403).json({ error: 'No tenant context. Please log in again.' });
  }
  
  req.tenantId = tenantId;
  next();
}

// Super-admin tenant guard — allows super-admins to access all tenants
function requireSuperAdminOrTenant(req: any, res: any, next: any) {
  if (req.user?.role === 'super-admin') {
    // Super-admin can override tenant via query param (for tenant switching)
    req.tenantId = parseInt(req.query.tenantId as string) || req.user.tenant_id;
    return next();
  }
  req.tenantId = req.user?.tenant_id;
  next();
}

function normalizeEmail(raw: string): string {
  return String(raw || '').trim().toLowerCase();
}

// ── AUTH ROUTES ────────────────────────────────────────────

function generateToken(user: { id: number; email: string; name: string; role: string; tenant_id: number; }) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role, tenant_id: user.tenant_id }, JWT_SECRET, { expiresIn: '24h' });
}

// Login with email + password (bcrypt verified against database)
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const loginIdentifier = req.body.email; // holds email or phone number
    const { password } = req.body;
    if (!loginIdentifier || !password) {
      return res.status(400).json({ error: 'Identifier and password are required.' });
    }

    let dbUser: any = null;
    if (loginIdentifier.includes('@')) {
      const { data } = await db.from('nexus_users').select('*').eq('email', normalizeEmail(loginIdentifier)).maybeSingle();
      dbUser = data;
    } else {
      // First check if it matches a phone number
      let normalizedPhone = loginIdentifier.replace(/\D/g, '');
      if (normalizedPhone.startsWith('0')) {
        normalizedPhone = '855' + normalizedPhone.substring(1);
      }
      if (!normalizedPhone.startsWith('855') && normalizedPhone.length <= 9 && normalizedPhone.length > 0) {
        normalizedPhone = '855' + normalizedPhone;
      }
      const finalPhone = '+' + normalizedPhone;
      const { data: phoneUser } = await db.from('nexus_users').select('*').eq('phone', finalPhone).maybeSingle();
      if (phoneUser) {
        dbUser = phoneUser;
      } else {
        // Fallback: match by username / name (case-insensitive)
        const { data: nameUser } = await db.from('nexus_users').select('*').ilike('name', loginIdentifier.trim()).maybeSingle();
        dbUser = nameUser;
      }
    }

    if (!dbUser) {
      return res.status(401).json({ error: 'Invalid username/email/phone or password.' });
    }

    const isValid = await bcrypt.compare(password, dbUser.password || '');
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (dbUser.email_verified === false) {
      return res.status(403).json({
        error: 'Account not verified. Please complete your OTP verification to activate your account.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    const token = generateToken({ id: dbUser.id, email: dbUser.email, name: dbUser.name, role: dbUser.role, tenant_id: dbUser.tenant_id });
    logAudit('login', `User ${dbUser.email} logged in`, { id: dbUser.id, email: dbUser.email, name: dbUser.name, role: dbUser.role, tenant_id: dbUser.tenant_id });
    res.json({ token, user: { id: dbUser.id, name: dbUser.name, email: dbUser.email, role: dbUser.role, tenant_id: dbUser.tenant_id } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Session exchange for users authenticated via an external provider (e.g. Google OAuth)
app.post('/api/auth/session', authLimiter, async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    let { data: dbUser } = await db.from('nexus_users').select('*').eq('email', email).maybeSingle();
    if (!dbUser) {
      // Assign to default tenant (id=1)
      const { data: newUser } = await db.from('nexus_users').insert({
        name: name || email.split('@')[0],
        email, role: 'customer', phone: '',
        tenant_id: 1,
      }).select().single();
      dbUser = newUser;
    }

    const token = generateToken({ id: dbUser!.id, email: dbUser!.email, name: dbUser!.name, role: dbUser!.role, tenant_id: dbUser!.tenant_id || 1 });
    res.json({ token, user: { id: dbUser!.id, name: dbUser!.name, email: dbUser!.email, role: dbUser!.role, tenant_id: dbUser!.tenant_id || 1 } });
  } catch (err) {
    console.error('Session exchange error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Send a verification code to the user's email (register, forgot password, password change)
app.post('/api/auth/send-otp', authLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const { data: user } = await db.from('nexus_users').select('id, name, email').eq('email', email).maybeSingle();
    if (!user) return res.status(404).json({ error: 'No account found with this email.' });

    const result = await createOtpForUser(email);
    if (!result.success) return res.status(500).json({ error: result.error || 'Failed to send the verification code.' });

    logAudit('otp-sent', `Verification code sent to ${email}`, { id: user.id, email: user.email, name: user.name, role: '' });
    res.json({ message: 'Verification code sent to your email.' });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Verify the code sent to the user's email
app.post('/api/auth/verify-otp', authLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Email and code are required.' });

    const result = await verifyOtpForUser(email, String(code).trim());
    if (!result.success) return res.status(400).json({ error: result.error || 'Invalid or expired code.' });

    // Mark the email as verified — unlocks login for newly registered accounts
    await db.from('nexus_users').update({ email_verified: true }).eq('email', email);

    const { data: user } = await db.from('nexus_users').select('id, name, email, role').eq('email', email).maybeSingle();
    if (user) logAudit('otp-verified', `Code verified for ${email}`, { id: user.id, email: user.email, name: user.name, role: user.role });
    res.json({ message: 'Code verified successfully.' });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Helper to normalize phone digits suffix
function normalizePhoneInput(phone: string): string {
  let normalized = phone.replace(/\D/g, '');
  if (normalized.startsWith('0')) {
    normalized = '855' + normalized.substring(1);
  }
  if (!normalized.startsWith('855') && normalized.length <= 9) {
    normalized = '855' + normalized;
  }
  return '+' + normalized;
}

// Check if a phone number is linked to Telegram
app.get('/api/auth/check-link', async (req, res) => {
  try {
    const { phone, userId } = req.query;
    if (!phone && !userId) return res.status(400).json({ error: 'Phone or userId query param is required.' });
    
    let user;
    if (phone) {
      const finalPhone = normalizePhoneInput(String(phone));
      const { data } = await db.from('nexus_users').select('id, telegram_chat_id, email, name, role').eq('phone', finalPhone).maybeSingle();
      user = data;
    } else {
      const { data } = await db.from('nexus_users').select('id, telegram_chat_id, email, name, role').eq('id', Number(userId)).maybeSingle();
      user = data;
    }
    
    const linked = !!user?.telegram_chat_id;

    if (linked && userId && user) {
      const token = generateToken({ id: user.id, email: user.email, name: user.name, role: user.role, tenant_id: user.tenant_id || 1 });
      return res.json({ linked: true, token });
    }

    res.json({ linked });
  } catch (err) {
    console.error('Check link error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Send OTP
const sendOtpHandler = async (req: express.Request, res: express.Response) => {
  try {
    const { phone_number, channel } = req.body;
    if (!phone_number) {
      return res.status(400).json({ status: 'error', message: 'Phone number is required.' });
    }
    
    const finalPhone = normalizePhoneInput(phone_number);
    const { data: user } = await db.from('nexus_users').select('id, name, email, telegram_chat_id').eq('phone', finalPhone).maybeSingle();
    
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'No account found with this phone number. Please register on the website first.' });
    }
    
    const activeChannel = channel || 'telegram';
    if (activeChannel === 'telegram' && !user.telegram_chat_id) {
      return res.status(400).json({ status: 'error', message: 'Your phone number is not linked to Telegram yet. Please open our Telegram bot first.' });
    }
    
    // Generate a 6-digit numeric OTP code
    const code = String(crypto.randomInt(100000, 1000000));
    const hashed = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    
    // Update db with hashed otp
    await db.from('nexus_users')
      .update({ otp_code: hashed, otp_expires_at: expiresAt, otp_verified_at: null })
      .eq('id', user.id);
      
    // Send via channel
    if (activeChannel === 'telegram' && user.telegram_chat_id) {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (token) {
        try {
          const TelegramBot = (await import('node-telegram-bot-api')).default;
          const tempBot = new TelegramBot(token, { polling: false });
          await withTimeout(tempBot.sendMessage(user.telegram_chat_id, `🔐 *NexusFinance Verification Code*\n\nYour code is: *${code}*\n\nDo not share this code with anyone. It expires in 5 minutes.`, { parse_mode: 'Markdown' }), 2500);
        } catch (botErr) {
          console.error('Failed to send Telegram OTP code:', botErr);
        }
      }
    } else {
      // SMS channel (Twilio fallback/sandbox log)
      try {
        const { data: smsConfig } = await db.from('nexus_config').select('*').eq('tenant_id', 1).maybeSingle();
        await withTimeout(sendSMS(finalPhone, `Your NexusFinance verification code is: ${code}. It expires in 5 minutes.`, smsConfig), 2500);
      } catch (smsErr) {
        console.error('Failed to send SMS OTP code:', smsErr);
      }
    }
    
    const sessionId = 'otp_sess_' + crypto.randomBytes(6).toString('hex');
    otpSessions.set(sessionId, {
      phone: finalPhone,
      expiresAt: Date.now() + 5 * 60 * 1000,
      attempts: 0
    });
    
    res.json({
      status: 'success',
      message: 'OTP sent successfully',
      data: {
        session_id: sessionId,
        expires_in: 300
      }
    });
  } catch (err) {
    console.error('Send OTP handler error:', err);
    res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

app.post('/v1/auth/otp/send', authLimiter, sendOtpHandler);
app.post('/api/v1/auth/otp/send', authLimiter, sendOtpHandler);
app.post('/api/auth/otp/send', authLimiter, sendOtpHandler);

// Verify OTP
const verifyOtpHandler = async (req: express.Request, res: express.Response) => {
  try {
    const { phone_number, session_id, code } = req.body;
    if (!phone_number || !code) {
      return res.status(400).json({ status: 'error', message: 'phone_number and code are required.' });
    }
    
    const finalPhone = normalizePhoneInput(phone_number);
    
    if (session_id) {
      const session = otpSessions.get(session_id);
      if (!session) {
        return res.status(400).json({ status: 'error', message: 'Invalid or expired session ID.' });
      }
      if (session.phone !== finalPhone) {
        return res.status(400).json({ status: 'error', message: 'Phone number does not match this session.' });
      }
      if (Date.now() > session.expiresAt) {
        otpSessions.delete(session_id);
        return res.status(400).json({ status: 'error', message: 'Verification session has expired.' });
      }
      if (session.attempts >= 3) {
        otpSessions.delete(session_id);
        return res.status(400).json({ status: 'error', message: 'Too many invalid attempts. Session locked.' });
      }
    }
    
    const { data: user } = await db.from('nexus_users')
      .select('id, name, email, role, otp_code, otp_expires_at')
      .eq('phone', finalPhone)
      .maybeSingle();
      
    if (!user || !user.otp_code) {
      return res.status(400).json({ status: 'error', message: 'Invalid or expired verification session.' });
    }
    if (new Date(user.otp_expires_at).getTime() < Date.now()) {
      return res.status(400).json({ status: 'error', message: 'Verification code has expired.' });
    }
    
    const matches = await bcrypt.compare(String(code).trim(), user.otp_code);
    if (!matches) {
      if (session_id) {
        const session = otpSessions.get(session_id);
        if (session) session.attempts += 1;
      }
      return res.status(400).json({ status: 'error', message: 'Incorrect verification code.' });
    }
    
    // Success: activate account
    await db.from('nexus_users').update({
      email_verified: true,
      otp_code: null,
      otp_expires_at: null,
      otp_verified_at: new Date().toISOString()
    }).eq('id', user.id);
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    otpSessions.delete(session_id);
    logAudit('otp-verified', `Phone verified via Telegram OTP for ${user.email}`, { id: user.id, email: user.email, name: user.name, role: user.role });
    
    res.json({
      status: 'success',
      message: 'OTP verified successfully',
      data: {
        verified: true,
        auth_token: token
      }
    });
  } catch (err) {
    console.error('Verify OTP handler error:', err);
    res.status(500).json({ status: 'error', message: 'Internal server error.' });
  }
};

app.post('/v1/auth/otp/verify', authLimiter, verifyOtpHandler);
app.post('/api/v1/auth/otp/verify', authLimiter, verifyOtpHandler);
app.post('/api/auth/otp/verify', authLimiter, verifyOtpHandler);

// ── Phone-based OTP (parallel to email OTP) ──────────────────────

app.post('/api/auth/send-otp-phone', authLimiter, async (req, res) => {
  try {
    const phone = normalizePhoneInput(req.body.phone);
    if (!phone) return res.status(400).json({ error: 'Phone number is required.' });

    const result = await createOtpForUserByPhone(phone);
    if (!result.success) return res.status(400).json({ error: result.error });

    logAudit('otp-sent', `Verification code sent to phone ${phone}`, {});
    res.json({ message: 'Verification code sent.', telegramSent: result.telegramSent, smsSent: result.smsSent });
  } catch (err) {
    console.error('Send phone OTP error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/api/auth/verify-otp-phone', authLimiter, async (req, res) => {
  try {
    const phone = normalizePhoneInput(req.body.phone);
    const { code } = req.body;
    if (!phone || !code) return res.status(400).json({ error: 'Phone and code are required.' });

    const result = await verifyOtpForUserByPhone(phone, String(code).trim());
    if (!result.success) return res.status(400).json({ error: result.error || 'Invalid or expired code.' });

    const { data: user } = await db.from('nexus_users').select('id, name, email, role').eq('phone', phone).maybeSingle();
    if (user) logAudit('otp-verified', `Phone OTP verified for ${phone}`, { id: user.id, email: user.email, name: user.name, role: user.role });
    res.json({ message: 'Code verified successfully.' });
  } catch (err) {
    console.error('Verify phone OTP error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Self-service password reset (called after OTP verification on forgot password)
app.post('/api/auth/update-password', authLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const phone = req.body.phone ? normalizePhoneInput(req.body.phone) : null;
    const { newPassword } = req.body;
    if ((!email && !phone) || !newPassword) {
      return res.status(400).json({ error: 'email or phone and newPassword are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // Phone-based path
    if (phone && !email) {
      const { data: user } = await db.from('nexus_users').select('id').eq('phone', phone).maybeSingle();
      if (!user) return res.status(404).json({ error: 'User not found.' });

      const verified = await requireOtpVerifiedByPhone(phone);
      if (!verified) return res.status(403).json({ error: 'Phone not verified. Request a new code and verify first.' });

      const bcryptHash = await bcrypt.hash(newPassword, 10);
      await db.from('nexus_users').update({ password: bcryptHash }).eq('phone', phone);
      await clearOtpVerifiedByPhone(phone);
      logAudit('password-reset', `Password reset via phone OTP for ${phone}`, { id: user.id, email: '', name: '', role: '' });
      return res.json({ message: 'Password updated successfully.' });
    }

    // Email-based path (existing)
    if (!email) return res.status(400).json({ error: 'email or phone and newPassword are required.' });
    const { data: user } = await db.from('nexus_users').select('id').eq('email', email).maybeSingle();
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const verified = await requireOtpVerified(email);
    if (!verified) return res.status(403).json({ error: 'Email not verified. Request a new code and verify first.' });

    const bcryptHash = await bcrypt.hash(newPassword, 10);
    await db.from('nexus_users').update({ password: bcryptHash }).eq('email', email);
    await clearOtpVerified(email);
    logAudit('password-reset', `Password reset via OTP for ${email}`, { id: user.id, email, name: '', role: '' });
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Password update error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Change password (authenticated user, after OTP verification on profile page)
app.patch('/api/auth/password', authMiddleware, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    const email = req.user.email;

    // Look up user to get phone number
    const { data: fullUser } = await db.from('nexus_users').select('id, phone').eq('id', req.user.id).maybeSingle();
    const phone = fullUser?.phone;

    // Phone-based path (for phone-only users with synthetic @nexus.local email)
    if (phone && email && email.endsWith('@nexus.local')) {
      const verified = await requireOtpVerifiedByPhone(phone);
      if (!verified) return res.status(403).json({ error: 'Phone not verified. Request a new code and verify first.' });

      const bcryptHash = await bcrypt.hash(newPassword, 10);
      await db.from('nexus_users').update({ password: bcryptHash }).eq('phone', phone);
      await clearOtpVerifiedByPhone(phone);
      logAudit('password-change', `${phone} changed their password via phone OTP`, req.user);
      return res.json({ message: 'Password updated successfully.' });
    }

    // Email-based path (existing)
    const verified = await requireOtpVerified(email);
    if (!verified) return res.status(403).json({ error: 'Email not verified. Request a new code and verify first.' });

    const bcryptHash = await bcrypt.hash(newPassword, 10);
    await db.from('nexus_users').update({ password: bcryptHash }).eq('email', email);
    await clearOtpVerified(email);
    logAudit('password-change', `${email} changed their password`, req.user);
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const { data: user } = await db.from('nexus_users').select('id, name, email, role, phone, tenant_id').eq('id', req.user.id).maybeSingle();
  if (!user) return res.status(404).json({ error: 'User not found.' });
  // Fetch tenant info
  const { data: tenant } = await db.from('nexus_tenants').select('name, slug, plan, logo_url').eq('id', user.tenant_id || 1).maybeSingle();
  res.json({
    ...user,
    tenant_name: tenant?.name || 'Default',
    tenant_slug: tenant?.slug || 'default',
    tenant_plan: tenant?.plan || 'founding',
    tenant_logo_url: tenant?.logo_url || null,
  });
});

app.patch('/api/auth/profile', authMiddleware, async (req, res) => {
  const { name, email, phone } = req.body;
  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = normalizeEmail(email);
  if (phone !== undefined) updates.phone = phone;
  if (updates.email) {
    const { data: existing } = await db.from('nexus_users').select('id').eq('email', updates.email).neq('id', req.user.id).single();
    if (existing) return res.status(400).json({ error: 'Email already in use.' });
  }
  const { data: updated } = await db.from('nexus_users').update(updates).eq('id', req.user.id).select('id, name, email, role, phone').single();
  if (!updated) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: updated });
});

// ── ACCOUNT DELETION (Apple App Store requirement) ────────

app.delete('/api/auth/account', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch user to confirm existence
    const { data: user, error: userErr } = await db.from('nexus_users').select('id, role').eq('id', userId).maybeSingle();
    if (userErr || !user) return res.status(404).json({ error: 'User not found.' });

    // Prevent deletion of super-admin accounts
    if (user.role === 'super-admin') {
      return res.status(403).json({ error: 'Super admin accounts cannot be deleted.' });
    }

    // Delete related data in order (foreign keys reference nexus_users)
    // 1. Documents (has ON DELETE CASCADE on FK)
    await db.from('nexus_documents').delete().eq('user_id', userId);

    // 2. Notifications
    await db.from('nexus_notifications').delete().eq('userId', userId);

    // 3. Audit logs
    await db.from('nexus_audit_logs').delete().eq('userId', userId);

    // 4. Payway transactions
    await db.from('nexus_payway_transactions').delete().eq('user_id', userId);

    // 5. Loans — set user_id to NULL instead of deleting (loans have financial records)
    await db.from('nexus_loans').update({ user_id: null }).eq('user_id', userId);

    // 6. Broadcasts sent_by — set to NULL
    await db.from('nexus_broadcasts').update({ sent_by: null }).eq('sent_by', userId);

    // 7. Finally delete the user account
    const { error: delErr } = await db.from('nexus_users').delete().eq('id', userId);
    if (delErr) {
      console.error('Account deletion failed:', delErr);
      return res.status(500).json({ error: 'Failed to delete account.' });
    }

    logAudit('account_deleted', `User ${userId} deleted their account`, req.user);
    res.json({ success: true, message: 'Account deleted successfully.' });
  } catch (e) {
    console.error('Account deletion error:', e);
    res.status(500).json({ error: 'Server error during account deletion.' });
  }
});

// ── PHONE CHANGE REQUEST ─────────────────────────────────

app.post('/api/auth/phone-change-request', authMiddleware, async (req, res) => {
  try {
    const { newPhone } = req.body;
    if (!newPhone) return res.status(400).json({ error: 'New phone number is required.' });

    // Validate phone format
    if (!/^\+\d{9,15}$/.test(newPhone)) {
      return res.status(400).json({ error: 'Phone must start with + and be 9-15 digits (e.g. +85581968581).' });
    }

    // Get current user
    const { data: user } = await db.from('nexus_users').select('id, phone').eq('id', req.user.id).single();
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Check if same phone
    if (user.phone === newPhone) {
      return res.status(400).json({ error: 'This is already your current phone number.' });
    }

    // Check if phone already belongs to another account
    const { data: existing } = await db.from('nexus_users').select('id').eq('phone', newPhone).neq('id', req.user.id).single();
    if (existing) {
      return res.status(400).json({ error: 'This phone number is already linked to another account.' });
    }

    // Return deep link for Telegram bot (format: /start phonechange_{userId}_{phone})
    const deepLink = `https://t.me/nexusfinancefintech_bot?start=phonechange_${user.id}_${encodeURIComponent(newPhone)}`;
    res.json({ deepLink, newPhone });
  } catch (e) {
    console.error('Phone change request error:', e);
    res.status(500).json({ error: 'Server error.' });
  }
});

app.get('/api/auth/phone-change-status', authMiddleware, async (req, res) => {
  try {
    const { data: user } = await db.from('nexus_users').select('phone').eq('id', req.user.id).single();
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ phone: user.phone });
  } catch {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── FORGOT PASSWORD ──────────────────────────────────────

app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const { data: dbUser } = await db.from('nexus_users').select('id, name, email').eq('email', email).maybeSingle();
    if (dbUser) {
      const tmpl = emailTemplates.passwordReset(dbUser.name, dbUser.email);
      sendEmail(dbUser.email, tmpl.subject, tmpl.html).catch((err) => console.error('Failed to send forgot password email:', err));
      logAudit('password-reset-request', `Reset email sent to ${email}`, { id: dbUser.id, email: dbUser.email, name: '', role: 'customer' });
    }

    res.json({ message: 'If an account exists with this email, a password reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/api/auth/forgot-password-phone', authLimiter, async (req, res) => {
  try {
    const phone = normalizePhoneInput(req.body.phone);
    if (!phone) return res.status(400).json({ error: 'Phone number is required.' });

    const { data: dbUser } = await db.from('nexus_users').select('id, phone, telegram_chat_id').eq('phone', phone).maybeSingle();
    if (dbUser) {
      const result = await createOtpForUserByPhone(phone);
      if (result.success) {
        logAudit('password-reset-request', `Reset code sent to phone ${phone}`, { id: dbUser.id, email: '', name: '', role: 'customer' });
      }
    }

    res.json({ message: 'If an account exists with this phone number, a verification code has been sent.' });
  } catch (err) {
    console.error('Forgot password phone error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GOOGLE OAUTH ROUTES ──────────────────────────────────────

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'https://nexusfinance-lof3.onrender.com/api/auth/google/callback';
const FRONTEND_URL = process.env.CORS_ORIGIN || 'https://nexusfinancefintech.vercel.app';

// Step 1: Redirect user to Google consent screen
app.get('/api/auth/google', (req, res) => {
  if (!GOOGLE_CLIENT_ID) return res.status(500).json({ error: 'Google OAuth not configured.' });

  const state = crypto.randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_CALLBACK_URL,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  // Store state in a cookie for CSRF protection (simple approach)
  res.cookie('google_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60000 });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// Step 2: Handle Google callback
app.get('/api/auth/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const savedState = req.cookies?.google_oauth_state;

    // Basic state validation
    if (state && savedState && state !== savedState) {
      return res.redirect(`${FRONTEND_URL}?error=invalid_state`);
    }

    if (!code) return res.redirect(`${FRONTEND_URL}?error=no_code`);

    // Exchange authorization code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        redirect_uri: GOOGLE_CALLBACK_URL,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokens.access_token) return res.redirect(`${FRONTEND_URL}?error=token_exchange_failed`);

    // Fetch user info from Google
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const googleUser = await userRes.json();

    if (!googleUser.email) return res.redirect(`${FRONTEND_URL}?error=no_email`);

    const gEmail = normalizeEmail(googleUser.email);

    // Find or create user in database
    let { data: dbUser } = await db.from('nexus_users').select('*').eq('email', gEmail).maybeSingle();
    if (!dbUser) {
      const { data: newUser } = await db.from('nexus_users').insert({
        name: googleUser.name || gEmail.split('@')[0],
        email: gEmail,
        role: 'customer',
      phone: '',
      email_verified: true,
      tenant_id: 1,
      }).select().single();
      dbUser = newUser;
    }

    // Generate JWT
    const token = jwt.sign(
      { id: dbUser!.id, email: dbUser!.email, name: dbUser!.name, role: dbUser!.role, tenant_id: dbUser!.tenant_id || 1 },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Redirect back to frontend with token
    res.redirect(`${FRONTEND_URL}?google_token=${token}`);
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    res.redirect(`${FRONTEND_URL}?error=oauth_failed`);
  }
});

// ── SMS ROUTES ───────────────────────────────────────────────

app.post('/api/sms/send', authMiddleware, async (req, res) => {
  const { to, text } = req.body;
  if (!to || !text) return res.status(400).json({ error: 'Phone number and text are required.' });
  const { data: config } = await db.from('nexus_config').select('*').eq('tenant_id', req.user?.tenant_id || 1).maybeSingle();
  const result = await sendSMS(to, text, config);
  if (result.success) {
    await logAudit('sms_sent', `SMS sent to ${to}`, req.user);
    res.json(result);
  } else {
    res.status(500).json(result);
  }
});

// ── LOAN ROUTES ─────────────────────────────────────────────

app.get('/api/loans/:id/schedule', authMiddleware, async (req, res) => {
  try {
    const { data: installments, error } = await db
      .from('nexus_installments')
      .select('*')
      .eq('loan_id', req.params.id)
      .order('installment_no', { ascending: true });
      
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    res.json(installments || []);
  } catch (err: any) {
    console.error('Fetch schedule error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.get('/api/loans', authMiddleware, async (req: any, res) => {
  let query = db.from('nexus_loans').select('*');
  // Scope by tenant (super-admin can select specific tenant or view 'all')
  if (req.user.role === 'super-admin' && req.selectedTenantId === 'all') {
    // Show all loans across all tenants
  } else if (req.user.role === 'super-admin' && req.selectedTenantId) {
    query = query.eq('tenant_id', req.selectedTenantId);
  } else if (req.user.role === 'super-admin' && req.query.tenantId) {
    query = query.eq('tenant_id', parseInt(req.query.tenantId as string));
  } else {
    query = query.eq('tenant_id', req.user.tenant_id || 1);
  }
  if (req.user.role === 'customer') {
    query = query.eq('user_id', req.user.id);
  }
  const { data: loans } = await query.order('date', { ascending: false });

  // Calculate dynamic repayment metrics for active/approved loans
  const loansWithRepayments = await Promise.all((loans || []).map(async (loan) => {
    const isApproved = ['approved', 'Approved', 'active', 'Active', 'disbursed', 'Disbursed'].includes(loan.status);
    if (!isApproved) return loan;

    const amount = Number(loan.amount) || 0;
    const duration = Number(loan.durationMonths) || 1;
    const monthly = calculateMonthlyPayment(amount, duration);
    
    // installment dates
    const start = new Date(loan.date);
    const installments: Date[] = [];
    for (let m = 1; m <= duration; m++) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + m);
      installments.push(d);
    }

    // calculate due status
    let overdueCount = 0;
    let nextDue: Date | null = null;
    for (const d of installments) {
      // Calculate days until
      const diffTime = d.getTime() - new Date().getTime();
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (days < 0) {
        overdueCount++;
      } else if (nextDue === null && days <= 7) {
        nextDue = d;
      }
    }
    if (!nextDue) {
      const diffTimes = installments.map(d => d.getTime() - new Date().getTime());
      const futureIdx = diffTimes.findIndex(t => t >= 0);
      nextDue = futureIdx >= 0 ? installments[futureIdx] : installments[installments.length - 1];
    }

    return {
      ...loan,
      monthlyPayment: monthly,
      overdueCount,
      nextPaymentDate: nextDue ? nextDue.toISOString() : null,
      repaymentStatus: overdueCount > 0 ? 'Overdue' : 'On Time'
    };
  }));

  res.json(loansWithRepayments);
});

app.post('/api/loans', authMiddleware, async (req, res) => {
  const { applicantName, applicantEmail, initials, amount, type, purpose, creditScore, monthlyIncome, durationMonths } = req.body;
  const loanId = '#77' + Math.floor(1000 + Math.random() * 9000);

  const { data: config } = await db.from('nexus_config').select('*').eq('tenant_id', req.user.tenant_id || 1).maybeSingle();
  const maxLoanAmount = config ? config.maxLoanAmount : 500000;

  const loanAmount = amount || 2500;
  if (loanAmount > maxLoanAmount) {
    return res.status(400).json({ error: `Requested loan amount exceeds platform limit of $${maxLoanAmount.toLocaleString()}` });
  }

  const { data: newLoan } = await db.from('nexus_loans').insert({
    id: loanId,
    user_id: req.user.id,
    tenant_id: req.user.tenant_id || 1,
    applicantName: applicantName || req.user.name,
    applicantEmail: applicantEmail || req.user.email,
    initials: initials || req.user.name.split(' ').map(n => n[0]).join('').toUpperCase(),
    amount: loanAmount,
    type: type || 'Personal',
    status: 'New',
    urgency: 'Normal',
    assignedTo: null,
    date: new Date().toISOString().split('T')[0],
    purpose: purpose || 'Not specified',
    creditScore: creditScore || 700,
    monthlyIncome: monthlyIncome || 4000,
    durationMonths: durationMonths || 24,
  }).select().single();

  const taskTypes = ['KYC Verification Call', 'Credit Score Audit', 'Collateral Registry Verification'];
  const allowedTasks = (config?.kycRequired !== false)
    ? taskTypes 
    : taskTypes.filter(t => t !== 'KYC Verification Call');
  
  const { data: existingTasks } = await db.from('nexus_tasks').select('id').eq('tenant_id', req.user.tenant_id || 1);
  await db.from('nexus_tasks').insert({
    id: 't' + Date.now().toString().slice(-6),
    title: allowedTasks[(existingTasks?.length || 0) % allowedTasks.length],
    applicant: newLoan.applicantName,
    regarding: `${newLoan.type} Loan ${newLoan.id}`,
    time: new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Phnom_Penh', hour: '2-digit', minute: '2-digit', hour12: false }),
    completed: false,
    tenant_id: req.user.tenant_id || 1,
  });

  dispatchWebhook('loan.created', { loanId: newLoan.id, applicant: newLoan.applicantName, amount: newLoan.amount, type: newLoan.type });

  notifyAdminOfNewLoan(newLoan).catch((err) => console.error('Failed to notify admin of new loan:', err));
  res.status(201).json(newLoan);
});

app.patch('/api/loans/:id/approve', authMiddleware, requireRole('loan-officer', 'admin', 'super-admin'), async (req, res) => {
  const { data: loan } = await db.from('nexus_loans').select('*').eq('id', req.params.id).single();
  if (!loan) return res.status(404).json({ error: 'Loan not found.' });

  await db.from('nexus_loans').update({ status: 'Approved', assignedTo: req.user.id }).eq('id', req.params.id);
  logAudit('loan-approved', `Loan ${loan.id} (${loan.type}) for ${loan.applicantName} approved`, req.user);

  // Generate and insert pre-calculated database repayment installments (Method A)
  try {
    const term = loan.durationMonths || 12;
    const defaultMonthlyRepayment = (loan.amount / term) + (loan.amount * 0.015);
    const monthlyPayment = loan.monthlyPayment || defaultMonthlyRepayment;
    const interestPerMonth = Math.round((loan.amount * 0.015) * 100) / 100;
    const principalPerMonth = Math.round((loan.amount / term) * 100) / 100;
    
    const loanDate = new Date(loan.date || Date.now());
    const installmentsToInsert = [];
    let balance = loan.amount;
    
    for (let i = 1; i <= term; i++) {
      let currentPrincipal = principalPerMonth;
      if (i === term) {
        currentPrincipal = Math.round(balance * 100) / 100;
      }
      const currentPayment = currentPrincipal + interestPerMonth;
      balance -= currentPrincipal;
      if (balance < 0.01) balance = 0;
      
      const dueDate = new Date(loanDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      
      installmentsToInsert.push({
        loan_id: loan.id,
        installment_no: i,
        due_date: dueDate.toISOString(),
        principal_amount: currentPrincipal,
        interest_amount: interestPerMonth,
        total_payment: currentPayment,
        remaining_balance: balance,
        status: 'unpaid',
        tenant_id: loan.tenant_id || req.user.tenant_id || 1,
      });
    }
    
    const { error: insErr } = await db.from('nexus_installments').insert(installmentsToInsert);
    if (insErr) {
      console.warn('Warning: Failed to insert installments into public.nexus_installments. Make sure the table was created.', insErr.message);
    }
  } catch (calcErr) {
    console.error('Failed to calculate/insert installments:', calcErr);
  }

  const { data: applicantUser } = await db.from('nexus_users').select('id, name, email').eq('email', loan.applicantEmail).single();
  if (applicantUser) {
    await db.from('nexus_transactions').insert({
      id: 'tx_fst' + Date.now().toString().slice(-6),
      title: 'Loan Disbursement',
      date: new Date().toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' }),
      amount: loan.amount,
      type: 'Loan Disbursement',
      userId: applicantUser.id,
      tenant_id: loan.tenant_id || req.user.tenant_id || 1,
    });
    notifyUser(applicantUser.id, `Your loan ${loan.id} has been approved — $${loan.amount.toLocaleString()} disbursed.`);
    const tmpl = emailTemplates.loanApproved(applicantUser.name, loan.id, loan.amount);
    sendEmail(applicantUser.email, tmpl.subject, tmpl.html).catch((err) => console.error('Failed to send approval email:', err));
  }
  dispatchWebhook('loan.approved', { loanId: loan.id, applicant: loan.applicantName, amount: loan.amount, type: loan.type });
  res.json({ ...loan, status: 'Approved', assignedTo: req.user.id });
});

app.patch('/api/loans/:id/reject', authMiddleware, requireRole('loan-officer', 'admin', 'super-admin'), async (req, res) => {
  const { data: loan } = await db.from('nexus_loans').select('*').eq('id', req.params.id).single();
  if (!loan) return res.status(404).json({ error: 'Loan not found.' });
  await db.from('nexus_loans').update({ status: 'Rejected' }).eq('id', req.params.id);
  logAudit('loan-rejected', `Loan ${loan.id} (${loan.type}) for ${loan.applicantName} rejected`, req.user);
  const { data: applicantUser } = await db.from('nexus_users').select('id, name, email').eq('email', loan.applicantEmail).single();
  if (applicantUser) {
    notifyUser(applicantUser.id, `Your loan ${loan.id} application has been rejected.`);
    const tmpl = emailTemplates.loanRejected(applicantUser.name, loan.id);
    sendEmail(applicantUser.email, tmpl.subject, tmpl.html).catch((err) => console.error('Failed to send rejection email:', err));
  }
  dispatchWebhook('loan.rejected', { loanId: loan.id, applicant: loan.applicantName, type: loan.type });
  res.json({ ...loan, status: 'Rejected' });
});

app.patch('/api/loans/:id/hold', authMiddleware, requireRole('loan-officer', 'admin', 'super-admin'), async (req, res) => {
  const { data: loan } = await db.from('nexus_loans').select('*').eq('id', req.params.id).single();
  if (!loan) return res.status(404).json({ error: 'Loan not found.' });
  await db.from('nexus_loans').update({ status: 'Hold' }).eq('id', req.params.id);
  logAudit('loan-held', `Loan ${loan.id} (${loan.type}) for ${loan.applicantName} put on hold`, req.user);
  res.json({ ...loan, status: 'Hold' });
});

// ── TRANSACTION ROUTES ──────────────────────────────────────

app.get('/api/transactions', authMiddleware, async (req, res) => {
  const { data: txs } = await db.from('nexus_transactions').select('*').eq('userId', req.user.id).eq('tenant_id', req.user.tenant_id || 1).order('id', { ascending: false });
  res.json(txs || []);
});

app.post('/api/transactions/repay', authMiddleware, async (req, res) => {
  const { amount } = req.body;
  const newTx = {
    id: 'tx_pyp' + Date.now().toString().slice(-6),
    title: 'Repayment',
    date: new Date().toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' }),
    amount: -Math.abs(amount),
    type: 'Repayment',
    userId: req.user.id,
    tenant_id: req.user.tenant_id || 1,
  };
  const { data: tx } = await db.from('nexus_transactions').insert(newTx).select().single();
  res.status(201).json(tx);
});

app.post('/api/transactions/disburse', authMiddleware, async (req, res) => {
  const { amount } = req.body;
  const newTx = {
    id: 'tx_fst' + Date.now().toString().slice(-6),
    title: 'Loan Disbursement',
    date: new Date().toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' }),
    amount: Math.abs(amount),
    type: 'Loan Disbursement',
    userId: req.user.id,
    tenant_id: req.user.tenant_id || 1,
  };
  const { data: tx } = await db.from('nexus_transactions').insert(newTx).select().single();
  res.status(201).json(tx);
});

// ── TASK ROUTES ─────────────────────────────────────────────

app.get('/api/tasks', authMiddleware, requireRole('loan-officer', 'admin', 'super-admin'), async (req, res) => {
  const tenantId = req.user.tenant_id || 1;
  const { data: tasks } = await db.from('nexus_tasks').select('*').eq('tenant_id', tenantId);
  res.json(tasks || []);
});

app.patch('/api/tasks/:id/complete', authMiddleware, async (req, res) => {
  const { data: task } = await db.from('nexus_tasks').select('*').eq('id', req.params.id).single();
  if (!task) return res.status(404).json({ error: 'Task not found.' });

  await db.from('nexus_tasks').update({ completed: true }).eq('id', req.params.id);

  if (task.regarding) {
    const loanId = task.regarding.split(' ').pop();
    if (loanId?.startsWith('#')) {
      const { data: loan } = await db.from('nexus_loans').select('status').eq('id', loanId).single();
      if (loan && loan.status === 'New') {
        await db.from('nexus_loans').update({ status: 'Review' }).eq('id', loanId);
      }
    }
  }

  res.json({ ...task, completed: true });
});

// ── USER MANAGEMENT (Super Admin) ──────────────────────────

app.get('/api/users', authMiddleware, async (req: any, res) => {
  if (req.user.role !== 'super-admin' && req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
  
  let query = db.from('nexus_users').select('id, name, email, role, phone, telegram_chat_id, tenant_id');
  if (req.user.role === 'super-admin' && req.selectedTenantId === 'all') {
    // Show all users across all organizations
  } else if (req.user.role === 'super-admin' && req.selectedTenantId) {
    query = query.eq('tenant_id', req.selectedTenantId);
  } else if (req.user.role === 'super-admin' && req.query.tenantId) {
    query = query.eq('tenant_id', parseInt(req.query.tenantId as string));
  } else {
    query = query.eq('tenant_id', req.user.tenant_id || 1);
  }

  const { data: users, error } = await query.order('id', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(users || []);
});

// Admin creates user directly under an organization
app.post('/api/users', authMiddleware, requireRole('super-admin', 'admin'), async (req: any, res) => {
  try {
    const { name, email, password, phone, role, tenant_id } = req.body;
    if (!name || !password) {
      return res.status(400).json({ error: 'Name and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const assignedRole = role || 'loan-officer';
    const allowedRoles = ['customer', 'loan-officer', 'admin'];
    if (req.user.role === 'super-admin') allowedRoles.push('super-admin');
    if (!allowedRoles.includes(assignedRole)) {
      return res.status(400).json({ error: 'Invalid or unauthorized role.' });
    }

    let targetTenantId = req.user.tenant_id || 1;
    if (req.user.role === 'super-admin' && tenant_id) {
      targetTenantId = parseInt(tenant_id) || targetTenantId;
    }

    // If email is provided, normalize it; otherwise leave as null
    let finalEmail: string | null = null;
    if (email && email.trim()) {
      finalEmail = normalizeEmail(email);
      const { data: existing } = await db.from('nexus_users').select('id').eq('email', finalEmail).maybeSingle();
      if (existing) {
        return res.status(400).json({ error: 'An account with this email already exists.' });
      }
    }

    // Format phone if provided
    let finalPhone: string | null = null;
    if (phone && phone.trim()) {
      let normalizedPhone = phone.replace(/\D/g, '');
      if (normalizedPhone.startsWith('0')) {
        normalizedPhone = '855' + normalizedPhone.substring(1);
      }
      if (!normalizedPhone.startsWith('855') && normalizedPhone.length <= 9) {
        normalizedPhone = '855' + normalizedPhone;
      }
      finalPhone = '+' + normalizedPhone;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const { data: newUser, error: insertError } = await db.from('nexus_users').insert({
      name,
      email: finalEmail,
      password: hashedPassword,
      phone: finalPhone,
      role: assignedRole,
      tenant_id: targetTenantId,
      email_verified: true, // Created by admin, ready to login
    }).select('id, name, email, role, phone, tenant_id').single();

    if (insertError || !newUser) {
      return res.status(500).json({ error: insertError?.message || 'Failed to create user.' });
    }

    logAudit('user-created-by-admin', `User ${name} (${finalEmail}) created with role ${assignedRole} under tenant #${targetTenantId}`, req.user);
    res.status(201).json(newUser);
  } catch (err: any) {
    console.error('Create user error:', err);
    res.status(500).json({ error: err.message || 'Internal server error.' });
  }
});

app.patch('/api/users/:id/role', authMiddleware, async (req, res) => {
  if (req.user.role !== 'super-admin' && req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
  const allowedRoles = ['customer', 'loan-officer', 'admin', 'super-admin'];
  if (!allowedRoles.includes(req.body.role)) return res.status(400).json({ error: 'Invalid role.' });
  const { data: user } = await db.from('nexus_users').select('id, name, email').eq('id', parseInt(req.params.id)).single();
  if (!user) return res.status(404).json({ error: 'User not found.' });
  await db.from('nexus_users').update({ role: req.body.role }).eq('id', user.id);
  logAudit('role-changed', `${user.name} (${user.email}) role changed to ${req.body.role}`, req.user);
  notifyUser(user.id, `Your role has been updated to ${req.body.role.replace('-', ' ')}.`);
  const tmpl = emailTemplates.roleChanged(user.name, req.body.role);
  sendEmail(user.email, tmpl.subject, tmpl.html).catch((err) => console.error('Failed to send role changed email:', err));
  res.json({ id: user.id, ...req.body });
});

app.patch('/api/users/:id/reset-password', authMiddleware, async (req, res) => {
  if (req.user.role !== 'super-admin' && req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  const { data: user } = await db.from('nexus_users').select('id, name, email').eq('id', parseInt(req.params.id)).single();
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const bcryptHash = await bcrypt.hash(password, 10);
  await db.from('nexus_users').update({ password: bcryptHash }).eq('id', user.id);
  logAudit('password-reset', `${user.name} (${user.email}) password reset by admin`, req.user);
  notifyUser(user.id, 'Your password has been reset by an administrator.');
  res.json({ message: 'Password reset successfully.' });
});

app.patch('/api/users/:id/tenant', authMiddleware, requireRole('super-admin'), async (req, res) => {
  const { tenant_id } = req.body;
  const tid = parseInt(tenant_id);
  if (isNaN(tid)) return res.status(400).json({ error: 'Valid tenant_id is required.' });

  const { data: tenant } = await db.from('nexus_tenants').select('id, name').eq('id', tid).maybeSingle();
  if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });

  const { data: user } = await db.from('nexus_users').select('id, name, email, tenant_id').eq('id', parseInt(req.params.id)).single();
  if (!user) return res.status(404).json({ error: 'User not found.' });

  await db.from('nexus_users').update({ tenant_id: tid }).eq('id', user.id);
  logAudit('user-tenant-reassigned', `${user.name} (${user.email}) moved to organization "${tenant.name}" (#${tid})`, req.user);
  notifyUser(user.id, `You have been reassigned to organization "${tenant.name}".`);
  res.json({ id: user.id, tenant_id: tid, tenant_name: tenant.name });
});

// ── CONFIG ROUTES (Super Admin) ─────────────────────────────

app.get('/api/config', authMiddleware, async (req, res) => {
  const tenantId = req.user?.tenant_id || 1;
  const { data: config } = await db.from('nexus_config').select('*').eq('tenant_id', tenantId).maybeSingle();
  
  // Read plan pricing from root tenant 1's config
  let pricingConfig = { plan_basic_price: 49, plan_standard_price: 149, plan_premium_price: 349 };
  try {
    const { data: rootTenant } = await db.from('nexus_tenants').select('config').eq('id', 1).maybeSingle();
    if (rootTenant?.config) {
      if (rootTenant.config.plan_basic_price !== undefined) pricingConfig.plan_basic_price = rootTenant.config.plan_basic_price;
      if (rootTenant.config.plan_standard_price !== undefined) pricingConfig.plan_standard_price = rootTenant.config.plan_standard_price;
      if (rootTenant.config.plan_premium_price !== undefined) pricingConfig.plan_premium_price = rootTenant.config.plan_premium_price;
    }
  } catch { /* fallback */ }

  res.json({ ...(config || {}), ...pricingConfig });
});

const handleUpdateConfig = async (req: any, res: any) => {
  if (req.user.role !== 'super-admin' && req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
  const tenantId = req.user.tenant_id || 1;
  
  const { data: currentConfig } = await db.from('nexus_config').select('*').eq('tenant_id', tenantId).maybeSingle();
  const updatePayload: any = { tenant_id: tenantId };
  for (const key of Object.keys(req.body)) {
    if (currentConfig && key in currentConfig) {
      updatePayload[key] = req.body[key];
    }
  }

  // Handle plan pricing update (persisted into root tenant 1 JSONB config)
  const { plan_basic_price, plan_standard_price, plan_premium_price } = req.body;
  if (plan_basic_price !== undefined || plan_standard_price !== undefined || plan_premium_price !== undefined) {
    try {
      const { data: rootTenant } = await db.from('nexus_tenants').select('config').eq('id', 1).maybeSingle();
      const tenantCfg = rootTenant?.config || {};
      if (plan_basic_price !== undefined) tenantCfg.plan_basic_price = Number(plan_basic_price);
      if (plan_standard_price !== undefined) tenantCfg.plan_standard_price = Number(plan_standard_price);
      if (plan_premium_price !== undefined) tenantCfg.plan_premium_price = Number(plan_premium_price);
      await db.from('nexus_tenants').update({ config: tenantCfg }).eq('id', 1);
    } catch (e) {
      console.error('Error updating plan pricing in tenant 1:', e);
    }
  }

  const { error } = await db.from('nexus_config').update(updatePayload).eq('tenant_id', tenantId);
  if (error) {
    console.error('Error updating config:', error);
    return res.status(500).json({ error: error.message });
  }

  const changeDetails: any = {};
  for (const key of Object.keys(updatePayload)) {
    if (key === 'tenant_id') continue;
    changeDetails[key] = {
      from: currentConfig ? currentConfig[key] : null,
      to: updatePayload[key]
    };
  }

  logAudit('config-updated', `Platform config updated: ${JSON.stringify(changeDetails)}`, req.user);
  const { data: config } = await db.from('nexus_config').select('*').eq('tenant_id', tenantId).maybeSingle();
  if (config && config.reminder_time) {
    scheduleReminderCron(config.reminder_time);
  }

  // Return merged response including plan pricing
  let pricingConfig = { plan_basic_price: 49, plan_standard_price: 149, plan_premium_price: 349 };
  try {
    const { data: rootTenant } = await db.from('nexus_tenants').select('config').eq('id', 1).maybeSingle();
    if (rootTenant?.config) {
      if (rootTenant.config.plan_basic_price !== undefined) pricingConfig.plan_basic_price = rootTenant.config.plan_basic_price;
      if (rootTenant.config.plan_standard_price !== undefined) pricingConfig.plan_standard_price = rootTenant.config.plan_standard_price;
      if (rootTenant.config.plan_premium_price !== undefined) pricingConfig.plan_premium_price = rootTenant.config.plan_premium_price;
    }
  } catch { /* fallback */ }

  res.json({ ...(config || {}), ...pricingConfig });
};

app.patch('/api/config', authMiddleware, handleUpdateConfig);
app.post('/api/config', authMiddleware, handleUpdateConfig);

// ── REMINDER SETTINGS & BROADCASTS ROUTES (Super Admin & Loan Officers) ──

app.get('/api/reminder-settings', authMiddleware, async (req, res) => {
  const tenantId = req.user?.tenant_id || 1;
  const { data: settings } = await db
    .from('nexus_reminder_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('days_before', { ascending: false });
  res.json(settings || []);
});

app.post('/api/reminder-settings', authMiddleware, requireRole('super-admin', 'admin'), async (req, res) => {
  const { name, days_before, message_template, channel, is_active } = req.body;
  if (!name || message_template === undefined) {
    return res.status(400).json({ error: 'name and message_template are required.' });
  }
  const { data, error } = await db
    .from('nexus_reminder_settings')
    .insert({
      name,
      days_before: parseInt(days_before) || 0,
      message_template,
      channel: channel || 'both',
      is_active: is_active !== false,
      tenant_id: req.user.tenant_id || 1,
    })
    .select('*')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  logAudit('reminder-setting-created', `Created reminder: ${name} (${days_before} days)`, req.user);
  res.status(201).json(data);
});

app.patch('/api/reminder-settings/:id', authMiddleware, requireRole('loan-officer', 'admin', 'super-admin'), async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, days_before, message_template, channel, is_active } = req.body;

  const { data: currentReminder } = await db.from('nexus_reminder_settings').select('*').eq('id', id).single();

  const updateData: Record<string, any> = {};
  if (name !== undefined) updateData.name = name;
  if (days_before !== undefined) updateData.days_before = parseInt(days_before) || 0;
  if (message_template !== undefined) updateData.message_template = message_template;
  if (channel !== undefined) updateData.channel = channel;
  if (is_active !== undefined) updateData.is_active = is_active;
  updateData.updated_at = new Date().toISOString();

  const { data, error } = await db
    .from('nexus_reminder_settings')
    .update(updateData)
    .eq('id', id)
    .select('*')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const changeDetails: any = {};
  for (const key of Object.keys(updateData)) {
    if (key === 'updated_at') continue;
    changeDetails[key] = {
      from: currentReminder ? currentReminder[key] : null,
      to: updateData[key]
    };
  }

  logAudit('reminder-setting-updated', `Updated reminder ID ${id}: ${JSON.stringify(changeDetails)}`, req.user);
  res.json(data);
});

app.delete('/api/reminder-settings/:id', authMiddleware, requireRole('super-admin', 'admin'), async (req, res) => {
  const id = parseInt(req.params.id);
  const { error } = await db.from('nexus_reminder_settings').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  logAudit('reminder-setting-deleted', `Deleted reminder ID ${id}`, req.user);
  res.json({ ok: true });
});

app.get('/api/test-reminders', authMiddleware, requireRole('super-admin', 'admin'), async (req, res) => {
  console.log('  📬 Manual trigger of payment reminders sweep requested by:', req.user.email);
  try {
    const { sendPaymentReminders } = await import('./bot.js');
    await sendPaymentReminders(undefined);
    res.json({ success: true, message: 'Payment reminder sweep executed successfully.' });
  } catch (e: any) {
    console.error('  ❌ Manual trigger failed:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/reminder-logs', authMiddleware, async (req, res) => {
  const tenantId = req.user?.tenant_id || 1;
  const { data: logs } = await db
    .from('nexus_reminder_logs')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(100);
  res.json(logs || []);
});

// ── DELINQUENT DEBT & OVERDUE RECOVERY ENDPOINTS ──

app.get('/api/loans/overdue', authMiddleware, requireRole('loan-officer', 'admin', 'super-admin'), async (req, res) => {
  try {
    const tenantId = req.user.tenant_id || 1;
    const { data: config } = await db.from('nexus_config').select('*').eq('tenant_id', tenantId).maybeSingle();
    const gracePeriod = config?.grace_period_days !== undefined ? Number(config.grace_period_days) : 3;
    const latePenaltyDaily = config?.late_penalty_daily !== undefined ? Number(config.late_penalty_daily) : 0;

    const { data: loans, error } = await db
      .from('nexus_loans')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('status', ['approved', 'Approved', 'active', 'Active', 'disbursed', 'Disbursed'])
      .order('date', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const delinquentLoans: any[] = [];

    for (const loan of loans || []) {
      const amount = Number(loan.amount) || 0;
      const duration = Number(loan.durationMonths) || 1;
      const monthly = calculateMonthlyPayment(amount, duration);
      
      const start = new Date(loan.date);
      let worstDaysOverdue = 0;
      let oldestOverdueDate: Date | null = null;
      let overdueCount = 0;

      for (let m = 1; m <= duration; m++) {
        const d = new Date(start);
        d.setMonth(d.getMonth() + m);
        d.setHours(0, 0, 0, 0);

        const diffTime = d.getTime() - now.getTime();
        const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (days < 0) {
          overdueCount++;
          const daysLate = Math.abs(days);
          if (daysLate > worstDaysOverdue) {
            worstDaysOverdue = daysLate;
            oldestOverdueDate = d;
          }
        }
      }

      if (overdueCount > 0 && oldestOverdueDate) {
        // Fetch borrower contact & telegram info
        const { data: user } = await db
          .from('nexus_users')
          .select('id, name, email, phone, telegram_chat_id')
          .eq('email', loan.applicantEmail)
          .maybeSingle();

        const penaltyDays = Math.max(0, worstDaysOverdue - gracePeriod);
        const penaltyFee = penaltyDays * latePenaltyDaily;
        const totalDue = (monthly * overdueCount) + penaltyFee;

        let riskLevel: 'mild' | 'medium' | 'severe' = 'mild';
        if (worstDaysOverdue >= 30) riskLevel = 'severe';
        else if (worstDaysOverdue >= 15) riskLevel = 'medium';

        delinquentLoans.push({
          loanId: loan.id,
          applicantName: loan.applicantName,
          applicantEmail: loan.applicantEmail,
          phone: user?.phone || null,
          telegramLinked: !!user?.telegram_chat_id,
          telegramChatId: user?.telegram_chat_id || null,
          loanAmount: amount,
          loanType: loan.type,
          monthlyPayment: monthly,
          overdueInstallmentsCount: overdueCount,
          daysOverdue: worstDaysOverdue,
          oldestDueDate: oldestOverdueDate.toISOString(),
          penaltyFee,
          totalDue,
          riskLevel,
          gracePeriodDays: gracePeriod,
          latePenaltyDaily
        });
      }
    }

    // Sort by worst days overdue descending
    delinquentLoans.sort((a, b) => b.daysOverdue - a.daysOverdue);

    res.json({
      delinquentLoans,
      summary: {
        totalOverdueLoans: delinquentLoans.length,
        totalOverduePrincipal: delinquentLoans.reduce((sum, l) => sum + (l.monthlyPayment * l.overdueInstallmentsCount), 0),
        totalPenaltiesAccrued: delinquentLoans.reduce((sum, l) => sum + l.penaltyFee, 0),
        totalRecoverable: delinquentLoans.reduce((sum, l) => sum + l.totalDue, 0),
        mildCount: delinquentLoans.filter(l => l.riskLevel === 'mild').length,
        mediumCount: delinquentLoans.filter(l => l.riskLevel === 'medium').length,
        severeCount: delinquentLoans.filter(l => l.riskLevel === 'severe').length,
      }
    });
  } catch (err: any) {
    console.error('Error fetching overdue loans:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/loans/:id/nudge', authMiddleware, requireRole('loan-officer', 'admin', 'super-admin'), async (req, res) => {
  try {
    const loanId = req.params.id;
    const { channel = 'both' } = req.body;

    const { data: loan } = await db.from('nexus_loans').select('*').eq('id', loanId).single();
    if (!loan) return res.status(404).json({ error: 'Loan not found.' });

    const { data: user } = await db.from('nexus_users').select('id, name, email, phone, telegram_chat_id').eq('email', loan.applicantEmail).single();
    if (!user) return res.status(404).json({ error: 'Borrower user not found.' });

    const { data: config } = await db.from('nexus_config').select('*').eq('tenant_id', req.user.tenant_id || 1).maybeSingle();
    const gracePeriod = config?.grace_period_days !== undefined ? Number(config.grace_period_days) : 3;
    const latePenaltyDaily = config?.late_penalty_daily !== undefined ? Number(config.late_penalty_daily) : 0;

    const amount = Number(loan.amount) || 0;
    const duration = Number(loan.durationMonths) || 1;
    const monthly = calculateMonthlyPayment(amount, duration);
    const start = new Date(loan.date);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let worstDaysOverdue = 0;
    for (let m = 1; m <= duration; m++) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + m);
      d.setHours(0, 0, 0, 0);
      const diffTime = d.getTime() - now.getTime();
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (days < 0) {
        worstDaysOverdue = Math.max(worstDaysOverdue, Math.abs(days));
      }
    }

    const penaltyDays = Math.max(0, worstDaysOverdue - gracePeriod);
    const penaltyFee = penaltyDays * latePenaltyDaily;
    const totalDue = monthly + penaltyFee;

    const cleanId = String(loan.id).startsWith('#') ? String(loan.id).substring(1) : String(loan.id);
    const message = `⚠️ *URGENT PAYMENT NOTICE* — NexusFinance\n\nDear ${loan.applicantName},\nYour installment for Loan #${cleanId} is *${worstDaysOverdue} days overdue*.\n\n• Monthly Installment: *$${monthly.toFixed(0)}*\n• Late Penalty Fee: *$${penaltyFee.toFixed(0)}*\n• *Total Due: $${totalDue.toFixed(0)}*\n\nPlease settle your payment immediately to avoid further legal or credit score escalation.`;

    let sentTelegram = false;
    let sentInApp = false;

    if ((channel === 'telegram' || channel === 'both') && user.telegram_chat_id) {
      try {
        const { bot } = await import('./bot.js');
        if (bot) {
          await bot.sendMessage(user.telegram_chat_id, message, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '📱 Open NexusFinance & Pay KHQR', url: `https://nexusfinancefintech.vercel.app` }]] }
          });
          sentTelegram = true;
        }
      } catch (err) {
        console.error('Failed to send nudge via Telegram:', err);
      }
    }

    if (channel === 'in_app' || channel === 'both') {
      notifyUser(user.id, `URGENT: Your loan #${cleanId} is ${worstDaysOverdue} days overdue ($${totalDue.toFixed(0)} due).`, req.user.tenant_id || 1);
      sentInApp = true;
    }

    logAudit('loan-nudged', `Manual collection nudge sent to ${loan.applicantName} for loan ${loan.id} (${worstDaysOverdue}d late)`, req.user);
    res.json({ ok: true, sentTelegram, sentInApp, message: 'Collection reminder nudge dispatched.' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/broadcasts', authMiddleware, requireRole('loan-officer', 'admin', 'super-admin'), async (req, res) => {
  const tenantId = req.user.tenant_id || 1;
  const { data: broadcasts } = await db
    .from('nexus_broadcasts')
    .select('*, sender:sent_by(name, email)')
    .eq('tenant_id', tenantId)
    .order('id', { ascending: false });
  res.json(broadcasts || []);
});

app.post('/api/broadcasts', authMiddleware, requireRole('loan-officer', 'admin', 'super-admin'), async (req, res) => {
  const { message, channel, target } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required.' });

  const activeChannel = channel || 'both';
  const activeTarget = target || 'all';

  // 1. Fetch matching users (scoped to tenant)
  const tenantId = req.user.tenant_id || 1;
  let query = db.from('nexus_users').select('id, name, email, role, telegram_chat_id').eq('tenant_id', tenantId);
  if (activeTarget === 'linked') {
    query = query.not('telegram_chat_id', 'is', null);
  } else if (activeTarget.startsWith('role:')) {
    const roleName = activeTarget.split(':')[1];
    query = query.eq('role', roleName);
  } else if (activeTarget.startsWith('users:')) {
    const userIds = activeTarget.split(':')[1].split(',').map(Number).filter(n => !isNaN(n));
    query = query.in('id', userIds);
  } else if (activeTarget.startsWith('user:')) {
    const userId = Number(activeTarget.split(':')[1]);
    query = query.eq('id', userId);
  }
  const { data: targetUsers, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  let sentCount = 0;
  let failedCount = 0;

  const { default: botInstance } = await import('./bot.js');

  for (const user of targetUsers || []) {
    let success = false;

    // Send Telegram
    if ((activeChannel === 'telegram' || activeChannel === 'both') && user.telegram_chat_id) {
      try {
        if (botInstance) {
          await botInstance.sendMessage(user.telegram_chat_id, message, { parse_mode: 'Markdown' });
          success = true;
        }
      } catch (err) {
        console.error(`Broadcast Telegram send failed for user ${user.email}:`, err);
      }
    }

    // Send In-App
    if (activeChannel === 'in_app' || activeChannel === 'both') {
      try {
        notifyUser(user.id, message);
        success = true;
      } catch (err) {
        console.error(`Broadcast In-App send failed for user ${user.email}:`, err);
      }
    }

    if (success) sentCount++;
    else failedCount++;
  }

  // 2. Save broadcast record
  const { data: record, error: insertError } = await db
    .from('nexus_broadcasts')
    .insert({
      message,
      channel: activeChannel,
      target: activeTarget,
      sent_by: req.user.id,
      sent_count: sentCount,
      failed_count: failedCount,
      tenant_id: tenantId,
    })
    .select('*, sender:sent_by(name, email)')
    .single();

  if (insertError) return res.status(500).json({ error: insertError.message });
  logAudit('broadcast-sent', `Broadcast sent to ${activeTarget} via ${activeChannel} (Success: ${sentCount}, Fail: ${failedCount})`, req.user);
  res.status(201).json(record);
});

// ── STATS ROUTES ────────────────────────────────────────────

app.get('/api/stats', authMiddleware, requireRole('loan-officer', 'admin', 'super-admin'), async (req: any, res) => {
  const isAll = req.user.role === 'super-admin' && req.selectedTenantId === 'all';
  const tenantId = req.user.tenant_id || 1;

  // Fetch transactions
  let txsQuery = db.from('nexus_transactions').select('id, title, date, amount, type, userId, nexus_users(name, email, phone)');
  if (!isAll) txsQuery = txsQuery.eq('tenant_id', tenantId);
  const { data: txs } = await txsQuery.order('id', { ascending: false });

  // Fetch customers
  let custQuery = db.from('nexus_users').select('id, name, email, phone').eq('role', 'customer');
  if (!isAll) custQuery = custQuery.eq('tenant_id', tenantId);
  const { data: customers } = await custQuery.order('name', { ascending: true });

  const { data: config } = await db.from('nexus_config').select('baseInterestRate').eq('tenant_id', tenantId).maybeSingle();
  const rate = config ? Number(config.baseInterestRate) : 5.4;
  const rateMultiplier = rate / 100;

  // Process disbursements and repayments
  const volumeTransactions: any[] = [];
  const customerBalances: Record<number, { name: string; email: string; phone: string; balance: number }> = {};

  let totalDisbursed = 0;
  let totalRepaid = 0;

  for (const t of txs || []) {
    const amountVal = Math.abs(Number(t.amount));
    const u = (t as any).nexus_users || { name: 'Unknown', email: '', phone: '' };

    if (t.type === 'Loan Disbursement' || t.type === 'Repayment') {
      // Dynamically initialize user balance if not already present
      if (!customerBalances[t.userId]) {
        customerBalances[t.userId] = { name: u.name, email: u.email, phone: u.phone || '', balance: 0 };
      }

      if (t.type === 'Loan Disbursement') {
        volumeTransactions.push({
          id: t.id,
          title: t.title,
          date: t.date,
          amount: Number(t.amount),
          type: t.type,
          userName: u.name,
          userEmail: u.email,
          userPhone: u.phone || ''
        });
        totalDisbursed += amountVal;
        customerBalances[t.userId].balance += amountVal;
      } else {
        totalRepaid += amountVal;
        customerBalances[t.userId].balance -= amountVal;
      }
    }
  }

  const totalVolume = totalDisbursed;
  const outstandingBalanceValue = totalDisbursed - totalRepaid;
  const interestEarned = outstandingBalanceValue * rateMultiplier;

  // Outstanding customers (balance > 0)
  const outstandingCustomers = Object.values(customerBalances)
    .filter(c => c.balance > 0.01)
    .map(c => ({
      name: c.name,
      email: c.email,
      phone: c.phone,
      balance: c.balance
    }));

  // Yield customers
  const yieldCustomers = outstandingCustomers.map(c => ({
    name: c.name,
    email: c.email,
    balance: c.balance,
    rate: rate,
    annualYield: c.balance * rateMultiplier
  }));

  res.json({
    totalVolume,
    activeCustomers: customers?.length || 0,
    outstandingBalanceValue,
    interestEarned,
    volumeTransactions,
    customerList: customers || [],
    outstandingCustomers,
    yieldCustomers
  });
});

// ── NOTIFICATION ROUTES ────────────────────────────────────

app.get('/api/notifications', authMiddleware, async (req, res) => {
  const { data: notifs } = await db.from('nexus_notifications').select('*').eq('userId', req.user.id).order('id', { ascending: false }).limit(20);
  res.json(notifs || []);
});

app.patch('/api/notifications/:id/read', authMiddleware, async (req, res) => {
  await db.from('nexus_notifications').update({ unread: false }).eq('id', parseInt(req.params.id)).eq('userId', req.user.id);
  res.json({ ok: true });
});

// ── WEBHOOK SYSTEM ──────────────────────────────────────────

interface WebhookRegistration {
  id: number;
  userId: number;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: string;
}

let webhookIdCounter = 1;
// In production, store webhooks in nexus_webhooks table in Supabase.
// For simplicity, use in-memory storage that resets on server restart.
const webhooks: WebhookRegistration[] = [];

function generateWebhookSecret(): string {
  return crypto.randomBytes(24).toString('hex');
}

app.post('/api/webhooks/register', authMiddleware, async (req, res) => {
  const { url, events } = req.body;
  if (!url || !events?.length) return res.status(400).json({ error: 'url and events are required.' });
  const webhook: WebhookRegistration = {
    id: webhookIdCounter++,
    userId: req.user.id,
    url,
    events,
    secret: generateWebhookSecret(),
    active: true,
    createdAt: new Date().toISOString(),
  };
  webhooks.push(webhook);
  logAudit('webhook-registered', `Webhook registered for events: ${events.join(', ')} at ${url}`, req.user);
  res.status(201).json(webhook);
});

app.get('/api/webhooks', authMiddleware, async (req, res) => {
  const userWebhooks = webhooks.filter(w => w.userId === req.user.id || req.user.role === 'super-admin' || req.user.role === 'admin');
  res.json(userWebhooks.map(w => ({ ...w, secret: undefined })));
});

app.delete('/api/webhooks/:id', authMiddleware, async (req, res) => {
  const idx = webhooks.findIndex(w => w.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Webhook not found.' });
  if (webhooks[idx].userId !== req.user.id && req.user.role !== 'super-admin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied.' });
  }
  webhooks.splice(idx, 1);
  res.json({ message: 'Webhook deleted.' });
});

// Dispatch webhook events
async function dispatchWebhook(event: string, payload: Record<string, any>) {
  const targets = webhooks.filter(w => w.active && w.events.includes(event));
  for (const wh of targets) {
    const body = JSON.stringify({ event, timestamp: new Date().toISOString(), payload });
    const signature = crypto.createHmac('sha256', wh.secret).update(body).digest('hex');
    fetch(wh.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Nexus-Signature': signature, 'X-Nexus-Event': event },
      body,
    }).catch(() => {}); // fire-and-forget
  }
}

// ── SSE (Server-Sent Events) for real-time notifications ──

const sseClients = new Map<number, Set<any>>();

app.get('/api/notifications/stream', (req, res) => {
  const token = (req.query.token as string) || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided.' });
  let user: any;
  try { user = jwt.verify(token, JWT_SECRET); } catch { return res.status(403).json({ error: 'Invalid or expired token.' }); }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('data: {"type":"connected"}\n\n');

  if (!sseClients.has(user.id)) sseClients.set(user.id, new Set());
  sseClients.get(user.id)!.add(res);

  const keepAlive = setInterval(() => res.write(': keepalive\n\n'), 30000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.get(user.id)?.delete(res);
    if (sseClients.get(user.id)?.size === 0) sseClients.delete(user.id);
  });
});

// Notify SSE clients in real time
function notifyUserRealtime(userId: number, text: string) {
  const clients = sseClients.get(userId);
  if (clients) {
    const data = JSON.stringify({ type: 'notification', text, time: new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Phnom_Penh', hour: '2-digit', minute: '2-digit', hour12: false }) });
    for (const client of clients) {
      client.write(`data: ${data}\n\n`);
    }
  }
}

// Patch notifyUser to push via SSE in addition to DB
const _origNotifyUser = notifyUser;
notifyUser = (userId: number, text: string) => {
  _origNotifyUser(userId, text);
  notifyUserRealtime(userId, text);
};
setNotifyUserCallback(notifyUser);

app.get('/api/diag', async (req, res) => {
  const tenantId = req.user?.tenant_id || 1;
  const { data: config } = await db.from('nexus_config').select('*').eq('tenant_id', tenantId).maybeSingle();
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    localTime: new Date().toISOString(),
    configRecord: config || null
  });
});

// ── AUDIT LOG ROUTES (Super Admin) ─────────────────────────

app.get('/api/audit/logs', authMiddleware, async (req, res) => {
  if (req.user.role !== 'super-admin' && req.user.role !== 'admin') return res.json([]);
  const tenantId = req.user.tenant_id || 1;
  const { data: logs } = await db.from('nexus_audit_logs').select('*').eq('tenant_id', tenantId).order('id', { ascending: false }).limit(100);
  res.json(logs || []);
});

// ── REGISTER ROUTE ────────────────────────────────────────

// Register — creates the user in Supabase with bcrypt-hashed password
// (email verification via /api/auth/send-otp + /api/auth/verify-otp)
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { name, password } = req.body;
    const phone = req.body.phone || '';
    const tenantId = req.body.tenant_id || 1; // Default to tenant 1
    const { data: config } = await db.from('nexus_config').select('emailVerificationRequired').eq('tenant_id', tenantId).maybeSingle();
    const isEmailVerificationRequired = config ? config.emailVerificationRequired !== false : true;

    let email = req.body.email ? normalizeEmail(req.body.email) : '';
    if (isEmailVerificationRequired) {
      if (!email || !name || !password || !phone) {
        return res.status(400).json({ error: 'Name, email, password, and phone number are required.' });
      }
    } else {
      if (!name || !password) {
        return res.status(400).json({ error: 'Name and password are required.' });
      }
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    let finalEmail: string | null = null;
    if (email && email.trim()) {
      finalEmail = normalizeEmail(email);
      const { data: existing } = await db.from('nexus_users').select('id, email_verified').eq('email', finalEmail).maybeSingle();
      if (existing) {
        if (existing.email_verified === false) {
          // Silently delete the unverified stale registration
          await db.from('nexus_users').delete().eq('id', existing.id);
        } else {
          return res.status(400).json({ error: 'An account with this email already exists.' });
        }
      }
    }

    let finalPhone = '';
    if (phone) {
      let normalizedPhone = phone.replace(/\D/g, '');
      if (normalizedPhone.startsWith('0')) {
        normalizedPhone = '855' + normalizedPhone.substring(1);
      }
      if (!normalizedPhone.startsWith('855') && normalizedPhone.length <= 9) {
        normalizedPhone = '855' + normalizedPhone;
      }
      finalPhone = '+' + normalizedPhone;

      const { data: existingPhone } = await db.from('nexus_users').select('id, email_verified').eq('phone', finalPhone).maybeSingle();
      if (existingPhone) {
        if (existingPhone.email_verified === false) {
          // Silently delete the unverified stale registration
          await db.from('nexus_users').delete().eq('id', existingPhone.id);
        } else {
          return res.status(400).json({ error: 'An account with this phone number already exists.' });
        }
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data: newUser } = await db.from('nexus_users').insert({
      name,
      email: finalEmail,
      password: hashedPassword,
      role: 'customer',
      phone: finalPhone || null,
      email_verified: false,
      tenant_id: tenantId,
    }).select('id, name, email, role').single();
    if (!newUser) return res.status(500).json({ error: 'Failed to create account.' });

    res.status(201).json({ user: newUser });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── SEND PASSWORD RESET LINK (stub — logs to console) ──────

app.post('/api/users/:id/send-reset-link', authMiddleware, async (req, res) => {
  if (req.user.role !== 'super-admin' && req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
  const { data: user } = await db.from('nexus_users').select('id, name, email').eq('id', parseInt(req.params.id)).single();
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const tmpl = emailTemplates.passwordReset(user.name, user.email);
  await sendEmail(user.email, tmpl.subject, tmpl.html).catch((err) => console.error('Failed to send password reset email:', err));

  logAudit('password-reset-link', `Reset link sent to ${user.email}`, req.user);
  notifyUser(user.id, 'A password reset link has been sent to your email.');
  res.json({ message: 'Reset link sent successfully.' });
});

// ── DOCUMENT UPLOAD (KYC) ──────────────────────────────────

app.post('/api/documents/upload', authMiddleware, async (req, res) => {
  const { fileName, fileType, fileData, docCategory } = req.body;
  if (!fileName || !fileType || !fileData) {
    return res.status(400).json({ error: 'fileName, fileType, and fileData are required.' });
  }
  const { data: doc } = await db.from('nexus_documents').insert({
    userId: req.user.id,
    userEmail: req.user.email,
    fileName,
    fileType,
    fileData,
    docCategory: docCategory || 'other',
    uploadedAt: new Date().toISOString(),
  }).select().single();
  logAudit('document-uploaded', `${fileName} (${docCategory}) uploaded by ${req.user.email}`, req.user);
  res.status(201).json(doc);
});

app.get('/api/documents', authMiddleware, async (req, res) => {
  const { data: docs } = await db.from('nexus_documents').select('id, fileName, fileType, docCategory, uploadedAt, userEmail').eq('userId', req.user.id).order('id', { ascending: false });
  res.json(docs || []);
});

app.delete('/api/documents/:id', authMiddleware, async (req, res) => {
  const { data: doc } = await db.from('nexus_documents').select('userId').eq('id', parseInt(req.params.id)).single();
  if (!doc) return res.status(404).json({ error: 'Document not found.' });
  if (doc.userId !== req.user.id && req.user.role !== 'super-admin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied.' });
  }
  await db.from('nexus_documents').delete().eq('id', parseInt(req.params.id));
  res.json({ message: 'Document deleted.' });
});

app.get('/api/documents/:id/view', authMiddleware, async (req, res) => {
  const { data: doc } = await db.from('nexus_documents').select('*').eq('id', parseInt(req.params.id)).single();
  if (!doc) return res.status(404).json({ error: 'Document not found.' });
  if (doc.userId !== req.user.id && req.user.role !== 'super-admin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied.' });
  }
  const buf = Buffer.from(doc.fileData, 'base64');
  res.set('Content-Type', doc.fileType);
  res.set('Content-Disposition', `inline; filename="${doc.fileName}"`);
  res.send(buf);
});

// ── SUPPORT ROUTES ─────────────────────────────────────────

app.post('/api/support/message', authMiddleware, (req, res) => {
  const { name, email, message } = req.body;
  console.log(`\n  📧 Support message from ${name} (${email}):`);
  console.log(`  └─ ${message}`);
  res.json({ message: 'Message sent successfully. We will get back to you shortly.' });
});

// ── Global error handler ────────────────────────────────────

app.use((err: any, req: any, res: any, next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ── HEALTH CHECK ─────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ── KHQR Routes (available in all environments) ────────────
app.get('/api/khqr/generate', async (req, res) => {
  try {
    const { bakongAccountId, merchantName, merchantCity, currency, amount, countryCode, storeLabel, phone, email } = req.query;
    if (!bakongAccountId || !merchantName) {
      return res.status(400).json({ error: 'bakongAccountId and merchantName are required' });
    }
    const result = await generateKHQR({
      bakongAccountId: bakongAccountId as string,
      merchantName: merchantName as string,
      merchantCity: (merchantCity as string) || 'Phnom Penh',
      currency: (currency as '840' | '116') || '840',
      amount: amount ? parseFloat(amount as string) : undefined,
      storeLabel: storeLabel as string,
      phone: phone as string,
      email: email as string,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate KHQR' });
  }
});

app.get('/api/khqr/verify', (req, res) => {
  try {
    const { qr } = req.query;
    if (!qr) return res.status(400).json({ error: 'qr parameter is required' });
    const result = verifyKHQR(qr as string);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to verify KHQR' });
  }
});

app.get('/api/khqr/decode', (req, res) => {
  try {
    const { qr } = req.query;
    if (!qr) return res.status(400).json({ error: 'qr parameter is required' });
    const result = decodeKHQR(qr as string);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to decode KHQR' });
  }
});

app.get('/api/khqr/deeplink', (req, res) => {
  try {
    const { qr } = req.query;
    if (!qr) return res.status(400).json({ error: 'qr parameter is required' });
    const result = generateDeeplink(qr as string);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate deeplink' });
  }
});

app.get('/api/khqr/check-transaction', (req, res) => {
  try {
    const { referenceId } = req.query;
    if (!referenceId) return res.status(400).json({ error: 'referenceId is required' });
    const result = checkTransaction(referenceId as string);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to check transaction' });
  }
});

// ── PayWay QR Code Routes (persisted in Supabase) ──────────

// Record an approved payment: update the payway row, write to the ledger,
// notify the user via app + Telegram.
async function recordPaidPayment(tranId: string, apv?: string) {
  const { data: stored } = await db.from('nexus_payway_transactions').select('*').eq('tran_id', tranId).maybeSingle();
  if (!stored) {
    console.error(`recordPaidPayment: transaction ${tranId} not found`);
    return;
  }
  if (stored.status === 'APPROVED') return; // already recorded — no double-entry

  await db.from('nexus_payway_transactions')
    .update({ status: 'APPROVED', apv: apv || stored.apv, paid_at: new Date().toISOString() })
    .eq('tran_id', tranId);

  // Update public.nexus_installments tracking table for Method A
  if (stored.loan_id) {
    try {
      const { data: unpaidInstallment } = await db
        .from('nexus_installments')
        .select('*')
        .eq('loan_id', stored.loan_id)
        .eq('status', 'unpaid')
        .order('installment_no', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (unpaidInstallment) {
        await db
          .from('nexus_installments')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('id', unpaidInstallment.id);
        console.log(`Repayment installment #${unpaidInstallment.installment_no} for loan ${stored.loan_id} marked as paid`);
      }
    } catch (instErr) {
      console.error('Failed to update installment status:', instErr);
    }
  }

  const amount = Number(stored.amount) || 0;

  if (stored.email) {
    const { data: user } = await db.from('nexus_users').select('id, name, telegram_chat_id').eq('email', stored.email).maybeSingle();
    if (user) {
      await db.from('nexus_transactions').insert({
        id: 'tx_pw' + Date.now().toString().slice(-6),
        title: 'Repayment',
        date: new Date().toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' }),
        amount: -Math.abs(amount),
        type: 'Repayment',
        userId: user.id,
        tenant_id: stored.tenant_id || 1,
      });
      notifyUser(user.id, `Payment of $${amount.toLocaleString()} received. Thank you!`);
      if (user.telegram_chat_id) {
        try {
          const { sendPaymentConfirmation } = await import('./bot.js');
          await sendPaymentConfirmation(user.telegram_chat_id, {
            loanId: stored.loan_id || '',
            amount,
            tranId,
          });
        } catch (e) {
          console.error('Telegram payment confirmation failed:', e);
        }
      }
    }
  }

  logAudit('payment-approved', `PayWay payment ${tranId} approved ($${amount.toLocaleString()} ${stored.currency})`,
    { id: stored.user_id || 0, email: stored.email || '', name: '', role: '' });
  console.log(`PayWay payment recorded: ${tranId} → APPROVED ($${amount})`);
}

app.post('/api/payway/generate-qr', authMiddleware, async (req, res) => {
  try {
    const { amount, currency, loanId } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'amount is required and must be > 0' });
    }

    const email = req.user?.email || req.body.email || '';
    const firstname = req.user?.name ? req.user.name.split(' ')[0] : 'Nexus';
    const lastname = req.user?.name ? req.user.name.split(' ').slice(1).join(' ') : 'Customer';

    const tenantId = req.user?.tenant_id || 1;
    let tenantMerchantName = 'ndxdigitalsupport';
    let tenantPayWayCreds: { merchantId?: string; apiKey?: string } | undefined;
    try {
      const { data: tenant } = await db.from('nexus_tenants').select('merchant_name, name, bakong_account_id, config').eq('id', tenantId).maybeSingle();
      if (tenant) {
        tenantMerchantName = tenant.config?.merchant_name || tenant.merchant_name || tenant.name || tenantMerchantName;
        if (tenant.config?.payway_merchant_id || tenant.config?.payway_api_key) {
          tenantPayWayCreds = {
            merchantId: tenant.config.payway_merchant_id,
            apiKey: tenant.config.payway_api_key,
          };
        }
      }
    } catch { /* ignored */ }

    const frontendUrl = process.env.CORS_ORIGIN || 'https://nexusfinancefintech.vercel.app';
    const result = await payway.generateDynamicQR({
      amount,
      currency: currency || 'USD',
      email,
      firstname,
      lastname,
      loanId: loanId || '',
    }, frontendUrl, tenantPayWayCreds);

    const userEmail = email ? normalizeEmail(email) : null;
    let userId: number | null = null;
    if (userEmail) {
      const { data: u } = await db.from('nexus_users').select('id').eq('email', userEmail).maybeSingle();
      userId = u?.id ?? null;
    }

    try {
      await db.from('nexus_payway_transactions').insert({
        tran_id: result.tranId,
        email: userEmail,
        amount,
        currency: currency || 'USD',
        status: 'PENDING',
        loan_id: loanId ? String(loanId) : null,
        user_id: userId,
        tenant_id: tenantId,
      }).select().single();
    } catch (err) {
      console.error('PayWay insert failed:', err);
    }

    res.json({
      ...result,
      merchantName: tenantMerchantName,
    });
  } catch (err: any) {
    console.error('PayWay generateQR error:', err.message || err);
    res.status(500).json({ error: err.message || 'Failed to create payment' });
  }
});

app.post('/api/payway/verify-payment', async (req, res) => {
  try {
    const { tranId } = req.body;
    if (!tranId) return res.status(400).json({ error: 'tranId is required' });

    // Look up transaction to find associated tenant credentials
    let tenantPayWayCreds: { merchantId?: string; apiKey?: string } | undefined;
    try {
      const { data: storedTx } = await db.from('nexus_payway_transactions').select('tenant_id').eq('tran_id', tranId).maybeSingle();
      if (storedTx?.tenant_id) {
        const { data: tenant } = await db.from('nexus_tenants').select('config').eq('id', storedTx.tenant_id).maybeSingle();
        if (tenant?.config?.payway_merchant_id || tenant?.config?.payway_api_key) {
          tenantPayWayCreds = {
            merchantId: tenant.config.payway_merchant_id,
            apiKey: tenant.config.payway_api_key,
          };
        }
      }
    } catch { /* ignored */ }

    const result = await payway.checkTransaction(tranId, tenantPayWayCreds);

    if (result.status === 'APPROVED') {
      await recordPaidPayment(tranId, result.apv);
    }

    res.json(result);
  } catch (err: any) {
    console.error('PayWay verify error:', err.message || err);
    res.status(500).json({ error: err.message || 'Failed to verify payment' });
  }
});

app.post('/api/payway/callback', async (req, res) => {
  try {
    const signature = req.headers['x-payway-hmac-sha512'] as string || '';
    const body = JSON.stringify(req.body);

    const isValid = payway.verifyWebhook(body, signature);
    if (!isValid) {
      console.warn('PayWay callback: invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { tran_id, apv, status } = req.body;
    if (status === '0') {
      await recordPaidPayment(tran_id, apv);
    } else {
      await db.from('nexus_payway_transactions')
        .update({ status: 'DECLINED', apv })
        .eq('tran_id', tran_id)
        .then(null, (err) => console.error('PayWay decline update failed:', err));
      console.log(`PayWay callback: ${tran_id} → DECLINED`);
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('PayWay callback error:', err.message || err);
    res.status(500).json({ error: 'Callback processing failed' });
  }
});

// ── Purchase API (hosted checkout redirect) ─────────────────
app.post('/api/payway/purchase', async (req, res) => {
  try {
    const { amount, currency, email, loanId, firstname, lastname, phone } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'amount is required and must be > 0' });
    }

    const frontendUrl = process.env.CORS_ORIGIN || 'https://nexusfinancefintech.vercel.app';
    const result = payway.buildPurchaseRequest({
      amount,
      currency: currency || 'USD',
      email: email || '',
      firstname: firstname || '',
      lastname: lastname || '',
      phone: phone || '',
      loanId: loanId || '',
      items: [{ name: `Loan Repayment - ${loanId || 'N/A'}`, quantity: 1, price: amount }],
    }, frontendUrl);

    const userEmail = email ? normalizeEmail(email) : null;
    let userId: number | null = null;
    if (userEmail) {
      const { data: u } = await db.from('nexus_users').select('id').eq('email', userEmail).maybeSingle();
      userId = u?.id ?? null;
    }

    try {
      await db.from('nexus_payway_transactions').insert({
        tran_id: result.tranId,
        email: userEmail,
        amount,
        currency: currency || 'USD',
        status: 'PENDING',
        loan_id: loanId ? String(loanId) : null,
        user_id: userId,
        tenant_id: req.user?.tenant_id || 1,
      }).select().single();
    } catch (err) {
      console.error('PayWay purchase insert failed:', err);
    }

    res.json(result);
  } catch (err: any) {
    console.error('PayWay purchase error:', err.message || err);
    res.status(500).json({ error: err.message || 'Failed to create purchase' });
  }
});

app.get('/api/payway/return', async (req, res) => {
  try {
    const tranId = req.query.tran_id as string;
    const signature = req.query.hash as string || '';
    const frontendUrl = process.env.CORS_ORIGIN || 'https://nexusfinancefintech.vercel.app';

    if (tranId && signature) {
      const { data: stored } = await db.from('nexus_payway_transactions').select('*').eq('tran_id', tranId).maybeSingle();
      if (stored && stored.status !== 'APPROVED') {
        try {
          const result = await payway.checkTransaction(tranId);
          if (result.status === 'APPROVED') {
            await recordPaidPayment(tranId, result.apv);
          }
        } catch (err) {
          console.error('PayWay return verify failed:', err);
        }
      }
    }

    res.redirect(`${frontendUrl}/payment/success${tranId ? '?tran_id=' + encodeURIComponent(tranId) : ''}`);
  } catch (err: any) {
    const frontendUrl = process.env.CORS_ORIGIN || 'https://nexusfinancefintech.vercel.app';
    res.redirect(`${frontendUrl}/payment/success`);
  }
});

app.get('/api/payway/cancel', (req, res) => {
  const frontendUrl = process.env.CORS_ORIGIN || 'https://nexusfinancefintech.vercel.app';
  res.redirect(`${frontendUrl}/payment/cancel`);
});

// ── Simulate Payment (sandbox testing only) ────────────────
app.post('/api/payway/simulate-payment', async (req, res) => {
  try {
    const { tranId } = req.body;
    if (!tranId) return res.status(400).json({ error: 'tranId is required' });
    const { data: stored } = await db.from('nexus_payway_transactions').select('*').eq('tran_id', tranId).maybeSingle();
    if (!stored) return res.status(404).json({ error: 'Transaction not found' });

    const apv = Math.floor(100000 + Math.random() * 900000).toString();
    await recordPaidPayment(tranId, apv);
    console.log(`Simulated payment: ${tranId} → APPROVED`);

    res.json({ success: true, status: 'APPROVED', apv });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Simulation failed' });
  }
});

app.get('/api/payway/transactions', authMiddleware, async (req, res) => {
  try {
    const { data: txs } = await db.from('nexus_payway_transactions')
      .select('tran_id, email, amount, currency, status, apv, loan_id, created_at, paid_at')
      .eq('email', req.user.email)
      .order('id', { ascending: false })
      .limit(50);
    res.json(txs || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to load transactions' });
  }
});

// ── TENANT MANAGEMENT (Super Admin only) ──────────────────

// List tenants (super-admin gets all, tenant admin gets their own)
app.get('/api/tenants', authMiddleware, requireRole('super-admin', 'admin'), async (req, res) => {
  let query = db.from('nexus_tenants').select('*');
  if (req.user.role !== 'super-admin') {
    query = query.eq('id', req.user.tenant_id || 1);
  }
  const { data: tenants, error } = await query.order('id', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  const formatted = (tenants || []).map((t: any) => ({
    ...t,
    payment_provider: t.config?.payment_provider || (t.config?.payway_merchant_id ? 'aba_payway' : 'bakong'),
    bakong_account_id: t.config?.bakong_account_id || '',
    merchant_name: t.config?.merchant_name || '',
    payway_merchant_id: t.config?.payway_merchant_id || '',
    payway_api_key: t.config?.payway_api_key || '',
  }));
  res.json(formatted);
});

// Create a new tenant (super-admin only)
app.post('/api/tenants', authMiddleware, requireRole('super-admin'), async (req, res) => {
  const { name, slug, plan, max_users, max_loans, logo_url, payment_provider, bakong_account_id, merchant_name, payway_merchant_id, payway_api_key } = req.body;
  if (!name || !slug) return res.status(400).json({ error: 'name and slug are required.' });
  
  const { data: existing } = await db.from('nexus_tenants').select('id').eq('slug', slug).maybeSingle();
  if (existing) return res.status(400).json({ error: 'Slug already taken.' });

  const configData: any = {};
  if (payment_provider) configData.payment_provider = payment_provider;
  if (bakong_account_id) configData.bakong_account_id = bakong_account_id;
  if (merchant_name) configData.merchant_name = merchant_name;
  if (payway_merchant_id) configData.payway_merchant_id = payway_merchant_id;
  if (payway_api_key) configData.payway_api_key = payway_api_key;

  const insertData: any = {
    name,
    slug,
    plan: plan || 'basic',
    max_users: max_users || 50,
    max_loans: max_loans || 500,
    config: configData,
  };
  if (logo_url) insertData.logo_url = logo_url;

  const { data: tenant, error } = await db.from('nexus_tenants').insert(insertData).select().single();

  if (error) return res.status(500).json({ error: error.message });

  await db.from('nexus_config').insert({
    tenant_id: tenant.id,
    baseInterestRate: 5.4,
    maxLoanAmount: 500000,
    kycRequired: true,
    autoApproveLimit: 5000,
  });

  const defaultReminders = [
    { name: '7 Days Before', days_before: 7, message_template: 'Reminder: Your loan installment is due in 7 days.', channel: 'both', is_active: true, tenant_id: tenant.id },
    { name: '3 Days Before', days_before: 3, message_template: 'Reminder: Your loan installment is due in 3 days.', channel: 'both', is_active: true, tenant_id: tenant.id },
    { name: '1 Day Before', days_before: 1, message_template: 'Reminder: Your loan installment is due tomorrow.', channel: 'both', is_active: true, tenant_id: tenant.id },
    { name: 'Due Today', days_before: 0, message_template: 'Your loan installment is due today.', channel: 'both', is_active: true, tenant_id: tenant.id },
  ];
  await db.from('nexus_reminder_settings').insert(defaultReminders);

  logAudit('tenant-created', `Tenant "${name}" (${slug}) created`, req.user);
  res.status(201).json({
    ...tenant,
    payment_provider: tenant.config?.payment_provider || 'bakong',
    bakong_account_id: tenant.config?.bakong_account_id || '',
    merchant_name: tenant.config?.merchant_name || '',
    payway_merchant_id: tenant.config?.payway_merchant_id || '',
    payway_api_key: tenant.config?.payway_api_key || '',
  });
});

// Get tenant details (super-admin or tenant admin)
app.get('/api/tenants/:id', authMiddleware, requireRole('super-admin', 'admin'), async (req, res) => {
  const tenantId = parseInt(req.params.id);
  if (req.user.role !== 'super-admin' && req.user.tenant_id !== tenantId) {
    return res.status(403).json({ error: 'Access denied.' });
  }
  const { data: tenant, error } = await db.from('nexus_tenants').select('*').eq('id', tenantId).maybeSingle();
  if (error || !tenant) return res.status(404).json({ error: 'Tenant not found.' });
  res.json({
    ...tenant,
    payment_provider: tenant.config?.payment_provider || (tenant.config?.payway_merchant_id ? 'aba_payway' : 'bakong'),
    bakong_account_id: tenant.config?.bakong_account_id || '',
    merchant_name: tenant.config?.merchant_name || '',
    payway_merchant_id: tenant.config?.payway_merchant_id || '',
    payway_api_key: tenant.config?.payway_api_key || '',
  });
});

// Update tenant (super-admin or tenant admin for their own organization)
app.patch('/api/tenants/:id', authMiddleware, requireRole('super-admin', 'admin'), async (req, res) => {
  const tenantId = parseInt(req.params.id);
  const isSuperAdmin = req.user.role === 'super-admin';
  
  if (!isSuperAdmin && req.user.tenant_id !== tenantId) {
    return res.status(403).json({ error: 'You can only update your own organization.' });
  }

  const { name, slug, plan, max_users, max_loans, is_active, logo_url, payment_provider, bakong_account_id, merchant_name, payway_merchant_id, payway_api_key } = req.body;
  
  // Fetch existing tenant to preserve existing config
  const { data: existingTenant } = await db.from('nexus_tenants').select('config').eq('id', tenantId).maybeSingle();
  const existingConfig = existingTenant?.config || {};

  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (logo_url !== undefined) updateData.logo_url = logo_url;

  // payment_provider, bakong_account_id, merchant_name, payway_merchant_id, payway_api_key stored in JSONB config
  let configUpdated = false;
  const newConfig = { ...existingConfig };
  if (payment_provider !== undefined) {
    newConfig.payment_provider = payment_provider;
    configUpdated = true;
  }
  if (bakong_account_id !== undefined) {
    newConfig.bakong_account_id = bakong_account_id;
    configUpdated = true;
  }
  if (merchant_name !== undefined) {
    newConfig.merchant_name = merchant_name;
    configUpdated = true;
  }
  if (payway_merchant_id !== undefined) {
    newConfig.payway_merchant_id = payway_merchant_id;
    configUpdated = true;
  }
  if (payway_api_key !== undefined) {
    newConfig.payway_api_key = payway_api_key;
    configUpdated = true;
  }
  if (configUpdated) {
    updateData.config = newConfig;
  }

  // Plan and limit controls restricted to super-admin
  if (isSuperAdmin) {
    if (slug !== undefined) updateData.slug = slug;
    if (plan !== undefined) updateData.plan = plan;
    if (max_users !== undefined) updateData.max_users = max_users;
    if (max_loans !== undefined) updateData.max_loans = max_loans;
    if (is_active !== undefined) updateData.is_active = is_active;
  }
  updateData.updated_at = new Date().toISOString();

  const { data: tenant, error } = await db.from('nexus_tenants').update(updateData).eq('id', tenantId).select().single();
  if (error) return res.status(500).json({ error: error.message });
  
  logAudit('tenant-updated', `Tenant ${tenantId} updated: ${JSON.stringify(updateData)}`, req.user);
  res.json({
    ...tenant,
    bakong_account_id: tenant.config?.bakong_account_id || '',
    merchant_name: tenant.config?.merchant_name || '',
    payway_merchant_id: tenant.config?.payway_merchant_id || '',
    payway_api_key: tenant.config?.payway_api_key || '',
  });
});

// Delete / Suspend / Purge tenant (super-admin only)
app.delete('/api/tenants/:id', authMiddleware, requireRole('super-admin'), async (req, res) => {
  const tenantId = parseInt(req.params.id);
  if (tenantId === 1) return res.status(400).json({ error: 'Cannot delete or suspend the default organization.' });

  const isPurge = req.query.purge === 'true';

  if (isPurge) {
    // Check if there are active loans or users
    const [loansCheck, usersCheck] = await Promise.all([
      db.from('nexus_loans').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      db.from('nexus_users').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    ]);

    if ((loansCheck.count || 0) > 0) {
      return res.status(400).json({
        error: `Cannot permanently delete this subscriber because it has ${loansCheck.count} active loans on record. Please suspend it instead.`
      });
    }

    try {
      // Clean up linked settings & configurations first
      await Promise.all([
        db.from('nexus_reminder_settings').delete().eq('tenant_id', tenantId),
        db.from('nexus_config').delete().eq('tenant_id', tenantId),
        db.from('nexus_payway_transactions').delete().eq('tenant_id', tenantId),
        db.from('nexus_users').delete().eq('tenant_id', tenantId),
      ]);

      const { error } = await db.from('nexus_tenants').delete().eq('id', tenantId);
      if (error) return res.status(500).json({ error: error.message });

      logAudit('tenant-deleted-permanently', `Subscriber ${tenantId} permanently deleted`, req.user);
      return res.json({ ok: true, message: 'Subscriber permanently deleted.' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to delete subscriber' });
    }
  }

  // Soft suspension
  const { error } = await db.from('nexus_tenants').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', tenantId);
  if (error) return res.status(500).json({ error: error.message });

  logAudit('tenant-suspended', `Subscriber ${tenantId} suspended`, req.user);
  res.json({ ok: true, message: 'Subscriber suspended.' });
});

// Reactivate a suspended subscriber
app.post('/api/tenants/:id/reactivate', authMiddleware, requireRole('super-admin'), async (req, res) => {
  const tenantId = parseInt(req.params.id);
  const { error } = await db.from('nexus_tenants').update({ is_active: true, updated_at: new Date().toISOString() }).eq('id', tenantId);
  if (error) return res.status(500).json({ error: error.message });

  logAudit('tenant-reactivated', `Subscriber ${tenantId} reactivated`, req.user);
  res.json({ ok: true, message: 'Subscriber reactivated successfully.' });
});

// Get tenant stats (super-admin only)
app.get('/api/tenants/:id/stats', authMiddleware, requireRole('super-admin'), async (req, res) => {
  const tenantId = parseInt(req.params.id);
  
  const [usersResult, loansResult, txResult] = await Promise.all([
    db.from('nexus_users').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    db.from('nexus_loans').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    db.from('nexus_transactions').select('amount').eq('tenant_id', tenantId),
  ]);

  const totalVolume = (txResult.data || []).reduce((sum: number, tx: any) => sum + Math.abs(Number(tx.amount) || 0), 0);

  res.json({
    tenant_id: tenantId,
    total_users: usersResult.count || 0,
    total_loans: loansResult.count || 0,
    total_volume: totalVolume,
  });
});

// ── PRODUCTION: serve frontend build ─────────────────────────

if (process.env.NODE_ENV === 'production') {
  const distDir = path.join(process.cwd(), 'dist');

  // ── SPA catch-all ────────────────────────────────────────────
  app.use(express.static(distDir));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
    } else {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.type('html').send(fs.readFileSync(indexPath, 'utf-8'));
      } else {
        res.status(404).send('Not found');
      }
    }
  });
}

// Amortization math helpers for Repayment Schedule calculations
function calculateMonthlyPayment(amount: number, durationMonths: number, annualRate = 0.054): number {
  if (durationMonths <= 0) return amount;
  const r = annualRate / 12;
  const n = durationMonths;
  if (r === 0) return amount / n;
  return (amount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function formatMessageToHtml(msg: string): string {
  return msg
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}

function withTimeout<T>(promise: Promise<T>, ms = 2500): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Network request timeout')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

app.post('/api/loans/:id/chase', authMiddleware, requireRole('loan-officer', 'admin', 'super-admin'), async (req, res) => {
  const { id } = req.params;
  const cleanId = id.startsWith('#') ? id : '#' + id;
  const { data: loan } = await db.from('nexus_loans').select('*').eq('id', cleanId).maybeSingle();
  
  if (!loan) {
    return res.status(404).json({ error: 'Loan application not found.' });
  }

  // Fetch target customer
  const { data: user } = await db.from('nexus_users').select('*').eq('email', loan.applicantEmail).maybeSingle();
  if (!user) {
    return res.status(404).json({ error: 'Applicant customer account not found.' });
  }

  const amount = Number(loan.amount) || 0;
  const duration = Number(loan.durationMonths) || 1;
  const monthly = calculateMonthlyPayment(amount, duration);

  const { message: customMessage } = req.body;
  const message = customMessage || `⚠️ *URGENT PAYMENT REMINDER* ⚠️\n\nDear *${loan.applicantName}*,\n\nOur records show that your monthly installment of *$${monthly.toFixed(2)}* is currently overdue for Loan *${loan.id}*.\n\nPlease log in to the portal and settle your outstanding payment immediately.\n\n🔗 [Pay Outstanding Balance](https://nexusfinancefintech.vercel.app/)`;

  let sentTelegram = false;
  let sentSMS = false;
  let sentEmail = false;

  const subject = `🚨 OVERDUE NOTICE: Loan Payment Outstanding - Loan #${loan.id}`;
  const htmlContent = formatMessageToHtml(message);
  const plainText = message.replace(/\*(.*?)\*/g, '$1');

  await Promise.allSettled([
    // 1. Telegram
    (async () => {
      if (user.telegram_chat_id && bot) {
        try {
          await withTimeout(bot.sendMessage(user.telegram_chat_id, message, { parse_mode: 'Markdown' }));
          sentTelegram = true;
        } catch (e) {
          console.error('Failed to send Telegram chase notice:', e);
        }
      }
    })(),
    // 2. Email
    (async () => {
      try {
        await withTimeout(sendEmail(loan.applicantEmail, subject, `
          <div style="font-family: sans-serif; padding: 20px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #ef4444; margin-top: 0;">🚨 Urgent: Payment Overdue Notice</h2>
            <p style="line-height: 1.6; font-size: 14px;">${htmlContent}</p>
            <div style="margin: 25px 0;">
              <a href="https://nexusfinancefintech.vercel.app/" style="background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">Make Payment Now</a>
            </div>
            <p style="color: #64748b; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 25px;">NexusFinance Fintech Inc. Cambodia</p>
          </div>
        `));
        sentEmail = true;
      } catch (e) {
        console.error('Failed to send Email chase notice:', e);
      }
    })(),
    // 3. SMS
    (async () => {
      try {
        if (user.phone) {
          const { data: smsConfig } = await db.from('nexus_config').select('*').eq('tenant_id', req.user.tenant_id || 1).maybeSingle();
          await withTimeout(sendSMS(user.phone, plainText, smsConfig));
          sentSMS = true;
        }
      } catch (e) {
        console.error('Failed to send SMS chase notice:', e);
      }
    })(),
    // 4. In-App Notification
    (async () => {
      try {
        const time = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Phnom_Penh', hour: '2-digit', minute: '2-digit', hour12: false });
        const text = `🚨 OVERDUE PAYMENT WARNING: Your monthly installment of $${monthly.toFixed(2)} is overdue for Loan ${loan.id}. Please repay immediately.`;
        await db.from('nexus_notifications').insert({
          userId: user.id,
          text,
          time,
          unread: true,
          tenant_id: req.user.tenant_id || 1,
        });
      } catch (e) {
        console.error('Failed to create in-app notice:', e);
      }
    })()
  ]);

  logAudit('payment_chase', `Sent payment chase reminder (Telegram: ${sentTelegram}, Email: ${sentEmail}, SMS: ${sentSMS}) to customer ${loan.applicantEmail}`, req.user);

  res.json({ success: true, message: 'Chase reminder notifications dispatched successfully.' });
});

// ── 404 catch-all ────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});

// ── START THE SERVER ────────────────────────────────────────

async function seedDemoUsers() {
  const demoUsers = [
    { email: 'customer@nexus.com', name: 'Demo Customer', role: 'customer' },
    { email: 'officer@nexus.com', name: 'Demo Officer', role: 'loan-officer' },
    { email: 'admin@nexus.com', name: 'Admin', role: 'super-admin' },
  ];
  for (const u of demoUsers) {
    const { data: existing } = await db.from('nexus_users').select('id').eq('email', u.email).maybeSingle();
    if (!existing) {
      const passwordHash = await bcrypt.hash('password123', 10);
      await db.from('nexus_users').insert({ ...u, password: passwordHash, phone: '', email_verified: true, tenant_id: 1 });
      console.log(`  👤 Seeded demo account: ${u.email}`);
    }
  }
}

app.listen(PORT, async () => {
  console.log(`\n  🚀 NexusFinance API is running!`);
  console.log(`  📍 http://localhost:${PORT}`);
  try {
    await seedDemoUsers();
  } catch (e) {
    console.error('  ⚠️ Demo user seeding failed:', e);
  }
  console.log(`  \n  👤 Demo accounts:`);
  console.log(`     customer@nexus.com  / password123  → Customer portal`);
  console.log(`     officer@nexus.com   / password123  → Loan Officer`);
  console.log(`     admin@nexus.com     / password123  → Super Admin\n`);

  // ── Dynamic daily payment reminders cron startup ──
  let reminderTime = '07:00';
  try {
    const { data: config } = await db.from('nexus_config').select('reminder_time').eq('tenant_id', 1).maybeSingle();
    if (config && config.reminder_time) {
      reminderTime = config.reminder_time;
    }
  } catch (err) {
    console.warn('  ⚠️ Could not load reminder_time from nexus_config, defaulting to 07:00');
  }
  scheduleReminderCron(reminderTime);
});
