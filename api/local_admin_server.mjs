// Local automation server for the admin panel.
//
// Why this exists: ScrapingAnt's own signup form appears to block Render's
// datacenter IP (confirmed live 2026-08-29 — the exact same code fills the
// signup form successfully every time from this machine's residential IP,
// but fails to find the email input twice in a row from Render). Since the
// admin panel always runs on this same machine, this server lets the admin
// UI trigger the ScrapingAnt token automation to run HERE (visibly, in a
// real browser) instead of on Render, while every other admin feature
// (token list, deals, products, etc.) keeps talking to production as usual.
//
// It mirrors the exact request/response contract of the 5 automation routes
// in api/src/routes/tokens.js, so the admin page needs only to point those
// specific calls at this server's URL instead of the production API's.
// Successful tokens are POSTed to the production admin API (no direct DB
// connection needed here), same as local_token_automation.mjs.
//
// Usage:
//   cd api && node local_admin_server.mjs
// Then leave it running while using the admin panel's ScrapingAnt
// Automation controls as normal.

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import {
  runBatchAutomation,
  runLoginTest,
  getAutomationStatus,
  requestAbort,
  submitOtpCode,
} from './src/scripts/scrapingAntAutomation.js';

// ─── Clean, leveled console output ─────────────────────────────────────────
// scrapingAntAutomation.js logs with decorative banners and emoji tuned for
// skimming Render's dashboard — that's left untouched (Render's log stream
// still gets the original formatting). Here, for a plain local terminal,
// intercept this process's console output and reformat every line into a
// single consistent `timestamp LEVEL message` shape: banner/separator lines
// and repetitive 2Captcha polling ticks are dropped entirely, emoji are
// stripped, and the level is inferred from the message content.
const RAW_CONSOLE = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

function timestamp() {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

function isNoiseLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (/^[=\-─═]{5,}$/.test(trimmed)) return true; // banner/separator rows
  if (/not ready yet/i.test(trimmed)) return true; // repetitive captcha polling
  return false;
}

function stripDecoration(line) {
  return line
    .replace(/[\u{1F300}-\u{1FAFF}\u{2190}-\u{2BFF}\u{FE0F}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function levelFor(line) {
  if (/error|failed|fatal/i.test(line)) return 'ERROR';
  if (/warn/i.test(line)) return 'WARN';
  return 'INFO';
}

function plainLog(args) {
  const text = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  for (const line of text.split('\n')) {
    if (isNoiseLine(line)) continue;
    const clean = stripDecoration(line);
    if (!clean) continue;
    RAW_CONSOLE.log(`${timestamp()} ${levelFor(clean).padEnd(5)} ${clean}`);
  }
}

console.log = (...args) => plainLog(args);
console.warn = (...args) => plainLog(args);
console.error = (...args) => plainLog(args);

const PORT = process.env.LOCAL_ADMIN_SERVER_PORT || 5057;
const PROD_API_BASE = 'https://api.shoppersdeals.in';

const ADMIN_API_KEY = (() => {
  try {
    const envLocal = fs.readFileSync('../admin/.env.local', 'utf8');
    const match = envLocal.match(/^NEXT_PUBLIC_ADMIN_API_KEY=(.+)$/m);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
})();

if (!ADMIN_API_KEY) {
  console.error('[Local Admin Server] Could not read NEXT_PUBLIC_ADMIN_API_KEY from ../admin/.env.local');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

function requireAdminKey(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (key !== ADMIN_API_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized: invalid x-admin-key' });
  }
  next();
}

async function saveToken(email, token) {
  console.log(`[Local Admin Server] Cycle produced token for ${email}: ${token.slice(0, 8)}... — saving to production DB via API`);
  try {
    const res = await fetch(`${PROD_API_BASE}/api/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_API_KEY },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      console.error('[Local Admin Server] Failed to save token via API:', data.error || res.statusText);
      return;
    }
    console.log(`[Local Admin Server] ✓ Token saved to production DB (inserted=${data.insertedCount}, skipped=${data.skippedCount})`);
  } catch (err) {
    console.error('[Local Admin Server] Error POSTing token to API:', err.message);
  }
}

app.get('/api/tokens/automation-status', requireAdminKey, (req, res) => {
  res.json({ success: true, ...getAutomationStatus() });
});

app.post('/api/tokens/generate-scrapingant', requireAdminKey, (req, res) => {
  const status = getAutomationStatus();
  if (status.running) {
    return res.status(409).json({ success: false, error: 'An automation run is already in progress', status });
  }

  const { count = 1, captchaApiKey, headless, delayBetween = 30000 } = req.body || {};

  if (!captchaApiKey && !process.env.TWOCAPTCHA_API_KEY) {
    return res.status(400).json({
      success: false,
      error: '2Captcha API key is required. Pass captchaApiKey in body or set TWOCAPTCHA_API_KEY env var.',
    });
  }

  const tokenCount = Math.min(Math.max(1, parseInt(count) || 1), 50);

  res.json({
    success: true,
    message: `Local automation started: generating ${tokenCount} token(s) visibly on this machine.`,
    count: tokenCount,
  });

  // Default to a VISIBLE browser here — headless mode is what let the
  // original modal-selector bugs go unnoticed for so long, and there's no
  // Render-style constraint locally forcing headless. Still honors an
  // explicit headless:true from the admin UI if sent.
  runBatchAutomation({
    count: tokenCount,
    captchaApiKey: captchaApiKey || process.env.TWOCAPTCHA_API_KEY,
    headless: headless === true,
    delayBetween: parseInt(delayBetween) || 30_000,
    saveToken,
  }).catch((err) => {
    console.error('[Local Admin Server] Batch run failed:', err.message);
  });
});

app.post('/api/tokens/test-login', requireAdminKey, (req, res) => {
  const status = getAutomationStatus();
  if (status.running) {
    return res.status(409).json({ success: false, error: 'An automation run is already in progress', status });
  }

  const { captchaApiKey, headless } = req.body || {};

  res.json({ success: true, message: 'Login test started on this machine — watch for a browser window.' });

  runLoginTest({
    captchaApiKey: captchaApiKey || process.env.TWOCAPTCHA_API_KEY,
    headless: headless === true,
  }).catch((err) => {
    console.error('[Local Admin Server] Login test failed:', err.message);
  });
});

app.post('/api/tokens/stop-automation', requireAdminKey, (req, res) => {
  const stopped = requestAbort();
  if (stopped) {
    res.json({ success: true, message: 'Abort requested. Automation will stop after the current cycle.' });
  } else {
    res.json({ success: false, message: 'No automation is currently running.' });
  }
});

app.post('/api/tokens/submit-otp-code', requireAdminKey, (req, res) => {
  const { code } = req.body || {};
  if (!code || !String(code).trim()) {
    return res.status(400).json({ success: false, error: 'code is required' });
  }

  const status = getAutomationStatus();
  if (!status.awaitingCode) {
    return res.status(409).json({ success: false, error: 'Automation is not currently waiting for a code' });
  }

  const accepted = submitOtpCode(String(code).trim());
  if (!accepted) {
    return res.status(409).json({ success: false, error: 'No pending code request (it may have just timed out)' });
  }

  res.json({ success: true, message: 'Code submitted, automation resuming.' });
});

app.listen(PORT, () => {
  console.log(`[Local Admin Server] Listening on http://localhost:${PORT}`);
  console.log('[Local Admin Server] Point the admin panel\'s automation calls here to run ScrapingAnt token generation on this machine.');
});
