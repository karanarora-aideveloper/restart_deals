'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import AdminShell from '@/components/admin-shell';

export default function AudienceLayout({ children }) {
  const pathname = usePathname();

  return (
    <AdminShell title="Audience CRM">
      <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <Link
            href="/audience/users"
            style={{
              padding: '12px 16px',
              fontSize: '1rem',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: pathname.includes('/audience/users') ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: pathname.includes('/audience/users') ? '3px solid var(--accent)' : '3px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            <span className="material-symbols-outlined">group</span>
            User Management
          </Link>
          <Link
            href="/audience/notifications"
            style={{
              padding: '12px 16px',
              fontSize: '1rem',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: pathname.includes('/audience/notifications') ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: pathname.includes('/audience/notifications') ? '3px solid var(--accent)' : '3px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            <span className="material-symbols-outlined">campaign</span>
            Push Campaigns
          </Link>
          <Link
            href="/audience/leads"
            style={{
              padding: '12px 16px',
              fontSize: '1rem',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: pathname.includes('/audience/leads') ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: pathname.includes('/audience/leads') ? '3px solid var(--accent)' : '3px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            <span className="material-symbols-outlined">person_search</span>
            Leads (from WhatsApp Groups)
          </Link>
        </div>
      </div>
      {children}
    </AdminShell>
  );
}
