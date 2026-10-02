import { fetchDeals, findMatchingProductId } from '@/lib/api';
import V2Hero from '@/components/v2/V2Hero';
import V2FeedContainer from '@/components/v2/V2FeedContainer';
import Link from 'next/link';

import V3VersionSwitcher from '@/components/v3/V3VersionSwitcher';

export const metadata = {
  title: 'ShoppersDeals V2 — Clean Wide Homepage Preview',
  description: 'Preview the redesigned Buyhatke-inspired clean, wide layout with 90-day price tracker, cross-store comparison, and verified deal drops.',
  robots: { index: false, follow: false }, // Keep preview page unindexed during review
};

export default async function V2HomePage({ searchParams }) {
  const sp = await searchParams;
  const category = sp?.category || 'all';
  const merchant = sp?.merchant || 'all';
  const country = sp?.country || 'in';

  // Fetch initial batch of verified deals (strictly India locale for INR prices)
  const { items: rawDeals, hasMore } = await fetchDeals({
    category,
    merchant,
    country: (country || 'in').toLowerCase(),
    sort: 'newest',
    minDiscount: 15,
  });

  // Resolve matching product IDs for 90-day canonical links
  const deals = await Promise.all(
    rawDeals.map(async (d) => {
      if (!d.productId || !d.merchant) return d;
      const linkedProductId = await findMatchingProductId(d.productId, d.merchant);
      return linkedProductId ? { ...d, linkedProductId } : d;
    })
  );

  return (
    <div className="min-h-screen bg-slate-50/40">
      {/* 3-Way Version Switcher Bar */}
      <V3VersionSwitcher />

      {/* Hero Section with Price History Scanner & Tool Highlights */}
      <V2Hero activeCategory={category} />

      {/* Live Deals Feed with Deals by Stores, Deals by Brands, Discount Bands & 6-Col Wide Grid */}
      <V2FeedContainer
        initialDeals={deals}
        initialHasMore={hasMore}
        category={category}
        country={country || 'in'}
      />

      {/* Why ShoppersDeals Authority Strip */}
      <section className="border-t border-slate-200 bg-white py-14">
        <div className="mx-auto max-w-[1720px] 2xl:max-w-[1840px] px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              Why 100K+ Shoppers Trust Our Deal Scanner
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              E-commerce retailers routinely hike MRPs before sales to advertise fake 50% discounts. Here is how our engine protects your wallet.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 text-left">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-xl text-brand font-black">
                1
              </span>
              <h3 className="mt-4 text-base font-extrabold text-slate-900">Empirical Price Tracking</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                We record daily price points directly from store APIs and ScrapingAnt proxies. Discounts are calculated strictly against real previous selling prices, never fake printed MRPs.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 text-left">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-xl text-blue-600 font-black">
                2
              </span>
              <h3 className="mt-4 text-base font-extrabold text-slate-900">True Cross-Store Comparison</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Identical model numbers and beauty shades are normalized across Amazon, Flipkart, Myntra, and Nykaa, showing you which store has the lowest authentic price.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 text-left">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-xl text-emerald-600 font-black">
                3
              </span>
              <h3 className="mt-4 text-base font-extrabold text-slate-900">Zero-Friction Deep Linking</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Clicking &quot;Get Deal&quot; bypasses slow in-app webviews and launches your native Amazon or Flipkart app directly, where your saved cards and Prime/Plus benefits are ready.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
