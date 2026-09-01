'use client';

import { useState, useEffect, useCallback } from 'react';

const TABS = [
  { key: 'overview', label: '🏠 Overview' },
  { key: 'contacts', label: '👤 Contacts' },
  { key: 'chats', label: '💬 Chats' },
  { key: 'send', label: '📤 Send Message' },
  { key: 'screenshot', label: '🖼️ Screenshot' }
];

function formatTimestamp(unixSeconds) {
  if (!unixSeconds) return '';
  return new Date(unixSeconds * 1000).toLocaleString();
}

export default function WhatsAppPortalPage() {
  const [apiBase, setApiBase] = useState(process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:3001');
  const adminApiKey = process.env.NEXT_PUBLIC_ADMIN_API_KEY || '';
  const [channelId, setChannelId] = useState(null);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setChannelId(params.get('channelId'));
  }, []);

  const apiFetch = useCallback(async (endpoint, options = {}) => {
    const base = apiBase.replace(/\/+$/, '');
    const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;
    const headers = { ...(options.headers || {}), ...(adminApiKey ? { 'x-admin-key': adminApiKey } : {}) };
    return fetch(url, { ...options, headers });
  }, [apiBase, adminApiKey]);

  if (channelId === null) {
    return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading…</div>;
  }

  if (!channelId) {
    return (
      <div className="card glass" style={{ padding: '1.5rem' }}>
        No channel specified. Go to <a href="/network/connections" style={{ color: 'var(--accent)' }}>Channel Management</a> and click <strong>🚀 Open Full Portal</strong> on your connected WhatsApp card.
      </div>
    );
  }

  return (
    <section className="view-section active-view">
      <div style={{ marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <a href="/network/connections" style={{ color: 'var(--accent)', fontSize: '0.85rem', textDecoration: 'none' }}>← Channel Management</a>
        <h2 style={{ margin: 0, fontSize: '1.3rem' }}>WhatsApp Portal</h2>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: '1.2rem', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="btn"
            style={{
              padding: '8px 16px',
              fontSize: '0.85rem',
              fontWeight: 600,
              background: 'none',
              border: 'none',
              borderBottom: tab === t.key ? '3px solid var(--accent)' : '3px solid transparent',
              borderRadius: 0,
              color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab channelId={channelId} apiFetch={apiFetch} />}
      {tab === 'contacts' && <ContactsTab channelId={channelId} apiFetch={apiFetch} />}
      {tab === 'chats' && <ChatsTab channelId={channelId} apiFetch={apiFetch} onSendTo={(chatId) => { setTab('send'); window.__prefillChatId = chatId; }} />}
      {tab === 'send' && <SendTab channelId={channelId} apiFetch={apiFetch} />}
      {tab === 'screenshot' && <ScreenshotTab channelId={channelId} apiFetch={apiFetch} />}
    </section>
  );
}

function OverviewTab({ channelId, apiFetch }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [leadStats, setLeadStats] = useState(null);

  useEffect(() => {
    apiFetch(`/api/output-channels/${channelId}/waha/profile`).then(async (res) => {
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || 'Failed to load profile');
      setData(d);
    }).catch(err => setError(err.message));

    apiFetch('/api/leads').then(async (res) => {
      if (!res.ok) return;
      const d = await res.json();
      setLeadStats(d.stats);
    }).catch(() => {});
  }, [apiFetch, channelId]);

  if (error) {
    return <div style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 8 }}>{error}</div>;
  }
  if (!data) {
    return <div style={{ color: 'var(--text-muted)' }}>Loading profile…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card glass" style={{ padding: '1.2rem', display: 'flex', gap: 16, alignItems: 'center' }}>
        {data.profile.picture && (
          <img src={data.profile.picture} alt="Profile" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }} />
        )}
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{data.profile.name}</div>
          <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>+{(data.profile.id || '').split('@')[0]}</div>
        </div>
      </div>

      <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div className="card glass crm-stat-card">
          <div className="crm-stat-icon" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
            <span className="material-symbols-outlined">person_search</span>
          </div>
          <div className="crm-stat-value">{leadStats?.total ?? '—'}</div>
          <div className="crm-stat-label">Leads Imported</div>
        </div>
        <div className="card glass crm-stat-card">
          <div className="crm-stat-icon" style={{ background: 'rgba(5,150,105,0.15)', color: '#34d399' }}>
            <span className="material-symbols-outlined">groups</span>
          </div>
          <div className="crm-stat-value">{leadStats?.groups?.length ?? '—'}</div>
          <div className="crm-stat-label">Source Groups</div>
        </div>
        <div className="card glass crm-stat-card">
          <div className="crm-stat-icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>
            <span className="material-symbols-outlined">smart_toy</span>
          </div>
          <div className="crm-stat-value" style={{ fontSize: '1rem' }}>{data.version?.engine} · {data.version?.tier}</div>
          <div className="crm-stat-label">WAHA Engine</div>
        </div>
      </div>

      <div className="card glass" style={{ padding: '1.2rem' }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Server Info</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div>Version: <code>{data.version?.version}</code></div>
          <div>Browser: <code>{data.version?.browser}</code></div>
          <div>Platform: <code>{data.version?.platform}</code></div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <a href="/network/connections" style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>← Manage groups &amp; import leads</a>
        <a href="/audience/leads" style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>View imported leads →</a>
      </div>
    </div>
  );
}

function ContactsTab({ channelId, apiFetch }) {
  const [contacts, setContacts] = useState([]);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const [addedIds, setAddedIds] = useState(new Set());
  const LIMIT = 50;

  const load = useCallback(async (nextOffset, replace) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: LIMIT, offset: nextOffset, q: search });
      const res = await apiFetch(`/api/output-channels/${channelId}/waha/contacts?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load contacts');
      setContacts(prev => (replace ? data.contacts : [...prev, ...data.contacts]));
      setHasMore(data.contacts.length === LIMIT);
      setOffset(nextOffset + LIMIT);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, channelId, search]);

  useEffect(() => { load(0, true); }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const addAsLead = async (c) => {
    try {
      const res = await apiFetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: c.phoneNumber, name: c.name, isMyContact: c.isMyContact, isBusiness: c.isBusiness, tags: ['direct-contact'] })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to add lead');
      setAddedIds(prev => new Set(prev).add(c.id));
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          className="filter-input"
          placeholder="🔍 Search within loaded contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, maxWidth: 320 }}
        />
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>
        Loaded {contacts.length} contacts, {LIMIT} at a time — never a full-account bulk pull.
      </div>

      {error && <div style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 8, marginBottom: 12 }}>{error}</div>}

      <div className="card glass" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.03)' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left' }}>Name</th>
              <th style={{ padding: '10px 14px', textAlign: 'left' }}>Phone</th>
              <th style={{ padding: '10px 14px', textAlign: 'left' }}></th>
              <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map(c => (
              <tr key={c.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 14px' }}>{c.name || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                <td style={{ padding: '8px 14px', fontFamily: 'monospace' }}>+{c.phoneNumber}</td>
                <td style={{ padding: '8px 14px' }}>
                  {c.isMyContact && <span style={{ fontSize: '0.65rem', background: 'rgba(37,99,235,0.1)', color: 'var(--accent)', padding: '1px 6px', borderRadius: 8, marginRight: 4 }}>📇 Contact</span>}
                  {c.isBusiness && <span style={{ fontSize: '0.65rem', background: 'rgba(217,119,6,0.1)', color: '#d97706', padding: '1px 6px', borderRadius: 8 }}>🏢 Business</span>}
                </td>
                <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                  <button
                    className="btn"
                    style={{ padding: '4px 10px', fontSize: '0.75rem', background: addedIds.has(c.id) ? 'rgba(5,150,105,0.1)' : 'rgba(0,0,0,0.05)', color: addedIds.has(c.id) ? '#059669' : 'inherit', border: '1px solid var(--border)' }}
                    onClick={() => addAsLead(c)}
                    disabled={addedIds.has(c.id)}
                  >
                    {addedIds.has(c.id) ? '✓ Added' : '+ Add as Lead'}
                  </button>
                </td>
              </tr>
            ))}
            {contacts.length === 0 && !loading && (
              <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No contacts found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button className="btn" style={{ padding: '6px 20px', fontSize: '0.85rem', background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)' }} onClick={() => load(offset, false)} disabled={loading}>
            {loading ? 'Loading…' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}

function ChatsTab({ channelId, apiFetch, onSendTo }) {
  const [chats, setChats] = useState([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const LIMIT = 30;

  const load = useCallback(async (nextOffset) => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/output-channels/${channelId}/waha/chats?limit=${LIMIT}&offset=${nextOffset}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load chats');
      setChats(prev => (nextOffset === 0 ? data.chats : [...prev, ...data.chats]));
      setHasMore(data.chats.length === LIMIT);
      setOffset(nextOffset + LIMIT);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, channelId]);

  useEffect(() => { load(0); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      {error && <div style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 8, marginBottom: 12 }}>{error}</div>}
      <div className="card glass" style={{ padding: 0, overflow: 'hidden' }}>
        {chats.map(c => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border)', gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                {c.name}
                <span style={{ fontSize: '0.65rem', background: c.isGroup ? 'rgba(37,99,235,0.1)' : 'rgba(100,116,139,0.1)', color: c.isGroup ? 'var(--accent)' : '#64748b', padding: '1px 6px', borderRadius: 8 }}>
                  {c.isGroup ? 'Group' : 'Direct'}
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.lastMessage?.fromMe && 'You: '}{c.lastMessage?.body || <em>no messages</em>}
              </div>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatTimestamp(c.lastMessage?.timestamp)}</div>
            <button
              className="btn"
              style={{ padding: '4px 10px', fontSize: '0.75rem', background: 'rgba(37,99,235,0.1)', color: 'var(--accent)', border: '1px solid rgba(37,99,235,0.3)' }}
              onClick={() => onSendTo(c.id)}
            >
              Send
            </button>
          </div>
        ))}
        {chats.length === 0 && !loading && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No chats found.</div>
        )}
      </div>
      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button className="btn" style={{ padding: '6px 20px', fontSize: '0.85rem', background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)' }} onClick={() => load(offset)} disabled={loading}>
            {loading ? 'Loading…' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}

function SendTab({ channelId, apiFetch }) {
  const [chatId, setChatId] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (window.__prefillChatId) {
      setChatId(window.__prefillChatId);
      window.__prefillChatId = null;
    }
  }, []);

  const handleSend = async () => {
    if (!chatId.trim() || !text.trim()) return;
    if (!window.confirm(`Send this message to ${chatId}?`)) return;
    setSending(true);
    setResult(null);
    try {
      const res = await apiFetch(`/api/output-channels/${channelId}/waha/send-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, text })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Send failed');
      setResult({ ok: true, message: data.message });
      setText('');
    } catch (err) {
      setResult({ ok: false, message: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card glass" style={{ padding: '1.2rem', maxWidth: 480 }}>
      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Recipient (phone number or chatId)</label>
      <input
        type="text"
        className="filter-input"
        placeholder="e.g. 919999999999 or 1203...@g.us"
        value={chatId}
        onChange={(e) => setChatId(e.target.value)}
        style={{ width: '100%', padding: '8px 12px', marginBottom: 12 }}
      />
      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Message</label>
      <textarea
        className="filter-input"
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ width: '100%', padding: '8px 12px', marginBottom: 12, resize: 'vertical' }}
      />
      {result && (
        <div style={{
          background: result.ok ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.08)',
          color: result.ok ? '#059669' : 'var(--danger)',
          padding: '8px 12px', borderRadius: 8, fontSize: '0.82rem', marginBottom: 12
        }}>
          {result.ok ? '✅ ' : '⚠️ '}{result.message}
        </div>
      )}
      <button className="btn btn-primary" style={{ padding: '8px 24px', fontSize: '0.85rem' }} onClick={handleSend} disabled={sending || !chatId.trim() || !text.trim()}>
        {sending ? 'Sending…' : 'Send'}
      </button>
    </div>
  );
}

function ScreenshotTab({ channelId, apiFetch }) {
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [capturedAt, setCapturedAt] = useState(null);

  const capture = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/output-channels/${channelId}/waha/screenshot`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to capture screenshot');
      setImage(`data:${data.mimetype};base64,${data.data}`);
      setCapturedAt(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, channelId]);

  useEffect(() => { capture(); }, [capture]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <button className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '0.85rem' }} onClick={capture} disabled={loading}>
          {loading ? 'Capturing…' : 'Refresh Screenshot'}
        </button>
        {capturedAt && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Captured {capturedAt.toLocaleTimeString()}</span>}
      </div>
      {error && <div style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 8, marginBottom: 12 }}>{error}</div>}
      {image && (
        <img src={image} alt="WhatsApp Web screenshot" style={{ maxWidth: '100%', border: '1px solid var(--border)', borderRadius: 8 }} />
      )}
    </div>
  );
}
