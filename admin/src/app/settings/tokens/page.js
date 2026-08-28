'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';

const formatTime = (isoString) => {
  if (!isoString) return 'Never used';
  const date = new Date(isoString);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);
  
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const maskToken = (token) => {
  if (!token) return 'N/A';
  if (token.length <= 8) return '••••••••';
  return `${token.slice(0, 5)}••••••••${token.slice(-4)}`;
};

export default function TokensPage() {
  // Top-Level View Switcher: 'tokens' | 'logs'
  const [currentViewTab, setCurrentViewTab] = useState('tokens');

  // Tokens state
  const [tokens, setTokens] = useState([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, exhausted: 0, totalUsage: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active Tab for Control Deck: 'automation' | 'manual'
  const [activeDeckTab, setActiveDeckTab] = useState('automation');

  // Form states
  const [tokenInput, setTokenInput] = useState('');
  const [isBulk, setIsBulk] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [visibleTokenIds, setVisibleTokenIds] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Automation states
  const [batchCount, setBatchCount] = useState(3);
  const [headlessMode, setHeadlessMode] = useState(true);
  const [automationStatus, setAutomationStatus] = useState(null);
  const [isStartingAutomation, setIsStartingAutomation] = useState(false);
  const [isStartingTest, setIsStartingTest] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);

  // Table selection, sorting & filtering
  const [selectedIds, setSelectedIds] = useState([]);
  const [sortField, setSortField] = useState('lastUsedAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isSyncing, setIsSyncing] = useState(false);

  // --- LOGS STATE ---
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsMetrics, setLogsMetrics] = useState({
    totalScrapes24h: 0,
    successRate: 100,
    directCount: 0,
    proxyCount: 0,
    avgDurationMs: 0,
    concurrency409Avoided: 0,
    queue: null,
  });
  const [logsPagination, setLogsPagination] = useState({ total: 0, page: 1, limit: 25, pages: 1 });
  const [logsSearch, setLogsSearch] = useState('');
  const [logsStatusFilter, setLogsStatusFilter] = useState('all');
  const [logsSourceFilter, setLogsSourceFilter] = useState('all');
  const [logsModeFilter, setLogsModeFilter] = useState('all');
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(true);
  const [selectedLogDetail, setSelectedLogDetail] = useState(null);

  const [apiBase, setApiBase] = useState(process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:3001');

  const showToast = (msg, duration = 3500) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), duration);
  };

  useEffect(() => {
  }, []);

  const apiFetch = useCallback(async (endpoint, options = {}) => {
    try {
      const base = apiBase ? apiBase.replace(/\/+$/, '') : '';
      const url = endpoint.startsWith('http') ? endpoint : (base ? `${base}${endpoint}` : endpoint);
      return await fetch(url, options);
    } catch (err) {
      if (!endpoint.startsWith('http')) {
        return await fetch(endpoint, options);
      }
      throw err;
    }
  }, [apiBase]);

  const fetchTokens = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch('/api/tokens');
      const data = await res.json();

      if (data.success) {
        setTokens(data.tokens || []);
        setSummary(data.summary || { total: 0, active: 0, exhausted: 0, totalUsage: 0 });
      } else {
        throw new Error(data.error || 'Failed to load ScrapingAnt tokens');
      }
    } catch (err) {
      console.error('Fetch tokens error:', err);
      setError(err.message || 'Failed to connect to API service');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  // Fetch Automation Status
  const fetchAutomationStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/tokens/automation-status');
      const data = await res.json();
      if (data.success) {
        setAutomationStatus(data);
      }
    } catch (err) {
      console.warn('Automation status poll failed:', err.message);
    }
  }, [apiFetch]);

  // Fetch Scraping Logs
  const fetchLogs = useCallback(async (page = logsPagination.page) => {
    try {
      setLogsLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(logsPagination.limit),
        status: logsStatusFilter,
        source: logsSourceFilter,
        mode: logsModeFilter,
        q: logsSearch,
      });

      const res = await apiFetch(`/api/tokens/logs?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setLogs(data.logs || []);
        setLogsPagination(data.pagination || { total: 0, page: 1, limit: 25, pages: 1 });
        if (data.metrics) setLogsMetrics(data.metrics);
      }
    } catch (err) {
      console.error('Fetch logs error:', err);
    } finally {
      setLogsLoading(false);
    }
  }, [apiFetch, logsPagination.page, logsPagination.limit, logsStatusFilter, logsSourceFilter, logsModeFilter, logsSearch]);

  useEffect(() => {
    fetchTokens();
    fetchAutomationStatus();
  }, [fetchTokens, fetchAutomationStatus]);

  // Poll automation status continuously when active or periodically
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAutomationStatus();
    }, automationStatus?.running ? 2000 : 8000);
    return () => clearInterval(interval);
  }, [automationStatus?.running, fetchAutomationStatus]);

  useEffect(() => {
    if (currentViewTab === 'logs') {
      fetchLogs(1);
    }
  }, [currentViewTab, logsStatusFilter, logsSourceFilter, logsModeFilter, fetchLogs]);

  // Auto-refresh logs timer (every 6 seconds if enabled)
  useEffect(() => {
    if (currentViewTab !== 'logs' || !autoRefreshLogs) return;
    const interval = setInterval(() => {
      fetchLogs(logsPagination.page);
    }, 6000);
    return () => clearInterval(interval);
  }, [currentViewTab, autoRefreshLogs, logsPagination.page, fetchLogs]);

  // Start Automated ScrapingAnt Scraper Batch
  const handleStartAutomation = async () => {
    try {
      setIsStartingAutomation(true);
      const res = await apiFetch('/api/tokens/generate-scrapingant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: batchCount, headless: headlessMode }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`⚡ ${data.message || 'Auto-scrape automation started!'}`);
        setActiveDeckTab('automation');
        fetchAutomationStatus();
      } else {
        showToast(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      showToast(`❌ Failed to start auto-scraper: ${err.message}`);
    } finally {
      setIsStartingAutomation(false);
    }
  };

  // Run Test Run / Login Check
  const handleTestLogin = async () => {
    try {
      setIsStartingTest(true);
      const res = await apiFetch('/api/tokens/test-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headless: headlessMode }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('🧪 Test run started! Checking stealth browser & Smail/Sonjj session...');
        setActiveDeckTab('automation');
        fetchAutomationStatus();
      } else {
        showToast(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      showToast(`❌ Failed to start test run: ${err.message}`);
    } finally {
      setIsStartingTest(false);
    }
  };

  // Stop / Abort Automation Run
  const handleStopAutomation = async () => {
    try {
      const res = await apiFetch('/api/tokens/stop-automation', { method: 'POST' });
      const data = await res.json();
      showToast(data.message || 'Abort requested');
      fetchAutomationStatus();
    } catch (err) {
      showToast('Failed to stop automation');
    }
  };

  // Submit OTP Code
  const handleSubmitOtp = async (e) => {
    e.preventDefault();
    if (!otpCode.trim()) return;
    try {
      setIsSubmittingCode(true);
      const res = await apiFetch('/api/tokens/submit-otp-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: otpCode.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ OTP code submitted to automation runner!');
        setOtpCode('');
        fetchAutomationStatus();
      } else {
        showToast(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      showToast('Failed to submit OTP');
    } finally {
      setIsSubmittingCode(false);
    }
  };

  const handleAddTokens = async (e) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;

    try {
      setIsSubmitting(true);
      let payload;

      if (isBulk) {
        const rawList = tokenInput.split(/[\n,]+/).map((t) => t.trim()).filter(Boolean);
        if (rawList.length === 0) return;
        payload = { tokens: rawList };
      } else {
        payload = { token: tokenInput.trim() };
      }

      const res = await apiFetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        showToast(isBulk ? `Successfully added ${data.results?.insertedCount || 0} tokens!` : 'Token added successfully!');
        setTokenInput('');
        fetchTokens();
      } else {
        throw new Error(data.error || 'Failed to add token');
      }
    } catch (err) {
      showToast(err.message, 4500);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'exhausted' : 'active';
    try {
      const res = await apiFetch(`/api/tokens/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Token marked as ${newStatus}`);
        fetchTokens();
      }
    } catch (err) {
      showToast('Failed to update status');
    }
  };

  const handleDeleteToken = async (id) => {
    if (!confirm('Are you sure you want to remove this API token?')) return;
    try {
      const res = await apiFetch(`/api/tokens/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Token removed from pool');
        fetchTokens();
      }
    } catch (err) {
      showToast('Failed to delete token');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected tokens?`)) return;
    try {
      const res = await apiFetch('/api/tokens/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Deleted ${selectedIds.length} tokens`);
        setSelectedIds([]);
        fetchTokens();
      }
    } catch (err) {
      showToast('Bulk delete failed');
    }
  };

  const handleSyncTokens = async () => {
    try {
      setIsSyncing(true);
      const res = await apiFetch('/api/tokens/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(`Synced ${data.syncedCount || 0} tokens with live credits`);
        fetchTokens();
      }
    } catch (err) {
      showToast('Failed to sync tokens');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportCSV = () => {
    if (tokens.length === 0) return;
    const headers = ['Token', 'Status', 'Usage Count', 'Last Used At', 'Created At'];
    const rows = tokens.map((t) => [
      `"${t.token}"`,
      t.status,
      t.usageCount || 0,
      t.lastUsedAt ? new Date(t.lastUsedAt).toISOString() : '',
      t.createdAt ? new Date(t.createdAt).toISOString() : '',
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `scrapingant_tokens_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleTokenVisibility = (id) => {
    setVisibleTokenIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const copyToClipboard = (token, id) => {
    navigator.clipboard.writeText(token);
    setCopiedId(id);
    showToast('Token copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter and sort tokens
  const filteredTokens = useMemo(() => {
    return tokens
      .filter((t) => {
        if (statusFilter !== 'all' && t.status !== statusFilter) return false;
        if (search && !t.token.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (sortField === 'lastUsedAt' || sortField === 'createdAt') {
          valA = valA ? new Date(valA).getTime() : 0;
          valB = valB ? new Date(valB).getTime() : 0;
        }
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [tokens, statusFilter, search, sortField, sortOrder]);

  const activePercent = summary.total > 0 ? Math.round((summary.active / summary.total) * 100) : 0;

  return (
    <section style={{ padding: '0 0 40px' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: '#0f172a',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '10px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: '0.9rem',
            fontWeight: 600,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#38bdf8' }}>info</span>
          {toastMessage}
        </div>
      )}

      {/* PAGE HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Scraping Engine & Proxy Pool</h2>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 20,
                fontSize: '0.78rem',
                fontWeight: 700,
                background: summary.active > 0 ? '#ecfdf5' : '#fef2f2',
                color: summary.active > 0 ? '#059669' : '#dc2626',
                border: `1px solid ${summary.active > 0 ? '#10b98130' : '#ef444430'}`,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: summary.active > 0 ? '#10b981' : '#ef4444',
                  boxShadow: summary.active > 0 ? '0 0 6px #10b981' : 'none',
                }}
              />
              {summary.active} Ready
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: '0.88rem' }}>
            High-concurrency scraping token rotation pool, automated token extractor script, and real-time activity logs.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Auto-Scrape Tokens Button */}
          <button
            onClick={handleStartAutomation}
            disabled={isStartingAutomation || automationStatus?.running}
            className="btn btn-primary"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff',
              border: 'none',
              padding: '8px 18px',
              fontSize: '0.88rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderRadius: 8,
              cursor: isStartingAutomation || automationStatus?.running ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
            }}
            title="Launch automated browser script to harvest new ScrapingAnt tokens"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 19 }}>bolt</span>
            {isStartingAutomation ? 'Starting...' : 'Auto-Scrape Tokens'}
          </button>

          {/* Run Test Run Button */}
          <button
            onClick={handleTestLogin}
            disabled={isStartingTest || automationStatus?.running}
            className="btn btn-secondary"
            style={{
              padding: '8px 16px',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderRadius: 8,
              cursor: isStartingTest || automationStatus?.running ? 'not-allowed' : 'pointer',
            }}
            title="Runs diagnostic test of stealth browser and Sonjj/Smail session"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#f59e0b' }}>science</span>
            {isStartingTest ? 'Testing...' : 'Run Test Run'}
          </button>

          <button
            onClick={handleExportCSV}
            className="btn"
            style={{
              background: 'rgba(0, 0, 0, 0.04)',
              color: 'var(--text-main)',
              border: '1px solid var(--border)',
              padding: '7px 14px',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderRadius: 8,
              cursor: 'pointer',
            }}
            title="Export full list of API keys to CSV"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
            Export CSV
          </button>

          <button
            className="btn btn-secondary"
            style={{
              padding: '7px 16px',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderRadius: 8,
              cursor: isSyncing ? 'not-allowed' : 'pointer',
            }}
            onClick={handleSyncTokens}
            disabled={isSyncing}
            title="Syncs live usage & remaining credits with ScrapingAnt for all tokens"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18, animation: isSyncing ? 'spin 1s linear infinite' : 'none' }}>
              {isSyncing ? 'progress_activity' : 'sync'}
            </span>
            {isSyncing ? 'Syncing...' : 'Sync Tokens'}
          </button>
        </div>
      </div>

      {/* TOP-LEVEL VIEW TABS */}
      <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid var(--border)', marginBottom: '1.5rem', paddingBottom: 2 }}>
        <button
          onClick={() => setCurrentViewTab('tokens')}
          style={{
            padding: '10px 22px',
            fontSize: '0.92rem',
            fontWeight: 700,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: currentViewTab === 'tokens' ? 'var(--accent)' : 'var(--text-muted)',
            borderBottom: currentViewTab === 'tokens' ? '3px solid var(--accent)' : '3px solid transparent',
            transition: 'all 0.15s ease',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>key</span>
          ScrapingAnt Token Pool ({summary.total})
        </button>

        <button
          onClick={() => setCurrentViewTab('logs')}
          style={{
            padding: '10px 22px',
            fontSize: '0.92rem',
            fontWeight: 700,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: currentViewTab === 'logs' ? 'var(--accent)' : 'var(--text-muted)',
            borderBottom: currentViewTab === 'logs' ? '3px solid var(--accent)' : '3px solid transparent',
            transition: 'all 0.15s ease',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>receipt_long</span>
          Scraping Logs & Activity Tracker
          {logsMetrics.totalScrapes24h > 0 && (
            <span
              style={{
                background: 'rgba(99,102,241,0.12)',
                color: '#6366f1',
                padding: '2px 7px',
                borderRadius: 12,
                fontSize: '0.72rem',
                fontWeight: 800,
              }}
            >
              {logsMetrics.totalScrapes24h}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: TOKENS & GENERATOR CONTROL DECK */}
      {/* ========================================================================= */}
      {currentViewTab === 'tokens' && (
        <>
          {/* Summary Health Cards */}
          <div className="grid-cards" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {/* Total Tokens */}
            <div className="card glass crm-stat-card" style={{ borderTop: '3px solid #818cf8', position: 'relative' }}>
              <div className="crm-stat-icon" style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>
                <span className="material-symbols-outlined">key</span>
              </div>
              <div className="crm-stat-value">{summary.total}</div>
              <div className="crm-stat-label">Total Tokens in Pool</div>
              <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: -4 }}>Configured keys</span>
            </div>

            {/* Active Tokens */}
            <div className="card glass crm-stat-card" style={{ borderTop: '3px solid #10b981', position: 'relative' }}>
              <div className="crm-stat-icon" style={{ background: 'rgba(16,185,129,0.12)', color: '#059669' }}>
                <span className="material-symbols-outlined">check_circle</span>
              </div>
              <div className="crm-stat-value" style={{ color: '#059669' }}>{summary.active}</div>
              <div className="crm-stat-label">Active & Ready</div>
              <span style={{ fontSize: '0.73rem', fontWeight: 600, color: '#059669', marginTop: -4 }}>
                {activePercent}% pool health
              </span>
            </div>

            {/* Exhausted Tokens */}
            <div className="card glass crm-stat-card" style={{ borderTop: '3px solid #f59e0b', position: 'relative' }}>
              <div className="crm-stat-icon" style={{ background: 'rgba(245,158,11,0.12)', color: '#d97706' }}>
                <span className="material-symbols-outlined">battery_alert</span>
              </div>
              <div className="crm-stat-value" style={{ color: summary.exhausted > 0 ? '#d97706' : 'var(--text-main)' }}>
                {summary.exhausted}
              </div>
              <div className="crm-stat-label">Exhausted (429)</div>
              <span style={{ fontSize: '0.73rem', color: summary.exhausted > 0 ? '#d97706' : 'var(--text-muted)', marginTop: -4 }}>
                {summary.exhausted > 0 ? 'Needs reactivating' : 'No exhausted keys'}
              </span>
            </div>

            {/* Total Scrapes */}
            <div className="card glass crm-stat-card" style={{ borderTop: '3px solid #3b82f6', position: 'relative' }}>
              <div className="crm-stat-icon" style={{ background: 'rgba(59,130,246,0.12)', color: '#2563eb' }}>
                <span className="material-symbols-outlined">query_stats</span>
              </div>
              <div className="crm-stat-value">{summary.totalUsage?.toLocaleString() || 0}</div>
              <div className="crm-stat-label">Total API Scrapes</div>
              <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: -4 }}>Lifetime requests made</span>
            </div>
          </div>

          {/* CONTROL DECK: DUAL TAB INTERFACE (AUTOMATED GENERATOR & MANUAL) */}
          <div
            className="card glass"
            style={{
              marginBottom: '1.5rem',
              padding: '1.5rem',
              border: '1.5px solid var(--border)',
              borderRadius: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setActiveDeckTab('automation')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    background: activeDeckTab === 'automation' ? '#6366f1' : 'transparent',
                    color: activeDeckTab === 'automation' ? '#fff' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>smart_toy</span>
                  Automated Token Scraper (Script)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDeckTab('manual')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    background: activeDeckTab === 'manual' ? '#6366f1' : 'transparent',
                    color: activeDeckTab === 'manual' ? '#fff' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit_note</span>
                  Manual Token Import
                </button>
              </div>

              {/* Live Status Pill */}
              {automationStatus?.running ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fef3c7', padding: '4px 12px', borderRadius: 20, color: '#92400e', fontSize: '0.8rem', fontWeight: 700 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, animation: 'spin 1s linear infinite' }}>sync</span>
                  {automationStatus.mode === 'test-login' ? 'Running Diagnostic Test...' : `Scraping Tokens (${automationStatus.completedCount}/${automationStatus.requestedCount})...`}
                  <button
                    onClick={handleStopAutomation}
                    style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '2px 8px', borderRadius: 6, fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700 }}
                  >
                    Abort
                  </button>
                </div>
              ) : (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Script Status: <b>Idle</b>
                </span>
              )}
            </div>

            {/* TAB CONTENT A: AUTOMATED TOKEN SCRAPER */}
            {activeDeckTab === 'automation' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>
                      ScrapingAnt Automated Account & Token Extractor
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      Automatically provisions disposable email, registers ScrapingAnt account, solves anti-bot Captcha via 2Captcha, verifies email, and adds extracted tokens to database.
                    </div>
                  </div>

                  {/* Batch Controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>Quantity:</span>
                    {[1, 3, 5, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setBatchCount(num)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: 6,
                          border: batchCount === num ? '2px solid #6366f1' : '1px solid var(--border)',
                          background: batchCount === num ? '#eff6ff' : '#fff',
                          color: batchCount === num ? '#4338ca' : 'var(--text-main)',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                        }}
                      >
                        {num}
                      </button>
                    ))}

                    <button
                      onClick={handleStartAutomation}
                      disabled={isStartingAutomation || automationStatus?.running}
                      className="btn btn-primary"
                      style={{
                        padding: '8px 18px',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: isStartingAutomation || automationStatus?.running ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>bolt</span>
                      {isStartingAutomation ? 'Starting...' : `Start Auto-Scrape (${batchCount})`}
                    </button>

                    <button
                      onClick={handleTestLogin}
                      disabled={isStartingTest || automationStatus?.running}
                      className="btn btn-secondary"
                      style={{
                        padding: '8px 14px',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: isStartingTest || automationStatus?.running ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#f59e0b' }}>science</span>
                      Test Run
                    </button>
                  </div>
                </div>

                {/* OTP Prompt Banner (if awaiting email code) */}
                {automationStatus?.awaitingCode && (
                  <div
                    style={{
                      background: '#fffbeb',
                      border: '2px solid #f59e0b',
                      borderRadius: 12,
                      padding: '14px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#92400e', fontSize: '0.95rem' }}>
                      <span className="material-symbols-outlined" style={{ color: '#d97706' }}>mark_email_unread</span>
                      Action Required: Smail Pro One-Time Code
                    </div>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#78350f' }}>
                      A 6-digit login code was sent to <b>{automationStatus.awaitingCodeEmail || 'your email'}</b>. Enter it below to resume token generation:
                    </p>
                    <form onSubmit={handleSubmitOtp} style={{ display: 'flex', gap: 8, maxWidth: 320, marginTop: 4 }}>
                      <input
                        type="text"
                        placeholder="Enter 6-digit code"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: '1px solid #f59e0b',
                          fontWeight: 700,
                          fontSize: '1rem',
                          letterSpacing: '0.1em',
                          flex: 1,
                        }}
                      />
                      <button
                        type="submit"
                        disabled={isSubmittingCode || !otpCode.trim()}
                        className="btn btn-primary"
                        style={{ padding: '8px 16px', fontWeight: 700 }}
                      >
                        {isSubmittingCode ? 'Submitting...' : 'Submit'}
                      </button>
                    </form>
                  </div>
                )}

                {/* Automation Progress & Terminal Window */}
                {automationStatus && (
                  <div
                    style={{
                      background: '#0f172a',
                      borderRadius: 12,
                      padding: '14px 18px',
                      color: '#f8fafc',
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: '0.8rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 6 }}>
                      <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                        ⚡ Terminal Monitor: {automationStatus.running ? 'ACTIVE' : 'IDLE'}
                      </span>
                      <span style={{ color: '#94a3b8' }}>
                        Mode: <b>{automationStatus.mode || 'N/A'}</b> | Success: <b>{automationStatus.successCount || 0}</b> | Failed: <b>{automationStatus.failedCount || 0}</b>
                      </span>
                    </div>

                    {/* Test Result Message if finished */}
                    {automationStatus.testResult && (
                      <div style={{ color: automationStatus.testResult.success ? '#4ade80' : '#f87171', padding: '6px 0' }}>
                        ✓ Test Result: {automationStatus.testResult.message || (automationStatus.testResult.success ? 'Login check passed!' : 'Login test failed')}
                      </div>
                    )}

                    {/* Harvested Tokens List */}
                    {automationStatus.results?.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                        <span style={{ color: '#4ade80', fontWeight: 700 }}>Harvested Tokens:</span>
                        {automationStatus.results.map((r, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: 6 }}>
                            <span>🔑 {r.email} → {r.token?.slice(0, 16)}...</span>
                            <span style={{ color: '#a78bfa' }}>{new Date(r.createdAt || Date.now()).toLocaleTimeString()}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Error Stream */}
                    {automationStatus.errors?.length > 0 && (
                      <div style={{ color: '#f87171', marginTop: 4 }}>
                        {automationStatus.errors.slice(-3).map((err, idx) => (
                          <div key={idx}>⚠ {err}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT B: MANUAL TOKEN IMPORT */}
            {activeDeckTab === 'manual' && (
              <form onSubmit={handleAddTokens} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Insert API Key directly</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={isBulk} onChange={(e) => setIsBulk(e.target.checked)} />
                    Bulk Insert Mode (Multi-line)
                  </label>
                </div>

                {isBulk ? (
                  <textarea
                    className="input"
                    rows={4}
                    placeholder="Paste multiple tokens (one per line)..."
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                  />
                ) : (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input
                      type="text"
                      className="input"
                      placeholder="Paste ScrapingAnt token (e.g. 24269827...)"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button type="submit" className="btn btn-primary" disabled={isSubmitting || !tokenInput.trim()}>
                      {isSubmitting ? 'Saving...' : 'Add Token'}
                    </button>
                  </div>
                )}

                {isBulk && (
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting || !tokenInput.trim()} style={{ alignSelf: 'flex-end' }}>
                    {isSubmitting ? 'Importing...' : 'Import Tokens'}
                  </button>
                )}
              </form>
            )}
          </div>

          {/* Token Pool Table Card */}
          <div className="card glass" style={{ padding: '1.25rem' }}>
            {/* Filter Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, minWidth: 260 }}>
                <input
                  type="text"
                  className="input"
                  placeholder="Search token..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ maxWidth: 300 }}
                />
                <select
                  className="input"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ width: 140 }}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="exhausted">Exhausted (429)</option>
                </select>
              </div>

              {selectedIds.length > 0 && (
                <button onClick={handleBulkDelete} className="btn" style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' }}>
                  Delete Selected ({selectedIds.length})
                </button>
              )}
            </div>

            {/* Tokens Table */}
            <div style={{ overflowX: 'auto' }}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead style={{ width: 40 }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.length === filteredTokens.length && filteredTokens.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds(filteredTokens.map((t) => t._id));
                          else setSelectedIds([]);
                        }}
                      />
                    </TableHead>
                    <TableHead>Token Key</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Lifetime Requests</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Added On</TableHead>
                    <TableHead style={{ textAlign: 'right' }}>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                        <span className="material-symbols-outlined" style={{ animation: 'spin 1s linear infinite', fontSize: 24 }}>sync</span>
                        <div>Loading token pool...</div>
                      </TableCell>
                    </TableRow>
                  ) : filteredTokens.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                        No tokens found. Use the Automated Token Scraper above to harvest new tokens.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTokens.map((t) => {
                      const isVisible = visibleTokenIds.includes(t._id);
                      return (
                        <TableRow key={t._id}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(t._id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedIds((prev) => [...prev, t._id]);
                                else setSelectedIds((prev) => prev.filter((id) => id !== t._id));
                              }}
                            />
                          </TableCell>
                          <TableCell style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>{isVisible ? t.token : maskToken(t.token)}</span>
                              <button
                                onClick={() => toggleTokenVisibility(t._id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                                title={isVisible ? 'Hide token' : 'Reveal token'}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--text-muted)' }}>
                                  {isVisible ? 'visibility_off' : 'visibility'}
                                </span>
                              </button>
                              <button
                                onClick={() => copyToClipboard(t.token, t._id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                                title="Copy token"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16, color: copiedId === t._id ? '#10b981' : 'var(--text-muted)' }}>
                                  {copiedId === t._id ? 'check' : 'content_copy'}
                                </span>
                              </button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              onClick={() => handleToggleStatus(t._id, t.status)}
                              style={{
                                padding: '3px 8px',
                                borderRadius: 12,
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                background: t.status === 'active' ? '#ecfdf5' : '#fef2f2',
                                color: t.status === 'active' ? '#059669' : '#dc2626',
                                border: `1px solid ${t.status === 'active' ? '#10b98130' : '#ef444430'}`,
                              }}
                              title="Click to toggle status"
                            >
                              {t.status === 'active' ? 'Active' : 'Exhausted'}
                            </span>
                          </TableCell>
                          <TableCell style={{ fontWeight: 700 }}>{t.usageCount || 0}</TableCell>
                          <TableCell style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatTime(t.lastUsedAt)}</TableCell>
                          <TableCell style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatTime(t.createdAt)}</TableCell>
                          <TableCell style={{ textAlign: 'right' }}>
                            <button
                              onClick={() => handleDeleteToken(t._id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4 }}
                              title="Delete token"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SCRAPING LOGS & ACTIVITY TRACKER */}
      {/* ========================================================================= */}
      {currentViewTab === 'logs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Logs Metrics Cards */}
          <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="card glass crm-stat-card" style={{ borderTop: '3px solid #6366f1' }}>
              <div className="crm-stat-value">{logsMetrics.totalScrapes24h || 0}</div>
              <div className="crm-stat-label">Scrapes (Last 24h)</div>
              <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: -4 }}>Across all engines</span>
            </div>
            <div className="card glass crm-stat-card" style={{ borderTop: '3px solid #10b981' }}>
              <div className="crm-stat-value" style={{ color: '#059669' }}>{logsMetrics.successRate}%</div>
              <div className="crm-stat-label">Scrape Success Rate</div>
              <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: -4 }}>0 409 collisions</span>
            </div>
            <div className="card glass crm-stat-card" style={{ borderTop: '3px solid #0ea5e9' }}>
              <div className="crm-stat-value">{logsMetrics.directCount} / {logsMetrics.proxyCount}</div>
              <div className="crm-stat-label">Direct / Proxy Split</div>
              <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: -4 }}>Fast-path saves API tokens</span>
            </div>
            <div className="card glass crm-stat-card" style={{ borderTop: '3px solid #f59e0b' }}>
              <div className="crm-stat-value">{logsMetrics.avgDurationMs} ms</div>
              <div className="crm-stat-label">Average Request Latency</div>
              <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: -4 }}>Includes headless render</span>
            </div>
          </div>

          {/* Logs Table Card */}
          <div className="card glass" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, minWidth: 260 }}>
                <input
                  type="text"
                  className="input"
                  placeholder="Search URL or title in logs..."
                  value={logsSearch}
                  onChange={(e) => setLogsSearch(e.target.value)}
                  style={{ maxWidth: 300 }}
                />
                <select className="input" value={logsStatusFilter} onChange={(e) => setLogsStatusFilter(e.target.value)} style={{ width: 130 }}>
                  <option value="all">All Statuses</option>
                  <option value="success">Success Only</option>
                  <option value="failed">Failed Only</option>
                </select>
                <select className="input" value={logsModeFilter} onChange={(e) => setLogsModeFilter(e.target.value)} style={{ width: 150 }}>
                  <option value="all">All Modes</option>
                  <option value="scrapingant_proxy">ScrapingAnt Proxy</option>
                  <option value="direct">Direct Scrape</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={autoRefreshLogs} onChange={(e) => setAutoRefreshLogs(e.target.checked)} />
                  Auto-refresh (6s)
                </label>
                <button onClick={() => fetchLogs(1)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                  Refresh
                </button>
              </div>
            </div>

            {/* Logs Table */}
            <div style={{ overflowX: 'auto' }}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Target URL & Extracted Data</TableHead>
                    <TableHead>Engine Mode</TableHead>
                    <TableHead>Token Key</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Latency</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} style={{ textAlign: 'center', padding: '32px' }}>
                        Loading logs...
                      </TableCell>
                    </TableRow>
                  ) : logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} style={{ textAlign: 'center', padding: '32px' }}>
                        No scraping activity recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((l) => (
                      <TableRow key={l._id}>
                        <TableCell style={{ maxWidth: 340 }}>
                          <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {l.extractedData?.title || l.url}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {l.url}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span style={{ padding: '2px 8px', borderRadius: 6, background: l.mode === 'direct' ? '#f1f5f9' : '#eff6ff', color: l.mode === 'direct' ? '#475569' : '#2563eb', fontSize: '0.75rem', fontWeight: 700 }}>
                            {l.mode === 'direct' ? 'Direct' : 'ScrapingAnt'}
                          </span>
                        </TableCell>
                        <TableCell style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          {l.tokenUsed ? maskToken(l.tokenUsed) : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <span style={{ padding: '2px 8px', borderRadius: 10, background: l.status === 'success' ? '#ecfdf5' : '#fef2f2', color: l.status === 'success' ? '#059669' : '#dc2626', fontSize: '0.75rem', fontWeight: 700 }}>
                            {l.status === 'success' ? '200 OK' : `${l.statusCode || 'ERR'}`}
                          </span>
                        </TableCell>
                        <TableCell style={{ fontWeight: 600 }}>{l.durationMs}ms</TableCell>
                        <TableCell style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatTime(l.createdAt)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
