'use client';

import React, { useEffect, useRef, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  initPostHog,
  trackPageView,
  trackExitIntent,
  trackChurnEvent,
  trackOutboundClick,
  trackEvent,
  updateActiveTime,
  updateMaxScrollDepth,
} from '@/lib/analytics';

/**
 * Tracks route changes in Next.js App Router
 */
function PostHogPageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPathRef = useRef(null);

  useEffect(() => {
    const fullPath = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    if (lastPathRef.current !== fullPath) {
      lastPathRef.current = fullPath;
      trackPageView(pathname, {
        full_path: fullPath,
        query_string: searchParams?.toString() || '',
      });
    }
  }, [pathname, searchParams]);

  return null;
}

/**
 * Monitors engagement, time-on-site, scroll depth, outbound clicks, and exit churn
 */
export function PostHogProvider({ children }) {
  useEffect(() => {
    // 1. Initialize PostHog client
    initPostHog();

    // 2. Active time-on-page tracking
    let isVisible = typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;
    let secondsOnPage = 0;
    const engagementMilestones = new Set();

    const timer = setInterval(() => {
      if (isVisible) {
        secondsOnPage += 1;
        updateActiveTime(1);

        // Emit engagement milestones: 5s, 15s, 30s, 60s, 120s, 300s
        const milestones = [5, 15, 30, 60, 120, 300];
        for (const m of milestones) {
          if (secondsOnPage >= m && !engagementMilestones.has(m)) {
            engagementMilestones.add(m);
            trackEvent('page_engagement_ping', {
              milestone_seconds: m,
              active_seconds: secondsOnPage,
              url_path: window.location.pathname,
            });
          }
        }
      }
    }, 1000);

    const handleVisibilityChange = () => {
      isVisible = document.visibilityState === 'visible';
      if (!isVisible) {
        // Tab backgrounded or switched
        trackEvent('tab_hidden', {
          active_seconds_before_hide: secondsOnPage,
          url_path: window.location.pathname,
        });
      } else {
        trackEvent('tab_resumed', {
          url_path: window.location.pathname,
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 3. Scroll Depth Tracking (25%, 50%, 75%, 90%, 100%)
    const reachedScrollMilestones = new Set();
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;
      const scrollPercent = Math.min(100, Math.round((window.scrollY / scrollHeight) * 100));

      updateMaxScrollDepth(scrollPercent);

      const milestones = [25, 50, 75, 90, 100];
      for (const m of milestones) {
        if (scrollPercent >= m && !reachedScrollMilestones.has(m)) {
          reachedScrollMilestones.add(m);
          trackEvent('scroll_depth_milestone', {
            depth_percentage: m,
            url_path: window.location.pathname,
            seconds_to_depth: secondsOnPage,
          });
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    // 4. Desktop Exit Intent (Cursor leaves viewport top)
    let exitIntentFired = false;
    const handleMouseLeave = (e) => {
      if (e.clientY <= 0 && !exitIntentFired) {
        exitIntentFired = true;
        trackExitIntent('mouse_left_top_window');
        // Reset after 30 seconds so it can fire again if they return and leave again
        setTimeout(() => {
          exitIntentFired = false;
        }, 30000);
      }
    };
    document.addEventListener('mouseleave', handleMouseLeave);

    // 5. Churn on Pagehide / Beforeunload
    const handlePageHide = (e) => {
      trackChurnEvent(e.persisted ? 'page_persisted_hide' : 'page_unload_exit');
    };
    window.addEventListener('pagehide', handlePageHide);

    // 6. Global Outbound Click Interception
    const handleGlobalClick = (e) => {
      const anchor = e.target.closest('a');
      if (!anchor || !anchor.href) return;

      const href = anchor.href;
      const host = window.location.hostname;

      // Check if it's an outbound store or redirect link
      const isOutboundStore =
        href.includes('/r/') ||
        href.includes('linksredirect.com') ||
        href.includes('clnk.in') ||
        href.includes('amazon.') ||
        href.includes('flipkart.com') ||
        href.includes('myntra.com') ||
        href.includes('nykaa.com') ||
        href.includes('ajio.com') ||
        href.includes('meesho.com') ||
        href.includes('t.me/ShoppersDealsAlertBot');

      if (isOutboundStore && !href.startsWith(window.location.origin) || href.includes('/r/')) {
        let store = 'unknown';
        if (/amazon/i.test(href)) store = 'amazon';
        else if (/flipkart/i.test(href)) store = 'flipkart';
        else if (/myntra/i.test(href)) store = 'myntra';
        else if (/nykaa/i.test(href)) store = 'nykaa';
        else if (/ajio/i.test(href)) store = 'ajio';
        else if (/meesho/i.test(href)) store = 'meesho';
        else if (/t\.me/i.test(href)) store = 'telegram_bot';

        const originAttr = anchor.getAttribute('data-tracking-origin') || 'general_link';

        trackOutboundClick(
          {
            merchant: store,
            title: anchor.title || anchor.innerText?.slice(0, 80) || 'Store Link',
          },
          href,
          originAttr
        );
      }
    };
    document.addEventListener('click', handleGlobalClick, { capture: true });

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('click', handleGlobalClick, { capture: true });
    };
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageViewTracker />
      </Suspense>
      {children}
    </>
  );
}

export default PostHogProvider;
