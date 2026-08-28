'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminShell from '@/components/admin-shell';

const COUNTRY_NAMES = {
  IN: 'India (IN)',
  US: 'United States (US)',
  UK: 'United Kingdom (UK)',
  CA: 'Canada (CA)',
  AU: 'Australia (AU)',
};

export default function DashboardPage() {
  const [statusData, setStatusData] = useState({});
  const [apiBase, setApiBase] = useState(process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:3001');
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  // Products Explorer State
  const [products, setProducts] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [timeRange, setTimeRange] = useState('all'); // 'all' | '24h' | '7d' | '30d'
  const [country, setCountry] = useState('all');
  const [merchant, setMerchant] = useState('all');
  const [hygiene, setHygiene] = useState('all'); // 'all' | 'missing_image' | 'missing_mrp' | 'missing_price' | 'abnormal_mrp' | 'healthy'
  const [sort, setSort] = useState('newest');

  // Inspection & Editing State
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '',
    price: '',
    originalPrice: '',
    category: '',
    subcategory: '',
    imageUrl: '',
  });
  const [actionMessage, setActionMessage] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    if (envUrl) {
      setApiBase(envUrl.trim().replace(/\/+$/, ''));
    } else if (stored) {
      setApiBase(stored.trim().replace(/\/+$/, ''));
    }
  }, []);

  const apiFetch = useCallback(
    async (endpoint, options = {}) => {
      const base = apiBase.replace(/\/+$/, '');
      const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;
      return fetch(url, options);
    },
    [apiBase]
  );

  // Fetch Dashboard High-Level Metrics
  const fetchStatus = useCallback(async () => {
    try {
      setLoadingMetrics(true);
      const res = await apiFetch('/api/admin/status');
      if (!res.ok) return;
      const data = await res.json();
      setStatusData(data);
    } catch (err) {
      console.error('Fetch status error:', err);
    } finally {
      setLoadingMetrics(false);
    }
  }, [apiFetch]);

  // Fetch Filtered Products Explorer
  const fetchProducts = useCallback(async () => {
    try {
      setLoadingProducts(true);
      const params = new URLSearchParams({
        page,
        limit: 15,
        search,
        timeRange,
        country,
        merchant,
        hygiene,
        sort,
      });

      const res = await apiFetch(`/api/admin/products-explorer?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setProducts(data.products || []);
        setTotalProducts(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error('Fetch products error:', err);
    } finally {
      setLoadingProducts(false);
    }
  }, [apiFetch, page, search, timeRange, country, merchant, hygiene, sort]);

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 8000);
    return () => clearInterval(timer);
  }, [fetchStatus]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Reset to page 1 on filter changes
  const handleFilterChange = (setter, val) => {
    setter(val);
    setPage(1);
  };

  // Open Edit Modal
  const handleOpenEdit = (product) => {
    setEditingProduct(product);
    setEditForm({
      title: product.title || '',
      price: product.price ?? '',
      originalPrice: product.originalPrice ?? '',
      category: product.category || 'general',
      subcategory: product.subcategory || '',
      imageUrl: product.imageUrl || '',
    });
  };

  // Save Product Edit
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      setSavingEdit(true);
      const res = await apiFetch(`/api/admin/products/${editingProduct._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(`✅ Product "${data.product.title.slice(0, 30)}..." updated successfully!`);
        setEditingProduct(null);
        if (selectedProduct && selectedProduct._id === data.product._id) {
          setSelectedProduct(data.product);
        }
        fetchProducts();
        fetchStatus();
        setTimeout(() => setActionMessage(''), 4000);
      } else {
        alert(`Failed to update: ${data.error}`);
      }
    } catch (err) {
      alert(`Error updating product: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete Product
  const handleDeleteProduct = async (product) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${product.title}"?\n\nThis will also remove any linked active deals from the feed.`
    );
    if (!confirmed) return;

    try {
      const res = await apiFetch(`/api/admin/products/${product._id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(`🗑️ Deleted product "${product.title.slice(0, 30)}..." (${data.deletedDealsCount} deals removed)`);
        if (selectedProduct && selectedProduct._id === product._id) {
          setSelectedProduct(null);
        }
        fetchProducts();
        fetchStatus();
        setTimeout(() => setActionMessage(''), 4000);
      } else {
        alert(`Delete failed: ${data.error}`);
      }
    } catch (err) {
      alert(`Delete error: ${err.message}`);
    }
  };

  // Re-scrape product via BullMQ
  const handleReScrape = async (product) => {
    try {
      setActionMessage(`Queueing live scrape for ${product.title.slice(0, 30)}...`);
      const res = await apiFetch('/api/admin/refresh-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: [product._id] }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage('✅ Re-scrape job dispatched to Redis BullMQ!');
        setTimeout(() => {
          setActionMessage('');
          fetchProducts();
          fetchStatus();
        }, 3000);
      } else {
        setActionMessage(`❌ Error: ${data.error || 'Failed'}`);
      }
    } catch (err) {
      setActionMessage(`❌ Error: ${err.message}`);
    }
  };

  const hygieneStats = statusData.hygiene || {
    missingImages: 0,
    missingMrp: 0,
    missingPrice: 0,
    abnormalMrp: 0,
    healthy: 0,
  };

  return (
    <AdminShell title="Catalog & Product Intelligence">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
        
        {/* TOP STATUS HEADER BAR */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(248,250,252,0.8))',
            padding: '16px 20px',
            borderRadius: '16px',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '30px',
                background: statusData.status === 'Online' ? '#ecfdf5' : '#fef2f2',
                color: statusData.status === 'Online' ? '#059669' : '#dc2626',
                fontWeight: 700,
                fontSize: '0.85rem',
                border: `1px solid ${statusData.status === 'Online' ? '#10b98130' : '#ef444430'}`,
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: statusData.status === 'Online' ? '#10b981' : '#ef4444',
                  boxShadow: statusData.status === 'Online' ? '0 0 8px #10b981' : 'none',
                }}
              />
              {statusData.status === 'Online' ? 'MongoDB Atlas & Redis Connected' : 'Connecting to Server...'}
            </div>

            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Real-time synchronization across <b>{statusData.totalProducts || 0}</b> cached products & <b>{statusData.totalDeals || 0}</b> verified deals.
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => {
                fetchStatus();
                fetchProducts();
              }}
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '10px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>
              Sync Metrics
            </button>
          </div>
        </div>

        {/* SECTION 1: TIME-BASED PRODUCT & DEAL GROWTH KPIS */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '18px',
          }}
        >
          {/* Card 1: Total Products */}
          <div
            className="card glass"
            style={{
              padding: '20px',
              borderRadius: '16px',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(245,247,250,0.9))',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Products In DB
              </span>
              <span className="material-symbols-outlined" style={{ color: '#6366f1', fontSize: 24 }}>inventory_2</span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#1e1b4b' }}>
              {statusData.totalProducts ? Number(statusData.totalProducts).toLocaleString() : '0'}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
              <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#e0e7ff', color: '#4338ca', fontSize: '0.75rem', fontWeight: 700 }}>
                +{statusData.products24h || 0} in 24h
              </span>
              <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#f1f5f9', color: '#475569', fontSize: '0.75rem', fontWeight: 600 }}>
                +{statusData.products7d || 0} in 7d
              </span>
              <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#f8fafc', color: '#64748b', fontSize: '0.75rem' }}>
                {statusData.products30d || 0} in 30d
              </span>
            </div>
          </div>

          {/* Card 2: Total & Active Deals */}
          <div
            className="card glass"
            style={{
              padding: '20px',
              borderRadius: '16px',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(245,247,250,0.9))',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Active Deals Feed
              </span>
              <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: 24 }}>local_offer</span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#064e3b' }}>
              {statusData.totalDeals ? Number(statusData.totalDeals).toLocaleString() : '0'}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
              <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#dcfce7', color: '#15803d', fontSize: '0.75rem', fontWeight: 700 }}>
                +{statusData.deals24h || 0} in 24h
              </span>
              <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#f1f5f9', color: '#475569', fontSize: '0.75rem', fontWeight: 600 }}>
                +{statusData.deals7d || 0} in 7d
              </span>
              <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#f8fafc', color: '#64748b', fontSize: '0.75rem' }}>
                {statusData.deals30d || 0} in 30d
              </span>
            </div>
          </div>

          {/* Card 3: Products by Country */}
          <div
            className="card glass"
            style={{
              padding: '20px',
              borderRadius: '16px',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(245,247,250,0.9))',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Geographic Coverage
              </span>
              <span className="material-symbols-outlined" style={{ color: '#0ea5e9', fontSize: 24 }}>public</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
              <div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0369a1' }}>
                  🇮🇳 {statusData.productsByCountry?.IN ? Number(statusData.productsByCountry.IN).toLocaleString() : '0'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>India Market</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1d4ed8' }}>
                  🇺🇸 {statusData.productsByCountry?.US ? Number(statusData.productsByCountry.US).toLocaleString() : '0'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>USA Deals</div>
              </div>
            </div>
            <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: '#e2e8f0', overflow: 'hidden', display: 'flex' }}>
              <div
                style={{
                  height: '100%',
                  background: '#0ea5e9',
                  width: `${((statusData.productsByCountry?.IN || 0) / (statusData.totalProducts || 1)) * 100}%`,
                }}
              />
              <div
                style={{
                  height: '100%',
                  background: '#3b82f6',
                  width: `${((statusData.productsByCountry?.US || 0) / (statusData.totalProducts || 1)) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Card 4: ScrapingAnt Token Pool */}
          <div
            className="card glass"
            style={{
              padding: '20px',
              borderRadius: '16px',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(245,247,250,0.9))',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                ScrapingAnt Token Pool
              </span>
              <span className="material-symbols-outlined" style={{ color: '#f59e0b', fontSize: 24 }}>vpn_key</span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#92400e' }}>
              {statusData.tokens?.active || 0} <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)' }}>/ {statusData.tokens?.total || 0} Ready</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
              <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#ecfdf5', color: '#059669', fontSize: '0.75rem', fontWeight: 700 }}>
                {statusData.tokens?.active || 0} Active Tokens
              </span>
              <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#fef2f2', color: '#dc2626', fontSize: '0.75rem', fontWeight: 600 }}>
                {statusData.tokens?.exhausted || 0} Cooldown
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 2: DATA QUALITY & HYGIENE AUDITOR (5 INTERACTIVE FILTER CARDS) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ color: '#ec4899', fontSize: 22 }}>health_and_safety</span>
              Catalog Data Quality & Hygiene Auditor
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Click any card to filter & audit products below
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '14px',
            }}
          >
            {/* Hygiene 1: Missing Images */}
            <div
              onClick={() => handleFilterChange(setHygiene, hygiene === 'missing_image' ? 'all' : 'missing_image')}
              style={{
                padding: '16px',
                borderRadius: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                border: hygiene === 'missing_image' ? '2px solid #ef4444' : '1px solid #fecaca',
                background: hygiene === 'missing_image' ? '#fef2f2' : 'rgba(254, 242, 242, 0.5)',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>hide_image</span>
              </div>
              <div>
                <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>
                  Missing Images
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#dc2626' }}>
                  {hygieneStats.missingImages.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#b91c1c' }}>
                  {hygiene === 'missing_image' ? '● Filtering' : 'Click to audit'}
                </div>
              </div>
            </div>

            {/* Hygiene 2: Missing MRP */}
            <div
              onClick={() => handleFilterChange(setHygiene, hygiene === 'missing_mrp' ? 'all' : 'missing_mrp')}
              style={{
                padding: '16px',
                borderRadius: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                border: hygiene === 'missing_mrp' ? '2px solid #f59e0b' : '1px solid #fed7aa',
                background: hygiene === 'missing_mrp' ? '#fffbeb' : 'rgba(255, 251, 235, 0.5)',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#fef3c7',
                  color: '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>price_change</span>
              </div>
              <div>
                <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>
                  Missing MRP
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#d97706' }}>
                  {hygieneStats.missingMrp.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#b45309' }}>
                  {hygiene === 'missing_mrp' ? '● Filtering' : 'Click to audit'}
                </div>
              </div>
            </div>

            {/* Hygiene 3: Missing Price */}
            <div
              onClick={() => handleFilterChange(setHygiene, hygiene === 'missing_price' ? 'all' : 'missing_price')}
              style={{
                padding: '16px',
                borderRadius: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                border: hygiene === 'missing_price' ? '2px solid #ec4899' : '1px solid #fbcfe8',
                background: hygiene === 'missing_price' ? '#fdf2f8' : 'rgba(253, 242, 248, 0.5)',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#fce7f3',
                  color: '#db2777',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>money_off</span>
              </div>
              <div>
                <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#9d174d', textTransform: 'uppercase' }}>
                  Missing Price
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#db2777' }}>
                  {hygieneStats.missingPrice.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#be185d' }}>
                  {hygiene === 'missing_price' ? '● Filtering' : 'Click to audit'}
                </div>
              </div>
            </div>

            {/* Hygiene 4: Suspicious MRP Gap (> ₹2k) */}
            <div
              onClick={() => handleFilterChange(setHygiene, hygiene === 'abnormal_mrp' ? 'all' : 'abnormal_mrp')}
              style={{
                padding: '16px',
                borderRadius: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                border: hygiene === 'abnormal_mrp' ? '2px solid #8b5cf6' : '1px solid #ddd6fe',
                background: hygiene === 'abnormal_mrp' ? '#f5f3ff' : 'rgba(245, 243, 255, 0.5)',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#ede9fe',
                  color: '#7c3aed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>warning</span>
              </div>
              <div>
                <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#5b21b6', textTransform: 'uppercase' }}>
                  Abnormal MRP (&gt;₹2k)
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#7c3aed' }}>
                  {hygieneStats.abnormalMrp ? hygieneStats.abnormalMrp.toLocaleString() : '0'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#6d28d9' }}>
                  {hygiene === 'abnormal_mrp' ? '● Filtering' : 'Click to audit'}
                </div>
              </div>
            </div>

            {/* Hygiene 5: 100% Complete & Healthy */}
            <div
              onClick={() => handleFilterChange(setHygiene, hygiene === 'healthy' ? 'all' : 'healthy')}
              style={{
                padding: '16px',
                borderRadius: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                border: hygiene === 'healthy' ? '2px solid #10b981' : '1px solid #bbf7d0',
                background: hygiene === 'healthy' ? '#f0fdf4' : 'rgba(240, 253, 244, 0.5)',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#dcfce7',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>verified</span>
              </div>
              <div>
                <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#065f46', textTransform: 'uppercase' }}>
                  100% Healthy
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#059669' }}>
                  {hygieneStats.healthy.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#047857' }}>
                  {hygiene === 'healthy' ? '● Filtering' : 'All assets verified'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: TOP MERCHANTS DISTRIBUTION */}
        <div
          className="card glass"
          style={{
            padding: '20px',
            borderRadius: '16px',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ color: '#3b82f6', fontSize: 20 }}>storefront</span>
              Catalog Distribution by Merchant Store
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Total {Object.keys(statusData.productsByMerchant || {}).length} Merchant Sources
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
            {Object.entries(statusData.productsByMerchant || {}).map(([mName, count]) => {
              const pct = Math.round((count / (statusData.totalProducts || 1)) * 100);
              const isSelected = merchant.toLowerCase() === mName.toLowerCase();
              return (
                <div
                  key={mName}
                  onClick={() => handleFilterChange(setMerchant, isSelected ? 'all' : mName)}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    border: isSelected ? '2px solid #3b82f6' : '1px solid var(--border)',
                    background: isSelected ? '#eff6ff' : 'rgba(255,255,255,0.7)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)', textTransform: 'capitalize' }}>
                      {mName}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{pct}%</span>
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e293b', marginTop: '4px' }}>
                    {count.toLocaleString()}
                  </div>
                  <div style={{ width: '100%', height: '4px', background: '#e2e8f0', borderRadius: '2px', marginTop: '6px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: '#3b82f6' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 4: INTERACTIVE FILTERABLE PRODUCT EXPLORER & CONTROL CENTER */}
        <div
          className="card glass"
          style={{
            padding: '24px',
            borderRadius: '18px',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          {/* Action Message Banner */}
          {actionMessage && (
            <div
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                background: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                fontSize: '0.88rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>info</span>
              {actionMessage}
            </div>
          )}

          {/* Explorer Header & Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ color: '#6366f1', fontSize: 24 }}>manage_search</span>
                Product Catalog Control Center
              </h3>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Showing <b>{products.length}</b> of <b>{totalProducts.toLocaleString()}</b> filtered products.
              </div>
            </div>

            {/* Filter Pills / Reset */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(timeRange !== 'all' || country !== 'all' || merchant !== 'all' || hygiene !== 'all' || search !== '') && (
                <button
                  onClick={() => {
                    setTimeRange('all');
                    setCountry('all');
                    setMerchant('all');
                    setHygiene('all');
                    setSearch('');
                    setPage(1);
                  }}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '6px 12px', borderRadius: '8px' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>filter_alt_off</span>
                  Reset All Filters
                </button>
              )}
            </div>
          </div>

          {/* FILTER TOOLBAR */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              background: 'rgba(248, 250, 252, 0.8)',
              padding: '16px',
              borderRadius: '14px',
              border: '1px solid var(--border)',
            }}
          >
            {/* Search Input */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Search Catalog
              </label>
              <div style={{ position: 'relative', marginTop: '4px' }}>
                <input
                  type="text"
                  placeholder="Search title, ASIN, SKU, URL..."
                  value={search}
                  onChange={(e) => handleFilterChange(setSearch, e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    fontSize: '0.85rem',
                  }}
                />
                <span
                  className="material-symbols-outlined"
                  style={{ position: 'absolute', left: 10, top: 8, fontSize: 18, color: 'var(--text-muted)' }}
                >
                  search
                </span>
              </div>
            </div>

            {/* Time Horizon Filter */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Time Range
              </label>
              <select
                value={timeRange}
                onChange={(e) => handleFilterChange(setTimeRange, e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  fontSize: '0.85rem',
                  marginTop: '4px',
                  background: '#fff',
                }}
              >
                <option value="all">All Time</option>
                <option value="24h">Added in Last 24 Hours</option>
                <option value="7d">Added in Last 7 Days</option>
                <option value="30d">Added in Last 30 Days</option>
              </select>
            </div>

            {/* Country Filter */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Market / Country
              </label>
              <select
                value={country}
                onChange={(e) => handleFilterChange(setCountry, e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  fontSize: '0.85rem',
                  marginTop: '4px',
                  background: '#fff',
                }}
              >
                <option value="all">All Markets</option>
                <option value="IN">🇮🇳 India (IN)</option>
                <option value="US">🇺🇸 United States (US)</option>
              </select>
            </div>

            {/* Merchant Filter */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Merchant Store
              </label>
              <select
                value={merchant}
                onChange={(e) => handleFilterChange(setMerchant, e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  fontSize: '0.85rem',
                  marginTop: '4px',
                  background: '#fff',
                }}
              >
                <option value="all">All Stores</option>
                <option value="amazon">Amazon</option>
                <option value="flipkart">Flipkart</option>
                <option value="croma">Croma</option>
                <option value="myntra">Myntra</option>
                <option value="shopsy">Shopsy</option>
                <option value="ajio">Ajio</option>
                <option value="vijaysales">Vijay Sales</option>
                <option value="cashify">Cashify</option>
              </select>
            </div>

            {/* Quality Hygiene Filter */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Quality Hygiene
              </label>
              <select
                value={hygiene}
                onChange={(e) => handleFilterChange(setHygiene, e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  fontSize: '0.85rem',
                  marginTop: '4px',
                  background: '#fff',
                }}
              >
                <option value="all">All Quality States</option>
                <option value="abnormal_mrp">⚠️ Abnormal MRP (&gt; ₹2k Gap)</option>
                <option value="missing_image">🖼️ Missing Image</option>
                <option value="missing_mrp">🏷️ Missing MRP</option>
                <option value="missing_price">💰 Missing Price</option>
                <option value="healthy">✅ 100% Healthy</option>
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Sort By
              </label>
              <select
                value={sort}
                onChange={(e) => handleFilterChange(setSort, e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  fontSize: '0.85rem',
                  marginTop: '4px',
                  background: '#fff',
                }}
              >
                <option value="newest">Recently Added</option>
                <option value="oldest">Oldest First</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="last_checked">Recently Verified</option>
              </select>
            </div>
          </div>

          {/* PRODUCTS TABLE */}
          <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>Product</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>Store & Market</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>Price & MRP</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>Deal Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>Quality Audit</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingProducts ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <span className="material-symbols-outlined" style={{ animation: 'spin 1s linear infinite', fontSize: 28 }}>
                        sync
                      </span>
                      <div style={{ marginTop: '8px' }}>Loading catalog products...</div>
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 36, color: '#94a3b8' }}>
                        inventory
                      </span>
                      <div style={{ fontWeight: 600, marginTop: '8px' }}>No products match your selected filters.</div>
                    </td>
                  </tr>
                ) : (
                  products.map((p) => {
                    const hasImage = p.imageUrl && p.imageUrl.length > 0;
                    const hasMrp = p.originalPrice && p.originalPrice > 0;
                    const hasPrice = p.price && p.price > 0;
                    const currency = p.country === 'US' ? '$' : '₹';
                    const mrpDifference = hasMrp && hasPrice ? p.originalPrice - p.price : 0;
                    const isAbnormalGap = mrpDifference > 2000;

                    return (
                      <tr
                        key={p._id}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          transition: 'background 0.15s ease',
                          background: isAbnormalGap && hygiene === 'abnormal_mrp' ? 'rgba(245, 243, 255, 0.4)' : 'transparent',
                        }}
                      >
                        {/* 1. Product Thumbnail & Title */}
                        <td style={{ padding: '12px 16px', maxWidth: '320px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div
                              style={{
                                width: '44px',
                                height: '44px',
                                borderRadius: '8px',
                                background: '#f1f5f9',
                                overflow: 'hidden',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                border: '1px solid var(--border)',
                              }}
                            >
                              {hasImage ? (
                                <img
                                  src={p.imageUrl}
                                  alt=""
                                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <span className="material-symbols-outlined" style={{ color: '#ef4444', fontSize: 20 }}>
                                  hide_image
                                </span>
                              )}
                            </div>
                            <div style={{ overflow: 'hidden' }}>
                              <div
                                style={{
                                  fontWeight: 700,
                                  color: 'var(--text-main)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                                title={p.title}
                              >
                                {p.title}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.productId || 'No PID'}</span>
                                <span>•</span>
                                <span>{p.category || 'General'}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Store & Market */}
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                background: '#f1f5f9',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                textTransform: 'uppercase',
                                color: 'var(--text-main)',
                              }}
                            >
                              {p.merchant || 'Store'}
                            </span>
                            <span style={{ fontSize: '0.85rem' }}>{p.country === 'US' ? '🇺🇸' : '🇮🇳'}</span>
                          </div>
                        </td>

                        {/* 3. Price & MRP */}
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 800, color: hasPrice ? '#0f172a' : '#ef4444' }}>
                            {hasPrice ? `${currency}${p.price.toLocaleString()}` : 'Missing Price'}
                          </div>
                          {hasMrp ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                                {currency}{p.originalPrice.toLocaleString()}
                              </span>
                              {isAbnormalGap && (
                                <span
                                  style={{
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    background: '#ede9fe',
                                    color: '#6d28d9',
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                  }}
                                  title={`Abnormal MRP Gap: ₹${mrpDifference.toLocaleString()} higher than price`}
                                >
                                  Gap: ₹{mrpDifference.toLocaleString()}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600 }}>No MRP</span>
                          )}
                        </td>

                        {/* 4. Deal Status */}
                        <td style={{ padding: '12px 16px' }}>
                          {p.hasDeal ? (
                            <span
                              style={{
                                padding: '4px 10px',
                                borderRadius: '20px',
                                background: '#dcfce7',
                                color: '#15803d',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>bolt</span>
                              Active Deal ({p.activeDeal?.discountPercentage || 0}% OFF)
                            </span>
                          ) : (
                            <span
                              style={{
                                padding: '4px 10px',
                                borderRadius: '20px',
                                background: '#f1f5f9',
                                color: '#64748b',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                              }}
                            >
                              Catalog Only
                            </span>
                          )}
                        </td>

                        {/* 5. Quality Audit Badge */}
                        <td style={{ padding: '12px 16px' }}>
                          {isAbnormalGap ? (
                            <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#ede9fe', color: '#6d28d9', fontSize: '0.72rem', fontWeight: 700 }}>
                              ⚠️ High MRP Gap
                            </span>
                          ) : !hasImage ? (
                            <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#fee2e2', color: '#dc2626', fontSize: '0.72rem', fontWeight: 700 }}>
                              Missing Image
                            </span>
                          ) : !hasMrp ? (
                            <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#fef3c7', color: '#d97706', fontSize: '0.72rem', fontWeight: 700 }}>
                              Missing MRP
                            </span>
                          ) : !hasPrice ? (
                            <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#fce7f3', color: '#db2777', fontSize: '0.72rem', fontWeight: 700 }}>
                              Missing Price
                            </span>
                          ) : (
                            <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#dcfce7', color: '#059669', fontSize: '0.72rem', fontWeight: 700 }}>
                              ✅ Complete
                            </span>
                          )}
                        </td>

                        {/* 6. Action Buttons */}
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              onClick={() => handleOpenEdit(p)}
                              title="Edit / Audit Product Price & MRP"
                              style={{
                                padding: '6px',
                                borderRadius: '6px',
                                border: '1px solid #3b82f6',
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                cursor: 'pointer',
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
                            </button>
                            <button
                              onClick={() => setSelectedProduct(p)}
                              title="Inspect Product Details"
                              style={{
                                padding: '6px',
                                borderRadius: '6px',
                                border: '1px solid var(--border)',
                                background: '#fff',
                                cursor: 'pointer',
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>visibility</span>
                            </button>
                            <button
                              onClick={() => handleReScrape(p)}
                              title="Re-scrape live data via BullMQ"
                              style={{
                                padding: '6px',
                                borderRadius: '6px',
                                border: '1px solid #10b981',
                                background: '#ecfdf5',
                                color: '#059669',
                                cursor: 'pointer',
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p)}
                              title="Delete Product from Database"
                              style={{
                                padding: '6px',
                                borderRadius: '6px',
                                border: '1px solid #ef4444',
                                background: '#fef2f2',
                                color: '#dc2626',
                                cursor: 'pointer',
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                            </button>
                            {p.cleanUrl && (
                              <a
                                href={p.cleanUrl}
                                target="_blank"
                                rel="noreferrer"
                                title="Open Merchant Store Page"
                                style={{
                                  padding: '6px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border)',
                                  background: '#fff',
                                  color: 'var(--text-main)',
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>open_in_new</span>
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Page <b>{page}</b> of <b>{totalPages}</b>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px' }}
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px' }}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* MODAL: EDIT PRODUCT DETAILS (AUDIT MRP & PRICING) */}
        {editingProduct && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(4px)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '540px',
                background: '#fff',
                borderRadius: '16px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#f8fafc',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="material-symbols-outlined" style={{ color: '#3b82f6' }}>edit_note</span>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Edit Product & MRP Audit</h3>
                </div>
                <button
                  onClick={() => setEditingProduct(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSaveEdit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Product Title
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      fontSize: '0.88rem',
                      marginTop: '4px',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Current Deal Price (₹)
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={editForm.price}
                      onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        marginTop: '4px',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Original MRP (₹)
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={editForm.originalPrice}
                      onChange={(e) => setEditForm({ ...editForm, originalPrice: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        marginTop: '4px',
                      }}
                    />
                  </div>
                </div>

                {editForm.originalPrice && editForm.price && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: editForm.originalPrice - editForm.price > 2000 ? '#f5f3ff' : '#ecfdf5',
                      border: `1px solid ${editForm.originalPrice - editForm.price > 2000 ? '#ddd6fe' : '#a7f3d0'}`,
                      fontSize: '0.82rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>
                      Calculated Discount:{' '}
                      <b>
                        {Math.max(0, Math.round(((editForm.originalPrice - editForm.price) / editForm.originalPrice) * 100))}% OFF
                      </b>
                    </span>
                    <span style={{ color: editForm.originalPrice - editForm.price > 2000 ? '#6d28d9' : '#059669', fontWeight: 700 }}>
                      Gap: ₹{(editForm.originalPrice - editForm.price).toLocaleString()}
                    </span>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Category
                    </label>
                    <input
                      type="text"
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        fontSize: '0.85rem',
                        marginTop: '4px',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Subcategory
                    </label>
                    <input
                      type="text"
                      value={editForm.subcategory}
                      onChange={(e) => setEditForm({ ...editForm, subcategory: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        fontSize: '0.85rem',
                        marginTop: '4px',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Image URL
                  </label>
                  <input
                    type="url"
                    value={editForm.imageUrl}
                    onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      fontSize: '0.85rem',
                      marginTop: '4px',
                    }}
                  />
                </div>

                {/* Modal Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="btn btn-secondary"
                    style={{ padding: '8px 16px', borderRadius: '8px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="btn btn-primary"
                    style={{
                      padding: '8px 20px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>save</span>
                    {savingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SIDE DRAWER: PRODUCT INSPECTION MODAL */}
        {selectedProduct && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              maxWidth: '480px',
              background: '#fff',
              boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideIn 0.25s ease',
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: '20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Product Inspection</h3>
              <button
                onClick={() => setSelectedProduct(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 24 }}>close</span>
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Image Preview */}
              <div
                style={{
                  width: '100%',
                  height: '200px',
                  borderRadius: '12px',
                  background: '#f8fafc',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {selectedProduct.imageUrl ? (
                  <img
                    src={selectedProduct.imageUrl}
                    alt=""
                    style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', color: '#ef4444' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 40 }}>hide_image</span>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>No Image Available</div>
                  </div>
                )}
              </div>

              {/* Title & Metadata */}
              <div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>
                  {selectedProduct.title}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Product ID: <b>{selectedProduct.productId}</b>
                </div>
              </div>

              {/* Pricing breakdown */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: '#f8fafc',
                  border: '1px solid var(--border)',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Current Price</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                    ₹{selectedProduct.price?.toLocaleString() || 'N/A'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Original MRP</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#64748b' }}>
                    ₹{selectedProduct.originalPrice?.toLocaleString() || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Price History Points */}
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px' }}>
                  Price History Checkpoints ({selectedProduct.priceHistory?.length || 0})
                </div>
                <div
                  style={{
                    maxHeight: '140px',
                    overflowY: 'auto',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '8px',
                  }}
                >
                  {selectedProduct.priceHistory?.length > 0 ? (
                    selectedProduct.priceHistory.map((h, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '4px 0',
                          fontSize: '0.78rem',
                          borderBottom: '1px dashed #e2e8f0',
                        }}
                      >
                        <span>{h.date || new Date(h.timestamp).toLocaleDateString()}</span>
                        <span style={{ fontWeight: 700 }}>₹{h.price?.toLocaleString()}</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No history checkpoints recorded</div>
                  )}
                </div>
              </div>

              {/* Store & Direct Link */}
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Canonical Store URL</div>
                <input
                  type="text"
                  readOnly
                  value={selectedProduct.cleanUrl || ''}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '0.78rem',
                    background: '#f8fafc',
                    fontFamily: 'monospace',
                  }}
                />
              </div>

              {/* Quick Actions in Drawer */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => {
                      const p = selectedProduct;
                      setSelectedProduct(null);
                      handleOpenEdit(p);
                    }}
                    className="btn btn-primary"
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '10px',
                      borderRadius: '10px',
                      fontSize: '0.85rem',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
                    Edit & Audit Price
                  </button>
                  <button
                    onClick={() => handleReScrape(selectedProduct)}
                    className="btn btn-secondary"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      fontSize: '0.85rem',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>
                    Re-scrape
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  {selectedProduct.cleanUrl && (
                    <a
                      href={selectedProduct.cleanUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary"
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '10px',
                        borderRadius: '10px',
                        fontSize: '0.85rem',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>open_in_new</span>
                      Open Store
                    </a>
                  )}
                  <button
                    onClick={() => handleDeleteProduct(selectedProduct)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid #ef4444',
                      background: '#fef2f2',
                      color: '#dc2626',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
