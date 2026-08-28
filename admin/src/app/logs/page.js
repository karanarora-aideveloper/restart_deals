'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import AdminShell from '@/components/admin-shell';

const LEVEL_COLORS = { info: 'var(--text-main)', warn: '#f5a623', error: '#e74c3c' };
const LEVEL_BG = { info: 'transparent', warn: 'rgba(245,166,35,0.07)', error: 'rgba(231,76,60,0.09)' };
const LEVEL_BADGE = {
  info: { background: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)' },
  warn: { background: 'rgba(245,166,35,0.2)', color: '#f5a623' },
  error: { background: 'rgba(231,76,60,0.2)', color: '#e74c3c' },
};

export default function LogsPage() {
  const [apiBase] = useState(process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:3001');
  const [adminKey] = useState(() => typeof localStorage !== 'undefined' ? (localStorage.getItem('ADMIN_API_KEY') || process.env.NEXT_PUBLIC_ADMIN_API_KEY || '') : (process.env.NEXT_PUBLIC_ADMIN_API_KEY || ''));

  const apiFetch = useCallback(async (endpoint, options = {}) => {
    const base = apiBase.replace(/\/+$/, '');
    const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;
    const headers = { ...(options.headers || {}), ...(adminKey ? { 'x-admin-key': adminKey } : {}) };
    return fetch(url, { ...options, headers });
  }, [apiBase, adminKey]);

  const [logs, setLogs] = useState([]);
  const [level, setLevel] = useState('all');
  const [paused, setPaused] = useState(false);
  const [search, setSearch] = useState('');
  const [connected, setConnected] = useState(null);
  const lastTsRef = useRef(null);
  const bottomRef = useRef(null);
  const containerRef = useRef(null);
  const apiFetchRef = useRef(apiFetch);
  useEffect(() => { apiFetchRef.current = apiFetch; }, [apiFetch]);

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '200', level });
      if (lastTsRef.current) params.set('since', lastTsRef.current);
      const res = await apiFetchRef.current(`/api/admin/logs?${params}`);
      if (!res.ok) { setConnected(false); return; }
      const data = await res.json();
      setConnected(true);
      if (!data.logs?.length) return;
      setLogs(prev => {
        const combined = lastTsRef.current ? [...prev, ...data.logs] : data.logs;
        const seen = new Set();
        const deduped = combined.filter(l => { const k = l.ts + l.msg; if (seen.has(k)) return false; seen.add(k); return true; });
        const trimmed = deduped.slice(-500);
        lastTsRef.current = trimmed[trimmed.length - 1]?.ts || null;
        return trimmed;
      });
    } catch {
      setConnected(false);
    }
  }, [level]);

  // Reset + reload when level filter changes
  useEffect(() => {
    lastTsRef.current = null;
    setLogs([]);
    fetchLogs();
  }, [level, fetchLogs]);

  // Poll every 2s
  useEffect(() => {
    if (paused) return;
    const t = setInterval(fetchLogs, 2000);
    return () => clearInterval(t);
  }, [paused, fetchLogs]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (paused) return;
    const el = containerRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, paused]);

  const filtered = search ? logs.filter(l => l.msg.toLowerCase().includes(search.toLowerCase())) : logs;

  function ts(iso) {
    try { return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); }
    catch { return iso; }
  }

  function highlight(text, q) {
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i === -1) return text;
    return <>{text.slice(0, i)}<mark style={{ background: 'rgba(245,166,35,0.35)', color: 'inherit', borderRadius: 2 }}>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
  }

  return (
    <AdminShell title="Live Logs">
      <div style={{ padding: '20px 24px', height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
              background: connected === null ? '#888' : connected ? '#27ae60' : '#e74c3c',
              boxShadow: connected ? '0 0 6px #27ae60' : connected === false ? '0 0 6px #e74c3c' : 'none',
            }} />
            {connected === null ? 'Connecting…' : connected ? 'Live' : 'Disconnected'}
          </div>

          {/* Level filter */}
          <div style={{ display: 'flex', gap: 4 }}>
            {['all', 'info', 'warn', 'error'].map(l => (
              <button key={l} onClick={() => setLevel(l)} style={{
                padding: '4px 12px', borderRadius: 20, border: '1px solid var(--border)',
                background: level === l ? 'var(--accent)' : 'var(--surface)',
                color: level === l ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer', fontSize: '0.73rem', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>{l}</button>
            ))}
          </div>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter logs…"
            style={{
              flex: 1, minWidth: 140, maxWidth: 280,
              background: 'var(--surface)', border: '1px solid var(--border)',
              color: 'var(--text-main)', borderRadius: 6, padding: '5px 10px', fontSize: '0.8rem',
            }}
          />

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={() => setPaused(p => !p)} style={{
              padding: '5px 14px', borderRadius: 6, border: '1px solid var(--border)',
              background: paused ? 'rgba(245,166,35,0.12)' : 'var(--surface)',
              color: paused ? '#f5a623' : 'var(--text-muted)',
              cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500,
            }}>{paused ? '▶ Resume' : '⏸ Pause'}</button>

            <button onClick={() => { lastTsRef.current = null; setLogs([]); setConnected(null); fetchLogs(); }} style={{
              padding: '5px 14px', borderRadius: 6, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text-muted)',
              cursor: 'pointer', fontSize: '0.8rem',
            }}>↺ Reload</button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: 16 }}>
          <span>Showing <strong style={{ color: 'var(--text-main)' }}>{filtered.length}</strong> lines</span>
          <span style={{ color: '#e74c3c' }}>⚠ Errors: <strong>{filtered.filter(l => l.level === 'error').length}</strong></span>
          <span style={{ color: '#f5a623' }}>⚡ Warnings: <strong>{filtered.filter(l => l.level === 'warn').length}</strong></span>
          {paused && <span style={{ color: '#f5a623' }}>⏸ Paused</span>}
        </div>

        {/* Log viewer */}
        <div ref={containerRef} style={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          background: '#0f1117',
          border: '1px solid var(--border)', borderRadius: 8,
          fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
          fontSize: '0.77rem', lineHeight: 1.65,
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              {connected === false
                ? '❌ Cannot reach API. Check that the API server is running and the admin key is set.'
                : '⏳ Waiting for backend logs… (backend must be running with Redis connected)'}
            </div>
          ) : (
            filtered.map((log, i) => (
              <div key={i} style={{
                display: 'flex', gap: 0, alignItems: 'flex-start',
                background: LEVEL_BG[log.level] || 'transparent',
                borderBottom: '1px solid rgba(255,255,255,0.025)',
                padding: '2px 14px',
              }}>
                <span style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0, marginRight: 10, userSelect: 'none', paddingTop: 1 }}>
                  {ts(log.ts)}
                </span>
                <span style={{
                  flexShrink: 0, marginRight: 10, padding: '1px 5px', borderRadius: 3,
                  fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
                  marginTop: 2, ...LEVEL_BADGE[log.level],
                }}>
                  {log.level}
                </span>
                <span style={{ color: LEVEL_COLORS[log.level] || '#ccc', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
                  {search ? highlight(log.msg, search) : log.msg}
                </span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </AdminShell>
  );
}
