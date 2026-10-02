import { NextResponse } from 'next/server';
import { getAffiliateUrl } from '@/lib/affiliate';

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

  // 2. Fetch Deal or Product from API
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
      const target = json?.data || json;
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

        return NextResponse.redirect(redirectUrl, 302);
      }
    }
  } catch (err) {
    console.error(`[Redirect /r/${dealId}] Lookup failed:`, err.message);
  }

  // Fallback to deal page on site
  return NextResponse.redirect(`https://www.shoppersdeals.in/deal/${dealId}`, 302);
}
