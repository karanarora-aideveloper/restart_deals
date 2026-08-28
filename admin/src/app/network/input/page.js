'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';

const formatTime = (isoString) => {
  if (!isoString) return 'N/A';
  const date = new Date(isoString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Compact "3d ago" style age, so a stale channel is obvious at a glance without doing
// date arithmetic in your head.
const formatAge = (isoString) => {
  if (!isoString) return null;
  const diffMs = Date.now() - new Date(isoString).getTime();
  if (diffMs < 0) return 'just now';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
};

// Deals produced per message captured — the objective read on whether a source is pulling
// its weight. Null when there's no traffic yet (0/0 is "no data", not "0%").
const computeYield = (c) => {
  const messages = c.messagesCapturedCount || 0;
  const deals = c.dealsProducedCount || 0;
  if (messages === 0) return null;
  return (deals / messages) * 100;
};

// A data-backed hint for channels nobody has reviewed yet. Deliberately conservative — it
// only speaks up once there's enough traffic to mean something, and it never auto-applies.
const relevanceSuggestion = (c) => {
  if ((c.relevance || 'unreviewed') !== 'unreviewed') return null;
  const messages = c.messagesCapturedCount || 0;
  const deals = c.dealsProducedCount || 0;
  if (messages >= 20 && deals === 0) return { verdict: 'not_relevant', label: 'no deals from 20+ msgs' };
  if (deals >= 5) return { verdict: 'relevant', label: `${deals} deals produced` };
  return null;
};

const COUNTRIES = ['IN', 'US', 'UK', 'CA', 'AU'];

export default function ChannelsPage() {
  const [channels, setChannels] = useState([]);
  const [stats, setStats] = useState({});
  const [channelsSearch, setChannelsSearch] = useState('');
  const [channelsStatus, setChannelsStatus] = useState('all');
  const [channelsCountry, setChannelsCountry] = useState('all');
  const [channelsCategory, setChannelsCategory] = useState('all');
  const [channelsRelevance, setChannelsRelevance] = useState('all');
  // Decluttering, not a real filter — on by default so channels you've already dismissed
  // stop cluttering the list. Picking "Not Relevant" from the Relevance dropdown still shows
  // them regardless (that's an explicit ask to see exactly those), see fetchChannels below.
  const [hideNotRelevant, setHideNotRelevant] = useState(true);
  const [channelsSelectedIds, setChannelsSelectedIds] = useState([]);
  const [masterCategories, setMasterCategories] = useState([]);
  const [apiBase, setApiBase] = useState(process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:3001');

  useEffect(() => {
  }, []);

  const apiFetch = useCallback(async (endpoint, options = {}) => {
    const base = apiBase.replace(/\/+$/, '');
    const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;
    return fetch(url, options);
  }, [apiBase]);

  // Same Master-driven category list the Output Destinations page uses, so input and output
  // sides can never drift onto different vocabularies.
  const fetchMasterCategories = useCallback(async () => {
    try {
      const res = await apiFetch('/api/master/category');
      if (res.ok) {
        const data = await res.json();
        setMasterCategories(data.data || []);
      }
    } catch (err) {
      console.error('Fetch categories error:', err);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchMasterCategories();
  }, [fetchMasterCategories]);

  const categoryLabels = useMemo(() => {
    const map = { auto: 'Auto (AI)' };
    for (const cat of masterCategories) map[cat.value] = cat.label;
    return map;
  }, [masterCategories]);

  const fetchChannels = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        status: channelsStatus,
        country: channelsCountry,
        category: channelsCategory,
        relevance: channelsRelevance,
        hideNotRelevant: String(hideNotRelevant),
        q: channelsSearch
      });
      const res = await apiFetch(`/api/channels?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      setChannels(data.channels || data.data || []);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      console.error('Fetch channels error:', err);
    }
  }, [apiFetch, channelsStatus, channelsCountry, channelsCategory, channelsRelevance, hideNotRelevant, channelsSearch]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const patchChannel = useCallback(async (id, path, body, failLabel) => {
    try {
      const res = await apiFetch(`/api/channels/${id}/${path}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || failLabel);
      fetchChannels();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }, [apiFetch, fetchChannels]);

  const handleToggleChannelStatus = useCallback((id, currentStatus) => (
    patchChannel(id, 'status', { isActive: !currentStatus }, 'Failed to update channel')
  ), [patchChannel]);

  const handleUpdateChannelCountry = useCallback((id, country) => (
    patchChannel(id, 'country', { country }, 'Failed to update country')
  ), [patchChannel]);

  const handleUpdateChannelCategory = useCallback((id, category) => (
    patchChannel(id, 'category', { category }, 'Failed to update category')
  ), [patchChannel]);

  // Clicking the already-active verdict clears it back to unreviewed, so a mis-click is
  // one click to undo rather than a dead end.
  const handleSetRelevance = useCallback((c, verdict) => {
    const current = c.relevance || 'unreviewed';
    const next = current === verdict ? 'unreviewed' : verdict;
    if (next === 'not_relevant' && c.isActive) {
      const name = c.name || c.username || c.channelId;
      if (!window.confirm(`Mark "${name}" as not relevant?\n\nThis also switches monitoring OFF so no more scrape/AI budget is spent on it.`)) return;
    }
    return patchChannel(c._id, 'relevance', { relevance: next }, 'Failed to update relevance');
  }, [patchChannel]);

  const handleBulkChannelAction = useCallback(async (action, extraData = {}) => {
    if (channelsSelectedIds.length === 0) return;
    try {
      let endpoint = '';
      const payload = { channelIds: channelsSelectedIds, ...extraData };
      if (action === 'enable') {
        endpoint = '/api/channels/bulk-status';
        payload.isActive = true;
      } else if (action === 'disable') {
        endpoint = '/api/channels/bulk-status';
        payload.isActive = false;
      } else if (action === 'country') {
        endpoint = '/api/channels/bulk-country';
      } else if (action === 'category') {
        endpoint = '/api/channels/bulk-category';
      } else if (action === 'relevance') {
        endpoint = '/api/channels/bulk-relevance';
        if (extraData.relevance === 'not_relevant' &&
            !window.confirm(`Mark ${channelsSelectedIds.length} channels as not relevant?\n\nThis also switches monitoring OFF for all of them.`)) return;
      } else if (action === 'delete') {
        endpoint = '/api/channels/bulk-delete';
        if (!window.confirm(`Are you sure you want to delete ${channelsSelectedIds.length} channels?`)) return;
      }
      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Bulk action failed');
      setChannelsSelectedIds([]);
      fetchChannels();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }, [apiFetch, fetchChannels, channelsSelectedIds]);

  const [channelSortField, setChannelSortField] = useState(null);
  const [channelSortOrder, setChannelSortOrder] = useState('asc');

  const handleSort = useCallback((field) => {
    if (channelSortField === field) {
      if (channelSortOrder === 'asc') {
        setChannelSortOrder('desc');
      } else {
        setChannelSortField(null);
        setChannelSortOrder('asc');
      }
    } else {
      setChannelSortField(field);
      setChannelSortOrder('asc');
    }
  }, [channelSortField, channelSortOrder]);

  const renderSortIcon = useCallback((field) => {
    if (channelSortField !== field) {
      return <span className="material-symbols-outlined text-[14px] text-muted-foreground/40 ml-1 opacity-60">unfold_more</span>;
    }
    return channelSortOrder === 'asc' ? (
      <span className="material-symbols-outlined text-[14px] text-foreground font-bold ml-1">arrow_upward</span>
    ) : (
      <span className="material-symbols-outlined text-[14px] text-foreground font-bold ml-1">arrow_downward</span>
    );
  }, [channelSortField, channelSortOrder]);

  const sortChannelList = useCallback((list) => {
    if (!channelSortField) return list;
    return [...list].sort((a, b) => {
      let aVal, bVal;
      if (channelSortField === 'name') {
        aVal = (a.name || a.title || a.username || '').toLowerCase();
        bVal = (b.name || b.title || b.username || '').toLowerCase();
      } else if (channelSortField === 'messagesCapturedCount' || channelSortField === 'dealsProducedCount') {
        aVal = parseFloat(a[channelSortField] || 0);
        bVal = parseFloat(b[channelSortField] || 0);
      } else if (channelSortField === 'yield') {
        // No-traffic channels sort below 0% rather than above it — "no data" is not a win.
        aVal = computeYield(a) ?? -1;
        bVal = computeYield(b) ?? -1;
      } else if (channelSortField === 'lastMessageAt' || channelSortField === 'lastDealAt') {
        aVal = new Date(a[channelSortField] || 0).getTime();
        bVal = new Date(b[channelSortField] || 0).getTime();
      } else if (channelSortField === 'relevance') {
        aVal = a.relevance || 'unreviewed';
        bVal = b.relevance || 'unreviewed';
      } else {
        aVal = (a[channelSortField] || '').toString().toLowerCase();
        bVal = (b[channelSortField] || '').toString().toLowerCase();
      }
      if (aVal < bVal) return channelSortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return channelSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [channelSortField, channelSortOrder]);

  // Split into channels the Telegram account behind TELEGRAM_SESSION actually created
  // (Telegram's `creator` flag, synced via scripts/sync_channel_ownership.js) vs. every
  // other third-party channel just being scraped for deals.
  const myChannels = useMemo(() => sortChannelList(channels.filter(c => c.isOwner)), [channels, sortChannelList]);
  const otherChannels = useMemo(() => sortChannelList(channels.filter(c => !c.isOwner)), [channels, sortChannelList]);

  const renderRelevanceCell = (c) => {
    const current = c.relevance || 'unreviewed';
    const suggestion = relevanceSuggestion(c);
    const baseBtn = {
      padding: '2px 7px',
      fontSize: '0.7rem',
      fontWeight: 600,
      borderRadius: 6,
      cursor: 'pointer',
      lineHeight: 1.5,
      whiteSpace: 'nowrap'
    };
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className="btn"
            title={current === 'relevant' ? 'Click again to clear this verdict' : 'Mark as relevant to the deals system'}
            style={{
              ...baseBtn,
              background: current === 'relevant' ? 'var(--success)' : 'rgba(0,0,0,0.05)',
              color: current === 'relevant' ? 'white' : 'var(--text-muted)',
              border: current === 'relevant' ? '1px solid var(--success)' : '1px solid var(--border)'
            }}
            onClick={() => handleSetRelevance(c, 'relevant')}
          >
            ✓ Relevant
          </button>
          <button
            className="btn"
            title={current === 'not_relevant' ? 'Click again to clear this verdict' : 'Mark as not relevant — also switches monitoring off'}
            style={{
              ...baseBtn,
              background: current === 'not_relevant' ? 'var(--danger)' : 'rgba(0,0,0,0.05)',
              color: current === 'not_relevant' ? 'white' : 'var(--text-muted)',
              border: current === 'not_relevant' ? '1px solid var(--danger)' : '1px solid var(--border)'
            }}
            onClick={() => handleSetRelevance(c, 'not_relevant')}
          >
            ✕ Not
          </button>
        </div>
        {suggestion && (
          <span
            title={`Suggestion based on this channel's own numbers: ${suggestion.label}. Nothing is applied until you click.`}
            style={{
              fontSize: '0.65rem',
              color: suggestion.verdict === 'relevant' ? 'var(--success)' : 'var(--danger)'
            }}
          >
            ⓘ suggests {suggestion.verdict === 'relevant' ? 'relevant' : 'not relevant'} — {suggestion.label}
          </span>
        )}
        {current !== 'unreviewed' && c.relevanceReviewedAt && (
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            reviewed {formatAge(c.relevanceReviewedAt)}
          </span>
        )}
      </div>
    );
  };

  const renderChannelTable = (list, emptyLabel) => (
    <div className="mt-4 px-4 pb-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 text-center">
              <input
                type="checkbox"
                className="rounded border-border cursor-pointer"
                checked={list.length > 0 && list.every(c => channelsSelectedIds.includes(c._id))}
                onChange={(e) => {
                  const ids = list.map(c => c._id);
                  if (e.target.checked) {
                    setChannelsSelectedIds(prev => Array.from(new Set([...prev, ...ids])));
                  } else {
                    setChannelsSelectedIds(prev => prev.filter(id => !ids.includes(id)));
                  }
                }}
              />
            </TableHead>
            <TableHead className="cursor-pointer select-none" onClick={() => handleSort('name')}>
              <div className="flex items-center">
                Channel {renderSortIcon('name')}
              </div>
            </TableHead>
            <TableHead className="cursor-pointer select-none" onClick={() => handleSort('country')}>
              <div className="flex items-center">
                Country {renderSortIcon('country')}
              </div>
            </TableHead>
            <TableHead className="cursor-pointer select-none" onClick={() => handleSort('category')}>
              <div className="flex items-center">
                Category {renderSortIcon('category')}
              </div>
            </TableHead>
            <TableHead className="cursor-pointer select-none" onClick={() => handleSort('yield')}>
              <div className="flex items-center">
                Messages → Deals {renderSortIcon('yield')}
              </div>
            </TableHead>
            <TableHead className="cursor-pointer select-none" onClick={() => handleSort('lastMessageAt')}>
              <div className="flex items-center">
                Last Activity {renderSortIcon('lastMessageAt')}
              </div>
            </TableHead>
            <TableHead className="cursor-pointer select-none" onClick={() => handleSort('relevance')}>
              <div className="flex items-center">
                Relevance {renderSortIcon('relevance')}
              </div>
            </TableHead>
            <TableHead className="cursor-pointer select-none" onClick={() => handleSort('isActive')}>
              <div className="flex items-center">
                Status {renderSortIcon('isActive')}
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((c) => {
            const isSelected = channelsSelectedIds.includes(c._id);
            const messages = c.messagesCapturedCount || 0;
            const deals = c.dealsProducedCount || 0;
            const yieldPct = computeYield(c);
            const yieldColor = yieldPct === null
              ? 'var(--text-muted)'
              : yieldPct === 0 ? 'var(--danger)' : yieldPct >= 10 ? 'var(--success)' : '#d97706';
            return (
              <TableRow key={c._id} data-state={isSelected ? 'selected' : undefined}>
                <TableCell className="text-center">
                  <input
                    type="checkbox"
                    className="rounded border-border cursor-pointer"
                    checked={isSelected}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setChannelsSelectedIds([...channelsSelectedIds, c._id]);
                      } else {
                        setChannelsSelectedIds(channelsSelectedIds.filter(id => id !== c._id));
                      }
                    }}
                  />
                </TableCell>
                <TableCell>
                  <div className="font-medium text-foreground">
                    {c.name || c.title || c.username || 'Untitled Channel'}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {c.username ? `@${String(c.username).replace('@', '')} · ` : ''}{c.channelId}
                  </div>
                </TableCell>
                <TableCell>
                  <select
                    className="filter-select"
                    style={{ padding: '2px 6px', fontSize: '0.8rem' }}
                    value={c.country || 'IN'}
                    onChange={(e) => handleUpdateChannelCountry(c._id, e.target.value)}
                  >
                    {COUNTRIES.map(code => <option key={code} value={code}>{code}</option>)}
                  </select>
                </TableCell>
                <TableCell>
                  <select
                    className="filter-select"
                    style={{ padding: '2px 6px', fontSize: '0.8rem', maxWidth: 130 }}
                    value={c.category || 'auto'}
                    onChange={(e) => handleUpdateChannelCategory(c._id, e.target.value)}
                    title="Auto lets the AI classifier pick a category per message. Any other value pins every deal from this channel to that category."
                  >
                    <option value="auto">Auto (AI)</option>
                    {masterCategories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                    {/* A category removed from Master would otherwise render as a blank select */}
                    {c.category && c.category !== 'auto' && !categoryLabels[c.category] && (
                      <option value={c.category}>{c.category} (unknown)</option>
                    )}
                  </select>
                </TableCell>
                <TableCell>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span className="font-semibold text-foreground">{messages}</span>
                    <span className="text-muted-foreground text-xs">→</span>
                    <span className="font-semibold text-emerald-600">{deals}</span>
                    <span
                      title={yieldPct === null ? 'No messages captured yet' : `${deals} deals from ${messages} messages`}
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: yieldColor,
                        background: 'rgba(0,0,0,0.04)',
                        padding: '1px 5px',
                        borderRadius: 10
                      }}
                    >
                      {yieldPct === null ? 'no data' : `${yieldPct.toFixed(1)}%`}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  <div title={formatTime(c.lastMessageAt)}>
                    msg: {formatAge(c.lastMessageAt) || 'never'}
                  </div>
                  <div title={formatTime(c.lastDealAt)} style={{ color: c.lastDealAt ? 'var(--success)' : undefined }}>
                    deal: {formatAge(c.lastDealAt) || 'never'}
                  </div>
                </TableCell>
                <TableCell>
                  {renderRelevanceCell(c)}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={c.isActive}
                    onCheckedChange={() => handleToggleChannelStatus(c._id, c.isActive)}
                  />
                </TableCell>
              </TableRow>
            );
          })}
          {list.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                {emptyLabel}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );

  const statCard = (icon, iconBg, iconColor, value, label) => (
    <div className="card glass crm-stat-card">
      <div className="crm-stat-icon" style={{ background: iconBg, color: iconColor }}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div className="crm-stat-value">{value}</div>
      <div className="crm-stat-label">{label}</div>
    </div>
  );

  const overallYield = stats.totalCaptured > 0
    ? `${((stats.totalDeals / stats.totalCaptured) * 100).toFixed(1)}%`
    : '—';

  return (
    <>
      <section className="view-section active-view">
        {/* Source-health summary — these numbers were already returned by the API but never surfaced */}
        <div className="grid-cards" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {statCard('sensors', 'rgba(99,102,241,0.15)', '#818cf8',
            `${stats.activeChannels ?? 0} / ${stats.totalChannels ?? 0}`, 'Active Sources')}
          {statCard('forum', 'rgba(59,130,246,0.15)', '#60a5fa',
            (stats.totalCaptured ?? 0).toLocaleString(), 'Messages Captured')}
          {statCard('sell', 'rgba(16,185,129,0.15)', '#34d399',
            `${(stats.totalDeals ?? 0).toLocaleString()} · ${overallYield}`, 'Deals Produced / Yield')}
          {statCard('rate_review', 'rgba(245,158,11,0.15)', '#fbbf24',
            stats.unreviewedChannels ?? 0, 'Awaiting Relevance Review')}
        </div>

        <div className="card glass" style={{ marginBottom: '1.5rem' }}>
          <div style={{ padding: '1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <h3 style={{ margin: 0, fontWeight: 600 }}>Monitored Telegram Channels</h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              {channelsSelectedIds.length > 0 && (
                <>
                  <button onClick={() => handleBulkChannelAction('enable')} className="btn" style={{ background: 'var(--success)', color: 'white', padding: '0 12px', borderRadius: 8, fontSize: '0.82rem' }}>Enable ({channelsSelectedIds.length})</button>
                  <button onClick={() => handleBulkChannelAction('disable')} className="btn" style={{ background: '#64748b', color: 'white', padding: '0 12px', borderRadius: 8, fontSize: '0.82rem' }}>Disable ({channelsSelectedIds.length})</button>
                  <select onChange={(e) => e.target.value && handleBulkChannelAction('country', { country: e.target.value })} className="filter-select" style={{ fontSize: '0.82rem' }} defaultValue="">
                    <option value="" disabled>Change Country...</option>
                    {COUNTRIES.map(code => <option key={code} value={code}>{code}</option>)}
                  </select>
                  <select onChange={(e) => e.target.value && handleBulkChannelAction('category', { category: e.target.value })} className="filter-select" style={{ fontSize: '0.82rem' }} defaultValue="">
                    <option value="" disabled>Change Category...</option>
                    <option value="auto">Auto (AI)</option>
                    {masterCategories.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                  </select>
                  <select onChange={(e) => e.target.value && handleBulkChannelAction('relevance', { relevance: e.target.value })} className="filter-select" style={{ fontSize: '0.82rem' }} defaultValue="">
                    <option value="" disabled>Mark Relevance...</option>
                    <option value="relevant">✓ Relevant</option>
                    <option value="not_relevant">✕ Not Relevant (also disables)</option>
                    <option value="unreviewed">↺ Clear verdict</option>
                  </select>
                  <button onClick={() => handleBulkChannelAction('delete')} className="btn" style={{ background: 'var(--danger)', color: 'white', padding: '0 12px', borderRadius: 8, fontSize: '0.82rem' }}>Delete</button>
                </>
              )}
              <input
                type="text"
                className="filter-input"
                placeholder="🔍 Search channel title or ID..."
                value={channelsSearch}
                onChange={(e) => setChannelsSearch(e.target.value)}
              />
              <select className="filter-select" value={channelsStatus} onChange={(e) => setChannelsStatus(e.target.value)}>
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
              <select className="filter-select" value={channelsRelevance} onChange={(e) => setChannelsRelevance(e.target.value)}>
                <option value="all">All Relevance</option>
                <option value="unreviewed">Unreviewed</option>
                <option value="relevant">Relevant</option>
                <option value="not_relevant">Not Relevant</option>
              </select>
              <label
                title="Keeps channels you've already dismissed out of the list. Pick 'Not Relevant' above to see them again."
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', whiteSpace: 'nowrap',
                  opacity: channelsRelevance === 'not_relevant' ? 0.5 : 1
                }}
              >
                <input
                  type="checkbox"
                  checked={hideNotRelevant}
                  disabled={channelsRelevance === 'not_relevant'}
                  onChange={(e) => setHideNotRelevant(e.target.checked)}
                />
                Hide Not Relevant
              </label>
              <select className="filter-select" value={channelsCategory} onChange={(e) => setChannelsCategory(e.target.value)}>
                <option value="all">All Categories</option>
                <option value="auto">Auto (AI)</option>
                {masterCategories.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
              </select>
              <select className="filter-select" value={channelsCountry} onChange={(e) => setChannelsCountry(e.target.value)}>
                <option value="all">All Countries</option>
                <option value="IN">India (IN)</option>
                <option value="US">United States (US)</option>
                <option value="UK">United Kingdom (UK)</option>
                <option value="CA">Canada (CA)</option>
                <option value="AU">Australia (AU)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card glass" style={{ marginBottom: '1.5rem' }}>
          <div style={{ padding: '1.2rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--accent)' }}>verified</span>
            <h3 style={{ margin: 0, fontWeight: 600 }}>My Channels</h3>
            <span className="stat-badge" style={{ background: 'rgba(37,99,235,0.1)', color: 'var(--accent)', fontWeight: 700 }}>{myChannels.length}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              — channels you created on Telegram, also being monitored for incoming deal messages
            </span>
          </div>
          {renderChannelTable(myChannels, 'None of your own channels are currently monitored. Run scripts/sync_channel_ownership.js after creating or joining one.')}
        </div>

        <div className="card glass">
          <div style={{ padding: '1.2rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--text-muted)' }}>groups</span>
            <h3 style={{ margin: 0, fontWeight: 600 }}>Other Monitored Channels</h3>
            <span className="stat-badge" style={{ fontWeight: 700 }}>{otherChannels.length}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              — third-party channels you&apos;ve joined purely to scrape deal messages from
            </span>
          </div>
          {renderChannelTable(otherChannels, 'No channels found matching your criteria.')}
        </div>
      </section>
    </>
  );
}
