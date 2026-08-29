/**
 * systemLogger.js
 * Intercepts console.log/warn/error and mirrors all api-service output to a
 * Redis circular list so the admin panel can display live logs — same
 * mechanism and key as backend/src/utils/systemLogger.js (the Telegram
 * listener service), so the admin's live log panel shows activity from
 * BOTH services in one merged stream instead of only the listener's half
 * of the pipeline.
 *
 * Key: logs:backend
 * Format: JSON { ts, level, msg, source }
 * Max entries: 500 total across both services (oldest auto-removed) — each
 * push trims to the cap, so whichever service pushes last keeps the list
 * from growing unbounded even with two writers.
 */
import { defaultRedis } from './redis.js';

const LOG_KEY = 'logs:backend';
const MAX_LOGS = 500;

function stripAnsi(str) {
  return str.replace(/\[[0-9;]*m/g, '');
}

function push(level, args) {
  if (!defaultRedis) return;
  const msg = stripAnsi(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
  const entry = JSON.stringify({ ts: new Date().toISOString(), level, msg, source: 'api' });
  defaultRedis.lpush(LOG_KEY, entry)
    .then(() => defaultRedis.ltrim(LOG_KEY, 0, MAX_LOGS - 1))
    .catch(() => {}); // non-blocking, never throws
}

const _log = console.log.bind(console);
const _warn = console.warn.bind(console);
const _error = console.error.bind(console);

export function installSystemLogger() {
  console.log = (...args) => { _log(...args); push('info', args); };
  console.warn = (...args) => { _warn(...args); push('warn', args); };
  console.error = (...args) => { _error(...args); push('error', args); };
  _log('[SystemLogger] Console mirroring to Redis enabled (source: api).');
}
