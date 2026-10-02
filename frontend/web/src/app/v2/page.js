import { fetchDeals, findMatchingProductId } from '@/lib/api';
import V2Hero from '@/components/v2/V2Hero';
import V2FeedContainer from '@/components/v2/V2FeedContainer';
import Link from 'next/link';

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

  // Fetch initial batch of verified deals
  const { items: rawDeals, hasMore } = await fetchDeals({
    category,
    merchant,
    country,
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
      {/* Side-by-Side Review Floating Notice */}
      <div className="sticky top-0 z-40 w-full border-b border-indigo-200 bg-indigo-900 px-4 py-2 text-white shadow-sm">
        <div className="mx-auto flex w-full max-w-[1720px] 2xl:max-w-[1840px] items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-indigo-500/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-200">
              Preview Mode
            </span>
            <span>✨ New Homepage Design Preview (Buyhatke-Inspired Wide Layout)</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-indigo-200">Reviewing on separate /v2 URL</span>
            <Link
              href="/"
              className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-extrabold text-white transition-colors hover:bg-white/20"
            >
              Compare with Live Home (/) ↗
            </Link>
          </div>
        </div>
      </div>

      {/* Hero Section with Price History Scanner & Tool Highlights */}
      <V2Hero activeCategory={category} />

      {/* Live Deals Feed with Store Rail, Discount Bands & 6-Col Wide Grid */}
      <V2FeedContainer
        initialDeals={deals}
        initialHasMore={hasMore}
        activeCategory={category}
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
