import { notFound, permanentRedirect } from 'next/navigation';
import { fetchDealById, fetchProductById, findMatchingProductId } from '@/lib/api';
import { getMerchantInfo, formatRelativeTime, formatInr, isUsableImageUrl } from '@/lib/affiliate';
import { categoryLabel, subcategoryLabel } from '@/lib/taxonomy';
import { SITE_URL } from '@/lib/config';
import DealDetailActions from '@/components/DealDetailActions';
import { computePriceStats } from '@/lib/priceAnalytics';
import PriceBarometer from '@/components/PriceBarometer';

export async function generateMetadata({ params }) {
  const { id } = await params;
  let deal = await fetchDealById(id);
  if (!deal) {
    const product = await fetchProductById(id);
    if (product) {
      return { alternates: { canonical: `/product/${product._id || product.productId}` } };
    }
    return { title: 'Deal Not Found' };
  }

  // Most deals resolve to a canonical tracked Product (same productId+merchant) — the page
  // component below redirects there. Point metadata at the same canonical URL so any crawler
  // that only reads <head> before following the redirect still sees the right target.
  const matchedProductId = deal.matchedProductId || await findMatchingProductId(deal.productId, deal.merchant);
  if (matchedProductId) {
    return { alternates: { canonical: `/product/${matchedProductId}` } };
  }

  const dealCountry = deal.country || 'IN';
  const title = deal.title || 'Featured Deal';
  const description =
    deal.description ||
    `${title} — ${deal.dealPrice ? formatInr(deal.dealPrice, dealCountry) : 'special price'}${
      deal.discountPercentage ? ` (${deal.discountPercentage}% off)` : ''
    }. Verified live deal on ShoppersDeals.`;
  const hasImage = isUsableImageUrl(deal.imageUrl);

  return {
    title,
    description,
    alternates: { canonical: `/deal/${id}` },
    // See product/[id]/page.js for why: a page with no real photo can't satisfy Google's
    // Merchant listing image requirement, so it's kept out of the index entirely.
    ...(hasImage ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      type: 'website',
      title,
      description,
      url: `${SITE_URL}/deal/${id}`,
      images: isUsableImageUrl(deal.imageUrl) ? [deal.imageUrl] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: isUsableImageUrl(deal.imageUrl) ? [deal.imageUrl] : undefined,
    },
  };
}

export default async function DealDetailPage({ params }) {
  const { id } = await params;
  let deal = await fetchDealById(id);

  if (!deal) {
    const product = await fetchProductById(id);
    if (product) {
      permanentRedirect(`/product/${product._id || product.productId}`);
    }
    notFound();
  }

  // Deal and Product are near-duplicate content for the same real-world item (same title/
  // image/price) whenever the deal's productId+merchant resolves to a tracked Product — a
  // permanent redirect keeps exactly one indexed URL per item instead of two. Deals that never
  // resolved a productId (extraction failed, or a one-off post) render their own page below,
  // since there's nothing to consolidate onto.
  const matchedProductId = deal.matchedProductId || await findMatchingProductId(deal.productId, deal.merchant);
  if (matchedProductId) {
    permanentRedirect(`/product/${matchedProductId}`);
  }

  const dealCountry = deal.country || 'IN';
  const isUs = dealCountry.toUpperCase() === 'US';
  const merchant = getMerchantInfo(deal.dealUrl);
  const dealPriceStr = formatInr(deal.dealPrice, dealCountry) || 'Special Price';
  const stats = deal.priceStats || computePriceStats(deal);

  const hasRealPriceDrop = Boolean(deal.previousPrice && deal.previousPrice > (deal.dealPrice || 0));
  const realPriceDrop = hasRealPriceDrop ? deal.previousPrice - deal.dealPrice : 0;
  const realPriceDropPct = hasRealPriceDrop ? Math.round((realPriceDrop / deal.previousPrice) * 100) : 0;

  const hasMrp = Boolean(deal.originalPrice && deal.originalPrice > (deal.dealPrice || 0));
  const mrpDiscount = hasMrp ? Math.round(((deal.originalPrice - deal.dealPrice) / deal.originalPrice) * 100) : 0;
  const isHotDeal = Boolean(stats?.isAllTimeLow || (hasRealPriceDrop && realPriceDropPct >= 20));

  const hasImage = isUsableImageUrl(deal.imageUrl);

  // See product/[id]/page.js for the reasoning: skip the whole block (rather than emit it
  // with a missing image) when there's no real photo, and never fabricate aggregateRating —
  // our data has no genuine review/rating count to back one.
  const productSchema = hasImage
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: deal.title || 'Featured Deal',
        description: deal.description || `${deal.title || 'Featured Deal'} — verified live deal on ShoppersDeals.`,
        image: [deal.imageUrl],
        brand: { '@type': 'Brand', name: merchant.label },
        offers: {
          '@type': 'Offer',
          url: `${SITE_URL}/deal/${deal._id || deal.id}`,
          priceCurrency: isUs ? 'USD' : 'INR',
          price: deal.dealPrice || undefined,
          availability: 'https://schema.org/InStock',
          itemCondition: 'https://schema.org/NewCondition',
        },
      }
    : null;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Live Deals', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 3, name: deal.title || 'Deal', item: `${SITE_URL}/deal/${deal._id || deal.id}` },
    ],
  };

  return (
    <div className="bg-[#f3f4f6]">
      {productSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <div className="mx-auto w-full max-w-[800px] px-4 py-4 pb-10">
        <a href="/" className="mb-4 inline-flex items-center gap-2 py-2 text-base font-semibold text-[#111827]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Back
        </a>

        <article className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)]">
          {isHotDeal && (
            <div className="bg-[#dc2626] py-2 text-center">
              <p className="text-[13px] font-extrabold tracking-wide text-white">🔥 HOT DEAL — {deal.discountPercentage}% {isPriceDrop ? 'DROP' : 'OFF'}</p>
            </div>
          )}

          <div className="flex h-[300px] items-center justify-center border-b border-[#f3f4f6] bg-white p-6">
            {isUsableImageUrl(deal.imageUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={deal.imageUrl} alt={deal.title || 'Deal image'} className="h-full w-full object-contain" />
            ) : (
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5"><path d="M6 7h12l1 13H5L6 7Z" /><path d="M9 7a3 3 0 0 1 6 0" /></svg>
            )}
          </div>

          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              {merchant.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={merchant.logo} alt={merchant.label} className="h-[18px] object-contain" />
              ) : (
                <span className="rounded-xl bg-[#f3f4f6] px-3 py-1.5 text-sm font-bold text-[#4b5563]">{merchant.emoji} {merchant.label}</span>
              )}
              <span className="text-[13px] text-[#6b7280]">{formatRelativeTime(deal.createdAt)}</span>
            </div>

            {deal.category && (
              <a
                href={`/?category=${encodeURIComponent(deal.category)}${deal.subcategory ? `&subcategory=${encodeURIComponent(deal.subcategory)}` : ''}`}
                className="mb-2 inline-block text-[11px] font-bold uppercase tracking-wide text-[#9ca3af] hover:text-brand"
              >
                {categoryLabel(deal.category)}{deal.subcategory ? ` · ${subcategoryLabel(deal.subcategory)}` : ''}
              </a>
            )}
            <h1 className="mb-3 text-[22px] font-bold leading-[30px] text-[#111827]">{deal.title || 'Featured Deal'}</h1>
            {deal.description && <p className="mb-5 text-[15px] leading-6 text-[#4b5563]">{deal.description}</p>}

            <div className="mb-2 flex flex-wrap items-center gap-3">
              <span className="text-[28px] font-extrabold text-brand">{dealPriceStr}</span>
              {hasRealPriceDrop ? (
                <>
                  <span className="text-lg text-[#9ca3af] line-through">
                    Was {formatInr(deal.previousPrice, dealCountry)}
                  </span>
                  <span className="rounded-md border border-[#34d399] bg-[#ecfdf5] px-2 py-1 text-[13px] font-bold text-[#059669]">
                    {realPriceDropPct}% DROP
                  </span>
                </>
              ) : hasMrp ? (
                <>
                  <span className="text-lg text-[#9ca3af] line-through">
                    MRP {formatInr(deal.originalPrice, dealCountry)}
                  </span>
                  {mrpDiscount > 0 && (
                    <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[13px] font-bold text-gray-700">
                      {mrpDiscount}% off MRP
                    </span>
                  )}
                </>
              ) : null}
            </div>

            {hasRealPriceDrop ? (
              <p className="mb-4 text-sm font-semibold text-[#059669]">
                📉 Genuine Price Drop: You save {formatInr(realPriceDrop, dealCountry)}
              </p>
            ) : hasMrp && mrpDiscount >= 15 ? (
              <p className="mb-4 text-xs font-medium text-gray-500">
                Statutory MRP saving: {formatInr(deal.originalPrice - deal.dealPrice, dealCountry)}
              </p>
            ) : null}

            {/* Visual Truth Barometer */}
            <div className="mb-5">
              <PriceBarometer product={deal} priceStats={stats} />
            </div>

            {deal.coupon?.label && (
              <div className="-mt-2 mb-5 flex items-start gap-2 rounded-[10px] border border-[#ffe0a3] bg-[#fff8e6] p-3">
                <span aria-hidden>🏷️</span>
                <div>
                  <p className="mb-0.5 text-sm font-extrabold text-[#7a5200]">{deal.coupon.label}</p>
                  <p className="text-xs leading-4 text-[#9a7434]">
                    {deal.coupon.code ? 'Enter this code at checkout for an extra saving.' : 'Tick the coupon box on the product page before you check out.'}
                  </p>
                </div>
              </div>
            )}

            <DealDetailActions deal={deal} merchant={merchant} />
          </div>
        </article>

        {/* SEO-friendly deal context section */}
        <div className="mt-6 rounded-2xl border border-[#e5e7eb] bg-white p-5 text-sm leading-6 text-[#4b5563]">
          <h2 className="mb-2 text-base font-bold text-[#111827]">About this deal</h2>
          <p>
            {deal.title || 'This featured deal'} is a live, verified offer tracked by ShoppersDeals — India&apos;s
            real-time price-drop and coupon aggregator. The price shown ({dealPriceStr}) is pulled directly from{' '}
            <strong className="text-[#111827]">{merchant.label}</strong>&apos;s official listing
            {origPriceStr ? ` and represents a saving of ${formatInr(savings || 0, dealCountry)} off the original price of ${origPriceStr}` : ''}.
          </p>
          <p className="mt-2">
            ShoppersDeals monitors thousands of products across Amazon, Flipkart, Myntra, and Meesho 24&nbsp;hours a
            day. Every deal is checked for authenticity before it is surfaced. Click &quot;Shop Now&quot; to be taken
            directly to {merchant.label}&apos;s checkout page — ShoppersDeals never charges buyers or adds hidden fees.
          </p>
          {deal.coupon?.label && (
            <p className="mt-2">
              A coupon is available for this deal: <strong className="text-[#111827]">{deal.coupon.label}</strong>.
              {deal.coupon.code
                ? ` Enter code "${deal.coupon.code}" at checkout to claim the extra saving.`
                : ' Tick the coupon checkbox on the product page before checking out.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
