/**
 * Live site audit: crawls every URL listed in the sitemap index and reports non-200 pages.
 * Usage: node api/src/scripts/audit_site_404s.js [baseUrl] [concurrency] [outFile]
 */
import fs from 'fs';

const BASE = process.argv[2] || 'https://www.shoppersdeals.in';
const CONCURRENCY = Number(process.argv[3] || 15);
const OUT = process.argv[4] || '/tmp/site_audit_results.json';

async function getText(url) {
  const r = await fetch(url);
  return r.text();
}

async function collectUrls() {
  const index = await getText(`${BASE}/sitemap.xml`);
  const children = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const urls = [];
  for (const child of children) {
    const xml = await getText(child);
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    console.log(`[sitemap] ${child} -> ${locs.length} URLs`);
    for (const u of locs) urls.push({ url: u, sitemap: child.split('/').pop() });
  }
  return urls;
}

async function check(item, attempt = 1) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    const r = await fetch(item.url, { redirect: 'manual', signal: ctrl.signal });
    clearTimeout(timer);
    await r.arrayBuffer();
    return { ...item, status: r.status, location: r.headers.get('location') || undefined };
  } catch (e) {
    if (attempt < 3) return check(item, attempt + 1);
    return { ...item, status: 0, error: e.message };
  }
}

const skipSitemaps = (process.env.SKIP_SITEMAPS || '').split(',').filter(Boolean);
const previous = process.env.RESUME === '1' && fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
const done = new Set(previous.map((r) => r.url));
const sampleN = Number(process.env.SAMPLE || 0);
let urls = (await collectUrls()).filter((u) => !skipSitemaps.includes(u.sitemap) && !done.has(u.url));
if (sampleN > 0) {
  const grouped = {};
  for (const u of urls) (grouped[u.sitemap] ||= []).push(u);
  urls = Object.values(grouped).flatMap((g) => g.sort(() => Math.random() - 0.5).slice(0, sampleN));
}
console.log(`URLs to audit: ${urls.length} (already done: ${previous.length}, skipped sitemaps: ${skipSitemaps.join(',') || 'none'})`);

const results = [...previous];
let idx = 0;
const t0 = Date.now();
async function worker() {
  while (idx < urls.length) {
    const i = idx++;
    results.push(await check(urls[i]));
    if (results.length % 500 === 0) {
      const bad = results.filter((r) => r.status !== 200).length;
      console.log(`[progress] ${results.length}/${urls.length} non-200 so far: ${bad} (${Math.round((Date.now() - t0) / 1000)}s)`);
      fs.writeFileSync(OUT, JSON.stringify(results));
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
fs.writeFileSync(OUT, JSON.stringify(results));

const byStatus = {};
for (const r of results) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
console.log('\n=== SUMMARY ===');
console.log(byStatus);
const bad = results.filter((r) => r.status !== 200);
const bySitemap = {};
for (const r of bad) bySitemap[`${r.sitemap}:${r.status}`] = (bySitemap[`${r.sitemap}:${r.status}`] || 0) + 1;
console.log('Non-200 by sitemap:status', bySitemap);
console.log('Sample non-200:', bad.slice(0, 20).map((r) => `${r.status} ${r.url}`));
console.log(`Done in ${Math.round((Date.now() - t0) / 1000)}s. Results: ${OUT}`);
