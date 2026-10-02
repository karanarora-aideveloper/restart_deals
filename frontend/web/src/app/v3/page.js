import { fetchDeals, findMatchingProductId } from '@/lib/api';
import V3VersionSwitcher from '@/components/v3/V3VersionSwitcher';
import V3SubHeader from '@/components/v3/V3SubHeader';
import V3Hero from '@/components/v3/V3Hero';
import V3CompareSection from '@/components/v3/V3CompareSection';
import V3SmartScannerBanner from '@/components/v3/V3SmartScannerBanner';
import V3FeedContainer from '@/components/v3/V3FeedContainer';
import V3ExtensionSection from '@/components/v3/V3ExtensionSection';
import V3StoresSection from '@/components/v3/V3StoresSection';
import V3FaqSection from '@/components/v3/V3FaqSection';

export const metadata = {
  title: 'ShoppersDeals V3 — Buyhatke Architecture & Aesthetic Clone',
  description: 'Side-by-side competitor comparison: Buyhatke exact layout and architecture clone powered by ShoppersDeals autonomous price drop radar.',
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

      {/* 2. Buyhatke-Style Sub-Header Navigation Strip */}
      <V3SubHeader activeTab="deals" />

      {/* 3. Buyhatke Exact Hero Section */}
      <V3Hero />

      {/* 4. Buyhatke Multi-Category Comparison Cards */}
      <V3CompareSection />

      {/* 5. Smart Deal Scanner 4-Step Value Proposition */}
      <V3SmartScannerBanner />

      {/* 6. Unmissable Deals Feed with Buyhatke Layout & Filter Pills */}
      <V3FeedContainer
        initialDeals={deals}
        initialHasMore={hasMore}
        category={category}
        country={country || 'in'}
      />

      {/* 7. Buyhatke Extension & Mobile App Conversion Banner */}
      <V3ExtensionSection />

      {/* 8. Over 100K+ Stores Monitored 24/7 Grid */}
      <V3StoresSection />

      {/* 9. FAQ Accordion & Knowledge Base */}
      <V3FaqSection />
    </div>
  );
}
