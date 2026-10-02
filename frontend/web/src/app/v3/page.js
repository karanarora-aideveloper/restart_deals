import { fetchDeals, findMatchingProductId } from '@/lib/api';
import V3VersionSwitcher from '@/components/v3/V3VersionSwitcher';
import V3SubHeader from '@/components/v3/V3SubHeader';
import V3HeroCarousel from '@/components/v3/V3HeroCarousel';
import V3Hero from '@/components/v3/V3Hero';
import V3CompareSection from '@/components/v3/V3CompareSection';
import V3FeedContainer from '@/components/v3/V3FeedContainer';
import V3CreditCardTeaser from '@/components/v3/V3CreditCardTeaser';
import V3StoreDealsRail from '@/components/v3/V3StoreDealsRail';
import V3SmartScannerBanner from '@/components/v3/V3SmartScannerBanner';
import V3ExtensionSection from '@/components/v3/V3ExtensionSection';
import V3StoresSection from '@/components/v3/V3StoresSection';
import V3FaqSection from '@/components/v3/V3FaqSection';

export const metadata = {
  title: 'ShoppersDeals V3 — Authentic Deal Radar & Price History',
  description: 'Side-by-side competitor comparison: Clean Buyhatke deal radar with Flipkart-grade ergonomics and CashKaro-style promotional banners.',
  robots: { index: false, follow: false }, // Keep preview page unindexed during review
};

export default async function V3HomePage({ searchParams }) {
  const sp = await searchParams;
  const category = sp?.category || 'all';
  const merchant = sp?.merchant || 'all';
  const country = sp?.country || 'in';

  // Fetch initial batch of verified deals strictly for India locale (INR currency)
  const { items: rawDeals, hasMore } = await fetchDeals({
    category,
    merchant,
    country: (country || 'in').toLowerCase(),
    sort: 'newest',
    minDiscount: 15,
  });

  // Resolve matching product IDs for canonical 90-day price history charts
  const deals = await Promise.all(
    rawDeals.map(async (d) => {
      if (!d.productId || !d.merchant) return d;
      const linkedProductId = await findMatchingProductId(d.productId, d.merchant);
      return linkedProductId ? { ...d, linkedProductId } : d;
    })
  );

  return (
    <div className="min-h-screen bg-[#FAFAFC]">
      {/* 1. Side-by-Side Review Floating Switcher */}
      <V3VersionSwitcher />

      {/* 2. Sub-Header Navigation Strip */}
      <V3SubHeader activeTab="deals" />

      {/* 3. Promotional Hero Carousel (Resonates 100% with ShoppersDeals Real Capabilities) */}
      <V3HeroCarousel />

      {/* 4. Hero Section with Instant URL Scanner */}
      <V3Hero />

      {/* 5. Multi-Category Comparison Cards (6-Card Symmetric Grid) */}
      <V3CompareSection />

      {/* 6. PRIMARY HERO: Unmissable Verified Deals Feed */}
      <V3FeedContainer
        initialDeals={deals}
        initialHasMore={hasMore}
        category={category}
        country={country || 'in'}
      />

      {/* 7. Compact 1-Row Credit Card & Bank Offers Teaser (Links to /credit-cards) */}
      <V3CreditCardTeaser />

      {/* 8. Top Monitored Stores & Verified Deals Rail */}
      <div id="stores">
        <V3StoreDealsRail />
      </div>

      {/* 9. Smart Deal Scanner 4-Step Value Proposition */}
      <V3SmartScannerBanner />

      {/* 10. Extension & Mobile App Conversion Banner */}
      <V3ExtensionSection />

      {/* 11. Over 100K+ Stores Monitored 24/7 Grid */}
      <V3StoresSection />

      {/* 12. FAQ Accordion & Knowledge Base */}
      <V3FaqSection />
    </div>
  );
}
