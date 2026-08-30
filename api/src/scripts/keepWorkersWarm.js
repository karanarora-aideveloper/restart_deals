// Pings the independent scraper worker services' health-check endpoints so
// Render's free-tier "spin down after ~15 min of no inbound traffic" never
// triggers on them. The workers themselves get no organic inbound traffic
// (they're pure BullMQ queue consumers — the health-check server exists
// only to satisfy Render's web-service requirement), so without this they
// go to sleep after their first 15 idle minutes and stop picking up jobs.
//
// Deployed as its own Render Cron Job running every 10 minutes (safely
// under the 15-min window). Add a new worker's URL to WORKER_URLS below
// when scaling out further — no other change needed.
const WORKER_URLS = [
  'https://shoppersdeals-scraper-1.onrender.com',
  'https://shoppersdeals-scraper-2.onrender.com',
];

async function ping(url) {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const ms = Date.now() - start;
    console.log(`[KeepWarm] ${url} -> ${res.status} (${ms}ms)`);
  } catch (err) {
    console.error(`[KeepWarm] ${url} -> FAILED: ${err.message}`);
  }
}

async function main() {
  console.log(`[KeepWarm] Pinging ${WORKER_URLS.length} worker(s)...`);
  await Promise.all(WORKER_URLS.map(ping));
  console.log('[KeepWarm] Done.');
}

main();
