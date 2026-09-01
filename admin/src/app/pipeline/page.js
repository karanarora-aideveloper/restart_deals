'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import AdminShell from '@/components/admin-shell';

/* ─── Canvas geometry (horizontal, left → right) ─────────────────────────── */
const W = 180, H = 84;       // normal node card
const DW = 152, DH = 116;    // decision diamond
const CANVAS_W = 1920, CANVAS_H = 600;

const ROW_TOP = 100, ROW_MID = 290, ROW_BOT = 480;

const NODES = [
  { id: 'telegram',    label: 'Telegram Sources',   sub: 'GramJS live capture',       icon: '💬', color: '#2CA5E0', cx: 110,  cy: ROW_TOP, logSource: 'listener' },
  { id: 'crawler',     label: 'Bestseller Crawler', sub: '24 h scheduled run',        icon: '🔍', color: '#F59E0B', cx: 110,  cy: ROW_BOT, logSource: 'api' },
  { id: 'bullmq',      label: 'BullMQ Queue',       sub: 'Redis priority broker',     icon: '⚡', color: '#8B5CF6', cx: 350,  cy: ROW_MID, logSource: 'api' },
  { id: 'scraper',     label: 'Scraping Engine',    sub: 'ScrapingAnt + Chrome',      icon: '🕷️', color: '#EF4444', cx: 580,  cy: ROW_MID, logSource: '__scrapers__' },
  { id: 'decision',    label: 'Product exists?',    sub: 'canonical ID lookup',       icon: '❓', color: '#FBBF24', cx: 810,  cy: ROW_MID, logSource: null, shape: 'diamond' },
  { id: 'create',      label: 'Create Product',     sub: 'new canonical record',      icon: '🆕', color: '#22C55E', cx: 1040, cy: ROW_TOP, logSource: 'api' },
  { id: 'update',      label: 'Update Product',     sub: 'refresh price + history',   icon: '♻️', color: '#0EA5E9', cx: 1040, cy: ROW_BOT, logSource: 'api' },
  { id: 'products',    label: 'Product DB',         sub: 'MongoDB Atlas',             icon: '📦', color: '#10B981', cx: 1270, cy: ROW_MID, logSource: 'api' },
  { id: 'synthesizer', label: 'Deal Synthesizer',   sub: '≥15 % drop detector',       icon: '🎯', color: '#F97316', cx: 1500, cy: ROW_MID, logSource: 'api' },
  { id: 'tg-out',      label: 'Telegram Alerts',    sub: 'Deal channels',             icon: '📢', color: '#2CA5E0', cx: 1730, cy: ROW_TOP, logSource: 'api' },
  { id: 'web',         label: 'Web & App Feed',     sub: 'shopscanner.store',         icon: '🌐', color: '#3B82F6', cx: 1730, cy: ROW_MID, logSource: null },
  { id: 'x-bot',       label: 'Twitter / X Bot',    sub: 'Auto-tweets USA',           icon: '🐦', color: '#64748B', cx: 1730, cy: ROW_BOT, logSource: 'api' },
];

const EDGES = [
  { from: 'telegram',    to: 'bullmq',      label: 'Priority 2' },
  { from: 'crawler',     to: 'bullmq',      label: 'Priority 4' },
  { from: 'bullmq',      to: 'scraper',     label: '1 req / 2.5 s' },
  { from: 'scraper',     to: 'decision',    label: 'lookup ASIN/PID' },
  { from: 'decision',    to: 'create',      label: 'No → new' },
  { from: 'decision',    to: 'update',      label: 'Yes → existing' },
  { from: 'create',      to: 'products',    label: 'insert' },
  { from: 'update',      to: 'products',    label: 'upsert + history' },
  { from: 'products',    to: 'synthesizer', label: 'price delta' },
  { from: 'synthesizer', to: 'tg-out',      label: 'alert' },
  { from: 'synthesizer', to: 'web',         label: 'deal' },
  { from: 'synthesizer', to: 'x-bot',       label: 'tweet' },
];

function halfW(n) { return n.shape === 'diamond' ? DW / 2 : W / 2; }

/* ─── Edge path (horizontal: right edge of a → left edge of b) ──────────── */
function edgePath(a, b) {
  const x1 = a.cx + halfW(a), y1 = a.cy;
  const x2 = b.cx - halfW(b), y2 = b.cy;
  const mid = (x1 + x2) / 2;
  return 'M ' + x1 + ' ' + y1 + ' C ' + mid + ' ' + y1 + ',' + mid + ' ' + y2 + ',' + x2 + ' ' + y2;
}

/* ─── Mini-stat text for each node card ──────────────────────────────────── */
function nodeStats(nodeId, live) {
  if (!live) return null;
  const { status, scrapers, channels, crawlerSt } = live;
  switch (nodeId) {
    case 'telegram':
      return channels ? (channels.filter(c => c.isActive !== false).length) + ' active · ' + channels.length + ' total' : null;
    case 'crawler':
      { const cfg = crawlerSt && crawlerSt.config; return cfg ? (cfg.isRunning ? '🟢 running' : '⚪ idle') + ' · every ' + (cfg.intervalHours || 24) + 'h' : null; }
    case 'bullmq':
      return status ? (status.queueLength || 0) + ' in queue · 4 priority tiers' : null;
    case 'scraper':
      return scrapers ? scrapers.online + ' / ' + scrapers.total + ' workers online' : null;
    case 'create':
      return status ? '+' + (status.products24h || 0) + ' created today' : null;
    case 'update':
      return status ? (status.productsUpdated24h || 0).toLocaleString() + ' updated today' : null;
    case 'products':
      return status ? (status.totalProducts || 0).toLocaleString() + ' products · +' + (status.products24h || 0) + ' today' : null;
    case 'synthesizer':
      return status ? (status.dealsToday || 0) + ' deals today · ' + (status.activeDeals || 0) + ' active' : null;
    case 'tg-out':
      return status ? (status.totalUsers || 0).toLocaleString() + ' subscribers' : null;
    case 'web':
      return 'shopscanner.store';
    case 'x-bot':
      return 'US deals · scheduled tweets';
    default:
      return null;
  }
}

/* ─── Small shared UI ─────────────────────────────────────────────────────── */
function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 28 }}>
      <div style={{ width: 22, height: 22, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#60a5fa', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
}
function Row({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{label}</span>
      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: accent || '#e2e8f0' }}>{value}</span>
    </div>
  );
}

/* ─── Log viewer ──────────────────────────────────────────────────────────── */
function LogViewer({ apiFetch, nodeId, scrapers }) {
  const [logs, setLogs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState(null); // for scraper node
  const node = NODES.find(n => n.id === nodeId);

  const fetchLogs = useCallback(async function(src) {
    setLoading(true);
    try {
      const source = src || (node && node.logSource !== '__scrapers__' ? node.logSource : 'all');
      const url = '/api/admin/logs?limit=40' + (source && source !== 'all' ? '&source=' + source : '');
      const data = await apiFetch(url);
      setLogs(data.logs || []);
    } catch (e) {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, nodeId]);

  useEffect(function() {
    if (nodeId === 'scraper') {
      // Default to first online worker, or first worker
      const firstOnline = scrapers && scrapers.workers && scrapers.workers.find(function(w) { return w.online; });
      const first = firstOnline || (scrapers && scrapers.workers && scrapers.workers[0]);
      const src = first ? first.name : null;
      setSelectedWorker(src);
      fetchLogs(src);
    } else {
      fetchLogs(null);
    }
  }, [nodeId]);

  const LEVEL_COLOR = { error: '#f87171', warn: '#fbbf24', info: '#60a5fa', debug: '#94a3b8' };

  return (
    <div>
      {/* Worker selector for scraper node */}
      {nodeId === 'scraper' && scrapers && scrapers.workers && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {scrapers.workers.map(function(w) {
            const active = selectedWorker === w.name;
            return (
              <button key={w.name} onClick={function() { setSelectedWorker(w.name); fetchLogs(w.name); }} style={{
                padding: '4px 10px', borderRadius: 6, border: '1px solid ' + (active ? w.online ? '#10B981' : '#EF4444' : 'rgba(255,255,255,0.1)'),
                background: active ? (w.online ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)') : 'transparent',
                color: active ? '#e2e8f0' : '#64748b', fontSize: '0.72rem', cursor: 'pointer',
              }}>
                {w.online ? '🟢' : '🔴'} {w.name.replace('shoppersdeals-', '')}
              </button>
            );
          })}
          <button onClick={function() { setSelectedWorker(null); fetchLogs('all'); }} style={{
            padding: '4px 10px', borderRadius: 6, border: '1px solid ' + (!selectedWorker ? '#8B5CF6' : 'rgba(255,255,255,0.1)'),
            background: !selectedWorker ? 'rgba(139,92,246,0.15)' : 'transparent',
            color: !selectedWorker ? '#e2e8f0' : '#64748b', fontSize: '0.72rem', cursor: 'pointer',
          }}>
            All workers
          </button>
        </div>
      )}

      {loading ? <Spinner /> : logs && logs.length === 0 ? (
        <p style={{ color: '#64748b', fontSize: '0.8rem', textAlign: 'center', padding: 24 }}>No logs found for this source</p>
      ) : (
        <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: '0.68rem', lineHeight: 1.6 }}>
          {(logs || []).map(function(entry, i) {
            const color = LEVEL_COLOR[entry.level] || '#94a3b8';
            const ts = entry.ts ? new Date(entry.ts).toLocaleTimeString() : '';
            return (
              <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: '#374151', whiteSpace: 'nowrap', flexShrink: 0, fontSize: '0.63rem' }}>{ts}</span>
                <span style={{ color, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, fontSize: '0.65rem', textTransform: 'uppercase' }}>{entry.level}</span>
                <span style={{ color: '#94a3b8', fontSize: '0.65rem', flexShrink: 0 }}>[{entry.source || '?'}]</span>
                <span style={{ color: '#cbd5e1', wordBreak: 'break-word' }}>{entry.msg || entry.message || ''}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Panel overview content per node ────────────────────────────────────── */
function OverviewContent({ nodeId, apiFetch, live }) {
  const [extra, setExtra] = useState(null);
  const { status, scrapers, channels, crawlerSt } = live || {};

  // Fetch node-specific data
  useEffect(function() {
    if (nodeId === 'telegram' && !channels) return;
    if (nodeId === 'crawler') {
      apiFetch('/api/crawler/seeds?limit=200').then(function(d) { setExtra(d.seeds || d); }).catch(function() {});
    }
  }, [nodeId, apiFetch]);

  if (nodeId === 'telegram') {
    const chs = channels || [];
    const active = chs.filter(function(c) { return c.isActive !== false; });
    return (
      <div>
        <Row label="Active channels" value={active.length} accent="#10B981" />
        <Row label="Total channels" value={chs.length} />
        <div style={{ marginTop: 16, maxHeight: 360, overflowY: 'auto' }}>
          {chs.map(function(ch) {
            return (
              <div key={ch._id} style={{
                background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '9px 11px', marginBottom: 7,
                borderLeft: '3px solid ' + (ch.isActive !== false ? '#10B981' : '#374151'),
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#e2e8f0' }}>{ch.name || ch.username}</span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: ch.isActive !== false ? '#6ee7b7' : '#6b7280', background: ch.isActive !== false ? 'rgba(16,185,129,0.12)' : 'rgba(107,114,128,0.15)', borderRadius: 4, padding: '1px 6px' }}>
                    {ch.isActive !== false ? 'ACTIVE' : 'PAUSED'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 14, marginTop: 5, fontSize: '0.72rem', color: '#94a3b8' }}>
                  <span>💬 {(ch.messagesCapturedCount || 0).toLocaleString()}</span>
                  <span>🎯 {(ch.dealsProducedCount || 0).toLocaleString()} deals</span>
                  {ch.country && <span>🌍 {ch.country}</span>}
                </div>
                {ch.lastMessageAt && <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: 3 }}>Last: {new Date(ch.lastMessageAt).toLocaleString()}</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (nodeId === 'crawler') {
    const seeds = extra || [];
    // Real API shape: GET /api/crawler/status → { config: { isRunning, intervalHours,
    // lastRunAt, lastRunStats, ... }, totalSeeds, enabledSeeds, categoryCounts }.
    // The scheduling/run-state fields live under `config`, not at the top level.
    const cfg = (crawlerSt && crawlerSt.config) || null;

    const byCategory = {};
    const byStore = {};
    seeds.forEach(function(s) {
      const c = s.category || 'other';
      if (!byCategory[c]) byCategory[c] = [];
      byCategory[c].push(s);
      const st = s.store || 'unknown';
      byStore[st] = (byStore[st] || 0) + 1;
    });
    const enabledCount = seeds.filter(function(s) { return s.isEnabled !== false; }).length;

    return (
      <div>
        <Row label="Status" value={cfg ? (cfg.isRunning ? '🟢 Running' : '⚪ Idle') : '—'} />
        <Row label="Interval" value={(cfg && cfg.intervalHours || 24) + ' h'} />
        {cfg && cfg.lastRunAt && <Row label="Last run" value={new Date(cfg.lastRunAt).toLocaleString()} />}
        {cfg && cfg.nextRunAt && <Row label="Next run" value={new Date(cfg.nextRunAt).toLocaleString()} />}

        {cfg && cfg.lastRunStats && (
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 11, marginTop: 12 }}>
            <div style={{ fontSize: '0.68rem', color: '#64748b', marginBottom: 5 }}>Last run results</div>
            <div style={{ display: 'flex', gap: 16, fontSize: '0.8rem', color: '#e2e8f0', flexWrap: 'wrap' }}>
              <span>🔍 {cfg.lastRunStats.seedsCrawled || 0} seeds</span>
              <span>📦 +{cfg.lastRunStats.productsEnrolled || 0}</span>
              <span>🔄 {cfg.lastRunStats.productsUpdated || 0}</span>
              {cfg.lastRunStats.errors > 0 && <span style={{ color: '#f87171' }}>⚠ {cfg.lastRunStats.errors} errors</span>}
            </div>
          </div>
        )}

        {/* Summary strip: keywords / stores / categories at a glance */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <div style={{ flex: 1, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#F59E0B' }}>{seeds.length}</div>
            <div style={{ fontSize: '0.63rem', color: '#94a3b8' }}>keywords</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#10B981' }}>{enabledCount}</div>
            <div style={{ fontSize: '0.63rem', color: '#94a3b8' }}>enabled</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#3B82F6' }}>{Object.keys(byStore).length}</div>
            <div style={{ fontSize: '0.63rem', color: '#94a3b8' }}>stores</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#8B5CF6' }}>{Object.keys(byCategory).length}</div>
            <div style={{ fontSize: '0.63rem', color: '#94a3b8' }}>categories</div>
          </div>
        </div>

        {/* Store breakdown */}
        {Object.keys(byStore).length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {Object.entries(byStore).map(function([store, count]) {
              return (
                <span key={store} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5, padding: '3px 9px', fontSize: '0.7rem', color: '#cbd5e1', textTransform: 'capitalize' }}>
                  🏬 {store} · {count}
                </span>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            All seeds by category ({seeds.length})
          </div>
          {seeds.length === 0 && (
            <p style={{ color: '#64748b', fontSize: '0.78rem' }}>No crawler seeds configured yet.</p>
          )}
          {Object.entries(byCategory).map(function([cat, items]) {
            return (
              <div key={cat} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: '0.74rem', color: '#F59E0B', fontWeight: 700, marginBottom: 7, textTransform: 'capitalize' }}>📂 {cat} ({items.length})</div>
                {items.map(function(s) {
                  return (
                    <div key={s._id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '8px 10px', marginBottom: 5, borderLeft: '2px solid ' + (s.isEnabled !== false ? '#F59E0B' : '#374151') }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{s.keywords || s.subcategory}</span>
                        <span style={{ color: '#64748b', fontSize: '0.7rem', textTransform: 'capitalize' }}>{s.store}</span>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: 3 }}>
                        subcategory: {s.subcategory || '—'} · top {s.topN || 20}
                      </div>
                      {s.url && (
                        <a href={s.url} target="_blank" rel="noreferrer" style={{ fontSize: '0.65rem', color: '#60a5fa', wordBreak: 'break-all', display: 'block', marginTop: 3 }}>
                          {s.url}
                        </a>
                      )}
                      {s.lastResult && (
                        <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: 3 }}>
                          found {s.lastResult.found || 0} · enrolled {s.lastResult.enrolled || 0} · updated {s.lastResult.updated || 0}
                          {s.lastResult.error && <span style={{ color: '#f87171' }}> · error: {s.lastResult.error}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (nodeId === 'scraper') {
    const workers = scrapers && scrapers.workers ? scrapers.workers : [];
    const onlineCount = scrapers ? scrapers.online : 0;
    return (
      <div>
        <Row label="Workers online" value={onlineCount + ' / ' + workers.length} accent={onlineCount === workers.length ? '#10B981' : onlineCount > 0 ? '#F59E0B' : '#EF4444'} />
        <Row label="Rate limit" value="1 req / 2.5 s (global)" />
        <Row label="Proxy routing" value="IN + US" />

        {/* Worker tiles */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            Worker Fleet ({workers.length} configured)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {workers.map(function(w) {
              return (
                <div key={w.name} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px',
                  borderLeft: '3px solid ' + (w.online ? '#10B981' : '#EF4444'),
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: w.online ? '#10B981' : '#EF4444', boxShadow: '0 0 6px ' + (w.online ? '#10B981' : '#EF4444'), flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, fontSize: '0.8rem', color: '#e2e8f0' }}>{w.name}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {w.online ? (
                      <span style={{ fontSize: '0.72rem', color: '#6ee7b7' }}>{w.latencyMs} ms</span>
                    ) : (
                      <span style={{ fontSize: '0.68rem', color: '#f87171' }}>offline</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 10, fontSize: '0.68rem', color: '#475569', lineHeight: 1.5 }}>
            Workers are pinged live on every page load. Add/remove workers via <code style={{ background: 'rgba(255,255,255,0.06)', padding: '0 4px', borderRadius: 3 }}>SCRAPER_WORKER_URLS</code> in admin.js.
          </div>
        </div>
      </div>
    );
  }

  if (nodeId === 'decision') {
    return (
      <div>
        <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 8, padding: 13, marginBottom: 16 }}>
          <div style={{ fontSize: '0.75rem', color: '#fde68a', fontWeight: 700, marginBottom: 5 }}>Lookup logic</div>
          <div style={{ fontSize: '0.8rem', color: '#e2e8f0', lineHeight: 1.65 }}>
            After a scrape resolves the canonical identifier (Amazon ASIN, Flipkart PID, Myntra style ID), the pipeline queries <code style={{ background: 'rgba(255,255,255,0.06)', padding: '0 4px', borderRadius: 3 }}>products</code> for an existing document matching that identifier.
          </div>
        </div>
        <Row label="No match found → routes to" value="Create Product" accent="#22C55E" />
        <Row label="Match found → routes to" value="Update Product" accent="#0EA5E9" />
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Last 24 h split</div>
          <Row label="Created (new)" value={'+' + (status && status.products24h || 0)} accent="#22C55E" />
          <Row label="Updated (existing)" value={(status && status.productsUpdated24h || 0).toLocaleString()} accent="#0EA5E9" />
        </div>
      </div>
    );
  }

  if (nodeId === 'create') {
    return (
      <div>
        <Row label="Created (24 h)" value={'+' + (status && status.products24h || 0)} accent="#22C55E" />
        <Row label="Created (7 d)" value={(status && status.products7d || 0).toLocaleString()} />
        <Row label="Created (30 d)" value={(status && status.products30d || 0).toLocaleString()} />
        <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 12, fontSize: '0.8rem', color: '#e2e8f0', lineHeight: 1.65 }}>
          Inserts a brand-new canonical <code style={{ background: 'rgba(255,255,255,0.06)', padding: '0 4px', borderRadius: 3 }}>products</code> document — title, images, MRP, merchant, category from Master DB — and seeds the first price-history checkpoint.
        </div>
      </div>
    );
  }

  if (nodeId === 'update') {
    return (
      <div>
        <Row label="Updated (24 h)" value={(status && status.productsUpdated24h || 0).toLocaleString()} accent="#0EA5E9" />
        <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 12, fontSize: '0.8rem', color: '#e2e8f0', lineHeight: 1.65 }}>
          Refreshes price, stock, and image on the existing document, then appends a new daily price-history checkpoint. This is what feeds the Deal Synthesizer's ≥ 15% drop check downstream.
        </div>
      </div>
    );
  }

  if (nodeId === 'bullmq') {
    return (
      <div>
        <Row label="Queue length" value={(status && status.queueLength || 0).toLocaleString()} accent="#8B5CF6" />
        <Row label="Deals today" value={(status && status.dealsToday || 0).toLocaleString()} />
        <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Priority tiers</div>
          {[
            { p: 1, label: 'User re-check (urgent)', color: '#EF4444' },
            { p: 2, label: 'Telegram deal message', color: '#2CA5E0' },
            { p: 3, label: '24 h price refresh', color: '#10B981' },
            { p: 4, label: 'Bestseller crawler', color: '#F59E0B' },
          ].map(function(r) {
            return (
              <div key={r.p} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                <span style={{ background: r.color, color: '#fff', borderRadius: 4, padding: '1px 7px', fontSize: '0.68rem', fontWeight: 700 }}>P{r.p}</span>
                <span style={{ fontSize: '0.77rem', color: '#e2e8f0' }}>{r.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (nodeId === 'products') {
    return (
      <div>
        <Row label="Total products" value={(status && status.totalProducts || 0).toLocaleString()} accent="#10B981" />
        <Row label="New (24 h)" value={'+' + (status && status.products24h || 0)} />
        <Row label="Updated (24 h)" value={(status && status.productsUpdated24h || 0).toLocaleString()} />
        <Row label="Products (30 d)" value={(status && status.totalProducts30d || 0).toLocaleString()} />
      </div>
    );
  }

  if (nodeId === 'synthesizer') {
    return (
      <div>
        <Row label="Deals today" value={(status && status.dealsToday || 0).toLocaleString()} accent="#F97316" />
        <Row label="Active deals" value={(status && status.activeDeals || 0).toLocaleString()} />
        <Row label="Total deals" value={(status && status.totalDeals || 0).toLocaleString()} />
        <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Detection rule</div>
          <div style={{ fontSize: '0.82rem', color: '#e2e8f0' }}>≥ 15% price drop vs historical min</div>
          <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: 4 }}>Runs on every successful scrape · auto-creates + activates deals</div>
        </div>
      </div>
    );
  }

  if (nodeId === 'tg-out') {
    return (
      <div>
        <Row label="Total subscribers" value={(status && status.totalUsers || 0).toLocaleString()} accent="#2CA5E0" />
        <div style={{ marginTop: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 12, fontSize: '0.8rem', color: '#e2e8f0', lineHeight: 1.6 }}>
          Broadcasts rich HTML messages with price badge, discount %, merchant logo, affiliate buy link.
        </div>
      </div>
    );
  }

  if (nodeId === 'web') {
    return (
      <div>
        <Row label="Products indexed" value={(status && status.totalProducts || 0).toLocaleString()} accent="#3B82F6" />
        <div style={{ marginTop: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 12, fontSize: '0.8rem', color: '#e2e8f0', lineHeight: 1.6 }}>
          <a href="https://shopscanner.store" target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>shopscanner.store</a> — live deal feed, cubic spline price charts, Algolia full-text search.
        </div>
      </div>
    );
  }

  if (nodeId === 'x-bot') {
    return (
      <div>
        <div style={{ marginTop: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 12, fontSize: '0.8rem', color: '#e2e8f0', lineHeight: 1.6 }}>
          Automated Twitter/X bot posting verified US deals with media uploads at scheduled windows. Affiliate links auto-injected.
        </div>
      </div>
    );
  }

  return null;
}

/* ─── Main page ───────────────────────────────────────────────────────────── */
export default function PipelinePage() {
  const [selected, setSelected] = useState(null);
  const [panelTab, setPanelTab] = useState('overview'); // 'overview' | 'logs'
  const [live, setLive] = useState(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const refreshRef = useRef(null);

  const apiFetch = useCallback(async function(url) {
    const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');
    const key = typeof window !== 'undefined'
      ? (localStorage.getItem('ADMIN_API_KEY') || process.env.NEXT_PUBLIC_ADMIN_API_KEY || '')
      : (process.env.NEXT_PUBLIC_ADMIN_API_KEY || '');
    const fullUrl = url.startsWith('http') ? url : (base + url);
    const res = await fetch(fullUrl, { headers: key ? { 'x-admin-key': key } : {} });
    if (!res.ok) throw new Error('' + res.status);
    return res.json();
  }, []);

  const loadLive = useCallback(async function() {
    try {
      const [status, channelsRes, crawlerSt, scrapers] = await Promise.all([
        apiFetch('/api/admin/status').catch(function() { return {}; }),
        apiFetch('/api/channels?limit=200').catch(function() { return { channels: [] }; }),
        apiFetch('/api/crawler/status').catch(function() { return null; }),
        apiFetch('/api/admin/scrapers/status').catch(function() { return null; }),
      ]);
      setLive({
        status,
        channels: channelsRes.channels || channelsRes || [],
        crawlerSt,
        scrapers,
      });
    } finally {
      setLiveLoading(false);
    }
  }, [apiFetch]);

  useEffect(function() {
    loadLive();
    refreshRef.current = setInterval(loadLive, 30000);
    return function() { clearInterval(refreshRef.current); };
  }, [loadLive]);

  // Reset to overview tab when switching nodes
  function selectNode(id) {
    if (selected === id) { setSelected(null); return; }
    setSelected(id);
    setPanelTab('overview');
  }

  const nodeMap = {};
  NODES.forEach(function(n) { nodeMap[n.id] = n; });
  const selectedNode = selected ? nodeMap[selected] : null;
  const hasLogs = selectedNode && selectedNode.logSource !== null;

  return (
    <AdminShell title="Pipeline Flow">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes flowDot {
          0%   { stroke-dashoffset: 400; opacity: 0.8; }
          85%  { opacity: 0.8; }
          100% { stroke-dashoffset: 0;   opacity: 0; }
        }
        .pnode { cursor: pointer; transition: filter 0.15s, transform 0.15s; }
        .pnode:hover { filter: brightness(1.1); transform: translateY(-2px); }
        .rpanel {
          position: fixed; top: 0; right: 0; bottom: 0;
          width: min(560px, 92vw);
          background: #0d1117; border-left: 1px solid rgba(255,255,255,0.07);
          z-index: 200; display: flex; flex-direction: column;
          box-shadow: -16px 0 48px rgba(0,0,0,0.6);
          animation: slideIn 0.18s ease;
        }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .rpanel-body { overflow-y: auto; flex: 1; padding: 0 26px 44px; }
        .tab-btn {
          padding: 6px 16px; border: none; background: none;
          font-size: 0.78rem; font-weight: 600; cursor: pointer;
          border-bottom: 2px solid transparent; color: #64748b;
          transition: color 0.12s, border-color 0.12s;
        }
        .tab-btn.active { color: #e2e8f0; border-bottom-color: var(--tc); }
        .tab-btn:hover { color: #cbd5e1; }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>

      {/* Toolbar */}
      <div style={{ padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: '0.77rem', color: '#475569' }}>
          {NODES.length} nodes · {EDGES.length} edges
          {liveLoading && <span className="pulse" style={{ marginLeft: 10, color: '#60a5fa' }}>⟳ loading live data…</span>}
          {!liveLoading && live && <span style={{ marginLeft: 10, color: '#10B981', fontSize: '0.7rem' }}>● live · refreshes every 30s</span>}
        </div>
        {selected && (
          <button onClick={function() { setSelected(null); }} style={{
            marginLeft: 'auto', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#64748b', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: '0.78rem',
          }}>✕ close</button>
        )}
      </div>

      {/* Canvas */}
      <div style={{ padding: '0 24px 60px', overflowX: 'auto' }}>
        <div style={{ position: 'relative', width: CANVAS_W, height: CANVAS_H }}>

          {/* SVG edges */}
          <svg width={CANVAS_W} height={CANVAS_H} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}>
            <defs>
              <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="rgba(148,163,184,0.35)" />
              </marker>
            </defs>
            {selectedNode && (
              <ellipse cx={selectedNode.cx} cy={selectedNode.cy}
                rx={(selectedNode.shape === 'diamond' ? DW : W) * 0.75}
                ry={(selectedNode.shape === 'diamond' ? DH : H) * 0.85}
                fill={selectedNode.color} fillOpacity="0.1" />
            )}
            {EDGES.map(function(e, i) {
              const fn = nodeMap[e.from], tn = nodeMap[e.to];
              const p = edgePath(fn, tn);
              const mx = (fn.cx + tn.cx) / 2, my = (fn.cy + tn.cy) / 2;
              const hi = selected === e.from || selected === e.to;
              return (
                <g key={i}>
                  <path d={p} fill="none" stroke={hi ? fn.color : 'rgba(255,255,255,0.08)'} strokeWidth={hi ? 1.8 : 1.5} markerEnd="url(#arr)" />
                  <path d={p} fill="none" stroke={fn.color} strokeWidth="2" strokeOpacity="0.5"
                    strokeDasharray="8 6"
                    style={{ strokeDashoffset: 400, animation: 'flowDot ' + (1.5 + i * 0.22) + 's linear infinite' }} />
                  <text x={mx + 4} y={my - 5} textAnchor="middle" fontSize="9.5"
                    fill={hi ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.2)'}
                    fontFamily="ui-monospace,monospace">{e.label}</text>
                </g>
              );
            })}
          </svg>

          {/* Node cards */}
          {NODES.map(function(n) {
            const sel = selected === n.id;
            const stat = nodeStats(n.id, live);
            // Worker online dot for scraper
            const scraperDots = n.id === 'scraper' && live && live.scrapers && live.scrapers.workers;

            if (n.shape === 'diamond') {
              return (
                <div key={n.id} className="pnode" onClick={function() { selectNode(n.id); }}
                  style={{ position: 'absolute', left: n.cx - DW / 2, top: n.cy - DH / 2, width: DW, height: DH, userSelect: 'none' }}>
                  <div style={{
                    position: 'absolute', inset: 0,
                    clipPath: 'polygon(50% 2%, 98% 50%, 50% 98%, 2% 50%)',
                    background: sel
                      ? 'linear-gradient(135deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04))'
                      : 'rgba(10,14,20,0.97)',
                    border: '1.5px solid ' + (sel ? n.color : 'rgba(255,255,255,0.15)'),
                    boxShadow: sel ? '0 0 28px ' + n.color + '40' : '0 2px 14px rgba(0,0,0,0.4)',
                  }} />
                  <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 34px' }}>
                    <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{n.icon}</span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: sel ? '#f1f5f9' : '#fde68a', lineHeight: 1.25, marginTop: 4 }}>{n.label}</span>
                  </div>
                  {sel && <div style={{ position: 'absolute', top: 8, right: DW / 2 - 4, width: 7, height: 7, borderRadius: '50%', background: n.color, boxShadow: '0 0 7px ' + n.color }} />}
                </div>
              );
            }

            return (
              <div key={n.id} className="pnode" onClick={function() { selectNode(n.id); }}
                style={{
                  position: 'absolute', left: n.cx - W / 2, top: n.cy - H / 2,
                  width: W, height: H,
                  background: sel
                    ? 'linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))'
                    : 'rgba(10,14,20,0.97)',
                  borderTop: '1.5px solid ' + (sel ? n.color : 'rgba(255,255,255,0.08)'),
                  borderRight: '1.5px solid ' + (sel ? n.color : 'rgba(255,255,255,0.08)'),
                  borderBottom: '1.5px solid ' + (sel ? n.color : 'rgba(255,255,255,0.08)'),
                  borderLeft: '4px solid ' + n.color,
                  borderRadius: 10,
                  padding: '10px 12px',
                  boxShadow: sel
                    ? '0 0 28px ' + n.color + '40, 0 4px 20px rgba(0,0,0,0.5)'
                    : '0 2px 14px rgba(0,0,0,0.4)',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center',
                  userSelect: 'none',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: stat ? 4 : 0 }}>
                  <span style={{ fontSize: '1.05rem', lineHeight: 1 }}>{n.icon}</span>
                  <span style={{ fontSize: '0.76rem', fontWeight: 700, color: sel ? '#f1f5f9' : '#cbd5e1', lineHeight: 1.2 }}>{n.label}</span>
                  {sel && <div style={{ marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%', background: n.color, boxShadow: '0 0 7px ' + n.color }} />}
                </div>
                {stat && <div style={{ fontSize: '0.65rem', color: '#64748b', paddingLeft: 26, lineHeight: 1.3, marginBottom: 3 }}>{stat}</div>}
                {/* Scraper worker dots */}
                {scraperDots && (
                  <div style={{ display: 'flex', gap: 5, paddingLeft: 26, marginTop: 3 }}>
                    {live.scrapers.workers.map(function(w) {
                      return (
                        <div key={w.name} title={w.name + (w.online ? ' · ' + w.latencyMs + 'ms' : ' · offline')}
                          style={{ width: 7, height: 7, borderRadius: '50%', background: w.online ? '#10B981' : '#EF4444', boxShadow: '0 0 4px ' + (w.online ? '#10B981' : '#EF4444') }} />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right panel */}
      {selected && selectedNode && (
        <div className="rpanel">
          {/* Header */}
          <div style={{ padding: '20px 22px 0', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.45rem' }}>{selectedNode.icon}</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 700, color: '#f1f5f9' }}>{selectedNode.label}</h2>
                  <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 1 }}>{selectedNode.sub}</div>
                </div>
              </div>
              <button onClick={function() { setSelected(null); }}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1rem', padding: '4px 6px' }}>✕</button>
            </div>
            <div style={{ width: 36, height: 2.5, background: selectedNode.color, borderRadius: 2, marginTop: 12 }} />

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 2, marginTop: 14, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <button className={'tab-btn' + (panelTab === 'overview' ? ' active' : '')}
                style={{ '--tc': selectedNode.color }}
                onClick={function() { setPanelTab('overview'); }}>Overview</button>
              {hasLogs && (
                <button className={'tab-btn' + (panelTab === 'logs' ? ' active' : '')}
                  style={{ '--tc': selectedNode.color }}
                  onClick={function() { setPanelTab('logs'); }}>Recent Logs</button>
              )}
            </div>
          </div>

          {/* Panel body */}
          <div className="rpanel-body" style={{ paddingTop: 18 }}>
            {panelTab === 'overview'
              ? <OverviewContent nodeId={selected} apiFetch={apiFetch} live={live} />
              : <LogViewer apiFetch={apiFetch} nodeId={selected} scrapers={live && live.scrapers} />
            }
          </div>
        </div>
      )}
    </AdminShell>
  );
}
