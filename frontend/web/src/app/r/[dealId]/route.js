import { NextResponse } from 'next/server';
import { getAffiliateUrl } from '@/lib/affiliate';
import { directFetchDealById, directFetchProductById } from '@/lib/dbFallback';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://shoppersdeals-api-production.up.railway.app').replace(/\/+$/, '');
const CUELINKS_PUB_ID = process.env.NEXT_PUBLIC_CUELINKS_PUB_ID || '325472';

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
      const targetUrl = target?.dealUrl || target?.cleanUrl || target?.url;
      const country = target?.country || 'IN';

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

        // Detect device type from user-agent
        const userAgent = request.headers.get('user-agent') || '';
        const isAndroid = /Android/i.test(userAgent);
        const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
        const isMobile = isAndroid || isIOS;

        // On desktop, instant 302 redirect
        if (!isMobile) {
          return NextResponse.redirect(redirectUrl, 302);
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
  <title>Opening Deal | ShoppersDeals</title>
  <meta http-equiv="refresh" content="1;url=${redirectUrl}">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #fff; text-align: center; padding: 20px; }
    .loader { width: 44px; height: 44px; border: 4px solid #334155; border-top-color: #38bdf8; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 20px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .btn { margin-top: 18px; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; }
  </style>
</head>
<body>
  <div class="loader"></div>
  <p style="font-size: 18px; font-weight: 600; margin: 0 0 8px;">Opening Store App...</p>
  <p style="font-size: 13px; color: #94a3b8; margin: 0 0 16px;">Redirecting you to the best verified price...</p>
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

        return new Response(html, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        });
      }
    }
  } catch (err) {
    console.error(`[Redirect /r/${dealId}] Lookup failed:`, err.message);
  }

  // Fallback to deal page on site
  return NextResponse.redirect(`https://www.shoppersdeals.in/deal/${dealId}`, 302);
}
