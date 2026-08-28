'use client';

import { useState, useEffect, useCallback } from 'react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';

const STATUS_COLORS = {
  new: { bg: 'rgba(37,99,235,0.1)', color: 'var(--accent)' },
  contacted: { bg: 'rgba(217,119,6,0.1)', color: '#d97706' },
  converted: { bg: 'rgba(5,150,105,0.1)', color: '#059669' },
  ignored: { bg: 'rgba(100,116,139,0.1)', color: '#64748b' }
};

const formatTime = (isoString) => {
  if (!isoString) return 'N/A';
  const date = new Date(isoString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function LeadsPage() {
  const [apiBase, setApiBase] = useState(process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:3001');
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState({ total: 0, byStatus: {}, groups: [] });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ status: '', tags: '', notes: '' });

  useEffect(() => {
  }, []);

  const apiFetch = useCallback(async (endpoint, options = {}) => {
    const base = apiBase.replace(/\/+$/, '');
    const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;
    return fetch(url, options);
  }, [apiBase]);

  const fetchLeads = useCallback(async () => {
    try {
      const params = new URLSearchParams({ status: statusFilter, sourceGroupId: groupFilter, q: search });
      const res = await apiFetch(`/api/leads?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      setLeads(data.leads || []);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      console.error('Fetch leads error:', err);
    }
  }, [apiFetch, statusFilter, groupFilter, search]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const startEdit = (lead) => {
    setEditingId(lead._id);
    setEditForm({ status: lead.status, tags: (lead.tags || []).join(', '), notes: lead.notes || '' });
  };

  const saveEdit = async () => {
    try {
      const res = await apiFetch(`/api/leads/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: editForm.status,
          tags: editForm.tags.split(',').map(t => t.trim()).filter(Boolean),
          notes: editForm.notes
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save');
      setEditingId(null);
      fetchLeads();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this lead?')) return;
    try {
      const res = await apiFetch(`/api/leads/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete');
      fetchLeads();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <section className="view-section active-view">
      <div className="grid-cards" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="card glass crm-stat-card">
          <div className="crm-stat-icon" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
            <span className="material-symbols-outlined">person_search</span>
          </div>
          <div className="crm-stat-value">{stats.total || 0}</div>
          <div className="crm-stat-label">Total Leads</div>
        </div>
        <div className="card glass crm-stat-card">
          <div className="crm-stat-icon" style={{ background: 'rgba(37,99,235,0.15)', color: 'var(--accent)' }}>
            <span className="material-symbols-outlined">fiber_new</span>
          </div>
          <div className="crm-stat-value">{stats.byStatus?.new || 0}</div>
          <div className="crm-stat-label">New</div>
        </div>
        <div className="card glass crm-stat-card">
          <div className="crm-stat-icon" style={{ background: 'rgba(5,150,105,0.15)', color: '#34d399' }}>
            <span className="material-symbols-outlined">check_circle</span>
          </div>
          <div className="crm-stat-value">{stats.byStatus?.converted || 0}</div>
          <div className="crm-stat-label">Converted</div>
        </div>
        <div className="card glass crm-stat-card">
          <div className="crm-stat-icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>
            <span className="material-symbols-outlined">groups</span>
          </div>
          <div className="crm-stat-value">{stats.groups?.length || 0}</div>
          <div className="crm-stat-label">Source Groups</div>
        </div>
      </div>

      <div className="card glass">
        <div className="filter-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--accent)' }}>person_search</span> Potential Customers
          </h3>
          <div className="filter-controls" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              className="filter-input"
              placeholder="🔍 Search phone, name, group..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 220 }}
            />
            <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="converted">Converted</option>
              <option value="ignored">Ignored</option>
            </select>
            <select className="filter-select" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
              <option value="all">All Source Groups</option>
              {(stats.groups || []).map(g => (
                <option key={g.id} value={g.id}>{g.name} ({g.count})</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phone Number</TableHead>
                <TableHead>Source Group(s)</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Imported</TableHead>
                <TableHead style={{ textAlign: 'right' }}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.length > 0 ? (
                leads.map((lead) => {
                  const editing = editingId === lead._id;
                  const statusColor = STATUS_COLORS[lead.status] || STATUS_COLORS.new;
                  const groups = lead.sourceGroups || [];
                  return (
                    <TableRow key={lead._id}>
                      <TableCell>
                        <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>+{lead.phoneNumber}</div>
                        {lead.name && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lead.name}</div>}
                        <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                          {lead.isMyContact && <span style={{ fontSize: '0.65rem', background: 'rgba(37,99,235,0.1)', color: 'var(--accent)', padding: '1px 6px', borderRadius: 8 }}>📇 Contact</span>}
                          {lead.isBusiness && <span style={{ fontSize: '0.65rem', background: 'rgba(217,119,6,0.1)', color: '#d97706', padding: '1px 6px', borderRadius: 8 }}>🏢 Business</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {groups.length > 0 ? (
                          groups.map(g => (
                            <div key={g.groupId} style={{ fontSize: '0.78rem' }}>
                              <span style={{ fontWeight: 600 }}>{g.groupName || '(unnamed)'}</span>
                              <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}> · {g.role}</span>
                            </div>
                          ))
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Direct contact — no group</span>
                        )}
                        {groups.length > 1 && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            in {groups.length} groups you admin — cross-referenced automatically
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {editing ? (
                          <input
                            type="text"
                            className="filter-input"
                            placeholder="comma, separated, tags"
                            value={editForm.tags}
                            onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                            style={{ width: 160, padding: '4px 8px', fontSize: '0.8rem' }}
                          />
                        ) : (
                          (lead.tags || []).length > 0
                            ? lead.tags.map(t => (
                              <span key={t} style={{ background: 'rgba(0,0,0,0.05)', padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', marginRight: 4 }}>{t}</span>
                            ))
                            : <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editing ? (
                          <select
                            className="filter-select"
                            style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                            value={editForm.status}
                            onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                          >
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="converted">Converted</option>
                            <option value="ignored">Ignored</option>
                          </select>
                        ) : (
                          <span style={{ background: statusColor.bg, color: statusColor.color, padding: '3px 10px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 700, textTransform: 'capitalize' }}>
                            {lead.status}
                          </span>
                        )}
                      </TableCell>
                      <TableCell style={{ maxWidth: 180 }}>
                        {editing ? (
                          <input
                            type="text"
                            className="filter-input"
                            value={editForm.notes}
                            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                            style={{ width: 160, padding: '4px 8px', fontSize: '0.8rem' }}
                          />
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{lead.notes || '—'}</span>
                        )}
                      </TableCell>
                      <TableCell style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatTime(lead.createdAt)}</TableCell>
                      <TableCell style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {editing ? (
                            <>
                              <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={saveEdit}>Save</button>
                              <button className="btn" style={{ padding: '4px 10px', fontSize: '0.75rem', background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)' }} onClick={() => setEditingId(null)}>Cancel</button>
                            </>
                          ) : (
                            <>
                              <button className="btn" style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)' }} onClick={() => startEdit(lead)}>Edit</button>
                              <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => handleDelete(lead._id)}>Delete</button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No leads yet. Go to <strong>Channel Network → Channel Management</strong>, open your WhatsApp connection, and use <strong>📋 Browse Groups</strong> to import members from groups you administer.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
}
