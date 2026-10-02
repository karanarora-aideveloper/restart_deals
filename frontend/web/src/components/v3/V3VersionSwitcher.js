'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function V3VersionSwitcher() {
  const pathname = usePathname();

  return (
    <aside aria-label="Version Preview Switcher" className="sticky top-0 z-50 w-full border-b border-indigo-950/20 bg-[#1E1B4B] px-3 py-2 text-white shadow-md">
      <div className="mx-auto flex w-full max-w-[1720px] 2xl:max-w-[1840px] flex-col sm:flex-row items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="rounded-md bg-indigo-500/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-200">
            Competitor Clone Preview
          </span>
          <span className="font-bold text-slate-100 hidden md:inline">
            ⚡ Buyhatke Exact Architecture &amp; Aesthetic Clone (V3)
          </span>
        </div>

        {/* 3-Way Switcher Tabs */}
        <div className="flex items-center gap-1.5 rounded-xl bg-white/10 p-1">
          <Link
            href="/"
            className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition-all ${
              pathname === '/'
                ? 'bg-brand text-white shadow-xs'
                : 'text-indigo-200 hover:bg-white/10 hover:text-white'
            }`}
          >
            V1 Live (/)
          </Link>
          <Link
            href="/v2"
            className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition-all ${
              pathname === '/v2'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-indigo-200 hover:bg-white/10 hover:text-white'
            }`}
          >
            V2 Refined (/v2)
          </Link>
          <Link
            href="/v3"
            className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition-all ${
              pathname === '/v3'
                ? 'bg-[#5855E5] text-white shadow-xs'
                : 'text-indigo-200 hover:bg-white/10 hover:text-white'
            }`}
          >
            V3 Buyhatke Clone (/v3) ★
          </Link>
        </div>
      </div>
    </aside>
  );
}
