'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    // When pathname or search params change, navigation has completed
    setIsNavigating(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleAnchorClick = (e) => {
      if (!e.target || typeof e.target.closest !== 'function') return;
      const target = e.target.closest('a');
      if (!target) return;

      const href = target.getAttribute('href');
      const targetAttr = target.getAttribute('target');

      // Only show for internal route transitions (not external links or new tab)
      if (
        href &&
        href.startsWith('/') &&
        !href.startsWith('//') &&
        targetAttr !== '_blank' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.shiftKey
      ) {
        // If navigating to a different path
        if (href !== window.location.pathname) {
          setIsNavigating(true);
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);
    return () => document.removeEventListener('click', handleAnchorClick);
  }, []);

  if (!isNavigating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-[3px] bg-transparent overflow-hidden pointer-events-none">
      <div className="h-full bg-brand animate-indeterminate shadow-[0_0_8px_rgba(255,107,0,0.6)]" />
    </div>
  );
}
