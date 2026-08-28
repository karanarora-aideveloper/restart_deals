'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import AdminShell from '@/components/admin-shell';

export default function SettingsLayout({ children }) {
  const pathname = usePathname();

  return (
    <AdminShell title="System Configuration">
      <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <Link
            href="/settings/master"
            style={{
              padding: '12px 16px',
              fontSize: '1rem',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: pathname.includes('/settings/master') ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: pathname.includes('/settings/master') ? '3px solid var(--accent)' : '3px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            <span className="material-symbols-outlined">database</span>
            Master Data
          </Link>
          <Link
            href="/settings/tokens"
            style={{
              padding: '12px 16px',
              fontSize: '1rem',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: pathname.includes('/settings/tokens') ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: pathname.includes('/settings/tokens') ? '3px solid var(--accent)' : '3px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            <span className="material-symbols-outlined">vpn_key</span>
            API Tokens
          </Link>
          <Link
            href="/settings/logs"
            style={{
              padding: '12px 16px',
              fontSize: '1rem',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: pathname.includes('/settings/logs') ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: pathname.includes('/settings/logs') ? '3px solid var(--accent)' : '3px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            <span className="material-symbols-outlined">terminal</span>
            System Logs
          </Link>
        </div>
      </div>
      {children}
    </AdminShell>
  );
}
