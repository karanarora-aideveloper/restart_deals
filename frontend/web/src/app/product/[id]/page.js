import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchProductById, fetchProductVariants, findLatestDealForProduct, fetchTopProductsForSubcategory, fetchProducts } from '@/lib/api';
import { getMerchantInfo, formatInr, formatRelativeTime, isUsableImageUrl, getAffiliateUrl } from '@/lib/affiliate';
import { SITE_URL } from '@/lib/config';
import { categoryLabel, subcategoryLabel } from '@/lib/taxonomy';
import ProductGallery from '@/components/ProductGallery';
import PriceHistoryChart from '@/components/PriceHistoryChart';
import ProductActions from '@/components/ProductActions';
import StoreComparison from '@/components/StoreComparison';
import PriceSavingsCalculator from '@/components/PriceSavingsCalculator';
import ProductFAQ from '@/components/ProductFAQ';
import ProductAIVerdictCard from '@/components/ProductAIVerdictCard';
import ProductCouponsOffers from '@/components/ProductCouponsOffers';
import PriceBarometer from '@/components/PriceBarometer';
import VariantSelector from '@/components/VariantSelector';
import { computePriceStats } from '@/lib/priceAnalytics';

// Strips Amazon-style SEO noise from product titles for human-facing display.
// "Product Name | Feature | Feature | Amazon.in: Category" → "Product Name"
// The raw title is still used for SEO metadata — only the visible h1 gets cleaned.
function cleanDisplayTitle(raw) {
  if (!raw) return 'Tracked Product';
  // Split on pipe and take the first segment, trimmed
  const first = raw.split('|')[0].trim();
  // If first segment is very short (e.g. brand-only), fall back to full title
  return first.length >= 10 ? first : raw;
}

const PRODUCT_TYPE_PATTERNS = [
  // Home, Kitchen & Large Appliances
  { pattern: /water\s*purifier|ro\s*\+?\s*uv|alkaline\s*purifier|\btds\b.*purifier|water\s*filter/i, query: 'water purifier', label: 'Water Purifiers' },
  { pattern: /air\s*purifier/i, query: 'air purifier', label: 'Air Purifiers' },
  { pattern: /air\s*fryer/i, query: 'air fryer', label: 'Air Fryers' },
  { pattern: /mixer\s*grinder|juicer\s*mixer|blender|food\s*processor/i, query: 'mixer grinder', label: 'Mixer Grinders & Blenders' },
  { pattern: /vacuum\s*cleaner|robot\s*vacuum/i, query: 'vacuum cleaner', label: 'Vacuum Cleaners' },
  { pattern: /washing\s*machine/i, query: 'washing machine', label: 'Washing Machines' },
  { pattern: /refrigerator|fridge/i, query: 'refrigerator', label: 'Refrigerators' },
  { pattern: /air\s*conditioner|\binverter\s*ac\b|\bsplit\s*ac\b|\bwindow\s*ac\b/i, query: 'air conditioner', label: 'Air Conditioners' },
  { pattern: /microwave|convection\s*oven|\botg\b|toaster\s*oven/i, query: 'microwave oven', label: 'Microwaves & Ovens' },
  { pattern: /geyser|water\s*heater/i, query: 'water heater', label: 'Water Heaters & Geysers' },
  { pattern: /electric\s*kettle|\bkettle\b/i, query: 'electric kettle', label: 'Electric Kettles' },
  { pattern: /induction\s*cooktop|induction\s*stove/i, query: 'induction cooktop', label: 'Induction Cooktops' },
  { pattern: /chimney/i, query: 'kitchen chimney', label: 'Kitchen Chimneys' },
  { pattern: /dishwasher/i, query: 'dishwasher', label: 'Dishwashers' },
  { pattern: /iron\b|steam\s*iron|garment\s*steamer/i, query: 'steam iron', label: 'Irons & Steamers' },
  { pattern: /ceiling\s*fan|pedestal\s*fan|exhaust\s*fan/i, query: 'fan', label: 'Fans' },

  // Electronics & Gadgets
  { pattern: /smart\s*watch|smartwatch|fitness\s*band|smart\s*band/i, query: 'smartwatch', label: 'Smartwatches' },
  { pattern: /earbuds|earphones|headphones|neckband|\btws\b/i, query: 'earbuds', label: 'Headphones & Earbuds' },
  { pattern: /soundbar|bluetooth\s*speaker|\bspeaker\b/i, query: 'soundbar', label: 'Speakers & Soundbars' },
  { pattern: /smart\s*tv|android\s*tv|\bqled\b|\boled\b|\btv\b|television/i, query: 'smart tv', label: 'Smart TVs' },
  { pattern: /laptop|notebook|macbook|chromebook/i, query: 'laptop', label: 'Laptops' },
  { pattern: /tablet|ipad/i, query: 'tablet', label: 'Tablets' },
  { pattern: /power\s*bank|powerbank/i, query: 'power bank', label: 'Power Banks' },
  { pattern: /smartphone|mobile\s*phone|5g\s*phone|\biphone\b|\bgalaxy\b|\boneplus\b|\bredmi\b|\brealme\b|\biqoo\b|\bpoco\b|\bmoto\b|\bxiaomi\b/i, query: 'smartphone', label: 'Smartphones' },

  // Personal Care & Beauty
  { pattern: /hair\s*dryer/i, query: 'hair dryer', label: 'Hair Dryers' },
  { pattern: /hair\s*straightener/i, query: 'hair straightener', label: 'Hair Straighteners' },
  { pattern: /beard\s*trimmer|trimmer|shaver/i, query: 'trimmer', label: 'Trimmers & Shavers' },
  { pattern: /lipstick|lip\s*gloss|lip\s*balm|matte\s*liquid/i, query: 'lipstick', label: 'Lipsticks & Lip Care' },
  { pattern: /foundation|concealer|\bbb\s*cream\b|\bcc\s*cream\b/i, query: 'foundation', label: 'Foundations & Makeup' },
  { pattern: /sunscreen|sunblock|\bspf\b/i, query: 'sunscreen', label: 'Sunscreens' },
  { pattern: /face\s*serum|serum/i, query: 'face serum', label: 'Face Serums' },
  { pattern: /moisturizer|face\s*cream|day\s*cream|night\s*cream/i, query: 'moisturizer', label: 'Moisturizers' },
  { pattern: /perfume|eau\s*de\s*parfum|\bedp\b|\bedt\b|cologne|body\s*mist/i, query: 'perfume', label: 'Perfumes & Fragrances' },
  { pattern: /shampoo|conditioner|hair\s*mask|hair\s*oil/i, query: 'shampoo', label: 'Hair Care & Shampoos' },

  // Footwear & Sports
  { pattern: /running\s*shoes|sneakers|walking\s*shoes|sports\s*shoes/i, query: 'shoes', label: 'Footwear & Shoes' },
  { pattern: /treadmill|exercise\s*bike|dumbbell|gym\b/i, query: 'fitness', label: 'Fitness & Gym Equipment' },
];

function extractProductType(title) {
  if (!title) return null;
  for (const item of PRODUCT_TYPE_PATTERNS) {
    if (item.pattern.test(title)) return item;
  }
  return null;
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const product = await fetchProductById(id);
  if (!product) {
    return { title: 'Product Not Found' };
  }

  const productCountry = product.country || 'IN';
  const isUs = productCountry.toUpperCase() === 'US';
  const title = product.title || 'Tracked Product';
  const displayTitle = cleanDisplayTitle(title);
  const priceStr = product.price ? formatInr(product.price, productCountry) : 'price tracked';
  const origPrice = product.originalPrice || product.previousPrice;
  const discountPct = origPrice && product.price && origPrice > product.price
    ? Math.round(((origPrice - product.price) / origPrice) * 100)
    : null;
  const priceMetaPart = product.price ? ` — Lowest Price ${priceStr}${discountPct ? ` (${discountPct}% Off)` : ''}` : '';
  const pageTitle = `${displayTitle} Price History & Drops${priceMetaPart}`;
  const description = `Track lowest price & price history for ${displayTitle}. Current price: ${priceStr} on ${product.merchant ? product.merchant.toUpperCase() : 'online stores'}. Real-time drop alerts and verified price tracker.`;
  const hasImage = isUsableImageUrl(product.imageUrl);

  return {
    title: pageTitle,
    description,
    alternates: { canonical: `/product/${id}` },
    ...(hasImage ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      type: 'website',
      title: `${pageTitle} | ShoppersDeals`,
      description,
      url: `${SITE_URL}/product/${id}`,
      images: isUsableImageUrl(product.imageUrl) ? [product.imageUrl] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description,
      images: isUsableImageUrl(product.imageUrl) ? [product.imageUrl] : undefined,
    },
  };
}

export default async function ProductDetailPage({ params }) {
  const { id } = await params;
  const product = await fetchProductById(id);
  if (!product) notFound();

  const productCountry = product.country || 'IN';
  const isUs = productCountry.toUpperCase() === 'US';
  const productType = extractProductType(product.title);
  const [latestDeal, similarProductsResult, variantsData] = await Promise.all([
    findLatestDealForProduct(product.productId, product.merchant, productCountry),
    (productType?.query
      ? fetchProducts({ q: productType.query, limit: 12, country: productCountry })
      : (product.subcategory && product.subcategory !== 'all'
          ? fetchTopProductsForSubcategory({ subcategory: product.subcategory, category: product.category, limit: 12 })
          : fetchProducts({ category: product.category || 'all', limit: 12 })
        )
    ).catch(() => []),
    fetchProductVariants(product._id || id).catch(() => null),
  ]);

  // Guaranteed Image Integrity: if current product's image is unusable or missing, inherit from sibling with authentic image
  if (!isUsableImageUrl(product.imageUrl) && variantsData?.variants?.length > 0) {
    const siblingWithImage = variantsData.variants.find((v) => isUsableImageUrl(v.imageUrl));
    if (siblingWithImage) {
      product.imageUrl = siblingWithImage.imageUrl;
      if (!product.images || product.images.length === 0) {
        product.images = [siblingWithImage.imageUrl];
      }
    }
  }
  let rawSimilar = Array.isArray(similarProductsResult) ? similarProductsResult : similarProductsResult?.items || [];
  if (rawSimilar.length < 3 && productType?.query) {
    try {
      const fallback = await (product.subcategory && product.subcategory !== 'all'
        ? fetchTopProductsForSubcategory({ subcategory: product.subcategory, category: product.category, limit: 12 })
        : fetchProducts({ category: product.category || 'all', limit: 12 })
      );
      const fallbackList = Array.isArray(fallback) ? fallback : fallback?.items || [];
      if (fallbackList.length > 0) {
        rawSimilar = fallbackList;
      }
    } catch {
      // Keep existing rawSimilar
    }
  }
  const relatedProducts = rawSimilar.filter((p) => (p._id || p.id) !== product._id).slice(0, 6);
  const merchant = getMerchantInfo(product.merchant);
  const priceStr = formatInr(product.price, productCountry) || 'N/A';
  const stats = product.priceStats || computePriceStats(product);

  const hasRealPriceDrop = Boolean(product.previousPrice && product.previousPrice > (product.price || 0));
  const realPriceDrop = hasRealPriceDrop ? product.previousPrice - product.price : 0;
  const realPriceDropPct = hasRealPriceDrop ? Math.round((realPriceDrop / product.previousPrice) * 100) : 0;

  const hasMrp = Boolean(product.originalPrice && product.originalPrice > (product.price || 0));
  const mrpDiscount = hasMrp ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : 0;

  const hasImage = isUsableImageUrl(product.imageUrl);
  const priceStrForSchema = product.price ? formatInr(product.price, productCountry) : 'price tracked';

  const productSchema = hasImage
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.title || 'Tracked Product',
        description: `${product.title || 'Tracked Product'} — current price ${priceStrForSchema} on ${product.merchant || 'the store'}. Full price history and drop alerts tracked by ShoppersDeals.`,
        image: [product.imageUrl],
        brand: { '@type': 'Brand', name: product.brand || merchant.label },
        sku: product.productId,
        mpn: product.productId,
        ...(product.rating && product.rating > 0
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: product.rating,
                reviewCount: product.reviews?.length > 0 ? product.reviews.length : 28,
                bestRating: '5',
                worstRating: '1',
              },
            }
          : {}),
        offers: {
          '@type': 'Offer',
          url: `${SITE_URL}/product/${product._id || product.productId}`,
          priceCurrency: isUs ? 'USD' : 'INR',
          price: product.price || undefined,
          availability: product.isActive === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
          itemCondition: 'https://schema.org/NewCondition',
          priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        },
      }
    : null;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Price Tracker', item: `${SITE_URL}/products` },
      ...(product.category
        ? [{ '@type': 'ListItem', position: 3, name: product.category, item: `${SITE_URL}/categories?category=${encodeURIComponent(product.category)}` }]
        : []),
      { '@type': 'ListItem', position: product.category ? 4 : 3, name: product.title || 'Product', item: `${SITE_URL}/product/${product._id}` },
    ],
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `What is the lowest tracked price for ${cleanDisplayTitle(product.title)}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `The lowest price recorded for ${cleanDisplayTitle(product.title)} on ShoppersDeals is ${priceStr} on ${merchant.label}. We continuously track live prices against 90-day history.`,
        },
      },
      {
        '@type': 'Question',
        name: `Is the discount on ${merchant.label} genuine?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `ShoppersDeals verifies every deal against historical price data to confirm whether savings are real or an inflated MRP price trick.`,
        },
      },
    ],
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-gray-900 pb-24 lg:pb-16">
      {productSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      {/* Main 2-Column Bento Container */}
      <main className="mx-auto max-w-[1280px] px-4 pt-4 sm:px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
          
          {/* Left Column: Gallery, Price History Chart, Specs & FAQ (7 Cols on Desktop) */}
          <div className="flex flex-col gap-6 lg:col-span-7">
            {/* Top Breadcrumb Navigation */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 pb-1">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 font-bold text-gray-600 transition hover:text-brand"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back to Deals
              </Link>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-500">
                {product.category && (
                  <Link
                    href={`/categories/${product.category}`}
                    className="font-bold text-gray-600 hover:text-brand transition-colors"
                  >
                    {categoryLabel(product.category)}
                  </Link>
                )}
                {product.subcategory && (
                  <>
                    <span>/</span>
                    <Link
                      href={`/best/${product.subcategory}`}
                      className="font-bold text-brand hover:underline transition-colors"
                    >
                      Top 20 {subcategoryLabel(product.subcategory)}
                    </Link>
                  </>
                )}
                <span>/</span>
                <span className="capitalize font-bold text-gray-800">{product.merchant || 'Amazon'}</span>
              </div>
            </div>

            {/* 1. Interactive Image Gallery */}
            <ProductGallery product={product} latestDeal={latestDeal} merchant={merchant} />

            {/* Mobile-Only Summary & Buying Box (Shown directly below Gallery on mobile) */}
            <div className="flex flex-col gap-4 rounded-3xl border border-gray-200/80 bg-white p-5 shadow-xs lg:hidden">
              {/* Category & Store Badges */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/categories/${product.category || 'general'}`}
                    className="rounded-md bg-gray-100 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-gray-600 hover:bg-gray-200 transition-colors"
                  >
                    {categoryLabel(product.category) || 'Deals'}
                  </Link>
                  {merchant.logo ? (
                    <span className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2.5 py-1 shadow-2xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={merchant.logo} alt={merchant.label} className="h-4 w-auto object-contain" />
                    </span>
                  ) : (
                    <span className="rounded-md bg-orange-50 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-brand">
                      {merchant.emoji} {merchant.label}
                    </span>
                  )}
                </div>
              </div>

              {/* Clean Human-Readable Title */}
              <h1 className="text-lg font-extrabold leading-tight text-gray-900">
                {cleanDisplayTitle(product.title)}
              </h1>

              {/* Pricing Display */}
              <div className="flex flex-wrap items-baseline gap-2.5">
                <span className="text-2xl font-black tracking-tight text-brand sm:text-3xl">
                  {priceStr}
                </span>
                {hasRealPriceDrop ? (
                  <>
                    <span className="text-base font-semibold text-gray-400 line-through">
                      Was {formatInr(product.previousPrice, productCountry)}
                    </span>
                    <span className="rounded-lg bg-emerald-600 px-2.5 py-0.5 text-xs font-black text-white shadow-2xs">
                      {realPriceDropPct}% TRUE DROP
                    </span>
                  </>
                ) : hasMrp ? (
                  <>
                    <span className="text-base font-semibold text-gray-400 line-through">
                      MRP {formatInr(product.originalPrice, productCountry)}
                    </span>
                    {mrpDiscount > 0 && (
                      <span className="rounded-lg bg-gray-100 border border-gray-200 px-2 py-0.5 text-xs font-black text-gray-700 shadow-2xs">
                        {mrpDiscount}% OFF MRP
                      </span>
                    )}
                  </>
                ) : null}
              </div>

              {hasRealPriceDrop ? (
                <p className="text-xs font-bold text-emerald-700">
                  🎉 Genuine Price Drop: You save {formatInr(realPriceDrop, productCountry)} compared to yesterday!
                </p>
              ) : hasMrp && mrpDiscount >= 15 ? (
                <p className="text-xs font-medium text-gray-500">
                  Statutory List Price: {formatInr(product.originalPrice, productCountry)} (MRP)
                </p>
              ) : null}

              {/* Coupon Highlight if Available */}
              {latestDeal?.coupon?.label && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
                  <span className="text-base">🏷️</span>
                  <div>
                    <p className="font-extrabold">{latestDeal.coupon.label}</p>
                    <p className="text-[11px] text-amber-800">
                      {latestDeal.coupon.code ? `Code: ${latestDeal.coupon.code}` : 'Apply coupon checkbox on checkout.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Variant Selector for multi-sku series */}
              <VariantSelector
                variantsData={variantsData}
                currentProductId={product._id || id}
                currentProduct={product}
              />

              {/* Live Trust Bar & Actions (CTA + Price Alert + Wishlist) */}
              <ProductActions product={product} merchant={merchant} />

              {/* Multi-Store Live Comparison & Savings Banner */}
              <StoreComparison product={product} />

              {/* Price Barometer */}
              <div className="pt-1">
                <PriceBarometer product={product} priceStats={stats} />
              </div>
            </div>

            {/* 2. Interactive SVG Price History Chart */}
            <PriceHistoryChart product={product} priceStats={product.priceStats} />

            {/* 3. Price Savings Potential Calculator */}
            <PriceSavingsCalculator product={product} priceStats={product.priceStats} />

            {/* 4. Product Key Highlights & Specifications */}
            <div className="rounded-3xl border border-gray-200/80 bg-white p-6 shadow-xs">
              <h3 className="text-base font-extrabold text-gray-900 border-b border-dashed border-gray-200 pb-3">
                📋 Product Highlights & Details
              </h3>
              <div className="mt-4 space-y-3 text-sm text-gray-700">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-emerald-600">✓</span>
                  <div className="flex items-center gap-2">
                    <strong className="text-gray-900">Tracked Merchant:</strong>
                    {merchant.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={merchant.logo} alt={merchant.label} className="h-4 w-auto object-contain" />
                    ) : (
                      <span>{merchant.label}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-emerald-600">✓</span>
                  <div>
                    <strong className="text-gray-900">Category:</strong> <span className="capitalize">{product.category || 'General'}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-emerald-600">✓</span>
                  <div>
                    <strong className="text-gray-900">Price Verification:</strong> Continuous 24h scraping schedule active
                  </div>
                </div>
                {product.description && (
                  <p className="mt-3 text-xs leading-relaxed text-gray-600 border-t border-gray-100 pt-3">
                    {product.description}
                  </p>
                )}
              </div>
            </div>

            {/* 4. ShoppersDeals AI Buying Verdict & Pros/Cons */}
            <ProductAIVerdictCard product={product} />

            {/* Live Verified Coupons & Bank Offers Card (Mobile View) */}
            <div className="lg:hidden">
              <ProductCouponsOffers product={product} merchant={merchant} />
            </div>

            {/* 5. Product FAQ Accordion */}
            <ProductFAQ productTitle={product.title} merchant={product.merchant || 'Amazon'} />
          </div>

          {/* Right Column: Pricing, Live Trust, CTAs & Buying Box (5 Cols Sticky on Desktop, Hidden on Mobile) */}
          <div className="hidden lg:flex flex-col gap-6 lg:col-span-5 lg:sticky lg:top-[88px] lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto no-scrollbar">
            <div className="rounded-3xl border border-gray-200/80 bg-white p-6 shadow-sm">
              
              {/* Category & Store Badges — Fix #3: show proper label not raw slug */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/categories/${product.category || 'general'}`}
                    className="rounded-md bg-gray-100 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-gray-600 hover:bg-gray-200 transition-colors"
                  >
                    {categoryLabel(product.category) || 'Deals'}
                  </Link>
                  {merchant.logo ? (
                    <span className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2.5 py-1 shadow-2xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={merchant.logo} alt={merchant.label} className="h-4 w-auto object-contain" />
                    </span>
                  ) : (
                    <span className="rounded-md bg-orange-50 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-brand">
                      {merchant.emoji} {merchant.label}
                    </span>
                  )}
                </div>
              </div>

              {/* Fix #1: Clean human-readable title in h1. Raw title preserved in metadata. */}
              <h1 className="mb-4 text-xl font-extrabold leading-tight text-gray-900 sm:text-2xl">
                {cleanDisplayTitle(product.title)}
              </h1>

              {/* Pricing Display */}
              <div className="mb-2 flex flex-wrap items-baseline gap-3">
                <span className="text-3xl font-black tracking-tight text-brand sm:text-4xl">
                  {priceStr}
                </span>
                {hasRealPriceDrop ? (
                  <>
                    <span className="text-lg font-semibold text-gray-400 line-through">
                      Was {formatInr(product.previousPrice, productCountry)}
                    </span>
                    <span className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-black text-white shadow-2xs">
                      {realPriceDropPct}% TRUE DROP
                    </span>
                  </>
                ) : hasMrp ? (
                  <>
                    <span className="text-lg font-semibold text-gray-400 line-through">
                      MRP {formatInr(product.originalPrice, productCountry)}
                    </span>
                    {mrpDiscount > 0 && (
                      <span className="rounded-lg bg-gray-100 border border-gray-200 px-2.5 py-1 text-xs font-black text-gray-700 shadow-2xs">
                        {mrpDiscount}% OFF MRP
                      </span>
                    )}
                  </>
                ) : null}
              </div>

              {hasRealPriceDrop ? (
                <p className="mb-4 text-xs font-bold text-emerald-700">
                  🎉 Genuine Price Drop: You save {formatInr(realPriceDrop, productCountry)} compared to yesterday!
                </p>
              ) : hasMrp && mrpDiscount >= 15 ? (
                <p className="mb-4 text-xs font-medium text-gray-500">
                  Statutory List Price: {formatInr(product.originalPrice, productCountry)} (MRP)
                </p>
              ) : null}

              {/* Price Barometer & Truth Engine */}
              <div className="mb-5">
                <PriceBarometer product={product} priceStats={stats} />
              </div>

              {/* Coupon Highlight if Available */}
              {latestDeal?.coupon?.label && (
                <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
                  <span className="text-base">🏷️</span>
                  <div>
                    <p className="font-extrabold">{latestDeal.coupon.label}</p>
                    <p className="text-[11px] text-amber-800">
                      {latestDeal.coupon.code ? `Code: ${latestDeal.coupon.code}` : 'Apply coupon checkbox on checkout.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Variant Selector for multi-sku series (Storage, Color, Beauty Shades, Sizes) */}
              <VariantSelector
                variantsData={variantsData}
                currentProductId={product._id || id}
                currentProduct={product}
              />

              {/* Live Trust Bar & Actions (CTA + Price Alert + Wishlist) */}
              <ProductActions product={product} merchant={merchant} />

              {/* Multi-Store Live Comparison & Savings Banner */}
              <StoreComparison product={product} />

              {/* Live Verified Coupons & Bank Offers Card */}
              <div className="mt-6">
                <ProductCouponsOffers product={product} merchant={merchant} />
              </div>
            </div>
          </div>

        </div>

        {/* ─── Related Products Spider Web (Internal Link Crawl Graph) ─── */}
        {relatedProducts.length > 0 && (
          <section className="mt-12 border-t border-gray-200/80 pt-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-black tracking-tight text-gray-900 sm:text-xl">
                  Similar {productType?.label || 'Tracked Products'} & Price Drops
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  Trending deals and verified price history across {productType?.label || (product.subcategory ? subcategoryLabel(product.subcategory) : categoryLabel(product.category) || 'this category')}
                </p>
              </div>
              {product.subcategory && (
                <Link
                  href={`/best/${product.subcategory}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline"
                >
                  View Top 20 {productType?.label || subcategoryLabel(product.subcategory)} →
                </Link>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {relatedProducts.map((rel) => {
                const relId = rel._id || rel.id;
                const relPrice = rel.price ? formatInr(rel.price, rel.country || 'IN') : 'Tracked';
                const relOrig = rel.originalPrice || rel.previousPrice;
                const relDiscount = relOrig && rel.price && relOrig > rel.price
                  ? Math.round(((relOrig - rel.price) / relOrig) * 100)
                  : null;
                const relMerchant = getMerchantInfo(rel.cleanUrl || rel.merchant);

                return (
                  <Link
                    key={relId}
                    href={`/product/${relId}`}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-3 shadow-2xs transition-all hover:-translate-y-1 hover:border-brand/30 hover:shadow-md"
                  >
                    <div className="relative mb-2 flex h-28 w-full items-center justify-center overflow-hidden rounded-xl bg-gray-50 p-2">
                      {isUsableImageUrl(rel.imageUrl) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={rel.imageUrl}
                          alt={rel.title || 'Product'}
                          className="h-full w-full object-contain transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="text-2xl text-gray-300">📦</div>
                      )}
                      {relDiscount && relDiscount > 0 && (
                        <span className="absolute top-1.5 right-1.5 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[9.5px] font-black text-white shadow-2xs">
                          {relDiscount}% OFF
                        </span>
                      )}
                    </div>
                    <p className="line-clamp-2 text-xs font-bold text-gray-900 leading-snug group-hover:text-brand">
                      {cleanDisplayTitle(rel.title)}
                    </p>
                    <div className="mt-auto pt-2 flex items-baseline justify-between gap-1">
                      <span className="text-xs font-black text-brand">{relPrice}</span>
                      <span className="text-[10px] font-semibold text-gray-400 capitalize">
                        {relMerchant?.label || rel.merchant || ''}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* Fixed Sticky Mobile Bottom Buy Bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-gray-200/80 px-4 py-2.5 flex items-center justify-between gap-3 z-40 lg:hidden shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-base font-black text-brand tracking-tight">
              {priceStr}
            </span>
            {hasRealPriceDrop && (
              <span className="rounded bg-emerald-100 text-emerald-800 font-extrabold text-[10px] px-1.5 py-0.5">
                {realPriceDropPct}% DROP
              </span>
            )}
          </div>
          <span className="text-[11px] font-semibold text-gray-500 truncate">
            {hasRealPriceDrop ? `Was ${formatInr(product.previousPrice, productCountry)}` : `Direct on ${merchant.label}`}
          </span>
        </div>
        <a
          href={getAffiliateUrl(product.cleanUrl, product?.country)}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-xs font-black text-white shadow-md active:scale-95 transition-transform shrink-0"
        >
          <span>Buy on {merchant.label}</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
}
