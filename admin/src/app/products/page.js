'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import AdminShell from '@/components/admin-shell';
import PriceHistoryModal from '@/components/price-history-modal';
import FlagProductModal from '@/components/flag-product-modal';
import ProductDrawer from '@/components/product-drawer';
import ScrapeHistoryModal from '@/components/scrape-history-modal';

// Time formatting helper
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

// Unified Deals & Rating Pill Component
function DealsCountBadge({ count, onClick }) {
  const cnt = count || 0;
  const isMultiple = cnt > 1;

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6,
        background: isMultiple ? 'rgba(16, 185, 129, 0.12)' : 'rgba(0, 0, 0, 0.04)',
        color: isMultiple ? '#059669' : 'var(--text-muted)',
        border: `1px solid ${isMultiple ? 'rgba(16, 185, 129, 0.3)' : 'var(--border)'}`,
        fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s ease'
      }}
      title={`${cnt} linked Telegram deal post${cnt === 1 ? '' : 's'} (Click to view)`}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>local_offer</span>
      <span>{cnt}</span>
      {isMultiple && <span style={{ fontSize: '0.65rem', background: '#10b981', color: '#fff', borderRadius: 4, padding: '0 3px' }}>Multi</span>}
    </button>
  );
}

// Scrape Status Pill Component
function ScrapeStatusPill({ p, onClick }) {
  const isFlagged = p.isFlagged;
  const isNeedsEnrichment = p.needsEnrichment;
  const src = p.priceSource || 'scraped';

  let label = '200 Scraped';
  let color = '#059669';
  let bg = 'rgba(16, 185, 129, 0.1)';
  let border = 'rgba(16, 185, 129, 0.25)';
  let icon = 'check_circle';

  if (isFlagged) {
    label = 'Flagged Issue';
    color = '#dc2626';
    bg = 'rgba(239, 68, 68, 0.1)';
    border = 'rgba(239, 68, 68, 0.25)';
    icon = 'flag';
  } else if (isNeedsEnrichment) {
    label = 'Needs Scrape';
    color = '#d97706';
    bg = 'rgba(245, 158, 11, 0.1)';
    border = 'rgba(245, 158, 11, 0.25)';
    icon = 'pending';
  } else if (src === 'ai_text') {
    label = 'AI Text';
    color = '#2563eb';
    bg = 'rgba(37, 99, 235, 0.1)';
    border = 'rgba(37, 99, 235, 0.25)';
    icon = 'psychology';
  } else if (src === 'price_history') {
    label = 'History Mode';
    color = '#7c3aed';
    bg = 'rgba(124, 58, 237, 0.1)';
    border = 'rgba(124, 58, 237, 0.25)';
    icon = 'history';
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6,
        background: bg, color: color, border: `1px solid ${border}`,
        fontSize: '0.73rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s ease', whiteSpace: 'nowrap'
      }}
      title="Click to view scrape verification logs & audit history"
    >
      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{icon}</span>
      {label}
    </button>
  );
}

// Unified Price & MRP Cell
function PriceAndMrpCell({ p }) {
  const price = p.price ?? p.currentPrice;
  const mrp = p.originalPrice;
  if (price == null && mrp == null) return <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>N/A</span>;

  const hasMrp = mrp && mrp > price;
  const discount = hasMrp ? Math.round(((mrp - price) / mrp) * 100) : null;
  const src = p.priceSource && PRICE_SOURCE_META[p.priceSource];

  return (
    <div style={{ minWidth: 105 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--text-main)', letterSpacing: '-0.2px' }}>
          {price != null ? formatCurrency(price, p.country) : '—'}
        </span>
        {hasMrp && (
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
            {formatCurrency(mrp, p.country)}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
        {discount != null && discount > 0 && (
          <span style={{
            fontSize: '0.66rem', fontWeight: 800, padding: '1px 5px', borderRadius: 4,
            background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            {discount}% OFF
          </span>
        )}
        {src && (
          <span
            title={`${src.label} — ${src.hint}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 2,
              fontSize: '0.64rem', fontWeight: 600, padding: '1px 5px', borderRadius: 4,
              background: src.bg, color: src.color
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 10 }}>{src.icon}</span>
            {src.label}
          </span>
        )}
      </div>
    </div>
  );
}

// Unified Deals & Rating Cell
function DealsAndRatingCell({ p, onDealsClick }) {
  const cnt = p.dealsCount || 0;
  const isMultiple = cnt > 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 85 }} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={onDealsClick}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 6,
          background: isMultiple ? 'rgba(16, 185, 129, 0.12)' : 'rgba(0, 0, 0, 0.04)',
          color: isMultiple ? '#059669' : 'var(--text-muted)',
          border: `1px solid ${isMultiple ? 'rgba(16, 185, 129, 0.3)' : 'var(--border)'}`,
          fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s ease',
          width: 'fit-content'
        }}
        title={`${cnt} linked Telegram deal post${cnt === 1 ? '' : 's'} (Click to view)`}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>local_offer</span>
        <span>{cnt}</span>
        {isMultiple && <span style={{ fontSize: '0.62rem', background: '#10b981', color: '#fff', borderRadius: 3, padding: '0 3px' }}>Multi</span>}
      </button>

      {p.rating ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.74rem', fontWeight: 700, color: '#f59e0b' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 12, fontVariationSettings: "'FILL' 1" }}>star</span>
          <span>{Number(p.rating).toFixed(1)}</span>
        </div>
      ) : (
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>—</span>
      )}
    </div>
  );
}

// Unified Category & Subcategory Cell
function CategoryAndSubcategoryCell({ p, subcategoryMeta }) {
  const catColor = categoryColor(p.category);
  const subLabel = subcategoryMeta[p.subcategory]?.label || p.subcategory;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 110 }}>
      <span
        className="badge-cat"
        style={{
          background: catColor.bg,
          color: catColor.fg,
          border: `1px solid ${catColor.border}`,
          fontSize: '0.72rem',
          padding: '2px 7px',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          width: 'fit-content'
        }}
      >
        {p.category || 'general'}
      </span>
      {subLabel ? (
        <span
          style={{
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 130
          }}
          title={subLabel}
        >
          {subLabel}
        </span>
      ) : null}
    </div>
  );
}

// Unified Scrape Health & Audit Cell
function ScrapeAuditCell({ p, onOpenModal }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }} onClick={(e) => e.stopPropagation()}>
      <ScrapeStatusPill p={p} onClick={onOpenModal} />
      <button
        onClick={onOpenModal}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 4,
          background: 'rgba(245, 158, 11, 0.08)', color: '#b45309', border: '1px solid rgba(245, 158, 11, 0.2)',
          fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', width: 'fit-content', whiteSpace: 'nowrap'
        }}
        title={`${p.priceHistoryCount || 1} checkpoints recorded. Click to view history.`}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 11 }}>update</span>
        <span>{p.priceHistoryCount ? `${p.priceHistoryCount} runs` : '1 run'}</span>
      </button>
    </div>
  );
}

// Unified Product Info Cell (Thumbnail + 2-line title + PID/ASIN + Store link)
function ProductInfoCell({ p, onShowToast }) {
  const imgUrl = p.imageUrl || (p.images && p.images[0]);
  const merchant = p.merchant || 'Amazon';

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 280, maxWidth: 360 }}>
      {/* Thumbnail */}
      <div style={{
        width: 44, height: 44, minWidth: 44, borderRadius: 8, background: '#ffffff',
        border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', overflow: 'hidden', padding: 3, position: 'relative',
        flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        {imgUrl ? (
          <img src={imgUrl} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--text-muted)', opacity: 0.4 }}>image_not_supported</span>
        )}
        {p.imageIsFromDeal && (
          <span style={{
            position: 'absolute', bottom: 0, right: 0, width: 14, height: 14,
            background: '#f59e0b', borderRadius: '4px 0 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
          }} title="Telegram Deal Photo Fallback">
            <span className="material-symbols-outlined" style={{ fontSize: 9 }}>send</span>
          </span>
        )}
      </div>

      {/* Details */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: '0.86rem',
            color: 'var(--text-main)',
            lineHeight: 1.35,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }}
          title={p.title}
        >
          {p.title || 'Untitled Product'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
          <span className={`merchant-badge merchant-${merchant.toLowerCase()}`} style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
            {merchant}
          </span>

          {p.productId && (
            <span style={{
              fontFamily: 'monospace',
              fontSize: '0.72rem',
              fontWeight: 600,
              background: 'rgba(0,0,0,0.03)',
              padding: '1px 5px',
              borderRadius: 4,
              border: '1px solid var(--border)',
              color: 'var(--text-muted)'
            }}>
              {p.productId}
            </span>
          )}

          <button
            onClick={() => {
              navigator.clipboard.writeText(p.productId || p._id);
              onShowToast('Copied Product ID');
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 1 }}
            title="Copy Product ID"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>content_copy</span>
          </button>

          {p.cleanUrl && (
            <a
              href={p.cleanUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', padding: 1 }}
              title="Open Store Link"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>open_in_new</span>
            </a>
          )}

          {p.isFlagged && (
            <span style={{
              fontSize: '0.66rem', fontWeight: 700, padding: '1px 5px', borderRadius: 4,
              background: 'var(--danger)', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 2
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 9 }}>flag</span> FLAGGED
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [productsPage, setProductsPage] = useState(1);
  const [productsTotalPages, setProductsTotalPages] = useState(1);
  const [productsTotalCount, setProductsTotalCount] = useState(0);
  const [productsLimit, setProductsLimit] = useState(15);
  const [loading, setLoading] = useState(true);

  const [masterStores, setMasterStores] = useState([]);

  // Filters State
  const [productsSearch, setProductsSearch] = useState('');
  const [productsMerchant, setProductsMerchant] = useState('all');
  const [productsCategory, setProductsCategory] = useState('all');
  const [productsSubcategory, setProductsSubcategory] = useState('all');
  const [productsCountry, setProductsCountry] = useState('all');
  const [productsSort, setProductsSort] = useState('recently_checked');
  const [productsFlagged, setProductsFlagged] = useState('all');

  // Advanced Admin Filters
  const [dealsFilter, setDealsFilter] = useState('all'); // 'all' | 'multiple' | 'single' | 'zero'
  const [minDiscount, setMinDiscount] = useState('all'); // 'all' | '30' | '50' | '70'
  const [priceSource, setPriceSource] = useState('all'); // 'all' | 'scraped' | 'ai_text' | 'price_history'
  const [imageStatus, setImageStatus] = useState('all'); // 'all' | 'missing' | 'has_image'
  const [minRating, setMinRating] = useState('all'); // 'all' | '4' | '3'
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (productsCategory !== 'all') count++;
    if (productsSubcategory !== 'all') count++;
    if (productsCountry !== 'all') count++;
    if (productsFlagged !== 'all') count++;
    if (dealsFilter !== 'all') count++;
    if (minDiscount !== 'all') count++;
    if (priceSource !== 'all') count++;
    if (imageStatus !== 'all') count++;
    if (minRating !== 'all') count++;
    return count;
  }, [productsCategory, productsSubcategory, productsCountry, productsFlagged, dealsFilter, minDiscount, priceSource, imageStatus, minRating]);

  // Selection & UI Mode
  const [productsSelectedIds, setProductsSelectedIds] = useState([]);
  const [drawerProduct, setDrawerProduct] = useState(null);
  const [drawerInitialTab, setDrawerInitialTab] = useState('overview');
  const [historyProductId, setHistoryProductId] = useState(null);
  const [flagModalProduct, setFlagModalProduct] = useState(null);
  const [scrapeModalProduct, setScrapeModalProduct] = useState(null);
  const [flaggedCount, setFlaggedCount] = useState(0);

  // Column Sort
  const [sortField, setSortField] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Taxonomy & Base
  const [knownCategories, setKnownCategories] = useState([]);
  const [subcategoryMeta, setSubcategoryMeta] = useState({});
  const [apiBase, setApiBase] = useState(process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:3001');
  const adminApiKey = process.env.NEXT_PUBLIC_ADMIN_API_KEY || '';
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg, duration = 3000) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), duration);
  };

  useEffect(() => {
  }, []);

  const apiFetch = useCallback(async (endpoint, options = {}) => {
    const base = apiBase.replace(/\/+$/, '');
    const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;
    const headers = { ...(options.headers || {}), ...(adminApiKey ? { 'x-admin-key': adminApiKey } : {}) };
    return fetch(url, { ...options, headers });
  }, [apiBase, adminApiKey]);

  // Fetch Master Stores from /api/master/store
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/master/store');
        if (!res.ok) throw new Error('Failed to fetch stores master');
        const data = await res.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setMasterStores(data.data.filter(s => s.isActive !== false));
        } else {
          setMasterStores([
            { value: 'amazon', label: 'Amazon' },
            { value: 'flipkart', label: 'Flipkart' }
          ]);
        }
      } catch (err) {
        console.error('Fetch master stores error:', err);
        setMasterStores([
          { value: 'amazon', label: 'Amazon' },
          { value: 'flipkart', label: 'Flipkart' }
        ]);
      }
    })();
  }, [apiFetch]);

  // Fetch Subcategories taxonomy
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/master/subcategory');
        if (!res.ok) return;
        const data = await res.json();
        const meta = {};
        (data.data || []).forEach((s) => {
          meta[s.value] = { label: s.label, parentCategory: s.metadata?.parentCategory || null };
        });
        setSubcategoryMeta(meta);
      } catch (err) {
        console.error('Fetch subcategory taxonomy error:', err);
      }
    })();
  }, [apiFetch]);

  // Fetch Products with all active admin filters
  const fetchProducts = useCallback(async (page = 1) => {
    setLoading(true);
    setProductsPage(page);
    const params = new URLSearchParams({
      page,
      limit: productsLimit,
      q: productsSearch,
      merchant: productsMerchant,
      category: productsCategory,
      subcategory: productsSubcategory,
      country: productsCountry,
      sort: productsSort
    });

    if (productsFlagged !== 'all') params.set('flagged', productsFlagged);
    if (dealsFilter !== 'all') params.set('dealsFilter', dealsFilter);
    if (minDiscount !== 'all') params.set('minDiscount', minDiscount);
    if (priceSource !== 'all') params.set('priceSource', priceSource);
    if (imageStatus !== 'all') params.set('imageStatus', imageStatus);
    if (minRating !== 'all') params.set('minRating', minRating);

    try {
      const res = await apiFetch(`/api/products?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      const list = data.data || data.products || [];
      setProducts(list);
      setProductsTotalPages(data.pagination?.pages || 1);
      setProductsTotalCount(data.pagination?.total || 0);
      setKnownCategories(prev => {
        const merged = new Set(prev);
        list.forEach(p => { if (p.category) merged.add(p.category); });
        return Array.from(merged).sort();
      });
    } catch (err) {
      console.error('Fetch products error:', err);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, productsSearch, productsMerchant, productsCategory, productsSubcategory, productsCountry, productsSort, productsFlagged, dealsFilter, minDiscount, priceSource, imageStatus, minRating, productsLimit]);

  // Fetch Flagged Count
  const fetchFlaggedCount = useCallback(async () => {
    try {
      const res = await apiFetch('/api/products?flagged=true&limit=1');
      if (!res.ok) return;
      const data = await res.json();
      setFlaggedCount(data.pagination?.total || 0);
    } catch (err) {
      console.error('Fetch flagged count error:', err);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchProducts(1);
  }, [fetchProducts]);

  useEffect(() => {
    fetchFlaggedCount();
  }, [fetchFlaggedCount]);

  const handleCategoryFilterChange = (value) => {
    setProductsCategory(value);
    setProductsSubcategory('all');
  };

  const handleResetFilters = () => {
    setProductsSearch('');
    setProductsMerchant('all');
    setProductsCategory('all');
    setProductsSubcategory('all');
    setProductsCountry('all');
    setProductsFlagged('all');
    setDealsFilter('all');
    setMinDiscount('all');
    setPriceSource('all');
    setImageStatus('all');
    setMinRating('all');
    setProductsSort('recently_checked');
  };

  const hasActiveFilters = productsSearch || productsMerchant !== 'all' || productsCategory !== 'all' || productsSubcategory !== 'all' || productsCountry !== 'all' || productsFlagged !== 'all' || dealsFilter !== 'all' || minDiscount !== 'all' || priceSource !== 'all' || imageStatus !== 'all' || minRating !== 'all' || productsSort !== 'recently_checked';

  // Bulk Delete
  const handleBulkDeleteProducts = useCallback(async () => {
    if (productsSelectedIds.length === 0) return;
    if (!confirm(`Permanently delete ${productsSelectedIds.length} selected product(s)? Any associated deals will also be removed.`)) return;
    try {
      const res = await apiFetch(`/api/products/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: productsSelectedIds })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete products');
      showToast(`Deleted ${productsSelectedIds.length} products`);
      setProductsSelectedIds([]);
      fetchProducts(productsPage);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }, [apiFetch, fetchProducts, productsPage, productsSelectedIds]);

  // Single Delete
  const handleDeleteProduct = useCallback(async (productId) => {
    if (!confirm('Permanently delete this product? Any associated deals will also be removed.')) return;
    try {
      const res = await apiFetch(`/api/products/${productId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete product');
      showToast('Product deleted');
      if (drawerProduct && drawerProduct._id === productId) setDrawerProduct(null);
      fetchProducts(productsPage);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }, [apiFetch, fetchProducts, productsPage, drawerProduct]);

  // Flag callback
  const handleFlagSaved = useCallback((updatedProduct) => {
    if (productsFlagged !== 'all') {
      fetchProducts(productsPage);
    } else {
      setProducts(prev => prev.map(p => (p._id === updatedProduct._id
        ? { ...p, isFlagged: updatedProduct.isFlagged, flagReason: updatedProduct.flagReason, flaggedAt: updatedProduct.flaggedAt }
        : p)));
    }
    if (drawerProduct && drawerProduct._id === updatedProduct._id) {
      setDrawerProduct(prev => ({ ...prev, isFlagged: updatedProduct.isFlagged, flagReason: updatedProduct.flagReason }));
    }
    fetchFlaggedCount();
    showToast(updatedProduct.isFlagged ? 'Product flagged' : 'Product unflagged');
  }, [productsFlagged, fetchProducts, productsPage, fetchFlaggedCount, drawerProduct]);

  // Column Sort
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return <span className="material-symbols-outlined" style={{ fontSize: 15, marginLeft: 4, opacity: 0.35 }}>unfold_more</span>;
    }
    return sortOrder === 'asc' ? (
      <span className="material-symbols-outlined" style={{ fontSize: 15, marginLeft: 4, color: 'var(--accent)' }}>arrow_upward</span>
    ) : (
      <span className="material-symbols-outlined" style={{ fontSize: 15, marginLeft: 4, color: 'var(--accent)' }}>arrow_downward</span>
    );
  };

  const subcategoryFilterOptions = useMemo(() => {
    const entries = Object.entries(subcategoryMeta);
    if (productsCategory !== 'all') {
      return entries
        .filter(([, meta]) => meta.parentCategory === productsCategory)
        .map(([value, meta]) => ({ value, label: meta.label }))
        .sort((a, b) => a.label.localeCompare(b.label));
    }
    const byCategory = {};
    entries.forEach(([value, meta]) => {
      const cat = meta.parentCategory || 'other';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push({ value, label: meta.label });
    });
    Object.values(byCategory).forEach((list) => list.sort((a, b) => a.label.localeCompare(b.label)));
    return byCategory;
  }, [subcategoryMeta, productsCategory]);

  const sortedProducts = useMemo(() => {
    if (!sortField) return products;
    return [...products].sort((a, b) => {
      let aVal, bVal;
      if (sortField === 'price') {
        aVal = parseFloat(a.price || a.currentPrice || 0);
        bVal = parseFloat(b.price || b.currentPrice || 0);
      } else if (sortField === 'originalPrice') {
        aVal = parseFloat(a.originalPrice || 0);
        bVal = parseFloat(b.originalPrice || 0);
      } else if (sortField === 'rating') {
        aVal = parseFloat(a.rating || 0);
        bVal = parseFloat(b.rating || 0);
      } else if (sortField === 'dealsCount') {
        aVal = a.dealsCount || 0;
        bVal = b.dealsCount || 0;
      } else if (sortField === 'subcategory') {
        aVal = (subcategoryMeta[a.subcategory]?.label || a.subcategory || '').toLowerCase();
        bVal = (subcategoryMeta[b.subcategory]?.label || b.subcategory || '').toLowerCase();
      } else if (sortField === 'createdAt') {
        aVal = new Date(a.createdAt || 0).getTime();
        bVal = new Date(b.createdAt || 0).getTime();
      } else if (sortField === 'lastChecked' || sortField === 'updatedAt') {
        aVal = new Date(a.lastChecked || a.updatedAt || a.lastCheckedAt || 0).getTime();
        bVal = new Date(b.lastChecked || b.updatedAt || b.lastCheckedAt || 0).getTime();
      } else if (sortField === 'priceHistoryCount') {
        aVal = a.priceHistoryCount || (a.priceHistory ? a.priceHistory.length : 0);
        bVal = b.priceHistoryCount || (b.priceHistory ? b.priceHistory.length : 0);
      } else if (sortField === 'merchant') {
        aVal = (a.merchant || 'Amazon').toLowerCase();
        bVal = (b.merchant || 'Amazon').toLowerCase();
      } else {
        aVal = (a[sortField] || '').toString().toLowerCase();
        bVal = (b[sortField] || '').toString().toLowerCase();
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [products, sortField, sortOrder, subcategoryMeta]);

  const handleExportCSV = () => {
    if (products.length === 0) return;
    const headers = ['PID', 'Title', 'Store', 'Category', 'Subcategory', 'Price', 'MRP', 'DealsCount', 'Rating', 'CleanURL', 'Country'];
    const rows = products.map(p => [
      `"${p.productId || p._id}"`,
      `"${(p.title || '').replace(/"/g, '""')}"`,
      `"${p.merchant || 'Amazon'}"`,
      `"${p.category || 'general'}"`,
      `"${subcategoryMeta[p.subcategory]?.label || p.subcategory || ''}"`,
      p.price || p.currentPrice || 0,
      p.originalPrice || '',
      p.dealsCount || 0,
      p.rating || '',
      `"${p.cleanUrl || ''}"`,
      `"${p.country || 'IN'}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('
');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `products_catalog_page_${productsPage}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported products to CSV');
  };

  const startIdx = products.length > 0 ? (productsPage - 1) * productsLimit + 1 : 0;
  const endIdx = Math.min(productsPage * productsLimit, productsTotalCount);

  return (
    <AdminShell title="Products Catalog">
      <section className="view-section active-view" style={{ position: 'relative' }}>
        
        {/* Floating Toast Notification */}
        {toastMessage && (
          <div style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(12px)',
            color: '#fff',
            padding: '10px 18px',
            borderRadius: 10,
            boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: '0.88rem',
            fontWeight: 600,
            zIndex: 9999,
            animation: 'fadeIn 0.2s ease',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#34d399' }}>check_circle</span>
            {toastMessage}
          </div>
        )}

        {/* Header Context Bar & Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Products Catalog
              </h3>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '2px 10px',
                borderRadius: 12,
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#059669'
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
                {productsTotalCount.toLocaleString()} Tracked
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Multi-store product database with live scraping metadata, deal frequency, price history, and categorization.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleExportCSV}
              className="btn"
              style={{
                background: 'rgba(0, 0, 0, 0.04)',
                color: 'var(--text-main)',
                border: '1px solid var(--border)',
                padding: '7px 14px',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                borderRadius: 8,
                cursor: 'pointer'
              }}
              title="Export filtered products to CSV"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
              Export CSV
            </button>
            
            <button
              className="btn btn-primary"
              style={{
                padding: '7px 18px',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                borderRadius: 8,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
              onClick={() => fetchProducts(productsPage)}
              disabled={loading}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18, animation: loading ? 'spin 1s linear infinite' : 'none' }}>
                {loading ? 'progress_activity' : 'refresh'}
              </span>
              Refresh
            </button>
          </div>
        </div>

        {/* Summary Health Cards with Top Accent Line */}
        <div className="grid-cards" style={{ marginBottom: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {/* Total Catalog */}
          <div className="card glass crm-stat-card" style={{ borderTop: '3px solid #818cf8', cursor: 'pointer' }} onClick={handleResetFilters}>
            <div className="crm-stat-icon" style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>
              <span className="material-symbols-outlined">inventory_2</span>
            </div>
            <div className="crm-stat-value">{productsTotalCount.toLocaleString()}</div>
            <div className="crm-stat-label">Total Catalog Products</div>
            <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: -4 }}>
              Active across all stores
            </span>
          </div>

          {/* Quick Filter: Multiple Deals */}
          <div
            className="card glass crm-stat-card"
            style={{ borderTop: '3px solid #10b981', cursor: 'pointer' }}
            onClick={() => setDealsFilter(dealsFilter === 'multiple' ? 'all' : 'multiple')}
          >
            <div className="crm-stat-icon" style={{ background: 'rgba(16,185,129,0.12)', color: '#059669' }}>
              <span className="material-symbols-outlined">local_offer</span>
            </div>
            <div className="crm-stat-value" style={{ color: '#059669' }}>Multiple Deals</div>
            <div className="crm-stat-label">Recurring Drops (&gt;1 Deals)</div>
            <span style={{ fontSize: '0.73rem', fontWeight: 600, color: dealsFilter === 'multiple' ? '#059669' : 'var(--text-muted)', marginTop: -4 }}>
              {dealsFilter === 'multiple' ? '● Filtering multiple deals only' : 'Click to isolate multiple deals'}
            </span>
          </div>

          {/* Flagged Products */}
          <div
            className="card glass crm-stat-card"
            style={{ borderTop: '3px solid #ef4444', cursor: 'pointer' }}
            onClick={() => setProductsFlagged(productsFlagged === 'true' ? 'all' : 'true')}
          >
            <div className="crm-stat-icon" style={{ background: 'rgba(239,68,68,0.12)', color: '#dc2626' }}>
              <span className="material-symbols-outlined">flag</span>
            </div>
            <div className="crm-stat-value" style={{ color: flaggedCount > 0 ? '#dc2626' : 'var(--text-main)' }}>
              {flaggedCount}
            </div>
            <div className="crm-stat-label">Flagged Issues</div>
            <span style={{ fontSize: '0.73rem', fontWeight: 600, color: productsFlagged === 'true' ? '#dc2626' : 'var(--text-muted)', marginTop: -4 }}>
              {productsFlagged === 'true' ? '● Filtering flagged only' : 'Click to isolate flagged'}
            </span>
          </div>

          {/* Stores Configured */}
          <div
            className="card glass crm-stat-card"
            style={{ borderTop: '3px solid #f59e0b', cursor: 'pointer' }}
            onClick={() => setProductsMerchant('all')}
          >
            <div className="crm-stat-icon" style={{ background: 'rgba(245,158,11,0.12)', color: '#d97706' }}>
              <span className="material-symbols-outlined">storefront</span>
            </div>
            <div className="crm-stat-value" style={{ color: '#d97706' }}>
              {masterStores.length} Stores
            </div>
            <div className="crm-stat-label">Registered Marketplaces</div>
            <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: -4 }}>
              Amazon, Flipkart, Myntra &amp; more
            </span>
          </div>
        </div>

        {/* Quick Preset Filter Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.2rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Quick Presets:
          </span>

          <button
            onClick={handleResetFilters}
            style={{
              padding: '4px 11px', borderRadius: 20, fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
              background: !hasActiveFilters ? 'var(--accent)' : 'rgba(0,0,0,0.04)',
              color: !hasActiveFilters ? '#fff' : 'var(--text-main)',
              border: `1px solid ${!hasActiveFilters ? 'var(--accent)' : 'var(--border)'}`,
              transition: 'all 0.15s ease'
            }}
          >
            All Products ({productsTotalCount.toLocaleString()})
          </button>

          <button
            onClick={() => setDealsFilter(dealsFilter === 'multiple' ? 'all' : 'multiple')}
            style={{
              padding: '4px 11px', borderRadius: 20, fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
              background: dealsFilter === 'multiple' ? '#059669' : 'rgba(16, 185, 129, 0.08)',
              color: dealsFilter === 'multiple' ? '#fff' : '#059669',
              border: `1px solid ${dealsFilter === 'multiple' ? '#059669' : 'rgba(16, 185, 129, 0.25)'}`,
              display: 'inline-flex', alignItems: 'center', gap: 4, transition: 'all 0.15s ease'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>local_offer</span>
            🔥 Multi-Deals (&gt;1)
          </button>

          <button
            onClick={() => setMinDiscount(minDiscount === '50' ? 'all' : '50')}
            style={{
              padding: '4px 11px', borderRadius: 20, fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
              background: minDiscount === '50' ? '#dc2626' : 'rgba(239, 68, 68, 0.08)',
              color: minDiscount === '50' ? '#fff' : '#dc2626',
              border: `1px solid ${minDiscount === '50' ? '#dc2626' : 'rgba(239, 68, 68, 0.25)'}`,
              display: 'inline-flex', alignItems: 'center', gap: 4, transition: 'all 0.15s ease'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>trending_down</span>
            ≥ 50% Steal Deals
          </button>

          <button
            onClick={() => setPriceSource(priceSource === 'scraped' ? 'all' : 'scraped')}
            style={{
              padding: '4px 11px', borderRadius: 20, fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
              background: priceSource === 'scraped' ? '#2563eb' : 'rgba(37, 99, 235, 0.08)',
              color: priceSource === 'scraped' ? '#fff' : '#2563eb',
              border: `1px solid ${priceSource === 'scraped' ? '#2563eb' : 'rgba(37, 99, 235, 0.25)'}`,
              display: 'inline-flex', alignItems: 'center', gap: 4, transition: 'all 0.15s ease'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>verified</span>
            Verified Scrapes
          </button>

          {flaggedCount > 0 && (
            <button
              onClick={() => setProductsFlagged(productsFlagged === 'true' ? 'all' : 'true')}
              style={{
                padding: '4px 11px', borderRadius: 20, fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
                background: productsFlagged === 'true' ? '#dc2626' : 'rgba(239, 68, 68, 0.08)',
                color: productsFlagged === 'true' ? '#fff' : '#dc2626',
                border: `1px solid ${productsFlagged === 'true' ? '#dc2626' : 'rgba(239, 68, 68, 0.25)'}`,
                display: 'inline-flex', alignItems: 'center', gap: 4, transition: 'all 0.15s ease'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>flag</span>
              Flagged ({flaggedCount})
            </button>
          )}
        </div>

        {/* Directory Table Card */}
        <div className="card glass" style={{ padding: 0, overflow: 'hidden' }}>
          
          {/* Primary Filter Toolbar */}
          <div style={{ padding: '1rem 1.4rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            
            {/* Left: Store Segmented Control */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 2, background: 'rgba(0,0,0,0.04)', padding: 3, borderRadius: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setProductsMerchant('all')}
                  style={{
                    padding: '5px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    background: productsMerchant === 'all' ? 'var(--bg-panel)' : 'transparent',
                    color: productsMerchant === 'all' ? 'var(--accent)' : 'var(--text-muted)',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    boxShadow: productsMerchant === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5
                  }}
                >
                  All Stores
                </button>

                {masterStores.map(st => {
                  const isAct = productsMerchant === st.value.toLowerCase();
                  return (
                    <button
                      key={st.value}
                      onClick={() => setProductsMerchant(st.value.toLowerCase())}
                      style={{
                        padding: '5px 10px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        background: isAct ? 'var(--bg-panel)' : 'transparent',
                        color: isAct ? 'var(--accent)' : 'var(--text-muted)',
                        border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer',
                        boxShadow: isAct ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5
                      }}
                    >
                      {st.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Search, Filter Toggle, Sort, Limit */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Search Box */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span className="material-symbols-outlined" style={{ position: 'absolute', left: 10, fontSize: 17, color: 'var(--text-muted)' }}>
                  search
                </span>
                <input
                  type="text"
                  className="filter-input"
                  placeholder="Search title, PID, ASIN..."
                  value={productsSearch}
                  onChange={(e) => setProductsSearch(e.target.value)}
                  style={{ width: 220, paddingLeft: 32, paddingRight: productsSearch ? 28 : 10, fontSize: '0.82rem', height: 34 }}
                />
                {productsSearch && (
                  <button
                    onClick={() => setProductsSearch('')}
                    style={{ position: 'absolute', right: 8, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>cancel</span>
                  </button>
                )}
              </div>

              {/* Sort By Select */}
              <select
                className="filter-select"
                value={productsSort}
                onChange={(e) => setProductsSort(e.target.value)}
                style={{ fontSize: '0.8rem', padding: '5px 8px', height: 34 }}
              >
                <option value="recently_checked">Latest Scraped</option>
                <option value="newest">First Added (Newest)</option>
                <option value="oldest">First Added (Oldest)</option>
                <option value="least_scraped">Least Recently Scraped</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
              </select>

              {/* Filters Toggle Button */}
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 11px',
                  borderRadius: 8,
                  height: 34,
                  background: showAdvancedFilters || activeFiltersCount > 0 ? 'rgba(37, 99, 235, 0.1)' : 'rgba(0, 0, 0, 0.04)',
                  color: showAdvancedFilters || activeFiltersCount > 0 ? 'var(--accent)' : 'var(--text-main)',
                  border: `1px solid ${showAdvancedFilters || activeFiltersCount > 0 ? 'rgba(37, 99, 235, 0.3)' : 'var(--border)'}`,
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>tune</span>
                <span>Filters</span>
                {activeFiltersCount > 0 && (
                  <span style={{ background: 'var(--accent)', color: '#fff', fontSize: '0.68rem', fontWeight: 700, borderRadius: 10, padding: '1px 6px', marginLeft: 2 }}>
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              {/* Page Limit */}
              <select
                className="filter-select"
                value={productsLimit}
                onChange={(e) => setProductsLimit(Number(e.target.value))}
                style={{ fontSize: '0.8rem', padding: '5px 8px', height: 34 }}
              >
                <option value={15}>15 / page</option>
                <option value={30}>30 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>
          </div>

          {/* Collapsible Secondary Filter Tray */}
          {showAdvancedFilters && (
            <div style={{
              padding: '0.85rem 1.4rem',
              borderBottom: '1px solid var(--border)',
              background: 'rgba(0,0,0,0.02)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              alignItems: 'center',
              animation: 'fadeIn 0.2s ease'
            }}>
              {/* Category */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)' }}>Category:</span>
                <select className="filter-select" value={productsCategory} onChange={(e) => handleCategoryFilterChange(e.target.value)} style={{ fontSize: '0.78rem' }}>
                  <option value="all">All Categories</option>
                  {knownCategories.map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>

              {/* Subcategory */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)' }}>Subcategory:</span>
                <select className="filter-select" value={productsSubcategory} onChange={(e) => setProductsSubcategory(e.target.value)} style={{ fontSize: '0.78rem' }}>
                  <option value="all">All Subcategories</option>
                  {productsCategory !== 'all'
                    ? subcategoryFilterOptions.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))
                    : Object.entries(subcategoryFilterOptions).map(([cat, subs]) => (
                        <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
                          {subs.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </optgroup>
                      ))}
                </select>
              </div>

              {/* Country */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)' }}>Country:</span>
                <select className="filter-select" value={productsCountry} onChange={(e) => setProductsCountry(e.target.value)} style={{ fontSize: '0.78rem' }}>
                  <option value="all">All Countries</option>
                  <option value="IN">🇮🇳 India (IN)</option>
                  <option value="US">🇺🇸 United States (US)</option>
                  <option value="UK">🇬🇧 United Kingdom (UK)</option>
                  <option value="CA">🇨🇦 Canada (CA)</option>
                  <option value="AU">🇦🇺 Australia (AU)</option>
                </select>
              </div>

              {/* Discount */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)' }}>Discount:</span>
                <select className="filter-select" value={minDiscount} onChange={(e) => setMinDiscount(e.target.value)} style={{ fontSize: '0.78rem' }}>
                  <option value="all">Any Discount</option>
                  <option value="30">≥ 30% OFF</option>
                  <option value="50">≥ 50% OFF</option>
                  <option value="70">≥ 70% Steal Deals</option>
                </select>
              </div>

              {/* Price Source */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)' }}>Source:</span>
                <select className="filter-select" value={priceSource} onChange={(e) => setPriceSource(e.target.value)} style={{ fontSize: '0.78rem' }}>
                  <option value="all">All Sources</option>
                  <option value="scraped">✅ Scraped (Verified)</option>
                  <option value="ai_text">🧠 AI Extracted</option>
                  <option value="price_history">📈 Price History</option>
                </select>
              </div>

              {/* Rating */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)' }}>Rating:</span>
                <select className="filter-select" value={minRating} onChange={(e) => setMinRating(e.target.value)} style={{ fontSize: '0.78rem' }}>
                  <option value="all">Any Rating</option>
                  <option value="4">★ 4.0 &amp; above</option>
                  <option value="3">★ 3.0 &amp; above</option>
                </select>
              </div>

              {/* Images */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)' }}>Images:</span>
                <select className="filter-select" value={imageStatus} onChange={(e) => setImageStatus(e.target.value)} style={{ fontSize: '0.78rem' }}>
                  <option value="all">All Images</option>
                  <option value="has_image">Has Image</option>
                  <option value="missing">⚠️ Missing Image</option>
                </select>
              </div>

              {/* Reset All */}
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  style={{
                    marginLeft: 'auto',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: 'rgba(239, 68, 68, 0.08)',
                    color: '#dc2626',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>clear_all</span>
                  Reset All
                </button>
              )}
            </div>
          )}

          {/* Table Body Area */}
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 36, animation: 'spin 1s linear infinite', color: 'var(--accent)' }}>
                  progress_activity
                </span>
                <p style={{ marginTop: 10, fontSize: '0.92rem', fontWeight: 600 }}>Loading catalog products...</p>
              </div>
            ) : sortedProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 28, opacity: 0.5 }}>
                    inventory_2
                  </span>
                </div>
                <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem' }}>
                  No products match active filters
                </p>
                <p style={{ margin: '6px 0 0', fontSize: '0.84rem' }}>
                  Try changing your deal filters, search terms, or clicking &ldquo;Reset All Filters&rdquo;.
                </p>
              </div>
            ) : (
              <table style={{ width: '100%', minWidth: 1320, borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ width: 40, padding: '12px 14px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        className="rounded border-border cursor-pointer"
                        checked={sortedProducts.length > 0 && productsSelectedIds.length === sortedProducts.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setProductsSelectedIds(sortedProducts.map(p => p._id));
                          } else {
                            setProductsSelectedIds([]);
                          }
                        }}
                      />
                    </th>

                    <th style={{ padding: '12px 14px', cursor: 'pointer', userSelect: 'none', fontWeight: 700, fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', minWidth: 320 }} onClick={() => handleSort('title')}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Product &amp; Store {renderSortIcon('title')}
                      </div>
                    </th>

                    {/* Category Column */}
                    <th style={{ width: 130, padding: '12px 14px', cursor: 'pointer', userSelect: 'none', fontWeight: 700, fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }} onClick={() => handleSort('category')}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Category {renderSortIcon('category')}
                      </div>
                    </th>

                    {/* Dedicated Price Column */}
                    <th style={{ width: 120, padding: '12px 14px', cursor: 'pointer', userSelect: 'none', fontWeight: 700, fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }} onClick={() => handleSort('price')}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Price &amp; MRP {renderSortIcon('price')}
                      </div>
                    </th>

                    {/* Linked Deals & Rating Column */}
                    <th style={{ width: 100, padding: '12px 14px', cursor: 'pointer', userSelect: 'none', fontWeight: 700, fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }} onClick={() => handleSort('dealsCount')}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Deals &amp; Rating {renderSortIcon('dealsCount')}
                      </div>
                    </th>

                    {/* First Added Column */}
                    <th style={{ width: 115, padding: '12px 14px', cursor: 'pointer', userSelect: 'none', fontWeight: 700, fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }} onClick={() => handleSort('createdAt')}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        First Added {renderSortIcon('createdAt')}
                      </div>
                    </th>

                    {/* Latest Scraped Column */}
                    <th style={{ width: 120, padding: '12px 14px', cursor: 'pointer', userSelect: 'none', fontWeight: 700, fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }} onClick={() => handleSort('lastChecked')}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Latest Scraped {renderSortIcon('lastChecked')}
                      </div>
                    </th>

                    {/* Scrape Frequency & Status */}
                    <th style={{ width: 140, padding: '12px 14px', cursor: 'pointer', userSelect: 'none', fontWeight: 700, fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }} onClick={() => handleSort('priceHistoryCount')}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Scrape Health {renderSortIcon('priceHistoryCount')}
                      </div>
                    </th>

                    {/* Country */}
                    <th style={{ width: 70, padding: '12px 14px', fontWeight: 700, fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                      Country
                    </th>

                    <th style={{ width: 100, padding: '12px 14px', textAlign: 'right', fontWeight: 700, fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {sortedProducts.map((p) => {
                    const isSelected = productsSelectedIds.includes(p._id);
                    const lastScrapedTime = p.lastChecked || p.updatedAt;
                    const isRecentScrape = lastScrapedTime && (Date.now() - new Date(lastScrapedTime).getTime()) < 3600000;
                    const isMediumScrape = lastScrapedTime && (Date.now() - new Date(lastScrapedTime).getTime()) < 86400000;

                    return (
                      <tr
                        key={p._id}
                        style={{
                          background: isSelected ? 'rgba(37, 99, 235, 0.04)' : p.isFlagged ? 'rgba(239, 68, 68, 0.035)' : undefined,
                          borderBottom: '1px solid var(--border)',
                          transition: 'background 0.15s ease',
                          cursor: 'pointer'
                        }}
                        onClick={() => { setDrawerInitialTab('overview'); setDrawerProduct(p); }}
                      >
                        {/* Checkbox */}
                        <td style={{ padding: '12px 14px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="rounded border-border cursor-pointer"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setProductsSelectedIds([...productsSelectedIds, p._id]);
                              } else {
                                setProductsSelectedIds(productsSelectedIds.filter(id => id !== p._id));
                              }
                            }}
                          />
                        </td>

                        {/* Product Thumbnail & Details */}
                        <td style={{ padding: '12px 14px' }}>
                          <ProductInfoCell p={p} onShowToast={showToast} />
                        </td>

                        {/* Category & Subcategory */}
                        <td style={{ padding: '12px 14px' }}>
                          <CategoryAndSubcategoryCell p={p} subcategoryMeta={subcategoryMeta} />
                        </td>

                        {/* Price & MRP */}
                        <td style={{ padding: '12px 14px' }}>
                          <PriceAndMrpCell p={p} />
                        </td>

                        {/* Deals & Rating */}
                        <td style={{ padding: '12px 14px' }}>
                          <DealsAndRatingCell
                            p={p}
                            onDealsClick={() => {
                              setDrawerInitialTab('deals');
                              setDrawerProduct(p);
                            }}
                          />
                        </td>

                        {/* First Added Column */}
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>
                            {formatTime(p.createdAt)}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {p.createdAt ? new Date(p.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </div>
                        </td>

                        {/* Latest Scraped Column */}
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: '50%',
                                display: 'inline-block',
                                background: isRecentScrape ? '#10b981' : isMediumScrape ? '#f59e0b' : '#94a3b8',
                                boxShadow: isRecentScrape ? '0 0 6px rgba(16, 185, 129, 0.6)' : 'none'
                              }}
                            />
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }} title={lastScrapedTime ? new Date(lastScrapedTime).toLocaleString() : 'Never'}>
                              {formatTime(lastScrapedTime)}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', paddingLeft: 13 }}>
                            {lastScrapedTime ? new Date(lastScrapedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </div>
                        </td>

                        {/* Scrape Frequency & Status */}
                        <td style={{ padding: '12px 14px' }}>
                          <ScrapeAuditCell p={p} onOpenModal={() => setScrapeModalProduct(p)} />
                        </td>

                        {/* Country */}
                        <td style={{ padding: '12px 14px', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {COUNTRY_FLAGS[p.country]?.flag || '🌐'} {p.country || 'IN'}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '12px 14px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                            <button
                              onClick={() => { setDrawerInitialTab('overview'); setDrawerProduct(p); }}
                              style={{
                                background: 'rgba(37, 99, 235, 0.08)',
                                color: 'var(--accent)',
                                border: '1px solid rgba(37, 99, 235, 0.2)',
                                cursor: 'pointer',
                                padding: '4px 8px',
                                borderRadius: 6,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: '0.76rem',
                                fontWeight: 600
                              }}
                              title="View details drawer"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>visibility</span>
                              View
                            </button>

                            <button
                              onClick={() => handleDeleteProduct(p._id)}
                              style={{
                                background: 'rgba(239,68,68,0.06)',
                                color: 'var(--danger)',
                                border: '1px solid rgba(239,68,68,0.2)',
                                cursor: 'pointer',
                                padding: '4px 8px',
                                borderRadius: 6,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: '0.76rem',
                                fontWeight: 600
                              }}
                              title="Delete product"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Floating Multi-Select Action Bar */}
          {productsSelectedIds.length > 0 && (
            <div style={{
              position: 'sticky',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'var(--bg-panel-solid)',
              borderTop: '1px solid var(--border)',
              padding: '12px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
              zIndex: 10
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {productsSelectedIds.length} product{productsSelectedIds.length > 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={() => setProductsSelectedIds([])}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Deselect all
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleBulkDeleteProducts}
                  className="btn"
                  style={{
                    background: 'var(--danger)',
                    color: '#fff',
                    border: 'none',
                    padding: '7px 16px',
                    borderRadius: 6,
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                  Delete Selected ({productsSelectedIds.length})
                </button>
              </div>
            </div>
          )}

          {/* Pagination Footer */}
          <div style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(0,0,0,0.015)',
            fontSize: '0.84rem',
            color: 'var(--text-muted)'
          }}>
            <div>
              Showing {startIdx} to {endIdx} of {productsTotalCount.toLocaleString()} products
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="page-btn"
                disabled={productsPage <= 1}
                onClick={() => fetchProducts(productsPage - 1)}
              >
                Previous
              </button>
              <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                Page {productsPage} of {productsTotalPages}
              </span>
              <button
                className="page-btn"
                disabled={productsPage >= productsTotalPages}
                onClick={() => fetchProducts(productsPage + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>

      </section>

      {/* Quick View Drawer */}
      {drawerProduct && (
        <ProductDrawer
          product={drawerProduct}
          initialTab={drawerInitialTab}
          allProducts={sortedProducts}
          subcategoryMeta={subcategoryMeta}
          apiBase={apiBase}
          onClose={() => setDrawerProduct(null)}
          onSelectProduct={(p) => setDrawerProduct(p)}
          onFlagClick={(p) => { setDrawerProduct(null); setFlagModalProduct(p); }}
          onHistoryClick={(id) => { setDrawerProduct(null); setHistoryProductId(id); }}
          onScrapeHistoryClick={(p) => { setDrawerProduct(null); setScrapeModalProduct(p); }}
          onDeleteClick={handleDeleteProduct}
          onCategoryClick={(cat) => { setDrawerProduct(null); handleCategoryFilterChange(cat); }}
          onMerchantClick={(m) => { setDrawerProduct(null); setProductsMerchant(m); }}
        />
      )}

      {/* Scrape History & Verification Modal */}
      {scrapeModalProduct && (
        <ScrapeHistoryModal
          product={scrapeModalProduct}
          apiBase={apiBase}
          onClose={() => setScrapeModalProduct(null)}
          onRefreshProduct={() => fetchProducts(productsPage)}
        />
      )}

      {/* Price History Modal */}
      {historyProductId && (
        <PriceHistoryModal
          productId={historyProductId}
          apiBase={apiBase}
          onClose={() => setHistoryProductId(null)}
        />
      )}

      {/* Flag Product Modal */}
      {flagModalProduct && (
        <FlagProductModal
          product={flagModalProduct}
          apiBase={apiBase}
          onClose={() => setFlagModalProduct(null)}
          onSaved={handleFlagSaved}
        />
      )}
    </AdminShell>
  );
}
