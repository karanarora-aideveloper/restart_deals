import CategoriesClient from '@/components/CategoriesClient';
import { SITE_URL } from '@/lib/config';

export const metadata = {
  title: 'Browse Deals by Category & Collections',
  description:
    'Explore verified deals, price drops, and 3D curated loot collections across Electronics, Mobiles, Fashion, Home & Kitchen, and Beauty from Amazon, Flipkart, and Myntra.',
  alternates: { canonical: '/categories' },
  openGraph: {
    type: 'website',
    title: 'Browse Deals by Category — ShoppersDeals',
    description:
      'Explore verified deals, price drops, and 3D curated loot collections across Electronics, Mobiles, Fashion, Home & Kitchen, and Beauty.',
    url: `${SITE_URL}/categories`,
    images: [`${SITE_URL}/logo.png`],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Browse Deals by Category — ShoppersDeals',
    description:
      'Explore verified deals and price drop feeds across Amazon, Flipkart, Myntra, and more.',
    images: [`${SITE_URL}/logo.png`],
  },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
    { '@type': 'ListItem', position: 2, name: 'Categories', item: `${SITE_URL}/categories` },
  ],
};

export default function CategoriesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <CategoriesClient />
    </>
  );
}
