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

  const { items: products, hasMore } = await fetchProducts({ q, category, merchant, country, sort: 'recently_checked' });

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
    </div>
  );
}
