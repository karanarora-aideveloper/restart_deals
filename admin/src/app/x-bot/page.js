'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import AdminShell from '@/components/admin-shell';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';

const formatTime = (isoString) => {
  if (!isoString) return 'N/A';
  const date = new Date(isoString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const STATUS_META = {
  SUCCESS: { label: 'Posted', color: '#059669', bg: 'rgba(16, 185, 129, 0.1)', icon: 'check_circle' },
  FAILED: { label: 'Failed', color: 'var(--danger)', bg: 'rgba(220, 38, 38, 0.1)', icon: 'error' },
  CANCELLED: { label: 'Stopped', color: 'var(--text-muted)', bg: 'rgba(148, 163, 184, 0.12)', icon: 'stop_circle' },
  SKIPPED_DEVICE_OFFLINE: { label: 'Device Offline', color: '#d97706', bg: 'rgba(217, 119, 6, 0.1)', icon: 'phonelink_off' },
  SKIPPED_NO_DEAL: { label: 'No Qualifying Deal', color: 'var(--text-muted)', bg: 'rgba(148, 163, 184, 0.12)', icon: 'search_off' },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, color: 'var(--text-muted)', bg: 'rgba(148,163,184,0.12)', icon: 'help' };
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 999,
        background: meta.bg, color: meta.color, fontSize: '0.75rem', fontWeight: 700,
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{meta.icon}</span>
      {meta.label}
    </span>
  );
}

function DeviceStatusCard({ status, onRefresh, refreshing }) {
  const connected = status?.connected;
  return (
    <div className="card glass" style={{ marginBottom: 20 }}>
      <div style={{ padding: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: connected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(220, 38, 38, 0.1)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: connected ? '#059669' : 'var(--danger)' }}>
              {connected ? 'phone_android' : 'phonelink_off'}
            </span>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              {connected ? 'Posting device connected' : 'No posting device connected'}
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#10b981' : 'var(--danger)' }} />
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {connected
                ? `Device ID: ${status.deviceId}`
                : 'Plug in (or ADB-WiFi connect) the spare Android phone with the X app signed in as @Shoppersdealsus. Posting attempts are skipped, not retried, while it\'s offline.'}
            </div>
          </div>
        </div>
        <button className="btn" onClick={onRefresh} disabled={refreshing} style={{ padding: '8px 14px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, marginRight: 4 }}>refresh</span>
          {refreshing ? 'Checking…' : 'Recheck'}
        </button>
      </div>
    </div>
  );
}

export default function XBotPage() {
  const [apiBase, setApiBase] = useState(process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:3001');
  const adminApiKey = process.env.NEXT_PUBLIC_ADMIN_API_KEY || '';
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [checkingDevice, setCheckingDevice] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [posting, setPosting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [postResult, setPostResult] = useState(null);
  const [postError, setPostError] = useState(null);

  useEffect(() => {
  }, []);

  const apiFetch = useCallback(async (endpoint, options = {}) => {
    const base = apiBase.replace(/\/+$/, '');
    const headers = { ...(options.headers || {}), ...(adminApiKey ? { 'x-admin-key': adminApiKey } : {}) };
    return fetch(`${base}${endpoint}`, { ...options, headers });
  }, [apiBase, adminApiKey]);

  const fetchDeviceStatus = useCallback(async () => {
    setCheckingDevice(true);
    try {
      const res = await apiFetch('/api/x-bot/status');
      if (res.ok) setDeviceStatus(await res.json());
    } catch (err) {
      console.error('Fetch X bot device status error:', err);
    } finally {
      setCheckingDevice(false);
    }
  }, [apiFetch]);

  const fetchHistory = useCallback(async (page = 1) => {
    setHistoryPage(page);
    try {
      const res = await apiFetch(`/api/x-bot/history?page=${page}&limit=15`);
      if (!res.ok) return;
      const data = await res.json();
      setHistory(data.data || []);
      setHistoryTotalPages(data.pagination?.pages || 1);
    } catch (err) {
      console.error('Fetch X bot history error:', err);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchDeviceStatus();
    fetchHistory(1);
    // Passive re-check every 20s so the connected/offline indicator stays current without
    // needing a manual refresh — cheap (just `adb devices`, no device interaction).
    const timer = setInterval(fetchDeviceStatus, 20000);
    return () => clearInterval(timer);
  }, [fetchDeviceStatus, fetchHistory]);

  const handlePostNow = async () => {
    if (!window.confirm('Post the best qualifying US deal to X right now, using the connected device?')) return;
    setPosting(true);
    setPostResult(null);
    setPostError(null);
    try {
      const res = await apiFetch('/api/x-bot/post-now', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const data = await res.json();
      if (data.data?.status === 'CANCELLED') {
        setPostError('Stopped — no post was published.');
      } else if (!data.success) {
        setPostError(data.data?.errorMessage || data.error || `Post did not go through (${data.data?.status || 'unknown'}).`);
      } else {
        setPostResult(data.data);
      }
      fetchHistory(1);
    } catch (err) {
      setPostError(err.message);
    } finally {
      setPosting(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await apiFetch('/api/x-bot/cancel', { method: 'POST' });
      // Deliberately not setting posting=false here — the in-flight handlePostNow request is
      // still running and will resolve (as CANCELLED) on its own once xBot.js reaches its next
      // checkpoint; flipping posting off early would let a second click start a new run on top
      // of the one still winding down.
    } catch (err) {
      console.error('Cancel X bot post error:', err);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <AdminShell title="X Bot (USA)">
      <section className="view-section active-view">
        <DeviceStatusCard status={deviceStatus} onRefresh={fetchDeviceStatus} refreshing={checkingDevice} />

        <div className="card glass" style={{ marginBottom: 20 }}>
          <div style={{ padding: '1.2rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--accent)' }}>smart_toy</span>
              Auto-Posting to X (@Shoppersdealsus)
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Posts to X by driving the real X app on the connected Android device (no official API fee) — not the OAuth-based
              X Accounts under Channel Network.
            </p>
          </div>
          <div style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
              <strong>Schedule:</strong> automatically, 3×/day at 9:00 AM, 2:00 PM, and 7:00 PM (America/New_York).
              <br />
              <strong>Deal selection:</strong> the highest-discount deal with <code>country = US</code> and ≥40% off that hasn&apos;t
              been posted yet. If none qualify, or the device isn&apos;t connected, that cycle is skipped and logged below —
              nothing is retried automatically until the next scheduled time.
            </div>

            {postError && (
              <div style={{ fontSize: '0.85rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>error</span> {postError}
              </div>
            )}
            {postResult && (
              <div style={{ fontSize: '0.85rem', color: '#059669', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1rem', marginTop: 1 }}>check_circle</span>
                <span>Posted &ldquo;{postResult.dealTitle}&rdquo; — {postResult.publishedContent}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                className="btn btn-primary"
                disabled={posting || !deviceStatus?.connected}
                onClick={handlePostNow}
                style={{ padding: '10px 20px', fontWeight: 600 }}
                title={!deviceStatus?.connected ? 'Connect the posting device first' : undefined}
              >
                {posting ? 'Posting…' : 'Post Best Deal Now'}
              </button>
              {posting && (
                <button
                  className="btn"
                  disabled={cancelling}
                  onClick={handleCancel}
                  style={{ padding: '10px 18px', fontWeight: 600, background: 'rgba(220, 38, 38, 0.1)', color: 'var(--danger)', border: '1px solid rgba(220, 38, 38, 0.25)' }}
                  title="Stops after the current step finishes — if the compose screen is already open, it backs out without posting."
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16, marginRight: 4, verticalAlign: 'text-bottom' }}>stop_circle</span>
                  {cancelling ? 'Stopping…' : 'Stop'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="card glass">
          <div style={{ padding: '1.2rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0, fontWeight: 600 }}>History</h3>
          </div>
          <div className="mt-4 px-4 pb-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Deal</TableHead>
                  <TableHead>Published Content</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => {
                  const isExpanded = expandedLogId === h._id;
                  const hasDetail = (h.steps && h.steps.length > 0) || h.errorMessage;
                  return (
                    <Fragment key={h._id}>
                      <TableRow>
                        <TableCell>
                          {hasDetail && (
                            <button
                              className="btn"
                              style={{ padding: 4, background: 'transparent', color: 'var(--text-muted)' }}
                              onClick={() => setExpandedLogId(isExpanded ? null : h._id)}
                              title={isExpanded ? 'Hide step-by-step log' : 'Show step-by-step log'}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                                {isExpanded ? 'expand_less' : 'expand_more'}
                              </span>
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="font-medium max-w-[220px] truncate" title={h.dealTitle}>
                          {h.dealUrl ? (
                            <a href={h.dealUrl} target="_blank" rel="noreferrer" className="hover:underline">
                              {h.dealTitle || 'N/A'}
                            </a>
                          ) : (
                            h.dealTitle || 'N/A'
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[320px] truncate" title={h.publishedContent}>
                          {h.publishedContent || (h.errorMessage ? <span title={h.errorMessage}>{h.errorMessage.slice(0, 60)}</span> : '—')}
                        </TableCell>
                        <TableCell><StatusBadge status={h.status} /></TableCell>
                        <TableCell className="text-xs capitalize text-muted-foreground">{h.trigger}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatTime(h.timestamp)}</TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={6} style={{ background: 'var(--muted)', padding: '14px 20px' }}>
                            {h.errorMessage && (
                              <div style={{ marginBottom: h.steps?.length ? 10 : 0, fontSize: '0.82rem', color: 'var(--danger)' }}>
                                <strong>Error:</strong> {h.errorMessage}
                              </div>
                            )}
                            {h.steps && h.steps.length > 0 && (
                              <ol style={{ margin: 0, paddingLeft: 20, fontSize: '0.8rem', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {h.steps.map((s, i) => (
                                  <li key={i}>{s}</li>
                                ))}
                              </ol>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
                {history.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No posting attempts yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="pagination-container p-4" style={{ borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Page {historyPage} of {historyTotalPages}</span>
            <button className="page-btn" disabled={historyPage <= 1} onClick={() => fetchHistory(historyPage - 1)}>Previous</button>
            <button className="page-btn" disabled={historyPage >= historyTotalPages} onClick={() => fetchHistory(historyPage + 1)}>Next</button>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
