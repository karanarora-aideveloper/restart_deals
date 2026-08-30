/**
 * systemLogger.js
 * Intercepts console.log/warn/error and mirrors all backend output to a
 * Redis circular list so the admin panel can display live logs.
 *
 * Key: logs:backend
 * Format: JSON { ts, level, msg }
 * Max entries: 3000 (oldest auto-removed) — see api/src/utils/systemLogger.js's matching
 * comment for why this was raised from 500.
 */
import { createRedisConnection } from './redis.js';

const LOG_KEY = 'logs:backend';
const MAX_LOGS = 3000;

let redis = null;

function getRedis() {
  if (!redis) {
    try {
      redis = createRedisConnection({ maxRetriesPerRequest: 1 });
    } catch {
      // Redis not available — silently skip
    }
  }
  return redis;
}

function stripAnsi(str) {
  // Remove ANSI escape codes from GramJS output
  return str.replace(/\[[0-9;]*m/g, '');
}

function push(level, args) {
  const r = getRedis();
  if (!r) return;
  const msg = stripAnsi(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
  const entry = JSON.stringify({ ts: new Date().toISOString(), level, msg, source: 'listener' });
  r.lpush(LOG_KEY, entry)
    .then(() => r.ltrim(LOG_KEY, 0, MAX_LOGS - 1))
    .catch(() => {}); // non-blocking, never throws
}

const _log = console.log.bind(console);
const _warn = console.warn.bind(console);
const _error = console.error.bind(console);

export function installSystemLogger() {
  console.log = (...args) => { _log(...args); push('info', args); };
  console.warn = (...args) => { _warn(...args); push('warn', args); };
  console.error = (...args) => { _error(...args); push('error', args); };
  _log('[SystemLogger] Console mirroring to Redis enabled.');
}
