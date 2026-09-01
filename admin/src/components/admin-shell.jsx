'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminShell({ children, title }) {
  const pathname = usePathname();
  const [apiBase, setApiBase] = useState(process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:3001');
  const [adminApiKey, setAdminApiKey] = useState('');
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const [statusData, setStatusData] = useState({
    status: 'Checking...',
    queueLength: 0,
    dealsToday: 0,
    totalDeals: 0,
    totalProducts: 0,
    totalUsers: 0
  });

  useEffect(() => {
    // Always prefer env var — localStorage override only applies when env var is absent
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    if (envUrl) {
      setApiBase(envUrl.trim().replace(/\/+$/, ''));
    }
    // Clear any stale production URL from localStorage to avoid future confusion
    localStorage.removeItem('ADMIN_API_BASE');
    const storedKey = localStorage.getItem('ADMIN_API_KEY') || process.env.NEXT_PUBLIC_ADMIN_API_KEY || '';
    if (storedKey) {
      setAdminApiKey(storedKey.trim());
    }

    // Restore sidebar visibility preference
    try {
      const storedSidebar = localStorage.getItem('ADMIN_SIDEBAR_HIDDEN');
      if (storedSidebar !== null) {
        setIsSidebarHidden(storedSidebar === 'true');
      }
    } catch (e) {
      console.warn('Could not read sidebar preference:', e);
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarHidden(prev => {
      const next = !prev;
      try {
        localStorage.setItem('ADMIN_SIDEBAR_HIDDEN', String(next));
      } catch (e) {
        console.warn('Could not save sidebar preference:', e);
      }
      return next;
    });
  }, []);

  // Keyboard shortcut: Ctrl+B or Cmd+B to toggle sidebar panel
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  const handleApiBaseChange = (e) => {
    // Manual override via Settings UI (only active when no env var is set)
    const val = e.target.value.trim();
    setApiBase(val || process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:3001');
  };

  const apiFetch = useCallback(async (endpoint, options = {}) => {
    try {
      const base = apiBase ? apiBase.replace(/\/+$/, '') : '';
      const url = endpoint.startsWith('http') ? endpoint : (base ? `${base}${endpoint}` : endpoint);
      const headers = {
        ...(options.headers || {}),
        ...(adminApiKey ? { 'x-admin-key': adminApiKey } : {}),
      };
      return await fetch(url, { ...options, headers });
    } catch (err) {
      // If absolute fetch fails (e.g. invalid localStorage API URL), fallback to Next.js rewrite proxy
      if (!endpoint.startsWith('http')) {
        const headers = {
          ...(options.headers || {}),
          ...(adminApiKey ? { 'x-admin-key': adminApiKey } : {}),
        };
        return await fetch(endpoint, { ...options, headers });
      }
      throw err;
    }
  }, [apiBase, adminApiKey]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/status');
      if (!res.ok) return;
      const data = await res.json();
      setStatusData(data);
    } catch (err) {
      console.error('Fetch status error:', err);
      setStatusData(prev => ({ ...prev, status: 'Offline' }));
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 5000);
    return () => clearInterval(timer);
  }, [fetchStatus]);

  const navItems = [
    { href: '/', label: 'Dashboard', icon: 'dashboard' },
    { href: '/deals', label: 'Deals', icon: 'local_offer' },
    { href: '/products', label: 'Products', icon: 'inventory_2' },
    { href: '/audience', label: 'Audience', icon: 'group' },
    { href: '/network', label: 'Channel Network', icon: 'hub' },
    { href: '/notifications', label: 'Notifications', icon: 'notifications' },
    { href: '/x-bot', label: 'X Bot (USA)', icon: 'smart_toy' },
    { href: '/scraping', label: 'Scrape Frequency', icon: 'query_stats' },
    { href: '/logs', label: 'Live Logs', icon: 'terminal' },
    { href: '/settings', label: 'Settings', icon: 'settings' },
    { href: '/pipeline', label: 'Pipeline Flow', icon: 'schema' },
    { href: '/architecture', label: 'Architecture', icon: 'account_tree' },
  ];

  const getTitle = () => {
    if (title) return title;
    const current = navItems.find(item => pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)));
    return current ? current.label : 'Dashboard';
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarHidden ? 'hidden' : ''}`}>
        <div className="logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/icon.png" alt="Admin Icon" className="logo-icon" />
            <h2>ShoppersDeals</h2>
          </div>
          <button
            type="button"
            onClick={toggleSidebar}
            className="sidebar-toggle-btn"
            title="Hide Menu Panel (⌘B / Ctrl+B)"
            aria-label="Hide Menu Panel"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>menu_open</span>
          </button>
        </div>

        <nav className="nav-menu">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="material-symbols-outlined nav-icon">{item.icon}</span> {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="system-status">
          <div
            className="status-indicator"
            style={{
              background: statusData.status === 'Online' ? 'var(--success)' : 'var(--danger)',
              boxShadow: statusData.status === 'Online' ? '0 0 8px var(--success)' : '0 0 8px var(--danger)'
            }}
          ></div>
          <span>Daemon {statusData.status}</span>
        </div>

        <div className="api-config-box" style={{ marginTop: 15, padding: 10, background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.75rem' }}>
          <label style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 500 }}>API Server URL</label>
          <input
            type="text"
            value={apiBase}
            onChange={handleApiBaseChange}
            placeholder="http://localhost:5001"
            style={{ width: '100%', background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)', color: 'var(--text-main)', borderRadius: 4, padding: '4px 8px', fontSize: '0.75rem', boxSizing: 'border-box' }}
          />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="top-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              type="button"
              onClick={toggleSidebar}
              className="header-sidebar-toggle-btn"
              title={isSidebarHidden ? "Show Menu Panel (⌘B / Ctrl+B)" : "Hide Menu Panel (⌘B / Ctrl+B)"}
              aria-label={isSidebarHidden ? "Show Menu Panel" : "Hide Menu Panel"}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                {isSidebarHidden ? 'menu' : 'menu_open'}
              </span>
            </button>
            <h1>{getTitle()}</h1>
          </div>
          <div className="header-stats">
            <div className="stat-badge">
              Queue: <span className="highlight">{statusData.queueLength || 0}</span>
            </div>
            <div className="stat-badge">
              Deals Today: <span className="highlight">{statusData.dealsToday || 0}</span>
            </div>
            <div className="stat-badge">
              Products DB: <span className="highlight">{statusData.totalProducts || 0}</span>
            </div>
            <div className="stat-badge">
              Total Users: <span className="highlight">{statusData.totalUsers || 0}</span>
            </div>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
