import * as cheerio from 'cheerio';
import Deal from '../db/models/deal.js';
import VerifiedLink from '../db/models/verifiedLink.js';
import ScrapingAntToken from '../db/models/scrapingAntToken.js';
import Product from '../db/models/product.js';
import Master from '../db/models/master.js';
import { scraperQueue, PRIORITY } from '../services/scraperQueue.js';

/**
 * Extract all HTTP/HTTPS links from text using a Regex pattern
 * @param {string} text 
 * @returns {string[]}
 */
export function extractUrls(text) {
  if (!text) return [];
  const urlRegex = /https?:\/\/[^\s$.?#].[^\s]*/gi;
  const matches = text.match(urlRegex) || [];
  return matches.map(url => url.replace(/[.,!?;:]+$/, ''));
}

// Merchant domains this pipeline recognizes when unwrapping a tracker-wrapped/embedded URL.
// Kept as one list so the two checks below (query-param unwrap, raw-string unwrap) and the
// merchant-name list in cleanAndParseUrl() stay in sync as merchants are added/removed — Myntra
// and Nykaa were added here alongside Amazon/Flipkart to support fashion/beauty deal channels;
// Ajio and Shopsy were added later for the same reason.
// Note: all of amazon.in, flipkart.com, myntra.com, nykaa.com, ajio.com, and shopsy.in are
// India-only regardless of their TLD — myntra.com, nykaa.com, and ajio.com are NOT US/generic
// sites despite the .com, they simply never registered a .in domain (shopsy.in already is .in).
// See cleanAndParseUrl()'s derivedCountry handling for each merchant.
const SUPPORTED_MERCHANT_DOMAINS = ['amazon.', 'flipkart.com', 'amzn.to', 'fkrt.it', 'myntra.com', 'nykaa.com', 'ajio.com', 'shopsy.in'];

function isSupportedMerchantUrl(url) {
  return SUPPORTED_MERCHANT_DOMAINS.some(domain => url.includes(domain));
}

// The merchant *names* cleanAndParseUrl() can produce, once a URL is actually parsed rather than
// just pattern-matched by domain — used by verifyAndProcessMessage's candidate-URL loop to decide
// which resolved URL to treat as the deal's product link.
const SUPPORTED_MERCHANTS = ['amazon', 'flipkart', 'myntra', 'nykaa', 'ajio', 'shopsy'];

/**
 * Extract embedded target merchant URLs from tracking/redirect parameter wrappers
 * e.g., https://go.bigtricks.in/?o=https%3A%2F%2Fwww.amazon.in%2Fdp%2FB0FDB6YRGK%3Ftag%3Dbigin-21
 * -> https://www.amazon.in/dp/B0FDB6YRGK
 */
export function unwrapEmbeddedUrl(url) {
  if (!url) return url;
  try {
    const urlObj = new URL(url);
    
    // 1. Inspect query parameters for embedded URLs
    for (const [param, value] of urlObj.searchParams.entries()) {
      const decoded = decodeURIComponent(value);
      const embeddedMatch = decoded.match(/https?:\/\/[^\s"'<>]+/i);
      if (embeddedMatch) {
        const embeddedUrl = embeddedMatch[0];
        if (isSupportedMerchantUrl(embeddedUrl)) {
          console.log(`[Resolver] Unwrapped target merchant URL from "${param}" parameter: ${embeddedUrl}`);
          return embeddedUrl;
        }
      }
    }

    // 2. Decode raw string in case of multi-level encoded URLs
    const decodedRaw = decodeURIComponent(url);
    const rawMatch = decodedRaw.match(/https?:\/\/(?:www\.)?(?:amazon\.[a-z.]+|flipkart\.com|amzn\.to|fkrt\.it|myntra\.com|nykaa\.com|ajio\.com|shopsy\.in)\/[^\s"'<>]+/i);
    if (rawMatch && !isSupportedMerchantUrl(urlObj.hostname)) {
      console.log(`[Resolver] Unwrapped raw embedded merchant URL: ${rawMatch[0]}`);
      return rawMatch[0];
    }
  } catch (e) {}

  return url;
}

/**
 * Resolve redirects recursively to find the canonical URL
 * @param {string} url 
 * @param {number} depth 
 * @returns {Promise<string>}
 */
// Node's built-in fetch sends `User-Agent: node` by default — about as clear a bot signature as
// exists. Several short-link/affiliate-redirect services gate on exactly this: they either block
// non-browser requests outright, or serve a 200 JS-redirect/interstitial page instead of a clean
// 3xx. Either way resolveRedirect() would give up with the short link still unresolved, which then
// fails the merchant check downstream and silently drops the whole message. A real browser UA +
// Accept headers is enough to pass as a normal navigation for the simple HEAD/GET probes here.
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

export async function resolveRedirect(url, depth = 0) {
  if (depth > 5) return url; // Limit recursion to prevent infinite loops

  // First check if the URL contains an embedded target URL in query parameters (e.g. go.bigtricks.in/?o=https://amazon.in/dp/...)
  const unwrapped = unwrapEmbeddedUrl(url);
  if (unwrapped !== url) {
    return resolveRedirect(unwrapped, depth + 1);
  }

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual',
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(6000),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        // Resolve relative redirects
        const absoluteUrl = new URL(location, url).toString();
        return resolveRedirect(absoluteUrl, depth + 1);
      }
    }
    return url;
  } catch (err) {
    // If HEAD fails or times out, try GET with manual redirect
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(6000),
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (location) {
          const absoluteUrl = new URL(location, url).toString();
          return resolveRedirect(absoluteUrl, depth + 1);
        }
      }
    } catch (innerErr) {
      console.warn(`[Resolver Warning] Failed to resolve redirect for ${url}:`, innerErr.message);
    }
    return url;
  }
}

/**
 * Parse and clean a resolved URL, stripping affiliate tracking codes.
 *
 * `isProductUrl` distinguishes an actual product page (e.g. Amazon `/dp/ASIN`,
 * Flipkart `/p/...` or `?pid=`, Myntra `/<id>/buy`, Nykaa `/p/<id>`) from a non-product page on
 * the same domain (search results `/s?k=...`, category/listing pages, storefronts, etc).
 * Callers should treat `isProductUrl: false` the same as an unsupported merchant.
 *
 * @param {string} url
 * @returns {{ cleanUrl: string, merchant: string, productId: string, isProductUrl: boolean, derivedCountry: string|null }}
 */
export function cleanAndParseUrl(url) {
  try {
    const targetUrl = unwrapEmbeddedUrl(url);
    const urlObj = new URL(targetUrl);
    const hostname = urlObj.hostname.toLowerCase();
    let merchant = 'generic';
    let productId = url;
    let cleanUrl = url;
    let isProductUrl = true;
    // The product's real country — derived from the merchant TLD, which is a stable fact about
    // the product itself. Deliberately NOT the posting channel's admin-configured country: that
    // is per-message metadata that can vary post to post, and a Product record is shared across
    // every channel that ever reposts it, so trusting the channel let a later repost from a
    // differently-tagged channel silently flip a product's country for everyone (this happened —
    // amazon.in and flipkart.com are India-only, but a large share had drifted to country:'US').
    let derivedCountry = null;

    if (hostname.includes('amazon.')) {
      merchant = 'amazon';
      if (hostname.endsWith('amazon.in')) derivedCountry = 'IN';
      else if (hostname.endsWith('amazon.com.au')) derivedCountry = 'AU';
      else if (hostname.endsWith('amazon.com')) derivedCountry = 'US';
      else if (hostname.endsWith('amazon.co.uk')) derivedCountry = 'UK';
      else if (hostname.endsWith('amazon.ca')) derivedCountry = 'CA';

      // Match common patterns: /dp/ASIN or /gp/product/ASIN
      const dpMatch = urlObj.pathname.match(/\/dp\/([A-Z0-9]{10})/i);
      const gpMatch = urlObj.pathname.match(/\/gp\/product\/([A-Z0-9]{10})/i);
      const asin = dpMatch ? dpMatch[1] : (gpMatch ? gpMatch[1] : null);

      if (asin) {
        productId = asin.toUpperCase();
        // Construct canonical Amazon URL
        cleanUrl = `https://${urlObj.hostname}/dp/${productId}`;
        isProductUrl = true;
      } else {
        // No ASIN in the path — this is a search/category/storefront page
        // (e.g. /s?k=..., /b?node=...), not a product link. Strip query
        // params for logging purposes only; caller should skip this URL.
        cleanUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
        productId = null;
        isProductUrl = false;
      }
    } else if (hostname.includes('flipkart.com')) {
      merchant = 'flipkart';
      derivedCountry = 'IN'; // Flipkart operates in India only, regardless of source channel
      // Match Flipkart product ID in path or query
      const pidMatch = urlObj.searchParams.get('pid');
      const pathMatch = urlObj.pathname.match(/\/p\/([a-z0-9]{16})/i);
      if (pidMatch) {
        productId = pidMatch;
      } else if (pathMatch) {
        productId = pathMatch[1];
      } else {
        // No pid and no /p/<id> path — search/listing page, not a product.
        productId = null;
        isProductUrl = false;
      }

      // Flipkart canonical URLs generally require product paths and product ID
      const queryParams = [];
      if (pidMatch) queryParams.push(`pid=${pidMatch}`);
      const cleanSearch = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
      cleanUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}${cleanSearch}`;
    } else if (hostname.includes('myntra.com')) {
      merchant = 'myntra';
      derivedCountry = 'IN'; // Myntra is India-only despite the .com TLD — see the comment above SUPPORTED_MERCHANT_DOMAINS
      // Myntra product URLs look like:
      //   myntra.com/tshirts/roadster/roadster-men-navy-solid-round-neck-t-shirt/1234567/buy
      // — a numeric product ID as the path segment right before "/buy".
      const idMatch = urlObj.pathname.match(/\/(\d+)\/buy\/?$/i);
      if (idMatch) {
        productId = idMatch[1];
        cleanUrl = `https://www.myntra.com${urlObj.pathname.replace(/\/$/, '')}`;
        isProductUrl = true;
      } else {
        // No numeric id/buy path — search/listing/category page, not a product.
        cleanUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
        productId = null;
        isProductUrl = false;
      }
    } else if (hostname.includes('nykaa.com')) {
      merchant = 'nykaa';
      derivedCountry = 'IN'; // Nykaa is India-only despite the .com TLD — see the comment above SUPPORTED_MERCHANT_DOMAINS
      // Nykaa product URLs look like: nykaa.com/lakme-9-to-5-primer-matte-lip-color/p/475677
      // — a numeric product ID after "/p/".
      const pidMatch = urlObj.pathname.match(/\/p\/(\d+)/i);
      if (pidMatch) {
        productId = pidMatch[1];
        cleanUrl = `https://www.nykaa.com${urlObj.pathname.replace(/\/$/, '')}`;
        isProductUrl = true;
      } else {
        // No /p/<id> path — search/listing/category page, not a product.
        cleanUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
        productId = null;
        isProductUrl = false;
      }
    } else if (hostname.includes('ajio.com')) {
      merchant = 'ajio';
      derivedCountry = 'IN'; // Ajio (Reliance) is India-only despite the .com TLD — see the comment above SUPPORTED_MERCHANT_DOMAINS
      // Ajio product URLs look like:
      //   ajio.com/neonomad-men-striped-regular-fit-polo-t-shirt/p/702341640_green
      // — a numeric product code right after "/p/", optionally followed by "_<colour>" since the
      // same listing gets a distinct URL per colour variant. Keep the colour suffix as part of the
      // identity (unlike Amazon's ASIN) — different colours are genuinely different SKUs with their
      // own price/stock, not the same product under a different link.
      const idMatch = urlObj.pathname.match(/\/p\/([a-z0-9]+(?:_[a-z0-9]+)?)/i);
      if (idMatch) {
        productId = idMatch[1];
        cleanUrl = `https://www.ajio.com${urlObj.pathname.replace(/\/$/, '')}`;
        isProductUrl = true;
      } else {
        // No /p/<id> path — search/listing/category page, not a product.
        cleanUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
        productId = null;
        isProductUrl = false;
      }
    } else if (hostname.includes('shopsy.in')) {
      merchant = 'shopsy';
      derivedCountry = 'IN'; // Shopsy (Flipkart-owned) is explicitly India-only — shopsy.in, no other TLD
      // Shopsy runs on Flipkart's own commerce platform (product images even serve off
      // rukmini*.flixcart.com, and listing URLs carry "&marketplace=FLIPKART"), so its product
      // identity uses the identical 16-char alphanumeric `pid` Flipkart uses — same param, same
      // shape, checked live: e.g.
      //   shopsy.in/realglimpse-printed-women-black-t-shirt/p/itm9effd8af7ba24?pid=XPTGEBG52VKZPPDA
      // The path segment after "/p/" (itm9effd8af7ba24) is a stable per-listing slug too, so it's
      // used as a path-based fallback identity when a link has been stripped of its query string.
      const pidMatch = urlObj.searchParams.get('pid');
      const pathMatch = urlObj.pathname.match(/\/p\/(itm[a-z0-9]+)/i);
      if (pidMatch) {
        productId = pidMatch;
        isProductUrl = true;
      } else if (pathMatch) {
        productId = pathMatch[1];
        isProductUrl = true;
      } else {
        productId = null;
        isProductUrl = false;
      }

      const cleanSearch = pidMatch ? `?pid=${pidMatch}` : '';
      cleanUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}${cleanSearch}`;
    } else {
      // For general merchants, strip standard tracking parameters
      const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'];
      trackingParams.forEach(param => urlObj.searchParams.delete(param));
      cleanUrl = urlObj.toString().replace(/\/$/, ''); // Remove trailing slash
      productId = cleanUrl;

      const domainParts = hostname.replace('www.', '').split('.');
      merchant = domainParts[0] || 'generic';
    }

    return { cleanUrl, merchant, productId, isProductUrl, derivedCountry };
  } catch (err) {
    console.error(`[Cleaner Error] Failed to clean URL ${url}:`, err.message);
    return { cleanUrl: url, merchant: 'generic', productId: url, isProductUrl: false, derivedCountry: null };
  }
}

/**
 * Check if the clean URL — or, more reliably, the same merchant product ID — was processed in the
 * last 60 minutes. dealUrl alone isn't a safe identity key: the same Flipkart pid can resolve to a
 * different landing-page slug (different cleanUrl) depending on which link led there, so an
 * exact-dealUrl-only check misses real duplicates. productId is the actual stable identity.
 * @param {string} cleanUrl
 * @param {string|null} productId
 * @param {string|null} merchant
 * @returns {Promise<boolean>}
 */
export async function isDuplicateLast60Mins(cleanUrl, productId = null, merchant = null) {
  const sixtyMinsAgo = new Date(Date.now() - 60 * 60 * 1000);
  const identityMatch = [{ dealUrl: cleanUrl }];
  if (productId && merchant) {
    identityMatch.push({ productId, merchant });
  }
  const count = await Deal.countDocuments({
    createdAt: { $gte: sixtyMinsAgo },
    $or: identityMatch
  });
  return count > 0;
}

/**
 * Fetch and extract product details using Distributed BullMQ Scraping Queue
 * @param {string} targetUrl 
 * @returns {Promise<{ images: string[], rating: number, reviews: Array }>}
 */
// Parse an Indian-format price string ("₹1,299.00", "1,299.") into a number. Returns null for
// anything that isn't a sane product price. Not `.first()`-based like the raw selector fallbacks
// below — see findPrice() — because Amazon's first matching node for a given selector is often
// empty (the real value sits in a later sibling), silently reporting no price on pages that
// plainly had one.
function parsePriceText(raw) {
  if (!raw) return null;
  const cleaned = String(raw).replace(/[^\d.]/g, '').replace(/\.$/, '');
  if (!cleaned) return null;
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed) || parsed <= 0 || parsed > 10000000) return null;
  return Math.round(parsed);
}

// First parseable price among ALL matches of the given selectors, in order — scoped to `root`
// when given (a product page can carry dozens of `.a-price` nodes from sponsored carousels and
// "similar items"; unscoped, `.first()` can silently return a neighbouring product's price).
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

// Price/MRP from schema.org JSON-LD — the stable extraction point on sites (Flipkart) whose CSS
// class names are hashed and rotate on every rebuild.
function extractJsonLdPrice($) {
  let result = { price: null, originalPrice: null, inStock: null };
  $('script[type="application/ld+json"]').each((_, el) => {
    if (result.price !== null) return false;
    let parsed;
    try {
      parsed = JSON.parse($(el).contents().text());
    } catch {
      return; // Malformed blocks are common; just skip them.
    }
    const roots = Array.isArray(parsed) ? parsed : [parsed];
    for (const root of roots) {
      for (const node of (root['@graph'] || [root])) {
        if (!node || !node.offers) continue;
        const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
        if (!offer) continue;
        const price = parsePriceText(offer.price ?? offer.lowPrice);
        if (price === null) continue;
        result = {
          price,
          originalPrice: parsePriceText(offer.highPrice),
          inStock: typeof offer.availability === 'string' ? /InStock/i.test(offer.availability) : null,
        };
        return false;
      }
    }
  });
  return result;
}

export async function scrapeProductDetails(targetUrl) {
  try {
    const html = await scraperQueue.enqueue(targetUrl, { priority: PRIORITY.TELEGRAM });
    if (!html) {
      return { title: null, images: [], rating: null, reviews: [], price: null, originalPrice: null, categoryHint: null, couponRawText: null };
    }

    // Parse HTML with cheerio
    const $ = cheerio.load(html);
    const images = [];
    const reviews = [];
    let title = null;
    let rating = null;
    let price = null;
    let originalPrice = null;
    // Feeds deriveCategory() — the non-AI replacement for what used to be DeepSeek reading the
    // category off the Telegram message text. Amazon: breadcrumb trail text. Flipkart: the
    // schema.org JSON-LD Product.category field (a bare word like "mouse" — no breadcrumb is
    // exposed on Flipkart product pages, checked against live markup: no BreadcrumbList JSON-LD,
    // no breadcrumb microdata, so this is the only signal available there).
    let categoryHint = null;
    // Amazon-only — see parseAmazonCoupon()'s docblock.
    let couponRawText = null;

    const hostname = new URL(targetUrl).hostname.toLowerCase();

    if (hostname.includes('amazon.')) {
      categoryHint = $('#wayfinding-breadcrumbs_feature_div').text().replace(/\s+/g, ' ').trim() || null;
      couponRawText = $('#couponsInBuybox_feature_div').text().replace(/\s+/g, ' ').trim() || null;

      // Amazon Title
      title = $('#productTitle').text().trim() || $('meta[name="title"]').attr('content');

      // 1. Title/Meta image fallback
      $('meta[property="og:image"]').each((_, el) => {
        const src = $(el).attr('content');
        if (src && !images.includes(src)) images.push(src);
      });

      // Amazon main product images
      $('#landingImage, #imgTagWrapperId img, #main-image').each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('data-old-hires');
        if (src && !images.includes(src)) images.push(src);
      });

      // Amazon Rating
      const ratingText = $('.a-icon-alt').first().text();
      const ratingMatch = ratingText.match(/([0-9.]+)\s*out\s*of\s*5/i);
      if (ratingMatch) {
        rating = parseFloat(ratingMatch[1]);
      }

      // Amazon Reviews
      $('.review-text-content span').slice(0, 3).each((i, el) => {
        const text = $(el).text().trim();
        if (text) {
          reviews.push({
            author: 'Customer',
            text: text.substring(0, 300),
            rating: 5,
            date: new Date()
          });
        }
      });

      // Amazon Price Extraction — scoped to the main product column first (see findPrice()).
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

    } else if (hostname.includes('flipkart.com')) {
      // Flipkart Title
      title = $('.B_NuCI').first().text().trim() || $('.VU-ZEz').first().text().trim() || $('meta[name="title"]').attr('content');

      // Flipkart Meta Image
      $('meta[property="og:image"]').each((_, el) => {
        const src = $(el).attr('content');
        if (src && !images.includes(src)) images.push(src);
      });

      // Flipkart product images
      $('img[src*="/image/"]').slice(0, 3).each((_, el) => {
        const src = $(el).attr('src');
        if (src && !images.includes(src)) images.push(src);
      });

      // Flipkart Price Extraction — JSON-LD first. Flipkart's class names are hashed and rotate
      // (._30jeq3/._3I9_R3 below are already dead against live markup); the schema.org
      // Product.offers block has stayed stable, and its Product.category field (e.g. "mouse")
      // doubles as the categoryHint Flipkart has no breadcrumb equivalent for.
      const fkLd = extractJsonLdPrice($);
      if (fkLd.price !== null) {
        price = fkLd.price;
        if (fkLd.originalPrice !== null) originalPrice = fkLd.originalPrice;
      } else {
        price = findPrice($, ['._30jeq3', 'div[class*="_30jeq3"]', '.Nx9bqj', '._16Jk6d']);
      }
      if (originalPrice === null) {
        originalPrice = findPrice($, ['._3I9_R3', 'div[class*="_3I9_R3"]', '.yRaY8j', '._3auQ3N']);
      }

      $('script[type="application/ld+json"]').each((_, el) => {
        if (categoryHint) return;
        try {
          const parsed = JSON.parse($(el).contents().text());
          const arr = Array.isArray(parsed) ? parsed : [parsed];
          for (const node of arr) {
            for (const g of (node['@graph'] || [node])) {
              if (g && g['@type'] === 'Product' && typeof g.category === 'string' && g.category.trim()) {
                categoryHint = g.category.trim();
              }
            }
          }
        } catch { /* malformed/unrelated JSON-LD block — try the next script tag */ }
      });

      // Flipkart Rating
      const ratingText = $('._3LWZlK').first().text();
      if (ratingText) {
        rating = parseFloat(ratingText);
      }

      // Flipkart Reviews
      $('._2-t18p, .t-yNPA').slice(0, 3).each((i, el) => {
        const text = $(el).text().trim();
        if (text) {
          reviews.push({
            author: 'Buyer',
            text: text.substring(0, 300),
            rating: 5,
            date: new Date()
          });
        }
      });
    } else if (hostname.includes('myntra.com')) {
      // Myntra renders as a client-side React app with hashed/utility class names in places, and
      // its product images are set via CSS background-image on a div rather than an <img src> —
      // og:title/og:image are the most stable extraction points and are tried first everywhere
      // below; the pdp-* class names are a best-effort second source (Myntra has kept these
      // specific names stable historically, but they aren't verified against live markup as part
      // of this change — check scraper logs after the first real Myntra deals and adjust here if
      // price/rating come back empty).
      title = $('meta[property="og:title"]').attr('content')
        || `${$('.pdp-title').first().text().trim()} ${$('.pdp-name').first().text().trim()}`.trim()
        || $('title').text().trim();

      $('meta[property="og:image"]').each((_, el) => {
        const src = $(el).attr('content');
        if (src && !images.includes(src)) images.push(src);
      });

      // Myntra Price Extraction
      const dealPriceText = $('.pdp-price strong').first().text().trim();
      if (dealPriceText) {
        const cleanPrice = dealPriceText.replace(/[^\d.]/g, '');
        const parsed = parseFloat(cleanPrice);
        if (!isNaN(parsed)) price = Math.round(parsed);
      }
      const listPriceText = $('.pdp-mrp s').first().text().trim();
      if (listPriceText) {
        const cleanPrice = listPriceText.replace(/[^\d.]/g, '');
        const parsed = parseFloat(cleanPrice);
        if (!isNaN(parsed)) originalPrice = Math.round(parsed);
      }

      // Myntra Rating
      const ratingText = $('.index-overallRating > div').first().text().trim();
      if (ratingText && /^[0-9.]+$/.test(ratingText)) {
        rating = parseFloat(ratingText);
      }
    } else if (hostname.includes('nykaa.com')) {
      // Nykaa is a CSS-in-JS (hashed classnames) React app — those class names are unusable as
      // stable selectors, so og:title/og:image and schema.org product markup (when present) are
      // the only extraction points used here. MRP/discount/rating aren't attempted at all rather
      // than guess at brittle selectors; this pipeline hasn't been verified against live Nykaa
      // markup — see the price-history fallback (verifyAndProcessMessage) for how a deal can
      // still be verified even when scraping only recovers title/image.
      title = $('meta[property="og:title"]').attr('content') || $('title').text().trim();

      $('meta[property="og:image"]').each((_, el) => {
        const src = $(el).attr('content');
        if (src && !images.includes(src)) images.push(src);
      });

      const priceMeta = $('meta[property="product:price:amount"]').attr('content')
        || $('[itemprop="price"]').attr('content');
      if (priceMeta) {
        const parsed = parseFloat(priceMeta);
        if (!isNaN(parsed)) price = Math.round(parsed);
      }
    } else if (hostname.includes('ajio.com')) {
      // Ajio is server-rendered with stable, non-hashed class names (verified against live
      // markup) — the "prod-" prefix is a consistent PDP naming convention.
      title = $('h1.prod-name').first().text().trim()
        || $('meta[property="og:title"]').attr('content')
        || $('title').text().trim();

      $('meta[property="og:image"]').each((_, el) => {
        const src = $(el).attr('content');
        if (src && !images.includes(src)) images.push(src);
      });
      $('.img-alignment').each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src');
        if (src && !images.includes(src)) images.push(src);
      });

      // Selling price ("prod-sp") and strike-through MRP ("prod-cp")
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

      // Rating text is like "3.5  5.9K Ratings" — parseFloat stops at the first non-numeric
      // character, so it cleanly yields just the leading rating value.
      const ratingText = $('.rating-popup').first().text().trim();
      if (ratingText) {
        const parsed = parseFloat(ratingText);
        if (!isNaN(parsed)) rating = parsed;
      }
    } else if (hostname.includes('shopsy.in')) {
      // Shopsy is a Next.js app (window.__NEXT_DATA__ present) that also happens to render some
      // components with React Native Web, whose class names are atomic/hashed
      // ("css-146c3p1 r-cqee49 ...", regenerated per build) and unusable as stable selectors —
      // checked live. __NEXT_DATA__ itself *does* hold the real price/rating, but only inside
      // Flipkart's own deeply-nested, per-request A/B-tested internal widget payload (confirmed
      // live: the rating value sat behind an "events.psi...individualRatingsCount" path) — that's
      // an undocumented private rendering contract that can reshape per build AND per A/B bucket,
      // i.e. LESS stable than a hashed CSS class, not more. Skip it.
      //
      // Instead, prefer the schema.org JSON-LD <script type="application/ld+json"> block Shopsy
      // renders for Google Shopping/SEO (confirmed live) — a standards-based contract with real
      // incentive to stay well-formed, present in the raw SSR HTML so plain Cheerio sees it with
      // no JS execution needed. It reliably has name/price/rating/images (full-res, off
      // Flipkart's rukmini*.flixcart.com CDN — better than og:image's single 300x300 thumbnail),
      // but schema.org's Offer type has no standard "original/strike price" field, so MRP is
      // still not available here (the marketing description text sometimes reads "for Rs.<N>
      // online" where N looks like it could be the MRP, but that's an unverified content
      // convention, not a data field — not safe to regex out as ground truth). See the
      // price-history fallback (verifyAndProcessMessage) for how a deal can still verify without
      // a scraped MRP.
      let ldProduct = null;
      $('script[type="application/ld+json"]').each((_, el) => {
        if (ldProduct) return; // already found one
        try {
          const parsed = JSON.parse($(el).contents().text());
          const candidate = Array.isArray(parsed) ? parsed.find(p => p['@type'] === 'Product') : parsed;
          if (candidate && candidate['@type'] === 'Product') ldProduct = candidate;
        } catch (e) { /* malformed/unrelated JSON-LD block — try the next script tag */ }
      });

      if (ldProduct) {
        title = typeof ldProduct.name === 'string' ? ldProduct.name.trim() : null;

        const ldImages = Array.isArray(ldProduct.image) ? ldProduct.image : (ldProduct.image ? [ldProduct.image] : []);
        ldImages.forEach(src => { if (src && !images.includes(src)) images.push(src); });

        const offer = Array.isArray(ldProduct.offers) ? ldProduct.offers[0] : ldProduct.offers;
        if (offer && offer.price != null) {
          const parsed = parseFloat(offer.price);
          if (!isNaN(parsed)) price = Math.round(parsed);
        }

        const ratingValue = ldProduct.aggregateRating?.ratingValue;
        if (ratingValue != null) {
          const parsed = parseFloat(ratingValue);
          if (!isNaN(parsed)) rating = parsed;
        }
      }

      // Defensive fallback if JSON-LD was absent/malformed this run — og:title/og:image are still
      // reliable even then (Shopsy sets them properly).
      if (!title) title = $('meta[property="og:title"]').attr('content') || $('title').text().trim();
      if (images.length === 0) {
        $('meta[property="og:image"]').each((_, el) => {
          const src = $(el).attr('content');
          if (src && !images.includes(src)) images.push(src);
        });
      }
    } else {
      // Generic Title fallback
      title = $('meta[property="og:title"]').attr('content') || $('title').text().trim();

      // Generic meta scraping fallback
      $('meta[property="og:image"]').each((_, el) => {
        const src = $(el).attr('content');
        if (src && !images.includes(src)) images.push(src);
      });
      $('img').slice(0, 3).each((_, el) => {
        const src = $(el).attr('src');
        if (src && src.startsWith('http') && !images.includes(src)) images.push(src);
      });
    }

    return { title, images, rating, reviews, price, originalPrice, categoryHint, couponRawText };
  } catch (err) {
    console.error(`[Scraper Error] Scraping failed for ${targetUrl}:`, err.message);
    // Return empty fallback instead of crashing the pipeline
    return { title: null, images: [], rating: null, reviews: [], price: null, originalPrice: null, breadcrumbText: null };
  }
}

export function calculateDiscount(original, deal) {
  if (!original || !deal || original <= deal) return 0;
  return Math.round(((original - deal) / original) * 100);
}

/**
 * Product-type keyword → (category, subcategory) table. Exists because a category "hint" string
 * frequently does NOT contain a Master category/subcategory label's own text verbatim — Flipkart's
 * JSON-LD Product.category is a bare word like "mouse", which contains neither "electronics" nor
 * "Mobile Accessories"; even Amazon's own breadcrumb trail says "Computers & Accessories", not
 * "electronics" or "Laptops & Computers". Label-substring matching alone was silently landing
 * most non-Amazon-with-a-lucky-breadcrumb deals on 'general'.
 *
 * Deliberately a plain keyword table, not an attempt at exhaustive synonym coverage — extend it
 * as gaps show up in production ([Verifier] Category log lines landing on 'general' for a hint
 * that clearly named a real product type). Ordered specific-before-general within each category
 * so e.g. "smartwatch" (wearables) is checked before a hypothetical bare "watch" catch-all would
 * misroute it to men's/women's watches.
 */
const CATEGORY_KEYWORDS = [
  // electronics
  [/\b(mouse|keyboard|laptop|notebook|desktop|monitor|webcam|motherboard|graphics card|\bssd\b|\bram\b|hard ?disk|pen ?drive|memory card)\b/i, 'electronics', 'laptops'],
  [/\b(smartphone|mobile phone|\bmobile\b|\btablet\b|\bipad\b)\b/i, 'electronics', 'mobiles'],
  [/\b(camera|dslr|\blens\b|tripod|action cam|gopro)\b/i, 'electronics', 'cameras'],
  [/\b(\btv\b|television|home theatre|soundbar|projector)\b/i, 'electronics', 'tv'],
  [/\b(earphone|earbud|headphone|neckband|bluetooth speaker|\bspeaker\b)\b/i, 'electronics', 'audio'],
  [/\b(smartwatch|fitness band|wearable)\b/i, 'electronics', 'wearables'],
  [/\b(charger|\bcable\b|power ?bank|adapter|\busb\b)\b/i, 'electronics', 'accessories'],
  [/\b(gaming|game console|joystick|controller|playstation|xbox)\b/i, 'electronics', 'gaming'],
  // beauty
  [/\b(shampoo|conditioner|hair oil|hair serum)\b/i, 'beauty', 'haircare'],
  [/\b(soap|body wash|body lotion|moisturi[sz]er|sunscreen|shower gel)\b/i, 'beauty', 'bath-body'],
  [/\b(face wash|cleanser|face serum|toner|face cream)\b/i, 'beauty', 'skincare'],
  [/\b(lipstick|makeup|foundation|kajal|mascara|eyeliner|compact|concealer)\b/i, 'beauty', 'makeup'],
  [/\b(perfume|deodorant|\bdeo\b|fragrance|body spray)\b/i, 'beauty', 'fragrance'],
  [/\b(trimmer|shaver|razor|hair dryer|hair straightener)\b/i, 'beauty', 'appliances'],
  [/\b(nail polish|manicure|nail art)\b/i, 'beauty', 'nailcare'],
  // fitness
  [/\b(protein|\bwhey\b|supplement|creatine|multivitamin|\bbcaa\b)\b/i, 'fitness', 'nutrition'],
  [/\b(dumbbell|treadmill|resistance band|kettlebell|gym equipment)\b/i, 'fitness', 'gym-equipment'],
  [/\b(yoga mat|\byoga\b)\b/i, 'fitness', 'yoga'],
  [/\b(cricket|badminton|football|\bracket\b|sports gear)\b/i, 'fitness', 'sports-gear'],
  // home
  [/\b(cookware|kadai|\btawa\b|pressure cooker|mixer grinder|induction|cooker)\b/i, 'home', 'kitchen'],
  [/\b(bedsheet|\bpillow\b|blanket|\bquilt\b|mattress)\b/i, 'home', 'bedding'],
  [/\b(curtain|cushion|wall art|showpiece|home decor)\b/i, 'home', 'decor'],
  [/\b(\bsofa\b|dining table|office chair|furniture|wardrobe)\b/i, 'home', 'furniture'],
  [/\b(refrigerator|washing machine|air conditioner|\bgeyser\b|water heater)\b/i, 'home', 'appliances-large'],
  [/\b(exhaust fan|ceiling fan|table fan|ventilat(?:or|ion)|room heater|water purifier)\b/i, 'home', 'appliances-large'],
  [/\b(storage box|organizer|storage rack)\b/i, 'home', 'storage'],
  [/\b(\bdrill\b|screwdriver|tool ?kit)\b/i, 'home', 'tools'],
  [/\b(cleaning|\bmop\b|detergent|\bbroom\b)\b/i, 'home', 'cleaning'],
  // general — Master's own category list has no top-level "auto"/"books"/etc.; these are
  // subcategories *of* general (confirmed live: general|auto|"Car & Bike Accessories" etc.), so
  // without an explicit entry here a clear hint like "Motorbike Accessories & Parts" still fell
  // through to general with no subcategory at all (confirmed live: a bike cover did exactly this).
  [/\b(bike cover|motorbike|scooter|car cover|car accessories|helmet|riding gear|dashboard camera)\b/i, 'general', 'auto'],
  [/\b(book\b|novel|stationery|notebook set|pen set)\b/i, 'general', 'books-stationery'],
  [/\b(grocery|groceries|gourmet|snacks pack|spices)\b/i, 'general', 'groceries'],
  [/\b(pet food|dog collar|cat litter|pet supplies|aquarium)\b/i, 'general', 'pet-supplies'],
  [/\b(baby toy|kids toy|action figure|board game|stroller|diaper)\b/i, 'general', 'baby-toys'],
  [/\b(guitar|keyboard piano|violin|drum kit|musical instrument)\b/i, 'general', 'musical'],
];

// A men's/women's garment word alone (e.g. "trouser") is gender-neutral — the actual signal for
// which fashion category it belongs to is almost always right next to it ("Men's Slim Fit
// Trouser"). Checked against the combined hint+title text; defaults to men-fashion only because
// that happens to be this pipeline's larger existing category — genuinely ambiguous either way.
function inferFashionGender(text) {
  if (/\b(women'?s?|girls?|ladies)\b/i.test(text)) return 'women-fashion';
  return 'men-fashion';
}

// Fashion subcategory VALUES are inconsistently named in Master — men's footwear/bags/watches
// are bare ("footwear", "bags", "watches") while women's are gender-prefixed ("women-footwear",
// "women-bags", "women-watches"), and men's has a topwear/bottomwear split while women's has an
// ethnic/western split instead (no "women-topwear"/"women-bottomwear" exists at all). A single
// shared value per product type — what CATEGORY_KEYWORDS uses for every other category — can't
// express this, so fashion is resolved separately, after gender is already known, against an
// explicit per-gender table instead.
const FASHION_KEYWORDS = [
  [/\b(footwear|\bshoes\b|sandals|sneakers|slippers)\b/i, { 'men-fashion': 'footwear', 'women-fashion': 'women-footwear' }],
  [/\b(handbag|\bpurse\b|\bwallet\b|\bbag\b)\b/i, { 'men-fashion': 'bags', 'women-fashion': 'women-bags' }],
  [/\b(watch)\b/i, { 'men-fashion': 'watches', 'women-fashion': 'women-watches' }],
  [/\b(innerwear|lingerie|sleepwear|nightwear)\b/i, { 'men-fashion': 'innerwear', 'women-fashion': 'women-innerwear' }],
  [/\b(\bkurta\b|saree|\bsari\b|ethnic|salwar|lehenga)\b/i, { 'men-fashion': 'men-topwear', 'women-fashion': 'women-ethnic' }],
  [/\b(trouser|jeans|\bpants?\b|bottomwear)\b/i, { 'men-fashion': 'men-bottomwear', 'women-fashion': 'women-western' }],
  [/\b(\bshirt\b|t-?shirt|topwear)\b/i, { 'men-fashion': 'men-topwear', 'women-fashion': 'women-western' }],
];

function deriveFashion(combined) {
  const gender = inferFashionGender(combined);
  for (const [pattern, byGender] of FASHION_KEYWORDS) {
    if (pattern.test(combined)) return { category: gender, subcategory: byGender[gender] };
  }
  return { category: gender, subcategory: '' };
}

/**
 * Category/subcategory classification with no LLM involved — this used to be DeepSeek's job
 * (parsing the Telegram message text), which meant every deal's category depended on an
 * external API call, and a failed/empty parse ("Price: Rs. N/A") could sink an otherwise-good
 * deal. Category/subcategory stay Master-collection-driven (no hardcoded enum, same as before)
 * so adding a new one in the admin still works without touching this code — CATEGORY_KEYWORDS
 * above only maps existing Master values, it doesn't invent new ones.
 *
 * Priority: (1) the source channel's own admin-configured category wins outright when set —
 * these aggregator channels are almost always topic-focused, so this is a strong, free,
 * zero-latency signal. (2) An exact label/value match against the scraped category hint (Amazon's
 * breadcrumb trail, or Flipkart's JSON-LD Product.category). (3) The keyword table above, against
 * the hint AND the product title combined — this is what actually classifies most deals now,
 * since neither site's hint text usually contains a Master label verbatim. (4) 'general'.
 *
 * Returns { category, subcategory } together — the keyword table pairs them, so deriving
 * subcategory separately afterward would throw away a match this already found.
 */
export async function deriveCategory(channelCategory, categoryHint, titleText) {
  let categoryDocs = [];
  let subcategoryDocs = [];
  try {
    [categoryDocs, subcategoryDocs] = await Promise.all([
      Master.find({ type: 'category', isActive: true }).lean(),
      Master.find({ type: 'subcategory', isActive: true }).lean(),
    ]);
  } catch (err) {
    console.error('[Verifier] Failed to fetch master taxonomy:', err.message);
  }
  const validCategories = categoryDocs.length ? categoryDocs.map(c => c.value) : ['fitness', 'general'];
  const subcatValues = new Set(subcategoryDocs.map(s => s.value));

  if (channelCategory && channelCategory !== 'auto' && validCategories.includes(channelCategory)) {
    return { category: channelCategory, subcategory: '' };
  }

  const combined = [categoryHint, titleText].filter(Boolean).join(' ');
  const lower = combined.toLowerCase();

  if (lower) {
    for (const c of categoryDocs) {
      const label = (c.label || c.value || '').toLowerCase();
      if (label && lower.includes(label)) return { category: c.value, subcategory: '' };
    }
    for (const val of validCategories) {
      if (lower.includes(val.toLowerCase())) return { category: val, subcategory: '' };
    }

    for (const [pattern, category, subcategory] of CATEGORY_KEYWORDS) {
      if (!pattern.test(combined)) continue;
      const resolvedSubcategory = subcatValues.has(subcategory) ? subcategory : '';
      return { category, subcategory: resolvedSubcategory };
    }

    const fashionMatch = FASHION_KEYWORDS.some(([pattern]) => pattern.test(combined))
      || /\b(fashion|apparel|clothing|wear)\b/i.test(combined);
    if (fashionMatch) {
      const { category, subcategory } = deriveFashion(combined);
      const resolvedSubcategory = subcatValues.has(subcategory) ? subcategory : '';
      return { category, subcategory: resolvedSubcategory };
    }
  }

  return { category: 'general', subcategory: '' };
}

/**
 * Amazon-only for now (see verifier.js's scrapeProductDetails — Flipkart's page structure hasn't
 * been checked for an equivalent). Extracted from #couponsInBuybox_feature_div, a real container
 * confirmed present in live scraped Amazon markup, whose raw text is empty when no coupon is
 * currently active on that listing (checked against several live products with none) — this
 * parses it if and when it's non-empty. Note: I was not able to confirm the exact wording Amazon
 * renders inside it for an actually-active coupon against live markup this session (none of the
 * sampled products currently had one) — this covers the phrasings Amazon.in is documented to use
 * ("apply coupon", "% off coupon", a flat ₹ amount) but should be double-checked against the
 * first few real matches in production logs (search for "[Verifier] Amazon coupon detected").
 */
function parseAmazonCoupon(rawText) {
  if (!rawText) return null;
  const text = rawText.replace(/\s+/g, ' ').trim();
  if (!text) return null;

  const percentMatch = text.match(/(\d{1,2}(?:\.\d+)?)\s*%\s*(?:off|coupon)/i) || text.match(/coupon.*?(\d{1,2}(?:\.\d+)?)\s*%/i);
  if (percentMatch) {
    const value = parseFloat(percentMatch[1]);
    if (value > 0 && value <= 100) {
      return { type: 'percent', value, code: null, label: `Apply ${value}% coupon` };
    }
  }

  const flatMatch = text.match(/(?:₹|rs\.?\s*)\s*([\d,]+)\s*(?:off|coupon)/i) || text.match(/coupon.*?(?:₹|rs\.?\s*)\s*([\d,]+)/i);
  if (flatMatch) {
    const value = parseFloat(flatMatch[1].replace(/,/g, ''));
    if (value > 0) {
      return { type: 'flat', value, code: null, label: `Apply ₹${value} coupon` };
    }
  }

  if (/coupon/i.test(text)) {
    return { type: 'code', value: null, code: null, label: 'Apply coupon on Amazon' };
  }

  return null;
}

/**
 * End-to-end verifier processing function called by the sequential queue
 * @param {string} sourceChannelId
 * @param {string} sourceMessageId
 * @param {string} messageText
 * @param {string} channelCountry - the posting channel's admin-configured country; only used as a
 *   fallback when the product's country can't be derived from its own merchant URL (see cleanAndParseUrl)
 * @param {string} sourceChannelName
 * @param {(() => Promise<string|null>)|null} getTelegramPhotoUrl - lazy accessor for the source
 *   message's own photo (if any), used only as a last-resort image fallback when scraping fails
 *   and nothing is cached yet. Only invoked when actually needed, to avoid downloading media for
 *   every message.
 * @param {string} channelCategory - the posting channel's admin-configured category ('auto' if
 *   unset). See deriveCategory() — this is the primary category signal now that nothing parses
 *   the message text.
 * @returns {Promise<object|null>}
 */
export async function verifyAndProcessMessage(sourceChannelId, sourceMessageId, messageText, channelCountry = 'IN', sourceChannelName = 'Unknown', getTelegramPhotoUrl = null, channelCategory = 'auto') {
  console.log(`[Verifier] Processing message ${sourceMessageId} from channel ${sourceChannelId}...`);

  // 1. Link Extraction
  const urls = extractUrls(messageText);
  if (urls.length === 0) {
    console.log(`[Verifier] Message ${sourceMessageId} contains no URLs. Skipping.`);
    return null;
  }

  // 2 & 3. Resolve + clean every URL found in the message, and use the first
  // one that resolves to an actual Amazon/Flipkart *product* page. Messages
  // often lead with an intro/tracking link or a search/category link before
  // the real product link — trying only urls[0] silently dropped those.
  let primaryUrl, resolvedUrl, cleanUrl, merchant, productId, derivedCountry;

  for (let i = 0; i < urls.length; i++) {
    const candidate = urls[i];
    const resolvedCandidate = await resolveRedirect(candidate);
    const parsed = cleanAndParseUrl(resolvedCandidate);

    console.log(`[Verifier] Candidate URL ${i + 1}/${urls.length}: ${parsed.cleanUrl} (merchant: ${parsed.merchant}, product: ${parsed.isProductUrl})`);

    if (SUPPORTED_MERCHANTS.includes(parsed.merchant) && parsed.isProductUrl) {
      primaryUrl = candidate;
      resolvedUrl = resolvedCandidate;
      cleanUrl = parsed.cleanUrl;
      merchant = parsed.merchant;
      productId = parsed.productId;
      derivedCountry = parsed.derivedCountry;
      break;
    }
  }

  if (!cleanUrl) {
    console.log(`[Verifier] No ${SUPPORTED_MERCHANTS.join('/')} product link found among ${urls.length} URL(s) in message ${sourceMessageId} (search/category links and other merchants don't count). Skipping.`);
    return null;
  }

  console.log(`[Verifier] Resolved & cleaned URL: ${cleanUrl} (${merchant}, ID: ${productId})`);

  // The product's real country — from the merchant TLD, not the posting channel's config (see
  // cleanAndParseUrl). Only fall back to the channel's country when the domain didn't resolve to
  // a known one (shouldn't happen for amazon.*/flipkart.com, but stay safe for edge cases).
  const country = derivedCountry || channelCountry;
  if (derivedCountry && derivedCountry !== channelCountry) {
    console.log(`[Verifier] Country derived from URL (${derivedCountry}) overrides channel-configured country (${channelCountry}) for ${cleanUrl}.`);
  }

  // 4. Deduplication Check (60-minute window)
  const isDup = await isDuplicateLast60Mins(cleanUrl, productId, merchant);
  if (isDup) {
    console.log(`[Verifier] Deal for URL ${cleanUrl} was processed in last 60 minutes. Skipping & ignoring.`);
    return null;
  }

  // 5. Query Existing Product Details in MongoDB ("products" & "verified_links" collections)
  let existingProduct = await Product.findOne({ $or: [{ productId }, { cleanUrl }], "images.0": { $exists: true } });
  let productDetails = await VerifiedLink.findOne({ $or: [{ cleanUrl }, { productId, merchant }], "images.0": { $exists: true } });

  if (!productDetails && existingProduct) {
    productDetails = existingProduct;
  } else if (productDetails && existingProduct) {
    if ((!productDetails.images || productDetails.images.length === 0) && existingProduct.images && existingProduct.images.length > 0) {
      productDetails.images = existingProduct.images;
    }
  }

  // 6. Canonical MRP & Product Cache from MongoDB
  // User Rule: "MRP should only come from my database. If not in DB, use scraped page MRP. Never
  // trust Telegram AI MRP." — extended to the whole deal-price decision below, not just MRP:
  // nothing here trusts what a message claims, only what's been directly observed.
  const existingCanonicalMRP = existingProduct?.originalPrice || productDetails?.originalPrice || null;
  // Our own last tracked price for this exact product, if any — the basis for the price-history
  // qualification path when no MRP exists anywhere (see the discount calculation further down).
  const previousTrackedPrice = existingProduct?.price ?? null;

  // 7. MANDATORY Live Scrape for incoming Telegram deals
  // We ALWAYS scrape the live merchant URL to verify the current selling price and genuine MRP.
  console.log(`[Verifier] 🔍 Mandatory Live Scrape: Fetching live merchant page for ${cleanUrl}...`);
  const scrapedData = await scrapeProductDetails(cleanUrl);

  const liveScrapedPrice = scrapedData.price != null ? scrapedData.price : null;
  const liveScrapedMRP = scrapedData.originalPrice != null ? scrapedData.originalPrice : null;

  const canonicalMRP = existingCanonicalMRP || liveScrapedMRP || null;

  // Live Deal Verification: purely "did we get a real live price". There is no message-claimed
  // price to cross-check against any more — whether it's actually a genuine drop is decided
  // entirely by the MRP/price-history comparison below, which needs nothing but this number.
  let isPriceVerified = false;
  let verifiedDealPrice = null;

  if (liveScrapedPrice == null) {
    console.warn(`[Verifier Warning] ⚠️ Failed to extract live price from ${cleanUrl} during scrape. Cannot verify deal.`);
  } else {
    isPriceVerified = true;
    verifiedDealPrice = liveScrapedPrice;
    console.log(`[Verifier] ✓ Live price for ${cleanUrl}: ₹${liveScrapedPrice}.`);
  }

  // 8. Category/Subcategory — channel default first, then the scraped category hint (Amazon
  // breadcrumb / Flipkart JSON-LD category) matched against Master labels or CATEGORY_KEYWORDS,
  // 'general' last. No message-text parsing involved (see deriveCategory()'s docblock for why).
  const { category, subcategory } = await deriveCategory(channelCategory, scrapedData.categoryHint, scrapedData.title);
  console.log(`[Verifier] Category: "${category}"${subcategory ? ` / "${subcategory}"` : ''} (channel="${channelCategory}"${scrapedData.categoryHint ? `, hint="${scrapedData.categoryHint.slice(0, 60)}"` : ''}).`);

  // Handle Images
  let dealFallbackImageUrl = null;
  let scrapeSucceededThisRun = false;

  if (scrapedData.images && scrapedData.images.length > 0) {
    scrapeSucceededThisRun = true;
    if (!productDetails) {
      productDetails = new VerifiedLink({
        originalUrl: primaryUrl,
        cleanUrl,
        productId,
        merchant,
        title: scrapedData.title || null,
        images: scrapedData.images,
        rating: scrapedData.rating,
        reviews: scrapedData.reviews,
        price: liveScrapedPrice,
        originalPrice: canonicalMRP,
        lastChecked: new Date()
      });
    } else {
      productDetails.images = scrapedData.images;
      if (scrapedData.title) productDetails.title = scrapedData.title;
      if (scrapedData.rating) productDetails.rating = scrapedData.rating;
      if (scrapedData.reviews && scrapedData.reviews.length > 0) productDetails.reviews = scrapedData.reviews;
      if (liveScrapedPrice != null) productDetails.price = liveScrapedPrice;
      if (canonicalMRP != null) productDetails.originalPrice = canonicalMRP;
      productDetails.lastChecked = new Date();
    }
    await productDetails.save();
    console.log(`[Verifier] Scraped details saved/updated in verified_links cache for ${cleanUrl}.`);
  } else {
    if (productDetails && productDetails.images && productDetails.images.length > 0) {
      console.log(`[Verifier] Scrape did not return images, using existing DB cached images for ${cleanUrl}.`);
    } else {
      dealFallbackImageUrl = getTelegramPhotoUrl ? await getTelegramPhotoUrl().catch(() => null) : null;
    }
  }

  // Calculate Authentic Discount — price-history drop first, MRP only as a cold-start fallback.
  //
  // A page's "MRP" is routinely set by the seller purely to inflate the shown discount — it was
  // often never a real selling price. A genuine drop against a price WE ourselves already
  // observed for this exact product doesn't have that problem, so it's preferred outright
  // whenever we have one: if we've tracked this product before and its price didn't genuinely
  // fall, that's the end of it — this is not a deal, even if the page's MRP alone would suggest
  // a large discount. MRP is used only when there's no prior tracked price to compare against at
  // all (a product we're seeing for the first time ever) — worth using rather than rejecting
  // every brand-new product outright, but it's a weaker signal than an observed drop.
  let discountPercentage = null;
  let priceSource = null;
  let genuinePriceDrop = null;
  const PRICE_DROP_MIN_PERCENT = 5;

  if (verifiedDealPrice != null) {
    if (previousTrackedPrice != null) {
      if (previousTrackedPrice > verifiedDealPrice) {
        const historyDiscount = calculateDiscount(previousTrackedPrice, verifiedDealPrice);
        if (historyDiscount >= PRICE_DROP_MIN_PERCENT) {
          discountPercentage = historyDiscount;
          genuinePriceDrop = previousTrackedPrice;
          priceSource = 'price_history';
          console.log(`[Verifier] Price-history drop for ${cleanUrl}: ₹${previousTrackedPrice} -> ₹${verifiedDealPrice} (${historyDiscount}%).`);
        }
      }
    } else if (canonicalMRP != null && canonicalMRP > verifiedDealPrice) {
      discountPercentage = calculateDiscount(canonicalMRP, verifiedDealPrice);
      priceSource = 'scraped';
      console.log(`[Verifier] Cold start (no price history) — discount against MRP: ₹${canonicalMRP} -> ₹${verifiedDealPrice} (${discountPercentage}% OFF).`);
    }
  }

  // Update/Upsert Product Record in MongoDB "products" Collection & Track Price Updates
  const productImages = (productDetails?.images && productDetails.images.length > 0)
    ? productDetails.images
    : (scrapedData.images || []);
  const mainImageUrl = productImages[0] || '';
  const dealImages = productImages.length > 0 ? productImages : (dealFallbackImageUrl ? [dealFallbackImageUrl] : []);
  const dealMainImageUrl = dealImages[0] || '';

  const hasImage = dealImages.length > 0;
  const hasPrice = verifiedDealPrice != null;
  const hasDiscount = discountPercentage != null && discountPercentage > 0;
  const isFullyVerified = isPriceVerified && hasImage && hasPrice && hasDiscount;

  if (!isFullyVerified) {
    console.warn(`[Verifier Warning] Incomplete or unverified deal for ${cleanUrl} — priceVerified: ${isPriceVerified}, image: ${hasImage}, price: ${hasPrice} (₹${verifiedDealPrice || 'N/A'}), discount: ${hasDiscount} (${discountPercentage || 0}%). Recording Product entry (needsEnrichment) and skipping Deal creation.`);
  }

  const productRating = productDetails?.rating || scrapedData?.rating || 0;
  const productReviews = productDetails?.reviews || scrapedData?.reviews || [];
  const now = new Date();
  // Scraped title always wins when available (an actual scrape essentially always returns one,
  // even for out-of-stock listings) — this generic fallback only fires when the scrape itself
  // failed outright and nothing was ever cached for this product either.
  const actualTitle = productDetails?.title || scrapedData?.title || `${merchant} Deal (${productId})`;
  // No AI-generated summary any more — a plain templated line covers what the field is for
  // (a one-line blurb under the deal card) without depending on a text-parsing call.
  const dealDescription = `${actualTitle} available on ${merchant} at a discounted price.`;
  // A real coupon scraped directly off the merchant page — see parseAmazonCoupon()'s docblock
  // for what this replaces (Telegram-text coupon parsing) and its one open caveat (unconfirmed
  // exact wording for an active coupon, since none of the products sampled this session had one).
  const dealCoupon = merchant === 'amazon' ? parseAmazonCoupon(scrapedData.couponRawText) : null;
  if (dealCoupon) {
    console.log(`[Verifier] Amazon coupon detected for ${cleanUrl}: ${dealCoupon.label} (raw: "${(scrapedData.couponRawText || '').slice(0, 100)}")`);
  }

  try {
    let productRecord = await Product.findOne({ $or: [{ productId }, { cleanUrl }] });
    const effectivePrice = verifiedDealPrice || liveScrapedPrice || productRecord?.price || null;

    if (!productRecord) {
      productRecord = new Product({
        productId,
        cleanUrl,
        merchant,
        title: actualTitle,
        images: productImages,
        imageUrl: mainImageUrl,
        rating: productRating,
        reviews: productReviews,
        price: effectivePrice,
        previousPrice: genuinePriceDrop,
        priceSource,
        originalPrice: canonicalMRP,
        priceUpdatedAt: now,
        priceHistory: effectivePrice ? [{
          price: effectivePrice,
          originalPrice: canonicalMRP,
          timestamp: now
        }] : [],
        category,
        subcategory,
        merchant: merchant,
        country: country,
        sourceChannelName: sourceChannelName,
        needsEnrichment: !isFullyVerified,
        lastChecked: now
      });
      console.log(`[Product DB] ✓ Created product "${actualTitle}"${effectivePrice ? ` with price ₹${effectivePrice}` : ''} in "products" collection.`);
    } else {
      productRecord.cleanUrl = cleanUrl;
      productRecord.merchant = merchant;
      if (actualTitle) productRecord.title = actualTitle;
      if (productImages.length > 0) {
        productRecord.images = productImages;
        productRecord.imageUrl = mainImageUrl;
      }
      if (productRating) productRecord.rating = productRating;
      if (productReviews.length > 0) productRecord.reviews = productReviews;
      if (sourceChannelName) productRecord.sourceChannelName = sourceChannelName;
      if (country) productRecord.country = country;

      // Price Tracking & Update Logging
      if (effectivePrice != null && effectivePrice !== productRecord.price) {
        const oldPriceStr = productRecord.price != null ? `₹${productRecord.price}` : 'None';
        const newPriceStr = `₹${effectivePrice}`;
        console.log(`[Price Tracker] 📈 Price update for "${productRecord.title || actualTitle}": ${oldPriceStr} ➔ ${newPriceStr} at ${now.toLocaleTimeString()}`);

        if (genuinePriceDrop != null) {
          productRecord.previousPrice = genuinePriceDrop;
        }
        productRecord.price = effectivePrice;
        productRecord.priceUpdatedAt = now;
        if (!productRecord.priceHistory) productRecord.priceHistory = [];
        productRecord.priceHistory.push({
          price: effectivePrice,
          originalPrice: canonicalMRP || productRecord.originalPrice,
          timestamp: now
        });
      } else {
        if (!productRecord.priceUpdatedAt) productRecord.priceUpdatedAt = now;
      }

      if (priceSource) productRecord.priceSource = priceSource;
      if (canonicalMRP) productRecord.originalPrice = canonicalMRP;
      if (category) {
        productRecord.category = category;
        productRecord.subcategory = subcategory;
      }
      if (isFullyVerified) productRecord.needsEnrichment = false;
      productRecord.lastChecked = now;
      productRecord.updatedAt = now;
    }
    await productRecord.save();
    console.log(`[Product DB] ✓ Saved/updated product "${actualTitle}" in "products" collection.`);
  } catch (prodErr) {
    console.error('[Product DB Error] Failed to save product record:', prodErr.message);
  }

  // If not fully verified, do not publish/create deal
  if (!isFullyVerified) {
    return null;
  }

  // Cross-listing duplicate guard: some sellers relist the identical product under multiple
  // ASINs at the identical price — confirmed live (two different Amazon ASINs, same title,
  // same ₹287 price, same 84% discount, 6 minutes apart, both posted to the same channel). A
  // subscriber sees that as the same deal posted twice regardless of which listing backs it,
  // so title+price+merchant is the dedup key here — dealUrl/productId are already handled by
  // the findOne() just below, which is exactly why this couldn't catch it: they're genuinely
  // different products by that identity, just not by the identity that actually matters to
  // someone reading the channel.
  const crossListingDuplicate = await Deal.findOne({
    title: actualTitle,
    dealPrice: verifiedDealPrice,
    merchant,
    isExpired: { $ne: true },
    productId: { $ne: productId },
  });
  if (crossListingDuplicate) {
    console.log(`[Verifier] Skipping ${productId} — "${actualTitle}" at ₹${verifiedDealPrice} is already an active deal under a different listing (${crossListingDuplicate.productId}). Treating as a duplicate relisting.`);
    return null;
  }

  // 10. Database Save (Deals Collection)
  try {
    let deal = await Deal.findOne({ $or: [{ dealUrl: cleanUrl }, { productId, merchant }] });

    if (deal) {
      const isSameSource = deal.sourceChannelId === sourceChannelId && deal.sourceMessageId === sourceMessageId;
      if (!isSameSource) {
        const collision = await Deal.findOne({ sourceChannelId, sourceMessageId });
        if (!collision) {
          deal.sourceChannelId = sourceChannelId;
          deal.sourceMessageId = sourceMessageId;
        }
      }
      deal.country = country;
      deal.sourceChannelName = sourceChannelName;
      deal.originalText = messageText;
      deal.title = actualTitle;
      deal.dealUrl = cleanUrl;
      deal.productId = productId;
      deal.merchant = merchant;
      deal.description = dealDescription;
      deal.imageUrl = dealMainImageUrl;
      deal.images = dealImages;
      deal.rating = productRating;
      deal.reviews = productReviews;
      deal.originalPrice = canonicalMRP;
      deal.dealPrice = verifiedDealPrice;
      deal.discountPercentage = discountPercentage;
      deal.coupon = dealCoupon;
      deal.priceSource = priceSource;
      if (genuinePriceDrop != null) deal.previousPrice = genuinePriceDrop;
      deal.category = category;
      deal.subcategory = subcategory;
      deal.isVerified = true;
      deal.createdAt = now;
      deal.updatedAt = now;

      await deal.save();
      console.log(`[Verifier] Successfully updated and bumped existing deal: "${actualTitle}" (Price: ₹${verifiedDealPrice}, MRP: ₹${canonicalMRP || 'N/A'})`);
      return deal;
    } else {
      deal = new Deal({
        sourceChannelId,
        sourceMessageId: sourceMessageId,
        country: country,
        sourceChannelName: sourceChannelName,
        originalText: messageText,
        title: actualTitle,
        description: dealDescription,
        imageUrl: dealMainImageUrl,
        images: dealImages,
        rating: productRating,
        reviews: productReviews,
        dealUrl: cleanUrl,
        productId,
        merchant,
        originalPrice: canonicalMRP,
        dealPrice: verifiedDealPrice,
        previousPrice: genuinePriceDrop,
        discountPercentage: discountPercentage,
        coupon: dealCoupon,
        priceSource,
        category,
        subcategory,
        isVerified: true,
        publishedStatus: {
          mobileApp: false,
          webApp: false,
          telegram: false,
          whatsapp: false
        },
        createdAt: now,
        updatedAt: now
      });
      await deal.save();
      console.log(`[Verifier] Successfully saved new deal: "${actualTitle}" (Price: ₹${verifiedDealPrice}, MRP: ₹${canonicalMRP || 'N/A'})`);
      return deal;
    }
  } catch (dealSaveErr) {
    if (dealSaveErr.code === 11000) {
      console.warn(`[Verifier Warning] Duplicate key collision (E11000) while saving deal for ${cleanUrl}. Fetching existing deal instead.`);
      const existing = await Deal.findOne({ $or: [{ dealUrl: cleanUrl }, { productId, merchant }, { sourceChannelId, sourceMessageId }] });
      return existing;
    }
    console.error(`[Verifier Error] Failed to save/update deal for ${cleanUrl}:`, dealSaveErr.message);
    return null;
  }
}
