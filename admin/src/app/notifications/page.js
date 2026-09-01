'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminShell from '@/components/admin-shell';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';

const formatTime = (isoString) => {
  if (!isoString) return 'N/A';
  const date = new Date(isoString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

function StatusBanner({ status, apiBase }) {
  if (!status) return null;

  if (!status.firebaseReady) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderRadius: 10, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', marginBottom: 16 }}>
        <span className="material-symbols-outlined" style={{ color: '#d97706' }}>warning</span>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
          <strong>Firebase Admin isn&apos;t configured yet — sending is disabled.</strong>
          <div style={{ color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
            Generate a service account key from the Firebase console (Project Settings → Service Accounts → Generate New Private Key,
            for the <code>shoppers-deals</code> project) and save it as <code>api/firebase-service-account.json</code> on the server
            running <code>{apiBase}</code>.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '12px 16px', borderRadius: 10, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', marginBottom: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 600, color: '#059669' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
        Firebase Admin ready
      </div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 3 }}>android</span>
        {status.tokenCounts.android.toLocaleString('en-US')} Android
      </div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 3 }}>phone_iphone</span>
        {status.tokenCounts.ios.toLocaleString('en-US')} iOS
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const [apiBase, setApiBase] = useState(process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:3001');
  const adminApiKey = process.env.NEXT_PUBLIC_ADMIN_API_KEY || '';
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [targetPlatform, setTargetPlatform] = useState('all');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
  }, []);

  const apiFetch = useCallback(async (endpoint, options = {}) => {
    const base = apiBase.replace(/\/+$/, '');
    const headers = { ...(options.headers || {}), ...(adminApiKey ? { 'x-admin-key': adminApiKey } : {}) };
    return fetch(`${base}${endpoint}`, { ...options, headers });
  }, [apiBase, adminApiKey]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/notifications/status');
      if (!res.ok) return;
      setStatus(await res.json());
    } catch (err) {
      console.error('Fetch notification status error:', err);
    }
  }, [apiFetch]);

  const fetchHistory = useCallback(async (page = 1) => {
    setHistoryPage(page);
    try {
      const res = await apiFetch(`/api/notifications/history?page=${page}&limit=15`);
      if (!res.ok) return;
      const data = await res.json();
      setHistory(data.data || []);
      setHistoryTotalPages(data.pagination?.pages || 1);
    } catch (err) {
      console.error('Fetch notification history error:', err);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchStatus();
    fetchHistory(1);
  }, [fetchStatus, fetchHistory]);

  const recipientCountFor = (platform) => {
    if (!status?.tokenCounts) return 0;
    if (platform === 'android') return status.tokenCounts.android;
    if (platform === 'ios') return status.tokenCounts.ios;
    return status.tokenCounts.total;
  };

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return;
    const recipientCount = recipientCountFor(targetPlatform);
    const platformLabel = targetPlatform === 'all' ? 'device' : targetPlatform === 'android' ? 'Android device' : 'iOS device';
    if (!window.confirm(`Send this notification to ${recipientCount} ${platformLabel}${recipientCount === 1 ? '' : 's'}? This can't be undone.`)) return;

    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await apiFetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          data: link.trim() ? { link: link.trim() } : undefined,
          platform: targetPlatform,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to send notification');
      setResult(data.data);
      setTitle('');
      setBody('');
      setLink('');
      fetchHistory(1);
      fetchStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminShell title="Notifications">
      <section className="view-section active-view">
        <StatusBanner status={status} apiBase={apiBase} />

        <div className="card glass" style={{ marginBottom: 20 }}>
          <div style={{ padding: '1.2rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--accent)' }}>campaign</span>
              Send a Notification
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Broadcasts to every device currently registered for the platform you pick below.
            </p>
          </div>

          <div style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 560 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>Platform</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { value: 'all', label: 'All', icon: 'devices' },
                  { value: 'android', label: 'Android', icon: 'android' },
                  { value: 'ios', label: 'iOS', icon: 'phone_iphone' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTargetPlatform(opt.value)}
                    className="btn"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: '0.85rem', fontWeight: 600,
                      borderRadius: 8, border: `1px solid ${targetPlatform === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                      background: targetPlatform === opt.value ? 'rgba(255, 107, 0, 0.1)' : 'transparent',
                      color: targetPlatform === opt.value ? 'var(--accent)' : 'var(--text-main)',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{opt.icon}</span>
                    {opt.label} ({recipientCountFor(opt.value)})
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>Title *</label>
              <input
                type="text"
                className="filter-input"
                style={{ width: '100%', padding: '10px 12px', fontSize: '0.9rem' }}
                placeholder="e.g. 🔥 70% off flash sale is live!"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>Body *</label>
              <textarea
                className="filter-input"
                style={{ width: '100%', padding: '10px 12px', fontSize: '0.9rem', minHeight: 70, resize: 'vertical' }}
                placeholder="Short, punchy — this is what shows under the title."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={200}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>Deep link (optional)</label>
              <input
                type="text"
                className="filter-input"
                style={{ width: '100%', padding: '10px 12px', fontSize: '0.9rem' }}
                placeholder="shoppersdeals://deal/abc123 or a product/deal id"
                value={link}
                onChange={(e) => setLink(e.target.value)}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Sent as the notification&apos;s data payload — the app doesn&apos;t currently act on it yet, so treat this as forward-compatible metadata for now.
              </div>
            </div>

            {error && (
              <div style={{ fontSize: '0.85rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>error</span> {error}
              </div>
            )}

            {result && (
              <div style={{ fontSize: '0.85rem', color: '#059669', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>check_circle</span>
                Sent — {result.successCount} delivered, {result.failureCount} failed (of {result.recipientCount}).
              </div>
            )}

            <div>
              <button
                className="btn btn-primary"
                disabled={sending || !status?.firebaseReady || !title.trim() || !body.trim() || !(recipientCountFor(targetPlatform) > 0)}
                onClick={handleSend}
                style={{ padding: '10px 20px', fontWeight: 600 }}
              >
                {sending ? 'Sending…' : `Send to ${recipientCountFor(targetPlatform)} device${recipientCountFor(targetPlatform) === 1 ? '' : 's'}`}
              </button>
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
                  <TableHead>Title</TableHead>
                  <TableHead>Body</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Delivered</TableHead>
                  <TableHead>Failed</TableHead>
                  <TableHead>Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((n) => (
                  <TableRow key={n._id}>
                    <TableCell className="font-medium max-w-[200px] truncate" title={n.title}>{n.title}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[280px] truncate" title={n.body}>{n.body}</TableCell>
                    <TableCell className="text-xs">
                      <span className={`merchant-badge merchant-${n.platform === 'ios' ? 'flipkart' : 'amazon'}`}>{n.platform}</span>
                    </TableCell>
                    <TableCell>{n.recipientCount.toLocaleString('en-US')}</TableCell>
                    <TableCell style={{ color: '#059669', fontWeight: 600 }}>{n.successCount.toLocaleString('en-US')}</TableCell>
                    <TableCell style={{ color: n.failureCount > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: n.failureCount > 0 ? 600 : 400 }}>
                      {n.failureCount.toLocaleString('en-US')}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatTime(n.sentAt)}</TableCell>
                  </TableRow>
                ))}
                {history.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No notifications sent yet.
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
