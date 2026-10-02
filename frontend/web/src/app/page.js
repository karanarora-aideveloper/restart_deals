import { redirect } from 'next/navigation';
import { fetchDeals, findMatchingProductId } from '@/lib/api';
import { SITE_URL } from '@/lib/config';
import FilterBar from '@/components/FilterBar';
import DealsFeed from '@/components/DealsFeed';
import HeroSearch from '@/components/HeroSearch';
import TopStoresGrid from '@/components/TopStoresGrid';
import ShopByTopCategories from '@/components/ShopByTopCategories';
import FeatureHighlights from '@/components/FeatureHighlights';
import HowItWorks from '@/components/HowItWorks';
import ExtensionPromoBanner from '@/components/ExtensionPromoBanner';
import SeoFooterContent from '@/components/SeoFooterContent';
import RecentlyViewed from '@/components/RecentlyViewed';
import SmartBuyersGuidesSection from '@/components/SmartBuyersGuidesSection';

export const metadata = {
  title: 'ShoppersDeals: Best Live Deals, Price History & Coupons',
  description:
    'Find the hottest live deals and track 90-day price history across Amazon, Flipkart, and Myntra. Save big with instant drop alerts.',
  alternates: { canonical: '/' },
};

// FAQ content — shared between the visible HTML section and the JSON-LD schema so they
// always stay in sync. FAQPage schema must only appear on pages that render the answers
// as visible HTML; keeping both here guarantees that.
const FAQ_ITEMS = [
  {
    q: 'What is ShoppersDeals?',
    a: 'ShoppersDeals is a real-time deal tracker that surfaces the best live discounts and hidden price drops from Amazon, Flipkart, Myntra, and Meesho. Our AI engine monitors thousands of products 24/7 so you never miss a flash sale.',
  },
  {
    q: 'Are the deals and discount prices genuine?',
    a: 'Yes — every deal is cross-verified by our engine against the official store listing before it appears. We pull from official store APIs and feeds, so what you see is the actual current price, not an inflated "original" price.',
  },
  {
    q: 'How much does it cost to use ShoppersDeals?',
    a: "ShoppersDeals is completely free. Click any deal and you're taken directly to the official retailer's checkout page at the discounted price. We never charge buyers or add hidden fees.",
  },
  {
    q: 'How often are new deals updated?',
    a: 'The feed refreshes in real-time, 24 hours a day. Flash sales, coupon codes, and price drops appear within minutes of going live on the retailer\'s site.',
  },
  {
    q: 'Can I set a price-drop alert for a product?',
    a: 'Yes. Open any product\'s price-history page and tap "Set Alert". You\'ll get notified the moment the price hits your target, so you can buy at the lowest possible price.',
  },
];

const storeSchema = {
  '@context': 'https://schema.org',
  '@type': 'Store',
  name: 'ShoppersDeals',
  image: `${SITE_URL}/logo.png`,
  url: `${SITE_URL}/`,
  priceRange: '₹',
  address: { '@type': 'PostalAddress', addressCountry: 'IN' },
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
};

export default async function HomePage({ searchParams }) {
  const sp = await searchParams;
  const q = sp?.q || '';
  if (q && q.trim()) {
    const params = new URLSearchParams(sp);
    redirect(`/products?${params.toString()}`);
  }
  const category = sp?.category || 'all';
  const merchant = sp?.merchant || 'all';
  const country = sp?.country || 'in';

  // On the main "All" feed, require at least 15 % off so random undiscounted products
  // (motorcycles at list price, zero-deal items) don't pollute the homepage.
  // Category/merchant-filtered views skip this so users can browse everything.
  const isUnfilteredFeed = category === 'all' && merchant === 'all' && !q;
  const { items: rawDeals, hasMore } = await fetchDeals({
    q,
    category,
    merchant,
    country,
    sort: 'newest',
    ...(isUnfilteredFeed ? { minDiscount: 15 } : {}),
  });

  // Resolve each deal's canonical product page in parallel.
  // findMatchingProductId caches for 5 minutes, so only the first cold-render per deal
  // makes a real API call; subsequent renders within that window are free.
  // New deals polled client-side by DealsFeed won't have linkedProductId and correctly
  // fall back to the /deal/[id] link in DealCard.
  const deals = await Promise.all(
    rawDeals.map(async (d) => {
      if (!d.productId || !d.merchant) return d;
      const linkedProductId = await findMatchingProductId(d.productId, d.merchant);
      return linkedProductId ? { ...d, linkedProductId } : d;
    })
  );

  return (
    <>
      {/* Page-level schemas — only on the homepage where the matching HTML exists */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(storeSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8">
        {/* Unified Hero: Search Bar + AI Deal Scanner + Mascot + Trust Strip */}
        <HeroSearch />

        {/* Top Stores Tracked Brand Grid */}
        <TopStoresGrid />

        {/* Shop By Top Categories */}
        <ShopByTopCategories />

        {/* ═══ FESTIVE SEASON BANNER — Amazon GIF + Flipkart BBD live now ═══ */}
        <div className="mb-4 overflow-hidden rounded-2xl bg-gradient-to-r from-[#FF6B00] via-[#FF8C00] to-[#FFB800]">
          <div className="flex flex-col items-center gap-3 px-4 py-4 text-center sm:flex-row sm:justify-between sm:text-left">
            <div className="flex items-center gap-3">
              <span className="shrink-0 text-3xl">🎉</span>
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-white/80">Live Right Now</p>
                <h2 className="text-base font-black leading-tight text-white sm:text-lg">
                  Amazon Great Indian Festival &amp; Flipkart Big Billion Days 2026
                </h2>
                <p className="mt-0.5 text-[11px] font-semibold text-white/90">
                  Biggest sale of the year. Use our price tracker to find what&apos;s actually discounted.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <a
                href="/?merchant=amazon"
                className="rounded-xl bg-white px-3 py-2 text-[11.5px] font-extrabold text-[#FF6B00] shadow-sm hover:bg-orange-50 transition-colors"
              >
                🛍️ Amazon GIF
              </a>
              <a
                href="/?merchant=flipkart"
                className="rounded-xl bg-white px-3 py-2 text-[11.5px] font-extrabold text-[#2563eb] shadow-sm hover:bg-blue-50 transition-colors"
              >
                ⚡ Flipkart BBD
              </a>
            </div>
          </div>
          {/* Animated live pulse strip */}
          <div className="flex items-center gap-2 bg-black/20 px-4 py-1.5">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white"></span>
            </span>
            <p className="text-[10.5px] font-bold text-white">
              ShoppersDeals is tracking live prices across both sales — deals below are verified against 90-day history
            </p>
          </div>
        </div>

        {/* Fix #10: Recently Viewed rail — localStorage-backed, only shows after first visit */}
        <RecentlyViewed />

        {/* Filter Tabs & Live Feed */}
        <FilterBar category={category} merchant={merchant} />
        <DealsFeed
          type="deals"
          initialItems={deals}
          initialHasMore={hasMore}
          emptyTitle="No Deals Found"
          emptySub="Try clearing filters or check back in a few seconds as new live deals arrive."
        />

        {/* Smart Buyer's Intelligence & Monthly Guides */}
        <SmartBuyersGuidesSection />

        {/* Value Proposition Highlights */}
        <FeatureHighlights />

        {/* 3-Step Explainer Guide */}
        <HowItWorks />

        {/* Browser Extension & App Promo Banner */}
        <ExtensionPromoBanner />

        {/* Editorial Guide & Real-World Savings Authority Copy */}
        <SeoFooterContent />

        {/* FAQ section — matches the FAQPage JSON-LD above exactly.
            Google requires the schema answers to be readable as visible HTML on the page. */}
        <section aria-labelledby="faq-heading" className="mx-auto mb-12 mt-14 max-w-3xl px-0">
          <h2
            id="faq-heading"
            className="mb-6 text-xl font-extrabold tracking-tight text-[#0f172a] sm:text-2xl"
          >
            Frequently Asked Questions
          </h2>
          <div className="divide-y divide-[#e5e7eb] rounded-2xl border border-[#e5e7eb] bg-white shadow-xs">
            {FAQ_ITEMS.map(({ q, a }) => (
              <details key={q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold text-[#0f172a] marker:hidden">
                  {q}
                  <svg
                    className="h-4 w-4 shrink-0 text-[#94a3b8] transition-transform group-open:rotate-180"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </summary>
                <p className="mt-3 text-sm leading-6 text-[#475569]">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
