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

const PRICE_SOURCE_META = {
  scraped: { label: 'Scraped', icon: 'verified', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', hint: 'Live page scrape verified' },
  ai_text: { label: 'AI Text', icon: 'psychology', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', hint: 'Parsed from Telegram deal text' },
  price_history: { label: 'History', icon: 'history', color: '#d97706', bg: 'rgba(217, 119, 6, 0.12)', hint: 'Inferred from last recorded price' },
};

function StarRating({ rating, reviews }) {
  if (!rating) return <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>;
  const numRating = Number(rating);
  const displayRating = numRating > 5 ? (numRating / 2).toFixed(1) : numRating.toFixed(1);
  const reviewCount = Array.isArray(reviews) ? reviews.length : (typeof reviews === 'number' ? reviews : 0);

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }} title={`${displayRating}/5`}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        padding: '2px 7px', borderRadius: 6,
        background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)',
        color: '#b45309', fontSize: '0.76rem', fontWeight: 700
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#f59e0b', fontVariationSettings: "'FILL' 1" }}>star</span>
        {displayRating}
      </span>
      {reviewCount > 0 && (
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          ({reviewCount > 999 ? `${(reviewCount/1000).toFixed(1)}k` : reviewCount})
        </span>
      )}
    </div>
  );
}

export default function ProductDrawer({
  product,
  initialTab = 'overview',
  allProducts = [],
  subcategoryMeta = {},
  apiBase,
  onClose,
  onSelectProduct,
  onFlagClick,
  onHistoryClick,
  onDeleteClick,
  onCategoryClick,
  onMerchantClick
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [associatedDeals, setAssociatedDeals] = useState([]);
  const [loadingDeals, setLoadingDeals] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (activeTab === 'deals' && product?.productId) {
      setLoadingDeals(true);
      fetch(`${apiBase.replace(/\/+$/, '')}/api/deals?q=${encodeURIComponent(product.productId)}&limit=15`)
        .then(res => res.json())
        .then(json => {
          setAssociatedDeals(json.deals || json.data || []);
        })
        .catch(err => console.error('Fetch associated deals error:', err))
        .finally(() => setLoadingDeals(false));
    }
  }, [activeTab, product?.productId, apiBase]);

  if (!product) return null;

  const currentIdx = allProducts.findIndex(p => p._id === product._id);
  const prevProduct = currentIdx > 0 ? allProducts[currentIdx - 1] : null;
  const nextProduct = currentIdx < allProducts.length - 1 ? allProducts[currentIdx + 1] : null;

  const imgUrl = product.imageUrl || (product.images && product.images[0]);
  const price = product.price ?? product.currentPrice;
  const hasMrp = product.originalPrice && product.originalPrice > price;
  const discount = hasMrp ? Math.round(((product.originalPrice - price) / product.originalPrice) * 100) : null;
  const catColor = categoryColor(product.category);
  const src = product.priceSource && PRICE_SOURCE_META[product.priceSource];
  const merchant = product.merchant || 'Amazon';

  return (
    <div className="product-drawer-overlay" onClick={onClose}>
      <div className="product-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={`merchant-badge merchant-${merchant.toLowerCase()}`}>{merchant}</span>
            {product.isFlagged && (
              <span style={{
                fontSize: '0.74rem', fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                background: 'rgba(239, 68, 68, 0.12)', color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: 4
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>flag</span> Flagged
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.04)', borderRadius: 6, padding: 2 }}>
              <button
                disabled={!prevProduct}
                onClick={() => prevProduct && onSelectProduct(prevProduct)}
                style={{ background: 'none', border: 'none', padding: '3px 6px', cursor: prevProduct ? 'pointer' : 'not-allowed', opacity: prevProduct ? 1 : 0.4, color: 'var(--text-main)', display: 'flex' }}
                title="Previous product"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
              </button>
              <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', padding: '0 4px', color: 'var(--text-muted)' }}>
                {currentIdx + 1}/{allProducts.length}
              </span>
              <button
                disabled={!nextProduct}
                onClick={() => nextProduct && onSelectProduct(nextProduct)}
                style={{ background: 'none', border: 'none', padding: '3px 6px', cursor: nextProduct ? 'pointer' : 'not-allowed', opacity: nextProduct ? 1 : 0.4, color: 'var(--text-main)', display: 'flex' }}
                title="Next product"
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

        {/* Tab Navigation */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.015)' }}>
          <button
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '10px 18px', fontSize: '0.84rem', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer',
              color: activeTab === 'overview' ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: activeTab === 'overview' ? '2px solid var(--accent)' : '2px solid transparent'
            }}
          >
            Product Overview
          </button>
          <button
            onClick={() => setActiveTab('deals')}
            style={{
              padding: '10px 18px', fontSize: '0.84rem', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer',
              color: activeTab === 'deals' ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: activeTab === 'deals' ? '2px solid var(--accent)' : '2px solid transparent',
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <span>Linked Deals</span>
            <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: 8, background: 'rgba(0,0,0,0.05)', fontWeight: 700 }}>
              {associatedDeals.length > 0 ? associatedDeals.length : (product.dealsCount || 0)}
            </span>
          </button>
        </div>

        {/* Body Content */}
        {activeTab === 'deals' ? (
          <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 12 }}>
              Telegram Deal Posts Matching PID ({product.productId})
            </div>
            {loadingDeals ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 24, animation: 'spin 1s linear infinite', color: 'var(--accent)' }}>
                  progress_activity
                </span>
                <p style={{ fontSize: '0.82rem', marginTop: 6 }}>Loading deals...</p>
              </div>
            ) : associatedDeals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: 'rgba(0,0,0,0.02)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--text-muted)', opacity: 0.5 }}>local_offer</span>
                <p style={{ margin: '6px 0 0', fontWeight: 600, fontSize: '0.88rem' }}>No Active Deals</p>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>No Telegram posts recorded for this PID.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {associatedDeals.map(d => (
                  <div key={d._id} style={{ padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                        {formatCurrency(d.dealPrice || d.price, d.country)}
                      </span>
                      {d.discountPercentage && (
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: 4 }}>
                          {d.discountPercentage}% OFF
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', marginTop: 4, lineHeight: 1.4 }}>
                      {d.dealTitle || d.title}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                      <span>Channel: {d.sourceChannelName || 'Direct'}</span>
                      <span>{formatTime(d.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Image Preview Box */}
            <div style={{
              width: '100%', height: 220, background: '#ffffff', borderRadius: 12, border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, position: 'relative', overflow: 'hidden'
            }}>
              {imgUrl ? (
                <img src={imgUrl} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--text-muted)', opacity: 0.4 }}>image_not_supported</span>
              )}
              {product.imageIsFromDeal && (
                <div style={{
                  position: 'absolute', bottom: 8, right: 8, background: '#f59e0b', color: '#fff',
                  fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 11 }}>send</span> Telegram Photo Fallback
                </div>
              )}
            </div>

            {/* Title & Product ID */}
            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.4 }}>
                {product.title || 'Untitled Product'}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', background: 'rgba(0,0,0,0.04)', padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  PID: {product.productId || product._id}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(product.productId || product._id);
                    alert('Copied Product ID');
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}
                  title="Copy PID"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>content_copy</span>
                </button>
              </div>
            </div>

            {/* Pricing Details Card */}
            <div style={{ padding: '14px 16px', background: 'rgba(0,0,0,0.02)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 6 }}>
                Pricing Intelligence
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  {formatCurrency(price, product.country)}
                </span>
                {hasMrp && (
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                    {formatCurrency(product.originalPrice, product.country)}
                  </span>
                )}
                {discount != null && discount > 0 && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, background: 'rgba(239,68,68,0.12)', color: 'var(--danger)', padding: '2px 8px', borderRadius: 6 }}>
                    {discount}% DISCOUNT
                  </span>
                )}
              </div>
              {src && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Source:</span>
                  <span style={{ fontWeight: 700, color: src.color, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{src.icon}</span> {src.label}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>({src.hint})</span>
                </div>
              )}
            </div>

            {/* Taxonomy & Metadata Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ padding: '10px 12px', background: 'var(--bg-panel)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Category</span>
                <div style={{ marginTop: 3, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <span className="badge-cat" style={{ background: catColor.bg, color: catColor.fg, border: `1px solid ${catColor.border}`, fontSize: '0.72rem', padding: '2px 7px' }}>
                    {product.category || 'general'}
                  </span>
                  {product.subcategory && (
                    <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      {subcategoryMeta[product.subcategory]?.label || product.subcategory}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ padding: '10px 12px', background: 'var(--bg-panel)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Rating</span>
                <div style={{ marginTop: 3 }}>
                  <StarRating rating={product.rating} reviews={product.reviews} />
                </div>
              </div>

              <div style={{ padding: '10px 12px', background: 'var(--bg-panel)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Country</span>
                <div style={{ marginTop: 3, fontSize: '0.82rem', fontWeight: 600 }}>
                  {COUNTRY_FLAGS[product.country]?.flag} {product.country || 'IN'}
                </div>
              </div>

              <div style={{ padding: '10px 12px', background: 'var(--bg-panel)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Last Checked</span>
                <div style={{ marginTop: 3, fontSize: '0.82rem', fontWeight: 600 }}>
                  {formatTime(product.updatedAt || product.lastCheckedAt)}
                </div>
              </div>
            </div>

            {/* Store URL */}
            {product.cleanUrl && (
              <div style={{ padding: '10px 12px', background: 'var(--bg-panel)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Store Link</span>
                  <a href={product.cleanUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.76rem', color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                    Open Store <span className="material-symbols-outlined" style={{ fontSize: 13 }}>open_in_new</span>
                  </a>
                </div>
                <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                  {product.cleanUrl}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Drawer Footer */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => onHistoryClick(product._id)}
              className="btn btn-primary"
              style={{ padding: '6px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6, borderRadius: 6 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>show_chart</span>
              Price History
            </button>

            <button
              onClick={() => onFlagClick(product)}
              className="btn"
              style={{ padding: '6px 12px', fontSize: '0.82rem', background: 'rgba(0,0,0,0.04)', color: product.isFlagged ? 'var(--danger)' : 'var(--text-main)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 4, borderRadius: 6 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>flag</span>
              {product.isFlagged ? 'Update Flag' : 'Flag'}
            </button>
          </div>

          <button
            onClick={() => onDeleteClick(product._id)}
            className="btn btn-danger"
            style={{ padding: '6px 12px', fontSize: '0.82rem', borderRadius: 6 }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
