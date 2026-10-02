'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ScanInputClient({ initialUrl = '' }) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const clean = url.trim();
    if (!clean) return;

    setLoading(true);
    router.push(`/scan?url=${encodeURIComponent(clean)}`);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col sm:flex-row items-center gap-2">
        <div className="relative w-full">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste any product link (Amazon, Flipkart, Meesho, Myntra...)"
            required
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all shadow-inner"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="w-full sm:w-auto shrink-0 rounded-2xl bg-indigo-600 px-6 py-3.5 text-xs sm:text-sm font-black text-white shadow-md hover:bg-indigo-700 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>Scanning…</span>
            </>
          ) : (
            <>
              <span>⚡ Find Best Price</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
