'use client';

import { useState, useEffect, useCallback } from 'react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';

const formatTime = (isoString) => {
  if (!isoString) return 'N/A';
  const date = new Date(isoString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [usersTotalCount, setUsersTotalCount] = useState(0);
  const [usersSearch, setUsersSearch] = useState('');
  const [usersFilter, setUsersFilter] = useState('all');

  const [apiBase, setApiBase] = useState(process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:3001');

  useEffect(() => {
  }, []);

  const apiFetch = useCallback(async (endpoint, options = {}) => {
    const base = apiBase.replace(/\/+$/, '');
    const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;
    return fetch(url, options);
  }, [apiBase]);

  const fetchUsers = useCallback(async (page = 1) => {
    setUsersPage(page);
    const params = new URLSearchParams({ page, limit: 15, search: usersSearch });
    try {
      const res = await apiFetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      setUsers(data.users || []);
      setUsersTotalPages(data.totalPages || 1);
      setUsersTotalCount(data.total || 0);
    } catch (err) {
      console.error('Fetch users error:', err);
    }
  }, [apiFetch, usersSearch]);

  useEffect(() => {
    fetchUsers(1);
  }, [fetchUsers]);

  const displayedUsers = users.filter(u => {
    if (usersFilter === 'phone') return !!u.phoneNumber;
    if (usersFilter === 'email') return !!u.email;
    if (usersFilter === 'contacts') return u.contacts && u.contacts.length > 0;
    if (usersFilter === 'google') return !!u.googleId;
    return true;
  });

  return (
    <>
      <section className="view-section active-view">
        <div className="grid-cards" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="card glass crm-stat-card">
            <div className="crm-stat-icon" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
              <span className="material-symbols-outlined">group</span>
            </div>
            <div className="crm-stat-value">{usersTotalCount}</div>
            <div className="crm-stat-label">Total Users</div>
          </div>
          <div className="card glass crm-stat-card">
            <div className="crm-stat-icon" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
              <span className="material-symbols-outlined">smartphone</span>
            </div>
            <div className="crm-stat-value">{users.filter(u => u.phoneNumber).length}</div>
            <div className="crm-stat-label">Phone Users</div>
          </div>
          <div className="card glass crm-stat-card">
            <div className="crm-stat-icon" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>
              <span className="material-symbols-outlined">mail</span>
            </div>
            <div className="crm-stat-value">{users.filter(u => u.email).length}</div>
            <div className="crm-stat-label">Email Users</div>
          </div>
          <div className="card glass crm-stat-card">
            <div className="crm-stat-icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>
              <span className="material-symbols-outlined">sync</span>
            </div>
            <div className="crm-stat-value">{users.filter(u => u.contacts && u.contacts.length > 0).length}</div>
            <div className="crm-stat-label">Contacts Synced</div>
          </div>
        </div>

        <div className="card glass">
          <div style={{ padding: '1.2rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontWeight: 600 }}>User Directory</h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="text"
                className="filter-input"
                placeholder="🔍 Search name, email or phone..."
                value={usersSearch}
                onChange={(e) => setUsersSearch(e.target.value)}
              />
              <select className="filter-select" value={usersFilter} onChange={(e) => setUsersFilter(e.target.value)}>
                <option value="all">All Users</option>
                <option value="phone">Has Phone</option>
                <option value="email">Has Email</option>
                <option value="contacts">Contacts Synced</option>
                <option value="google">Google Login</option>
              </select>
            </div>
          </div>

          <div className="mt-4 px-4 pb-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Contact Info</TableHead>
                  <TableHead>Auth Method</TableHead>
                  <TableHead>Contacts</TableHead>
                  <TableHead>Saved Deals</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedUsers.map((u) => {
                  const initial = (u.name || 'S').charAt(0).toUpperCase();
                  const contactCount = u.contacts?.length || 0;
                  const savedDeals = u.savedDeals?.length || 0;

                  return (
                    <TableRow key={u._id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-xs">
                            {initial}
                          </div>
                          <span>{u.name || 'Anonymous User'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {u.phoneNumber && <div>📞 {u.phoneNumber}</div>}
                        {u.email && <div>✉️ {u.email}</div>}
                        {!u.phoneNumber && !u.email && <span className="text-muted-foreground">N/A</span>}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {u.googleId ? 'Google SSO' : u.phoneNumber ? 'Phone OTP' : 'Guest'}
                      </TableCell>
                      <TableCell className="font-semibold text-xs">
                        {contactCount > 0 ? `${contactCount} contacts` : '0'}
                      </TableCell>
                      <TableCell className="font-semibold text-xs">
                        {savedDeals}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatTime(u.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {displayedUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="pagination-container p-4" style={{ borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Page {usersPage} of {usersTotalPages}</span>
            <button className="page-btn" disabled={usersPage <= 1} onClick={() => fetchUsers(usersPage - 1)}>Previous</button>
            <button className="page-btn" disabled={usersPage >= usersTotalPages} onClick={() => fetchUsers(usersPage + 1)}>Next</button>
          </div>
        </div>
      </section>
    </>
  );
}
