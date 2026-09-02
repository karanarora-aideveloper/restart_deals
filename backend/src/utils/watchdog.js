/**
 * watchdog.js
 *
 * Defense-in-depth for the exact incident found 2026-09-02: the Telegram listener went
 * completely silent for 65+ minutes, twice, with the process still technically "alive" the
 * whole time (Express's /health kept responding, so Render never noticed or auto-restarted
 * it) — a genuine zombie process. The root cause found (a Redis command hanging forever with
 * no timeout, since BullMQ requires unlimited retries on its connection) is fixed directly in
 * scraperQueue.js's withTimeout() wrapper, but this watchdog exists in case some OTHER,
 * undiagnosed cause produces the same symptom in the future: rather than requiring a human to
 * notice and manually trigger a redeploy again, force the process to exit so Render's own
 * crash-detection restarts it automatically.
 *
 * How it works: systemLogger.js already stamps a timestamp on every single console.log/
 * warn/error call in this process (getLastActivityAt()) — genuinely any output at all, not
 * just Telegram-specific lines, so this can't false-positive on "no Telegram messages right
 * now" alone; SOMETHING in this process logs constantly during normal operation (poller ticks,
 * verifier steps, product saves). If NOTHING has logged anything for SILENCE_THRESHOLD_MS,
 * that's not "quiet channels" — that's the process wedged. Checked on its own interval (not
 * reusing setInterval timing from elsewhere) so it isn't itself blocked by whatever hung.
 */
import { getLastActivityAt } from './systemLogger.js';

const CHECK_INTERVAL_MS = 2 * 60 * 1000; // check every 2 minutes
const SILENCE_THRESHOLD_MS = 20 * 60 * 1000; // 20 minutes of zero output = treat as wedged

export function startWatchdog() {
  setInterval(() => {
    const silentForMs = Date.now() - getLastActivityAt();
    if (silentForMs < SILENCE_THRESHOLD_MS) return;

    // Deliberately bypass the console.log override (which would just reset the very timer
    // we're about to act on) and write straight to stdout/stderr so this is still visible in
    // Render's raw logs even if the wrapped console itself is part of what's wedged.
    process.stderr.write(
      `[Watchdog] CRITICAL: no console output for ${Math.round(silentForMs / 60000)} minutes — ` +
      `treating the process as wedged (see watchdog.js's docblock for the incident this guards ` +
      `against). Exiting so Render restarts this service.\n`
    );
    process.exit(1);
  }, CHECK_INTERVAL_MS);
}
