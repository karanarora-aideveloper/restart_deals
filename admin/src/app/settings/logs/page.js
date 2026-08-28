'use client';

import { useState, useEffect, useCallback } from 'react';

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [apiBase, setApiBase] = useState(process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:3001');

  useEffect(() => {
  }, []);

  const apiFetch = useCallback(async (endpoint, options = {}) => {
    const base = apiBase.replace(/\/+$/, '');
    const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;
    return fetch(url, options);
  }, [apiBase]);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/logs');
      if (!res.ok) return;
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error('Fetch logs error:', err);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <>
      <section className="view-section active-view">
        <div className="card glass terminal-card">
          <div className="terminal-header">
            <div className="mac-dots">
              <span></span><span></span><span></span>
            </div>
            <div className="terminal-title">live-system-logs</div>
            <button className="refresh-btn" title="Refresh Logs" onClick={fetchLogs}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
            </button>
          </div>
          <div className="terminal-body">
            {logs.length > 0 ? (
              logs.map((log, idx) => (
                <div className="log-line" key={idx}>
                  <span className="log-time">[{new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}]</span>
                  <span className={`log-${log.level}`}>[{log.level}]</span>
                  <span className="log-msg"> {log.message}</span>
                </div>
              ))
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>No live logs available. Daemon running cleanly.</div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
