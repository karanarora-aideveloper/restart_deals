import { Suspense } from 'react';
import GroceryCompareClient from '@/components/grocery/GroceryCompareClient';
import { SITE_URL } from '@/lib/config';

export const metadata = {
  title: 'Blinkit vs Swiggy Instamart Gwalior | 10-Min Grocery Price Comparison',
  description:
    'Compare live grocery prices between Blinkit and Swiggy Instamart across Gwalior dark stores (City Centre, Lashkar, Thatipur, Morar, Airport Road). Find who is cheaper for Milk, Butter, Atta, Ghee, and Daily Staples.',
  alternates: { canonical: `${SITE_URL}/compare/grocery` },
  keywords: [
    'blinkit vs instamart gwalior',
    'blinkit gwalior dark store',
    'swiggy instamart gwalior delivery',
    'grocery price comparison gwalior',
    'quick commerce gwalior',
    'cheapest grocery app gwalior',
    'amul butter price blinkit instamart',
  ],
  openGraph: {
    title: 'Blinkit vs Swiggy Instamart Gwalior | 10-Min Grocery Price Comparison',
    description:
      'Compare live grocery prices between Blinkit and Swiggy Instamart across Gwalior. Real-time dark store prices, delivery ETAs, and net basket savings calculator.',
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
            name: 'Grocery (Gwalior)',
            item: `${SITE_URL}/compare/grocery`,
          },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Does Blinkit deliver in Gwalior?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes, Blinkit operates multiple active dark store hubs in Gwalior including Govindpuri / City Centre, Naukar Hospital / Lohiya Bazaar (Lashkar), Kalpi Road / Thatipur, and Airport Road, offering 10 to 15-minute deliveries.',
            },
          },
          {
            '@type': 'Question',
            name: 'Does Swiggy Instamart deliver in Gwalior?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes, Swiggy Instamart delivers across key Gwalior residential hubs including City Centre, Lashkar, Morar, Thatipur, and DD Nagar / Airport Road via dedicated dark store pods.',
            },
          },
          {
            '@type': 'Question',
            name: 'Which is cheaper in Gwalior: Blinkit or Swiggy Instamart?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Pricing depends on the category and dark store inventory. Typically, Swiggy Instamart offers stronger discounts on packaged snacks, chocolates, and cold beverages, while Blinkit frequently leads with lower prices on fresh dairy, branded wheat atta, and cooking oils.',
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
            Connecting to Gwalior quick commerce dark stores...
          </div>
        }
      >
        <GroceryCompareClient />
      </Suspense>
    </main>
  );
}
