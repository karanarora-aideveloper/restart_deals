import React from 'react';
import { generateProductAIVerdict, extractProductSpecs } from '@/lib/specExtractor';

export default function ProductAIVerdictCard({ product }) {
  if (!product) return null;

  const specs = extractProductSpecs(product);
  const verdict = specs.aiVerdict || generateProductAIVerdict(product, specs);

  return (
    <div className="rounded-3xl border border-indigo-100 bg-linear-to-br from-white via-indigo-50/20 to-orange-50/20 p-6 shadow-sm">
      {/* Header with AI Badge & Score */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-xs">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
          </div>
          <div>
            <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
              ShoppersDeals AI Buying Verdict
            </h3>
            <p className="text-[11px] font-semibold text-gray-500">
              Objective technical specs & deal value assessment
            </p>
          </div>
        </div>

        {/* Value Score Pill */}
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 border border-emerald-200">
          <span>★</span>
          <span>{verdict.score} / 10 Value Score</span>
        </div>
      </div>

      {/* Pros & Cons Grid */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Pros */}
        <div className="rounded-2xl bg-white/80 p-4 border border-emerald-100/80">
          <div className="flex items-center gap-2 mb-2 text-xs font-extrabold uppercase tracking-wider text-emerald-700">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Key Advantages
          </div>
          <ul className="space-y-2">
            {verdict.pros.map((pro, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs font-medium text-gray-700 leading-relaxed">
                <span className="mt-0.5 text-emerald-600 font-bold">✓</span>
                <span>{pro}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Cons */}
        <div className="rounded-2xl bg-white/80 p-4 border border-amber-100/80">
          <div className="flex items-center gap-2 mb-2 text-xs font-extrabold uppercase tracking-wider text-amber-700">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Points to Consider
          </div>
          <ul className="space-y-2">
            {verdict.cons.map((con, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs font-medium text-gray-700 leading-relaxed">
                <span className="mt-0.5 text-amber-600 font-bold">•</span>
                <span>{con}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Verdict Recommendation Box */}
      <div className="mt-4 rounded-2xl bg-indigo-50/70 p-4 border border-indigo-100">
        <div className="flex items-start gap-2.5">
          <span className="text-base">🎯</span>
          <div>
            <strong className="text-xs font-black text-indigo-950">Target Buyer Recommendation:</strong>
            <p className="mt-0.5 text-xs text-indigo-900 leading-relaxed">
              {verdict.verdict}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
