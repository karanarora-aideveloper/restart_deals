'use client';

import React from 'react';

/**
 * Official vector brand & store logos for ShoppersDeals V2
 * Guaranteed razor-sharp render across all DPRs with zero CDN latency.
 */

export function AmazonLogo({ className = 'h-5 w-auto' }) {
  return (
    <svg className={className} viewBox="0 0 100 30" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* amazon wordmark + smile */}
      <path d="M16.5 17.5c-3.8 0-6.2-2.1-6.2-5.5 0-3.6 2.7-5.4 6.8-5.4 2.2 0 4 .5 5.2 1.1v-1.6c0-2.3-1.6-3.6-4.5-3.6-2.3 0-4.3.7-5.7 1.8l-1.3-2.6C12.8.5 15.4 0 18.5 0c4.9 0 7.8 2.4 7.8 6.8v10.4h-3.2v-2c-1.3 1.4-3.5 2.3-6.6 2.3zm.7-2.6c2.4 0 4.2-1.3 4.9-2.8V9.8c-.9-.4-2.2-.8-3.9-.8-2.6 0-4.3 1.1-4.3 3.1 0 1.7 1.2 2.8 3.3 2.8zM31 17.2V0h3.5v6.5c1.4-1.6 3.5-2.5 5.7-2.5 4.3 0 7.5 3.3 7.5 8.2 0 5-3.2 8.3-7.5 8.3-2.2 0-4.3-.9-5.7-2.5v7.8H31zm8.3-2.6c2.8 0 4.9-2.1 4.9-5.3 0-3.2-2.1-5.3-4.9-5.3-2.8 0-4.9 2.1-4.9 5.3 0 3.2 2.1 5.3 4.9 5.3z" fill="#111827"/>
      {/* Orange smile curve */}
      <path d="M5.5 22.8c18.5 7.8 45.2 5.5 61.2-4.2 1.2-.7 2.3 1 1.2 1.9-17.5 10.6-46.6 13-64 4.3-1.2-.6.4-2.5 1.6-2z" fill="#FF9900"/>
      <path d="M69.8 19.3c-.8 1.4-2.4 2.8-4.2 3.6-.3.1-.6-.2-.4-.5 1-1.3 2.6-3.7 2.8-5.3.1-.3.4-.4.6-.2 1 1 2.8 2 4.4 2.5.4.1.4.6.1.7-1.1.4-2.4-.1-3.3-.8z" fill="#FF9900"/>
    </svg>
  );
}

export function FlipkartLogo({ className = 'h-5 w-auto' }) {
  return (
    <svg className={className} viewBox="0 0 110 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Flipkart 'F' shopping bag */}
      <rect x="2" y="2" width="28" height="28" rx="7" fill="#2874F0"/>
      <path d="M12 9h11v3.2h-6.8v3.1h5.8v3.1h-5.8v5.8H12V9z" fill="#FFE500"/>
      <path d="M19 18.4l3.5 4.8h-3.8l-2.4-3.5v3.5h-1.5v-4.8h4.2z" fill="#FFE500" opacity="0.9"/>
      {/* Wordmark */}
      <text x="35" y="22" fontFamily="sans-serif" fontSize="17" fontStyle="italic" fontWeight="900" fill="#2874F0">Flipkart</text>
    </svg>
  );
}

export function MyntraLogo({ className = 'h-5 w-auto' }) {
  return (
    <svg className={className} viewBox="0 0 100 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Myntra Colorful Geometric M */}
      <path d="M3 18.5L9.5 8l6.5 10.5h-4.2L9.5 14.8l-2.3 3.7H3z" fill="#FF3F6C"/>
      <path d="M9.5 18.5L16 8l6.5 10.5h-4.2L16 14.8l-2.3 3.7H9.5z" fill="#F26A10"/>
      <text x="26" y="19" fontFamily="sans-serif" fontSize="16" fontWeight="900" fill="#282C3F" letterSpacing="0.5">Myntra</text>
    </svg>
  );
}

export function NykaaLogo({ className = 'h-5 w-auto' }) {
  return (
    <svg className={className} viewBox="0 0 95 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text x="2" y="20" fontFamily="sans-serif" fontSize="20" fontStyle="italic" fontWeight="900" fill="#FC2779" letterSpacing="0.8">NYKAA</text>
      <circle cx="88" cy="10" r="3" fill="#FC2779" />
    </svg>
  );
}

export function AjioLogo({ className = 'h-5 w-auto' }) {
  return (
    <svg className={className} viewBox="0 0 80 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="80" height="28" rx="6" fill="#2C4152"/>
      <text x="14" y="19" fontFamily="sans-serif" fontSize="15" fontWeight="900" fill="#FFFFFF" letterSpacing="3">AJIO</text>
    </svg>
  );
}

export function MeeshoLogo({ className = 'h-5 w-auto' }) {
  return (
    <svg className={className} viewBox="0 0 100 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="4" width="20" height="20" rx="6" fill="#9B287B"/>
      <path d="M6 18V10l3.5 4 3.5-4v8h-2v-4.5l-1.5 1.8-1.5-1.8V18H6z" fill="#FFFFFF"/>
      <text x="27" y="19" fontFamily="sans-serif" fontSize="16" fontWeight="900" fill="#9B287B">meesho</text>
    </svg>
  );
}

export function CromaLogo({ className = 'h-5 w-auto' }) {
  return (
    <svg className={className} viewBox="0 0 90 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="14" r="7" fill="#00E9BF" />
      <text x="22" y="19" fontFamily="sans-serif" fontSize="16" fontWeight="900" fill="#121212">croma</text>
    </svg>
  );
}

/* ═══════════ OFFICIAL BRAND LOGOS (Deals by Brands) ═══════════ */

export function AppleLogo({ className = 'h-6 w-auto' }) {
  return (
    <svg className={className} viewBox="0 0 170 170" fill="currentColor">
      <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.67-7.81-11.96-14.34-8.24-12.61-14.46-27.18-18.66-43.72-4.2-16.54-4.23-31.55-.09-45.02 4.14-13.47 11.07-24.16 20.79-32.08 9.72-7.92 20.89-11.99 33.52-12.22 5.09 0 10.8 1.25 17.13 3.75 6.33 2.5 10.3 3.86 11.91 4.09 2.05-.34 6.31-1.8 12.78-4.37 6.47-2.58 12.35-3.69 17.65-3.35 13.91.82 25.15 5.86 33.72 15.13-12.16 7.4-18.11 17.47-17.85 30.22.26 10.12 4.12 18.6 11.58 25.43 7.46 6.83 16.32 10.66 26.58 11.48-2.61 7.84-5.93 15.75-9.97 23.73zM119.22 31.81c0-7.39 2.65-14.52 7.95-21.39 5.3-6.87 11.99-10.42 20.08-10.65.13 1.02.19 1.93.19 2.73 0 7.27-2.79 14.4-8.37 21.39-5.58 6.99-12.28 10.74-20.1 11.25-.25-1.02-.37-2.13-.37-3.33z"/>
    </svg>
  );
}

export function SamsungLogo({ className = 'h-5 w-auto' }) {
  return (
    <svg className={className} viewBox="0 0 140 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="70" cy="16" rx="68" ry="15" fill="#1428A0" />
      <text x="18" y="21" fontFamily="sans-serif" fontSize="13" fontWeight="900" fill="#FFFFFF" letterSpacing="2">SAMSUNG</text>
    </svg>
  );
}

export function SonyLogo({ className = 'h-4 w-auto' }) {
  return (
    <svg className={className} viewBox="0 0 100 24" fill="currentColor">
      <text x="2" y="19" fontFamily="serif" fontSize="22" fontWeight="900" letterSpacing="4">SONY</text>
    </svg>
  );
}

export function BoatLogo({ className = 'h-5 w-auto' }) {
  return (
    <svg className={className} viewBox="0 0 90 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* boAt iconic red sail triangle */}
      <path d="M12 4L4 18h16L12 4z" fill="#E50914" />
      <text x="26" y="20" fontFamily="sans-serif" fontSize="17" fontWeight="900" fill="#111827">bo<tspan fill="#E50914">A</tspan>t</text>
    </svg>
  );
}

export function OnePlusLogo({ className = 'h-5 w-auto' }) {
  return (
    <svg className={className} viewBox="0 0 110 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="24" height="24" rx="4" fill="#F5010C" />
      <text x="8" y="19" fontFamily="sans-serif" fontSize="16" fontWeight="900" fill="#FFFFFF">1+</text>
      <text x="32" y="19" fontFamily="sans-serif" fontSize="14" fontWeight="800" fill="#111827" letterSpacing="0.5">ONEPLUS</text>
    </svg>
  );
}

export function NikeLogo({ className = 'h-5 w-auto' }) {
  return (
    <svg className={className} viewBox="0 0 100 36" fill="currentColor">
      <path d="M96.4 7.2c-15.5 8.2-34.6 20.3-46.7 26.5-6.7 3.4-14.8 4.7-22.1 2.8-8.2-2.1-13.8-7.7-15.5-15.5-1.4-6.4.3-12.8 4.6-17.5 4.3-4.7 10.6-7.2 17.3-6.9 12.3.6 27.5 7.6 39.5 13.9-10.4-3.5-22.3-6.7-32.8-6.1-4.8.3-9.3 2-12.3 5.3-2.9 3.2-4.1 7.6-3.1 11.9 1.1 5.3 4.9 9.1 10.5 10.5 5 1.3 10.6.4 15.2-1.9 11.2-5.7 31.8-18.7 45.4-23z"/>
    </svg>
  );
}

export function PumaLogo({ className = 'h-5 w-auto' }) {
  return (
    <svg className={className} viewBox="0 0 100 40" fill="currentColor">
      {/* Leaping Puma cat */}
      <path d="M78 8c-3.5 2-8 3-12 1.5-5-2-8.5-6-13-8-4-1.8-9-1.5-13 1-5 3-8 8.5-11 13.5-2 3.5-4.5 7-8 9-4 2.5-9 3-13.5 2-2-.5-4-1-6-1.5 3 4 8 7 13 8 7 1.5 14-.5 19-5 3.5-3 6.5-7 10-10 3.5-3 8-5 13-4.5 4.5.5 8.5 3 12 6.5 4 4 7 9 11 13 2 2 4.5 3.5 7.5 4-1.5-3-3-6-4.5-9-2.5-5-4.5-10-6.5-15-1.5-3.5-2.5-7.5-5-10.5z"/>
    </svg>
  );
}

export function MaybellineLogo({ className = 'h-4 w-auto' }) {
  return (
    <svg className={className} viewBox="0 0 130 20" fill="currentColor">
      <text x="2" y="16" fontFamily="sans-serif" fontSize="13" fontWeight="900" letterSpacing="1.5">MAYBELLINE</text>
    </svg>
  );
}

export function AsusLogo({ className = 'h-4 w-auto' }) {
  return (
    <svg className={className} viewBox="0 0 90 20" fill="#00539B">
      <text x="2" y="17" fontFamily="sans-serif" fontSize="18" fontWeight="900" fontStyle="italic" letterSpacing="2">ASUS</text>
    </svg>
  );
}

export function PhilipsLogo({ className = 'h-4 w-auto' }) {
  return (
    <svg className={className} viewBox="0 0 100 24" fill="#0B5FFF">
      <text x="2" y="19" fontFamily="sans-serif" fontSize="17" fontWeight="900" letterSpacing="2">PHILIPS</text>
    </svg>
  );
}

export function MamaearthLogo({ className = 'h-5 w-auto' }) {
  return (
    <svg className={className} viewBox="0 0 110 24" fill="none">
      <text x="2" y="18" fontFamily="sans-serif" fontSize="15" fontWeight="900" fill="#00A651" letterSpacing="0.5">mama<tspan fill="#333333">earth</tspan></text>
      <circle cx="102" cy="8" r="3" fill="#00A651" />
    </svg>
  );
}

export function LevisLogo({ className = 'h-5 w-auto' }) {
  return (
    <svg className={className} viewBox="0 0 70 28" fill="none">
      {/* Red batwing */}
      <path d="M2 4h66v14c-11 5-22 2-33 6-11-4-22-1-33-6V4z" fill="#C41230"/>
      <text x="14" y="16" fontFamily="sans-serif" fontSize="11" fontWeight="900" fill="#FFFFFF" letterSpacing="1.5">Levi&apos;s</text>
    </svg>
  );
}

/**
 * Universal Store Logo Resolver
 */
export function renderStoreLogo(merchantName, className = 'h-4 w-auto') {
  const m = (merchantName || '').toLowerCase();
  if (m.includes('amazon')) return <AmazonLogo className={className} />;
  if (m.includes('flipkart') || m.includes('shopsy')) return <FlipkartLogo className={className} />;
  if (m.includes('myntra')) return <MyntraLogo className={className} />;
  if (m.includes('nykaa')) return <NykaaLogo className={className} />;
  if (m.includes('ajio')) return <AjioLogo className={className} />;
  if (m.includes('meesho')) return <MeeshoLogo className={className} />;
  if (m.includes('croma')) return <CromaLogo className={className} />;
  return (
    <span className="text-xs font-black uppercase tracking-wider text-slate-800">
      {merchantName || 'Store'}
    </span>
  );
}

/**
 * Universal Brand Logo Resolver
 */
export function renderBrandLogo(brandId, className = 'h-5 w-auto') {
  const b = (brandId || '').toLowerCase();
  if (b.includes('apple')) return <AppleLogo className={className} />;
  if (b.includes('samsung')) return <SamsungLogo className={className} />;
  if (b.includes('sony')) return <SonyLogo className={className} />;
  if (b.includes('boat')) return <BoatLogo className={className} />;
  if (b.includes('oneplus')) return <OnePlusLogo className={className} />;
  if (b.includes('nike')) return <NikeLogo className={className} />;
  if (b.includes('puma')) return <PumaLogo className={className} />;
  if (b.includes('maybelline')) return <MaybellineLogo className={className} />;
  if (b.includes('asus')) return <AsusLogo className={className} />;
  if (b.includes('philips')) return <PhilipsLogo className={className} />;
  if (b.includes('mamaearth')) return <MamaearthLogo className={className} />;
  if (b.includes('levi')) return <LevisLogo className={className} />;
  return <span className="text-xs font-bold text-slate-700">{brandId}</span>;
}
