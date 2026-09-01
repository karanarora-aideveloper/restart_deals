'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';

// Grounded in what each list actually does today, not what it sounds like it should do —
// "category" is the only one genuinely read by the backend pipeline right now.
const TAB_META = {
  category: {
    label: 'Categories',
    singular: 'Category',
    icon: 'sell',
    description: "The exact list DeepSeek picks from when classifying a deal, and what powers the category filter tabs in the app. The AI validates its answer against this list and falls back to \"general\" for anything not in it — add a category here before it can ever be assigned.",
  },
  country: {
    label: 'Countries',
    singular: 'Country',
    icon: 'public',
    description: "Reference labels only, for now — a deal's actual country is derived automatically from the product's own domain (amazon.in → IN, amazon.com → US, flipkart.com → IN always), not looked up here. Safe to edit; nothing in the live pipeline currently reads this list to make a decision.",
  },
  store: {
    label: 'Stores',
    singular: 'Store',
    icon: 'storefront',
    description: "Not wired into anything yet — the listener only ever recognizes amazon.* and flipkart.com, hardcoded in the URL parser (src/listener/verifier.js). Adding a store here doesn't enable processing for it; treat this as a holding area for a future merchant.",
  },
};
const MASTER_TYPES = Object.keys(TAB_META);

export default function MasterPage() {
  const [masterData, setMasterData] = useState([]);
  const [masterType, setMasterType] = useState('category'); // 'category', 'country', 'store'
  const [tabCounts, setTabCounts] = useState({});
  const [search, setSearch] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [masterForm, setMasterForm] = useState({ label: '', value: '', metadata: '', isActive: true });
  const [jsonError, setJsonError] = useState('');

  const [apiBase, setApiBase] = useState(process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:3001');
  const adminApiKey = process.env.NEXT_PUBLIC_ADMIN_API_KEY || '';

  useEffect(() => {
  }, []);

  const apiFetch = useCallback(async (endpoint, options = {}) => {
    const base = apiBase.replace(/\/+$/, '');
    const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;
    const headers = { ...(options.headers || {}), ...(adminApiKey ? { 'x-admin-key': adminApiKey } : {}) };
    return fetch(url, { ...options, headers });
  }, [apiBase, adminApiKey]);

  const fetchMasterData = useCallback(async (type) => {
    try {
      const res = await apiFetch(`/api/master/${type}`);
      const data = await res.json();
      if (data.success) {
        setMasterData(data.data);
        setTabCounts(prev => ({ ...prev, [type]: data.data.length }));
      }
    } catch (err) {
      console.error('Failed to fetch master data:', err);
    }
  }, [apiFetch]);

  // Counts for every tab, not just the active one — shown as badges so you can see the shape of
  // all three lists (e.g. that "store" is still empty) without clicking through each tab.
  useEffect(() => {
    MASTER_TYPES.forEach(type => {
      apiFetch(`/api/master/${type}`)
        .then(res => res.json())
        .then(data => { if (data.success) setTabCounts(prev => ({ ...prev, [type]: data.data.length })); })
        .catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchMasterData(masterType);
    setSearch('');
  }, [masterType, fetchMasterData]);

  // Derived state
  const filteredData = useMemo(() => {
    return masterData.filter(item => {
      const s = search.toLowerCase();
      return item.label.toLowerCase().includes(s) || item.value.toLowerCase().includes(s);
    });
  }, [masterData, search]);

  const stats = useMemo(() => {
    return {
      total: masterData.length,
      active: masterData.filter(i => i.isActive !== false).length,
      inactive: masterData.filter(i => i.isActive === false).length
    };
  }, [masterData]);

  // Handlers
  const handleOpenAdd = () => {
    setEditingItem(null);
    setMasterForm({ label: '', value: '', metadata: '{
  
}', isActive: true });
    setJsonError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setMasterForm({
      label: item.label,
      value: item.value,
      metadata: Object.keys(item.metadata || {}).length ? JSON.stringify(item.metadata, null, 2) : '{
  
}',
      isActive: item.isActive !== undefined ? item.isActive : true
    });
    setJsonError('');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    let metaObj = {};
    if (masterForm.metadata.trim()) {
      try {
        metaObj = JSON.parse(masterForm.metadata);
        setJsonError('');
      } catch (e) {
        setJsonError('Invalid JSON format in metadata.');
        return;
      }
    }

    if (!masterForm.label || !masterForm.value) {
      setJsonError('Label and Value are required.');
      return;
    }

    try {
      let res;
      if (editingItem) {
        res = await apiFetch(`/api/master/${masterType}/${editingItem._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: masterForm.label, value: masterForm.value, metadata: metaObj, isActive: masterForm.isActive })
        });
      } else {
        res = await apiFetch(`/api/master/${masterType}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: masterForm.label, value: masterForm.value, metadata: metaObj, isActive: masterForm.isActive })
        });
      }
      
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save');
      
      setIsModalOpen(false);
      fetchMasterData(masterType);
    } catch (err) {
      setJsonError(err.message);
    }
  };

  const handleToggleStatus = async (item) => {
    try {
      const res = await apiFetch(`/api/master/${masterType}/${item._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: item.isActive === false ? true : false })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to toggle status');
      fetchMasterData(masterType);
    } catch (err) {
      alert('Error toggling status: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this master data item?')) return;
    try {
      const res = await apiFetch(`/api/master/${masterType}/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete');
      fetchMasterData(masterType);
    } catch (err) {
      alert('Error deleting: ' + err.message);
    }
  };

  return (
    <>
      <section className="view-section active-view">
        
        {/* Segmented Tabs Navigation */}
        <div style={{ display: 'flex', gap: 16, marginBottom: '0.9rem', borderBottom: '1px solid var(--border)' }}>
          {MASTER_TYPES.map(id => {
            const tab = TAB_META[id];
            const active = masterType === id;
            return (
              <button
                key={id}
                onClick={() => setMasterType(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '12px 16px', background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: '1rem', fontWeight: 600,
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  borderBottom: active ? '3px solid var(--accent)' : '3px solid transparent',
                  transition: 'all 0.2s'
                }}
              >
                <span className="material-symbols-outlined">{tab.icon}</span>
                {tab.label}
                <span
                  style={{
                    fontSize: '0.75rem', fontWeight: 700, minWidth: 20, textAlign: 'center',
                    padding: '1px 6px', borderRadius: 10,
                    background: active ? 'var(--accent)' : 'rgba(0,0,0,0.06)',
                    color: active ? '#fff' : 'var(--text-muted)'
                  }}
                >
                  {tabCounts[id] ?? '—'}
                </span>
              </button>
            );
          })}
        </div>

        {/* What this specific list actually does — grounded in the real code, not aspirational */}
        <p style={{
          margin: '0 0 1.5rem', fontSize: '0.85rem', lineHeight: 1.5, color: 'var(--text-muted)',
          maxWidth: 760,
        }}>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 15, verticalAlign: -3, marginRight: 4, color: masterType === 'category' ? '#10b981' : '#f59e0b' }}
          >
            {masterType === 'category' ? 'bolt' : 'info'}
          </span>
          {TAB_META[masterType].description}
        </p>

        {/* Top Summary Stat Cards */}
        <div className="grid-cards" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="card glass crm-stat-card">
            <div className="crm-stat-icon" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
              <span className="material-symbols-outlined">data_object</span>
            </div>
            <div className="crm-stat-value">{stats.total}</div>
            <div className="crm-stat-label">Total {TAB_META[masterType].label}</div>
          </div>
          <div className="card glass crm-stat-card">
            <div className="crm-stat-icon" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
              <span className="material-symbols-outlined">check_circle</span>
            </div>
            <div className="crm-stat-value">{stats.active}</div>
            <div className="crm-stat-label">Active</div>
          </div>
          <div className="card glass crm-stat-card">
            <div className="crm-stat-icon" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
              <span className="material-symbols-outlined">cancel</span>
            </div>
            <div className="crm-stat-value">{stats.inactive}</div>
            <div className="crm-stat-label">Inactive</div>
          </div>
        </div>

        {/* Main Content & Table */}
        <div className="card glass">
          <div className="filter-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                {TAB_META[masterType].label}
              </h3>
              <button className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '0.85rem', fontWeight: 600 }} onClick={handleOpenAdd}>
                + Add {TAB_META[masterType].singular}
              </button>
            </div>

            <div className="filter-controls" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                className="filter-input"
                placeholder="🔍 Search label or value..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 250 }}
              />
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label (Display Name)</TableHead>
                  <TableHead>System Value (ID)</TableHead>
                  <TableHead>Metadata</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead style={{ textAlign: 'right' }}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length > 0 ? (
                  filteredData.map(item => (
                    <TableRow key={item._id}>
                      <TableCell>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>{item.label}</div>
                      </TableCell>
                      <TableCell>
                        <span style={{ background: 'rgba(0,0,0,0.05)', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                          {item.value}
                        </span>
                      </TableCell>
                      <TableCell>
                        {Object.keys(item.metadata || {}).length > 0 ? (
                           <pre style={{ margin: 0, fontSize: '0.75rem', background: 'var(--bg-dark)', padding: '6px 10px', borderRadius: '6px', color: 'var(--text-muted)', border: '1px solid var(--border)', maxWidth: 200, overflowX: 'auto' }}>
                             {JSON.stringify(item.metadata)}
                           </pre>
                        ) : (
                           <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>No metadata</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Switch checked={item.isActive !== false} onCheckedChange={() => handleToggleStatus(item)} />
                          <span style={{ fontSize: '0.85rem', color: item.isActive !== false ? '#10b981' : 'var(--text-muted)', fontWeight: item.isActive !== false ? 600 : 400 }}>
                            {item.isActive !== false ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            className="btn"
                            style={{ padding: '4px 12px', fontSize: '0.75rem', background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)' }}
                            onClick={() => handleOpenEdit(item)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-danger"
                            style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                            onClick={() => handleDelete(item._id)}
                          >
                            Delete
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: '3rem', opacity: 0.2, marginBottom: 12 }}>folder_open</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
                        {search ? `No ${TAB_META[masterType].label.toLowerCase()} match "${search}"` : `No ${TAB_META[masterType].label.toLowerCase()} yet`}
                      </div>
                      <div style={{ fontSize: '0.9rem' }}>{search ? 'Try a different search term, or clear it to see everything.' : `Click "+ Add ${TAB_META[masterType].singular}" to create the first one.`}</div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Modal for Add / Edit */}
        {isModalOpen && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20
          }}>
            <div className="card glass" style={{ width: 500, maxWidth: '100%', background: '#ffffff', padding: '2rem', borderRadius: 16, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
              <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--accent)' }}>
                  {editingItem ? 'edit_square' : 'add_circle'}
                </span>
                {editingItem ? `Edit ${TAB_META[masterType].singular}` : `New ${TAB_META[masterType].singular}`}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-main)' }}>Display Label *</label>
                  <input
                    type="text"
                    className="filter-input"
                    style={{ width: '100%', padding: '10px 12px', fontSize: '0.95rem' }}
                    placeholder={`e.g. ${masterType === 'country' ? 'India' : masterType === 'category' ? 'Electronics' : 'Amazon'}`}
                    value={masterForm.label}
                    onChange={(e) => setMasterForm({ ...masterForm, label: e.target.value })}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>The human-readable name shown in the UI.</div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-main)' }}>System Value *</label>
                  <input
                    type="text"
                    className="filter-input"
                    style={{ width: '100%', padding: '10px 12px', fontSize: '0.95rem', fontFamily: 'monospace' }}
                    placeholder={`e.g. ${masterType === 'country' ? 'IN' : masterType === 'category' ? 'electronics' : 'amazon'}`}
                    value={masterForm.value}
                    onChange={(e) => setMasterForm({ ...masterForm, value: e.target.value })}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    {masterType === 'category'
                      ? 'Exactly the string DeepSeek must return for this category to be assigned — case-sensitive, no spaces. Renaming it later means the AI has to re-learn the new spelling; old deals keep whatever value they were saved with.'
                      : 'The internal identifier stored on the record. Not currently matched against anywhere in the pipeline for this list — safe to change later if you need to.'}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-main)' }}>
                    Metadata (Valid JSON)
                  </label>
                  <textarea
                    className="filter-input"
                    style={{ width: '100%', padding: '10px 12px', fontSize: '0.85rem', fontFamily: 'monospace', minHeight: 100, resize: 'vertical' }}
                    placeholder={'{
  "key": "value"
}'}
                    value={masterForm.metadata}
                    onChange={(e) => setMasterForm({ ...masterForm, metadata: e.target.value })}
                  />
                  {jsonError && (
                    <div style={{ fontSize: '0.8rem', color: '#ef4444', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>error</span> {jsonError}
                    </div>
                  )}
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Optional configuration data associated with this record.</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, padding: '12px', background: 'rgba(0,0,0,0.02)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>Record Status</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                    <Switch checked={masterForm.isActive} onCheckedChange={(val) => setMasterForm({ ...masterForm, isActive: val })} />
                    <span style={{ fontSize: '0.85rem', color: masterForm.isActive ? '#10b981' : 'var(--text-muted)', fontWeight: 600 }}>{masterForm.isActive ? 'Active' : 'Disabled'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
                  <button className="btn" style={{ background: 'transparent', color: 'var(--text-main)' }} onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={handleSave}>
                    {editingItem ? 'Save Changes' : 'Create Record'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </section>
    </>
  );
}
