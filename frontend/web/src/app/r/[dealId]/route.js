import { NextResponse } from 'next/server';
import { getAffiliateUrl } from '@/lib/affiliate';
import { directFetchDealById, directFetchProductById, directFindAlternativeInStockStore } from '@/lib/dbFallback';
import {
  PZN_COOKIE_NAME,
  PZN_COOKIE_MAX_AGE,
  parsePersonalizationCookie,
  recordInteraction,
  serializePersonalizationCookie,
} from '@/lib/personalization';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://api.shoppersdeals.in').replace(/\/+$/, '');
const CUELINKS_PUB_ID = process.env.NEXT_PUBLIC_CUELINKS_PUB_ID || '325472';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Universal Outbound Link Cloaker & Redirector
 * GET /r/:dealId?src=tg|web|alert|social
 */
export async function GET(request, { params }) {
  const { dealId } = await params;
  const { searchParams } = new URL(request.url);
  const src = searchParams.get('src') || searchParams.get('source') || 'web';

  // 1. Direct URL pass-through if query contains 'url'
  const directUrl = searchParams.get('url');
  if (directUrl) {
    try {
      const decoded = decodeURIComponent(directUrl);
      const affUrl = getAffiliateUrl(decoded);
      return NextResponse.redirect(affUrl, 302);
    } catch (e) {
      return NextResponse.redirect('https://www.shoppersdeals.in', 302);
    }
  }

  if (!dealId) {
    return NextResponse.redirect('https://www.shoppersdeals.in', 302);
  }

  // 2. Fetch Deal or Product from API (with direct MongoDB Atlas fallback for 100% resilience)
  try {
    let target = null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`${API_BASE}/api/deals/${dealId}`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
        next: { revalidate: 60 },
      });
      clearTimeout(timeout);

      if (res.ok) {
        const json = await res.json();
        target = json?.data || json;
      }
    } catch (apiErr) {
      console.warn(`[Redirect /r/${dealId}] API fetch error, switching to direct DB fallback:`, apiErr.message);
    }

    if (!target) {
      target = await directFetchDealById(dealId).catch(() => null);
    }
    if (!target) {
      target = await directFetchProductById(dealId).catch(() => null);
    }

    if (target) {
      let targetUrl = target?.dealUrl || target?.cleanUrl || target?.url;
      const country = target?.country || 'IN';
      let failoverStore = null;

      // Decision 20: Multi-Store Out-of-Stock Failover
      const isDeadOrOOS = target.isExpired || target.isAvailable === false || target.isOutOfStock;
      if (isDeadOrOOS) {
        failoverStore = await directFindAlternativeInStockStore(target).catch(() => null);
        if (failoverStore?.cleanUrl) {
          targetUrl = failoverStore.cleanUrl;
          console.log(`[Redirect Failover] Deal ${dealId} (${target.merchant}) is out of stock. Switched to ${failoverStore.merchant}: ${targetUrl}`);
        }
      }

      if (targetUrl) {
        // Build affiliate URL with specific subid attribution
        let redirectUrl = getAffiliateUrl(targetUrl, country);

        // Enhance Cuelinks subid if applicable
        if (redirectUrl.includes('linksredirect.com') && src !== 'web') {
          try {
            const parsed = new URL(redirectUrl);
            parsed.searchParams.set('subid', src);
            redirectUrl = parsed.toString();
          } catch (e) {}
        }

        // Detect device type & social crawlers from user-agent
        const userAgent = request.headers.get('user-agent') || '';
        const isAndroid = /Android/i.test(userAgent);
        const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
        const isMobile = isAndroid || isIOS;
        const isSocialCrawler = /facebookexternalhit|WhatsApp|Twitterbot|TelegramBot|LinkedInBot|Pinterest|Slackbot/i.test(userAgent);

        // Asynchronously log click to Revenue Analytics engine
        try {
          fetch(`${API_BASE}/api/tracking/click`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dealId: target?._id ? String(target._id) : (dealId.length === 24 ? dealId : null),
              productId: target?.productId || target?.asin || null,
              title: target?.title || 'Unknown Product',
              merchant: failoverStore?.merchant || target?.merchant || 'amazon',
              country,
              category: target?.category || 'general',
              subcategory: target?.subcategory || '',
              dealPrice: target?.dealPrice || target?.price || 0,
              originalPrice: target?.originalPrice || 0,
              discountPercentage: target?.discountPercentage || 0,
              source: src,
              device: isAndroid ? 'mobile_android' : (isIOS ? 'mobile_ios' : 'desktop'),
              userAgent,
              destinationUrl: redirectUrl,
              isFailover: Boolean(failoverStore),
              failoverFromMerchant: failoverStore ? target?.merchant : null,
            }),
          }).catch(() => {});
        } catch (trackErr) {
          // Non-blocking
        }

        // Update user personalization profile via cookie on outbound checkout click
        let serializedPzn = '';
        try {
          const rawPzn = request.cookies.get(PZN_COOKIE_NAME)?.value;
          const currentProfile = parsePersonalizationCookie(rawPzn);
          const updatedProfile = recordInteraction(currentProfile, {
            type: 'buy_click',
            category: target?.category,
            merchant: failoverStore?.merchant || target?.merchant,
            price: target?.dealPrice || target?.price,
            productId: target?.productId || target?._id || dealId,
          });
          serializedPzn = serializePersonalizationCookie(updatedProfile);
        } catch (pznErr) {
          // Non-blocking
        }

        // Construct rich OpenGraph metadata for preview crawlers (WhatsApp, Telegram, etc.)
        const rawTitle = target?.title || 'Verified Deal';
        const displayTitle = rawTitle.slice(0, 70);
        const price = target?.dealPrice || target?.price;
        const origPrice = target?.originalPrice || target?.previousPrice;
        const discount = target?.discountPercentage;
        const merchantUpper = (failoverStore?.merchant || target?.merchant || 'Store').toUpperCase();

        const ogTitle = price ? `🔥 ${displayTitle} — ₹${price}${discount ? ` (${discount}% OFF)` : ''}` : displayTitle;
        const ogDescription = `Verified price drop on ${merchantUpper}: ${origPrice && origPrice > price ? `Dropped from ₹${origPrice} to ₹${price}` : `Lowest price ₹${price}`}. Tracked live on ShoppersDeals.`;
        const ogImage = target?.imageUrl || (Array.isArray(target?.images) && target.images[0]) || '';

        // On desktop (non-social crawler), instant 302 redirect with personalization cookie
        if (!isMobile && !isSocialCrawler) {
          const res = NextResponse.redirect(redirectUrl, 302);
          if (serializedPzn) {
            res.cookies.set(PZN_COOKIE_NAME, serializedPzn, {
              path: '/',
              maxAge: PZN_COOKIE_MAX_AGE,
              sameSite: 'lax',
            });
          }
          return res;
        }

        // Build native app intent scheme for mobile users to bypass in-app webview login traps
        let intentUrl = null;
        const cleanNoProto = targetUrl.replace(/^https?:\/\//, '');

        if (isAndroid) {
          if (targetUrl.includes('amazon.in')) {
            intentUrl = `intent://${cleanNoProto}#Intent;scheme=https;package=in.amazon.mShop.android.shopping;end;`;
          } else if (targetUrl.includes('flipkart.com')) {
            intentUrl = `intent://${cleanNoProto}#Intent;scheme=https;package=com.flipkart.android;end;`;
          } else if (targetUrl.includes('myntra.com')) {
            intentUrl = `intent://${cleanNoProto}#Intent;scheme=https;package=com.myntra.android;end;`;
          } else if (targetUrl.includes('nykaa.com')) {
            intentUrl = `intent://${cleanNoProto}#Intent;scheme=https;package=com.fsn.nykaa;end;`;
          }
        }

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(ogTitle)} | ShoppersDeals</title>
  <meta name="description" content="${escapeHtml(ogDescription)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="ShoppersDeals">
  <meta property="og:title" content="${escapeHtml(ogTitle)}">
  <meta property="og:description" content="${escapeHtml(ogDescription)}">
  ${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}">` : ''}
  <meta property="og:url" content="https://www.shoppersdeals.in/r/${dealId}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}">
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}">
  ${ogImage ? `<meta name="twitter:image" content="${escapeHtml(ogImage)}">` : ''}
  <meta http-equiv="refresh" content="${isSocialCrawler ? '3' : '1'};url=${redirectUrl}">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #fff; text-align: center; padding: 20px; }
    .loader { width: 44px; height: 44px; border: 4px solid #334155; border-top-color: #38bdf8; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 20px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .btn { margin-top: 18px; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; }
  </style>
</head>
<body>
  <div class="loader"></div>
  <p style="font-size: 18px; font-weight: 600; margin: 0 0 8px;">
    ${failoverStore ? `⚡ Switched to In-Stock Price on ${failoverStore.merchant?.toUpperCase()}!` : 'Opening Store App...'}
  </p>
  <p style="font-size: 13px; color: #94a3b8; margin: 0 0 16px;">
    ${failoverStore ? `Original deal on ${(target?.merchant || 'store').toUpperCase()} is out of stock. Automatically routed to verified stock!` : 'Redirecting you to the best verified price...'}
  </p>
  <a class="btn" href="${redirectUrl}">Click here if not redirected</a>
  <script>
    (function() {
      var affUrl = ${JSON.stringify(redirectUrl)};
      var intentUrl = ${JSON.stringify(intentUrl)};
      if (intentUrl) {
        window.location.href = intentUrl;
        setTimeout(function() {
          window.location.replace(affUrl);
        }, 850);
      } else {
        window.location.replace(affUrl);
      }
    })();
  </script>
</body>
</html>`;

        const mobileHeaders = {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        };
        if (serializedPzn) {
          mobileHeaders['Set-Cookie'] = `${PZN_COOKIE_NAME}=${serializedPzn}; Path=/; Max-Age=${PZN_COOKIE_MAX_AGE}; SameSite=Lax`;
        }

        return new Response(html, {
          status: 200,
          headers: mobileHeaders,
        });
      }
    }
  } catch (err) {
    console.error(`[Redirect /r/${dealId}] Lookup failed:`, err.message);
  }

  // Fallback to product page on site (deals are a subset of canonical products)
  return NextResponse.redirect(`https://www.shoppersdeals.in/product/${dealId}`, 302);
}
