'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [navTarget, setNavTarget] = useState('page');

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
          if (href.startsWith('/product') || href.startsWith('/deal')) {
            setNavTarget('history');
          } else {
            setNavTarget('page');
          }
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);
    return () => document.removeEventListener('click', handleAnchorClick);
  }, []);

  // Safety fallback: if navigation takes longer than 8s, auto-dismiss
  useEffect(() => {
    if (!isNavigating) return;
    const timer = setTimeout(() => {
      setIsNavigating(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, [isNavigating]);

  if (!isNavigating) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[99999]">
      {/* 1. Razor-Sharp Top Navigation Progress Line */}
      <div className="h-[3.5px] w-full bg-transparent overflow-hidden">
        <div className="h-full bg-gradient-to-r from-brand via-amber-500 to-indigo-600 animate-indeterminate shadow-[0_0_12px_rgba(255,107,0,0.85)]" />
      </div>

      {/* 2. Floating High-Visibility Center Status Pill */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] flex items-center gap-2.5 rounded-full border border-slate-200/90 bg-white/95 px-4 py-2 shadow-2xl backdrop-blur-md text-xs font-bold text-slate-900 animate-in fade-in slide-in-from-top-3 duration-200">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent shrink-0" />
        <span className="tracking-tight">
          {navTarget === 'history'
            ? 'Loading Price History & Analytics…'
            : 'Loading Page…'}
        </span>
      </div>
    </div>
  );
}
