'use client';

import { useState, useEffect, useCallback } from 'react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';

const COUNTRY_NAMES = {
  IN: 'India (IN)',
  US: 'United States (US)',
  UK: 'United Kingdom (UK)',
  CA: 'Canada (CA)',
  AU: 'Australia (AU)',
  all: 'All Countries'
};

const PLATFORM_ICONS = {
  telegram: '✈️',
  twitter: '🐦',
  whatsapp: '💬'
};

export default function OutputChannelsPage() {
  const [channels, setChannels] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, telegramCount: 0, twitterCount: 0, whatsappCount: 0 });
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [form, setForm] = useState({
    name: '',
    platform: 'telegram',
    country: 'IN',
    category: 'all',
    isActive: true,
    rateLimitMinutes: null,
    credentials: {}
  });

  const [testSendingId, setTestSendingId] = useState(null);
  const [apiBase, setApiBase] = useState(process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:3001');
  const [masterCategories, setMasterCategories] = useState([]);

  // Group/channel picker for WAHA recipients — reuses whichever existing WAHA-connected output
  // channel is already logged in (the WhatsApp login is shared account-wide, not per routing row).
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [groupPickerGroups, setGroupPickerGroups] = useState(null);
  const [groupPickerLoading, setGroupPickerLoading] = useState(false);
  const [groupPickerError, setGroupPickerError] = useState('');
  const [groupPickerSearch, setGroupPickerSearch] = useState('');
  const [groupPickerAdminOnly, setGroupPickerAdminOnly] = useState(true);
  // Multi-select only applies when adding a brand-new channel (no editingChannel yet) — one
  // OutputChannel row gets created per selected group, all sharing the form's country/category.
  const [groupPickerSelectedIds, setGroupPickerSelectedIds] = useState(new Set());
  const [bulkAdding, setBulkAdding] = useState(false);

  useEffect(() => {
  }, []);

  const apiFetch = useCallback(async (endpoint, options = {}) => {
    const base = apiBase.replace(/\/+$/, '');
    const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;
    return fetch(url, options);
  }, [apiBase]);

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

  // X/Twitter accounts are managed centrally on the Channel Management page (same pattern as
  // WAHA connections) — this row just picks which managed account a channel posts as.
  const [xAccounts, setXAccounts] = useState([]);
  const fetchXAccounts = useCallback(async () => {
    try {
      const res = await apiFetch('/api/x-accounts');
      if (res.ok) {
        const data = await res.json();
        setXAccounts(data.accounts || []);
      }
    } catch (err) {
      console.error('Fetch X accounts error:', err);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchXAccounts();
  }, [fetchXAccounts]);

  const fetchOutputChannels = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        platform: platformFilter,
        country: countryFilter,
        category: categoryFilter,
        q: search
      });
      const res = await apiFetch(`/api/output-channels?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      setChannels(data.channels || []);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      console.error('Fetch output channels error:', err);
    }
  }, [apiFetch, platformFilter, countryFilter, categoryFilter, search]);

  useEffect(() => {
    fetchOutputChannels();
  }, [fetchOutputChannels]);

  // Unfiltered lookup (independent of the table's own filters) of any already-connected WAHA
  // channel — the login is one shared WhatsApp account, so any existing row's credentials work to
  // fetch groups for the picker (and to prefill connection fields), even while creating a
  // brand-new routing row that has no id yet.
  const [wahaRepresentative, setWahaRepresentative] = useState(null);
  useEffect(() => {
    apiFetch('/api/output-channels?platform=whatsapp&country=all&category=all&q=').then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      const waha = (data.channels || []).find(c => c.credentials?.provider === 'waha' && c.credentials?.wahaBaseUrl);
      setWahaRepresentative(waha || null);
    }).catch(() => {});
  }, [apiFetch, channels]);

  const openGroupPicker = async () => {
    const repId = editingChannel?.credentials?.provider === 'waha' ? editingChannel._id : wahaRepresentative?._id;
    if (!repId) return;
    setGroupPickerOpen(true);
    setGroupPickerLoading(true);
    setGroupPickerError('');
    setGroupPickerSelectedIds(new Set());
    try {
      const res = await apiFetch(`/api/output-channels/${repId}/waha/groups`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch groups');
      setGroupPickerGroups(data.groups);
    } catch (err) {
      setGroupPickerError(err.message);
    } finally {
      setGroupPickerLoading(false);
    }
  };

  // Edit mode: picking a group targets that one existing row, same as before.
  const selectGroup = (g) => {
    setForm(prev => ({
      ...prev,
      name: prev.name.trim() ? prev.name : g.subject,
      credentials: { ...prev.credentials, recipientPhoneNumber: g.id }
    }));
    setGroupPickerOpen(false);
  };

  const toggleGroupSelection = (g) => {
    setGroupPickerSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(g.id)) next.delete(g.id);
      else next.add(g.id);
      return next;
    });
  };

  // Add mode: create one Output Channel per selected group, all sharing the form's
  // platform/country/category/isActive and WAHA connection fields — only the recipient
  // (the group chatId) and name differ per created row.
  const handleAddSelectedGroups = async () => {
    const groups = (groupPickerGroups || []).filter(g => groupPickerSelectedIds.has(g.id));
    if (groups.length === 0) return;
    setBulkAdding(true);
    try {
      const results = await Promise.allSettled(groups.map(async (g) => {
        const payload = {
          ...form,
          name: g.subject,
          credentials: { ...form.credentials, recipientPhoneNumber: g.id }
        };
        const res = await apiFetch('/api/output-channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || `Failed for "${g.subject}"`);
        return data;
      }));

      const failed = results.filter(r => r.status === 'rejected');
      setGroupPickerOpen(false);
      setModalOpen(false);
      fetchOutputChannels();

      if (failed.length > 0) {
        alert(`Added ${groups.length - failed.length} of ${groups.length} channels.\n\nFailed:\n` + failed.map(f => f.reason.message).join('\n'));
      } else {
        alert(`✅ Added ${groups.length} output channel${groups.length > 1 ? 's' : ''}.`);
      }
    } finally {
      setBulkAdding(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingChannel(null);
    setForm({
      name: '',
      platform: 'telegram',
      country: 'IN',
      category: 'all',
      isActive: true,
      rateLimitMinutes: null,
      credentials: { channelUsername: '' }
    });
    setModalOpen(true);
  };

  const handleOpenEditModal = (ch) => {
    setEditingChannel(ch);
    setForm({
      name: ch.name || '',
      platform: ch.platform || 'telegram',
      country: ch.country || 'IN',
      category: ch.category || 'all',
      isActive: ch.isActive !== undefined ? ch.isActive : true,
      rateLimitMinutes: ch.rateLimitMinutes ?? null,
      credentials: ch.credentials ? { ...ch.credentials } : {}
    });
    setModalOpen(true);
  };

  const handleSaveChannel = async () => {
    if (!form.name.trim()) {
      alert('Please enter a channel name.');
      return;
    }

    try {
      let res;
      if (editingChannel) {
        res = await apiFetch(`/api/output-channels/${editingChannel._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form)
        });
      } else {
        res = await apiFetch('/api/output-channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form)
        });
      }

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save output channel');
      setModalOpen(false);
      fetchOutputChannels();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleToggleStatus = async (ch) => {
    try {
      const res = await apiFetch(`/api/output-channels/${ch._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !ch.isActive })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to toggle status');
      fetchOutputChannels();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleResetStats = async (ch) => {
    if (!window.confirm(`Reset the "Deals Sent" counter for "${ch.name}" back to 0?\n\nUse this when the count includes sends that never actually delivered (e.g. a stuck WhatsApp session).`)) return;
    try {
      const res = await apiFetch(`/api/output-channels/${ch._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetStats: true })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to reset counter');
      fetchOutputChannels();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleDeleteChannel = async (id) => {
    if (!window.confirm('Are you sure you want to delete this output channel?')) return;
    try {
      const res = await apiFetch(`/api/output-channels/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete channel');
      fetchOutputChannels();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleSendTest = async (id) => {
    setTestSendingId(id);
    try {
      const res = await apiFetch(`/api/output-channels/${id}/test`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to send test deal');
      alert(`✅ ${data.message}`);
    } catch (err) {
      alert('Error sending test deal: ' + err.message);
    } finally {
      setTestSendingId(null);
    }
  };

  // Session/login management for WAHA (and, later, other platforms) now lives on the dedicated
  // "Channel Management" tab (/network/connections) — one card per connection, shared across
  // every routing row that uses it, instead of duplicated per row here.

  return (
    <>
      <section className="view-section active-view">
        {/* Top Summary Stat Cards */}
        <div className="grid-cards" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="card glass crm-stat-card">
            <div className="crm-stat-icon" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
              <span className="material-symbols-outlined">podcasts</span>
            </div>
            <div className="crm-stat-value">{stats.total || 0}</div>
            <div className="crm-stat-label">Total Channels</div>
          </div>
          <div className="card glass crm-stat-card">
            <div className="crm-stat-icon" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
              <span className="material-symbols-outlined">check_circle</span>
            </div>
            <div className="crm-stat-value">{stats.active || 0}</div>
            <div className="crm-stat-label">Active Publishing</div>
          </div>
          <div className="card glass crm-stat-card">
            <div className="crm-stat-icon" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>
              <span className="material-symbols-outlined">send</span>
            </div>
            <div className="crm-stat-value">{stats.telegramCount || 0} Telegram / {stats.twitterCount || 0} Twitter</div>
            <div className="crm-stat-label">Platform Breakdown</div>
          </div>
          <div className="card glass crm-stat-card">
            <div className="crm-stat-icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>
              <span className="material-symbols-outlined">chat</span>
            </div>
            <div className="crm-stat-value">{stats.whatsappCount || 0}</div>
            <div className="crm-stat-label">WhatsApp Channels</div>
          </div>
        </div>

        {/* Main Content & Table */}
        <div className="card glass">
          <div className="filter-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--accent)' }}>share</span> Output Destinations
              </h3>
              <button className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '0.85rem', fontWeight: 600 }} onClick={handleOpenAddModal}>
                + Add Output Channel
              </button>
            </div>

            <div className="filter-controls" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                className="filter-input"
                placeholder="🔍 Search name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 180 }}
              />
              <select className="filter-select" value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
                <option value="all">All Platforms</option>
                <option value="telegram">Telegram</option>
                <option value="twitter">Twitter / X</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
              <select className="filter-select" value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
                <option value="all">All Countries</option>
                <option value="IN">IN (India)</option>
                <option value="US">US (United States)</option>
                <option value="UK">UK (United Kingdom)</option>
                <option value="CA">CA (Canada)</option>
                <option value="AU">AU (Australia)</option>
              </select>
              <select className="filter-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">All Categories</option>
                {masterCategories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform & Name</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Target Handle / Creds</TableHead>
                  <TableHead>Deals Sent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead style={{ textAlign: 'right' }}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.length > 0 ? (
                  channels.map((ch) => {
                    const icon = PLATFORM_ICONS[ch.platform] || '📢';
                    let credSummary = 'N/A';
                    if (ch.platform === 'telegram') {
                      credSummary = ch.credentials?.channelUsername ? `@${ch.credentials.channelUsername.replace('@', '')}` : 'Not set';
                    } else if (ch.platform === 'twitter') {
                      // Centralized accounts (xAccountId) are the current path; legacy inline
                      // apiKey is a fallback for rows saved before XAccount existed.
                      if (ch.credentials?.xAccountId) {
                        const acc = xAccounts.find(a => a._id === ch.credentials.xAccountId);
                        credSummary = acc ? `@${acc.handle || acc.label}` : 'X Account (deleted?)';
                      } else {
                        credSummary = ch.credentials?.apiKey ? 'OAuth Configured (legacy)' : 'No X Account Selected';
                      }
                    } else if (ch.platform === 'whatsapp') {
                      const provider = ch.credentials?.provider
                        || (ch.credentials?.webhookUrl ? 'webhook' : ch.credentials?.wahaBaseUrl ? 'waha' : ch.credentials?.phoneNumberId ? 'meta' : null);
                      if (provider === 'waha') credSummary = ch.credentials?.wahaBaseUrl ? `WAHA · ${ch.credentials.wahaBaseUrl}` : 'WAHA — Missing Base URL';
                      else if (provider === 'meta') credSummary = ch.credentials?.phoneNumberId ? 'Meta API Set' : 'Meta API — Missing Creds';
                      else if (provider === 'webhook') credSummary = ch.credentials?.webhookUrl ? 'Webhook Set' : 'Webhook — Missing URL';
                      else credSummary = 'Missing Creds';
                    }
                    return (
                      <TableRow key={ch._id}>
                        <TableCell>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '1.2rem' }}>{icon}</span>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{ch.name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{ch.platform}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span style={{ background: 'rgba(0,0,0,0.05)', padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 600 }}>
                            {COUNTRY_NAMES[ch.country] || ch.country}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="badge-cat badge-general" style={{ textTransform: 'capitalize' }}>
                            {ch.category}
                          </span>
                        </TableCell>
                        <TableCell style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>
                          {credSummary}
                        </TableCell>
                        <TableCell style={{ fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                            {ch.stats?.dealsPublished || 0}
                            {ch.stats?.dealsPublished > 0 && (
                              <button
                                className="btn"
                                title="Reset this counter to 0 (e.g. if past sends never actually delivered)"
                                style={{ padding: '1px 6px', fontSize: '0.68rem', fontWeight: 400, background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)' }}
                                onClick={() => handleResetStats(ch)}
                              >
                                ↺ reset
                              </button>
                            )}
                          </div>
                          {ch.rateLimitMinutes > 0 && (
                            <div style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                              ⏱ every {ch.rateLimitMinutes}m
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch checked={ch.isActive} onCheckedChange={() => handleToggleStatus(ch)} />
                        </TableCell>
                        <TableCell style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button
                              className="btn"
                              style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'rgba(59,130,246,0.1)', color: '#2563eb', border: '1px solid rgba(59,130,246,0.3)' }}
                              onClick={() => handleSendTest(ch._id)}
                              disabled={testSendingId === ch._id}
                            >
                              {testSendingId === ch._id ? 'Sending...' : 'Test Post'}
                            </button>
                            <button
                              className="btn"
                              style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)' }}
                              onClick={() => handleOpenEditModal(ch)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-danger"
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                              onClick={() => handleDeleteChannel(ch._id)}
                            >
                              Delete
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No output channels configured. Click <strong>&quot;+ Add Output Channel&quot;</strong> to start publishing deals to Telegram, Twitter, or WhatsApp!
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Modal for Add / Edit Output Channel */}
        {modalOpen && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}>
            <div className="card glass" style={{ width: 500, maxWidth: '90%', background: '#ffffff', padding: '1.5rem', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
              <h3 style={{ marginTop: 0, marginBottom: '1.2rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--accent)' }}>settings</span>
                {editingChannel ? 'Edit Output Channel' : 'Add New Output Channel'}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Channel Name</label>
                  <input
                    type="text"
                    className="filter-input"
                    style={{ width: '100%', padding: '8px 12px' }}
                    placeholder="e.g. India Deals Twitter / Fitness TG"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Platform</label>
                    <select
                      className="filter-select"
                      style={{ width: '100%', padding: '8px' }}
                      value={form.platform}
                      onChange={(e) => {
                        const platform = e.target.value;
                        // Credentials are platform-specific — drop whatever the previous
                        // platform's fields held instead of silently carrying them along.
                        const defaultCredentials = platform === 'whatsapp'
                          ? {
                              provider: 'waha',
                              // Prefill from the already-connected WAHA account so new rows work
                              // immediately without retyping the same base URL/key each time.
                              wahaBaseUrl: wahaRepresentative?.credentials?.wahaBaseUrl || '',
                              wahaApiKey: wahaRepresentative?.credentials?.wahaApiKey || '',
                              wahaSession: wahaRepresentative?.credentials?.wahaSession || 'default',
                              recipientPhoneNumber: ''
                            }
                          : platform === 'twitter'
                            ? { xAccountId: '' }
                            : { channelUsername: '' };
                        // WhatsApp automation is what actually risks getting the number
                        // rate-limited/banned by WhatsApp — nudge a safe default, but only
                        // if the admin hasn't already set one.
                        const rateLimitMinutes = platform === 'whatsapp' && form.rateLimitMinutes == null
                          ? 30
                          : form.rateLimitMinutes;
                        setForm({ ...form, platform, credentials: defaultCredentials, rateLimitMinutes });
                      }}
                    >
                      <option value="telegram">Telegram ✈️</option>
                      <option value="twitter">Twitter / X 🐦</option>
                      <option value="whatsapp">WhatsApp 💬</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Target Country</label>
                    <select
                      className="filter-select"
                      style={{ width: '100%', padding: '8px' }}
                      value={form.country}
                      onChange={(e) => setForm({ ...form, country: e.target.value })}
                    >
                      <option value="IN">India (IN)</option>
                      <option value="US">United States (US)</option>
                      <option value="UK">United Kingdom (UK)</option>
                      <option value="CA">Canada (CA)</option>
                      <option value="AU">Australia (AU)</option>
                      <option value="all">All Countries</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Category Route</label>
                    <select
                      className="filter-select"
                      style={{ width: '100%', padding: '8px' }}
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                    >
                      <option value="all">All Categories</option>
                      {masterCategories.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Enable Channel</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Switch checked={form.isActive} onCheckedChange={(val) => setForm({ ...form, isActive: val })} />
                      <span style={{ fontSize: '0.85rem' }}>{form.isActive ? 'Active' : 'Disabled'}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Rate Limit</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>Send at most 1 deal every</span>
                    <input
                      type="number"
                      min="0"
                      className="filter-input"
                      style={{ width: 90, padding: '6px 10px' }}
                      placeholder="30"
                      value={form.rateLimitMinutes ?? ''}
                      onChange={(e) => setForm({ ...form, rateLimitMinutes: e.target.value === '' ? null : Number(e.target.value) })}
                    />
                    <span style={{ fontSize: '0.85rem' }}>minutes</span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    Leave blank for no limit. Deals that arrive mid-cooldown are skipped on this channel, not queued — recommended for WhatsApp to avoid tripping spam detection.
                  </div>
                </div>

                {/* Platform-Specific Credentials Fields */}
                <div style={{ marginTop: 8, padding: 12, background: 'rgba(0,0,0,0.03)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-main)' }}>
                    🔑 Credentials for {form.platform.toUpperCase()}
                  </div>

                  {form.platform === 'telegram' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: 2 }}>Telegram Channel Username / ID</label>
                      <input
                        type="text"
                        className="filter-input"
                        style={{ width: '100%', padding: '6px 10px' }}
                        placeholder="e.g. amazondeallovers (without @)"
                        value={form.credentials.channelUsername || ''}
                        onChange={(e) => setForm({ ...form, credentials: { ...form.credentials, channelUsername: e.target.value } })}
                      />
                    </div>
                  )}

                  {form.platform === 'twitter' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Login, OAuth keys, and billing for each X account are managed once on{' '}
                        <a href="/network/connections" style={{ color: 'var(--accent)' }}>Channel Management</a> — pick which managed account this channel posts as below.
                      </div>
                      <select
                        className="filter-select"
                        style={{ width: '100%', padding: '8px' }}
                        value={form.credentials.xAccountId || ''}
                        onChange={(e) => setForm({ ...form, credentials: { ...form.credentials, xAccountId: e.target.value } })}
                      >
                        <option value="" disabled>Select an X account…</option>
                        {xAccounts.map(acc => (
                          <option key={acc._id} value={acc._id}>
                            {acc.label}{acc.handle ? ` (@${acc.handle})` : ''}{!acc.isActive ? ' — disabled' : ''}
                          </option>
                        ))}
                      </select>
                      {xAccounts.length === 0 && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--danger)' }}>
                          No X accounts managed yet — <a href="/network/connections" style={{ color: 'var(--accent)' }}>add one on Channel Management</a> first, then come back here to pick it.
                        </div>
                      )}
                      <div style={{ fontSize: '0.72rem', background: 'rgba(217,119,6,0.1)', color: '#b45309', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(217,119,6,0.25)' }}>
                        ⚠️ Deal posts include the product link, which X bills at <strong>$0.20/post</strong> under pay-per-use pricing (vs $0.015 for a plain text post — links are billed 13× because of X&apos;s anti-spam surcharge).
                        {form.rateLimitMinutes > 0 ? (
                          <> At this channel&apos;s {form.rateLimitMinutes}-minute rate limit, that&apos;s at most <strong>${((1440 / form.rateLimitMinutes) * 0.2).toFixed(2)}/day</strong> if every window sends.</>
                        ) : (
                          <> No rate limit is set on this channel — cost scales directly with however many deals match its country/category. Set one above to cap it.</>
                        )}
                        {' '}Test Post below is billed the same way — it&apos;s a real post, not a simulation.
                      </div>
                    </div>
                  )}

                  {form.platform === 'whatsapp' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: -4 }}>Delivery Method</label>
                      <select
                        className="filter-select"
                        style={{ width: '100%', padding: '6px 10px' }}
                        value={form.credentials.provider || 'waha'}
                        onChange={(e) => setForm({ ...form, credentials: { ...form.credentials, provider: e.target.value } })}
                      >
                        <option value="waha">WAHA — self-hosted WhatsApp API (Recommended)</option>
                        <option value="meta">Meta Cloud API</option>
                        <option value="webhook">Custom Webhook</option>
                      </select>

                      {(form.credentials.provider || 'waha') === 'waha' && (
                        <>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 2 }}>
                            Your own WAHA instance — see <a href="https://waha.devlike.pro/docs/overview/quick-start/" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>waha.devlike.pro</a> to self-host it.
                          </div>
                          <input
                            type="text"
                            className="filter-input"
                            style={{ width: '100%', padding: '6px 10px' }}
                            placeholder="WAHA Base URL (e.g. http://localhost:3000)"
                            value={form.credentials.wahaBaseUrl || ''}
                            onChange={(e) => setForm({ ...form, credentials: { ...form.credentials, wahaBaseUrl: e.target.value } })}
                          />
                          <input
                            type="password"
                            className="filter-input"
                            style={{ width: '100%', padding: '6px 10px' }}
                            placeholder="API Key (X-Api-Key, optional if disabled)"
                            value={form.credentials.wahaApiKey || ''}
                            onChange={(e) => setForm({ ...form, credentials: { ...form.credentials, wahaApiKey: e.target.value } })}
                          />
                          <input
                            type="text"
                            className="filter-input"
                            style={{ width: '100%', padding: '6px 10px' }}
                            placeholder="Session name (default: default)"
                            value={form.credentials.wahaSession || ''}
                            onChange={(e) => setForm({ ...form, credentials: { ...form.credentials, wahaSession: e.target.value } })}
                          />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              type="text"
                              className="filter-input"
                              style={{ flex: 1, padding: '6px 10px' }}
                              placeholder="Recipient: phone with country code, or full chatId (e.g. 1203..@g.us for a group)"
                              value={form.credentials.recipientPhoneNumber || ''}
                              onChange={(e) => setForm({ ...form, credentials: { ...form.credentials, recipientPhoneNumber: e.target.value } })}
                            />
                            <button
                              type="button"
                              className="btn"
                              style={{ padding: '6px 12px', fontSize: '0.78rem', whiteSpace: 'nowrap', background: 'rgba(37,99,235,0.1)', color: 'var(--accent)', border: '1px solid rgba(37,99,235,0.3)' }}
                              onClick={openGroupPicker}
                              disabled={!(editingChannel?.credentials?.provider === 'waha' ? editingChannel._id : wahaRepresentative?._id)}
                              title={!(editingChannel?.credentials?.provider === 'waha' ? editingChannel._id : wahaRepresentative?._id) ? 'Connect a WAHA WhatsApp account first from Channel Management' : ''}
                            >
                              {editingChannel ? '📋 Pick Group' : '📋 Pick Group(s)'}
                            </button>
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {editingChannel
                              ? "Only groups you administer are listed. Deals matching this row's country/category route to whichever group or number you set above."
                              : 'Only groups you administer are listed. Select multiple groups to create one output channel per group — all sharing this country/category.'}
                          </div>
                        </>
                      )}

                      {form.credentials.provider === 'meta' && (
                        <>
                          <input
                            type="text"
                            className="filter-input"
                            style={{ width: '100%', padding: '6px 10px' }}
                            placeholder="Phone Number ID"
                            value={form.credentials.phoneNumberId || ''}
                            onChange={(e) => setForm({ ...form, credentials: { ...form.credentials, phoneNumberId: e.target.value } })}
                          />
                          <input
                            type="password"
                            className="filter-input"
                            style={{ width: '100%', padding: '6px 10px' }}
                            placeholder="Permanent Access Token"
                            value={form.credentials.accessToken || ''}
                            onChange={(e) => setForm({ ...form, credentials: { ...form.credentials, accessToken: e.target.value } })}
                          />
                          <input
                            type="text"
                            className="filter-input"
                            style={{ width: '100%', padding: '6px 10px' }}
                            placeholder="Recipient Phone Number (with country code)"
                            value={form.credentials.recipientPhoneNumber || ''}
                            onChange={(e) => setForm({ ...form, credentials: { ...form.credentials, recipientPhoneNumber: e.target.value } })}
                          />
                        </>
                      )}

                      {form.credentials.provider === 'webhook' && (
                        <input
                          type="text"
                          className="filter-input"
                          style={{ width: '100%', padding: '6px 10px' }}
                          placeholder="Webhook URL"
                          value={form.credentials.webhookUrl || ''}
                          onChange={(e) => setForm({ ...form, credentials: { ...form.credentials, webhookUrl: e.target.value } })}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: '1.5rem' }}>
                <button
                  className="btn"
                  style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)', padding: '6px 16px' }}
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  style={{ padding: '6px 20px', fontWeight: 600 }}
                  onClick={handleSaveChannel}
                >
                  Save Channel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Group/Channel picker for WAHA recipients */}
        {groupPickerOpen && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000
          }}>
            <div className="card glass" style={{ width: 480, maxWidth: '95%', maxHeight: '85vh', overflow: 'auto', background: '#ffffff', padding: '1.5rem', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{editingChannel ? '📋 Pick a Group' : '📋 Pick Group(s)'}</h3>
                <button className="btn" style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)', padding: '5px 12px' }} onClick={() => setGroupPickerOpen(false)}>Close</button>
              </div>
              {!editingChannel && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 10, marginTop: -4 }}>
                  Select every group you want this deal route to reach — one output channel is created per group.
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  className="filter-input"
                  placeholder="🔍 Search group name..."
                  value={groupPickerSearch}
                  onChange={(e) => setGroupPickerSearch(e.target.value)}
                  style={{ flex: 1, minWidth: 160 }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={groupPickerAdminOnly} onChange={(e) => setGroupPickerAdminOnly(e.target.checked)} />
                  Admin only
                </label>
              </div>

              {groupPickerError && (
                <div style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--danger)', padding: '8px 12px', borderRadius: 8, fontSize: '0.8rem', marginBottom: 10 }}>
                  {groupPickerError}
                </div>
              )}

              {groupPickerLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading groups…</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 380, overflow: 'auto' }}>
                  {(groupPickerGroups || [])
                    .filter(g => (!groupPickerAdminOnly || g.isAdmin) && (!groupPickerSearch.trim() || g.subject.toLowerCase().includes(groupPickerSearch.trim().toLowerCase())))
                    .map(g => {
                      const selected = groupPickerSelectedIds.has(g.id);
                      return (
                        <div
                          key={g.id}
                          onClick={() => (editingChannel ? selectGroup(g) : toggleGroupSelection(g))}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '10px 12px', borderRadius: 8,
                            border: selected ? '1px solid var(--accent)' : '1px solid var(--border)',
                            background: selected ? 'rgba(37,99,235,0.08)' : 'rgba(0,0,0,0.02)',
                            cursor: 'pointer', textAlign: 'left', width: '100%'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {!editingChannel && (
                              <input
                                type="checkbox"
                                checked={selected}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => toggleGroupSelection(g)}
                              />
                            )}
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{g.subject}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{g.participantCount ?? '?'} members</div>
                            </div>
                          </div>
                          {g.isAdmin && (
                            <span style={{ background: 'rgba(37,99,235,0.1)', color: 'var(--accent)', padding: '2px 8px', borderRadius: 14, fontSize: '0.68rem', fontWeight: 700 }}>
                              You're Admin
                            </span>
                          )}
                        </div>
                      );
                    })}
                  {groupPickerGroups && groupPickerGroups.filter(g => (!groupPickerAdminOnly || g.isAdmin)).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No groups match.</div>
                  )}
                </div>
              )}

              {!editingChannel && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{groupPickerSelectedIds.size} selected</span>
                  <button
                    className="btn btn-primary"
                    style={{ padding: '6px 16px', fontWeight: 600 }}
                    onClick={handleAddSelectedGroups}
                    disabled={groupPickerSelectedIds.size === 0 || bulkAdding}
                  >
                    {bulkAdding ? 'Adding…' : `+ Add ${groupPickerSelectedIds.size || ''} Channel${groupPickerSelectedIds.size === 1 ? '' : 's'}`}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
