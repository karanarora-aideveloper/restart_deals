import * as cheerio from 'cheerio';
import { scraperQueue, PRIORITY } from '../services/scraperQueue.js';

/**
 * Parse HTML and extract structured product details across all supported merchants.
 */
/**
 * Price helpers — kept in sync with backend/src/listener/verifier.js.
 *
 * This scraper feeds the daily refresher, which expires deals by comparing a live price
 * against the stored one. A wrong or missing price here doesn't just skip a deal, it can
 * kill a live one, so extraction has to fail closed (null) rather than guess.
 */
function parsePriceText(raw) {
  if (!raw) return null;
  const cleaned = String(raw).replace(/[^\d.]/g, '').replace(/\.$/, '');
  if (!cleaned) return null;
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed) || parsed <= 0 || parsed > 10000000) return null;
  return Math.round(parsed);
}

// First parseable price among ALL matches — not `.first()`, whose node is often empty.
function findPrice($, selectors, root = null) {
  for (const sel of selectors) {
    const nodes = root ? root.find(sel) : $(sel);
    let hit = null;
    nodes.each((_, el) => {
      if (hit !== null) return false;
      const val = parsePriceText($(el).text().trim());
      if (val !== null) hit = val;
    });
    if (hit !== null) return hit;
  }
  return null;
}

// schema.org JSON-LD — the only stable price source on Flipkart's hashed markup.
function extractJsonLdPrice($) {
  let result = { price: null, originalPrice: null };
  $('script[type="application/ld+json"]').each((_, el) => {
    if (result.price !== null) return false;
    let parsed;
    try {
      parsed = JSON.parse($(el).contents().text());
    } catch {
      return;
    }
    const roots = Array.isArray(parsed) ? parsed : [parsed];
    for (const root of roots) {
      for (const node of (root['@graph'] || [root])) {
        if (!node || !node.offers) continue;
        const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
        if (!offer) continue;
        const price = parsePriceText(offer.price ?? offer.lowPrice);
        if (price === null) continue;
        result = { price, originalPrice: parsePriceText(offer.highPrice) };
        return false;
      }
    }
  });
  return result;
}

// Flipkart's schema.org JSON-LD Offer has NO standard MRP field — confirmed live 2026-08-30
// against a real product with an active 52% discount: offer.highPrice simply doesn't exist,
// so extractJsonLdPrice()'s originalPrice is structurally always null there, not a parsing miss.
// This is the second "connector": Flipkart's rendered strikethrough MRP element carries
// `text-decoration-line: line-through` as an INLINE style attribute (confirmed live) — a
// hash-independent signal that survives even though the CSS-in-JS class names rotate build to
// build (the old ._30jeq3/._3I9_R3 selectors are dead for exactly that reason).
//
// A raw scan for this alone isn't safe to trust directly, though — confirmed live on the SAME
// page: the main buybox sits above several "similar products" carousels, each with its own
// price/strikethrough/discount triplet, and a naive "first strikethrough found" grabbed a
// CAROUSEL item's price, not the product being scraped. And Flipkart shows more than one kind of
// "X% off" badge on a page (bank/coupon offers alongside the actual MRP-vs-price discount), so
// blindly trusting the first one found isn't safe either — it can be the wrong kind entirely.
//
// The fix: treat a strikethrough value as real MRP ONLY when it's cross-validated — some
// discount percentage found elsewhere on the page, applied to the live price
// (round(price / (1-discount%))), actually reconciles with that specific candidate. Every
// {candidate, discount} pair is checked, not just the first of each, since the correct pairing
// isn't guaranteed to be the first instance of either in document order. No confirmed match
// means an honest null, not a guess — consistent with this pipeline's "fail closed" rule
// (see this file's top docblock): a plausible-but-wrong MRP is worse than a missing one.
function extractFlipkartMRP($, livePrice) {
  if (!livePrice) return null;

  const strikeCandidates = [];
  $('*').each((_, el) => {
    const $el = $(el);
    if ($el.children().length > 0) return; // leaf nodes only — avoid double-counting containers
    const style = $el.attr('style') || '';
    if (!/line-through/.test(style)) return;
    const val = parsePriceText($el.text());
    if (val !== null && val > livePrice) strikeCandidates.push(val);
  });
  if (strikeCandidates.length === 0) return null;

  const discountPercents = new Set();
  $('*').each((_, el) => {
    const $el = $(el);
    if ($el.children().length > 0) return;
    const m = $el.text().trim().match(/^(\d{1,2})%\s*off$/i);
    if (m) discountPercents.add(parseInt(m[1], 10));
  });
  if (discountPercents.size === 0) return null;

  for (const candidate of strikeCandidates) {
    for (const discount of discountPercents) {
      const derived = Math.round(livePrice / (1 - discount / 100));
      if (Math.abs(candidate - derived) <= Math.max(2, derived * 0.02)) return candidate;
    }
  }
  return null;
}

export function parseProductHtml(html, targetUrl) {
  if (!html) return null;
  const $ = cheerio.load(html);

  const images = [];
  const reviews = [];
  let title = null;
  let rating = null;
  let price = null;
  let originalPrice = null;
  let category = 'general';

  const hostname = new URL(targetUrl).hostname.toLowerCase();

  if (hostname.includes('amazon.')) {
    // Amazon Title
    title = $('#productTitle').text().trim() || $('meta[property="og:title"]').attr('content') || $('meta[name="title"]').attr('content') || $('title').text().trim();
    if (title) {
      title = title.replace(/\s+/g, ' ').trim();
      const lower = title.toLowerCase();
      if (lower.includes('adding to cart') || lower.includes('added to cart') || lower.includes('robot check')) {
        title = $('meta[property="og:title"]').attr('content')?.trim() || $('title').text().trim();
      }
      title = title.replace(/^Amazon\.[a-z.]+\s*:\s*/i, '').trim();
    }

    // Amazon Images
    $('meta[property="og:image"]').each((_, el) => {
      const src = $(el).attr('content');
      if (src && !images.includes(src) && !src.includes('favicon')) images.push(src);
    });

    $('#landingImage, #imgTagWrapperId img, #main-image').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-old-hires');
      if (src && !images.includes(src)) images.push(src);
    });

    // Amazon Rating
    const ratingText = $('.a-icon-alt').first().text();
    const ratingMatch = ratingText.match(/([0-9.]+)\s*out\s*of\s*5/i);
    if (ratingMatch) rating = parseFloat(ratingMatch[1]);

    // Amazon Price — scoped to the main product column. The page carries dozens of
    // `.a-price` nodes from sponsored carousels and "similar items"; an unscoped match
    // can pick a neighbouring product and expire a perfectly live deal.
    const amazonPriceSelectors = [
      '.apexPriceToPay .a-offscreen',
      '.priceToPay .a-offscreen',
      '#priceblock_dealprice',
      '#priceblock_ourprice',
      '.a-price .a-offscreen',
      '.a-price-whole',
    ];
    const amazonListSelectors = [
      '.basisPrice .a-offscreen',
      'span.a-text-strike',
      '#listPrice',
      '#priceblock_listprice',
    ];
    const amazonRoots = ['#corePrice_feature_div', '#corePriceDisplay_desktop_feature_div', '#ppd', '#centerCol'];
    for (const rootSel of amazonRoots) {
      const root = $(rootSel);
      if (!root.length) continue;
      price = findPrice($, amazonPriceSelectors, root);
      if (price !== null) break;
    }
    if (price === null) price = findPrice($, amazonPriceSelectors);

    for (const rootSel of amazonRoots) {
      const root = $(rootSel);
      if (!root.length) continue;
      originalPrice = findPrice($, amazonListSelectors, root);
      if (originalPrice !== null) break;
    }
    if (originalPrice === null) originalPrice = findPrice($, amazonListSelectors);

    // Category detection from breadcrumbs
    const breadcrumbs = $('#wayfinding-breadcrumbs_feature_div').text().toLowerCase();
    if (breadcrumbs.includes('phone') || breadcrumbs.includes('mobile')) category = 'electronics';
    else if (breadcrumbs.includes('laptop') || breadcrumbs.includes('computer') || breadcrumbs.includes('headphone')) category = 'electronics';
    else if (breadcrumbs.includes('kitchen') || breadcrumbs.includes('home')) category = 'kitchen';
    else if (breadcrumbs.includes('clothing') || breadcrumbs.includes('fashion') || breadcrumbs.includes('shoes')) category = 'men-fashion';
    else if (breadcrumbs.includes('health') || breadcrumbs.includes('protein') || breadcrumbs.includes('fitness')) category = 'fitness';
    else if (breadcrumbs.includes('beauty') || breadcrumbs.includes('skin')) category = 'beauty';

  } else if (hostname.includes('flipkart.com')) {
    // Flipkart Title
    title = $('.B_NuCI').first().text().trim() || $('.VU-ZEz').first().text().trim() || $('meta[name="title"]').attr('content') || $('title').text().trim();

    // Flipkart Images
    $('meta[property="og:image"]').each((_, el) => {
      const src = $(el).attr('content');
      if (src && !images.includes(src)) images.push(src);
    });
    $('img[src*="/image/"]').slice(0, 3).each((_, el) => {
      const src = $(el).attr('src');
      if (src && !images.includes(src)) images.push(src);
    });

    // Flipkart Price — JSON-LD first for the live price. The hashed class-name selectors
    // below are already dead against live markup; they stay only as a last-resort fallback.
    const fkLd = extractJsonLdPrice($);
    if (fkLd.price !== null) {
      price = fkLd.price;
    } else {
      price = findPrice($, ['._30jeq3', 'div[class*="_30jeq3"]', '.Nx9bqj', '._16Jk6d']);
    }
    // MRP never comes from JSON-LD on Flipkart (see extractFlipkartMRP()'s docblock — the
    // field structurally doesn't exist there); this is the real extraction path, once `price`
    // is known.
    if (price !== null) originalPrice = extractFlipkartMRP($, price);
    if (originalPrice === null) {
      originalPrice = findPrice($, ['._3I9_R3', 'div[class*="_3I9_R3"]', '.yRaY8j', '._3auQ3N']);
    }

    // Flipkart Rating
    const ratingText = $('._3LWZlK').first().text();
    if (ratingText) rating = parseFloat(ratingText);

  } else if (hostname.includes('myntra.com')) {
    title = $('meta[property="og:title"]').attr('content')
      || `${$('.pdp-title').first().text().trim()} ${$('.pdp-name').first().text().trim()}`.trim()
      || $('title').text().trim();

    $('meta[property="og:image"]').each((_, el) => {
      const src = $(el).attr('content');
      if (src && !images.includes(src)) images.push(src);
    });

    const dealPriceText = $('.pdp-price strong').first().text().trim();
    if (dealPriceText) {
      const parsed = parseFloat(dealPriceText.replace(/[^\d.]/g, ''));
      if (!isNaN(parsed)) price = Math.round(parsed);
    }
    const listPriceText = $('.pdp-mrp s').first().text().trim();
    if (listPriceText) {
      const parsed = parseFloat(listPriceText.replace(/[^\d.]/g, ''));
      if (!isNaN(parsed)) originalPrice = Math.round(parsed);
    }
    category = 'women-fashion';

  } else if (hostname.includes('ajio.com')) {
    title = $('h1.prod-name').first().text().trim() || $('meta[property="og:title"]').attr('content') || $('title').text().trim();
    $('meta[property="og:image"]').each((_, el) => {
      const src = $(el).attr('content');
      if (src && !images.includes(src)) images.push(src);
    });
    $('.img-alignment').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && !images.includes(src)) images.push(src);
    });

    const priceText = $('.prod-sp').first().text().trim();
    if (priceText) {
      const parsed = parseFloat(priceText.replace(/[^\d.]/g, ''));
      if (!isNaN(parsed)) price = Math.round(parsed);
    }
    const listPriceText = $('.prod-cp').first().text().trim();
    if (listPriceText) {
      const parsed = parseFloat(listPriceText.replace(/[^\d.]/g, ''));
      if (!isNaN(parsed)) originalPrice = Math.round(parsed);
    }
    category = 'men-fashion';

  } else if (hostname.includes('nykaa.com')) {
    title = $('meta[property="og:title"]').attr('content') || $('title').text().trim();
    $('meta[property="og:image"]').each((_, el) => {
      const src = $(el).attr('content');
      if (src && !images.includes(src)) images.push(src);
    });
    const priceMeta = $('meta[property="product:price:amount"]').attr('content') || $('[itemprop="price"]').attr('content');
    if (priceMeta) {
      const parsed = parseFloat(priceMeta);
      if (!isNaN(parsed)) price = Math.round(parsed);
    }
    category = 'beauty';

  } else {
    title = $('meta[property="og:title"]').attr('content') || $('title').text().trim();
    $('meta[property="og:image"]').each((_, el) => {
      const src = $(el).attr('content');
      if (src && !images.includes(src)) images.push(src);
    });
  }

  // Fallback originalPrice if not found: default to current price
  if (!originalPrice && price) originalPrice = price;

  return {
    title: title ? title.replace(/\s+/g, ' ').trim() : null,
    images,
    imageUrl: images[0] || '',
    rating: rating || 0,
    reviews,
    price,
    originalPrice,
    category
  };
}

/**
 * Main On-Demand Scraper Entry Point
 * Routes through the unified priority queue and token lease manager.
 */
export async function scrapeProductUrl(targetUrl, priority = PRIORITY.DAILY_REFRESH) {
  if (!targetUrl) return null;

  const html = await scraperQueue.enqueue(targetUrl, { priority });
  if (html) {
    const parsed = parseProductHtml(html, targetUrl);
    if (parsed && (parsed.title || parsed.price)) {
      return parsed;
    }
  }

  return null;
}
