import Link from 'next/link';
import { fetchProducts } from '@/lib/api';
import FilterBar from '@/components/FilterBar';
import DealsFeed from '@/components/DealsFeed';

export const metadata = {
  title: 'Track Prices — Price History & Drops',
  description:
    'Track prices across Amazon, Flipkart, and Myntra and get notified the moment a genuine price drop happens.',
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
    <div className="mx-auto w-full max-w-[1440px] md:px-8">
      <h1 className="sr-only">Track Prices — Price History Across Amazon, Flipkart & Myntra</h1>
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
