'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '@/lib/config';

export default function CompareUrlInput({ className = '' }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  const handleCompare = async (e) => {
    e.preventDefault();
    const clean = url.trim();
    if (!clean) return;

    // Validate that it looks like an e-commerce URL
    const lower = clean.toLowerCase();
    const isSupported = lower.includes('amazon.') || lower.includes('flipkart.') || lower.includes('myntra.') || lower.includes('nykaa.');
    if (!isSupported) {
      setError('Please paste a valid Amazon, Flipkart, Myntra, or Nykaa product link.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/products/compare-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: clean })
      });

      const data = await res.json();
      if (data.success && data.product && (data.product._id || data.product.productId)) {
        const prodId = data.product._id || data.product.productId;
        router.push(`/product/${prodId}`);
      } else {
        setError(data.error || 'Could not resolve product. Please check the URL.');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <form onSubmit={handleCompare} className="relative flex items-center">
        <div className="pointer-events-none absolute left-4 flex items-center text-gray-400">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
          </svg>
        </div>
        <input
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(null); }}
          placeholder="Paste any Amazon, Flipkart, or Myntra product link to compare live prices..."
          className="w-full rounded-2xl border border-gray-200 bg-white py-3.5 pl-11 pr-32 text-xs font-semibold text-gray-800 shadow-sm placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all sm:text-sm"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="absolute right-2 rounded-xl bg-brand px-4 py-2 text-xs font-black text-white shadow-xs hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all"
        >
          {loading ? (
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
              Comparing...
            </span>
          ) : (
            'Compare Prices →'
          )}
        </button>
      </form>
      {error && (
        <p className="mt-2 text-left text-xs font-bold text-red-600 pl-2">
          ⚠️ {error}
        </p>
      )}
    </div>
  );
}
