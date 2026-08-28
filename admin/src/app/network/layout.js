'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import AdminShell from '@/components/admin-shell';

export default function NetworkLayout({ children }) {
  const pathname = usePathname();

  return (
    <AdminShell title="Channel Network">
      <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <Link
            href="/network/input"
            style={{
              padding: '12px 16px',
              fontSize: '1rem',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: pathname.includes('/network/input') ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: pathname.includes('/network/input') ? '3px solid var(--accent)' : '3px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            <span className="material-symbols-outlined">sensors</span>
            Input Sources (Monitored)
          </Link>
          <Link
            href="/network/output"
            style={{
              padding: '12px 16px',
              fontSize: '1rem',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: pathname.includes('/network/output') ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: pathname.includes('/network/output') ? '3px solid var(--accent)' : '3px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            <span className="material-symbols-outlined">podcasts</span>
            Output Destinations (Publishing)
          </Link>
          <Link
            href="/network/connections"
            style={{
              padding: '12px 16px',
              fontSize: '1rem',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: pathname.includes('/network/connections') ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: pathname.includes('/network/connections') ? '3px solid var(--accent)' : '3px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            <span className="material-symbols-outlined">admin_panel_settings</span>
            Channel Management (Login &amp; Sessions)
          </Link>
        </div>
      </div>
      {children}
    </AdminShell>
  );
}
