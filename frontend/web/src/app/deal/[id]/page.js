import { permanentRedirect } from 'next/navigation';
import { fetchDealById, fetchProductById, findMatchingProductId } from '@/lib/api';

/**
 * Architectural Rule: Deals are an ephemeral subset of canonical Products.
 * There are NO standalone /deal pages — every deal belongs to a permanent Product page (/product/:id).
 * This page strictly issues a 301 Permanent Redirect to /product/:id so Google and visitors
 * always land on the canonical product entity with price history charts and active deal banners,
 * permanently avoiding 404 dead links and domain SEO penalties.
 */
export async function generateMetadata({ params }) {
  const { id } = await params;
  let targetId = id;
  const deal = await fetchDealById(id);
  if (deal) {
    targetId = deal.matchedProductId || await findMatchingProductId(deal.productId, deal.merchant) || deal.productId || id;
  }

  return {
    title: 'Redirecting to Product Page | ShoppersDeals',
    robots: { index: false, follow: true },
    alternates: { canonical: `/product/${targetId}` },
  };
}

export default async function DealDetailPage({ params }) {
  const { id } = await params;
  let deal = await fetchDealById(id);

  if (deal) {
    const targetId =
      deal.matchedProductId ||
      (await findMatchingProductId(deal.productId, deal.merchant)) ||
      deal.productId ||
      deal._id;
    permanentRedirect(`/product/${targetId}`);
  }

  const product = await fetchProductById(id);
  if (product) {
    permanentRedirect(`/product/${product._id || product.productId}`);
  }

  // Graceful fallback: Redirect to products catalog instead of throwing a 404
  permanentRedirect('/products');
}
