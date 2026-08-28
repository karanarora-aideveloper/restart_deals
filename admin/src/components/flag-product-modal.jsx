'use client';

import { useState } from 'react';

const REASON_PRESETS = [
  'Wrong product image',
  'Wrong / garbage title',
  'Price looks wrong',
  'Wrong category',
  'Mismatched product (not what the link shows)',
  'Duplicate of another product',
];

export default function FlagProductModal({ product, apiBase, onClose, onSaved }) {
  const [reason, setReason] = useState(product.flagReason || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (flagged) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase.replace(/\/+$/, '')}/api/products/${product._id}/flag`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagged, reason: flagged ? reason : '' }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update flag');
      onSaved(json.data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10000, padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="card glass"
        style={{ width: 480, maxWidth: '100%', background: '#ffffff', padding: '1.75rem', borderRadius: 16, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0, marginBottom: 6, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--danger)' }}>flag</span>
          {product.isFlagged ? 'Update flag' : 'Flag as wrong data'}
        </h3>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={product.title}>
          {product.title}
        </div>

        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-main)' }}>
          What&apos;s wrong? (optional but helpful)
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {REASON_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setReason(preset)}
              className="btn"
              style={{
                padding: '4px 10px', fontSize: '0.75rem', borderRadius: 999,
                background: reason === preset ? 'var(--accent)' : 'rgba(0,0,0,0.04)',
                color: reason === preset ? '#fff' : 'var(--text-main)', border: 'none',
              }}
            >
              {preset}
            </button>
          ))}
        </div>
        <textarea
          className="filter-input"
          style={{ width: '100%', padding: '10px 12px', fontSize: '0.9rem', minHeight: 80, resize: 'vertical' }}
          placeholder="Add detail, or pick a preset above…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
        />

        {error && (
          <div style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>error</span> {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 20 }}>
          <div>
            {product.isFlagged && (
              <button className="btn" style={{ background: 'transparent', color: 'var(--text-main)' }} disabled={saving} onClick={() => submit(false)}>
                Remove flag
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" style={{ background: 'transparent', color: 'var(--text-main)' }} disabled={saving} onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn"
              style={{ background: 'var(--danger)', color: 'white', border: 'none', fontWeight: 600 }}
              disabled={saving}
              onClick={() => submit(true)}
            >
              {saving ? 'Saving…' : product.isFlagged ? 'Update flag' : 'Flag as wrong'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
