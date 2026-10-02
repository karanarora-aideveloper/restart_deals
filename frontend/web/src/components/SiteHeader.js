'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useSavedCount } from '@/lib/useSavedCount';
import { useCompare } from '@/lib/useCompare';
import { API_BASE_URL } from '@/lib/config';
import QuickCategoryRail from '@/components/QuickCategoryRail';

const NAV_LINKS = [
  { href: '/', label: 'Live Feed', match: (p) => p === '/' || p.startsWith('/deal/') },
  { href: '/hot', label: 'Hot Deals' },
  { href: '/products', label: 'Track Prices' },
  { href: '/coupons', label: 'Coupons' },
  { href: '/compare', label: 'Compare' },
  { href: '/blog', label: 'Buying Guides', match: (p) => p.startsWith('/blog') },
  { href: '/categories', label: 'Categories' },
];

const LISTING_PATHS = new Set(['/', '/hot', '/products']);

const SUPPORTED_COUNTRIES = [
  { code: 'in', label: 'India', flag: '🇮🇳', currency: '₹ INR' },
  { code: 'us', label: 'United States', flag: '🇺🇸', currency: '$ USD' },
];

export default function SiteHeader() {
  const { user, isLoggedIn } = useAuth();
  const savedCount = useSavedCount();
  const { compareItems } = useCompare();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const countryParam = (searchParams.get('country') || '').toLowerCase();
  const [activeCountry, setActiveCountry] = useState(countryParam || 'in');
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const countryDropdownRef = useRef(null);

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [focused, setFocused] = useState(false);
  const [isResolvingUrl, setIsResolvingUrl] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (countryParam) {
      setActiveCountry(countryParam);
      if (typeof window !== 'undefined') {
        localStorage.setItem('shoppersdeals_country', countryParam);
        document.cookie = `sd_country=${countryParam}; path=/; max-age=31536000; SameSite=Lax`;
      }
    } else if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('shoppersdeals_country');
      if (stored && (stored === 'in' || stored === 'us')) {
        setActiveCountry(stored);
      }
    }
  }, [countryParam]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target)) {
        setIsCountryOpen(false);
      }
    };
    if (isCountryOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isCountryOpen]);

  const handleCountryChange = (countryCode) => {
    setIsCountryOpen(false);
    setActiveCountry(countryCode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('shoppersdeals_country', countryCode);
      document.cookie = `sd_country=${countryCode}; path=/; max-age=31536000; SameSite=Lax`;
    }
    const params = new URLSearchParams(searchParams.toString());
    if (countryCode === 'in') {
      params.delete('country');
    } else {
      params.set('country', countryCode);
    }
    const target = LISTING_PATHS.has(pathname) ? pathname : '/';
    const qs = params.toString();
    router.push(qs ? `${target}?${qs}` : target);
  };

  const getNavHref = (baseHref) => {
    if (activeCountry && activeCountry !== 'in') {
      return `${baseHref}?country=${activeCountry}`;
    }
    return baseHref;
  };

  // Only synchronize query from URL when the user is NOT actively focused/typing in the search input.
  useEffect(() => {
    if (!focused) {
      setQuery(searchParams.get('q') || '');
    }
  }, [searchParams, pathname, focused]);

  const pushQuery = useCallback((value) => {
    const val = (value || '').trim();
    if (val) {
      // Route all keyword searches to /products so shoppers search the full permanent product catalog with 90-day price history & cross-store insights
      const params = new URLSearchParams();
      params.set('q', val);
      if (activeCountry && activeCountry !== 'in') {
        params.set('country', activeCountry);
      }
      router.push(`/products?${params.toString()}`);
    } else {
      // Clearing search query: stay on listing page if already on one, or return to /
      const target = LISTING_PATHS.has(pathname) ? pathname : '/';
      const params = LISTING_PATHS.has(pathname) ? new URLSearchParams(searchParams.toString()) : new URLSearchParams();
      params.delete('q');
      if (activeCountry && activeCountry !== 'in') {
        params.set('country', activeCountry);
      }
      const qs = params.toString();
      router.push(qs ? `${target}?${qs}` : target);
    }
  }, [pathname, router, searchParams, activeCountry]);

  const executeSearch = async (rawQuery) => {
    const q = (rawQuery || '').trim();
    if (!q) {
      pushQuery('');
      return;
    }

    if (
      q.startsWith('http') ||
      q.includes('amazon.') ||
      q.includes('flipkart.com') ||
      q.includes('amzn.to') ||
      q.includes('fkrt.it') ||
      q.includes('myntra.com') ||
      q.includes('nykaa.com') ||
      q.includes('ajio.com')
    ) {
      setIsResolvingUrl(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/products/lookup-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: q }),
        });
        const data = await res.json();
        if (data.success && data.found && data.data) {
          router.push(`/product/${data.data._id || data.data.productId}`);
          return;
        }
        if (data.parsed && data.parsed.productId) {
          router.push(`/product/${data.parsed.productId}`);
          return;
        }
      } catch (err) {
        console.error('[SiteHeader URL Lookup Error]', err);
      } finally {
        setIsResolvingUrl(false);
      }
    }
    pushQuery(q);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeSearch(query);
    }
  };

  const handleClear = () => {
    setQuery('');
    pushQuery('');
  };

  const currentCountryObj = SUPPORTED_COUNTRIES.find((c) => c.code === activeCountry) || SUPPORTED_COUNTRIES[0];

  const renderSearch = (idPrefix) => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        executeSearch(query);
      }}
      className="flex w-full items-center"
      role="search"
    >
      <button
        type="submit"
        aria-label="Submit search"
        className="flex shrink-0 items-center justify-center text-[#9a9a9a] transition-colors hover:text-brand"
      >
        {isResolvingUrl ? (
          <svg className="h-4 w-4 animate-spin text-brand" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        )}
      </button>
      <input
        id={`${idPrefix}-search`}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search products or paste any store link..."
        aria-label="Search deals"
        className="ml-2 flex-1 bg-transparent text-[13px] text-[#1a1a1a] placeholder:text-[#9a9a9a] outline-none"
      />
      {!!query && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={handleClear}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#9a9a9a] transition-colors hover:bg-neutral-200 hover:text-[#333]"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </form>
  );

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Announcement strip — festive sale context */}
      <div className="w-full bg-gradient-to-r from-[#FF6B00] via-[#e05d00] to-[#FF6B00]">
        <div className="mx-auto flex w-full max-w-[1720px] 2xl:max-w-[1840px] items-center justify-center px-4 py-1.5 md:px-8">
          <p className="truncate text-[11px] font-black tracking-wide text-white text-center">
            <span className="md:hidden">🔥 Amazon GIF &amp; Flipkart BBD LIVE — Real deals tracked in real-time</span>
            <span className="hidden md:inline">🔥 Amazon Great Indian Festival &amp; Flipkart Big Billion Days are LIVE — Every deal verified against 90-day price history</span>
          </p>
        </div>
      </div>

      {/* Main bar */}
      <div className="w-full border-b border-[#eee] bg-white">
        <div className="mx-auto w-full max-w-[1720px] 2xl:max-w-[1840px] px-4 py-2.5 md:px-8 md:py-3">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex shrink-0 flex-row items-center">
              <Image src="/logo.png" alt="ShoppersDeals Logo" width={32} height={32} className="mr-1.5 h-7 w-7 rounded-md md:mr-2 md:h-8 md:w-8" priority />
              <span className="text-[17px] font-black tracking-tight text-[#1a1a1a] md:text-[20px]">
                Shoppers<span className="text-brand font-black">Deals</span>
              </span>
            </Link>

            {/* Desktop nav */}
            <nav aria-label="Primary" className="hidden shrink-0 items-center gap-0.5 md:flex">
              {NAV_LINKS.map((link) => {
                const isActive = link.match ? link.match(pathname) : pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={getNavHref(link.href)}
                    className={`relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] uppercase tracking-[0.4px] hover:bg-[#f5f5f6] ${
                      isActive ? 'font-black text-[#1a1a1a]' : 'font-bold text-[#6b7280]'
                    }`}
                  >
                    <span>{link.label}</span>
                    {link.href === '/compare' && isClient && compareItems.length > 0 && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-black text-white">
                        {compareItems.length}
                      </span>
                    )}
                    {isActive && <span className="absolute -bottom-0 left-3 right-3 h-[2.5px] rounded-full bg-brand" />}
                  </Link>
                );
              })}
            </nav>

            {/* Desktop search */}
            <div
              className={`hidden h-10 max-w-[560px] xl:max-w-[640px] flex-1 items-center rounded-full border bg-[#f5f5f6] px-4 md:flex ${
                focused ? 'border-brand ring-2 ring-brand/10 bg-white' : 'border-[#e8e8e8]'
              }`}
            >
              {renderSearch('desktop')}
            </div>
            <div className="hidden flex-1 md:!hidden" />

            {/* Right actions */}
            <div className="ml-auto flex shrink-0 items-center gap-1.5 md:ml-0 md:gap-2">
              {/* Country Selector Dropdown */}
              <div className="relative" ref={countryDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsCountryOpen((prev) => !prev)}
                  className="flex items-center gap-1 rounded-full border border-[#e8e8e8] bg-[#f5f5f6] px-2 py-1.5 text-xs font-bold text-[#1a1a1a] transition-all hover:border-brand hover:bg-white md:gap-1.5 md:px-2.5 md:py-1.5"
                  aria-label="Select Country"
                  aria-expanded={isCountryOpen}
                  title="Switch Country / Region"
                >
                  <span className="text-sm leading-none">{currentCountryObj.flag}</span>
                  <span className="hidden uppercase tracking-wider text-[11px] font-black md:inline">{currentCountryObj.code}</span>
                  <svg
                    className={`h-3 w-3 text-neutral-500 transition-transform ${isCountryOpen ? 'rotate-180' : ''}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>

                {isCountryOpen && (
                  <div className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-neutral-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 z-50">
                    <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-400">
                      Region & Currency
                    </div>
                    {SUPPORTED_COUNTRIES.map((c) => {
                      const isSelected = activeCountry === c.code;
                      return (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => handleCountryChange(c.code)}
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-bold transition-colors ${
                            isSelected ? 'bg-orange-50 text-brand font-black' : 'text-neutral-700 hover:bg-neutral-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">{c.flag}</span>
                            <span>{c.label}</span>
                          </div>
                          <span className="text-[10px] font-semibold text-neutral-400">{c.currency}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <Link
                href="/saved"
                className="relative flex h-9 w-9 items-center justify-center rounded-full md:h-auto md:w-auto md:gap-1.5 md:rounded-full md:px-3 md:py-2 md:hover:bg-[#f5f5f6]"
              >
                <span className="relative">
                  <svg width="21" height="21" viewBox="0 0 24 24" fill={pathname === '/saved' ? '#ff6b00' : 'none'} stroke={pathname === '/saved' ? '#ff6b00' : '#4a4a4a'} strokeWidth="2" className="md:h-[19px] md:w-[19px]">
                    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
                  </svg>
                  {savedCount > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-brand px-0.5 text-[9px] font-black text-white">
                      {savedCount > 99 ? '99+' : savedCount}
                    </span>
                  )}
                </span>
                <span className="hidden text-[12px] font-bold text-[#1a1a1a] md:inline">Wishlist</span>
              </Link>

              <Link
                href="/profile"
                className="flex h-9 w-9 items-center justify-center rounded-full md:h-auto md:w-auto md:gap-2 md:rounded-full md:border md:border-[#e8e8e8] md:py-1.5 md:pl-2 md:pr-3.5 md:hover:border-brand"
              >
                {isLoggedIn && user?.picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.picture} alt="Profile avatar" className="h-7 w-7 rounded-full md:h-6 md:w-6" />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f5f5f6] md:h-6 md:w-6">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="#7a7a7a"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></svg>
                  </span>
                )}
                <span className="hidden text-[12px] font-bold text-[#1a1a1a] md:inline">
                  {isLoggedIn ? user?.name?.split(' ')[0] || 'Account' : 'Sign In'}
                </span>
              </Link>
            </div>
          </div>

          {/* Mobile search row */}
          <div className={`mt-2.5 flex h-10 items-center rounded-full border bg-[#f5f5f6] px-4 md:hidden ${focused ? 'border-brand' : 'border-[#e8e8e8]'}`}>
            {renderSearch('mobile')}
          </div>
        </div>
      </div>

      {/* Quick Category Rail Bar */}
      <QuickCategoryRail />
    </header>
  );
}
