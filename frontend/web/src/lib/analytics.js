import posthog from 'posthog-js';
import { POSTHOG_KEY, POSTHOG_HOST } from './config';

let isInitialized = false;

// Session-level engagement counters
const sessionState = {
  sessionStartTime: typeof Date !== 'undefined' ? Date.now() : 0,
  pageStartTime: typeof Date !== 'undefined' ? Date.now() : 0,
  activePageTimeSeconds: 0,
  lastVisibilityChangeTime: typeof Date !== 'undefined' ? Date.now() : 0,
  isTabVisible: true,
  dealsViewedCount: 0,
  dealsClickedCount: 0,
  outboundClicksCount: 0,
  maxScrollDepth: 0,
  initialReferrer: '',
  trafficSource: 'direct',
  hasConverted: false,
};

/**
 * Parses referrer domain and classifies acquisition channel
 */
function classifyTrafficSource(referrerUrl, currentUrl) {
  if (!referrerUrl) {
    // Check if there are UTM or source parameters
    try {
      const url = new URL(currentUrl);
      const src = url.searchParams.get('src') || url.searchParams.get('utm_source');
      if (src) {
        if (/tg|telegram/i.test(src)) return 'telegram_channel';
        if (/wa|whatsapp/i.test(src)) return 'whatsapp_broadcast';
        if (/x|twitter/i.test(src)) return 'twitter_x';
        return `campaign_${src.toLowerCase()}`;
      }
    } catch (e) {}
    return 'direct';
  }

  try {
    const ref = new URL(referrerUrl);
    const host = ref.hostname.toLowerCase();

    if (/google\./i.test(host)) return 'google_organic';
    if (/bing\./i.test(host)) return 'bing_organic';
    if (/duckduckgo\./i.test(host)) return 'duckduckgo_organic';
    if (/t\.me|telegram\./i.test(host)) return 'telegram_channel';
    if (/whatsapp\./i.test(host) || /api\.whatsapp\./i.test(host)) return 'whatsapp';
    if (/instagram\./i.test(host)) return 'instagram';
    if (/facebook\.|fb\./i.test(host)) return 'facebook';
    if (/twitter\.|t\.co|x\.com/i.test(host)) return 'twitter_x';
    if (/youtube\.|youtu\.be/i.test(host)) return 'youtube';
    if (/reddit\./i.test(host)) return 'reddit';
    if (/linkedin\./i.test(host)) return 'linkedin';
    if (host.includes(window?.location?.hostname)) return 'internal';

    return `referral_${host.replace(/^www\./, '')}`;
  } catch (e) {
    return 'referral_unknown';
  }
}

/**
 * Extracts marketing & attribution context
 */
export function getAttributionContext() {
  if (typeof window === 'undefined') return {};

  const currentUrl = window.location.href;
  const referrer = document.referrer || '';
  const searchParams = new URLSearchParams(window.location.search);

  if (!sessionState.initialReferrer && referrer) {
    sessionState.initialReferrer = referrer;
    sessionState.trafficSource = classifyTrafficSource(referrer, currentUrl);
  } else if (!sessionState.trafficSource || sessionState.trafficSource === 'direct') {
    sessionState.trafficSource = classifyTrafficSource(referrer, currentUrl);
  }

  return {
    initial_referrer: sessionState.initialReferrer || 'direct',
    current_referrer: referrer || 'direct',
    traffic_source: sessionState.trafficSource,
    utm_source: searchParams.get('utm_source') || searchParams.get('src') || null,
    utm_medium: searchParams.get('utm_medium') || null,
    utm_campaign: searchParams.get('utm_campaign') || null,
    utm_content: searchParams.get('utm_content') || null,
    utm_term: searchParams.get('utm_term') || null,
    url_path: window.location.pathname,
    url_search: window.location.search,
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    device_type: window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop',
    screen_resolution: `${window.screen.width}x${window.screen.height}`,
  };
}

/**
 * Initializes PostHog with production safeguards
 */
export function initPostHog() {
  if (typeof window === 'undefined' || isInitialized) return posthog;

  const key = POSTHOG_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = POSTHOG_HOST || process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (!key) {
    if (process.env.NODE_ENV === 'development') {
      console.info('[PostHog] NEXT_PUBLIC_POSTHOG_KEY not set. Analytics runs in development logger mode.');
    }
    isInitialized = true;
    return posthog;
  }

  try {
    posthog.init(key, {
      api_host: host,
      person_profiles: 'always', // Track both anonymous guests and logged-in users
      capture_pageview: false, // Handled custom in Next.js router
      capture_pageleave: true, // Automatically sends $pageleave on exit
      autocapture: true, // Captures DOM interactions
      disable_session_recording: false, // Session replay recordings
      session_recording: {
        maskAllInputs: false,
        maskInputOptions: {
          password: true,
        },
      },
      loaded: (ph) => {
        if (process.env.NODE_ENV === 'development') {
          ph.debug(false);
        }
        // Register super properties that attach to EVERY event
        const attribution = getAttributionContext();
        ph.register({
          platform: 'web',
          app_version: '1.0.0',
          initial_traffic_source: attribution.traffic_source,
          initial_referrer: attribution.initial_referrer,
        });
      },
    });

    isInitialized = true;
  } catch (err) {
    console.warn('[PostHog Init Error]', err);
  }

  return posthog;
}

/**
 * Universal safe event dispatcher
 */
export function trackEvent(eventName, properties = {}) {
  if (typeof window === 'undefined') return;

  const fullProperties = {
    ...getAttributionContext(),
    session_elapsed_seconds: Math.round((Date.now() - sessionState.sessionStartTime) / 1000),
    active_page_time_seconds: Math.round(sessionState.activePageTimeSeconds),
    deals_viewed_in_session: sessionState.dealsViewedCount,
    deals_clicked_in_session: sessionState.dealsClickedCount,
    outbound_clicks_in_session: sessionState.outboundClicksCount,
    has_converted: sessionState.hasConverted,
    timestamp: new Date().toISOString(),
    ...properties,
  };

  try {
    if (posthog.__loaded) {
      posthog.capture(eventName, fullProperties);
    } else if (process.env.NODE_ENV === 'development') {
      console.log(`[PostHog Track Event: ${eventName}]`, fullProperties);
    }
  } catch (err) {
    console.warn(`[PostHog error tracking ${eventName}]`, err);
  }
}

// -------------------------------------------------------------
// SPECIFIC SPECIALIZED TRACKING METHODS
// -------------------------------------------------------------

/**
 * Tracks enriched pageview on route change
 */
export function trackPageView(pathname, extra = {}) {
  sessionState.pageStartTime = Date.now();
  sessionState.activePageTimeSeconds = 0;
  sessionState.maxScrollDepth = 0;

  trackEvent('$pageview', {
    $current_url: typeof window !== 'undefined' ? window.location.href : '',
    $pathname: pathname,
    page_type: getPageType(pathname),
    ...extra,
  });
}

function getPageType(pathname) {
  if (!pathname || pathname === '/') return 'home';
  if (pathname.startsWith('/product/')) return 'product_pdp';
  if (pathname.startsWith('/deal/')) return 'deal_pdp';
  if (pathname.startsWith('/coupons')) return 'coupons_hub';
  if (pathname.startsWith('/wishlist') || pathname.startsWith('/saved')) return 'wishlist';
  if (pathname.startsWith('/best/')) return 'category_hub';
  if (pathname.startsWith('/blog')) return 'blog';
  if (pathname.startsWith('/search')) return 'search_results';
  return 'other';
}

/**
 * Tracks Deal Card Impressions (when seen in view)
 */
export function trackDealImpression(deal, feedContext = 'grid') {
  if (!deal) return;
  trackEvent('deal_impression', {
    deal_id: deal.dealId || deal._id || deal.id,
    product_id: deal.productId,
    merchant: deal.merchant || 'unknown',
    title: deal.title,
    current_price: deal.dealPrice || deal.price,
    original_price: deal.regularPrice || deal.originalPrice,
    discount_percentage: deal.discountPercentage,
    feed_context: feedContext,
    is_verified: deal.isVerified,
  });
}

/**
 * Tracks Deal Card Click
 */
export function trackDealClicked(deal, context = {}) {
  if (!deal) return;
  sessionState.dealsClickedCount += 1;

  trackEvent('deal_clicked', {
    deal_id: deal.dealId || deal._id || deal.id,
    product_id: deal.productId,
    merchant: deal.merchant || 'unknown',
    title: deal.title,
    current_price: deal.dealPrice || deal.price,
    discount_percentage: deal.discountPercentage,
    category: deal.category || null,
    target_url: deal.cleanUrl || deal.url,
    click_source: context.source || 'deal_card',
    position_in_grid: context.index ?? null,
  });
}

/**
 * Tracks Product or Deal PDP View
 */
export function trackDealViewed(productOrDeal) {
  if (!productOrDeal) return;
  sessionState.dealsViewedCount += 1;

  trackEvent('deal_viewed', {
    product_id: productOrDeal.productId || productOrDeal.id,
    deal_id: productOrDeal.dealId || productOrDeal._id || null,
    merchant: productOrDeal.merchant || 'unknown',
    title: productOrDeal.title,
    current_price: productOrDeal.dealPrice || productOrDeal.price,
    original_price: productOrDeal.originalPrice || productOrDeal.regularPrice,
    discount_percentage: productOrDeal.discountPercentage || 0,
    category: productOrDeal.category || null,
    subcategory: productOrDeal.subcategory || null,
    has_price_history: Array.isArray(productOrDeal.priceHistory) && productOrDeal.priceHistory.length > 0,
    has_bank_offers: Array.isArray(productOrDeal.bankOffers) && productOrDeal.bankOffers.length > 0,
    is_in_stock: productOrDeal.inStock !== false,
  });
}

/**
 * Tracks Outbound Affiliate Click (The conversion event)
 */
export function trackOutboundClick(item, targetUrl, clickOrigin = 'buy_now_btn') {
  sessionState.outboundClicksCount += 1;
  sessionState.hasConverted = true;

  const merchant = (item?.merchant || 'amazon').toLowerCase();
  const timeOnSiteBeforeClick = Math.round((Date.now() - sessionState.sessionStartTime) / 1000);

  trackEvent('outbound_store_click', {
    merchant,
    target_store: merchant,
    product_id: item?.productId || null,
    deal_id: item?.dealId || item?._id || null,
    title: item?.title || null,
    deal_price: item?.dealPrice || item?.price || null,
    target_url: targetUrl,
    click_origin: clickOrigin,
    time_to_click_seconds: timeOnSiteBeforeClick,
    conversion_type: merchant === 'amazon' ? 'direct_amazon_affiliate' : 'cuelinks_redirect',
  });
}

/**
 * Tracks Search Queries & Zero Result Gaps
 */
export function trackSearch(query, resultCount = 0, filters = {}) {
  if (!query) return;
  trackEvent('search_performed', {
    query: query.trim(),
    result_count: resultCount,
    has_results: resultCount > 0,
    ...filters,
  });

  if (resultCount === 0) {
    trackEvent('search_zero_results', {
      query: query.trim(),
      ...filters,
    });
  }
}

/**
 * Tracks Filter and Sort Actions
 */
export function trackFilterChange(filterType, filterValue) {
  trackEvent('filter_applied', {
    filter_type: filterType,
    filter_value: filterValue,
  });
}

export function trackSortChange(sortBy) {
  trackEvent('sort_changed', {
    sort_by: sortBy,
  });
}

/**
 * Tracks Coupon Actions
 */
export function trackCouponCopied(coupon, location = 'pdp_card') {
  trackEvent('coupon_copied', {
    coupon_code: coupon.code,
    merchant: coupon.merchant || coupon.storeName || 'unknown',
    discount: coupon.discount || null,
    coupon_title: coupon.title || null,
    location,
  });
}

/**
 * Tracks Price Alert Interactions
 */
export function trackPriceAlertOpen(product) {
  trackEvent('price_alert_modal_opened', {
    product_id: product?.productId,
    merchant: product?.merchant,
    current_price: product?.price || product?.dealPrice,
  });
}

export function trackPriceAlertCreate(product, targetPrice, method = 'telegram_bot') {
  trackEvent('price_alert_created', {
    product_id: product?.productId,
    merchant: product?.merchant,
    current_price: product?.price || product?.dealPrice,
    target_price: targetPrice,
    drop_percentage_targeted: product?.price ? Math.round(((product.price - targetPrice) / product.price) * 100) : null,
    alert_method: method,
  });
}

/**
 * Tracks Interactive Price Chart Interactions
 */
export function trackPriceHistoryInteraction(product, selectedRange, isAtl = false) {
  trackEvent('price_history_interacted', {
    product_id: product?.productId,
    merchant: product?.merchant,
    selected_range: selectedRange,
    is_at_all_time_low: isAtl,
  });
}

/**
 * Tracks Wishlist / OneList Actions
 */
export function trackWishlistToggle(product, isAdded, totalItems = 0) {
  trackEvent('wishlist_toggled', {
    action: isAdded ? 'add' : 'remove',
    product_id: product?.productId,
    merchant: product?.merchant,
    price: product?.price || product?.dealPrice,
    total_wishlist_items: totalItems,
  });
}

export function trackWishlistShare(itemCount, totalValue, totalSavings) {
  trackEvent('wishlist_shared', {
    item_count: itemCount,
    total_cart_value: totalValue,
    total_potential_savings: totalSavings,
  });
}

/**
 * Tracks User Churn & Exit Intent
 */
export function trackExitIntent(reason = 'mouse_leave_top') {
  trackEvent('exit_intent_detected', {
    reason,
    active_page_time_seconds: Math.round(sessionState.activePageTimeSeconds),
    max_scroll_depth: sessionState.maxScrollDepth,
    has_clicked_deal: sessionState.dealsClickedCount > 0,
    has_converted: sessionState.hasConverted,
  });
}

export function trackChurnEvent(reason = 'tab_close') {
  const timeOnPage = Math.round((Date.now() - sessionState.pageStartTime) / 1000);
  const timeOnSite = Math.round((Date.now() - sessionState.sessionStartTime) / 1000);

  let churnHypothesis = 'passive_bounce';
  if (sessionState.hasConverted) {
    churnHypothesis = 'converted_to_store';
  } else if (sessionState.dealsClickedCount > 0) {
    churnHypothesis = 'interested_browser_dropoff';
  } else if (timeOnSite < 10) {
    churnHypothesis = 'immediate_bounce';
  } else if (sessionState.maxScrollDepth > 60) {
    churnHypothesis = 'engaged_reader_dropoff';
  }

  trackEvent('user_churned', {
    churn_type: reason,
    churn_hypothesis: churnHypothesis,
    page_dwell_seconds: timeOnPage,
    session_duration_seconds: timeOnSite,
    max_scroll_depth: sessionState.maxScrollDepth,
    deals_viewed: sessionState.dealsViewedCount,
    deals_clicked: sessionState.dealsClickedCount,
    outbound_clicks: sessionState.outboundClicksCount,
    has_converted: sessionState.hasConverted,
    exit_page_path: typeof window !== 'undefined' ? window.location.pathname : '',
    exit_page_url: typeof window !== 'undefined' ? window.location.href : '',
    entry_referrer: sessionState.initialReferrer || 'direct',
    traffic_source: sessionState.trafficSource,
  });
}

/**
 * Updates session active time & scroll depth
 */
export function updateActiveTime(secondsDelta) {
  sessionState.activePageTimeSeconds += secondsDelta;
}

export function updateMaxScrollDepth(depthPercent) {
  if (depthPercent > sessionState.maxScrollDepth) {
    sessionState.maxScrollDepth = depthPercent;
  }
}

/**
 * User Identity Management
 */
export function identifyUser(userId, traits = {}) {
  if (typeof window === 'undefined' || !posthog.__loaded) return;
  try {
    posthog.identify(userId, traits);
  } catch (e) {}
}

export function resetUser() {
  if (typeof window === 'undefined' || !posthog.__loaded) return;
  try {
    posthog.reset();
  } catch (e) {}
}

export const logEvent = trackEvent;

export default {
  initPostHog,
  trackEvent,
  trackPageView,
  trackDealImpression,
  trackDealClicked,
  trackDealViewed,
  trackOutboundClick,
  trackSearch,
  trackFilterChange,
  trackSortChange,
  trackCouponCopied,
  trackPriceAlertOpen,
  trackPriceAlertCreate,
  trackPriceHistoryInteraction,
  trackWishlistToggle,
  trackWishlistShare,
  trackExitIntent,
  trackChurnEvent,
  updateActiveTime,
  updateMaxScrollDepth,
  identifyUser,
  resetUser,
};
