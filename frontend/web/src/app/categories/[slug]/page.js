import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchDeals } from '@/lib/api';
import { SITE_URL } from '@/lib/config';
import { formatInr, isUsableImageUrl } from '@/lib/affiliate';

export const revalidate = 300;

// ─── Category config ────────────────────────────────────────────────────────
const CATEGORY_META = {
  electronics: {
    name: 'Electronics & Mobiles',
    headline: 'Best Electronics & Mobile Deals',
    description:
      'Discover verified price drops on Smartphones, Laptops, TWS Earbuds, Smartwatches, and 4K TVs from Amazon and Flipkart. Tracked live by ShoppersDeals.',
    emoji: '📱',
    apiCategory: 'electronics',
    keywords: 'electronics deals, mobile phone offers, laptop discount, earbuds sale, Amazon Flipkart electronics',
    subHubs: [
      { label: 'Top 20 Earbuds & Audio', href: '/best/earbuds-headphones' },
      { label: 'Top 20 Laptops', href: '/best/laptops' },
      { label: 'Top 20 Smartwatches', href: '/best/smartwatches' },
      { label: 'Top 20 4K Smart TVs', href: '/best/televisions' },
      { label: 'Top 20 Mobile Accessories', href: '/best/mobile-accessories' },
    ],
  },
  fashion: {
    name: 'Fashion & Apparel',
    headline: 'Best Fashion & Apparel Deals',
    description:
      'Shop the biggest discounts on T-Shirts, Dresses, Jeans, Ethnic Wear, Sneakers, and Bags from Myntra, Amazon Fashion, and AJIO. Updated live.',
    emoji: '👗',
    apiCategory: 'fashion',
    keywords: 'fashion deals India, clothing discount, shoes sale, Myntra offers, Amazon fashion',
    subHubs: [
      { label: 'Top 20 Running Shoes', href: '/best/running-shoes' },
      { label: 'Top 20 Men T-Shirts', href: '/best/mens-tshirts' },
      { label: 'Top 20 Women Footwear', href: '/best/women-footwear' },
      { label: 'Top 20 Watches', href: '/best/watches' },
    ],
  },
  home: {
    name: 'Home & Kitchen',
    headline: 'Best Home & Kitchen Deals',
    description:
      'Find the lowest prices on Air Fryers, Cookware, Robot Vacuums, and Home Decor from Amazon and Flipkart. Real price history, zero fake discounts.',
    emoji: '🍳',
    apiCategory: 'home',
    keywords: 'home kitchen deals, air fryer discount, appliance sale, Amazon home deals',
    subHubs: [
      { label: 'Top 20 Kitchen & Dining', href: '/best/kitchen-dining' },
      { label: 'Top 20 Home Decor', href: '/best/home-decor' },
      { label: 'Top 20 Cleaning Essentials', href: '/best/cleaning-essentials' },
      { label: 'Top 20 Storage & Organizers', href: '/best/storage-organizers' },
    ],
  },
  beauty: {
    name: 'Beauty & Personal Care',
    headline: 'Best Beauty & Personal Care Deals',
    description:
      'Track real price drops on Skincare Serums, Makeup, Hair Care, and Fragrances from Nykaa, Amazon, and Myntra. AI-monitored, always fresh.',
    emoji: '💄',
    apiCategory: 'beauty',
    keywords: 'beauty deals India, skincare discount, makeup sale, Nykaa offers, hair care deals',
    subHubs: [
      { label: 'Top 20 Skincare Deals', href: '/best/skincare' },
      { label: 'Top 20 Bath & Body', href: '/best/bath-body' },
      { label: 'Top 20 Haircare', href: '/best/haircare' },
    ],
  },
  fitness: {
    name: 'Fitness & Sports',
    headline: 'Best Fitness & Sports Deals',
    description:
      'Get the best prices on Whey Protein, Dumbbells, Yoga Mats, Cycles, and Sportswear from Amazon and Flipkart. Updated every 5 minutes.',
    emoji: '🏋️',
    apiCategory: 'fitness',
    keywords: 'fitness deals India, whey protein discount, gym equipment sale, sports accessories offers',
    subHubs: [
      { label: 'Top 20 Supplements & Whey', href: '/best/supplements' },
      { label: 'Top 20 Gym Equipment', href: '/best/gym-equipment' },
      { label: 'Top 20 Fitness Gear', href: '/best/fitness-gear' },
    ],
  },
  kitchen: {
    name: 'Kitchen & Dining',
    headline: 'Best Kitchen & Dining Deals',
    description:
      'Shop lowest prices on Induction Cooktops, Cookware, Chimneys, and Kitchen Appliances from Amazon and Flipkart.',
    emoji: '🍳',
    apiCategory: 'kitchen',
    keywords: 'kitchen deals, cookware offers, induction cooktop discount, Amazon kitchen sale',
    subHubs: [
      { label: 'Top 20 Kitchen & Dining', href: '/best/kitchen-dining' },
      { label: 'Induction Cooktops Guide', href: '/blog/best-induction-cooktops-india-surge-protection-2026' },
      { label: 'Air Fryers Guide', href: '/blog/best-air-fryers-india-digital-rapid-air-2026' },
    ],
  },
  'men-fashion': {
    name: "Men's Fashion & Footwear",
    headline: "Best Men's Fashion & Sneaker Deals",
    description:
      "Explore biggest discounts on Men's T-Shirts, Sneakers, Jeans, Formal Shoes, and Watches from Myntra, Amazon, and Ajio.",
    emoji: '👔',
    apiCategory: 'men-fashion',
    keywords: 'mens fashion deals, sneakers discount, mens tshirts sale, Myntra mens clothing',
    subHubs: [
      { label: 'Top 20 Running Shoes', href: '/best/running-shoes' },
      { label: "Top 20 Men's T-Shirts", href: '/best/mens-tshirts' },
      { label: 'Top 20 Watches', href: '/best/watches' },
    ],
  },
  'women-fashion': {
    name: "Women's Fashion & Ethnic Wear",
    headline: "Best Women's Fashion Deals",
    description:
      "Find genuine discounts on Kurtis, Dresses, Sarees, Handbags, and Footwear from Myntra, Nykaa Fashion, and Amazon.",
    emoji: '👗',
    apiCategory: 'women-fashion',
    keywords: 'womens fashion deals, kurtis discount, dresses sale, Myntra womenswear',
    subHubs: [
      { label: 'Top 20 Women Footwear', href: '/best/women-footwear' },
      { label: 'Top 20 Watches', href: '/best/watches' },
    ],
  },
  wellness: {
    name: 'Wellness & Health',
    headline: 'Best Health & Wellness Deals',
    description:
      'Verified discounts on Health Monitors, Weighing Scales, Massagers, and Personal Care from top brands.',
    emoji: '🌿',
    apiCategory: 'wellness',
    keywords: 'wellness deals India, health monitors discount, personal care offers',
    subHubs: [
      { label: 'Top 20 Supplements & Whey', href: '/best/supplements' },
      { label: 'Top 20 Fitness Gear', href: '/best/fitness-gear' },
    ],
  },
  general: {
    name: 'Lightning & Clearance Loot',
    headline: 'Lightning Flash Deals & Clearance Loot',
    description:
      'Curated under ₹99 finds, price error glitches, and flat 80% clearance drops across all Indian e-commerce stores.',
    emoji: '⚡',
    apiCategory: 'general',
    keywords: 'lightning deals India, loot deals today, clearance sale Amazon Flipkart',
    subHubs: [
      { label: 'Hot Deals Feed', href: '/hot' },
      { label: 'Top 20 Mobile Accessories', href: '/best/mobile-accessories' },
    ],
  },
};

const VALID_SLUGS = Object.keys(CATEGORY_META);

// ─── Static params ───────────────────────────────────────────────────────────
export async function generateStaticParams() {
  return VALID_SLUGS.map((slug) => ({ slug }));
}

// ─── Metadata ────────────────────────────────────────────────────────────────
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const cat = CATEGORY_META[slug];
  if (!cat) return { title: 'Category Not Found' };

  return {
    title: `${cat.headline} — Today's Verified Offers`,
    description: cat.description,
    keywords: cat.keywords,
    alternates: { canonical: `/categories/${slug}` },
    openGraph: {
      type: 'website',
      title: `${cat.headline} | ShoppersDeals`,
      description: cat.description,
      url: `${SITE_URL}/categories/${slug}`,
      images: [`${SITE_URL}/categories/${slug}.jpg`],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${cat.headline} | ShoppersDeals`,
      description: cat.description,
    },
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function CategoryPage({ params }) {
  const { slug } = await params;
  const cat = CATEGORY_META[slug];
  if (!cat) notFound();

  // Server-side deal fetch — filtered by this category
  const { items: deals = [] } = await fetchDeals({
    category: cat.apiCategory,
    limit: 40,
    sort: 'newest',
    revalidate: 300,
  });

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Categories', item: `${SITE_URL}/categories` },
      { '@type': 'ListItem', position: 3, name: cat.name, item: `${SITE_URL}/categories/${slug}` },
    ],
  };

  const collectionPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: cat.headline,
    description: cat.description,
    url: `${SITE_URL}/categories/${slug}`,
    breadcrumb: breadcrumbSchema,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageSchema) }}
      />
      <div className="mx-auto w-full max-w-[1440px] px-4 py-6 pb-20 md:px-8">
        {/* Breadcrumb */}
        <nav className="mb-4 flex items-center gap-1.5 text-xs text-[#64748b]">
          <Link href="/" className="hover:text-brand">Home</Link>
          <span>/</span>
          <Link href="/categories" className="hover:text-brand">Categories</Link>
          <span>/</span>
          <span className="font-semibold text-[#0f172a]">{cat.name}</span>
        </nav>

        {/* Hero */}
        <div className="mb-8 rounded-3xl border border-[#cbd5e1] bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] p-6 sm:p-10 text-white shadow-xl">
          <div className="flex flex-col items-center text-center">
            <span className="text-5xl mb-3">{cat.emoji}</span>
            <h1 className="text-2xl font-black tracking-tight sm:text-4xl">{cat.headline}</h1>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[#94a3b8] sm:text-sm">
              {cat.description}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Link
                href={`/?category=${cat.apiCategory}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2 text-xs font-bold text-white hover:opacity-90 transition-opacity"
              >
                Browse All Deals →
              </Link>
              {cat.subHubs && cat.subHubs.map((sub) => (
                <Link
                  key={sub.href}
                  href={sub.href}
                  className="inline-flex items-center rounded-full border border-gray-700 bg-gray-800/80 px-3.5 py-1.5 text-xs font-bold text-gray-200 hover:border-brand hover:text-white transition-all"
                >
                  {sub.label} →
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Deal Grid */}
        {deals.length > 0 ? (
          <section>
            <h2 className="mb-4 text-lg font-black text-[#0f172a] sm:text-xl">
              🔥 Latest {cat.name} Deals
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {deals.map((deal) => {
                const dealId = deal._id || deal.id;
                const href = deal.productId ? `/product/${dealId}` : `/deal/${dealId}`;
                return (
                  <Link
                    key={dealId}
                    href={href}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-1"
                  >
                    {isUsableImageUrl(deal.imageUrl) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={deal.imageUrl}
                        alt={deal.title || 'Deal'}
                        className="h-40 w-full object-contain p-3"
                        loading="lazy"
                      />
                    )}
                    <div className="flex flex-col flex-1 p-3 pt-1">
                      <p className="line-clamp-2 text-[11px] font-semibold text-[#0f172a] leading-snug">
                        {deal.title}
                      </p>
                      {deal.dealPrice && (
                        <div className="mt-auto pt-2 flex items-baseline gap-1.5 flex-wrap">
                          <span className="text-sm font-black text-brand">
                            {formatInr(deal.dealPrice, deal.country || 'IN')}
                          </span>
                          {deal.previousPrice && deal.previousPrice > deal.dealPrice ? (
                            <span className="text-[10px] text-[#94a3b8] line-through">
                              Was {formatInr(deal.previousPrice, deal.country || 'IN')}
                            </span>
                          ) : deal.originalPrice && deal.originalPrice > deal.dealPrice ? (
                            <span className="text-[10px] text-[#94a3b8] line-through">
                              MRP {formatInr(deal.originalPrice, deal.country || 'IN')}
                            </span>
                          ) : null}
                        </div>
                      )}
                      {deal.discountPercentage && deal.discountPercentage > 0 && (
                        <span className="mt-1 inline-block rounded-md bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-[9.5px] font-black">
                          {deal.discountPercentage}% DROP
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : (
          <div className="rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-10 text-center">
            <p className="text-sm text-[#64748b]">Loading latest {cat.name} deals…</p>
            <Link
              href={`/?category=${cat.apiCategory}`}
              className="mt-3 inline-block text-sm font-bold text-brand hover:underline"
            >
              Browse {cat.name} deals →
            </Link>
          </div>
        )}

        {/* Back link */}
        <div className="mt-10 text-center">
          <Link href="/categories" className="text-xs font-semibold text-[#64748b] hover:text-brand">
            ← Back to All Categories
          </Link>
        </div>
      </div>
    </>
  );
}
