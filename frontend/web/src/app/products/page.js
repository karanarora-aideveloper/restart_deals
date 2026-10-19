import Link from 'next/link';
import { fetchProducts } from '@/lib/api';
import FilterBar from '@/components/FilterBar';
import DealsFeed from '@/components/DealsFeed';
import V3SubHeader from '@/components/v3/V3SubHeader';

export const metadata = {
  title: 'Tracked Products Directory — Browse 50,000+ Products | ShoppersDeals',
  description:
    'Browse our complete catalog of 50,000+ products tracked across Amazon, Flipkart, Myntra, and Nykaa. Filter by store, category, and authentic price drops.',
  alternates: { canonical: '/products' },
};

export default async function ProductsPage({ searchParams }) {
  const sp = await searchParams;
  const q = sp?.q || '';
  const category = sp?.category || 'all';
  const merchant = sp?.merchant || 'all';
  const country = sp?.country || 'in';
  const page = Math.max(1, parseInt(sp?.page || '1', 10));

  const { items: products, hasMore } = await fetchProducts({
    q,
    category,
    merchant,
    country,
    page,
    sort: 'recently_checked',
  });

  const buildPageUrl = (pageNum) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category && category !== 'all') params.set('category', category);
    if (merchant && merchant !== 'all') params.set('merchant', merchant);
    if (country && country !== 'in') params.set('country', country);
    if (pageNum > 1) params.set('page', String(pageNum));
    const str = params.toString();
    return str ? `/products?${str}` : '/products';
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8">
      <V3SubHeader activeTab="products" />

      {/* Directory Header Banner */}
      <div className="mt-4 mb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs">
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              Tracked Products Directory
            </h1>
            <p className="mt-1 text-xs text-slate-500 max-w-2xl">
              Browse 50,000+ products continuously monitored across Amazon, Flipkart, Myntra, and Nykaa with verified price histories. Use filters below to narrow by store or category.
            </p>
          </div>
          <Link
            href="/price-tracker"
            className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-xs font-black text-white shadow-xs hover:from-indigo-700 hover:to-violet-700 transition-all active:scale-95 shrink-0"
          >
            <span>⚡ Open Price Tracker Tool</span>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>

      <FilterBar category={category} merchant={merchant} />
      <DealsFeed
        type="products"
        initialItems={products}
        initialHasMore={hasMore}
        emptyTitle="No Tracked Products Found"
        emptySub="Try clearing filters — our price tracker checks products continuously."
      />

      {/* Crawlable HTML Pagination Strip for Search Engines & Non-JS Browsers */}
      <nav aria-label="Pagination" className="my-10 flex items-center justify-center gap-3 text-xs font-bold border-t border-slate-100 pt-6">
        {page > 1 && (
          <Link
            href={buildPageUrl(page - 1)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-slate-700 hover:border-brand hover:text-brand shadow-2xs transition-all"
          >
            ← Previous Page
          </Link>
        )}
        <span className="rounded-xl bg-slate-100 px-3.5 py-2 text-slate-600">
          Page {page}
        </span>
        {hasMore && (
          <Link
            href={buildPageUrl(page + 1)}
            className="rounded-xl border border-brand/40 bg-orange-50 px-4 py-2 text-brand hover:bg-brand hover:text-white shadow-2xs transition-all"
          >
            Next Page ({page + 1}) →
          </Link>
        )}
      </nav>
    </div>
  );
}
