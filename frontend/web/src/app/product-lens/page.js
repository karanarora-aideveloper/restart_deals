import React, { Suspense } from 'react';
import { API_BASE_URL, SITE_URL } from '@/lib/config';
import ProductLensClient from './ProductLensClient';

export const metadata = {
  title: 'Spend Lens™ & Product Value Radar — Smart Buying Decision Analyzer | ShoppersDeals',
  description:
    'Inspect any product before you spend. Instant Fair-Value Score (0-100), 90-day All-Time Low radar, fake MRP inflation detection, cross-store price comparison, and card discount optimizer.',
  alternates: { canonical: `${SITE_URL}/product-lens` },
  openGraph: {
    title: 'Spend Lens™ & Product Value Radar | ShoppersDeals',
    description:
      'Inspect any product before you spend. Instant Fair-Value Score, 90-day All-Time Low radar, fake MRP detection, and cross-store price comparison.',
    url: `${SITE_URL}/product-lens`,
    siteName: 'ShoppersDeals',
    locale: 'en_IN',
    type: 'website',
  },
};

async function fetchCuratedProducts() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/products?country=IN&limit=24`, {
      next: { revalidate: 120 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.data) ? data.data : [];
  } catch (err) {
    console.warn('[ProductLens] Failed to fetch curated products:', err.message);
    return [];
  }
}

async function fetchProductById(id) {
  if (!id) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/api/products/${id}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? (data.data || data.product) : null;
  } catch (err) {
    console.warn('[ProductLens] Failed to fetch product by id:', err.message);
    return null;
  }
}

async function resolveProductByUrl(url) {
  if (!url) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/api/products/compare-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data.product : null;
  } catch (err) {
    console.warn('[ProductLens] Failed to resolve product by url:', err.message);
    return null;
  }
}

export default async function ProductLensPage({ searchParams }) {
  const sp = await searchParams;
  const initialId = sp?.id || sp?.pid || '';
  const initialUrl = sp?.url ? decodeURIComponent(sp.url).trim() : '';
  const initialQuery = sp?.q ? decodeURIComponent(sp.q).trim() : '';

  let initialProduct = null;
  if (initialId) {
    initialProduct = await fetchProductById(initialId);
  } else if (initialUrl) {
    initialProduct = await resolveProductByUrl(initialUrl);
  }

  const curatedProducts = await fetchCuratedProducts();

  // If no product was explicitly requested via search params, pick the first high-value item as default inspected item
  if (!initialProduct && curatedProducts.length > 0) {
    // Pick an item with a price >= 1000 and an image
    initialProduct = curatedProducts.find(p => p.price >= 1000 && (p.imageUrl || (p.images && p.images.length > 0))) || curatedProducts[0];
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAFAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          <p className="text-sm font-bold text-slate-600">Initializing Spend Lens™ Radar...</p>
        </div>
      </div>
    }>
      <ProductLensClient
        initialProduct={initialProduct}
        initialCurated={curatedProducts}
        initialQuery={initialQuery || (initialProduct?.title ? '' : '')}
      />
    </Suspense>
  );
}
