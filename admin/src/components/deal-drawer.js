'use client';

import { useState, useEffect } from 'react';

const formatTime = (isoString) => {
  if (!isoString) return 'Never';
  const date = new Date(isoString);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatCurrency = (amount, country = 'IN') => {
  if (amount === undefined || amount === null || amount === 'N/A' || amount === '-') return '—';
  const num = parseFloat(amount);
  if (isNaN(num)) return '—';

  const codes = {
    'IN': '₹',
    'US': '$',
    'UK': '£',
    'CA': 'C$',
    'AU': 'A$'
  };

  const symbol = codes[country] || '₹';
  return `${symbol}${num.toLocaleString('en-US')}`;
};

const COUNTRY_FLAGS = {
  'IN': { flag: '🇮🇳', name: 'India' },
  'US': { flag: '🇺🇸', name: 'United States' },
  'UK': { flag: '🇬🇧', name: 'United Kingdom' },
  'CA': { flag: '🇨🇦', name: 'Canada' },
  'AU': { flag: '🇦🇺', name: 'Australia' }
};

const CATEGORY_PALETTE = [
  { bg: 'rgba(59, 130, 246, 0.1)', fg: '#2563eb', border: 'rgba(59, 130, 246, 0.25)' },
  { bg: 'rgba(16, 185, 129, 0.1)', fg: '#059669', border: 'rgba(16, 185, 129, 0.25)' },
  { bg: 'rgba(139, 92, 246, 0.1)', fg: '#7c3aed', border: 'rgba(139, 92, 246, 0.25)' },
  { bg: 'rgba(236, 72, 153, 0.1)', fg: '#db2777', border: 'rgba(236, 72, 153, 0.25)' },
  { bg: 'rgba(217, 119, 6, 0.1)', fg: '#d97706', border: 'rgba(217, 119, 6, 0.25)' },
  { bg: 'rgba(244, 63, 94, 0.1)', fg: '#e11d48', border: 'rgba(244, 63, 94, 0.25)' },
  { bg: 'rgba(6, 182, 212, 0.1)', fg: '#0891b2', border: 'rgba(6, 182, 212, 0.25)' },
  { bg: 'rgba(132, 204, 22, 0.1)', fg: '#65a30d', border: 'rgba(132, 204, 22, 0.25)' },
];

function categoryColor(category) {
  const key = (category || 'general').toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length];
}

export default function DealDrawer({
  deal,
  allDeals = [],
  subcategoryMeta = {},
  apiBase,
  onClose,
  onSelectDeal,
  onDeleteClick
}) {
  if (!deal) return null;

  const currentIdx = allDeals.findIndex(d => d._id === deal._id);
  const prevDeal = currentIdx > 0 ? allDeals[currentIdx - 1] : null;
  const nextDeal = currentIdx < allDeals.length - 1 ? allDeals[currentIdx + 1] : null;

  const imgUrl = deal.imageUrl || (deal.images && deal.images[0]);
  const price = deal.dealPrice || deal.price;
  const originalPrice = deal.originalPrice;
  const discount = deal.discountPercentage;
  const merchant = deal.merchant || 'Amazon';
  const catColor = categoryColor(deal.category);

  return (
    <div className="product-drawer-overlay" onClick={onClose}>
      <div className="product-drawer" onClick={(e) => e.stopPropagation()}>
        
        {/* Drawer Header */}
        <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={`merchant-badge merchant-${merchant.toLowerCase()}`}>{merchant}</span>
            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>send</span>
              {deal.sourceChannelName || 'Telegram'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.04)', borderRadius: 6, padding: 2 }}>
              <button
                disabled={!prevDeal}
                onClick={() => prevDeal && onSelectDeal(prevDeal)}
                style={{ background: 'none', border: 'none', padding: '3px 6px', cursor: prevDeal ? 'pointer' : 'not-allowed', opacity: prevDeal ? 1 : 0.4, color: 'var(--text-main)', display: 'flex' }}
                title="Previous deal"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
              </button>
              <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', padding: '0 4px', color: 'var(--text-muted)' }}>
                {currentIdx + 1}/{allDeals.length}
              </span>
              <button
                disabled={!nextDeal}
                onClick={() => nextDeal && onSelectDeal(nextDeal)}
                style={{ background: 'none', border: 'none', padding: '3px 6px', cursor: nextDeal ? 'pointer' : 'not-allowed', opacity: nextDeal ? 1 : 0.4, color: 'var(--text-main)', display: 'flex' }}
                title="Next deal"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
              </button>
            </div>

            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
            </button>
          </div>
        </div>

        {/* Drawer Body Content */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Image Preview Box */}
          <div style={{
            width: '100%', height: 220, background: '#ffffff', borderRadius: 12, border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, position: 'relative', overflow: 'hidden'
          }}>
            {imgUrl ? (
              <img src={imgUrl} alt={deal.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--text-muted)', opacity: 0.4 }}>image_not_supported</span>
            )}
          </div>

          {/* Deal Title */}
          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.4 }}>
              {deal.dealTitle || deal.title || 'Untitled Deal'}
            </h3>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {deal.productId && (
                <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', background: 'rgba(0,0,0,0.04)', padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  PID: {deal.productId}
                </span>
              )}
              {deal.productId && (
                <a
                  href={`/products?q=${encodeURIComponent(deal.productId)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}
                >
                  Find in Catalog <span className="material-symbols-outlined" style={{ fontSize: 13 }}>arrow_forward</span>
                </a>
              )}
            </div>
          </div>

          {/* Pricing Intelligence Box */}
          <div style={{ padding: '14px 16px', background: 'rgba(0,0,0,0.02)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 6 }}>
              Deal Pricing
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {formatCurrency(price, deal.country)}
              </span>
              {originalPrice && originalPrice > price && (
                <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                  {formatCurrency(originalPrice, deal.country)}
                </span>
              )}
              {discount != null && discount > 0 && (
                <span style={{ fontSize: '0.75rem', fontWeight: 800, background: 'rgba(239,68,68,0.12)', color: 'var(--danger)', padding: '2px 8px', borderRadius: 6 }}>
                  {discount}% OFF
                </span>
              )}
            </div>

            {deal.coupon?.label && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>Coupon Applied:</span>
                <span style={{
                  background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#b45309',
                  padding: '3px 8px', borderRadius: 6, fontSize: '0.76rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4
                }}>
                  🎟️ {deal.coupon.label}
                </span>
                {deal.coupon.code && (
                  <button
                    onClick={() => { navigator.clipboard.writeText(deal.coupon.code); alert('Copied coupon code: ' + deal.coupon.code); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.74rem', fontWeight: 600 }}
                  >
                    Copy Code
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Taxonomy & Metadata Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ padding: '10px 12px', background: 'var(--bg-panel)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Category</span>
              <div style={{ marginTop: 3, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <span className="badge-cat" style={{ background: catColor.bg, color: catColor.fg, border: `1px solid ${catColor.border}`, fontSize: '0.72rem', padding: '2px 7px' }}>
                  {deal.category || 'general'}
                </span>
                {deal.subcategory && (
                  <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    {subcategoryMeta[deal.subcategory]?.label || deal.subcategory}
                  </span>
                )}
              </div>
            </div>

            <div style={{ padding: '10px 12px', background: 'var(--bg-panel)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Channel Source</span>
              <div style={{ marginTop: 3, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {deal.sourceChannelName || 'Telegram Feed'}
              </div>
            </div>

            <div style={{ padding: '10px 12px', background: 'var(--bg-panel)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Country</span>
              <div style={{ marginTop: 3, fontSize: '0.82rem', fontWeight: 600 }}>
                {COUNTRY_FLAGS[deal.country]?.flag} {deal.country || 'IN'}
              </div>
            </div>

            <div style={{ padding: '10px 12px', background: 'var(--bg-panel)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Posted Time</span>
              <div style={{ marginTop: 3, fontSize: '0.82rem', fontWeight: 600 }}>
                {formatTime(deal.createdAt)}
              </div>
            </div>
          </div>

          {/* Deal URL */}
          {deal.dealUrl && (
            <div style={{ padding: '10px 12px', background: 'var(--bg-panel)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Affiliate Deal Link</span>
                <a href={deal.dealUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.76rem', color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                  Open Deal <span className="material-symbols-outlined" style={{ fontSize: 13 }}>open_in_new</span>
                </a>
              </div>
              <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                {deal.dealUrl}
              </div>
            </div>
          )}

          {/* Raw Telegram Post Snippet */}
          {deal.description && (
            <div style={{ padding: '10px 12px', background: 'var(--bg-panel)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Original Post Text
              </span>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-main)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {deal.description}
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {deal.dealUrl ? (
            <a
              href={deal.dealUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
              style={{ padding: '6px 16px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6, borderRadius: 6, textDecoration: 'none' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
              Buy on {merchant}
            </a>
          ) : <div />}

          <button
            onClick={() => onDeleteClick(deal._id)}
            className="btn btn-danger"
            style={{ padding: '6px 12px', fontSize: '0.82rem', borderRadius: 6 }}
          >
            Delete Deal
          </button>
        </div>
      </div>
    </div>
  );
}
