'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import AdminShell from '@/components/admin-shell';

const formatCurrency = (amount, country = 'IN') => {
  if (amount === undefined || amount === null || isNaN(amount)) return '—';
  const num = parseFloat(amount);
  const symbol = country === 'US' ? '$' : '₹';
  return `${symbol}${num.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

const formatTimeAgo = (isoString) => {
  if (!isoString) return 'Just now';
  const date = new Date(isoString);
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
};

const MERCHANT_COLORS = {
  amazon: { bg: 'rgba(255, 153, 0, 0.12)', fg: '#ea580c', border: 'rgba(255, 153, 0, 0.3)' },
  flipkart: { bg: 'rgba(40, 116, 240, 0.12)', fg: '#2563eb', border: 'rgba(40, 116, 240, 0.3)' },
  myntra: { bg: 'rgba(255, 63, 108, 0.12)', fg: '#e11d48', border: 'rgba(255, 63, 108, 0.3)' },
  nykaa: { bg: 'rgba(252, 39, 121, 0.12)', fg: '#db2777', border: 'rgba(252, 39, 121, 0.3)' },
  ajio: { bg: 'rgba(44, 65, 82, 0.12)', fg: '#334155', border: 'rgba(44, 65, 82, 0.3)' },
  meesho: { bg: 'rgba(244, 51, 151, 0.12)', fg: '#c026d3', border: 'rgba(244, 51, 151, 0.3)' },
  croma: { bg: 'rgba(0, 185, 163, 0.12)', fg: '#0d9488', border: 'rgba(0, 185, 163, 0.3)' },
};

function getMerchantBadge(merchant = 'amazon') {
  const m = (merchant || 'amazon').toLowerCase().trim();
  const theme = MERCHANT_COLORS[m] || { bg: 'rgba(100, 116, 139, 0.12)', fg: '#475569', border: 'rgba(100, 116, 139, 0.3)' };
  return (
    <span style={{
      padding: '2px 8px',
      fontSize: '0.72rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      borderRadius: 4,
      background: theme.bg,
      color: theme.fg,
      border: `1px solid ${theme.border}`,
      letterSpacing: '0.04em',
    }}>
      {m}
    </span>
  );
}

function getDeviceIcon(device = 'desktop') {
  if (device === 'mobile_android') return <span title="Android Deep-Link" style={{ color: '#16a34a', fontWeight: 700 }}>🤖 Android App</span>;
  if (device === 'mobile_ios') return <span title="iOS Safari" style={{ color: '#0284c7', fontWeight: 700 }}>🍎 iOS Mobile</span>;
  return <span title="Desktop Browser" style={{ color: '#64748b' }}>💻 Desktop</span>;
}

function getSourceBadge(source = 'web') {
  const map = {
    wa: { label: 'WhatsApp', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.1)' },
    whatsapp: { label: 'WhatsApp', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.1)' },
    tg_deals: { label: 'Telegram Broadcast', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.1)' },
    telegram: { label: 'Telegram', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.1)' },
    tg: { label: 'Telegram Broadcast', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.1)' },
    web_pdp: { label: 'Web PDP', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.1)' },
    web_deal_card: { label: 'Web Deal Feed', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.1)' },
    web: { label: 'Web', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.1)' },
    twitter_us: { label: 'Twitter US Bot', color: '#0f172a', bg: 'rgba(15, 23, 42, 0.1)' },
    alert_bot: { label: 'Price Alert Bot', color: '#d97706', bg: 'rgba(217, 119, 6, 0.1)' },
    replenishment_nudge: { label: 'Replenish Nudge', color: '#9333ea', bg: 'rgba(147, 51, 234, 0.1)' },
  };
  const item = map[source] || { label: source, color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)' };
  return (
    <span style={{
      fontSize: '0.72rem',
      fontWeight: 600,
      padding: '2px 7px',
      borderRadius: 4,
      background: item.bg,
      color: item.color,
    }}>
      {item.label}
    </span>
  );
}

export default function ClicksAnalyticsPage() {
  const [range, setRange] = useState('7d');
  const [country, setCountry] = useState('ALL');
  const [merchant, setMerchant] = useState('ALL');
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Paginated live click stream
  const [clickPage, setClickPage] = useState(1);
  const [clicksData, setClicksData] = useState({ clicks: [], total: 0, totalPages: 1 });
  const [clicksLoading, setClicksLoading] = useState(false);

  const apiFetch = useCallback(async (endpoint, options = {}) => {
    const adminApiKey = typeof window !== 'undefined'
      ? (localStorage.getItem('ADMIN_API_KEY') || process.env.NEXT_PUBLIC_ADMIN_API_KEY || '')
      : (process.env.NEXT_PUBLIC_ADMIN_API_KEY || '');
    const headers = {
      ...(options.headers || {}),
      ...(adminApiKey ? { 'x-admin-key': adminApiKey } : {}),
    };
    return await fetch(endpoint, { ...options, headers });
  }, []);

  const fetchAnalytics = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const params = new URLSearchParams();
      if (range) params.set('range', range);
      if (country && country !== 'ALL') params.set('country', country);
      if (merchant && merchant !== 'ALL') params.set('merchant', merchant);

      const res = await apiFetch(`/api/admin/revenue/analytics?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setAnalytics(json);
      }
    } catch (err) {
      console.error('Failed to load click analytics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range, country, merchant, apiFetch]);

  const fetchClicks = useCallback(async (page = 1) => {
    try {
      setClicksLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      });
      if (country && country !== 'ALL') params.set('country', country);
      if (merchant && merchant !== 'ALL') params.set('merchant', merchant);

      const res = await apiFetch(`/api/admin/revenue/clicks?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setClicksData(json);
        setClickPage(page);
      }
    } catch (err) {
      console.error('Failed to fetch clicks:', err);
    } finally {
      setClicksLoading(false);
    }
  }, [country, merchant, apiFetch]);

  useEffect(() => {
    fetchAnalytics();
    fetchClicks(1);
  }, [fetchAnalytics, fetchClicks]);

  // Seed demo clicks if pool is completely dry
  const handleSeedDemo = async () => {
    try {
      setSeeding(true);
      const res = await apiFetch('/api/admin/revenue/seed-demo', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        await fetchAnalytics(true);
        await fetchClicks(1);
      }
    } catch (e) {
      console.error('Seeding error:', e);
    } finally {
      setSeeding(false);
    }
  };

  const metrics = analytics?.metrics || {
    totalClicks: 0,
    failoverClicks: 0,
  };

  const waClicks = useMemo(() => {
    if (!analytics?.bySource) return 0;
    const wa = analytics.bySource.find((s) => s.source === 'wa' || s.source === 'whatsapp');
    return wa ? wa.clicks : 0;
  }, [analytics]);

  const mobileClicks = useMemo(() => {
    if (!analytics?.byDevice) return 0;
    return analytics.byDevice
      .filter((d) => d.device === 'mobile_android' || d.device === 'mobile_ios')
      .reduce((sum, d) => sum + (d.count || 0), 0);
  }, [analytics]);

  const mobilePct = metrics.totalClicks > 0
    ? Math.round((mobileClicks / metrics.totalClicks) * 100)
    : 0;

  const waPct = metrics.totalClicks > 0
    ? Math.round((waClicks / metrics.totalClicks) * 100)
    : 0;

  return (
    <AdminShell title="Outbound Clicks & Traffic Analytics">
      <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
        
        {/* Header Title & Subtitle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="material-symbols-outlined" style={{ fontSize: '2rem', color: '#2563eb' }}>ads_click</span>
              Outbound Clicks & Traffic Analytics
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
              Real-time outbound link tracking: live click stream, store distribution, channel attribution (WhatsApp, Telegram, Web), and device routing.
            </p>
          </div>

          {/* Quick Actions & Seeding Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {metrics.totalClicks === 0 && (
              <button
                onClick={handleSeedDemo}
                disabled={seeding}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
                  background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', border: '1px solid rgba(59, 130, 246, 0.3)',
                  fontWeight: 600, fontSize: '0.84rem', cursor: seeding ? 'wait' : 'pointer'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>auto_awesome</span>
                {seeding ? 'Generating...' : 'Seed Sample Clicks'}
              </button>
            )}

            <button
              onClick={() => { fetchAnalytics(true); fetchClicks(clickPage); }}
              disabled={refreshing}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
                background: 'var(--bg-panel-solid)', color: 'var(--text-main)', border: '1px solid var(--border)',
                fontWeight: 600, fontSize: '0.84rem', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>refresh</span>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14,
          padding: '12px 18px', background: 'var(--bg-panel-solid)', borderRadius: 10, border: '1px solid var(--border)',
          marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          {/* Time Range Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: 4 }}>Period:</span>
            {[
              { id: '24h', label: '24 Hours' },
              { id: '7d', label: '7 Days' },
              { id: '30d', label: '30 Days' },
              { id: 'all', label: 'All Time' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setRange(p.id)}
                style={{
                  padding: '5px 12px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                  border: range === p.id ? '1px solid #2563eb' : '1px solid var(--border)',
                  background: range === p.id ? '#2563eb' : 'transparent',
                  color: range === p.id ? '#ffffff' : 'var(--text-main)',
                  transition: 'all 0.15s ease'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Country Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Country:</span>
            {[
              { id: 'ALL', label: '🌐 All' },
              { id: 'IN', label: '🇮🇳 India' },
              { id: 'US', label: '🇺🇸 USA' },
            ].map((c) => (
              <button
                key={c.id}
                onClick={() => setCountry(c.id)}
                style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                  border: country === c.id ? '1px solid #059669' : '1px solid var(--border)',
                  background: country === c.id ? 'rgba(5, 150, 105, 0.1)' : 'transparent',
                  color: country === c.id ? '#059669' : 'var(--text-main)',
                }}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Store Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Store:</span>
            <select
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              style={{
                padding: '5px 10px', borderRadius: 6, fontSize: '0.8rem', border: '1px solid var(--border)',
                background: 'var(--background)', color: 'var(--text-main)', fontWeight: 600
              }}
            >
              <option value="ALL">All Stores</option>
              <option value="amazon">Amazon</option>
              <option value="flipkart">Flipkart</option>
              <option value="nykaa">Nykaa</option>
              <option value="myntra">Myntra</option>
              <option value="ajio">Ajio</option>
              <option value="meesho">Meesho</option>
              <option value="croma">Croma</option>
            </select>
          </div>
        </div>

        {/* Pure Click Metrics KPI Cards Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
          marginBottom: 28,
        }}>
          {/* Card 1: Total Outbound Clicks */}
          <div style={{
            background: 'var(--bg-panel-solid)', padding: '20px', borderRadius: 12, border: '1px solid var(--border)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)', position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Outbound Clicks</span>
              <span className="material-symbols-outlined" style={{ color: '#2563eb', fontSize: '1.5rem' }}>ads_click</span>
            </div>
            <div style={{ fontSize: '2.1rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>
              {metrics.totalClicks.toLocaleString()}
            </div>
            <div style={{ marginTop: 8, fontSize: '0.78rem', color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>check_circle</span>
              100% Tracked Store Redirects
            </div>
          </div>

          {/* Card 2: WhatsApp Channel Traffic */}
          <div style={{
            background: 'var(--bg-panel-solid)', padding: '20px', borderRadius: 12, border: '1px solid var(--border)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)', position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>WhatsApp Clicks</span>
              <span className="material-symbols-outlined" style={{ color: '#16a34a', fontSize: '1.5rem' }}>chat</span>
            </div>
            <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#16a34a', lineHeight: 1 }}>
              {waClicks.toLocaleString()}
            </div>
            <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {waPct}% of All Outbound Traffic
            </div>
          </div>

          {/* Card 3: Mobile App Deep-Links */}
          <div style={{
            background: 'var(--bg-panel-solid)', padding: '20px', borderRadius: 12, border: '1px solid var(--border)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)', position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase' }}>Mobile App Deep-Links</span>
              <span className="material-symbols-outlined" style={{ color: '#7c3aed', fontSize: '1.5rem' }}>smartphone</span>
            </div>
            <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#7c3aed', lineHeight: 1 }}>
              {mobileClicks.toLocaleString()}
            </div>
            <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {mobilePct}% opened in Amazon/Flipkart App
            </div>
          </div>

          {/* Card 4: OOS Failover Rescues */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(238, 242, 255, 0.7), rgba(243, 232, 255, 0.7))',
            padding: '20px', borderRadius: 12, border: '1px solid rgba(99, 102, 241, 0.3)',
            boxShadow: '0 2px 4px rgba(99, 102, 241, 0.06)', position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase' }}>OOS Failover Saves</span>
              <span className="material-symbols-outlined" style={{ color: '#4f46e5', fontSize: '1.5rem' }}>swap_horiz</span>
            </div>
            <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#4f46e5', lineHeight: 1 }}>
              {metrics.failoverClicks} Clicks
            </div>
            <div style={{ marginTop: 8, fontSize: '0.78rem', color: '#4338ca', fontWeight: 600 }}>
              Redirected from OOS to active merchant
            </div>
          </div>
        </div>

        {/* Middle Two-Column Grid: Store Distribution & Channel Distribution */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20, marginBottom: 28 }}>
          
          {/* Panel 1: Store Distribution & Click Share */}
          <div style={{
            background: 'var(--bg-panel-solid)', borderRadius: 12, border: '1px solid var(--border)',
            padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
          }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ color: '#2563eb' }}>storefront</span>
              Store Distribution & Click Share
            </h3>

            {(!analytics?.byMerchant || analytics.byMerchant.length === 0) ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No clicks recorded for this period yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {analytics.byMerchant.map((m) => {
                  const pctOfTotal = metrics.totalClicks > 0 ? Math.round((m.clicks / metrics.totalClicks) * 100) : 0;
                  return (
                    <div key={m.merchant} style={{ padding: '10px 14px', background: 'var(--bg-dark)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {getMerchantBadge(m.merchant)}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                            {m.clicks.toLocaleString()} clicks
                          </span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 8, fontWeight: 600 }}>
                            ({pctOfTotal}%)
                          </span>
                        </div>
                      </div>
                      <div style={{ width: '100%', height: 6, background: 'rgba(203, 213, 225, 0.5)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pctOfTotal}%`, height: '100%', background: '#2563eb', borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Panel 2: Acquisition Channel Distribution */}
          <div style={{
            background: 'var(--bg-panel-solid)', borderRadius: 12, border: '1px solid var(--border)',
            padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
          }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ color: '#059669' }}>hub</span>
              Acquisition Channel Distribution
            </h3>

            {(!analytics?.bySource || analytics.bySource.length === 0) ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No channel data recorded yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {analytics.bySource.map((s) => {
                  const pct = metrics.totalClicks > 0 ? Math.round((s.clicks / metrics.totalClicks) * 100) : 0;
                  return (
                    <div key={s.source} style={{ padding: '10px 14px', background: 'var(--bg-dark)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {getSourceBadge(s.source)}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                            {s.clicks.toLocaleString()} clicks
                          </span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 8, fontWeight: 600 }}>
                            ({pct}%)
                          </span>
                        </div>
                      </div>
                      <div style={{ width: '100%', height: 6, background: 'rgba(203, 213, 225, 0.5)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: '#059669', borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Device summary bar */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>
                DEVICE ROUTING DISTRIBUTION
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {(analytics?.byDevice || []).map((d) => (
                  <div key={d.device} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}>
                    {getDeviceIcon(d.device)}: <strong style={{ color: 'var(--text-main)' }}>{d.count}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Top Clicked Products */}
        <div style={{
          background: 'var(--bg-panel-solid)', borderRadius: 12, border: '1px solid var(--border)',
          padding: '20px', marginBottom: 28, boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ color: '#d97706' }}>trophy</span>
            Top 10 Most Clicked Products
          </h3>

          {(!analytics?.topProducts || analytics.topProducts.length === 0) ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No clicked products recorded yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.76rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 12px', width: 40 }}>#</th>
                    <th style={{ padding: '8px 12px' }}>Product Title</th>
                    <th style={{ padding: '8px 12px' }}>Store</th>
                    <th style={{ padding: '8px 12px' }}>Price</th>
                    <th style={{ padding: '8px 12px' }}>Clicks</th>
                    <th style={{ padding: '8px 12px' }}>Click Share</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topProducts.map((p, idx) => {
                    const sharePct = metrics.totalClicks > 0 ? Math.round((p.clicks / metrics.totalClicks) * 100) : 0;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)', height: 48 }}>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 700 }}>{idx + 1}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-main)', maxWidth: 450, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.title}
                        </td>
                        <td style={{ padding: '10px 12px' }}>{getMerchantBadge(p.merchant)}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700 }}>{formatCurrency(p.price, p.country)}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 800, color: '#2563eb' }}>{p.clicks}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>{sharePct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 4: Live Outbound Click Stream */}
        <div style={{
          background: 'var(--bg-panel-solid)', borderRadius: 12, border: '1px solid var(--border)',
          padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ color: '#0284c7' }}>stream</span>
              Live Outbound Click Stream ({clicksData.total.toLocaleString()} Total)
            </h3>
            
            {/* Pagination Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                disabled={clickPage <= 1 || clicksLoading}
                onClick={() => fetchClicks(clickPage - 1)}
                style={{
                  padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--background)',
                  cursor: clickPage <= 1 ? 'not-allowed' : 'pointer', opacity: clickPage <= 1 ? 0.5 : 1
                }}
              >
                Previous
              </button>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Page {clickPage} of {clicksData.totalPages || 1}
              </span>
              <button
                disabled={clickPage >= clicksData.totalPages || clicksLoading}
                onClick={() => fetchClicks(clickPage + 1)}
                style={{
                  padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--background)',
                  cursor: clickPage >= clicksData.totalPages ? 'not-allowed' : 'pointer', opacity: clickPage >= clicksData.totalPages ? 0.5 : 1
                }}
              >
                Next
              </button>
            </div>
          </div>

          {clicksLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading real-time clicks...
            </div>
          ) : clicksData.clicks.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No outbound clicks logged yet. Clicks will automatically appear here when shoppers click deal links.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 12px' }}>Time</th>
                    <th style={{ padding: '8px 12px' }}>Product Title</th>
                    <th style={{ padding: '8px 12px' }}>Store</th>
                    <th style={{ padding: '8px 12px' }}>Channel</th>
                    <th style={{ padding: '8px 12px' }}>Device</th>
                    <th style={{ padding: '8px 12px' }}>Price</th>
                    <th style={{ padding: '8px 12px' }}>Routing Status</th>
                  </tr>
                </thead>
                <tbody>
                  {clicksData.clicks.map((c) => (
                    <tr key={c._id} style={{ borderBottom: '1px solid var(--border)', height: 46 }}>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        {formatTimeAgo(c.createdAt)}
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-main)', maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.title}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {getMerchantBadge(c.merchant)}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {getSourceBadge(c.source)}
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: '0.78rem' }}>
                        {getDeviceIcon(c.device)}
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 700 }}>
                        {formatCurrency(c.dealPrice, c.country)}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {c.isFailover ? (
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(99, 102, 241, 0.15)', color: '#4f46e5' }}>
                            ⚡ OOS Failover
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'rgba(22, 163, 74, 0.1)', color: '#16a34a' }}>
                            ✓ Direct Tag
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </AdminShell>
  );
}
