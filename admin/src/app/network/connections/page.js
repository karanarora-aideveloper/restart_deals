'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Switch } from '@/components/ui/switch';

// A "connection" is one authenticated platform session (e.g. one WAHA instance+session, one
// Telegram MTProto login). It's intentionally separate from Output Destinations rows, which are
// routing rules (which country/category goes to which target) — several routing rows can share
// the exact same underlying connection, so login/session state belongs here, once, not per row.

const STATUS_META = {
  STOPPED: { color: '#64748b', bg: 'rgba(100,116,139,0.1)', label: 'Stopped' },
  STARTING: { color: '#d97706', bg: 'rgba(217,119,6,0.1)', label: 'Starting…' },
  SCAN_QR_CODE: { color: '#2563eb', bg: 'rgba(37,99,235,0.1)', label: 'Waiting for QR Scan' },
  WORKING: { color: '#059669', bg: 'rgba(5,150,105,0.1)', label: 'Connected' },
  FAILED: { color: '#dc2626', bg: 'rgba(220,38,38,0.1)', label: 'Failed' }
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { color: '#64748b', bg: 'rgba(100,116,139,0.1)', label: status || 'Unknown' };
  return (
    <span style={{ background: meta.bg, color: meta.color, padding: '4px 12px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700 }}>
      ● {meta.label}
    </span>
  );
}

// Browse every group the connected WhatsApp account is in, see which it administers, drill into
// a group's member list, and import selected phone numbers as Leads tagged with that group.
function GroupsBrowser({ conn, apiFetch, onClose }) {
  const [groups, setGroups] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adminOnly, setAdminOnly] = useState(true);
  const [search, setSearch] = useState('');

  const [openGroup, setOpenGroup] = useState(null); // { id, subject }
  const [participants, setParticipants] = useState(null);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [names, setNames] = useState({}); // waha id -> { name, isMyContact, isBusiness }
  const [namesLoading, setNamesLoading] = useState(false);

  // Looking up names is a bounded, explicit action scoped to the members of the group currently
  // open — never an account-wide pull (that's what filled the disk once already). Large groups
  // get a heads-up before firing potentially hundreds of individual lookups.
  const LARGE_GROUP_THRESHOLD = 300;
  const loadNames = async () => {
    if (!openGroup || !participants) return;
    const ids = participants.filter(p => !p.hidden).map(p => p.id);
    if (ids.length > LARGE_GROUP_THRESHOLD) {
      if (!window.confirm(`This group has ${ids.length} members — looking up names means ${ids.length} individual lookups and may take a while. Continue?`)) return;
    }
    setNamesLoading(true);
    try {
      const res = await apiFetch(`/api/output-channels/${conn.representativeId}/waha/groups/${encodeURIComponent(openGroup.id)}/participant-names`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load names');
      setNames(data.names);
    } catch (err) {
      setError(err.message);
    } finally {
      setNamesLoading(false);
    }
  };

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/output-channels/${conn.representativeId}/waha/groups`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch groups');
      setGroups(data.groups);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, conn.representativeId]);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  const filteredGroups = useMemo(() => {
    if (!groups) return [];
    const q = search.trim().toLowerCase();
    return groups.filter(g => (!adminOnly || g.isAdmin) && (!q || g.subject.toLowerCase().includes(q)));
  }, [groups, adminOnly, search]);

  const openGroupMembers = async (g) => {
    setOpenGroup(g);
    setParticipants(null);
    setSelected(new Set());
    setImportResult(null);
    setNames({});
    setParticipantsLoading(true);
    try {
      const res = await apiFetch(`/api/output-channels/${conn.representativeId}/waha/groups/${encodeURIComponent(g.id)}/participants`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch participants');
      setParticipants(data.participants);
      // Pre-select every importable (non-hidden) participant by default.
      setSelected(new Set(data.participants.filter(p => !p.hidden).map(p => p.phoneNumber)));
    } catch (err) {
      setError(err.message);
    } finally {
      setParticipantsLoading(false);
    }
  };

  const toggleSelected = (phoneNumber) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(phoneNumber)) next.delete(phoneNumber);
      else next.add(phoneNumber);
      return next;
    });
  };

  const handleImport = async () => {
    if (!openGroup || selected.size === 0) return;
    setImporting(true);
    try {
      const toImport = participants
        .filter(p => !p.hidden && selected.has(p.phoneNumber))
        .map(p => ({
          phoneNumber: p.phoneNumber,
          role: p.role,
          name: names[p.id]?.name || '',
          isMyContact: names[p.id]?.isMyContact || false,
          isBusiness: names[p.id]?.isBusiness || false
        }));

      const res = await apiFetch(`/api/output-channels/${conn.representativeId}/waha/groups/${encodeURIComponent(openGroup.id)}/import-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupName: openGroup.subject, phoneNumbers: toImport })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Import failed');
      setImportResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const hiddenCount = participants ? participants.filter(p => p.hidden).length : 0;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
    }}>
      <div className="card glass" style={{ width: 720, maxWidth: '95%', maxHeight: '85vh', overflow: 'auto', background: '#ffffff', padding: '1.5rem', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem' }}>📋 WhatsApp Groups</h3>
          <button className="btn" style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)', padding: '6px 14px' }} onClick={onClose}>Close</button>
        </div>

        {error && (
          <div style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--danger)', padding: '8px 12px', borderRadius: 8, fontSize: '0.8rem', marginBottom: 12 }}>
            {error}
          </div>
        )}

        {!openGroup ? (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="filter-input"
                placeholder="🔍 Search group name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: 1, minWidth: 180 }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={adminOnly} onChange={(e) => setAdminOnly(e.target.checked)} />
                Groups I admin only
              </label>
              <button className="btn" style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)' }} onClick={loadGroups} disabled={loading}>
                Refresh
              </button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading groups…</div>
            ) : (
              <>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                  {filteredGroups.length} of {groups?.length || 0} groups{adminOnly ? ` — where you're an admin` : ''}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflow: 'auto' }}>
                  {filteredGroups.map(g => (
                    <button
                      key={g.id}
                      onClick={() => openGroupMembers(g)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
                        background: 'rgba(0,0,0,0.02)', cursor: 'pointer', textAlign: 'left', width: '100%'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{g.subject}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{g.participantCount ?? '?'} members</div>
                      </div>
                      {g.isAdmin && (
                        <span style={{ background: 'rgba(37,99,235,0.1)', color: 'var(--accent)', padding: '3px 10px', borderRadius: 16, fontSize: '0.72rem', fontWeight: 700 }}>
                          You're Admin
                        </span>
                      )}
                    </button>
                  ))}
                  {filteredGroups.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No groups match.</div>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <button
              onClick={() => setOpenGroup(null)}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.82rem', cursor: 'pointer', padding: 0, marginBottom: 10 }}
            >
              ← Back to groups
            </button>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{openGroup.subject}</div>

            {participantsLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading members…</div>
            ) : participants && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {participants.length} members · {selected.size} selected
                    {hiddenCount > 0 && ` · ${hiddenCount} hidden their number (can't import)`}
                  </div>
                  <button
                    className="btn"
                    style={{ padding: '5px 12px', fontSize: '0.78rem', background: 'rgba(37,99,235,0.1)', color: 'var(--accent)', border: '1px solid rgba(37,99,235,0.3)' }}
                    onClick={loadNames}
                    disabled={namesLoading || Object.keys(names).length > 0}
                  >
                    {namesLoading ? 'Loading names…' : Object.keys(names).length > 0 ? 'Names loaded' : '🔍 Load Names'}
                  </button>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                  All imported leads are auto-tagged with <strong>{openGroup.subject}</strong> — the same phone number found in another group you admin gets that group's tag added too, on the same lead.
                </div>
                <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'rgba(0,0,0,0.03)' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left', width: 30 }}></th>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Phone Number</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Name</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participants.map(p => {
                        const info = names[p.id];
                        return (
                          <tr key={p.id} style={{ borderTop: '1px solid var(--border)', opacity: p.hidden ? 0.5 : 1 }}>
                            <td style={{ padding: '6px 10px' }}>
                              <input
                                type="checkbox"
                                disabled={p.hidden}
                                checked={selected.has(p.phoneNumber)}
                                onChange={() => toggleSelected(p.phoneNumber)}
                              />
                            </td>
                            <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>
                              {p.hidden ? 'Hidden by privacy settings' : `+${p.phoneNumber}`}
                            </td>
                            <td style={{ padding: '6px 10px' }}>
                              {info ? (
                                <>
                                  {info.name || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                  {info.isMyContact && <span style={{ marginLeft: 4, fontSize: '0.65rem', background: 'rgba(37,99,235,0.1)', color: 'var(--accent)', padding: '1px 5px', borderRadius: 8 }}>📇</span>}
                                  {info.isBusiness && <span style={{ marginLeft: 4, fontSize: '0.65rem', background: 'rgba(217,119,6,0.1)', color: '#d97706', padding: '1px 5px', borderRadius: 8 }}>🏢</span>}
                                </>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '6px 10px', textTransform: 'capitalize' }}>{p.role}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {importResult ? (
                  <div style={{ background: 'rgba(5,150,105,0.08)', color: '#059669', padding: '10px 12px', borderRadius: 8, fontSize: '0.82rem', marginTop: 12 }}>
                    ✅ Imported {importResult.imported} new lead(s), updated {importResult.updated} existing.
                    {importResult.skippedHidden > 0 && ` Skipped ${importResult.skippedHidden} with no visible number.`}
                    {' '}See <a href="/audience/leads" style={{ color: '#059669', fontWeight: 700 }}>Audience → Leads</a>.
                  </div>
                ) : (
                  <button
                    className="btn btn-primary"
                    style={{ padding: '8px 20px', fontSize: '0.85rem', marginTop: 12 }}
                    onClick={handleImport}
                    disabled={importing || selected.size === 0}
                  >
                    {importing ? 'Importing…' : `Import ${selected.size} Selected as Leads`}
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const fmtUsd = (n) => n == null ? '—' : `$${Number(n).toFixed(2)}`;
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString() : '—';

// Add/Edit modal for one managed X account — mirrors the credentials block that used to live
// inline on the Output Channel form, plus the login/billing tracking this page adds on top.
function XAccountModal({ account, onClose, onSaved, apiFetch }) {
  const [form, setForm] = useState({
    label: account?.label || '',
    handle: account?.handle || '',
    isActive: account?.isActive !== undefined ? account.isActive : true,
    login: { email: account?.login?.email || '', password: account?.login?.password || '', notes: account?.login?.notes || '' },
    oauth1: {
      apiKey: account?.oauth1?.apiKey || '',
      apiSecret: account?.oauth1?.apiSecret || '',
      accessToken: account?.oauth1?.accessToken || '',
      accessSecret: account?.oauth1?.accessSecret || ''
    },
    oauth2: { clientId: account?.oauth2?.clientId || '', clientSecret: account?.oauth2?.clientSecret || '' },
    bearerToken: account?.bearerToken || '',
    billing: {
      cardLabel: account?.billing?.cardLabel || '',
      monthlySpendLimitUsd: account?.billing?.monthlySpendLimitUsd ?? '',
      lastKnownBalanceUsd: account?.billing?.lastKnownBalanceUsd ?? '',
      lastKnownBalanceAt: account?.billing?.lastKnownBalanceAt ? account.billing.lastKnownBalanceAt.slice(0, 10) : '',
      notes: account?.billing?.notes || ''
    }
  });
  const [showSecrets, setShowSecrets] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (path, value) => {
    setForm(prev => {
      const next = { ...prev };
      const keys = path.split('.');
      let node = next;
      for (let i = 0; i < keys.length - 1; i++) {
        node[keys[i]] = { ...node[keys[i]] };
        node = node[keys[i]];
      }
      node[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const secretType = showSecrets ? 'text' : 'password';

  const handleSave = async () => {
    if (!form.label.trim()) { setError('Label is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        billing: {
          ...form.billing,
          monthlySpendLimitUsd: form.billing.monthlySpendLimitUsd === '' ? null : Number(form.billing.monthlySpendLimitUsd),
          lastKnownBalanceUsd: form.billing.lastKnownBalanceUsd === '' ? null : Number(form.billing.lastKnownBalanceUsd),
          lastKnownBalanceAt: form.billing.lastKnownBalanceAt ? new Date(form.billing.lastKnownBalanceAt).toISOString() : null
        }
      };
      const res = await apiFetch(account ? `/api/x-accounts/${account._id}` : '/api/x-accounts', {
        method: account ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save account');
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = { width: '100%', padding: '6px 10px' };
  const sectionStyle = { padding: 12, background: 'rgba(0,0,0,0.03)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 };
  const labelStyle = { fontSize: '0.85rem', fontWeight: 700, marginBottom: 2, color: 'var(--text-main)' };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div className="card glass" style={{ width: 560, maxWidth: '95%', maxHeight: '88vh', overflow: 'auto', background: '#ffffff', padding: '1.5rem', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem' }}>🐦 {account ? 'Edit' : 'Add'} X Account</h3>
          <button className="btn" style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)', padding: '5px 12px' }} onClick={onClose}>Close</button>
        </div>

        {error && (
          <div style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--danger)', padding: '8px 12px', borderRadius: 8, fontSize: '0.8rem', marginBottom: 12 }}>{error}</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Label (your name for this account)</label>
              <input type="text" className="filter-input" style={inputStyle} placeholder="e.g. India Deals Bot" value={form.label} onChange={(e) => set('label', e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Handle (@ on X)</label>
              <input type="text" className="filter-input" style={inputStyle} placeholder="indiadealsbot" value={form.handle} onChange={(e) => set('handle', e.target.value)} />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch checked={form.isActive} onCheckedChange={(val) => set('isActive', val)} />
            <span style={{ fontSize: '0.85rem' }}>{form.isActive ? 'Active' : 'Disabled'}</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={showSecrets} onChange={(e) => setShowSecrets(e.target.checked)} />
            Show secret fields as plain text (for copy/paste)
          </label>

          <div style={sectionStyle}>
            <div style={labelStyle}>👤 Login (x.com — reference only)</div>
            <div style={{ fontSize: '0.7rem', color: '#b45309', background: 'rgba(217,119,6,0.1)', padding: '6px 8px', borderRadius: 6 }}>
              ⚠️ Stored as plain text in this database — nothing here is encrypted at rest. This is <strong>not</strong> used by any automated login (X has no supported password-login API); it&apos;s only so you have it on hand for the developer portal or account recovery. Consider leaving password blank and keeping it in a password manager instead.
            </div>
            <input type="text" className="filter-input" style={inputStyle} placeholder="Login email" value={form.login.email} onChange={(e) => set('login.email', e.target.value)} />
            <input type={secretType} className="filter-input" style={inputStyle} placeholder="Login password (optional — see warning above)" value={form.login.password} onChange={(e) => set('login.password', e.target.value)} />
            <input type="text" className="filter-input" style={inputStyle} placeholder="Notes (e.g. 2FA method)" value={form.login.notes} onChange={(e) => set('login.notes', e.target.value)} />
          </div>

          <div style={sectionStyle}>
            <div style={labelStyle}>🔑 OAuth 1.0a (required for posting)</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              From this X app&apos;s <strong>Keys and Tokens</strong> tab at{' '}
              <a href="https://console.x.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>console.x.com</a>.
            </div>
            <input type="text" className="filter-input" style={inputStyle} placeholder="API Key (Consumer Key)" value={form.oauth1.apiKey} onChange={(e) => set('oauth1.apiKey', e.target.value)} />
            <input type={secretType} className="filter-input" style={inputStyle} placeholder="API Secret Key" value={form.oauth1.apiSecret} onChange={(e) => set('oauth1.apiSecret', e.target.value)} />
            <input type="text" className="filter-input" style={inputStyle} placeholder="Access Token" value={form.oauth1.accessToken} onChange={(e) => set('oauth1.accessToken', e.target.value)} />
            <input type={secretType} className="filter-input" style={inputStyle} placeholder="Access Token Secret" value={form.oauth1.accessSecret} onChange={(e) => set('oauth1.accessSecret', e.target.value)} />
          </div>

          <div style={sectionStyle}>
            <div style={labelStyle}>🔑 OAuth 2.0 (optional, not used for posting today)</div>
            <input type="text" className="filter-input" style={inputStyle} placeholder="Client ID" value={form.oauth2.clientId} onChange={(e) => set('oauth2.clientId', e.target.value)} />
            <input type={secretType} className="filter-input" style={inputStyle} placeholder="Client Secret" value={form.oauth2.clientSecret} onChange={(e) => set('oauth2.clientSecret', e.target.value)} />
            <input type={secretType} className="filter-input" style={inputStyle} placeholder="Bearer Token (app-only, read-only)" value={form.bearerToken} onChange={(e) => set('bearerToken', e.target.value)} />
          </div>

          <div style={sectionStyle}>
            <div style={labelStyle}>💳 Billing</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              X doesn&apos;t expose a credits-remaining API — this is a manual check-in against console.x.com. Estimated spend since your last check-in is computed automatically from this account&apos;s actual post count.
            </div>
            <input type="text" className="filter-input" style={inputStyle} placeholder="Card label, last 4 only (e.g. Amex ...4471)" value={form.billing.cardLabel} onChange={(e) => set('billing.cardLabel', e.target.value)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input type="number" step="0.01" className="filter-input" style={inputStyle} placeholder="Monthly spend limit ($)" value={form.billing.monthlySpendLimitUsd} onChange={(e) => set('billing.monthlySpendLimitUsd', e.target.value)} />
              <input type="number" step="0.01" className="filter-input" style={inputStyle} placeholder="Balance on console.x.com ($)" value={form.billing.lastKnownBalanceUsd} onChange={(e) => set('billing.lastKnownBalanceUsd', e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 2 }}>Balance as of</label>
              <input type="date" className="filter-input" style={inputStyle} value={form.billing.lastKnownBalanceAt} onChange={(e) => set('billing.lastKnownBalanceAt', e.target.value)} />
            </div>
            <input type="text" className="filter-input" style={inputStyle} placeholder="Notes" value={form.billing.notes} onChange={(e) => set('billing.notes', e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button className="btn" style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)', padding: '6px 16px' }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ padding: '6px 20px', fontWeight: 600 }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Account'}
          </button>
        </div>
      </div>
    </div>
  );
}

function XAccountsSection({ apiFetch }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAccount, setModalAccount] = useState(undefined); // undefined = closed, null = add, object = edit
  const [testingId, setTestingId] = useState(null);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await apiFetch('/api/x-accounts');
      if (!res.ok) return;
      const data = await res.json();
      setAccounts(data.accounts || []);
    } catch (err) {
      console.error('Fetch X accounts error:', err);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const handleTest = async (acc) => {
    setTestingId(acc._id);
    try {
      const res = await apiFetch(`/api/x-accounts/${acc._id}/test`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Test post failed');
      alert(`✅ ${data.message}`);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (acc) => {
    if (!window.confirm(`Delete "${acc.label}"? This cannot be undone.`)) return;
    try {
      const res = await apiFetch(`/api/x-accounts/${acc._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete account');
      fetchAccounts();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div className="card glass" style={{ padding: '1.2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '1.3rem' }}>🐦</span>
        <h3 style={{ margin: 0 }}>X / Twitter Accounts</h3>
        <span style={{ background: 'rgba(37,99,235,0.1)', color: 'var(--accent)', padding: '4px 12px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700 }}>
          {accounts.length}
        </span>
        <button className="btn btn-primary" style={{ marginLeft: 'auto', padding: '6px 14px', fontSize: '0.82rem' }} onClick={() => setModalAccount(null)}>
          + Add X Account
        </button>
      </div>

      {loading ? (
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Loading…</div>
      ) : accounts.length === 0 ? (
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          No X accounts managed yet. Add one here, then reference it from an Output Channel (Platform: Twitter/X) at{' '}
          <a href="/network/output" style={{ color: 'var(--accent)' }}>Output Destinations</a>.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {accounts.map(acc => {
            const hasOAuth1 = acc.oauth1?.apiKey && acc.oauth1?.apiSecret && acc.oauth1?.accessToken && acc.oauth1?.accessSecret;
            return (
              <div key={acc._id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700 }}>{acc.label}</span>
                      {acc.handle && <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>@{acc.handle}</span>}
                      <span style={{
                        background: acc.isActive ? 'rgba(5,150,105,0.1)' : 'rgba(100,116,139,0.1)',
                        color: acc.isActive ? '#059669' : '#64748b',
                        padding: '2px 8px', borderRadius: 14, fontSize: '0.68rem', fontWeight: 700
                      }}>
                        {acc.isActive ? 'Active' : 'Disabled'}
                      </span>
                      {!hasOAuth1 && (
                        <span style={{ background: 'rgba(220,38,38,0.1)', color: 'var(--danger)', padding: '2px 8px', borderRadius: 14, fontSize: '0.68rem', fontWeight: 700 }}>
                          Missing OAuth Keys
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      {acc.usage.channelCount > 0
                        ? `Used by: ${acc.usage.channelNames.join(', ')}`
                        : 'Not referenced by any output channel yet'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn" style={{ padding: '4px 10px', fontSize: '0.75rem', background: 'rgba(59,130,246,0.1)', color: '#2563eb', border: '1px solid rgba(59,130,246,0.3)' }} onClick={() => handleTest(acc)} disabled={testingId === acc._id || !hasOAuth1}>
                      {testingId === acc._id ? 'Sending…' : 'Test Post'}
                    </button>
                    <button className="btn" style={{ padding: '4px 10px', fontSize: '0.75rem', background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)' }} onClick={() => setModalAccount(acc)}>
                      Edit
                    </button>
                    <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => handleDelete(acc)}>
                      Delete
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8, fontSize: '0.78rem' }}>
                  <span><strong>{acc.usage.dealsPublished}</strong> deals posted</span>
                  <span title="Estimated from post count × $0.20/post — X has no real-time balance API">
                    Est. spent: <strong>{fmtUsd(acc.usage.estimatedSpendUsd)}</strong>
                  </span>
                  {acc.billing?.lastKnownBalanceUsd != null && (
                    <span>Est. remaining: <strong>{fmtUsd(acc.usage.estimatedRemainingUsd)}</strong> (as of {fmtDate(acc.billing.lastKnownBalanceAt)})</span>
                  )}
                  {acc.billing?.monthlySpendLimitUsd != null && (
                    <span>Monthly limit: <strong>{fmtUsd(acc.billing.monthlySpendLimitUsd)}</strong></span>
                  )}
                  {acc.billing?.cardLabel && <span style={{ color: 'var(--text-muted)' }}>{acc.billing.cardLabel}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalAccount !== undefined && (
        <XAccountModal
          account={modalAccount}
          apiFetch={apiFetch}
          onClose={() => setModalAccount(undefined)}
          onSaved={() => { setModalAccount(undefined); fetchAccounts(); }}
        />
      )}
    </div>
  );
}

export default function ChannelManagementPage() {
  const [apiBase, setApiBase] = useState(process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:3001');
  const adminApiKey = process.env.NEXT_PUBLIC_ADMIN_API_KEY || '';
  const [channels, setChannels] = useState([]);
  const [daemonOnline, setDaemonOnline] = useState(null);

  const [connStatus, setConnStatus] = useState({}); // key -> { status, me }
  const [connQr, setConnQr] = useState({}); // key -> base64 | null
  const [connBusy, setConnBusy] = useState({}); // key -> bool
  const [connError, setConnError] = useState({}); // key -> string
  const [groupsBrowserConn, setGroupsBrowserConn] = useState(null); // conn | null

  useEffect(() => {
  }, []);

  const apiFetch = useCallback(async (endpoint, options = {}) => {
    const base = apiBase.replace(/\/+$/, '');
    const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;
    const headers = { ...(options.headers || {}), ...(adminApiKey ? { 'x-admin-key': adminApiKey } : {}) };
    return fetch(url, { ...options, headers });
  }, [apiBase, adminApiKey]);

  const fetchChannels = useCallback(async () => {
    try {
      const res = await apiFetch('/api/output-channels?platform=all&country=all&category=all&q=');
      if (!res.ok) return;
      const data = await res.json();
      setChannels(data.channels || []);
    } catch (err) {
      console.error('Fetch channels error:', err);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchChannels();
    apiFetch('/api/admin/status').then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      setDaemonOnline(data.status === 'Online');
    }).catch(() => setDaemonOnline(null));
  }, [fetchChannels, apiFetch]);

  // Group every WAHA-backed WhatsApp output channel by (baseUrl, session) — that pair IS the
  // connection identity in WAHA; several routing rows can legitimately point at the same one.
  const wahaConnections = useMemo(() => {
    const groups = new Map();
    for (const ch of channels) {
      if (ch.platform !== 'whatsapp') continue;
      const provider = ch.credentials?.provider || (ch.credentials?.wahaBaseUrl ? 'waha' : null);
      if (provider !== 'waha' || !ch.credentials?.wahaBaseUrl) continue;
      const session = ch.credentials.wahaSession || 'default';
      const key = `${ch.credentials.wahaBaseUrl}::${session}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          baseUrl: ch.credentials.wahaBaseUrl,
          session,
          representativeId: ch._id,
          usedBy: []
        });
      }
      groups.get(key).usedBy.push(ch);
    }
    return Array.from(groups.values());
  }, [channels]);

  const fetchConnStatus = useCallback(async (conn, { fetchQr } = {}) => {
    try {
      const res = await apiFetch(`/api/output-channels/${conn.representativeId}/waha/status`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch session status');
      setConnStatus(prev => ({ ...prev, [conn.key]: { status: data.status, me: data.me } }));
      setConnError(prev => ({ ...prev, [conn.key]: '' }));

      if (fetchQr && data.status === 'SCAN_QR_CODE') {
        const qrRes = await apiFetch(`/api/output-channels/${conn.representativeId}/waha/qr`);
        const qrData = await qrRes.json();
        if (qrRes.ok && qrData.success) setConnQr(prev => ({ ...prev, [conn.key]: qrData.data }));
      } else {
        setConnQr(prev => ({ ...prev, [conn.key]: null }));
      }
    } catch (err) {
      setConnError(prev => ({ ...prev, [conn.key]: err.message }));
    }
  }, [apiFetch]);

  // Initial status check for any connection we haven't looked at yet.
  useEffect(() => {
    wahaConnections.forEach(conn => {
      if (!(conn.key in connStatus)) fetchConnStatus(conn, { fetchQr: true });
    });
  }, [wahaConnections, connStatus, fetchConnStatus]);

  // Poll every connection that's mid-handshake so a phone QR scan is picked up automatically.
  useEffect(() => {
    const interval = setInterval(() => {
      wahaConnections.forEach(conn => {
        const s = connStatus[conn.key]?.status;
        if (s === 'STARTING' || s === 'SCAN_QR_CODE') fetchConnStatus(conn, { fetchQr: true });
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [wahaConnections, connStatus, fetchConnStatus]);

  const runAction = async (conn, action) => {
    setConnBusy(prev => ({ ...prev, [conn.key]: true }));
    try {
      const res = await apiFetch(`/api/output-channels/${conn.representativeId}/waha/${action}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Failed to ${action} session`);
      await fetchConnStatus(conn, { fetchQr: true });
    } catch (err) {
      setConnError(prev => ({ ...prev, [conn.key]: err.message }));
    } finally {
      setConnBusy(prev => ({ ...prev, [conn.key]: false }));
    }
  };

  return (
    <section className="view-section active-view">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Telegram — direct MTProto API, shared session from .env, no in-admin login yet */}
        <div className="card glass" style={{ padding: '1.2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: '1.3rem' }}>✈️</span>
            <h3 style={{ margin: 0 }}>Telegram</h3>
            <span style={{
              background: daemonOnline ? 'rgba(5,150,105,0.1)' : 'rgba(100,116,139,0.1)',
              color: daemonOnline ? '#059669' : '#64748b',
              padding: '4px 12px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700
            }}>
              ● {daemonOnline === null ? 'Unknown' : daemonOnline ? 'Daemon Online' : 'Daemon Offline'}
            </span>
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Direct API — one shared MTProto login for your account (<code>TELEGRAM_API_ID</code> / <code>TELEGRAM_API_HASH</code> / <code>TELEGRAM_SESSION</code> in <code>backend/.env</code>), used by every Telegram output channel below.
            No QR/login step needed here since it's already authenticated at the process level — in-admin re-auth for this is a later addition.
          </div>
        </div>

        {/* WhatsApp — one card per distinct WAHA connection (baseUrl + session) */}
        {wahaConnections.length === 0 ? (
          <div className="card glass" style={{ padding: '1.2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: '1.3rem' }}>💬</span>
              <h3 style={{ margin: 0 }}>WhatsApp</h3>
              <span style={{ background: 'rgba(100,116,139,0.1)', color: '#64748b', padding: '4px 12px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700 }}>
                ● Not configured
              </span>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              No WAHA-backed WhatsApp output channel exists yet. Add one from{' '}
              <a href="/network/output" style={{ color: 'var(--accent)' }}>Output Destinations</a>{' '}
              (Platform: WhatsApp, Delivery Method: WAHA) — a login card will appear here automatically.
            </div>
          </div>
        ) : (
          wahaConnections.map(conn => {
            const status = connStatus[conn.key];
            const qr = connQr[conn.key];
            const busy = connBusy[conn.key];
            const error = connError[conn.key];
            return (
              <div key={conn.key} className="card glass" style={{ padding: '1.2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '1.3rem' }}>💬</span>
                  <h3 style={{ margin: 0 }}>WhatsApp</h3>
                  {status && <StatusBadge status={status.status} />}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                  WAHA · {conn.baseUrl} · session <code>{conn.session}</code>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                  Used by: {conn.usedBy.map(c => c.name).join(', ')}
                </div>

                {error && (
                  <div style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--danger)', padding: '8px 12px', borderRadius: 8, fontSize: '0.8rem', marginBottom: 12 }}>
                    {error}
                  </div>
                )}

                {!status ? (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Checking session status…</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {status.status === 'SCAN_QR_CODE' && (
                      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        {qr ? (
                          <img src={`data:image/png;base64,${qr}`} alt="WhatsApp QR Code" style={{ width: 180, height: 180, border: '1px solid var(--border)', borderRadius: 8 }} />
                        ) : (
                          <div style={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            Loading QR…
                          </div>
                        )}
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: 260 }}>
                          Open WhatsApp on the number you want to send from → Settings → Linked Devices → Link a Device, then scan.
                          Refreshes automatically until connected.
                        </div>
                      </div>
                    )}

                    {status.status === 'WORKING' && (
                      <div style={{ fontSize: '0.85rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{status.me?.pushName || 'Connected account'}</div>
                        <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{status.me?.id}</div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8 }}>
                      {(status.status === 'STOPPED' || status.status === 'FAILED') && (
                        <button className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '0.85rem' }} onClick={() => runAction(conn, 'start')} disabled={busy}>
                          {busy ? 'Starting…' : 'Start Session'}
                        </button>
                      )}
                      {status.status === 'WORKING' && (
                        <button
                          className="btn"
                          style={{ padding: '6px 16px', fontSize: '0.85rem', background: 'rgba(37,99,235,0.1)', color: 'var(--accent)', border: '1px solid rgba(37,99,235,0.3)' }}
                          onClick={() => setGroupsBrowserConn(conn)}
                        >
                          📋 Browse Groups
                        </button>
                      )}
                      {status.status === 'WORKING' && (
                        <a
                          href={`/network/connections/whatsapp?channelId=${conn.representativeId}`}
                          className="btn btn-primary"
                          style={{ padding: '6px 16px', fontSize: '0.85rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                        >
                          🚀 Open Full Portal
                        </a>
                      )}
                      {status.status === 'WORKING' && (
                        <button className="btn" style={{ padding: '6px 16px', fontSize: '0.85rem', background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)' }} onClick={() => runAction(conn, 'stop')} disabled={busy}>
                          Stop
                        </button>
                      )}
                      {(status.status === 'WORKING' || status.status === 'SCAN_QR_CODE') && (
                        <button
                          className="btn btn-danger"
                          style={{ padding: '6px 16px', fontSize: '0.85rem' }}
                          onClick={() => {
                            if (window.confirm('This logs the linked WhatsApp device out. You will need to scan a new QR code to reconnect. Continue?')) {
                              runAction(conn, 'logout');
                            }
                          }}
                          disabled={busy}
                        >
                          Logout
                        </button>
                      )}
                      <button
                        className="btn"
                        style={{ padding: '6px 16px', fontSize: '0.85rem', background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border)' }}
                        onClick={() => fetchConnStatus(conn, { fetchQr: true })}
                        disabled={busy}
                      >
                        Refresh
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* X/Twitter — unlike WAHA (one shared login → many groups), each X account is its
            own credential set + its own billing, so accounts are managed individually here
            rather than grouped by a shared connection key. */}
        <XAccountsSection apiFetch={apiFetch} />
      </div>

      {groupsBrowserConn && (
        <GroupsBrowser conn={groupsBrowserConn} apiFetch={apiFetch} onClose={() => setGroupsBrowserConn(null)} />
      )}
    </section>
  );
}
