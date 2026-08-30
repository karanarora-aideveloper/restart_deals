/**
 * systemLogger.js
 * Intercepts console.log/warn/error and mirrors all api-service output to a
 * Redis circular list so the admin panel can display live logs — same
 * mechanism and key as backend/src/utils/systemLogger.js (the Telegram
 * listener service), so the admin's live log panel shows activity from
 * ALL services in one merged stream, filterable by source.
 *
 * `source` defaults to 'api' (the main web service's own call in index.js),
 * but is a parameter so scraperWorker.js's standalone processes — 5 separate
 * Render services running the exact same code — can each tag their own
 * entries distinctly (scraper-1, scraper-2, ...) via RENDER_SERVICE_NAME,
 * letting the admin panel show "what's failing on which worker" instead of
 * one undifferentiated stream.
 *
 * Key: logs:backend
 * Format: JSON { ts, level, msg, source }
 * Max entries: 3000 total across all services (oldest auto-removed) — each
 * push trims to the cap, so whichever service pushes last keeps the list
 * from growing unbounded even with many writers. Raised from 500 (was only
 * a few seconds/minutes of history once multiple scraper workers' worth of
 * traffic started sharing this key) — confirmed cheap: each entry runs
 * ~150-300 bytes, so even 3000 is well under 1MB on a Redis instance with
 * plenty of headroom post the 2026-08-30 memory-leak fix.
 */
import { defaultRedis } from './redis.js';

const LOG_KEY = 'logs:backend';
const MAX_LOGS = 3000;

function stripAnsi(str) {
  return str.replace(/\[[0-9;]*m/g, '');
}

function push(level, args, source) {
  if (!defaultRedis) return;
  const msg = stripAnsi(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
  const entry = JSON.stringify({ ts: new Date().toISOString(), level, msg, source });
  defaultRedis.lpush(LOG_KEY, entry)
    .then(() => defaultRedis.ltrim(LOG_KEY, 0, MAX_LOGS - 1))
    .catch(() => {}); // non-blocking, never throws
}

const _log = console.log.bind(console);
const _warn = console.warn.bind(console);
const _error = console.error.bind(console);

export function installSystemLogger(source = 'api') {
  console.log = (...args) => { _log(...args); push('info', args, source); };
  console.warn = (...args) => { _warn(...args); push('warn', args, source); };
  console.error = (...args) => { _error(...args); push('error', args, source); };
  _log(`[SystemLogger] Console mirroring to Redis enabled (source: ${source}).`);
}
