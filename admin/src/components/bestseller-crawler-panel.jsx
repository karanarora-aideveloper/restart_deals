'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';

function timeAgo(dateStr) {
  if (!dateStr) return 'Never';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function timeUntil(dateStr) {
  if (!dateStr) return 'Not scheduled yet';
  const diffMs = new Date(dateStr).getTime() - Date.now();
  if (diffMs <= 0) return 'Due now';
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.round(hours / 24)}d`;
}

export default function BestsellerCrawlerPanel() {
  const [status, setStatus] = useState(null);
  const [seeds, setSeeds] = useState([]);
  const [search, setSearch] = useState('');
  const [toastMessage, setToastMessage] = useState(null);
  const [intervalInput, setIntervalInput] = useState(24);
  const [running, setRunning] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSeed, setEditingSeed] = useState(null);
  const [seedForm, setSeedForm] = useState({ category: '', subcategory: '', keywords: '', topN: 20, frequencyHours: 24 });
  const [formError, setFormError] = useState('');

  const [apiBase, setApiBase] = useState(process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:3001');
  const adminApiKey = process.env.NEXT_PUBLIC_ADMIN_API_KEY || '';

  const apiFetch = useCallback(async (endpoint, options = {}) => {
    const base = apiBase.replace(/\/+$/, '');
    const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;
    const headers = { ...(options.headers || {}), ...(adminApiKey ? { 'x-admin-key': adminApiKey } : {}) };
    return fetch(url, { ...options, headers });
  }, [apiBase, adminApiKey]);

  const showToast = (msg, duration = 3000) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), duration);
  };

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/crawler/status');
      const data = await res.json();
      if (data.success) {
        setStatus(data);
        if (data.config?.intervalHours) setIntervalInput(data.config.intervalHours);
      }
    } catch (err) {
      console.error('Failed to fetch crawler status:', err);
    }
  }, [apiFetch]);

  const fetchSeeds = useCallback(async () => {
    try {
      const res = await apiFetch('/api/crawler/seeds');
      const data = await res.json();
      if (data.success) setSeeds(data.seeds);
    } catch (err) {
      console.error('Failed to fetch crawler seeds:', err);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchStatus();
    fetchSeeds();
  }, [fetchStatus, fetchSeeds]);

  // Poll status every 15s while a crawl might be running, so "Running..." / last-run stats
  // update without a manual refresh.
  useEffect(() => {
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const filteredSeeds = useMemo(() => {
    const s = search.toLowerCase();
    if (!s) return seeds;
    return seeds.filter(seed =>
      seed.category.toLowerCase().includes(s) ||
      seed.subcategory.toLowerCase().includes(s) ||
      seed.keywords.toLowerCase().includes(s)
    );
  }, [seeds, search]);

  const enabledCount = seeds.filter(s => s.isEnabled).length;

  const handleSaveConfig = async () => {
    try {
      const res = await apiFetch('/api/crawler/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervalHours: intervalInput }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save schedule');
      showToast(`Schedule updated — crawls will run every ${intervalInput}h.`);
      fetchStatus();
    } catch (err) {
      showToast('Error: ' + err.message);
    }
  };

  const handleToggleEnabled = async (checked) => {
    try {
      const res = await apiFetch('/api/crawler/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: checked }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update');
      showToast(checked ? 'Scheduler enabled.' : 'Scheduler paused — no automatic crawls will run.');
      fetchStatus();
    } catch (err) {
      showToast('Error: ' + err.message);
    }
  };

  const handleRunNow = async (seedIds = null) => {
    setRunning(true);
    try {
      const res = await apiFetch('/api/crawler/run-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(seedIds ? { seedIds } : {}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to start crawl');
      showToast(data.message);
      setTimeout(() => { fetchStatus(); fetchSeeds(); }, 3000);
    } catch (err) {
      showToast('Error: ' + err.message);
    } finally {
      setTimeout(() => setRunning(false), 3000);
    }
  };

  const handleToggleSeedEnabled = async (seed) => {
    try {
      const res = await apiFetch(`/api/crawler/seeds/${seed._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !seed.isEnabled }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to toggle');
      fetchSeeds();
    } catch (err) {
      showToast('Error: ' + err.message);
    }
  };

  const handleOpenAdd = () => {
    setEditingSeed(null);
    setSeedForm({ category: '', subcategory: '', keywords: '', topN: 20, frequencyHours: intervalInput || 24 });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (seed) => {
    setEditingSeed(seed);
    setSeedForm({ category: seed.category, subcategory: seed.subcategory, keywords: seed.keywords, topN: seed.topN, frequencyHours: seed.frequencyHours || 24 });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSaveSeed = async () => {
    if (!seedForm.category || !seedForm.subcategory || !seedForm.keywords) {
      setFormError('Category, subcategory, and keywords are all required.');
      return;
    }
    try {
      let res;
      if (editingSeed) {
        res = await apiFetch(`/api/crawler/seeds/${editingSeed._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(seedForm),
        });
      } else {
        res = await apiFetch('/api/crawler/seeds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(seedForm),
        });
      }
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save seed');
      setIsModalOpen(false);
      showToast(editingSeed ? 'Seed updated.' : 'Seed created.');
      fetchSeeds();
      fetchStatus();
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleDeleteSeed = async (id) => {
    if (!window.confirm('Delete this keyword seed? It will stop being crawled.')) return;
    try {
      const res = await apiFetch(`/api/crawler/seeds/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete');
      showToast('Seed deleted.');
      fetchSeeds();
      fetchStatus();
    } catch (err) {
      showToast('Error: ' + err.message);
    }
  };

  const config = status?.config;
  const isCurrentlyRunning = config?.isRunning || running;

  return (
    <section style={{ padding: '0 0 40px' }}>
      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', background: '#0f172a', color: '#fff',
          padding: '12px 20px', borderRadius: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.9rem', fontWeight: 600,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#38bdf8' }}>info</span>
          {toastMessage}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ color: '#ec4899' }}>star</span>
            Bestseller Crawler
          </h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: 680 }}>
            Scrapes Amazon.in search pages for each keyword seed below and enrolls the top-ranked products
            into the catalog — one seed per Master subcategory by default, but fully editable: change
            keywords, add new seeds, or disable ones you don&apos;t want tracked. Each seed runs on its own
            <strong> Frequency</strong> (edit per-row) — a fast-moving keyword can re-check more often than a
            slow one, instead of everything sharing one global schedule. Due seeds dispatch concurrently, so
            how fast they actually clear depends on how many scraper workers are online.
          </p>
        </div>
      </div>

      {/* Summary + Schedule Cards */}
      <div className="grid-cards" style={{ marginBottom: '1.5rem' }}>
        <div className="card glass crm-stat-card">
          <div className="crm-stat-icon" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
            <span className="material-symbols-outlined">list_alt</span>
          </div>
          <div className="crm-stat-value">{status?.totalSeeds ?? '—'}</div>
          <div className="crm-stat-label">Total Seeds</div>
        </div>
        <div className="card glass crm-stat-card">
          <div className="crm-stat-icon" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
            <span className="material-symbols-outlined">check_circle</span>
          </div>
          <div className="crm-stat-value">{status?.enabledSeeds ?? '—'}</div>
          <div className="crm-stat-label">Enabled</div>
        </div>
        <div className="card glass crm-stat-card">
          <div className="crm-stat-icon" style={{ background: 'rgba(236,72,153,0.15)', color: '#ec4899' }}>
            <span className="material-symbols-outlined">inventory_2</span>
          </div>
          <div className="crm-stat-value">{status?.totalEnrolled ?? '—'}</div>
          <div className="crm-stat-label">Products Enrolled</div>
        </div>
        <div className="card glass crm-stat-card">
          <div className="crm-stat-icon" style={{ background: isCurrentlyRunning ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)', color: isCurrentlyRunning ? '#f59e0b' : '#3b82f6' }}>
            <span className="material-symbols-outlined">{isCurrentlyRunning ? 'sync' : 'schedule'}</span>
          </div>
          <div className="crm-stat-value" style={{ fontSize: '1.1rem' }}>
            {isCurrentlyRunning ? 'Running…' : timeUntil(config?.nextRunAt)}
          </div>
          <div className="crm-stat-label">{isCurrentlyRunning ? 'Crawl in progress' : 'Next Run'}</div>
        </div>
      </div>

      {/* Schedule Control */}
      <div className="card glass" style={{ padding: 24, marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '1.05rem', fontWeight: 700 }}>Schedule</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Default frequency for new seeds (hours)
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number"
                min={1}
                max={168}
                className="filter-input"
                style={{ width: 100, padding: '8px 12px' }}
                value={intervalInput}
                onChange={(e) => setIntervalInput(parseInt(e.target.value, 10) || 24)}
              />
              <button className="btn btn-primary" style={{ padding: '8px 16px' }} onClick={handleSaveConfig}>
                Save
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Scheduler
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38 }}>
              <Switch checked={config?.isEnabled !== false} onCheckedChange={handleToggleEnabled} />
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: config?.isEnabled !== false ? '#10b981' : 'var(--text-muted)' }}>
                {config?.isEnabled !== false ? 'Enabled' : 'Paused'}
              </span>
            </div>
          </div>

          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>
              Last run: {timeAgo(config?.lastRunAt)}
              {config?.lastRunStats?.seedsCrawled ? ` — ${config.lastRunStats.productsEnrolled} enrolled, ${config.lastRunStats.productsUpdated} updated, ${config.lastRunStats.errors} errors` : ''}
            </div>
            <button
              className="btn btn-primary"
              style={{ padding: '8px 20px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={() => handleRunNow()}
              disabled={isCurrentlyRunning}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{isCurrentlyRunning ? 'sync' : 'play_arrow'}</span>
              {isCurrentlyRunning ? 'Running…' : 'Run Now (all enabled seeds)'}
            </button>
          </div>
        </div>
      </div>

      {/* Seeds Table */}
      <div className="card glass">
        <div className="filter-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h3 style={{ margin: 0 }}>Keyword Seeds ({enabledCount}/{seeds.length} enabled)</h3>
            <button className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '0.85rem', fontWeight: 600 }} onClick={handleOpenAdd}>
              + Add Seed
            </button>
          </div>
          <input
            type="text"
            className="filter-input"
            placeholder="🔍 Search category, subcategory, keywords..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280 }}
          />
        </div>

        <div className="table-container-modern" style={{ marginTop: '1rem' }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category / Subcategory</TableHead>
                <TableHead>Keywords</TableHead>
                <TableHead>Top N</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead>Last Run</TableHead>
                <TableHead>Last Result</TableHead>
                <TableHead style={{ textAlign: 'right' }}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSeeds.length > 0 ? (
                filteredSeeds.map(seed => (
                  <TableRow key={seed._id}>
                    <TableCell>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{seed.category}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{seed.subcategory}</div>
                    </TableCell>
                    <TableCell>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{seed.keywords}</span>
                    </TableCell>
                    <TableCell>{seed.topN}</TableCell>
                    <TableCell style={{ fontSize: '0.85rem' }}>every {seed.frequencyHours || 24}h</TableCell>
                    <TableCell>
                      <Switch checked={seed.isEnabled} onCheckedChange={() => handleToggleSeedEnabled(seed)} />
                    </TableCell>
                    <TableCell style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{timeAgo(seed.lastRunAt)}</TableCell>
                    <TableCell style={{ fontSize: '0.8rem' }}>
                      {seed.lastResult?.error ? (
                        <span style={{ color: '#ef4444' }}>{seed.lastResult.error.slice(0, 40)}</span>
                      ) : seed.lastRunAt ? (
                        <span style={{ color: 'var(--text-muted)' }}>
                          {seed.lastResult?.found ?? 0} found, {seed.lastResult?.enrolled ?? 0} new
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not run yet</span>
                      )}
                    </TableCell>
                    <TableCell style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          className="btn"
                          style={{ padding: '4px 10px', fontSize: '0.75rem', background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)' }}
                          onClick={() => handleRunNow([seed._id])}
                          disabled={isCurrentlyRunning}
                          title="Run just this seed now"
                        >
                          Run
                        </button>
                        <button
                          className="btn"
                          style={{ padding: '4px 10px', fontSize: '0.75rem', background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)' }}
                          onClick={() => handleOpenEdit(seed)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          onClick={() => handleDeleteSeed(seed._id)}
                        >
                          Delete
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '3rem', opacity: 0.2, marginBottom: 12 }}>search_off</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {search ? `No seeds match "${search}"` : 'No seeds configured yet'}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20,
        }}>
          <div className="card glass" style={{ width: 480, maxWidth: '100%', background: '#ffffff', padding: '2rem', borderRadius: 16, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--accent)' }}>
                {editingSeed ? 'edit_square' : 'add_circle'}
              </span>
              {editingSeed ? 'Edit Seed' : 'New Seed'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>Category *</label>
                  <input
                    type="text"
                    className="filter-input"
                    style={{ width: '100%', padding: '10px 12px' }}
                    placeholder="e.g. electronics"
                    value={seedForm.category}
                    onChange={(e) => setSeedForm({ ...seedForm, category: e.target.value })}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>Subcategory *</label>
                  <input
                    type="text"
                    className="filter-input"
                    style={{ width: '100%', padding: '10px 12px' }}
                    placeholder="e.g. mobiles"
                    value={seedForm.subcategory}
                    onChange={(e) => setSeedForm({ ...seedForm, subcategory: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: -10 }}>
                Should match a value from Settings → Master Data (Categories/Subcategories) so products land in the right place.
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>Search Keywords *</label>
                <input
                  type="text"
                  className="filter-input"
                  style={{ width: '100%', padding: '10px 12px' }}
                  placeholder="e.g. wireless earbuds headphones"
                  value={seedForm.keywords}
                  onChange={(e) => setSeedForm({ ...seedForm, keywords: e.target.value })}
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Becomes an Amazon.in search: amazon.in/s?k={encodeURIComponent(seedForm.keywords || '...')}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>Top N Products</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    className="filter-input"
                    style={{ width: 120, padding: '10px 12px' }}
                    value={seedForm.topN}
                    onChange={(e) => setSeedForm({ ...seedForm, topN: parseInt(e.target.value, 10) || 20 })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>Frequency (hours)</label>
                  <input
                    type="number"
                    min={1}
                    max={168}
                    className="filter-input"
                    style={{ width: 120, padding: '10px 12px' }}
                    value={seedForm.frequencyHours}
                    onChange={(e) => setSeedForm({ ...seedForm, frequencyHours: parseInt(e.target.value, 10) || 24 })}
                  />
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    How often THIS keyword re-checks, independent of other seeds.
                  </div>
                </div>
              </div>

              {formError && (
                <div style={{ fontSize: '0.8rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>error</span> {formError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button className="btn" style={{ background: 'transparent' }} onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleSaveSeed}>
                  {editingSeed ? 'Save Changes' : 'Create Seed'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
