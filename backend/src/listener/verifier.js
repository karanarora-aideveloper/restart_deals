import * as cheerio from 'cheerio';
import { OpenAI } from 'openai';
import config from '../config.js';
import Deal from '../db/models/deal.js';
import VerifiedLink from '../db/models/verifiedLink.js';
import ScrapingAntToken from '../db/models/scrapingAntToken.js';
import Product from '../db/models/product.js';
import Master from '../db/models/master.js';
import { scraperQueue, PRIORITY } from '../services/scraperQueue.js';

// Initialize OpenAI client for DeepSeek (OpenAI compatible API)
const openai = new OpenAI({
  apiKey: config.deepseek.apiKey || 'placeholder',
  baseURL: 'https://api.deepseek.com/v1',
});

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
 * Parse an Indian-format price string ("₹1,299.00", "1,299.") into a number.
 * Returns null for anything that isn't a sane product price.
 */
function parsePriceText(raw) {
  if (!raw) return null;
  const cleaned = String(raw).replace(/[^\d.]/g, '').replace(/\.$/, '');
  if (!cleaned) return null;
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed) || parsed <= 0 || parsed > 10000000) return null;
  return Math.round(parsed);
}

/**
 * First parseable price among ALL matches of the given selectors, in order.
 *
 * Deliberately not `.first()`: Amazon renders price containers whose first matching
 * node has empty text (the visible value lives in a later sibling), so `.first()`
 * yields "" and the old code fell through to the next *selector* instead of the next
 * *element* — reporting no price on pages that plainly had one.
 */
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

/**
 * Price/MRP from schema.org JSON-LD.
 *
 * Preferred over CSS wherever it exists: Flipkart ships hashed class names that rotate
 * (._30jeq3 -> v1zwn21m -> ...), so every hardcoded selector eventually dies, while its
 * JSON-LD Product.offers block has stayed put.
 */
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
          originalPrice: parsePriceText(offer.highPrice) ,
          inStock: typeof offer.availability === 'string'
            ? /InStock/i.test(offer.availability)
            : null,
        };
        return false;
      }
    }
  });
  return result;
}

/**
 * Fetch and extract product details using Distributed BullMQ Scraping Queue
 * @param {string} targetUrl 
 * @returns {Promise<{ images: string[], rating: number, reviews: Array }>}
 */
export async function scrapeProductDetails(targetUrl) {
  try {
    const html = await scraperQueue.enqueue(targetUrl, { priority: PRIORITY.TELEGRAM });
    if (!html) {
      return { title: null, images: [], rating: null, reviews: [], price: null, originalPrice: null };
    }

    // Parse HTML with cheerio
    const $ = cheerio.load(html);
    const images = [];
    const reviews = [];
    let title = null;
    let rating = null;
    let price = null;
    let originalPrice = null;

    const hostname = new URL(targetUrl).hostname.toLowerCase();

    if (hostname.includes('amazon.')) {
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

      // Amazon Price Extraction
      //
      // Scoped to the main product column first. The page carries ~44 `.a-price` nodes —
      // sponsored carousels, "bought together", similar items — so an unscoped `.first()`
      // can silently report a neighbouring product's price as this deal's price.
      const amazonPriceSelectors = [
        '.apexPriceToPay .a-offscreen',
        '.priceToPay .a-offscreen',
        '#priceblock_dealprice',
        '#priceblock_ourprice',
        '.a-price .a-offscreen',
        '.a-price-whole',
      ];
      const amazonRoots = ['#corePrice_feature_div', '#corePriceDisplay_desktop_feature_div', '#ppd', '#centerCol'];
      for (const rootSel of amazonRoots) {
        const root = $(rootSel);
        if (!root.length) continue;
        price = findPrice($, amazonPriceSelectors, root);
        if (price !== null) break;
      }
      // Last resort: whole document, accepting the sponsored-price risk over no price at all.
      if (price === null) price = findPrice($, amazonPriceSelectors);

      const amazonListSelectors = [
        '.basisPrice .a-offscreen',
        'span.a-text-strike',
        '#listPrice',
        '#priceblock_listprice',
      ];
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

      // Flipkart Price Extraction
      //
      // JSON-LD first, and by a wide margin: Flipkart's class names are hashed and rotate
      // (._30jeq3 and ._3I9_R3 below are long dead — they matched nothing on live markup),
      // whereas its schema.org Product.offers block has remained stable. The class
      // selectors are kept only as a fallback in case a layout ships without JSON-LD.
      const fkLd = extractJsonLdPrice($);
      if (fkLd.price !== null) {
        price = fkLd.price;
        if (fkLd.originalPrice !== null) originalPrice = fkLd.originalPrice;
      } else {
        price = findPrice($, ['._30jeq3', 'div[class*="_30jeq3"]', '.Nx9bqj', '._16Jk6d']);
      }
      const listPriceText = originalPrice !== null ? '' : $('._3I9_R3, div[class*="_3I9_R3"], .yRaY8j, ._3auQ3N').first().text().trim();
      if (listPriceText) {
        const cleanPrice = listPriceText.replace(/[^\d.]/g, '');
        const parsed = parseFloat(cleanPrice);
        if (!isNaN(parsed)) originalPrice = Math.round(parsed);
      }

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

    return { title, images, rating, reviews, price, originalPrice };
  } catch (err) {
    console.error(`[Scraper Error] Scraping failed for ${targetUrl}:`, err.message);
    // Return empty fallback instead of crashing the pipeline
    return { title: null, images: [], rating: null, reviews: [], price: null, originalPrice: null };
  }
}

/**
 * Call DeepSeek AI to parse original text and product details into a structured deal schema
 * @param {string} originalText 
 * @param {object} productDetails 
 * @returns {Promise<object>}
 */
export async function extractDealWithDeepSeek(originalText, productDetails) {
  if (!config.deepseek.apiKey) {
    console.warn('[DeepSeek Warning] DEEPSEEK_API_KEY is not defined. Using regex fallbacks.');
    return fallbackParseDeal(originalText, productDetails);
  }

  let categoryString = '"fitness", "general"'; // Fallback
  let validCategories = ['fitness', 'general'];
  try {
    const categories = await Master.find({ type: 'category', isActive: true });
    if (categories.length > 0) {
      categoryString = categories.map(c => `"${c.value}"`).join(', ');
      validCategories = categories.map(c => c.value);
    }
  } catch (err) {
    console.error('[Verifier] Failed to fetch master categories:', err.message);
  }

  // subcategoryLabelsByCategory: { electronics: ['Mobiles & Tablets', ...], ... } — labels, for
  // the prompt (a bare id like "kitchen" is a much weaker signal than "Kitchen & Dining", e.g. a
  // cast-iron Dutch oven doesn't obviously read as "kitchen" without that fuller framing).
  // subcategoryLabelToValue maps a returned label back to its stored value, keyed
  // "category::label" since the same label text could theoretically recur under a different
  // category.
  let subcategoryLabelsByCategory = {};
  const subcategoryLabelToValue = new Map();
  try {
    const subcats = await Master.find({ type: 'subcategory', isActive: true });
    for (const s of subcats) {
      const parent = s.metadata?.parentCategory;
      if (!parent) continue;
      if (!subcategoryLabelsByCategory[parent]) subcategoryLabelsByCategory[parent] = [];
      subcategoryLabelsByCategory[parent].push(s.label);
      subcategoryLabelToValue.set(`${parent}::${s.label}`, s.value);
    }
  } catch (err) {
    console.error('[Verifier] Failed to fetch master subcategories:', err.message);
  }
  const subcategoryTaxonomyString = JSON.stringify(subcategoryLabelsByCategory);

  const systemMessage = `You are a shopping deal analyzer. Your task is to analyze the original Telegram deal message and any scraped product webpage details.
Respond ONLY with a valid JSON object matching this schema. Do not write any markdown code blocks, explanations, or text outside the JSON object.

JSON Schema:
{
  "title": "Clean concise product name",
  "description": "Short summary of the deal features",
  "originalPrice": 1299.00,
  "dealPrice": 599.00,
  "discountPercentage": 54,
  "category": "one of the available categories",
  "subcategory": "the label (not an id/slug) of one of the available subcategories for the chosen category, or empty string",
  "coupon": null
}
Ensure all prices are returned as clean numbers. The "previously recorded price" data below is from our own database, NOT a fresh scrape of this listing — it could be days old or wrong. Extract dealPrice/originalPrice from the Telegram message text FIRST; only fall back to the previously recorded price if the message itself states no price at all. If the message's stated price differs from the previously recorded one, trust the message — it's describing what's happening right now. If you cannot extract originalPrice or dealPrice from either source, set them to null.
For category, YOU MUST select the most relevant category strictly from this list: [${categoryString}]. If none fit perfectly, pick the closest match or default to "general".
For subcategory, once you've picked a category, select the single best-fitting subcategory LABEL strictly from that category's own list in this map (keyed by category): ${subcategoryTaxonomyString}. Return the label text exactly as written there (e.g. "Kitchen & Dining"), not a made-up id. Only choose one if it is a clear, confident match for what the product actually is — do not force the closest-sounding option onto a product that doesn't really belong there (e.g. a yoga mat is not "Home Decor" just because its category happens to be "home"; a light bulb is not a "Large Appliance"). If nothing in that category's list is a genuinely good fit, set subcategory to an empty string "" — do NOT invent a new value or borrow one from a different category's list.

COUPON EXTRACTION:
Deal messages often mention an extra coupon the shopper must click/apply on the merchant page for a further saving ON TOP of the deal price. If the message mentions one, set "coupon" to an object; otherwise set "coupon" to null. Schema:
{ "type": "percent" | "flat" | "code", "value": 2, "code": "SAVE20", "label": "Apply 2% coupon" }
- "percent": a percentage-off coupon. Put the number in "value" (e.g. "Apply 2% coupon" -> type "percent", value 2).
- "flat": a fixed currency amount off. Put the amount in "value" (e.g. "Apply ₹50 coupon" -> type "flat", value 50).
- "code": a promo/voucher code the shopper types in. Put the code in "code" (e.g. "Use code SAVE20" -> type "code", code "SAVE20"). If the code also states a percent or amount, ALSO fill type-appropriate "value" and prefer type "percent"/"flat" with "code" set alongside.
- "value" must be null when unknown; "code" must be null when there is no literal code.
- "label" is a short human-readable instruction (max 40 chars) taken from the message, e.g. "Apply 2% coupon" or "Use code SAVE20".
- The same coupon is often repeated twice in a message — return it ONCE.
- Do NOT treat the deal's own discount/MRP as a coupon. Only count an explicit extra coupon/voucher/promo the user has to apply.
- Bank/card offers ("10% off on HDFC cards") are NOT coupons — set coupon to null for those.`;

  const cachedImages = productDetails?.images || [];
  const cachedRating = productDetails?.rating || 'N/A';
  const cachedPrice = productDetails?.price || 'not found';
  const cachedMRP = productDetails?.originalPrice || 'not found';
  const cachedReviews = productDetails?.reviews ? productDetails.reviews.map(r => r.text) : [];

  const userMessage = `Telegram Message:
"${originalText}"

Previously recorded product images (our database, not a fresh scrape): ${JSON.stringify(cachedImages)}
Previously recorded rating: ${cachedRating}
Previously recorded deal price (may be outdated — prefer the message text above): ${cachedPrice}
Previously recorded MRP/original price (may be outdated — prefer the message text above): ${cachedMRP}
Previously recorded reviews sample: ${JSON.stringify(cachedReviews)}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage }
      ],
      response_format: { type: 'json_object' }
    });

    const parsedData = JSON.parse(completion.choices[0].message.content);
    // Trust whatever DeepSeek picked from the list we gave it in the prompt above — validate
    // against that same list rather than silently collapsing everything except "fitness" to
    // "general" (that used to happen here and discarded electronics/fashion/home/beauty/etc.
    // even when the AI correctly returned them).
    const finalCategory = validCategories.includes(parsedData.category) ? parsedData.category : 'general';
    // The AI returns a label ("Kitchen & Dining"); map it back to the stored value ("kitchen").
    // Scoped to the CHOSEN category specifically — a label valid under a different category (or
    // one the AI invented) is discarded rather than trusted blind.
    const finalSubcategory = subcategoryLabelToValue.get(`${finalCategory}::${parsedData.subcategory}`) || '';

    return {
      title: parsedData.title,
      description: parsedData.description,
      originalPrice: parsedData.originalPrice,
      dealPrice: parsedData.dealPrice,
      discountPercentage: parsedData.discountPercentage || calculateDiscount(parsedData.originalPrice, parsedData.dealPrice),
      coupon: normalizeCoupon(parsedData.coupon),
      category: finalCategory,
      subcategory: finalSubcategory
    };
  } catch (err) {
    console.error('[DeepSeek Error] Call failed, using regex fallback:', err.message);
    return fallbackParseDeal(originalText, productDetails);
  }
}

/**
 * Fallback parser using regex if DeepSeek fails or API key is not configured
 */
function fallbackParseDeal(text, productDetails) {
  // Simple regex attempts for prices
  const priceRegex = /(?:rs\.?|₹|inr)\s*([0-9,]+)/gi;
  const matches = [...text.matchAll(priceRegex)].map(m => parseFloat(m[1].replace(/,/g, '')));
  
  let dealPrice = null;
  let originalPrice = null;

  if (matches.length > 0) {
    // Usually the lower price is the deal price, higher is MRP
    if (matches.length > 1) {
      dealPrice = Math.min(...matches);
      originalPrice = Math.max(...matches);
    } else {
      dealPrice = matches[0];
    }
  }

  // Fallback title is first line of text
  const title = text.split('\n')[0]?.substring(0, 80) || 'Verified Online Deal';

  // Simple category classification fallback
  const fitnessKeywords = ['protein', 'whey', 'supplement', 'gym', 'fitness', 'creatine', 'multivitamin', 'workout', 'nutrition', 'dumbbell'];
  const lowercaseText = text.toLowerCase();
  const category = fitnessKeywords.some(keyword => lowercaseText.includes(keyword)) ? 'fitness' : 'general';

  return {
    title,
    description: text.substring(0, 300),
    originalPrice,
    dealPrice,
    discountPercentage: calculateDiscount(originalPrice, dealPrice),
    coupon: fallbackParseCoupon(text),
    category,
    // This regex fallback only fires when DeepSeek is unavailable — not worth building a second
    // keyword classifier for subcategory here too; it'll pick one up on the next successful pass.
    subcategory: ''
  };
}

/**
 * Regex coupon extraction, used only when DeepSeek is unavailable/failed. Deliberately
 * conservative — it only matches phrasings that explicitly say "coupon"/"code", so it won't
 * mistake the deal's own "54% off" headline for an extra coupon.
 */
function fallbackParseCoupon(text) {
  if (!text) return null;

  // "Apply 2% coupon" / "2% coupon" / "coupon 2%" / "extra 5% coupon"
  const percentMatch = text.match(/(?:coupon\s*(?:of\s*)?(\d{1,2}(?:\.\d+)?)\s*%)|(?:(\d{1,2}(?:\.\d+)?)\s*%\s*(?:off\s*)?coupon)/i);
  if (percentMatch) {
    const value = parseFloat(percentMatch[1] || percentMatch[2]);
    return normalizeCoupon({ type: 'percent', value, label: `Apply ${value}% coupon` });
  }

  // "Apply ₹50 coupon" / "coupon of Rs 50" / "₹50 off coupon"
  const flatMatch = text.match(/(?:coupon\s*(?:of\s*)?(?:₹|rs\.?\s*)(\d[\d,]*))|(?:(?:₹|rs\.?\s*)(\d[\d,]*)\s*(?:off\s*)?coupon)/i);
  if (flatMatch) {
    const value = parseFloat((flatMatch[1] || flatMatch[2]).replace(/,/g, ''));
    return normalizeCoupon({ type: 'flat', value, label: `Apply ₹${value} coupon` });
  }

  // "Use code SAVE20" / "coupon code: SAVE20" / "promo code ABC123"
  const codeMatch = text.match(/(?:coupon\s*code|promo\s*code|use\s*code|code)\s*[:\-]?\s*([A-Z0-9][A-Z0-9_-]{2,19})\b/i);
  if (codeMatch) {
    return normalizeCoupon({ type: 'code', code: codeMatch[1], label: `Use code ${codeMatch[1].toUpperCase()}` });
  }

  return null;
}

export function calculateDiscount(original, deal) {
  if (!original || !deal || original <= deal) return 0;
  return Math.round(((original - deal) / original) * 100);
}

/**
 * Validate + clean the AI's `coupon` output before it's persisted or shown to a user.
 * The AI is free-form enough to return a half-filled object (a type with no value, a "percent"
 * of 250, an empty-string code), and this ends up rendered in the app as an instruction the user
 * acts on — so anything that isn't actually actionable is dropped rather than displayed.
 *
 * @param {any} raw
 * @returns {{type: string, value: number|null, code: string|null, label: string}|null}
 */
export function normalizeCoupon(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const type = ['percent', 'flat', 'code'].includes(raw.type) ? raw.type : null;
  if (!type) return null;

  let value = typeof raw.value === 'number' && isFinite(raw.value) && raw.value > 0 ? raw.value : null;
  // A "percent" coupon over 100 is a misparse (usually the deal's own discount or a price), and a
  // percent of 0 is meaningless — drop the value rather than showing "Apply 250% coupon".
  if (type === 'percent' && value != null && value > 100) value = null;

  const code = typeof raw.code === 'string' && raw.code.trim() ? raw.code.trim().toUpperCase() : null;

  // Nothing actionable: no amount to expect and no code to enter.
  if (value == null && !code) return null;

  let label = typeof raw.label === 'string' ? raw.label.trim().slice(0, 40) : '';
  if (!label) {
    if (type === 'percent' && value != null) label = `Apply ${value}% coupon`;
    else if (type === 'flat' && value != null) label = `Apply ₹${value} coupon`;
    else label = `Use code ${code}`;
  }

  return { type, value, code, label };
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
 * @returns {Promise<object|null>}
 */
export async function verifyAndProcessMessage(sourceChannelId, sourceMessageId, messageText, channelCountry = 'IN', sourceChannelName = 'Unknown', getTelegramPhotoUrl = null) {
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

  // 6. AI Parsing First (DeepSeek AI) to detect price, title & category from Telegram message text
  console.log(`[Verifier] Running AI parsing on message text to check for price & deal details...`);
  const parsedDeal = await extractDealWithDeepSeek(messageText, productDetails);
  console.log(`[Verifier] AI Parsed Result -> Title: "${parsedDeal.title}" | Price: Rs. ${parsedDeal.dealPrice || 'N/A'} | Category: ${parsedDeal.category}`);

  // 7. Canonical MRP & Product Cache from MongoDB
  const existingCanonicalMRP = existingProduct?.originalPrice || productDetails?.originalPrice || null;
  const aiClaimedPrice = parsedDeal.dealPrice != null ? parsedDeal.dealPrice : null;

  // 8. MANDATORY Live Scrape for incoming Telegram deals
  // We ALWAYS scrape the live merchant URL to verify the current selling price and genuine MRP.
  console.log(`[Verifier] 🔍 Mandatory Live Scrape: Fetching live merchant page for ${cleanUrl}...`);
  const scrapedData = await scrapeProductDetails(cleanUrl);

  const liveScrapedPrice = scrapedData.price != null ? scrapedData.price : null;
  const liveScrapedMRP = scrapedData.originalPrice != null ? scrapedData.originalPrice : null;

  // Canonical MRP Decision:
  // User Rule: "MRP should only come from my database. If not in DB, use scraped page MRP. Never trust Telegram AI MRP."
  const canonicalMRP = existingCanonicalMRP || liveScrapedMRP || null;

  // Live Deal Verification Decision:
  // User Rule: "Compare scraped price and AI price. If live scraped price > AI claimed price, deal is EXPIRED/INVALID."
  let isPriceVerified = false;
  let verifiedDealPrice = null;

  if (liveScrapedPrice == null) {
    console.warn(`[Verifier Warning] ⚠️ Failed to extract live price from ${cleanUrl} during scrape. Cannot verify deal.`);
    isPriceVerified = false;
  } else if (aiClaimedPrice != null && liveScrapedPrice > aiClaimedPrice) {
    console.warn(`[Verifier Warning] ❌ Deal Expired/Invalid: Live merchant price (₹${liveScrapedPrice}) is HIGHER than claimed Telegram deal price (₹${aiClaimedPrice}) for ${cleanUrl}. Skipping deal creation.`);
    isPriceVerified = false;
  } else {
    // liveScrapedPrice <= aiClaimedPrice (or aiClaimedPrice is null)
    isPriceVerified = true;
    verifiedDealPrice = liveScrapedPrice;
    console.log(`[Verifier] ✓ Deal Price Verified: Live price ₹${liveScrapedPrice} matches/beats claimed price (₹${aiClaimedPrice || 'N/A'}) for ${cleanUrl}.`);
  }

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
        title: scrapedData.title || parsedDeal.title || null,
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

  // Calculate Authentic Discount against Canonical MRP or Price History
  let discountPercentage = null;
  let priceSource = null;
  let genuinePriceDrop = null;
  const PRICE_DROP_MIN_PERCENT = 5;

  if (verifiedDealPrice != null) {
    if (canonicalMRP != null && canonicalMRP > verifiedDealPrice) {
      discountPercentage = calculateDiscount(canonicalMRP, verifiedDealPrice);
      priceSource = 'scraped';
      console.log(`[Verifier] Discount against Canonical MRP: ₹${canonicalMRP} -> ₹${verifiedDealPrice} (${discountPercentage}% OFF).`);
    } else {
      // Check price history fallback
      const cachedPrice = existingProduct?.price ?? null;
      if (cachedPrice != null && cachedPrice > verifiedDealPrice) {
        const historyDiscount = calculateDiscount(cachedPrice, verifiedDealPrice);
        if (historyDiscount >= PRICE_DROP_MIN_PERCENT) {
          discountPercentage = historyDiscount;
          genuinePriceDrop = cachedPrice;
          priceSource = 'price_history';
          console.log(`[Verifier] Price-history drop for ${cleanUrl}: ₹${cachedPrice} -> ₹${verifiedDealPrice} (${historyDiscount}%).`);
        }
      }
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
  const actualTitle = productDetails?.title || scrapedData?.title || parsedDeal.title;

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
        category: parsedDeal.category,
        subcategory: parsedDeal.subcategory || '',
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
      if (parsedDeal.category) {
        productRecord.category = parsedDeal.category;
        productRecord.subcategory = parsedDeal.subcategory || '';
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
      deal.description = parsedDeal.description;
      deal.imageUrl = dealMainImageUrl;
      deal.images = dealImages;
      deal.rating = productRating;
      deal.reviews = productReviews;
      deal.originalPrice = canonicalMRP;
      deal.dealPrice = verifiedDealPrice;
      deal.discountPercentage = discountPercentage;
      deal.coupon = parsedDeal.coupon || null;
      deal.priceSource = priceSource;
      if (genuinePriceDrop != null) deal.previousPrice = genuinePriceDrop;
      deal.category = parsedDeal.category;
      deal.subcategory = parsedDeal.subcategory || '';
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
        description: parsedDeal.description,
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
        coupon: parsedDeal.coupon || null,
        priceSource,
        category: parsedDeal.category,
        subcategory: parsedDeal.subcategory || '',
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
