import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchTopProductsForSubcategory } from '@/lib/api';
import { getMerchantInfo, formatInr, isUsableImageUrl, getAffiliateUrl } from '@/lib/affiliate';
import { SITE_URL } from '@/lib/config';
import { resolveBestCategory, TOP_CURATED_BEST_SLUGS } from '@/lib/bestCategories';

export const revalidate = 300; // 5-minute ISR cache

export async function generateStaticParams() {
  return Object.keys(TOP_CURATED_BEST_SLUGS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const config = resolveBestCategory(slug);
  if (!config) return { title: 'Best Products in India' };

  const canonicalUrl = `${SITE_URL}/best/${slug}`;
  return {
    title: `${config.title} (2026) — Lowest Price Comparison`,
    description: config.description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `${config.title} (2026) | ShoppersDeals`,
      description: config.description,
      url: canonicalUrl,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${config.title} (2026)`,
      description: config.description,
    },
  };
}

function cleanTitle(raw) {
  if (!raw) return 'Tracked Product';
  const first = raw.split('|')[0].trim();
  return first.length >= 12 ? first : raw;
}

export default async function BestCategoryPage({ params }) {
  const { slug } = await params;
  const config = resolveBestCategory(slug);
  if (!config) notFound();

  const products = await fetchTopProductsForSubcategory({
    subcategory: config.subcategory,
    category: config.category || 'all',
    limit: 20,
  });

  const validProducts = (products || []).filter((p) => isUsableImageUrl(p.imageUrl));

  // 1. Structured Data: ItemList Schema (Powers Google Carousels)
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: config.heading,
    description: config.description,
    numberOfItems: validProducts.length,
    itemListElement: validProducts.map((prod, index) => {
      const merchant = getMerchantInfo(prod.merchant || prod.cleanUrl);
      return {
        '@type': 'ListItem',
        position: index + 1,
        name: cleanTitle(prod.title),
        url: `${SITE_URL}/product/${prod._id || prod.productId}`,
        image: prod.imageUrl,
        offers: {
          '@type': 'Offer',
          priceCurrency: 'INR',
          price: prod.price || undefined,
          availability: 'https://schema.org/InStock',
          seller: {
            '@type': 'Organization',
            name: merchant.label,
          },
        },
      };
    }),
  };

  // 2. Structured Data: BreadcrumbList Schema
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Categories', item: `${SITE_URL}/categories` },
      { '@type': 'ListItem', position: 3, name: config.title, item: `${SITE_URL}/best/${slug}` },
    ],
  };

  // 3. Structured Data: FAQPage Schema
  const faqs = [
    {
      q: `What is the best-rated ${config.slug.replace(/-/g, ' ')} in India right now?`,
      a: validProducts[0]
        ? `The top-rated choice right now is ${cleanTitle(validProducts[0].title)}, currently available for ₹${(validProducts[0].price || 0).toLocaleString('en-IN')} on ${getMerchantInfo(validProducts[0].merchant).label}.`
        : `Check our top 20 list above for verified real-time ratings and prices across Amazon and Flipkart.`,
    },
    {
      q: `How does ShoppersDeals verify prices for ${config.title}?`,
      a: `Every product price is tracked continuously against our 90-day price history database to confirm whether a deal is a genuine price drop or an inflated MRP trick.`,
    },
    {
      q: `Which store offers the best deals on ${config.slug.replace(/-/g, ' ')}?`,
      a: `Prices fluctuate daily between Amazon, Flipkart, Myntra and Shopsy. ShoppersDeals monitors all major stores so you always buy from the retailer with the lowest live rate.`,
    },
  ];

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.a,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-gray-900 pb-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      {/* Top Breadcrumb */}
      <div className="border-b border-gray-200/80 bg-white">
        <div className="mx-auto flex max-w-[1280px] items-center gap-2 px-4 py-3 text-xs font-semibold text-gray-500 sm:px-6">
          <Link href="/" className="hover:text-brand transition-colors">Home</Link>
          <span>/</span>
          <Link href="/categories" className="hover:text-brand transition-colors">Categories</Link>
          <span>/</span>
          <span className="text-gray-900 font-bold">{config.title}</span>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-4 pt-6 sm:px-6">
        {/* Header Hero */}
        <header className="mb-8 rounded-3xl border border-gray-200/80 bg-gradient-to-br from-white via-white to-orange-50/40 p-6 sm:p-10 shadow-xs">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-black text-brand">
            <span>🏆</span> 2026 Curated Buyer's Guide &amp; Price Tracker
          </div>
          <h1 className="mb-3 text-2xl font-black tracking-tight text-gray-950 sm:text-4xl">
            {config.heading}
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-gray-600 sm:text-base">
            {config.subtitle}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-4 text-xs font-bold text-gray-500 border-t border-gray-100 pt-4">
            <span className="flex items-center gap-1 text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Price Verified Today
            </span>
            <span>•</span>
            <span>Stores: Amazon, Flipkart, Myntra, Shopsy, Meesho</span>
            <span>•</span>
            <span>{validProducts.length} Top Products Ranked</span>
          </div>
        </header>

        {/* Quick Comparison Table (Above the fold for Google featured snippet) */}
        {validProducts.length > 0 && (
          <section className="mb-10 rounded-3xl border border-gray-200/80 bg-white p-5 shadow-xs overflow-hidden" aria-label="Quick Price Comparison Matrix">
            <h2 className="mb-4 text-base font-extrabold text-gray-900">
              📊 Quick Comparison: Top 5 {config.title.replace('Top 20 Best ', '')}
            </h2>
            <div className="overflow-x-auto scrollbar-hide no-scrollbar">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/70 text-gray-500 font-extrabold uppercase tracking-wider">
                    <th className="py-3 px-3">Rank</th>
                    <th className="py-3 px-3">Product</th>
                    <th className="py-3 px-3">Store</th>
                    <th className="py-3 px-3">Deal Price</th>
                    <th className="py-3 px-3">Discount</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-semibold">
                  {validProducts.slice(0, 5).map((prod, idx) => {
                    const merchant = getMerchantInfo(prod.merchant || prod.cleanUrl);
                    const origPrice = prod.originalPrice || 0;
                    const discount = origPrice > prod.price ? Math.round(((origPrice - prod.price) / origPrice) * 100) : 0;
                    return (
                      <tr key={prod._id || idx} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3.5 px-3 font-black text-brand text-sm">#{idx + 1}</td>
                        <td className="py-3.5 px-3 max-w-[260px] truncate">
                          <Link href={`/product/${prod._id}`} className="hover:text-brand font-bold text-gray-900 transition-colors">
                            {cleanTitle(prod.title)}
                          </Link>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-700">
                            {merchant.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-black text-gray-900 text-sm">
                          {formatInr(prod.price, prod.country)}
                        </td>
                        <td className="py-3.5 px-3 text-emerald-600 font-bold">
                          {discount > 0 ? `${discount}% OFF` : 'Best Deal'}
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <a
                            href={getAffiliateUrl(prod.cleanUrl, prod.country)}
                            target="_blank"
                            rel="noopener noreferrer sponsored"
                            className="inline-flex rounded-xl bg-brand px-3 py-1.5 text-[11px] font-extrabold text-white shadow-2xs hover:opacity-95"
                          >
                            Buy →
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Detailed 20 Product Bento Cards */}
        <section className="mb-12 space-y-6" aria-label="Top 20 Detailed Product Breakdown">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-gray-950">
              All Top {validProducts.length} Ranked Products
            </h2>
            <span className="text-xs font-semibold text-gray-500">Sorted by Rating &amp; Savings</span>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {validProducts.map((prod, idx) => {
              const merchant = getMerchantInfo(prod.merchant || prod.cleanUrl);
              const origPrice = prod.originalPrice || 0;
              const hasDiscount = origPrice > prod.price;
              const discount = hasDiscount ? Math.round(((origPrice - prod.price) / origPrice) * 100) : 0;
              const rankLabel = idx === 0 ? '🏆 #1 Best Overall' : idx === 1 ? '💎 #2 Top Value' : idx === 2 ? '⭐ #3 Highly Rated' : `#${idx + 1}`;

              return (
                <article
                  key={prod._id || idx}
                  className="flex flex-col justify-between rounded-3xl border border-gray-200/80 bg-white p-5 shadow-xs hover:shadow-sm transition-shadow"
                >
                  <div>
                    {/* Top Row: Rank & Store */}
                    <div className="mb-3 flex items-center justify-between">
                      <span className={`rounded-xl px-2.5 py-1 text-xs font-black ${
                        idx < 3 ? 'bg-orange-50 text-brand border border-orange-200' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {rankLabel}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-600">
                        {merchant.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={merchant.logo} alt={merchant.label} className="h-4 w-auto object-contain" />
                        ) : (
                          <span>{merchant.emoji} {merchant.label}</span>
                        )}
                      </span>
                    </div>

                    {/* Image & Title Body */}
                    <div className="flex gap-4 mb-4">
                      <Link href={`/product/${prod._id}`} className="relative h-24 w-24 shrink-0 rounded-2xl border border-gray-100 bg-gray-50/50 p-2 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={prod.imageUrl}
                          alt={cleanTitle(prod.title)}
                          className="h-full w-full object-contain"
                          loading="lazy"
                        />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link href={`/product/${prod._id}`}>
                          <h3 className="line-clamp-2 text-sm font-bold text-gray-900 hover:text-brand transition-colors">
                            {cleanTitle(prod.title)}
                          </h3>
                        </Link>

                        <div className="mt-2 flex flex-wrap items-baseline gap-2">
                          <span className="text-lg font-black text-gray-950">
                            {formatInr(prod.price, prod.country)}
                          </span>
                          {hasDiscount && (
                            <span className="text-xs font-semibold text-gray-400 line-through">
                              {formatInr(origPrice, prod.country)}
                            </span>
                          )}
                          {discount > 0 && (
                            <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black text-emerald-700 border border-emerald-200">
                              {discount}% OFF
                            </span>
                          )}
                        </div>

                        {prod.rating > 0 && (
                          <div className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-amber-600">
                            <span>★ {prod.rating}</span>
                            <span className="text-gray-400 font-normal">Customer Rating</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-2 flex items-center gap-2 border-t border-gray-100 pt-3">
                    <a
                      href={getAffiliateUrl(prod.cleanUrl, prod.country)}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      style={{ backgroundColor: merchant.btnColor, color: merchant.textColor || '#ffffff' }}
                      className="flex-1 rounded-xl py-2.5 text-center text-xs font-extrabold shadow-2xs hover:opacity-95 transition-opacity"
                    >
                      Buy on {merchant.label} →
                    </a>
                    <Link
                      href={`/product/${prod._id}`}
                      className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors whitespace-nowrap"
                    >
                      📊 Price History
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Buyer Tips Section */}
        {config.tips && config.tips.length > 0 && (
          <section className="mb-10 rounded-3xl border border-gray-200/80 bg-white p-6 sm:p-8 shadow-xs">
            <h2 className="mb-4 text-lg font-black text-gray-950">
              💡 Smart Buyer Tips: How to Choose the Best {config.title.replace('Top 20 Best ', '')}
            </h2>
            <ul className="space-y-2.5 text-sm text-gray-700">
              {config.tips.map((tip, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="text-brand font-bold text-base">✓</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* FAQ Section */}
        <section className="mb-12 rounded-3xl border border-gray-200/80 bg-white p-6 sm:p-8 shadow-xs">
          <h2 className="mb-6 text-lg font-black text-gray-950">
            ❓ Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div key={idx} className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                <h3 className="text-sm font-extrabold text-gray-900 mb-1.5">{faq.q}</h3>
                <p className="text-xs leading-relaxed text-gray-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Internal Hub-and-Spoke Navigation Mesh */}
        <section className="rounded-3xl border border-gray-200/80 bg-white p-6 shadow-xs">
          <h2 className="mb-3 text-xs font-black uppercase tracking-wider text-gray-400">
            Explore More Top 20 Buying Guides
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(TOP_CURATED_BEST_SLUGS)
              .filter(([s]) => s !== slug)
              .map(([s, c]) => (
                <Link
                  key={s}
                  href={`/best/${s}`}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-orange-50 hover:text-brand hover:border-orange-200 transition-all"
                >
                  {c.title.replace('Top 20 Best ', '')} →
                </Link>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
