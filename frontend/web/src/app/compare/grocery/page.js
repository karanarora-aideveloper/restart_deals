import { Suspense } from 'react';
import GroceryCompareClient from '@/components/grocery/GroceryCompareClient';
import { SITE_URL } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Blinkit vs Swiggy Instamart | 10-Min Live Grocery Price Comparison',
  description:
    'Compare live 10-minute grocery delivery prices between Blinkit and Swiggy Instamart at your exact doorstep location across India. Find who is cheaper for Milk, Butter, Atta, Ghee, and Daily Staples.',
  alternates: { canonical: `${SITE_URL}/compare/grocery` },
  keywords: [
    'blinkit vs instamart',
    'quick commerce comparison',
    'blinkit dark store delivery time',
    'swiggy instamart delivery time',
    'grocery price comparison india',
    'cheapest quick grocery app',
    'amul butter price blinkit instamart',
  ],
  openGraph: {
    title: 'Blinkit vs Swiggy Instamart | 10-Min Live Grocery Price Comparison',
    description:
      'Compare live grocery prices between Blinkit and Swiggy Instamart at your exact doorstep location across India. Real-time dark store prices, delivery ETAs, and net basket savings calculator.',
    url: `${SITE_URL}/compare/grocery`,
    siteName: 'ShoppersDeals',
    type: 'website',
  },
};

export default function GroceryComparePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: SITE_URL,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Compare',
            item: `${SITE_URL}/compare`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: 'Quick Commerce Grocery',
            item: `${SITE_URL}/compare/grocery`,
          },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'How do I compare Blinkit and Swiggy Instamart delivery times at my location?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Tap "Use My GPS" or enter your delivery address/pincode. ShoppersDeals instantly connects to the nearest Blinkit Hub and Swiggy Instamart Pod to display real-time doorstep delivery minutes and active dark store status.',
            },
          },
          {
            '@type': 'Question',
            name: 'Which quick commerce store is cheaper: Blinkit or Swiggy Instamart?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Pricing varies dynamically by category, pincode, and real-time merchant discounting. Typically, Swiggy Instamart offers stronger discounts on packaged snacks, beverages, and chocolates, while Blinkit frequently leads on dairy, fresh atta, and cooking staples.',
            },
          },
          {
            '@type': 'Question',
            name: 'Are grocery prices and delivery times verified in real-time?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes. Delivery ETAs, active dark store pod IDs, and product pricing reflect live quick commerce APIs based on your exact doorstep latitude and longitude coordinates.',
            },
          },
        ],
      },
    ],
  };

  return (
    <main className="min-h-screen bg-[#faf8ff] pb-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Suspense
        fallback={
          <div className="mx-auto max-w-7xl px-4 py-20 text-center text-sm font-bold text-slate-500">
            Connecting to live quick commerce dark stores...
          </div>
        }
      >
        <GroceryCompareClient />
      </Suspense>
    </main>
  );
}
