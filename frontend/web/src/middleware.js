import { NextResponse } from 'next/server';

// Routes and asset prefixes that should bypass the URL-prefix interceptor
const KNOWN_ROUTES = new Set([
  '',
  'v2',
  'v3',
  'compare',
  'credit-cards',
  'products',
  'product',
  'deal',
  'deals',
  'saved',
  'wishlist',
  'profile',
  'support',
  'coupons',
  'hot',
  'download',
  'privacy',
  'delete-account',
  'affiliate-disclosure',
  'sitemap',
  'sitemaps',
  'blog',
  'best',
  'categories',
  'r',
  'api',
  'scan',
  'robots.txt',
  'sitemap.xml',
]);

const STORE_DOMAINS = [
  'amazon.',
  'flipkart.com',
  'myntra.com',
  'nykaa.com',
  'ajio.com',
  'meesho.com',
  'croma.com',
  'tatacliq.com',
  'shopsy.in',
  'shopsy.com',
  'jiomart.com',
  'blinkit.com',
  'zeptonow.com',
  'swiggy.com',
];

export function middleware(request) {
  const { pathname, search } = request.nextUrl;

  // Clean leading slashes
  const cleanPath = pathname.replace(/^\/+/, '');
  if (!cleanPath) return NextResponse.next();

  const firstSegment = cleanPath.split('/')[0].toLowerCase();

  // If first segment matches a known Next.js page or asset, let Next.js handle it
  if (KNOWN_ROUTES.has(firstSegment)) {
    return NextResponse.next();
  }

  let targetUrl = null;

  // Case 1: Path starts with http:/ or https:/ (e.g. /https:/www.amazon.in/dp/...)
  if (/^https?:\/?\/?/i.test(cleanPath)) {
    const raw = cleanPath.replace(/^https?:\/?\/?/i, '');
    const protocol = cleanPath.toLowerCase().startsWith('http:') ? 'http://' : 'https://';
    targetUrl = protocol + raw + (search || '');
  } else {
    // Case 2: Direct store domain in path (e.g. /amazon.in/dp/... or /www.meesho.com/s/p/...)
    const lower = cleanPath.toLowerCase();
    const isStore = STORE_DOMAINS.some(
      (domain) => lower.startsWith(domain) || lower.startsWith('www.' + domain)
    );

    if (isStore) {
      targetUrl = 'https://' + cleanPath + (search || '');
    }
  }

  if (targetUrl) {
    // Redirect to /scan?url=...
    const scanUrl = new URL('/scan', request.url);
    scanUrl.searchParams.set('url', targetUrl);
    return NextResponse.redirect(scanUrl, 307);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files & images
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|categories|carousel|images|stores|sw.js).*)',
  ],
};
