'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminShell from '@/components/admin-shell';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:3001';

function getAdminKey() {
  if (typeof localStorage === 'undefined') return process.env.NEXT_PUBLIC_ADMIN_API_KEY || '';
  return localStorage.getItem('ADMIN_API_KEY') || process.env.NEXT_PUBLIC_ADMIN_API_KEY || '';
}

function apiFetch(path, opts = {}) {
  const key = getAdminKey();
  return fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { ...(opts.headers || {}), ...(key ? { 'x-admin-key': key } : {}) },
  });
}

function fmtNum(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-IN');
}

function fmtDuration(ms) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function relTime(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const SOURCE_COLORS = {
  daily_refresh: '#3b82f6',
  telegram: '#f59e0b',
  interactive: '#10b981',
  bestseller_crawler: '#8b5cf6',
  manual_rescrape: '#ec4899',
  other: '#6b7280',
};

const MERCHANT_COLORS = {
  amazon: '#f97316',
  flipkart: '#3b82f6',
  myntra: '#ec4899',
  nykaa: '#ef4444',
  ajio: '#8b5cf6',
  shopsy: '#10b981',
  meesho: '#f59e0b',
  croma: '#06b6d4',
  unknown: '#6b7280',
};

// Simple bar chart rendered as CSS
function MiniBar({ value, max, color = '#3b82f6', label }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <span style={{ width: 100, fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ width: 48, fontSize: '0.72rem', color: 'var(--text-main)', textAlign: 'right', fontWeight: 700 }}>{fmtNum(value)}</span>
    </div>
  );
}

// Sparkline: array of {date, count} → SVG
function Sparkline({ data, color = '#3b82f6', height = 36 }) {
  if (!data || data.length < 2) return <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>no data</span>;
  const values = data.map((d) => d.count || 0);
  const max = Math.max(...values, 1);
  const w = 120;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = height - (v / max) * height;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={height} style={{ display: 'block' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

// Stat tile
function StatTile({ label, value, sub, color }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', minWidth: 140 }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: color || 'var(--text-main)', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export default function ScrapingFrequencyPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview'); // overview | products | tokens | stale
  const [productUrl, setProductUrl] = useState('');
  const [productData, setProductData] = useState(null);
  const [productLoading, setProductLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch(`/api/admin/scraping-frequency?days=${days}`);
      const json = await r.json();
      if (json.success) setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const loadProduct = async () => {
    if (!productUrl.trim()) return;
    setProductLoading(true);
    setProductData(null);
    try {
      const r = await apiFetch(`/api/admin/scraping-frequency/product?url=${encodeURIComponent(productUrl.trim())}`);
      const json = await r.json();
      if (json.success) setProductData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setProductLoading(false);
    }
  };

  // Build source totals from daily data
  const sourceTotals = {};
  if (data?.dailyBySource) {
    for (const row of data.dailyBySource) {
      for (const [k, v] of Object.entries(row)) {
        if (k === 'date') continue;
        sourceTotals[k] = (sourceTotals[k] || 0) + v;
      }
    }
  }
  const maxSourceTotal = Math.max(...Object.values(sourceTotals), 1);

  const merchantTotals = {};
  if (data?.dailyByMerchant) {
    for (const row of data.dailyByMerchant) {
      for (const [k, v] of Object.entries(row)) {
        if (k === 'date') continue;
        merchantTotals[k] = (merchantTotals[k] || 0) + v;
      }
    }
  }
  const maxMerchantTotal = Math.max(...Object.values(merchantTotals), 1);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'products', label: 'Top / Stale Products' },
    { id: 'tokens', label: 'Token Usage' },
    { id: 'lookup', label: 'Product Lookup' },
  ];

  return (
    <AdminShell>
      <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              Scraping Frequency
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              How often each product is scraped, by source and merchant. Use this to balance token capacity.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {[7, 14, 30, 60].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                style={{
                  padding: '5px 12px', borderRadius: 7, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                  background: days === d ? '#3b82f6' : 'var(--card)',
                  color: days === d ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${days === d ? '#3b82f6' : 'var(--border)'}`,
                }}
              >{d}d</button>
            ))}
            <button
              onClick={load}
              style={{ padding: '5px 12px', borderRadius: 7, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            >↻ Refresh</button>
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading frequency data…</div>
        )}

        {!loading && data && (
          <>
            {/* Stat tiles */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
              <StatTile label="Total Scrapes" value={fmtNum(data.overview?.totalScrapes)} sub={`Last ${days} days`} />
              <StatTile label="Avg / Day" value={fmtNum(data.overview?.avgScrapesPerDay)} sub="across all merchants" color="#3b82f6" />
              <StatTile label="Unique Products" value={fmtNum(data.overview?.uniqueProductsScraped)} sub="scraped in period" color="#8b5cf6" />
              <StatTile label="Success Rate" value={`${data.overview?.successRate ?? '—'}%`} sub="of all scrapes" color={data.overview?.successRate >= 90 ? '#10b981' : '#f59e0b'} />
              <StatTile label="Avg Duration" value={fmtDuration(data.overview?.avgDurationMs)} sub="per scrape" />
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    padding: '8px 16px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                    background: 'transparent', border: 'none',
                    borderBottom: tab === t.id ? '2px solid #3b82f6' : '2px solid transparent',
                    color: tab === t.id ? '#3b82f6' : 'var(--text-muted)',
                    marginBottom: -1,
                  }}
                >{t.label}</button>
              ))}
            </div>

            {/* ── OVERVIEW TAB ── */}
            {tab === 'overview' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* By Source */}
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 14, color: 'var(--text-main)' }}>
                    Scrapes by Source ({days}d)
                  </div>
                  {Object.entries(sourceTotals).sort((a, b) => b[1] - a[1]).map(([src, count]) => (
                    <MiniBar key={src} label={src.replace(/_/g, ' ')} value={count} max={maxSourceTotal} color={SOURCE_COLORS[src] || '#6b7280'} />
                  ))}
                  <div style={{ marginTop: 12, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    daily_refresh = cron job · telegram = new deal posted · interactive = on-demand
                  </div>
                </div>

                {/* By Merchant */}
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 14, color: 'var(--text-main)' }}>
                    Scrapes by Merchant ({days}d)
                  </div>
                  {Object.entries(merchantTotals).sort((a, b) => b[1] - a[1]).map(([m, count]) => (
                    <MiniBar key={m} label={m} value={count} max={maxMerchantTotal} color={MERCHANT_COLORS[m] || '#6b7280'} />
                  ))}
                </div>

                {/* Status breakdown */}
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 14, color: 'var(--text-main)' }}>
                    Scrape Outcomes
                  </div>
                  {(data.byStatus || []).map(({ _id, count }) => {
                    const color = _id === 'success' ? '#10b981' : _id === 'error' ? '#ef4444' : '#f59e0b';
                    return (
                      <div key={_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '0.8rem', color, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
                          {_id}
                        </span>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>{fmtNum(count)}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 6 }}>
                            ({Math.round((count / data.overview?.totalScrapes) * 100)}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Daily trend mini-chart (text-based) */}
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 12, color: 'var(--text-main)' }}>
                    Daily Trend (last {Math.min(days, 14)} days)
                  </div>
                  {(() => {
                    const recent = data.dailyBySource.slice(-14);
                    const maxDay = Math.max(...recent.map((r) => {
                      const total = Object.entries(r).reduce((s, [k, v]) => k !== 'date' ? s + v : s, 0);
                      return total;
                    }), 1);
                    return recent.map((row) => {
                      const total = Object.entries(row).reduce((s, [k, v]) => k !== 'date' ? s + v : s, 0);
                      const pct = Math.round((total / maxDay) * 100);
                      return (
                        <div key={row.date} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                          <span style={{ width: 54, fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{row.date?.slice(5)}</span>
                          <div style={{ flex: 1, height: 10, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: '#3b82f6', borderRadius: 3 }} />
                          </div>
                          <span style={{ width: 40, fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-main)', textAlign: 'right' }}>{fmtNum(total)}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* ── TOP / STALE TAB ── */}
            {tab === 'products' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Most-scraped */}
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 4, color: 'var(--text-main)' }}>
                    🔥 Most Scraped Products
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 14 }}>
                    Highest token consumption — consider capping refresh frequency
                  </div>
                  {(data.topProducts || []).map((p, i) => (
                    <div key={p.url} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', minWidth: 20 }}>#{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.title || p.url.split('/').slice(-2).join('/')}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.68rem', background: MERCHANT_COLORS[p.merchant] + '22', color: MERCHANT_COLORS[p.merchant] || '#6b7280', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>{p.merchant}</span>
                          {(p.sources || []).map((s) => (
                            <span key={s} style={{ fontSize: '0.68rem', background: SOURCE_COLORS[s] + '22', color: SOURCE_COLORS[s] || '#6b7280', padding: '1px 6px', borderRadius: 4 }}>{s.replace('_', ' ')}</span>
                          ))}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f59e0b' }}>{p.totalScrapes}×</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{p.avgPerDay}/day · {p.successRate}% ✓</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Stalest / under-scraped */}
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 4, color: 'var(--text-main)' }}>
                    🕰️ Stalest Products
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 14 }}>
                    Active products not scraped recently — price data may be stale
                  </div>
                  {(data.bottomProducts || []).map((p) => {
                    const stale = p.daysSinceLastScrape;
                    const color = stale == null ? '#6b7280' : stale > 14 ? '#ef4444' : stale > 7 ? '#f59e0b' : '#10b981';
                    return (
                      <div key={p._id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.title || '—'}
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                            <span style={{ fontSize: '0.68rem', background: MERCHANT_COLORS[p.merchant] + '22', color: MERCHANT_COLORS[p.merchant] || '#6b7280', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>{p.merchant}</span>
                            {p.price && <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>₹{fmtNum(p.price)}</span>}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 800, color }}>{stale != null ? `${stale}d` : 'never'}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>since last scrape</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── TOKEN USAGE TAB ── */}
            {tab === 'tokens' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, maxWidth: 700 }}>
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 4, color: 'var(--text-main)' }}>
                    ScrapingAnt Token Consumption ({days}d)
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                    How many scrapes each API token/account has handled. Use this to distribute load and monitor quota.
                  </div>
                  {(data.tokenConsumption || []).length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No token usage data in this period.</div>
                  ) : (
                    <>
                      {(() => {
                        const maxTok = Math.max(...data.tokenConsumption.map((t) => t.count), 1);
                        return data.tokenConsumption.map((t) => (
                          <div key={t._id} style={{ marginBottom: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-main)', fontFamily: 'monospace', fontWeight: 600 }}>
                                {t._id?.slice(0, 24) || '—'}…
                              </span>
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                {fmtNum(t.count)} · {Math.round((t.successCount / t.count) * 100)}% ✓
                              </span>
                            </div>
                            <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ width: `${Math.round((t.count / maxTok) * 100)}%`, height: '100%', background: '#8b5cf6', borderRadius: 4 }} />
                            </div>
                          </div>
                        ));
                      })()}
                      <div style={{ marginTop: 20, padding: '12px 14px', background: 'rgba(59,130,246,0.07)', borderRadius: 8, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        💡 <strong>Capacity planning:</strong> Total {fmtNum(data.overview?.totalScrapes)} scrapes over {days} days = <strong>{fmtNum(data.overview?.avgScrapesPerDay)} scrapes/day</strong> on average.
                        Each token has its own concurrency/quota. If one token is consuming significantly more than others, consider redistributing.
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── PRODUCT LOOKUP TAB ── */}
            {tab === 'lookup' && (
              <div style={{ maxWidth: 760 }}>
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 12, color: 'var(--text-main)' }}>
                    Look up a specific product&apos;s scrape history
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      value={productUrl}
                      onChange={(e) => setProductUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && loadProduct()}
                      placeholder="Paste product cleanUrl, e.g. https://www.amazon.in/dp/B07FS7C7B8"
                      style={{
                        flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                        background: 'var(--bg)', color: 'var(--text-main)', fontSize: '0.8rem',
                      }}
                    />
                    <button
                      onClick={loadProduct}
                      disabled={productLoading}
                      style={{ padding: '8px 18px', borderRadius: 8, background: '#3b82f6', color: '#fff', fontWeight: 700, fontSize: '0.8rem', border: 'none', cursor: 'pointer' }}
                    >{productLoading ? 'Loading…' : 'Lookup'}</button>
                  </div>
                </div>

                {productData && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Product info */}
                    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: 4 }}>
                        {productData.product?.title || productData.product?.cleanUrl}
                      </div>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <div><span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total scrapes</span><br /><strong>{fmtNum(productData.stats?.totalScrapes)}</strong></div>
                        <div><span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Success rate</span><br /><strong style={{ color: productData.stats?.successRate >= 90 ? '#10b981' : '#f59e0b' }}>{productData.stats?.successRate}%</strong></div>
                        <div><span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>First seen</span><br /><strong>{productData.stats?.firstSeen ? new Date(productData.stats.firstSeen).toLocaleDateString('en-IN') : '—'}</strong></div>
                        <div><span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Last scraped</span><br /><strong>{relTime(productData.stats?.lastSeen)}</strong></div>
                      </div>
                    </div>

                    {/* Source breakdown */}
                    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: 10, color: 'var(--text-main)' }}>Source Breakdown</div>
                      {(productData.sourceBreakdown || []).map((s) => (
                        <div key={s._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: '0.8rem' }}>
                          <span style={{ color: SOURCE_COLORS[s._id] || '#6b7280', fontWeight: 700 }}>{s._id}</span>
                          <div style={{ display: 'flex', gap: 16 }}>
                            <span><strong>{fmtNum(s.count)}</strong> <span style={{ color: 'var(--text-muted)' }}>scrapes</span></span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>last {relTime(s.lastAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Daily breakdown (last 30d) */}
                    {productData.dailyBreakdown?.length > 0 && (
                      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: 10, color: 'var(--text-main)' }}>Daily Activity (last 30d)</div>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 48 }}>
                          {(() => {
                            const maxCount = Math.max(...productData.dailyBreakdown.map((d) => d.count), 1);
                            return productData.dailyBreakdown.map((d) => (
                              <div key={d._id} title={`${d._id}: ${d.count} scrapes`} style={{ flex: 1, background: '#3b82f6', borderRadius: '2px 2px 0 0', height: `${Math.max((d.count / maxCount) * 100, 4)}%`, minHeight: 4, cursor: 'default' }} />
                            ));
                          })()}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                          <span>{productData.dailyBreakdown[0]?._id}</span>
                          <span>{productData.dailyBreakdown[productData.dailyBreakdown.length - 1]?._id}</span>
                        </div>
                      </div>
                    )}

                    {/* Recent scrape log */}
                    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: 10, color: 'var(--text-main)' }}>Recent Scrape Events</div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                              {['Time', 'Source', 'Status', 'Duration', 'Price', 'MRP'].map((h) => (
                                <th key={h} style={{ padding: '4px 8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(productData.recentLogs || []).map((log, i) => {
                              const statusColor = log.status === 'success' ? '#10b981' : '#ef4444';
                              return (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                  <td style={{ padding: '5px 8px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{relTime(log.createdAt)}</td>
                                  <td style={{ padding: '5px 8px', color: SOURCE_COLORS[log.source] || '#6b7280', fontWeight: 600 }}>{log.source}</td>
                                  <td style={{ padding: '5px 8px', color: statusColor, fontWeight: 700 }}>{log.status}</td>
                                  <td style={{ padding: '5px 8px', color: 'var(--text-muted)' }}>{fmtDuration(log.durationMs)}</td>
                                  <td style={{ padding: '5px 8px', fontWeight: 700, color: 'var(--text-main)' }}>{log.extractedData?.price ? `₹${fmtNum(log.extractedData.price)}` : '—'}</td>
                                  <td style={{ padding: '5px 8px', color: 'var(--text-muted)' }}>{log.extractedData?.originalPrice ? `₹${fmtNum(log.extractedData.originalPrice)}` : '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}
