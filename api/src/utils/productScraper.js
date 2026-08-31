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

// Both Flipkart and Shopsy (Flipkart-owned, same commerce platform) show their MRP as a real
// discount relationship, but neither carries it in JSON-LD's schema.org Offer — confirmed live
// 2026-08-30 against real products on both: offer.highPrice simply doesn't exist. This is the
// second "connector" for both: cross-validate a rupee number found near a genuine "X% off" badge
// against the live price, since the badge's own percentage IS how the site itself describes that
// exact relationship. A candidate is only ever trusted when this reconciles — no match means an
// honest null, never a guess (see this file's top docblock: a plausible-but-wrong MRP is worse
// than a missing one).
//
// Confirmed live that Flipkart and Shopsy FLOOR the displayed percentage rather than round it
// (e.g. an actual 76.85% discount displays as "76% off", not "77%") — so validation checks
// Math.floor((candidate-price)/candidate*100) against the exact displayed integer, not a fuzzy
// numeric tolerance on a reverse-derived price. That exact check is what the site itself computes
// forward, so it's the correct match condition, not an approximation of one.
function matchesDisplayedDiscount(candidate, livePrice, discountPercent) {
  if (candidate <= livePrice) return false;
  const actualPercent = ((candidate - livePrice) / candidate) * 100;
  return Math.floor(actualPercent) === discountPercent;
}

// Flipkart: the rendered strikethrough MRP element carries `text-decoration-line: line-through`
// as an INLINE style attribute (confirmed live) — a hash-independent signal that survives even
// though the CSS-in-JS class names rotate build to build (the old ._30jeq3/._3I9_R3 selectors
// are dead for exactly that reason).
//
// A raw scan for this alone isn't safe to trust directly, though — confirmed live on the SAME
// page: the main buybox sits above several "similar products" carousels, each with its own
// price/strikethrough/discount triplet, and a naive "first strikethrough found" grabbed a
// CAROUSEL item's price, not the product being scraped. And Flipkart shows more than one kind of
// "X% off" badge on a page (bank/coupon offers alongside the actual MRP-vs-price discount), so
// blindly trusting the first one found isn't safe either — it can be the wrong kind entirely.
// Every {candidate, discount} pair is checked against matchesDisplayedDiscount(), not just the
// first of each, since the correct pairing isn't guaranteed to be the first instance of either in
// document order.
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
      if (matchesDisplayedDiscount(candidate, livePrice, discount)) return candidate;
    }
  }
  return null;
}

// Shopsy: unlike Flipkart, there is NO strikethrough styling anywhere — confirmed live against
// two real products (checked inline style, computed style, and <del>/<s> tags: none present).
// Instead the discount%, MRP, and live price render as three adjacent plain-text leaf nodes
// inside one small widget (confirmed live: "70% off" + "399" + "₹117" all siblings within the
// same tight container, no other markup distinguishing which number is which). So candidates here
// are "any bare number within a couple of DOM levels of a discount badge", validated the exact
// same way as Flipkart — only ever trusted when matchesDisplayedDiscount() actually reconciles.
function extractShopsyMRP($, livePrice) {
  if (!livePrice) return null;

  let result = null;
  $('*').each((_, el) => {
    if (result !== null) return false;
    const $el = $(el);
    if ($el.children().length > 0) return;
    const m = $el.text().trim().match(/^(\d{1,2})%\s*off$/i);
    if (!m) return;
    const discount = parseInt(m[1], 10);

    for (const ancestor of [$el.parent(), $el.parent().parent()]) {
      if (!ancestor || ancestor.length === 0) continue;
      let found = null;
      ancestor.find('*').each((_, leafEl) => {
        if (found !== null) return false;
        const $leaf = $(leafEl);
        if ($leaf.children().length > 0) return;
        const val = parsePriceText($leaf.text());
        if (val !== null && matchesDisplayedDiscount(val, livePrice, discount)) found = val;
      });
      if (found !== null) {
        result = found;
        return false;
      }
    }
  });
  return result;
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

  } else if (hostname.includes('shopsy.in')) {
    // Shopsy (Flipkart-owned, same commerce platform) had NO branch here at all before this —
    // any Shopsy product refreshed via the daily refresher fell through to the generic fallback
    // below, which extracts no price at all. That meant a Shopsy product's price/MRP, even if
    // correctly captured on its first Telegram sighting (verifier.js), would just go stale
    // forever after — see verifier.js's matching Shopsy branch for why JSON-LD is used for price
    // (Shopsy's own __NEXT_DATA__ price is buried in an undocumented, per-A/B-bucket internal
    // payload, confirmed live LESS stable than a hashed CSS class) and extractShopsyMRP()'s
    // docblock for the MRP connector.
    let ldProduct = null;
    $('script[type="application/ld+json"]').each((_, el) => {
      if (ldProduct) return;
      try {
        const parsed = JSON.parse($(el).contents().text());
        const candidate = Array.isArray(parsed) ? parsed.find(p => p['@type'] === 'Product') : parsed;
        if (candidate && candidate['@type'] === 'Product') ldProduct = candidate;
      } catch { /* malformed/unrelated JSON-LD block */ }
    });

    if (ldProduct) {
      title = typeof ldProduct.name === 'string' ? ldProduct.name.trim() : null;
      const ldImages = Array.isArray(ldProduct.image) ? ldProduct.image : (ldProduct.image ? [ldProduct.image] : []);
      ldImages.forEach(src => { if (src && !images.includes(src)) images.push(src); });
      const offer = Array.isArray(ldProduct.offers) ? ldProduct.offers[0] : ldProduct.offers;
      if (offer && offer.price != null) price = parsePriceText(offer.price);
      const ratingValue = ldProduct.aggregateRating?.ratingValue;
      if (ratingValue != null) {
        const parsed = parseFloat(ratingValue);
        if (!isNaN(parsed)) rating = parsed;
      }
    }
    if (price !== null) originalPrice = extractShopsyMRP($, price);

    if (!title) title = $('meta[property="og:title"]').attr('content') || $('title').text().trim();
    if (images.length === 0) {
      $('meta[property="og:image"]').each((_, el) => {
        const src = $(el).attr('content');
        if (src && !images.includes(src)) images.push(src);
      });
    }

  } else if (hostname.includes('meesho.com')) {
    // Meesho is a Next.js app that embeds its ENTIRE product payload — price, real MRP, images,
    // rating, category breadcrumb, stock status — as plain JSON in the standard
    // `<script id="__NEXT_DATA__" type="application/json">` tag, present in the raw SSR HTML with
    // no JS execution needed (confirmed live against two real, unrelated products). Unlike
    // Flipkart/Shopsy, Meesho's own MRP IS a first-class structured field here
    // (mrp_details.mrp) — no cross-validation/guessing connector needed, since this isn't a guess
    // at what the page display implies, it's the literal field the page itself renders from.
    try {
      const nextDataRaw = $('script#__NEXT_DATA__').contents().text();
      if (nextDataRaw) {
        const nextData = JSON.parse(nextDataRaw);
        const pd = nextData?.props?.pageProps?.initialState?.product?.details?.data;
        if (pd) {
          title = typeof pd.name === 'string' ? pd.name.trim() : null;
          if (Array.isArray(pd.images)) {
            pd.images.forEach(src => { if (src && !images.includes(src)) images.push(src); });
          }
          if (pd.price != null) {
            const parsed = parseFloat(pd.price);
            if (!isNaN(parsed)) price = Math.round(parsed);
          }
          if (pd.mrp_details?.mrp != null) {
            const parsed = parseFloat(pd.mrp_details.mrp);
            if (!isNaN(parsed)) originalPrice = Math.round(parsed);
          }
          const avgRating = pd.review_summary?.data?.average_rating;
          if (avgRating != null) {
            const parsed = parseFloat(avgRating);
            if (!isNaN(parsed)) rating = parsed;
          }
          if (Array.isArray(pd.breadcrumb) && pd.breadcrumb.length > 0) {
            // Same keyword-matching scheme as Amazon's breadcrumb detection above — `category`
            // here is a normalized slug this codebase expects (e.g. 'beauty'), not a raw
            // breadcrumb string.
            const crumbs = pd.breadcrumb.map(b => b.title).filter(Boolean).join(' ').toLowerCase();
            if (crumbs.includes('phone') || crumbs.includes('mobile') || crumbs.includes('electronics')) category = 'electronics';
            else if (crumbs.includes('laptop') || crumbs.includes('computer') || crumbs.includes('headphone')) category = 'electronics';
            else if (crumbs.includes('kitchen') || crumbs.includes('home')) category = 'kitchen';
            else if (crumbs.includes('women')) category = 'women-fashion';
            else if (crumbs.includes('men') || crumbs.includes('clothing') || crumbs.includes('fashion') || crumbs.includes('shoes')) category = 'men-fashion';
            else if (crumbs.includes('health') || crumbs.includes('fitness')) category = 'fitness';
            else if (crumbs.includes('beauty') || crumbs.includes('skin')) category = 'beauty';
          }
        }
      }
    } catch (e) {
      console.warn(`Failed to parse Meesho __NEXT_DATA__ for ${targetUrl}:`, e.message);
    }

    if (!title) title = $('meta[property="og:title"]').attr('content') || $('title').text().trim();
    if (images.length === 0) {
      $('meta[property="og:image"]').each((_, el) => {
        const src = $(el).attr('content');
        if (src && !images.includes(src)) images.push(src);
      });
    }

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
