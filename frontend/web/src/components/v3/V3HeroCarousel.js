'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  AmazonLogo,
  FlipkartLogo,
  MyntraLogo,
  NykaaLogo,
  AjioLogo,
  ShopsyLogo,
  BlinkitLogo,
  CromaLogo,
} from '@/components/BrandAndStoreLogos';

const SLIDES = [
  {
    id: 'deal-radar',
    tabLabel: 'Deal Radar',
    icon: '🔥',
    tag: '🔥 24/7 AUTONOMOUS DEAL RADAR',
    tagColor: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
    title: 'Empirical Price History Tracker with Zero Fake Discounts',
    subtitle: 'Our dual-engine radar monitors 50,000+ products across 30+ top stores including Amazon & Flipkart, comparing live prices against 90-day real selling history to eliminate fake "sale" discounts.',
    badge: '📉 100% Empirical Selling Baselines',
    ctaText: 'Explore Verified Drops',
    ctaHref: '#deals',
    bgGradient: 'from-[#0F172A] via-[#1E1B4B] to-[#92400E]',
    glowColor: 'bg-amber-500/20',
    image: '/carousel/festival.jpg',
    floatingBadge: '🛡️ Zero Fake MRP Inflation',
    monitoredStores: ['amazon', 'flipkart'],
  },
  {
    id: 'bank-offers',
    tabLabel: 'Card Offers',
    icon: '💳',
    tag: '💳 BANK OFFERS & COUPONS RADAR',
    tagColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
    title: 'Uncover Active Bank Offers & Eligible Card Discounts',
    subtitle: 'We scan and surface active HDFC, ICICI, SBI & Axis bank promotions, hidden coupon codes, and reward point opportunities across top stores so you never checkout at full price.',
    badge: '🔍 Real-Time Card & Coupon Radar (Find Max Savings)',
    ctaText: 'Explore Card Offers',
    ctaHref: '/credit-cards',
    bgGradient: 'from-[#0B132B] via-[#064E3B] to-[#047857]',
    glowColor: 'bg-emerald-500/20',
    image: '/carousel/cards.jpg',
    floatingBadge: '🔍 Active Bank Offer Radar',
    monitoredStores: ['amazon', 'flipkart', 'croma'],
  },
  {
    id: 'tech-drops',
    tabLabel: 'Tech Drops',
    icon: '📱',
    tag: '📱 FLAGSHIP TECH & GADGET DROPS',
    tagColor: 'bg-sky-500/20 text-sky-300 border-sky-400/30',
    title: 'Track Flagship Phones, MacBooks & Smart TVs',
    subtitle: 'Catch authentic price crashes on Apple iPhone, Samsung Galaxy, OnePlus, Sony headphones & M-series laptops with instant Telegram & WebPush alerts.',
    badge: '⚡ Set One-Click Price Drop Alerts for Free',
    ctaText: 'Browse Tech Drops',
    ctaHref: '/categories/electronics',
    bgGradient: 'from-[#030712] via-[#1E293B] to-[#1D4ED8]',
    glowColor: 'bg-sky-500/20',
    image: '/carousel/tech.jpg',
    floatingBadge: '📉 90-Day Low Detected',
    monitoredStores: ['amazon', 'flipkart', 'croma'],
  },
  {
    id: 'fashion-beauty',
    tabLabel: 'Fashion & Beauty',
    icon: '👗',
    tag: '💄 FASHION & BEAUTY FINDER',
    tagColor: 'bg-pink-500/20 text-pink-300 border-pink-400/30',
    title: 'Curated Drops Across Myntra, Nykaa & Ajio',
    subtitle: 'Track authenticated price cuts on Nike, Puma, Levi\'s, Maybelline & MAC across sizes and cosmetics shades without misleading MRP inflation.',
    badge: '🛍️ Multi-Store Variant & Shade Tracker',
    ctaText: 'Shop Fashion & Beauty',
    ctaHref: '/categories/fashion',
    bgGradient: 'from-[#1E0528] via-[#4A0E4E] to-[#BE185D]',
    glowColor: 'bg-pink-500/20',
    image: '/carousel/fashion.jpg',
    floatingBadge: '✨ Multi-Shade Price Match',
    monitoredStores: ['myntra', 'nykaa', 'ajio'],
  },
  {
    id: 'quick-grocery',
    tabLabel: 'Quick Grocery',
    icon: '🛒',
    tag: '🛒 10-MIN QUICK-COMMERCE COMPARISON',
    tagColor: 'bg-teal-500/20 text-teal-300 border-teal-400/30',
    title: 'Compare Grocery Baskets: Blinkit vs Zepto vs Instamart',
    subtitle: 'Compare daily milk, fruits, atta, staples & snacks side-by-side across 10-minute delivery apps. Pick the lowest basket price in 5 seconds.',
    badge: '💰 Stop Overpaying for 10-Minute Deliveries',
    ctaText: 'Compare Grocery Baskets',
    ctaHref: '/compare/grocery',
    bgGradient: 'from-[#022C22] via-[#064E3B] to-[#0D9488]',
    glowColor: 'bg-teal-500/20',
    image: '/carousel/grocery.jpg',
    floatingBadge: '⚡ 10-Min Fast Compare',
    monitoredStores: ['blinkit'],
  },
  {
    id: 'flash-loot',
    tabLabel: 'Flash Loot',
    icon: '⚡',
    tag: '⚡ LIGHTNING LOOT & CLEARANCE',
    tagColor: 'bg-orange-500/20 text-orange-300 border-orange-400/30',
    title: 'Under ₹499 & Extreme Price Crash Radar',
    subtitle: 'Autonomous Engine 1 catches seller clearance stock, lightning deals, and genuine flash crashes across 30+ top stores before stock runs out.',
    badge: '⏱️ Real-Time Telegram & Push Alerts (<30s Speed)',
    ctaText: 'Explore Flash Loot',
    ctaHref: '/loot',
    bgGradient: 'from-[#18181B] via-[#450A0A] to-[#EA580C]',
    glowColor: 'bg-orange-500/20',
    image: '/carousel/loot.jpg',
    floatingBadge: '🔥 High-Velocity Loot Drop',
    monitoredStores: ['amazon', 'flipkart', 'shopsy'],
  },
];

export default function V3HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);
  const touchStartX = useRef(null);

  // 5-second automatic progression with pause support
  useEffect(() => {
    if (isPaused) return;
    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(timerRef.current);
  }, [isPaused, current]);

  const slide = SLIDES[current];

  // Mobile Touch Swipe Handling
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    if (diff > 50) {
      setCurrent((prev) => (prev + 1) % SLIDES.length);
    } else if (diff < -50) {
      setCurrent((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
    }
    touchStartX.current = null;
  };

  return (
    <section
      className={`relative w-full overflow-hidden bg-gradient-to-r ${slide.bgGradient} text-white shadow-md transition-all duration-700 mb-4 sm:mb-6 select-none`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <style>{`
        @keyframes carouselProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
        @keyframes heroFadeIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-hero-fade {
          animation: heroFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Ambient Radial Backlight Glow */}
      <div className={`pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full ${slide.glowColor} blur-3xl transition-all duration-700`} />
      <div className="pointer-events-none absolute -left-20 -bottom-20 h-96 w-96 rounded-full bg-black/25 blur-3xl" />

      {/* Floating Prev/Next Buttons with Sleek SVG Chevrons */}
      <button
        type="button"
        onClick={() => setCurrent((prev) => (prev - 1 + SLIDES.length) % SLIDES.length)}
        className="group absolute left-2 sm:left-4 lg:left-6 top-1/2 -translate-y-1/2 z-20 flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-slate-950/40 hover:bg-white text-white hover:text-slate-950 backdrop-blur-md border border-white/20 hover:border-white shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
        aria-label="Previous Slide"
      >
        <svg
          className="h-4 w-4 sm:h-5 sm:w-5 transition-transform duration-200 group-hover:-translate-x-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => setCurrent((prev) => (prev + 1) % SLIDES.length)}
        className="group absolute right-2 sm:right-4 lg:right-6 top-1/2 -translate-y-1/2 z-20 flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-slate-950/40 hover:bg-white text-white hover:text-slate-950 backdrop-blur-md border border-white/20 hover:border-white shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
        aria-label="Next Slide"
      >
        <svg
          className="h-4 w-4 sm:h-5 sm:w-5 transition-transform duration-200 group-hover:translate-x-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* Main Content Area */}
      <div className="mx-auto w-full max-w-[1360px] 2xl:max-w-[1440px] px-12 sm:px-16 lg:px-20 py-5 sm:py-7 md:py-8 lg:py-10">
        <div key={slide.id} className="animate-hero-fade relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 min-w-0">
          {/* Left Text Block */}
          <div className="max-w-xl lg:max-w-2xl min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-2xs ${slide.tagColor}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                <span>{slide.tag}</span>
              </span>
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold text-white/90 backdrop-blur-xs">
                {slide.badge}
              </span>
            </div>

            <h2 className="mt-2.5 text-xl sm:text-2xl md:text-3xl lg:text-[32px] font-black tracking-tight text-white leading-tight">
              {slide.title}
            </h2>

            <p className="mt-2.5 text-xs sm:text-sm text-slate-100/95 leading-relaxed max-w-xl">
              {slide.subtitle}
            </p>

            {/* Action Row */}
            <div className="mt-5 flex items-center gap-3.5 flex-wrap">
              <Link
                href={slide.ctaHref}
                className="group flex items-center gap-2 rounded-xl bg-white px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-black text-slate-950 shadow-lg shadow-black/20 transition-all hover:bg-slate-100 hover:scale-105 active:scale-95"
              >
                <span>{slide.ctaText}</span>
                <svg
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </Link>

              {/* Monitored Store Pill Badges */}
              <div className="flex items-center gap-2 bg-black/35 backdrop-blur-md rounded-xl px-3 py-1.5 border border-white/15">
                <span className="text-[10px] text-white/80 font-bold uppercase tracking-wider">Stores:</span>
                <div className="flex items-center gap-2 bg-white/95 rounded-lg px-2 py-0.5">
                  {slide.monitoredStores.includes('amazon') && <AmazonLogo className="h-3 w-auto" />}
                  {slide.monitoredStores.includes('flipkart') && <FlipkartLogo className="h-3 w-auto" />}
                  {slide.monitoredStores.includes('myntra') && <MyntraLogo className="h-3 w-auto" />}
                  {slide.monitoredStores.includes('nykaa') && <NykaaLogo className="h-3 w-auto" />}
                  {slide.monitoredStores.includes('ajio') && <AjioLogo className="h-3 w-auto" />}
                  {slide.monitoredStores.includes('shopsy') && <ShopsyLogo className="h-3 w-auto" showText={false} />}
                  {slide.monitoredStores.includes('croma') && <CromaLogo className="h-3 w-auto" />}
                  {slide.monitoredStores.includes('blinkit') && <BlinkitLogo className="h-3 w-auto" />}
                </div>
              </div>
            </div>
          </div>

          {/* Right Illustrated Graphic Banner */}
          <div className="hidden md:flex shrink-0 items-center justify-center">
            <div className="relative w-72 lg:w-96 xl:w-[440px] aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-black/30 group">
              <img
                src={slide.image}
                alt={slide.title}
                className="w-full h-full object-cover object-center transform transition-transform duration-700 group-hover:scale-105"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />

              {/* Floating Top-Right Pill on Banner */}
              <div className="absolute top-3 right-3 z-10 rounded-full bg-black/60 backdrop-blur-md border border-white/25 px-2.5 py-1 text-[10px] font-bold text-white shadow-md">
                {slide.floatingBadge}
              </div>

              {/* Bottom Subtle Caption */}
              <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between text-[11px] text-white/90 font-medium">
                <span className="flex items-center gap-1.5 drop-shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  Live Radar Active
                </span>
                <span className="text-[10px] text-white/75 bg-white/20 backdrop-blur-xs px-2 py-0.5 rounded-full">
                  50,000+ Products
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Carousel Interactive Progress Bar Navigation */}
        <div className="relative z-10 mt-6 pt-4 border-t border-white/10">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
            {SLIDES.map((s, idx) => {
              const isActive = current === idx;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setCurrent(idx)}
                  className={`flex flex-col text-left p-1.5 sm:p-2 rounded-xl transition-all cursor-pointer ${
                    isActive ? 'bg-white/15 text-white shadow-xs' : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                  aria-label={`Go to slide ${s.tabLabel}`}
                >
                  <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
                    <span className="text-xs sm:text-sm shrink-0">{s.icon}</span>
                    <span className="text-[11px] sm:text-xs font-bold truncate">{s.tabLabel}</span>
                  </div>
                  <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
                    {isActive ? (
                      <div
                        key={`progress-${idx}`}
                        className="h-full bg-white rounded-full"
                        style={{
                          animation: 'carouselProgress 5s linear forwards',
                          animationPlayState: isPaused ? 'paused' : 'running',
                        }}
                      />
                    ) : (
                      <div className="h-full bg-transparent" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
