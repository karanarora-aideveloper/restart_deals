import { fetchDeals, findMatchingProductId } from '@/lib/api';
import FilterBar from '@/components/FilterBar';
import DealsFeed from '@/components/DealsFeed';

export const metadata = {
  title: 'Hot Deals — Up to 80% Off',
  description:
    'The hottest live deals right now — 40% or more off Amazon, Flipkart, and Myntra electronics, fashion, and essentials.',
  alternates: { canonical: '/hot' },
};

export default async function HotDealsPage({ searchParams }) {
  const sp = await searchParams;
  const q = sp?.q || '';
  const category = sp?.category || 'all';
  const merchant = sp?.merchant || 'all';
  const country = sp?.country || 'in';

  // Over-fetch then filter client/server-side for >=40% discount, mirroring the native app.
  const { items: rawDeals } = await fetchDeals({ q, category, merchant, country, sort: 'newest', limit: 80 });
  const filtered = rawDeals.filter((d) => d.discountPercentage && d.discountPercentage >= 40);

  // Resolve canonical product links so DealCard links directly to /product/[id] instead of
  // the /deal/[id] → /product/[id] redirect chain that Google counts as "Page with redirect".
  const deals = await Promise.all(
    filtered.map(async (d) => {
      if (!d.productId || !d.merchant) return d;
      const linkedProductId = await findMatchingProductId(d.productId, d.merchant);
      return linkedProductId ? { ...d, linkedProductId } : d;
    })
  );

  return (
    <div className="mx-auto w-full max-w-[1440px] md:px-8">
      <FilterBar category={category} merchant={merchant} />
      <DealsFeed
        type="hot"
        initialItems={deals}
        emptyTitle="No Hot Deals Right Now"
        emptySub="Check back shortly — high-discount deals are flagged the moment they go live."
      />
    </div>
  );
}
