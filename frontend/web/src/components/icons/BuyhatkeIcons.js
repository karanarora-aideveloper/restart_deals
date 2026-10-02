import React from 'react';

export function ShieldTrustIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8.125 0.483C8.007 0.371 7.821 0.372 7.705 0.485L2.304 2.505C2.132 2.508 2 2.642 2 2.807V7.719C2 9.959 3.488 11.791 4.91 13.035C5.627 13.662 6.343 14.155 6.879 14.49C7.147 14.657 7.371 14.786 7.528 14.874L7.863 15.012C7.931 15.019 7.95 15.017 7.968 15.011L8.142 14.951C8.297 14.874 8.685 14.657 8.953 14.49C9.489 14.155 10.205 13.662 10.922 13.035C12.344 11.791 13.833 9.959 13.833 7.719V2.807C13.833 2.642 13.7 2.508 13.536 2.505L8.125 0.483Z"
        fill="url(#paint0_shield)"
        stroke="url(#paint1_shield)"
        strokeWidth="0.8"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.141 6.094C8.004 5.316 9.162 5.093 10.067 5.63C11.256 6.336 11.557 8.089 10.739 9.546C9.921 11.003 8.293 11.611 7.103 10.905C6.829 10.743 6.602 10.524 6.425 10.267L6.317 10.898C6.303 10.975 6.236 11.032 6.158 11.032H4.991C4.891 11.032 4.815 10.942 4.832 10.843L6.125 3.313C6.136 3.248 6.193 3.199 6.26 3.199H7.53C7.587 3.199 7.63 3.251 7.62 3.306L7.141 6.094ZM9.28 7.091C8.76 6.593 7.871 6.705 7.294 7.341C6.717 7.977 6.67 8.897 7.189 9.395C7.709 9.893 8.598 9.781 9.175 9.145C9.753 8.508 9.8 7.589 9.28 7.091Z"
        fill="white"
      />
      <defs>
        <linearGradient id="paint0_shield" x1="7.916" y1="2.8" x2="7.916" y2="15.42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00422C" />
          <stop offset="1" stopColor="#34C37C" />
        </linearGradient>
        <linearGradient id="paint1_shield" x1="7.916" y1="0" x2="7.916" y2="15.42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00271A" />
          <stop offset="1" stopColor="#61D099" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function HeroWaveBanner({ className = "w-full" }) {
  return (
    <svg width="100%" height="24" viewBox="0 0 1440 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} preserveAspectRatio="none">
      <path
        d="M0 0C240 18 480 24 720 18C960 12 1200 18 1440 0V24H0V0Z"
        fill="white"
      />
    </svg>
  );
}

export function ShoppingCookieMascot({ className = "w-48 sm:w-64 h-auto" }) {
  return (
    <svg viewBox="0 0 400 200" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="mascotGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
        <linearGradient id="glowGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FACC15" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
        </linearGradient>
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#4F46E5" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* Glow aura */}
      <circle cx="200" cy="100" r="85" fill="url(#glowGrad)" />

      {/* Main floating shopping assistant pod */}
      <g filter="url(#shadow)">
        <rect x="110" y="35" width="180" height="130" rx="36" fill="url(#mascotGrad)" />
        <rect x="113" y="38" width="174" height="124" rx="33" stroke="white" strokeOpacity="0.25" strokeWidth="2" />
      </g>

      {/* Screen / Visor */}
      <rect x="135" y="60" width="130" height="65" rx="20" fill="#0F172A" />
      
      {/* Eyes with cheerful blink */}
      <ellipse cx="170" cy="90" rx="10" ry="14" fill="#38BDF8" />
      <circle cx="173" cy="85" r="4" fill="white" />
      <ellipse cx="230" cy="90" rx="10" ry="14" fill="#38BDF8" />
      <circle cx="233" cy="85" r="4" fill="white" />

      {/* Price tag badge in hand */}
      <g transform="translate(65, 75) rotate(-15)">
        <rect width="60" height="38" rx="10" fill="#10B981" />
        <circle cx="12" cy="19" r="4" fill="white" />
        <text x="24" y="24" fill="white" fontSize="14" fontWeight="900" fontFamily="sans-serif">₹ LOW</text>
      </g>

      {/* Sparkles */}
      <path d="M310 50L315 62L327 67L315 72L310 84L305 72L293 67L305 62Z" fill="#FACC15" />
      <path d="M90 120L93 128L101 131L93 134L90 142L87 134L79 131L87 128Z" fill="#FACC15" />
      <circle cx="310" cy="130" r="6" fill="#F43F5E" />
      <circle cx="100" cy="45" r="5" fill="#38BDF8" />
    </svg>
  );
}
