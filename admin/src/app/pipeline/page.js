'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminShell from '@/components/admin-shell';

/* ─── Node layout ─────────────────────────────────────────────────────────── */
const W = 164, H = 72;    // card dimensions
const NODES = [
  { id: 'telegram',    label: 'Telegram Sources',   sub: 'GramJS live capture',    icon: '💬', color: '#2CA5E0', cx: 155, cy: 80  },
  { id: 'crawler',     label: 'Bestseller Crawler', sub: '24 h scheduled run',     icon: '🔍', color: '#F59E0B', cx: 595, cy: 80  },
  { id: 'bullmq',      label: 'BullMQ Queue',       sub: 'Redis priority broker',  icon: '⚡', color: '#8B5CF6', cx: 375, cy: 225 },
  { id: 'scraper',     label: 'Scraping Engine',    sub: 'ScrapingAnt + Chrome',   icon: '🕷️', color: '#EF4444', cx: 375, cy: 375 },
  { id: 'products',    label: 'Product DB',          sub: 'MongoDB Atlas',          icon: '📦', color: '#10B981', cx: 375, cy: 525 },
  { id: 'synthesizer', label: 'Deal Synthesizer',   sub: '≥15 % drop detector',   icon: '🎯', color: '#F97316', cx: 375, cy: 675 },
  { id: 'tg-out',      label: 'Telegram Alerts',    sub: 'Deal channels',          icon: '📢', color: '#2CA5E0', cx: 95,  cy: 830 },
  { id: 'web',         label: 'Web & App Feed',     sub: 'shopscanner.store',      icon: '🌐', color: '#3B82F6', cx: 375, cy: 830 },
  { id: 'x-bot',       label: 'Twitter / X Bot',    sub: 'Auto-tweets USA',        icon: '🐦', color: '#64748B', cx: 655, cy: 830 },
];

const EDGES = [
  { from: 'telegram',    to: 'bullmq',      label: 'Priority 2' },
  { from: 'crawler',     to: 'bullmq',      label: 'Priority 4' },
  { from: 'bullmq',      to: 'scraper',     label: '1 req / 2.5 s' },
  { from: 'scraper',     to: 'products',    label: 'upsert' },
  { from: 'products',    to: 'synthesizer', label: 'price delta' },
  { from: 'synthesizer', to: 'tg-out',      label: 'deal alert' },
  { from: 'synthesizer', to: 'web',         label: 'active deal' },
  { from: 'synthesizer', to: 'x-bot',       label: 'tweet' },
];

/* ─── Helper: bezier path between two nodes ──────────────────────────────── */
function edgePath(fromNode, toNode) {
  const x1 = fromNode.cx, y1 = fromNode.cy + H / 2;
  const x2 = toNode.cx,   y2 = toNode.cy - H / 2;
  const cy = (y1 + y2) / 2;
  return 'M ' + x1 + ' ' + y1 + ' C ' + x1 + ' ' + cy + ', ' + x2 + ' ' + cy + ', ' + x2 + ' ' + y2;
}

/* ─── Small UI components ─────────────────────────────────────────────────── */
function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
      <div style={{ width: 24, height: 24, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#60a5fa', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
}
function Stat({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{label}</span>
      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: accent || '#e2e8f0' }}>{value}</span>
    </div>
  );
}
function StatMini({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '1.1rem', fontWeight: 800, color }}>{value != null ? value : '—'}</div>
      <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{label}</div>
    </div>
  );
}

/* ─── Panel content components ────────────────────────────────────────────── */
function TelegramPanel({ apiFetch }) {
  const [channels, setChannels] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    apiFetch('/api/channels?limit=50')
      .then(d => setChannels(d.channels || d))
      .catch(e => setErr(e.message));
  }, [apiFetch]);

  if (err) return <p style={{ color: '#f87171', padding: 16 }}>Error: {err}</p>;
  if (!channels) return <Spinner />;

  const active = channels.filter(c => c.isActive !== false);
  return (
    <div>
      <Stat label="Total channels" value={channels.length} />
      <Stat label="Active" value={active.length} accent="#10B981" />
      <div style={{ marginTop: 16 }}>
        {channels.map(ch => (
          <div key={ch._id} style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '10px 12px', marginBottom: 8,
            borderLeft: '3px solid ' + (ch.isActive !== false ? '#10B981' : '#6b7280'),
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{ch.name || ch.username}</span>
              <span style={{
                background: ch.isActive !== false ? 'rgba(16,185,129,0.15)' : 'rgba(107,114,128,0.2)',
                color: ch.isActive !== false ? '#6ee7b7' : '#9ca3af',
                borderRadius: 4, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600,
              }}>
                {ch.isActive !== false ? 'ACTIVE' : 'PAUSED'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: '0.75rem', color: '#94a3b8' }}>
              <span>💬 {(ch.messagesCapturedCount || 0).toLocaleString()} msgs</span>
              <span>🎯 {(ch.dealsProducedCount || 0).toLocaleString()} deals</span>
              {ch.country && <span>🌍 {ch.country}</span>}
            </div>
            {ch.lastMessageAt && (
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 3 }}>
                Last: {new Date(ch.lastMessageAt).toLocaleString()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CrawlerPanel({ apiFetch }) {
  const [status, setStatus] = useState(null);
  const [seeds, setSeeds] = useState(null);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    Promise.all([
      apiFetch('/api/crawler/status'),
      apiFetch('/api/crawler/seeds?limit=100'),
    ]).then(function(results) {
      setStatus(results[0]);
      setSeeds(results[1].seeds || results[1]);
    }).catch(function() {});
  }, [apiFetch]);

  const runNow = function() {
    setRunning(true);
    apiFetch('/api/crawler/run-now').catch(function() {}).finally(function() { setRunning(false); });
  };

  const byCategory = {};
  (seeds || []).forEach(function(s) {
    const cat = s.category || 'other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(s);
  });

  return (
    <div>
      {status && (
        <div>
          <Stat label="Interval" value={(status.intervalHours || 24) + ' h'} />
          <Stat label="Status" value={status.isRunning ? '🟢 Running' : '⚪ Idle'} />
          {status.lastRunAt && (
            <Stat label="Last run" value={new Date(status.lastRunAt).toLocaleString()} />
          )}
          {status.lastRunStats && (
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 12, marginTop: 12 }}>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 4 }}>Last run stats</div>
              <div style={{ display: 'flex', gap: 16, fontSize: '0.8rem' }}>
                <span>🔍 {status.lastRunStats.seedsCrawled} seeds</span>
                <span>📦 +{status.lastRunStats.productsEnrolled} enrolled</span>
                <span>🔄 {status.lastRunStats.productsUpdated} updated</span>
              </div>
            </div>
          )}
          <button onClick={runNow} disabled={running} style={{
            marginTop: 14, padding: '8px 18px',
            background: running ? '#374151' : '#F59E0B',
            color: running ? '#9ca3af' : '#000',
            border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.8rem',
            cursor: running ? 'not-allowed' : 'pointer',
          }}>
            {running ? 'Starting…' : '▶ Run Now'}
          </button>
        </div>
      )}
      {seeds && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            Seeds ({seeds.length})
          </div>
          {Object.entries(byCategory).map(function([cat, items]) {
            return (
              <div key={cat} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: '0.75rem', color: '#F59E0B', fontWeight: 700, marginBottom: 6, textTransform: 'capitalize' }}>
                  📂 {cat} ({items.length})
                </div>
                {items.map(function(s) {
                  return (
                    <div key={s._id} style={{
                      background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '7px 10px',
                      marginBottom: 5, borderLeft: '2px solid ' + (s.isEnabled !== false ? '#F59E0B' : '#374151'),
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span style={{ fontWeight: 600 }}>{s.keywords || s.subcategory}</span>
                        <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{s.store}</span>
                      </div>
                      {s.lastResult && (
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 2 }}>
                          Found: {s.lastResult.found || 0} · Enrolled: {s.lastResult.enrolled || 0}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ScraperPanel({ apiFetch }) {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    apiFetch('/api/admin/scrapers/status').then(setStatus).catch(function() {});
  }, [apiFetch]);

  if (!status) return <Spinner />;

  return (
    <div>
      <Stat label="Queue length" value={status.queueLength != null ? status.queueLength : '—'} accent="#8B5CF6" />
      <Stat label="Active jobs" value={status.activeJobs != null ? status.activeJobs : '—'} />
      <Stat label="Workers" value={status.workerCount != null ? status.workerCount : '—'} />
      {status.tokenStats && (
        <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
            Token pool
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <StatMini label="Active" value={status.tokenStats.active} color="#10B981" />
            <StatMini label="Exhausted" value={status.tokenStats.exhausted} color="#EF4444" />
            <StatMini label="Total" value={status.tokenStats.total} color="#94a3b8" />
          </div>
        </div>
      )}
      <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 12 }}>
        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
          Rate limiter
        </div>
        <div style={{ fontSize: '0.8rem', color: '#e2e8f0' }}>1 request every 2.5 s (global)</div>
        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 4 }}>Country proxy: IN &amp; US</div>
      </div>
    </div>
  );
}

function StatusPanel({ apiFetch, nodeId }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    apiFetch('/api/admin/status').then(setData).catch(function() {});
  }, [apiFetch]);

  if (!data) return <Spinner />;

  if (nodeId === 'bullmq') return (
    <div>
      <Stat label="Queue length" value={(data.queueLength || 0).toLocaleString()} accent="#8B5CF6" />
      <Stat label="Deals today" value={(data.dealsToday || 0).toLocaleString()} />
      <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 12 }}>
        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Priority tiers</div>
        {[
          { p: 1, label: 'User re-check (urgent)', color: '#EF4444' },
          { p: 2, label: 'Telegram deal', color: '#2CA5E0' },
          { p: 3, label: '24h refresh', color: '#10B981' },
          { p: 4, label: 'Bestseller crawler', color: '#F59E0B' },
        ].map(function(r) {
          return (
            <div key={r.p} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ background: r.color, color: '#fff', borderRadius: 4, padding: '1px 7px', fontSize: '0.7rem', fontWeight: 700 }}>P{r.p}</span>
              <span style={{ fontSize: '0.78rem', color: '#e2e8f0' }}>{r.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (nodeId === 'products') return (
    <div>
      <Stat label="Total products" value={(data.totalProducts || 0).toLocaleString()} accent="#10B981" />
      <Stat label="New 24h" value={(data.products24h || 0).toLocaleString()} />
      <Stat label="Updated 24h" value={(data.productsUpdated24h || 0).toLocaleString()} />
    </div>
  );

  if (nodeId === 'synthesizer') return (
    <div>
      <Stat label="Deals today" value={(data.dealsToday || 0).toLocaleString()} accent="#F97316" />
      <Stat label="Total deals" value={(data.totalDeals || 0).toLocaleString()} />
      <Stat label="Active deals" value={(data.activeDeals || 0).toLocaleString()} />
      <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 12 }}>
        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Detection rule</div>
        <div style={{ fontSize: '0.82rem', color: '#e2e8f0' }}>≥ 15% price drop vs historical min</div>
        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 4 }}>Checks Products collection on each scrape</div>
      </div>
    </div>
  );

  if (nodeId === 'tg-out') return (
    <div>
      <Stat label="Total users" value={(data.totalUsers || 0).toLocaleString()} accent="#2CA5E0" />
      <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 12, fontSize: '0.8rem', color: '#e2e8f0' }}>
        Broadcasts rich HTML deal messages to subscribed Telegram channels with price badges, discount %, affiliate links.
      </div>
    </div>
  );

  if (nodeId === 'web') return (
    <div>
      <Stat label="Total products" value={(data.totalProducts || 0).toLocaleString()} accent="#3B82F6" />
      <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 12, fontSize: '0.8rem', color: '#e2e8f0' }}>
        Frontend deal feed at{' '}
        <a href="https://shopscanner.store" target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>
          shopscanner.store
        </a>
        . Live price tracking + cubic spline charts + Algolia search.
      </div>
    </div>
  );

  if (nodeId === 'x-bot') return (
    <div>
      <div style={{ marginTop: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 12, fontSize: '0.8rem', color: '#e2e8f0' }}>
        Automated Twitter/X bot posting verified US deals. Scheduled posting windows, media uploads, affiliate link injection.
      </div>
    </div>
  );

  return null;
}

/* ─── Main page ───────────────────────────────────────────────────────────── */
export default function PipelinePage() {
  const [selected, setSelected] = useState(null);
  const apiFetch = useCallback(async function(url) {
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');
    const adminKey = typeof window !== 'undefined' ? (localStorage.getItem('ADMIN_API_KEY') || '') : '';
    const fullUrl = url.startsWith('http') ? url : (apiBase + url);
    const res = await fetch(fullUrl, { headers: adminKey ? { 'x-admin-key': adminKey } : {} });
    if (!res.ok) throw new Error('' + res.status);
    return res.json();
  }, []);

  const nodeMap = {};
  NODES.forEach(function(n) { nodeMap[n.id] = n; });

  const selectedNode = selected ? nodeMap[selected] : null;

  function getPanelContent() {
    if (!selected) return null;
    if (selected === 'telegram')    return <TelegramPanel apiFetch={apiFetch} />;
    if (selected === 'crawler')     return <CrawlerPanel  apiFetch={apiFetch} />;
    if (selected === 'scraper')     return <ScraperPanel  apiFetch={apiFetch} />;
    return <StatusPanel apiFetch={apiFetch} nodeId={selected} />;
  }

  const CANVAS_W = 750, CANVAS_H = 920;

  return (
    <AdminShell title="Pipeline Flow">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes flowDot {
          0%   { stroke-dashoffset: 300; opacity: 1; }
          80%  { opacity: 1; }
          100% { stroke-dashoffset: 0;   opacity: 0; }
        }
        .pipeline-node {
          cursor: pointer;
          transition: filter 0.15s, box-shadow 0.15s, transform 0.15s;
          user-select: none;
        }
        .pipeline-node:hover { filter: brightness(1.12); transform: translateY(-2px); }
        .panel-slide {
          position: fixed; top: 0; right: 0; bottom: 0; width: 380px;
          background: #0d1117; border-left: 1px solid rgba(255,255,255,0.08);
          z-index: 200; overflow-y: auto; padding: 24px;
          box-shadow: -12px 0 40px rgba(0,0,0,0.6);
          animation: slideIn 0.2s ease;
        }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>

      {/* Toolbar */}
      <div style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
          Click any node to open its control panel &nbsp;·&nbsp; {NODES.length} nodes &nbsp;·&nbsp; {EDGES.length} connections
        </div>
        {selected && (
          <button
            onClick={function() { setSelected(null); }}
            style={{
              marginLeft: 'auto', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8',
              borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: '0.8rem',
            }}
          >
            ✕ Close panel
          </button>
        )}
      </div>

      {/* Canvas */}
      <div style={{ padding: '0 24px 60px', overflowX: 'auto' }}>
        <div style={{ position: 'relative', width: CANVAS_W, height: CANVAS_H }}>

          {/* SVG edges */}
          <svg
            width={CANVAS_W} height={CANVAS_H}
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}
          >
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="rgba(148,163,184,0.4)" />
              </marker>
            </defs>

            {/* Glow under selected */}
            {selectedNode && (
              <ellipse
                cx={selectedNode.cx} cy={selectedNode.cy}
                rx={W * 0.8} ry={H * 0.9}
                fill={selectedNode.color}
                fillOpacity="0.12"
              />
            )}

            {/* Edges */}
            {EDGES.map(function(e, i) {
              const fn = nodeMap[e.from], tn = nodeMap[e.to];
              const p = edgePath(fn, tn);
              const mx = (fn.cx + tn.cx) / 2, my = (fn.cy + tn.cy) / 2;
              const isHighlighted = selected === e.from || selected === e.to;
              return (
                <g key={i}>
                  {/* Base static line */}
                  <path
                    d={p} fill="none"
                    stroke={isHighlighted ? fn.color : 'rgba(148,163,184,0.15)'}
                    strokeWidth={isHighlighted ? 2 : 1.5}
                    markerEnd="url(#arrowhead)"
                  />
                  {/* Animated flow dots */}
                  <path
                    d={p} fill="none"
                    stroke={fn.color}
                    strokeWidth="2"
                    strokeOpacity="0.55"
                    strokeDasharray="8 6"
                    style={{
                      strokeDashoffset: 300,
                      animation: 'flowDot ' + (1.6 + i * 0.25) + 's linear infinite',
                    }}
                  />
                  {/* Edge label */}
                  <text
                    x={mx + 6} y={my - 5}
                    textAnchor="middle" fontSize="10"
                    fill={isHighlighted ? 'rgba(255,255,255,0.5)' : 'rgba(148,163,184,0.35)'}
                    fontFamily="ui-monospace, monospace"
                  >
                    {e.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Node cards */}
          {NODES.map(function(n) {
            const isSelected = selected === n.id;
            return (
              <div
                key={n.id}
                className="pipeline-node"
                onClick={function() { setSelected(isSelected ? null : n.id); }}
                style={{
                  position: 'absolute',
                  left: n.cx - W / 2,
                  top: n.cy - H / 2,
                  width: W, height: H,
                  background: isSelected
                    ? 'linear-gradient(135deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.04) 100%)'
                    : 'rgba(13,17,23,0.96)',
                  border: '1.5px solid ' + (isSelected ? n.color : 'rgba(255,255,255,0.1)'),
                  borderLeft: '4px solid ' + n.color,
                  borderRadius: 10,
                  padding: '10px 12px',
                  boxShadow: isSelected
                    ? '0 0 24px ' + n.color + '44, 0 4px 24px rgba(0,0,0,0.5)'
                    : '0 2px 16px rgba(0,0,0,0.35)',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: '1.05rem', lineHeight: 1 }}>{n.icon}</span>
                  <span style={{ fontSize: '0.77rem', fontWeight: 700, color: isSelected ? '#f1f5f9' : '#cbd5e1', lineHeight: 1.25 }}>
                    {n.label}
                  </span>
                </div>
                <span style={{ fontSize: '0.65rem', color: '#64748b', paddingLeft: 26, lineHeight: 1.3 }}>{n.sub}</span>
                {/* Selected indicator dot */}
                {isSelected && (
                  <div style={{
                    position: 'absolute', top: 7, right: 8,
                    width: 7, height: 7, borderRadius: '50%',
                    background: n.color,
                    boxShadow: '0 0 8px ' + n.color,
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right control panel */}
      {selected && selectedNode && (
        <div className="panel-slide">
          {/* Panel header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.5rem' }}>{selectedNode.icon}</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#f1f5f9' }}>
                    {selectedNode.label}
                  </h2>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 1 }}>{selectedNode.sub}</div>
                </div>
              </div>
              <div style={{ width: 44, height: 3, background: selectedNode.color, borderRadius: 2, marginTop: 12 }} />
            </div>
            <button
              onClick={function() { setSelected(null); }}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.1rem', padding: '4px 6px', lineHeight: 1 }}
            >
              ✕
            </button>
          </div>

          {/* Dynamic panel content */}
          {getPanelContent()}
        </div>
      )}
    </AdminShell>
  );
}
