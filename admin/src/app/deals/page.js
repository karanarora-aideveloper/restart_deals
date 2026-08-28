'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import AdminShell from '@/components/admin-shell';
import DealDrawer from '@/components/deal-drawer';

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

// Current / Deal Price Cell
function PriceCell({ d }) {
  const price = d.dealPrice || d.price;
  if (price == null) return <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>N/A</span>;

  const discount = d.discountPercentage;

  return (
    <div style={{ minWidth: 100 }}>
      <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-main)' }}>
        {formatCurrency(price, d.country)}
      </div>

      {discount != null && discount > 0 && (
        <div style={{ marginTop: 3 }}>
          <span style={{
            fontSize: '0.68rem', fontWeight: 800, padding: '1px 5px', borderRadius: 4,
            background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            {discount}% OFF
          </span>
        </div>
      )}
    </div>
  );
}

// MRP Cell
function MrpCell({ d }) {
  const mrp = d.originalPrice;
  const price = d.dealPrice || d.price;

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
        {formatCurrency(mrp, d.country)}
      </span>
    </div>
  );
}

export default function DealsPage() {
  const [deals, setDeals] = useState([]);
  const [dealsPage, setDealsPage] = useState(1);
  const [dealsTotalPages, setDealsTotalPages] = useState(1);
  const [dealsTotalCount, setDealsTotalCount] = useState(0);
  const [dealsLimit, setDealsLimit] = useState(15);
  const [loading, setLoading] = useState(true);

  // Master Stores List
  const [masterStores, setMasterStores] = useState([]);

  // Filters State
  const [dealsSearch, setDealsSearch] = useState('');
  const [dealsMerchant, setDealsMerchant] = useState('all');
  const [dealsCategory, setDealsCategory] = useState('all');
  const [dealsSubcategory, setDealsSubcategory] = useState('all');
  const [dealsCountry, setDealsCountry] = useState('all');
  const [dealsSort, setDealsSort] = useState('newest');
  const [minDiscount, setMinDiscount] = useState('all'); // 'all' | '30' | '50' | '70'
  const [hasCoupon, setHasCoupon] = useState('all'); // 'all' | 'true' | 'false'

  // Selection & UI Mode
  const [dealsSelectedIds, setDealsSelectedIds] = useState([]);
  const [drawerDeal, setDrawerDeal] = useState(null);

  // Column Sort
  const [sortField, setSortField] = useState('createdAt');
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

  // Fetch Master Stores
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

  // Fetch Deals
  const fetchDeals = useCallback(async (page = 1) => {
    setLoading(true);
    setDealsPage(page);
    const params = new URLSearchParams({
      page,
      limit: dealsLimit,
      q: dealsSearch,
      merchant: dealsMerchant,
      category: dealsCategory,
      subcategory: dealsSubcategory,
      country: dealsCountry,
      sort: dealsSort
    });

    if (minDiscount !== 'all') params.set('minDiscount', minDiscount);
    if (hasCoupon !== 'all') params.set('hasCoupon', hasCoupon);

    try {
      const res = await apiFetch(`/api/deals?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      const list = data.deals || data.data || [];
      setDeals(list);
      setDealsTotalPages(data.pagination?.pages || 1);
      setDealsTotalCount(data.pagination?.total || 0);
      setKnownCategories(prev => {
        const merged = new Set(prev);
        list.forEach(d => { if (d.category) merged.add(d.category); });
        return Array.from(merged).sort();
      });
    } catch (err) {
      console.error('Fetch deals error:', err);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, dealsSearch, dealsMerchant, dealsCategory, dealsSubcategory, dealsCountry, dealsSort, minDiscount, hasCoupon, dealsLimit]);

  useEffect(() => {
    fetchDeals(1);
  }, [fetchDeals]);

  const handleCategoryFilterChange = (value) => {
    setDealsCategory(value);
    setDealsSubcategory('all');
  };

  const handleResetFilters = () => {
    setDealsSearch('');
    setDealsMerchant('all');
    setDealsCategory('all');
    setDealsSubcategory('all');
    setDealsCountry('all');
    setMinDiscount('all');
    setHasCoupon('all');
    setDealsSort('newest');
  };

  const hasActiveFilters = dealsSearch || dealsMerchant !== 'all' || dealsCategory !== 'all' || dealsSubcategory !== 'all' || dealsCountry !== 'all' || minDiscount !== 'all' || hasCoupon !== 'all' || dealsSort !== 'newest';

  // Bulk Delete Deals
  const handleBulkDeleteDeals = useCallback(async () => {
    if (dealsSelectedIds.length === 0) return;
    if (!confirm(`Permanently delete ${dealsSelectedIds.length} selected deal(s)?`)) return;
    try {
      const res = await apiFetch(`/api/deals/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealIds: dealsSelectedIds })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete deals');
      showToast(`Deleted ${dealsSelectedIds.length} deals`);
      setDealsSelectedIds([]);
      fetchDeals(dealsPage);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }, [apiFetch, fetchDeals, dealsPage, dealsSelectedIds]);

  // Single Delete Deal
  const handleDeleteDeal = useCallback(async (dealId) => {
    if (!confirm('Permanently delete this deal post?')) return;
    try {
      const res = await apiFetch(`/api/deals/${dealId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete deal');
      showToast('Deal post deleted');
      if (drawerDeal && drawerDeal._id === dealId) setDrawerDeal(null);
      fetchDeals(dealsPage);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }, [apiFetch, fetchDeals, dealsPage, drawerDeal]);

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
    if (dealsCategory !== 'all') {
      return entries
        .filter(([, meta]) => meta.parentCategory === dealsCategory)
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
  }, [subcategoryMeta, dealsCategory]);

  const sortedDeals = useMemo(() => {
    if (!sortField) return deals;
    return [...deals].sort((a, b) => {
      let aVal, bVal;
      if (sortField === 'dealPrice') {
        aVal = parseFloat(a.dealPrice || a.price || 0);
        bVal = parseFloat(b.dealPrice || b.price || 0);
      } else if (sortField === 'originalPrice') {
        aVal = parseFloat(a.originalPrice || 0);
        bVal = parseFloat(b.originalPrice || 0);
      } else if (sortField === 'discountPercentage') {
        aVal = parseFloat(a.discountPercentage || 0);
        bVal = parseFloat(b.discountPercentage || 0);
      } else if (sortField === 'createdAt') {
        aVal = new Date(a.createdAt || 0).getTime();
        bVal = new Date(b.createdAt || 0).getTime();
      } else if (sortField === 'merchant') {
        aVal = (a.merchant || 'Amazon').toLowerCase();
        bVal = (b.merchant || 'Amazon').toLowerCase();
      } else if (sortField === 'subcategory') {
        aVal = (subcategoryMeta[a.subcategory]?.label || a.subcategory || '').toLowerCase();
        bVal = (subcategoryMeta[b.subcategory]?.label || b.subcategory || '').toLowerCase();
      } else {
        aVal = (a[sortField] || '').toString().toLowerCase();
        bVal = (b[sortField] || '').toString().toLowerCase();
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [deals, sortField, sortOrder, subcategoryMeta]);

  const handleExportCSV = () => {
    if (deals.length === 0) return;
    const headers = ['PID', 'Title', 'Store', 'Category', 'Subcategory', 'Price', 'MRP', 'Discount', 'Coupon', 'Channel', 'CleanURL', 'Country', 'CreatedAt'];
    const rows = deals.map(d => [
      `"${d.productId || d._id}"`,
      `"${(d.dealTitle || d.title || '').replace(/"/g, '""')}"`,
      `"${d.merchant || 'Amazon'}"`,
      `"${d.category || 'general'}"`,
      `"${subcategoryMeta[d.subcategory]?.label || d.subcategory || ''}"`,
      d.dealPrice || d.price || 0,
      d.originalPrice || '',
      d.discountPercentage ? `${d.discountPercentage}%` : '',
      `"${d.coupon?.label || d.coupon?.code || ''}"`,
      `"${d.sourceChannelName || ''}"`,
      `"${d.dealUrl || ''}"`,
      `"${d.country || 'IN'}"`,
      `"${d.createdAt || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `deals_feed_page_${dealsPage}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported deals to CSV');
  };

  const startIdx = deals.length > 0 ? (dealsPage - 1) * dealsLimit + 1 : 0;
  const endIdx = Math.min(dealsPage * dealsLimit, dealsTotalCount);

  return (
    <AdminShell title="Deals Feed">
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
                Deals Feed
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
                {dealsTotalCount.toLocaleString()} Live Deals
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Real-time multi-channel feed with discount intelligence, coupon vouchers, and store tracking.
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
              title="Export filtered deals to CSV"
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
              onClick={() => fetchDeals(dealsPage)}
              disabled={loading}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18, animation: loading ? 'spin 1s linear infinite' : 'none' }}>
                {loading ? 'progress_activity' : 'refresh'}
              </span>
              Refresh
            </button>
          </div>
        </div>

        {/* Summary Health KPI Cards */}
        <div className="grid-cards" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {/* Total Deals */}
          <div className="card glass crm-stat-card" style={{ borderTop: '3px solid #818cf8', cursor: 'pointer' }} onClick={handleResetFilters}>
            <div className="crm-stat-icon" style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>
              <span className="material-symbols-outlined">local_fire_department</span>
            </div>
            <div className="crm-stat-value">{dealsTotalCount.toLocaleString()}</div>
            <div className="crm-stat-label">Total Live Deals</div>
            <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: -4 }}>
              Across all monitored channels
            </span>
          </div>

          {/* Steal Deals Quick Filter */}
          <div
            className="card glass crm-stat-card"
            style={{ borderTop: '3px solid #10b981', cursor: 'pointer' }}
            onClick={() => setMinDiscount(minDiscount === '70' ? 'all' : '70')}
          >
            <div className="crm-stat-icon" style={{ background: 'rgba(16,185,129,0.12)', color: '#059669' }}>
              <span className="material-symbols-outlined">percent</span>
            </div>
            <div className="crm-stat-value" style={{ color: '#059669' }}>Steal Deals</div>
            <div className="crm-stat-label">High Discounts (≥ 70% OFF)</div>
            <span style={{ fontSize: '0.73rem', fontWeight: 600, color: minDiscount === '70' ? '#059669' : 'var(--text-muted)', marginTop: -4 }}>
              {minDiscount === '70' ? '● Filtering ≥ 70% deals' : 'Click to isolate steal deals'}
            </span>
          </div>

          {/* Coupons & Vouchers Filter */}
          <div
            className="card glass crm-stat-card"
            style={{ borderTop: '3px solid #ec4899', cursor: 'pointer' }}
            onClick={() => setHasCoupon(hasCoupon === 'true' ? 'all' : 'true')}
          >
            <div className="crm-stat-icon" style={{ background: 'rgba(236,72,153,0.12)', color: '#db2777' }}>
              <span className="material-symbols-outlined">confirmation_number</span>
            </div>
            <div className="crm-stat-value" style={{ color: '#db2777' }}>Vouchers</div>
            <div className="crm-stat-label">Coupon Code Deals</div>
            <span style={{ fontSize: '0.73rem', fontWeight: 600, color: hasCoupon === 'true' ? '#db2777' : 'var(--text-muted)', marginTop: -4 }}>
              {hasCoupon === 'true' ? '● Filtering coupon deals' : 'Click to isolate voucher deals'}
            </span>
          </div>

          {/* Stores Configured */}
          <div
            className="card glass crm-stat-card"
            style={{ borderTop: '3px solid #f59e0b', cursor: 'pointer' }}
            onClick={() => setDealsMerchant('all')}
          >
            <div className="crm-stat-icon" style={{ background: 'rgba(245,158,11,0.12)', color: '#d97706' }}>
              <span className="material-symbols-outlined">storefront</span>
            </div>
            <div className="crm-stat-value" style={{ color: '#d97706' }}>
              {masterStores.length} Stores
            </div>
            <div className="crm-stat-label">Marketplaces Streamed</div>
            <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: -4 }}>
              Amazon, Flipkart & more
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
                <span className="material-symbols-outlined" style={{ color: 'var(--accent)', fontSize: 20 }}>bolt</span>
                Live Deals Stream
              </h3>

              {/* Status & Store Tabs from Stores Master */}
              <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.04)', padding: 3, borderRadius: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setDealsMerchant('all')}
                  style={{
                    padding: '4px 11px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    background: dealsMerchant === 'all' ? 'var(--bg-panel)' : 'transparent',
                    color: dealsMerchant === 'all' ? 'var(--accent)' : 'var(--text-muted)',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    boxShadow: dealsMerchant === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  All Stores
                  <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>({dealsTotalCount})</span>
                </button>

                {masterStores.map(st => {
                  const isAct = dealsMerchant === st.value.toLowerCase();
                  return (
                    <button
                      key={st.value}
                      onClick={() => setDealsMerchant(st.value.toLowerCase())}
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
                  placeholder="Search deals, PID, channel..."
                  value={dealsSearch}
                  onChange={(e) => setDealsSearch(e.target.value)}
                  style={{ width: 230, paddingLeft: 32, paddingRight: dealsSearch ? 28 : 12, fontSize: '0.85rem' }}
                />
                {dealsSearch && (
                  <button
                    onClick={() => setDealsSearch('')}
                    style={{ position: 'absolute', right: 8, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>cancel</span>
                  </button>
                )}
              </div>

              {/* Rows per page */}
              <select
                className="filter-select"
                value={dealsLimit}
                onChange={(e) => setDealsLimit(Number(e.target.value))}
                style={{ fontSize: '0.82rem', padding: '6px 8px' }}
              >
                <option value={15}>15 / page</option>
                <option value={30}>30 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>
          </div>

          {/* Secondary Taxonomy & Intelligence Filters Bar */}
          <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.015)', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            
            {/* Store Select dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Store:</span>
              <select className="filter-select" value={dealsMerchant} onChange={(e) => setDealsMerchant(e.target.value)}>
                <option value="all">All Stores</option>
                {masterStores.map(st => (
                  <option key={st.value} value={st.value.toLowerCase()}>{st.label}</option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Category:</span>
              <select className="filter-select" value={dealsCategory} onChange={(e) => handleCategoryFilterChange(e.target.value)}>
                <option value="all">All Categories</option>
                {knownCategories.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Subcategory */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Subcategory:</span>
              <select className="filter-select" value={dealsSubcategory} onChange={(e) => setDealsSubcategory(e.target.value)}>
                <option value="all">All Subcategories</option>
                {dealsCategory !== 'all'
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
              <select className="filter-select" value={dealsCountry} onChange={(e) => setDealsCountry(e.target.value)}>
                <option value="all">All Countries</option>
                <option value="IN">🇮🇳 India (IN)</option>
                <option value="US">🇺🇸 United States (US)</option>
                <option value="UK">🇬🇧 United Kingdom (UK)</option>
                <option value="CA">🇨🇦 Canada (CA)</option>
                <option value="AU">🇦🇺 Australia (AU)</option>
              </select>
            </div>

            {/* Discount Filter */}
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

            {/* Coupon Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Voucher:</span>
              <select
                className="filter-select"
                value={hasCoupon}
                onChange={(e) => setHasCoupon(e.target.value)}
                style={{ fontWeight: hasCoupon !== 'all' ? 700 : 500 }}
              >
                <option value="all">All Deals</option>
                <option value="true">🎟️ With Coupon Only</option>
                <option value="false">Standard Pricing</option>
              </select>
            </div>

            {/* Sort */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Sort:</span>
              <select className="filter-select" value={dealsSort} onChange={(e) => setDealsSort(e.target.value)}>
                <option value="newest">Newest Posted</option>
                <option value="discount">Highest Discount</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
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
                <p style={{ marginTop: 10, fontSize: '0.92rem', fontWeight: 600 }}>Loading deals feed...</p>
              </div>
            ) : sortedDeals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 28, opacity: 0.5 }}>
                    bolt
                  </span>
                </div>
                <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem' }}>
                  No deals found matching your criteria
                </p>
                <p style={{ margin: '6px 0 0', fontSize: '0.84rem' }}>
                  Try changing your discount filters, search terms, or clicking &ldquo;Reset All Filters&rdquo;.
                </p>
              </div>
            ) : (
              <table style={{ width: '100%', minWidth: 1320, borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ width: 44, padding: '12px 14px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        className="rounded border-border cursor-pointer"
                        checked={sortedDeals.length > 0 && dealsSelectedIds.length === sortedDeals.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setDealsSelectedIds(sortedDeals.map(d => d._id));
                          } else {
                            setDealsSelectedIds([]);
                          }
                        }}
                      />
                    </th>

                    <th style={{ width: 64, padding: '12px 10px', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                      Item
                    </th>

                    <th style={{ padding: '12px 14px', cursor: 'pointer', userSelect: 'none', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', minWidth: 260 }} onClick={() => handleSort('title')}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Deal Title {renderSortIcon('title')}
                      </div>
                    </th>

                    <th style={{ width: 100, padding: '12px 14px', cursor: 'pointer', userSelect: 'none', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }} onClick={() => handleSort('merchant')}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Store {renderSortIcon('merchant')}
                      </div>
                    </th>

                    <th style={{ width: 110, padding: '12px 14px', cursor: 'pointer', userSelect: 'none', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }} onClick={() => handleSort('category')}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Category {renderSortIcon('category')}
                      </div>
                    </th>

                    <th style={{ width: 130, padding: '12px 14px', cursor: 'pointer', userSelect: 'none', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }} onClick={() => handleSort('subcategory')}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Subcategory {renderSortIcon('subcategory')}
                      </div>
                    </th>

                    {/* Dedicated Deal Price */}
                    <th style={{ width: 115, padding: '12px 14px', cursor: 'pointer', userSelect: 'none', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }} onClick={() => handleSort('dealPrice')}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Deal Price {renderSortIcon('dealPrice')}
                      </div>
                    </th>

                    {/* Dedicated MRP */}
                    <th style={{ width: 95, padding: '12px 14px', cursor: 'pointer', userSelect: 'none', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }} onClick={() => handleSort('originalPrice')}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        MRP {renderSortIcon('originalPrice')}
                      </div>
                    </th>

                    {/* Coupon / Voucher Column */}
                    <th style={{ width: 120, padding: '12px 14px', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                      Coupon / Voucher
                    </th>

                    {/* Source Channel */}
                    <th style={{ width: 120, padding: '12px 14px', cursor: 'pointer', userSelect: 'none', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }} onClick={() => handleSort('sourceChannelName')}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Channel {renderSortIcon('sourceChannelName')}
                      </div>
                    </th>

                    <th style={{ width: 85, padding: '12px 14px', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                      Country
                    </th>

                    <th style={{ width: 110, padding: '12px 14px', cursor: 'pointer', userSelect: 'none', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }} onClick={() => handleSort('createdAt')}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Posted {renderSortIcon('createdAt')}
                      </div>
                    </th>

                    <th style={{ width: 130, padding: '12px 14px', textAlign: 'right', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {sortedDeals.map((d) => {
                    const isSelected = dealsSelectedIds.includes(d._id);
                    const imgUrl = d.imageUrl || (d.images && d.images[0]);
                    const merchant = d.merchant || 'Amazon';
                    const catColor = categoryColor(d.category);
                    const subLabel = subcategoryMeta[d.subcategory]?.label || d.subcategory;

                    return (
                      <tr
                        key={d._id}
                        style={{
                          background: isSelected ? 'rgba(37, 99, 235, 0.04)' : undefined,
                          borderBottom: '1px solid var(--border)',
                          transition: 'background 0.15s ease',
                          cursor: 'pointer'
                        }}
                        onClick={() => setDrawerDeal(d)}
                      >
                        {/* Checkbox */}
                        <td style={{ padding: '12px 14px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="rounded border-border cursor-pointer"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setDealsSelectedIds([...dealsSelectedIds, d._id]);
                              } else {
                                setDealsSelectedIds(dealsSelectedIds.filter(id => id !== d._id));
                              }
                            }}
                          />
                        </td>

                        {/* Image Thumbnail */}
                        <td style={{ padding: '12px 10px' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{
                            width: 44, height: 44, borderRadius: 8, background: '#ffffff',
                            border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', overflow: 'hidden', padding: 4
                          }}>
                            {imgUrl ? (
                              <img src={imgUrl} alt={d.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            ) : (
                              <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--text-muted)', opacity: 0.4 }}>image_not_supported</span>
                            )}
                          </div>
                        </td>

                        {/* Title & Product ID */}
                        <td style={{ padding: '12px 14px', maxWidth: 300 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-main)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }} title={d.title || d.dealTitle}>
                            {d.dealTitle || d.title || 'Untitled Deal'}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }} onClick={(e) => e.stopPropagation()}>
                            {d.productId && (
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
                                {d.productId}
                              </span>
                            )}

                            {d.dealUrl && (
                              <a
                                href={d.dealUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', padding: 2 }}
                                title="Open Deal Link"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span>
                              </a>
                            )}
                          </div>
                        </td>

                        {/* Store Badge */}
                        <td style={{ padding: '12px 14px' }}>
                          <span className={`merchant-badge merchant-${merchant.toLowerCase()}`}>
                            {merchant}
                          </span>
                        </td>

                        {/* Category */}
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
                            {d.category || 'general'}
                          </span>
                        </td>

                        {/* Subcategory */}
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

                        {/* Price */}
                        <td style={{ padding: '12px 14px' }}>
                          <PriceCell d={d} />
                        </td>

                        {/* MRP */}
                        <td style={{ padding: '12px 14px' }}>
                          <MrpCell d={d} />
                        </td>

                        {/* Coupon Pill */}
                        <td style={{ padding: '12px 14px' }} onClick={(e) => e.stopPropagation()}>
                          {d.coupon?.label ? (
                            <span
                              title={`Coupon: ${d.coupon.label}${d.coupon.code ? ` · Code: ${d.coupon.code}` : ''}`}
                              style={{
                                background: 'rgba(245, 158, 11, 0.1)',
                                border: '1px solid rgba(245, 158, 11, 0.25)',
                                color: '#b45309',
                                padding: '2px 7px',
                                borderRadius: 6,
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                            >
                              🎟️ {d.coupon.label}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>
                          )}
                        </td>

                        {/* Channel Source */}
                        <td style={{ padding: '12px 14px', fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--accent)' }}>send</span>
                            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{d.sourceChannelName || 'Direct'}</span>
                          </div>
                        </td>

                        {/* Country */}
                        <td style={{ padding: '12px 14px', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {COUNTRY_FLAGS[d.country]?.flag || '🌐'} {d.country || 'IN'}
                        </td>

                        {/* Posted Time */}
                        <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          <span title={d.createdAt ? new Date(d.createdAt).toLocaleString() : 'Never'}>
                            {formatTime(d.createdAt)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '12px 14px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                            <button
                              onClick={() => setDrawerDeal(d)}
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
                              title="View deal drawer"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>visibility</span>
                              View
                            </button>

                            <button
                              onClick={() => handleDeleteDeal(d._id)}
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
                              title="Delete deal"
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
          {dealsSelectedIds.length > 0 && (
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
                  {dealsSelectedIds.length} deal{dealsSelectedIds.length > 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={() => setDealsSelectedIds([])}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Deselect all
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleBulkDeleteDeals}
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
                  Delete Selected ({dealsSelectedIds.length})
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
              Showing {startIdx} to {endIdx} of {dealsTotalCount.toLocaleString()} deals
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="page-btn"
                disabled={dealsPage <= 1}
                onClick={() => fetchDeals(dealsPage - 1)}
              >
                Previous
              </button>
              <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                Page {dealsPage} of {dealsTotalPages}
              </span>
              <button
                className="page-btn"
                disabled={dealsPage >= dealsTotalPages}
                onClick={() => fetchDeals(dealsPage + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>

      </section>

      {/* Quick View Drawer */}
      {drawerDeal && (
        <DealDrawer
          deal={drawerDeal}
          allDeals={sortedDeals}
          subcategoryMeta={subcategoryMeta}
          apiBase={apiBase}
          onClose={() => setDrawerDeal(null)}
          onSelectDeal={(d) => setDrawerDeal(d)}
          onDeleteClick={handleDeleteDeal}
        />
      )}
    </AdminShell>
  );
}
