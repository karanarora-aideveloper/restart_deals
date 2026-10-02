'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

const SLIDES = [
  {
    id: 'festival',
    tag: '🔥 MEGA FESTIVAL DEALS',
    tagColor: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
    title: 'Up to 85% Off + Extra 7% Real Cashback',
    subtitle: 'Amazon & Flipkart: Autonomous price radar detects genuine drops on iPhone, Samsung S24, Laptops & Smart TVs.',
    badge: '🎁 Flat ₹1,500 Extra Reward on Bank Offers',
    ctaText: 'Explore Verified Deals',
    ctaHref: '#deals',
    bgGradient: 'from-[#1E1B4B] via-[#2E2875] to-[#B45309]',
    icon: '⚡',
  },
  {
    id: 'credit-cards',
    tag: '💳 EXCLUSIVE BANK REWARDS',
    tagColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
    title: 'Top Cashback Credit Cards + Flat ₹2,000 Reward',
    subtitle: 'Flipkart Axis, Amazon Pay ICICI & Swiggy HDFC: 5% to 10% unlimited cashback on every online order.',
    badge: '🎉 Lifetime Free • Instant Digital Approval • No Fee',
    ctaText: 'Find Your Best Card',
    ctaHref: '#credit-cards',
    bgGradient: 'from-[#0B132B] via-[#1C2541] to-[#059669]',
    icon: '💳',
  },
  {
    id: 'fashion',
    tag: '👗 FASHION & LIFESTYLE',
    tagColor: 'bg-pink-500/20 text-pink-300 border-pink-400/30',
    title: '50% - 80% Off Brands + Extra 8.5% Cashback',
    subtitle: 'Myntra, Nykaa & Ajio: Nike, Puma, Levi\'s, Maybelline & MAC verified against 90-day selling baselines.',
    badge: '🛍️ Verified Against 90-Day Selling History',
    ctaText: 'Shop Fashion Deals',
    ctaHref: '#deals',
    bgGradient: 'from-[#2A0845] via-[#6441A5] to-[#BE185D]',
    icon: '💄',
  },
  {
    id: 'grocery',
    tag: '🛒 10-MINUTE GROCERY TRACKER',
    tagColor: 'bg-teal-500/20 text-teal-300 border-teal-400/30',
    title: 'Blinkit vs Zepto vs Instamart Price Compare',
    subtitle: 'Compare daily milk, fruits, atta & snacks across quick-commerce apps. Pick the lowest basket price in 5s.',
    badge: '💰 Save up to ₹4,500 every month on grocery',
    ctaText: 'Compare Grocery Now',
    ctaHref: '/compare?cat=grocery',
    bgGradient: 'from-[#022C22] via-[#065F46] to-[#0D9488]',
    icon: '🛒',
  },
];

export default function V3HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (isPaused) return;
    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(timerRef.current);
  }, [isPaused]);

  const slide = SLIDES[current];

  return (
    <section
      className="mx-auto max-w-[1720px] 2xl:max-w-[1840px] px-4 sm:px-6 lg:px-8 xl:px-12 mt-4 mb-6"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-r ${slide.bgGradient} p-6 sm:p-8 md:p-10 text-white shadow-xl transition-all duration-500`}>
        {/* Ambient lighting orb */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 min-w-0">
          {/* Left Text Block */}
          <div className="max-w-2xl min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wider ${slide.tagColor}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                <span>{slide.tag}</span>
              </span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white/90">
                {slide.badge}
              </span>
            </div>

            <h2 className="mt-3 text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white leading-tight">
              {slide.title}
            </h2>

            <p className="mt-2 text-xs sm:text-sm md:text-base text-slate-100/90 leading-relaxed">
              {slide.subtitle}
            </p>

            {/* CTAs */}
            <div className="mt-5 flex items-center gap-3 flex-wrap">
              <Link
                href={slide.ctaHref}
                className="flex items-center gap-2 rounded-2xl bg-white px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-black text-slate-950 shadow-md transition-all hover:bg-slate-100 hover:scale-105 active:scale-95"
              >
                <span>{slide.ctaText}</span>
                <span className="text-sm font-bold">→</span>
              </Link>

              <span className="text-[11px] text-white/80 font-semibold hidden sm:inline">
                CashKaro + Buyhatke Best-of-Both Engine
              </span>
            </div>
          </div>

          {/* Right Icon Graphic */}
          <div className="hidden lg:flex shrink-0 items-center justify-center">
            <div className="flex h-32 w-32 items-center justify-center rounded-3xl bg-white/10 border border-white/20 text-6xl shadow-2xl backdrop-blur-xs">
              {slide.icon}
            </div>
          </div>
        </div>

        {/* Carousel Navigation Bar (Bottom) */}
        <div className="relative z-10 mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
          {/* Dots Indicator */}
          <div className="flex items-center gap-2">
            {SLIDES.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setCurrent(idx)}
                className={`h-2 rounded-full transition-all ${
                  current === idx ? 'w-8 bg-white' : 'w-2 bg-white/40 hover:bg-white/70'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          {/* Arrows */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrent((prev) => (prev - 1 + SLIDES.length) % SLIDES.length)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20 active:scale-90"
              aria-label="Previous Slide"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => setCurrent((prev) => (prev + 1) % SLIDES.length)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20 active:scale-90"
              aria-label="Next Slide"
            >
              →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
