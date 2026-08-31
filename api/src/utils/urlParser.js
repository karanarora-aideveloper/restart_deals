/**
 * URL parsing, shortlink unwrap, and canonical merchant & productId extractor.
 */

const SUPPORTED_MERCHANT_DOMAINS = [
  'amazon.', 'flipkart.com', 'amzn.to', 'fkrt.it', 'myntra.com', 'nykaa.com', 'ajio.com', 'shopsy.in', 'meesho.com'
];

export function isSupportedMerchantUrl(url) {
  if (!url) return false;
  return SUPPORTED_MERCHANT_DOMAINS.some((domain) => url.includes(domain));
}

export function unwrapEmbeddedUrl(url) {
  if (!url) return url;
  try {
    const urlObj = new URL(url);
    for (const [, value] of urlObj.searchParams.entries()) {
      const decoded = decodeURIComponent(value);
      const embeddedMatch = decoded.match(/https?:\/\/[^\s"'<>]+/i);
      if (embeddedMatch && isSupportedMerchantUrl(embeddedMatch[0])) {
        return embeddedMatch[0];
      }
    }
    const decodedRaw = decodeURIComponent(url);
    const rawMatch = decodedRaw.match(/https?:\/\/(?:www\.)?(?:amazon\.[a-z.]+|flipkart\.com|amzn\.to|fkrt\.it|myntra\.com|nykaa\.com|ajio\.com|shopsy\.in)\/[^\s"'<>]+/i);
    if (rawMatch && !isSupportedMerchantUrl(urlObj.hostname)) {
      return rawMatch[0];
    }
  } catch (e) {}
  return url;
}

export async function resolveRedirect(url, depth = 0) {
  if (depth > 5 || !url) return url;

  let currentUrl = unwrapEmbeddedUrl(url);

  // If already a clean product link, skip network requests
  if (
    currentUrl.includes('/dp/') ||
    currentUrl.includes('/gp/product/') ||
    (currentUrl.includes('flipkart.com') && (currentUrl.includes('?pid=') || currentUrl.includes('&pid='))) ||
    (currentUrl.includes('myntra.com') && currentUrl.includes('/buy')) ||
    (currentUrl.includes('nykaa.com') && currentUrl.includes('/p/')) ||
    (currentUrl.includes('ajio.com') && currentUrl.includes('/p/'))
  ) {
    return currentUrl;
  }

  const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  };

  try {
    const response = await fetch(currentUrl, {
      method: 'HEAD',
      redirect: 'manual',
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(5000),
    });

    const location = response.headers.get('location');
    if (location && [301, 302, 303, 307, 308].includes(response.status)) {
      const nextUrl = new URL(location, currentUrl).toString();
      return resolveRedirect(nextUrl, depth + 1);
    }
  } catch (e) {}

  return currentUrl;
}

export function parseProductUrl(url) {
  if (!url) return null;
  try {
    const unwrapped = unwrapEmbeddedUrl(url);
    const urlObj = new URL(unwrapped);
    const hostname = urlObj.hostname.toLowerCase();

    let merchant = 'other';
    let productId = null;
    let cleanUrl = unwrapped;

    if (hostname.includes('amazon.')) {
      merchant = 'amazon';
      const dpMatch = urlObj.pathname.match(/\/dp\/([A-Z0-9]{10})/i);
      const gpMatch = urlObj.pathname.match(/\/gp\/product\/([A-Z0-9]{10})/i);
      const asin = dpMatch ? dpMatch[1] : (gpMatch ? gpMatch[1] : null);
      if (asin) {
        productId = asin.toUpperCase();
        cleanUrl = `https://${urlObj.hostname}/dp/${productId}`;
      }
    } else if (hostname.includes('flipkart.com')) {
      merchant = 'flipkart';
      const pidMatch = urlObj.searchParams.get('pid');
      const pathMatch = urlObj.pathname.match(/\/p\/([a-z0-9]{16})/i);
      if (pidMatch) {
        productId = pidMatch;
      } else if (pathMatch) {
        productId = pathMatch[1];
      }
      if (productId) {
        cleanUrl = `https://www.flipkart.com/product/p/item?pid=${productId}`;
      }
    } else if (hostname.includes('myntra.com')) {
      merchant = 'myntra';
      const idMatch = urlObj.pathname.match(/\/(\d+)\/buy\/?$/i) || urlObj.pathname.match(/\/(\d+)(?:[/?#]|$)/);
      if (idMatch) {
        productId = idMatch[1];
        cleanUrl = `https://www.myntra.com${urlObj.pathname.replace(/\/$/, '')}`;
      }
    } else if (hostname.includes('nykaa.com')) {
      merchant = 'nykaa';
      const pidMatch = urlObj.pathname.match(/\/p\/(\d+)/i);
      if (pidMatch) {
        productId = pidMatch[1];
        cleanUrl = `https://www.nykaa.com${urlObj.pathname.replace(/\/$/, '')}`;
      }
    } else if (hostname.includes('ajio.com')) {
      merchant = 'ajio';
      const idMatch = urlObj.pathname.match(/\/p\/([a-z0-9]+(?:_[a-z0-9]+)?)/i);
      if (idMatch) {
        productId = idMatch[1];
        cleanUrl = `https://www.ajio.com${urlObj.pathname.replace(/\/$/, '')}`;
      }
    } else if (hostname.includes('meesho.com')) {
      merchant = 'meesho';
      const idMatch = urlObj.pathname.match(/\/p\/([a-z0-9]+)/i);
      if (idMatch) {
        productId = idMatch[1];
        cleanUrl = `https://www.meesho.com${urlObj.pathname.replace(/\/$/, '')}`;
      }
    }

    return {
      merchant,
      productId,
      cleanUrl,
      isProductUrl: !!productId,
    };
  } catch (e) {
    return null;
  }
}
