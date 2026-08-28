'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import AdminShell from '@/components/admin-shell';
import PriceHistoryModal from '@/components/price-history-modal';
import FlagProductModal from '@/components/flag-product-modal';
import ProductDrawer from '@/components/product-drawer';

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

function HistoryBadge({ count, onClick }) {
  if (!count) {
    return <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>;
  }
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6,
        background: 'rgba(37, 99, 235, 0.08)', color: '#2563eb', border: '1px solid rgba(37, 99, 235, 0.2)',
        fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s ease'
      }}
      title={`View ${count} price history point${count === 1 ? '' : 's'}`}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>show_chart</span>
      {count.toLocaleString('en-US')}
    </button>
  );
}

// Deals Count Pill Component
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

// Current / Deal Price Cell
function PriceCell({ p }) {
  const price = p.price ?? p.currentPrice;
  if (price == null) return <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>N/A</span>;

  const hasMrp = p.originalPrice && p.originalPrice > price;
  const discount = hasMrp ? Math.round(((p.originalPrice - price) / p.originalPrice) * 100) : null;
  const src = p.priceSource && PRICE_SOURCE_META[p.priceSource];

  return (
    <div style={{ minWidth: 100 }}>
      <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-main)' }}>
        {formatCurrency(price, p.country)}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
        {discount != null && discount > 0 && (
          <span style={{
            fontSize: '0.68rem', fontWeight: 800, padding: '1px 5px', borderRadius: 4,
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
              fontSize: '0.66rem', fontWeight: 600, padding: '1px 5px', borderRadius: 4,
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

// MRP Cell
function MrpCell({ p }) {
  const price = p.price ?? p.currentPrice;
  const mrp = p.originalPrice;

  if (!mrp) return <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>;

  const isDiscounted = mrp > price;

  return (
    <div style={{ minWidth: 80 }}>
      <span style={{
        fontSize: '0.84rem',
        fontWeight: isDiscounted ? 500 : 700,
        color: 'var(--text-muted)',
        textDecoration: isDiscounted ? 'line-through' : 'none',
        textDecorationColor: 'rgba(148, 163, 184, 0.6)'
      }}>
        {formatCurrency(mrp, p.country)}
      </span>
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

  // Selection & UI Mode
  const [productsSelectedIds, setProductsSelectedIds] = useState([]);
  const [drawerProduct, setDrawerProduct] = useState(null);
  const [drawerInitialTab, setDrawerInitialTab] = useState('overview');
  const [historyProductId, setHistoryProductId] = useState(null);
  const [flagModalProduct, setFlagModalProduct] = useState(null);
  const [flaggedCount, setFlaggedCount] = useState(0);

  // Column Sort
  const [sortField, setSortField] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Taxonomy & Base
  const [knownCategories, setKnownCategories] = useState([]);
  const [subcategoryMeta, setSubcategoryMeta] = useState({});
  const [apiBase, setApiBase] = useState(process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:3001');
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
    return fetch(url, options);
  }, [apiBase]);

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
      } else if (sortField === 'updatedAt') {
        aVal = new Date(a.updatedAt || a.lastCheckedAt || 0).getTime();
        bVal = new Date(b.updatedAt || b.lastCheckedAt || 0).getTime();
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
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
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
        <div className="grid-cards" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
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
              Amazon, Flipkart, Myntra & more
            </span>
          </div>
        </div>

        {/* Directory Table Card */}
        <div className="card glass" style={{ padding: 0, overflow: 'hidden' }}>
          
          {/* Table Filter Controls Header */}
          <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            
            {/* Left Title & Dynamic Master Stores Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontWeight: 700, color: 'var(--text-main)', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--accent)', fontSize: 20 }}>format_list_bulleted</span>
                Catalog Directory
              </h3>

              {/* Status & Store Tabs from Stores Master */}
              <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.04)', padding: 3, borderRadius: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setProductsMerchant('all')}
                  style={{
                    padding: '4px 11px',
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
                    gap: 6
                  }}
                >
                  All Stores
                  <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>({productsTotalCount})</span>
                </button>

                {masterStores.map(st => {
                  const isAct = productsMerchant === st.value.toLowerCase();
                  return (
                    <button
                      key={st.value}
                      onClick={() => setProductsMerchant(st.value.toLowerCase())}
                      style={{
                        padding: '4px 11px',
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
                        gap: 6
                      }}
                    >
                      {st.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Search Input */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
                  style={{ width: 230, paddingLeft: 32, paddingRight: productsSearch ? 28 : 12, fontSize: '0.85rem' }}
                />
                {productsSearch && (
                  <button
                    onClick={() => setProductsSearch('')}
                    style={{ position: 'absolute', right: 8, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>cancel</span>
                  </button>
                )}
              </div>

              {/* Rows per page */}
              <select
                className="filter-select"
                value={productsLimit}
                onChange={(e) => setProductsLimit(Number(e.target.value))}
                style={{ fontSize: '0.82rem', padding: '6px 8px' }}
              >
                <option value={15}>15 / page</option>
                <option value={30}>30 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>
          </div>

          {/* Primary Taxonomy Filters Bar */}
          <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.015)', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            {/* Store Select dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Store:</span>
              <select className="filter-select" value={productsMerchant} onChange={(e) => setProductsMerchant(e.target.value)}>
                <option value="all">All Stores</option>
                {masterStores.map(st => (
                  <option key={st.value} value={st.value.toLowerCase()}>{st.label}</option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Category:</span>
              <select className="filter-select" value={productsCategory} onChange={(e) => handleCategoryFilterChange(e.target.value)}>
                <option value="all">All Categories</option>
                {knownCategories.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Subcategory */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Subcategory:</span>
              <select className="filter-select" value={productsSubcategory} onChange={(e) => setProductsSubcategory(e.target.value)}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Country:</span>
              <select className="filter-select" value={productsCountry} onChange={(e) => setProductsCountry(e.target.value)}>
                <option value="all">All Countries</option>
                <option value="IN">🇮🇳 India (IN)</option>
                <option value="US">🇺🇸 United States (US)</option>
                <option value="UK">🇬🇧 United Kingdom (UK)</option>
                <option value="CA">🇨🇦 Canada (CA)</option>
                <option value="AU">🇦🇺 Australia (AU)</option>
              </select>
            </div>

            {/* Sort */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Sort:</span>
              <select className="filter-select" value={productsSort} onChange={(e) => setProductsSort(e.target.value)}>
                <option value="recently_checked">Recently Checked</option>
                <option value="newest">Newest First</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
              </select>
            </div>
          </div>

          {/* Advanced Admin Intelligence Filters Bar */}
          <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.025)', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            
            {/* Deals Density Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#10b981' }}>local_offer</span>
                Deals:
              </span>
              <select
                className="filter-select"
                value={dealsFilter}
                onChange={(e) => setDealsFilter(e.target.value)}
                style={{ fontWeight: dealsFilter !== 'all' ? 700 : 500, borderColor: dealsFilter !== 'all' ? 'var(--accent)' : 'var(--border)' }}
              >
                <option value="all">All Deals</option>
                <option value="multiple">🔥 Multiple Deals (&gt; 1)</option>
                <option value="single">Single Deal (1)</option>
                <option value="zero">Zero Deals (0)</option>
              </select>
            </div>

            {/* Minimum Discount Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Discount:</span>
              <select
                className="filter-select"
                value={minDiscount}
                onChange={(e) => setMinDiscount(e.target.value)}
                style={{ fontWeight: minDiscount !== 'all' ? 700 : 500 }}
              >
                <option value="all">Any Discount</option>
                <option value="30">≥ 30% OFF</option>
                <option value="50">≥ 50% OFF</option>
                <option value="70">≥ 70% Steal Deals</option>
              </select>
            </div>

            {/* Price Confidence / Source Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Source:</span>
              <select
                className="filter-select"
                value={priceSource}
                onChange={(e) => setPriceSource(e.target.value)}
                style={{ fontWeight: priceSource !== 'all' ? 700 : 500 }}
              >
                <option value="all">All Sources</option>
                <option value="scraped">✅ Scraped (Verified)</option>
                <option value="ai_text">🧠 AI Extracted</option>
                <option value="price_history">📈 Price History</option>
              </select>
            </div>

            {/* Image Health Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Images:</span>
              <select
                className="filter-select"
                value={imageStatus}
                onChange={(e) => setImageStatus(e.target.value)}
                style={{ fontWeight: imageStatus !== 'all' ? 700 : 500 }}
              >
                <option value="all">All Images</option>
                <option value="has_image">Has Image</option>
                <option value="missing">⚠️ Missing Image</option>
              </select>
            </div>

            {/* Rating Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Rating:</span>
              <select
                className="filter-select"
                value={minRating}
                onChange={(e) => setMinRating(e.target.value)}
                style={{ fontWeight: minRating !== 'all' ? 700 : 500 }}
              >
                <option value="all">Any Rating</option>
                <option value="4">★ 4.0 & above</option>
                <option value="3">★ 3.0 & above</option>
              </select>
            </div>

            {/* Flag Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Flag:</span>
              <select
                className="filter-select"
                value={productsFlagged}
                onChange={(e) => setProductsFlagged(e.target.value)}
                style={{ fontWeight: productsFlagged !== 'all' ? 700 : 500, color: productsFlagged === 'true' ? 'var(--danger)' : 'inherit' }}
              >
                <option value="all">All Records</option>
                <option value="true">🚩 Flagged Only</option>
                <option value="false">Clean Only</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>clear_all</span>
                Reset All Filters
              </button>
            )}
          </div>

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
              <table style={{ width: '100%', minWidth: 1360, borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ width: 44, padding: '12px 14px', textAlign: 'center' }}>
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

                    <th style={{ width: 64, padding: '12px 10px', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                      Item
                    </th>

                    <th style={{ padding: '12px 14px', cursor: 'pointer', userSelect: 'none', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', minWidth: 260 }} onClick={() => handleSort('title')}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Product & ASIN {renderSortIcon('title')}
                      </div>
                    </th>

                    <th style={{ width: 100, padding: '12px 14px', cursor: 'pointer', userSelect: 'none', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }} onClick={() => handleSort('merchant')}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Store {renderSortIcon('merchant')}
                      </div>
                    </th>

                    {/* Category Column */}
                    <th style={{ width: 110, padding: '12px 14px', cursor: 'pointer', userSelect: 'none', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }} onClick={() => handleSort('category')}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Category {renderSortIcon('category')}
                      </div>
                    </th>

                    {/* Subcategory Column */}
                    <th style={{ width: 130, padding: '12px 14px', cursor: 'pointer', userSelect: 'none', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }} onClick={() => handleSort('subcategory')}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Subcategory {renderSortIcon('subcategory')}
                      </div>
                    </th>

                    <th style={{ width: 95, padding: '12px 14px', cursor: 'pointer', userSelect: 'none', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }} onClick={() => handleSort('rating')}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Rating {renderSortIcon('rating')}
                      </div>
                    </th>

                    {/* Dedicated Price Column */}
                    <th style={{ width: 120, padding: '12px 14px', cursor: 'pointer', userSelect: 'none', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }} onClick={() => handleSort('price')}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Price {renderSortIcon('price')}
                      </div>
                    </th>

                    {/* Dedicated MRP Column */}
                    <th style={{ width: 95, padding: '12px 14px', cursor: 'pointer', userSelect: 'none', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }} onClick={() => handleSort('originalPrice')}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        MRP {renderSortIcon('originalPrice')}
                      </div>
                    </th>

                    {/* Linked Deals Count Column */}
                    <th style={{ width: 90, padding: '12px 14px', cursor: 'pointer', userSelect: 'none', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }} onClick={() => handleSort('dealsCount')}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Deals {renderSortIcon('dealsCount')}
                      </div>
                    </th>

                    <th style={{ width: 80, padding: '12px 14px', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                      History
                    </th>

                    <th style={{ width: 85, padding: '12px 14px', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                      Country
                    </th>

                    <th style={{ width: 110, padding: '12px 14px', cursor: 'pointer', userSelect: 'none', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }} onClick={() => handleSort('updatedAt')}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Last Checked {renderSortIcon('updatedAt')}
                      </div>
                    </th>

                    <th style={{ width: 130, padding: '12px 14px', textAlign: 'right', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {sortedProducts.map((p) => {
                    const isSelected = productsSelectedIds.includes(p._id);
                    const imgUrl = p.imageUrl || (p.images && p.images[0]);
                    const merchant = p.merchant || 'Amazon';
                    const catColor = categoryColor(p.category);
                    const subLabel = subcategoryMeta[p.subcategory]?.label || p.subcategory;

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

                        {/* Image Thumbnail */}
                        <td style={{ padding: '12px 10px' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{
                            width: 44, height: 44, borderRadius: 8, background: '#ffffff',
                            border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', overflow: 'hidden', padding: 4, position: 'relative'
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
                        </td>

                        {/* Title & Product ID */}
                        <td style={{ padding: '12px 14px', maxWidth: 300 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-main)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }} title={p.title}>
                            {p.title || 'Untitled Product'}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }} onClick={(e) => e.stopPropagation()}>
                            {p.productId && (
                              <span style={{
                                fontFamily: 'monospace',
                                fontSize: '0.74rem',
                                fontWeight: 600,
                                background: 'rgba(0,0,0,0.03)',
                                padding: '2px 6px',
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
                                showToast('Copied Product ID');
                              }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}
                              title="Copy Product ID"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>content_copy</span>
                            </button>

                            {p.cleanUrl && (
                              <a
                                href={p.cleanUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', padding: 2 }}
                                title="Open Store Link"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span>
                              </a>
                            )}

                            {p.isFlagged && (
                              <span style={{
                                fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                                background: 'var(--danger)', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 2
                              }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 10 }}>flag</span> FLAGGED
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Store Badge */}
                        <td style={{ padding: '12px 14px' }}>
                          <span className={`merchant-badge merchant-${merchant.toLowerCase()}`}>
                            {merchant}
                          </span>
                        </td>

                        {/* Category (Reduced font size) */}
                        <td style={{ padding: '12px 14px' }}>
                          <span
                            className="badge-cat"
                            style={{
                              background: catColor.bg,
                              color: catColor.fg,
                              border: `1px solid ${catColor.border}`,
                              fontSize: '0.72rem',
                              padding: '2px 7px',
                              fontWeight: 600,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {p.category || 'general'}
                          </span>
                        </td>

                        {/* Subcategory Column */}
                        <td style={{ padding: '12px 14px' }}>
                          {subLabel ? (
                            <span style={{
                              fontSize: '0.72rem',
                              padding: '2px 7px',
                              borderRadius: 6,
                              background: 'rgba(0,0,0,0.03)',
                              border: '1px solid var(--border)',
                              color: 'var(--text-muted)',
                              fontWeight: 500,
                              whiteSpace: 'nowrap',
                              display: 'inline-block'
                            }} title={subLabel}>
                              {subLabel}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>
                          )}
                        </td>

                        {/* Rating */}
                        <td style={{ padding: '12px 14px' }}>
                          <StarRating rating={p.rating} reviews={p.reviews} />
                        </td>

                        {/* Price (Current / Deal Price) */}
                        <td style={{ padding: '12px 14px' }}>
                          <PriceCell p={p} />
                        </td>

                        {/* MRP (Original / List Price) */}
                        <td style={{ padding: '12px 14px' }}>
                          <MrpCell p={p} />
                        </td>

                        {/* Deals Count Column */}
                        <td style={{ padding: '12px 14px' }} onClick={(e) => e.stopPropagation()}>
                          <DealsCountBadge
                            count={p.dealsCount}
                            onClick={() => {
                              setDrawerInitialTab('deals');
                              setDrawerProduct(p);
                            }}
                          />
                        </td>

                        {/* Price History */}
                        <td style={{ padding: '12px 14px' }} onClick={(e) => e.stopPropagation()}>
                          <HistoryBadge count={p.priceHistoryCount} onClick={() => setHistoryProductId(p._id)} />
                        </td>

                        {/* Country */}
                        <td style={{ padding: '12px 14px', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {COUNTRY_FLAGS[p.country]?.flag || '🌐'} {p.country || 'IN'}
                        </td>

                        {/* Last Checked */}
                        <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          <span title={p.updatedAt ? new Date(p.updatedAt).toLocaleString() : 'Never'}>
                            {formatTime(p.updatedAt || p.lastCheckedAt)}
                          </span>
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
                              Delete
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
          onDeleteClick={handleDeleteProduct}
          onCategoryClick={(cat) => { setDrawerProduct(null); handleCategoryFilterChange(cat); }}
          onMerchantClick={(m) => { setDrawerProduct(null); setProductsMerchant(m); }}
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
