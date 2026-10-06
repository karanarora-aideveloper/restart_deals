import { redirect } from 'next/navigation';
import { fetchDeals, findMatchingProductId } from '@/lib/api';
import { SITE_URL } from '@/lib/config';

import V3SubHeader from '@/components/v3/V3SubHeader';
import V3CategoriesRail from '@/components/v3/V3CategoriesRail';
import V3HeroCarousel from '@/components/v3/V3HeroCarousel';
import V3Hero from '@/components/v3/V3Hero';
import V3CompareSection from '@/components/v3/V3CompareSection';
import V3FeedContainer from '@/components/v3/V3FeedContainer';
import V3CreditCardTeaser from '@/components/v3/V3CreditCardTeaser';
import V3SmartBuyersGuides from '@/components/v3/V3SmartBuyersGuides';
import V3StoreDealsRail from '@/components/v3/V3StoreDealsRail';
import V3SmartScannerBanner from '@/components/v3/V3SmartScannerBanner';
import V3ExtensionSection from '@/components/v3/V3ExtensionSection';
import V3StoresSection from '@/components/v3/V3StoresSection';
import V3FaqSection from '@/components/v3/V3FaqSection';

export const metadata = {
  title: 'ShoppersDeals: Best Live Deals, Price History & Coupons',
  description:
    'Find genuine live price drops and track 90-day price history across Amazon, Flipkart, Myntra, and Meesho. Compare prices side-by-side with zero fake discounts.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'ShoppersDeals: Best Live Deals, Price History & Coupons',
    description:
      'Find genuine live price drops and track 90-day price history across Amazon, Flipkart, Myntra, and Meesho. Compare prices side-by-side with zero fake discounts.',
    url: `${SITE_URL}/`,
    siteName: 'ShoppersDeals',
    images: [
      {
        url: `${SITE_URL}/logo.png`,
        width: 1200,
        height: 630,
        alt: 'ShoppersDeals Deal Radar',
      },
    ],
    locale: 'en_IN',
    type: 'website',
  },
};

const storeSchema = {
  '@context': 'https://schema.org',
  '@type': 'Store',
  name: 'ShoppersDeals',
  image: `${SITE_URL}/logo.png`,
  url: `${SITE_URL}/`,
  priceRange: '₹',
  address: { '@type': 'PostalAddress', addressCountry: 'IN' },
};

const FAQ_ITEMS = [
  {
    q: 'How does the 90-day price history tracker work?',
    a: 'Our autonomous bots monitor products continuously via rotating anti-detect residential proxies. Every day, we record real selling prices and bank offers into an immutable checkpoint. When you search or paste a link, we plot the full 90-day price curve so you know whether the current price is genuinely low or marked up.',
  },
  {
    q: 'How do you detect fake discounts during festival sales (Amazon GIF / Flipkart BBD)?',
    a: 'Retailers frequently inflate the printed MRP or bump the selling price 7 to 10 days before major sales, only to claim a "50% off" discount. Our Smart Deal Scanner compares the live price against the 90-day average selling price, instantly flagging artificial discount claims.',
  },
  {
    q: 'What is the difference between an MRP discount and a Genuine Price Drop?',
    a: 'MRP discount is calculated against the maximum retail price printed on the box (which is often arbitrary and permanently discounted). A Genuine Price Drop is calculated against what the item actually sold for yesterday or last week. We clearly separate both metrics on every deal card.',
  },
  {
    q: 'How do I receive instant price drop alerts for products I track?',
    a: 'You can tap the bell icon or save any product to your OneList. When the price drops below your desired threshold across Amazon, Flipkart, or Nykaa, our Telegram Bot (@ShoppersDealsAlertBot) and browser WebPush notify you in under 60 seconds.',
  },
  {
    q: 'Is the ShoppersDeals browser extension and website 100% free?',
    a: 'Yes, 100% free. We never charge users. When you click our verified deals or buy through our links, we may earn a small affiliate commission from stores at no extra cost to you.',
  },
];

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

  // Filter deals: on unfiltered main feed require min 15% discount
  const isUnfilteredFeed = category === 'all' && merchant === 'all' && !q;
  const { items: rawDeals, hasMore } = await fetchDeals({
    q,
    category,
    merchant,
    country: (country || 'in').toLowerCase(),
    sort: 'newest',
    ...(isUnfilteredFeed ? { minDiscount: 15 } : {}),
  });

  // Resolve matching product IDs for canonical 90-day price history charts
  const deals = await Promise.all(
    rawDeals.map(async (d) => {
      if (!d.productId || !d.merchant) return d;
      const linkedProductId = await findMatchingProductId(d.productId, d.merchant);
      return linkedProductId ? { ...d, linkedProductId } : d;
    })
  );

  // Guarantee strict newest-first sorting by authentic deal publication timestamp
  deals.sort((a, b) => {
    const timeA = new Date(a.createdAt || a.postedAt || a.updatedAt || a.lastVerifiedAt || 0).getTime();
    const timeB = new Date(b.createdAt || b.postedAt || b.updatedAt || b.lastVerifiedAt || 0).getTime();
    return timeB - timeA;
  });

  return (
    <>
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(storeSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="min-h-screen bg-[#FAFAFC]">
        {/* 1. Sub-Header Navigation Strip */}
        <V3SubHeader activeTab="deals" />

        {/* 2. Promotional Hero Carousel with 16:9 3D AI Illustrations */}
        <V3HeroCarousel />

        {/* 3. Top Categories Strip with 3D AI Illustrations */}
        <V3CategoriesRail />

        {/* 4. Hero Section with Instant URL Scanner */}
        <V3Hero />

        {/* 5. Multi-Category Comparison Cards (6-Card Symmetric Grid) */}
        <V3CompareSection />

        {/* 6. PRIMARY HERO: Unmissable Verified Deals Feed */}
        <div id="deals">
          <V3FeedContainer
            initialDeals={deals}
            initialHasMore={hasMore}
            category={category}
            country={country || 'in'}
          />
        </div>

        {/* 7. Compact 1-Row Credit Card & Bank Offers Teaser (Links to /credit-cards) */}
        <V3CreditCardTeaser />

        {/* 8. Smart Buyer's Guides & Multi-Store Benchmarks */}
        <V3SmartBuyersGuides />

        {/* 9. Top Monitored Stores & Verified Deals Rail */}
        <div id="stores">
          <V3StoreDealsRail />
        </div>

        {/* 10. Smart Deal Scanner 4-Step Value Proposition */}
        <V3SmartScannerBanner />

        {/* 11. Extension & Mobile App Conversion Banner */}
        <V3ExtensionSection />

        {/* 12. Over 100K+ Stores Monitored 24/7 Grid */}
        <V3StoresSection />

        {/* 13. FAQ Accordion & Knowledge Base */}
        <V3FaqSection />
      </div>
    </>
  );
}
