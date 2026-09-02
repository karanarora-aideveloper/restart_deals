/**
 * systemLogger.js
 * Intercepts console.log/warn/error and mirrors all backend output to a
 * Redis circular list so the admin panel can display live logs.
 *
 * Key: logs:backend
 * Format: JSON { ts, level, msg, source: 'listener' }
 * Max entries: 3000 (oldest auto-removed) — see api/src/utils/systemLogger.js's matching
 * comment for why this was raised from 500.
 *
 * BUG FIXED 2026-09-01: this used to open its OWN separate Redis connection via
 * createRedisConnection({ maxRetriesPerRequest: 1 }) — a low-tolerance connection used
 * for nothing else. Confirmed live: zero 'listener'-sourced entries ever showed up in
 * /api/admin/logs despite the Telegram listener processing messages continuously (channels'
 * lastMessageAt was minutes old), while 'api' and every 'shoppersdeals-scraper-N' source
 * logged fine. Those other sources push via api/'s systemLogger.js, which uses the shared
 * `defaultRedis` singleton (maxRetriesPerRequest: null — required by BullMQ, unlimited
 * retries, the same connection BullMQ itself depends on and that's proven to survive this
 * app's periodic Redis memory pressure — see scraperQueue.js's incident writeups). This
 * file's private maxRetriesPerRequest: 1 connection was almost certainly the first thing to
 * give up on any transient Redis hiccup and never reconnect for the rest of the process's
 * life, silently dropping every push() after that via the .catch(()=>{}) safety net — with
 * no visible symptom other than "no listener logs ever", since nothing else used this
 * connection to notice it had died. Now uses the same shared defaultRedis connection as
 * everything else in this process (scraperQueue.js, redis.js's other consumers), instead of
 * a second bespoke one with no proven resilience.
 */
import { defaultRedis } from './redis.js';

const LOG_KEY = 'logs:backend';
const MAX_LOGS = 3000;

function stripAnsi(str) {
  // Remove ANSI escape codes from GramJS output
  return str.replace(/\[[0-9;]*m/g, '');
}

function push(level, args) {
  if (!defaultRedis) return;
  const msg = stripAnsi(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
  const entry = JSON.stringify({ ts: new Date().toISOString(), level, msg, source: 'listener' });
  defaultRedis.lpush(LOG_KEY, entry)
    .then(() => defaultRedis.ltrim(LOG_KEY, 0, MAX_LOGS - 1))
    .catch(() => {}); // non-blocking, never throws
}

const _log = console.log.bind(console);
const _warn = console.warn.bind(console);
const _error = console.error.bind(console);

// Last time ANY console output happened in this process — the watchdog (see watchdog.js)
// uses this as a cheap, already-wired-up "is this process actually doing anything" heartbeat.
// Updated synchronously in the wrapper itself (not inside push(), which is async and could
// itself be the thing that's hung) so it stays accurate even if Redis is unreachable.
let lastActivityAt = Date.now();
export function getLastActivityAt() {
  return lastActivityAt;
}

export function installSystemLogger() {
  console.log = (...args) => { lastActivityAt = Date.now(); _log(...args); push('info', args); };
  console.warn = (...args) => { lastActivityAt = Date.now(); _warn(...args); push('warn', args); };
  console.error = (...args) => { lastActivityAt = Date.now(); _error(...args); push('error', args); };
  _log('[SystemLogger] Console mirroring to Redis enabled.');
}
