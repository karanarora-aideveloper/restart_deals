'use client';

import React, { useState, useMemo, useEffect, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';

const CATEGORY_CONFIG = {
  all: { label: 'All Guides', icon: '⚡', color: 'from-orange-500 to-amber-500' },
  mobiles: { label: 'Mobiles & Tablets', icon: '📱', color: 'from-blue-600 to-indigo-600' },
  'laptops-pc': { label: 'Laptops & PC', icon: '💻', color: 'from-sky-600 to-cyan-600' },
  appliances: { label: 'Large Appliances & TVs', icon: '❄️', color: 'from-teal-600 to-emerald-600' },
  kitchen: { label: 'Kitchen & Cookware', icon: '🍳', color: 'from-amber-600 to-orange-600' },
  'audio-wearables': { label: 'Audio & Wearables', icon: '🎧', color: 'from-violet-600 to-purple-600' },
  'beauty-grooming': { label: 'Beauty & Grooming', icon: '💄', color: 'from-pink-600 to-rose-600' },
  'fitness-fashion': { label: 'Fitness & Fashion', icon: '👟', color: 'from-emerald-600 to-green-600' },
  'shopping-strategy': { label: 'Shopping Strategy & Sales', icon: '💡', color: 'from-amber-500 to-yellow-600' },
};

const BUDGET_TIERS = [
  { id: 'all', label: 'All Budgets' },
  { id: 'under-5000', label: 'Under ₹5,000' },
  { id: 'under-15000', label: 'Under ₹15,000' },
  { id: 'under-25000', label: 'Under ₹25,000' },
  { id: 'under-50000', label: 'Under ₹50,000' },
  { id: 'flagship', label: 'Flagship & Premium' },
];

function formatDetailLabel(slug) {
  if (!slug) return '';
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function BlogListingClient({ initialPosts = [] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read initial filter values from URL params
  const paramCategory = searchParams.get('category') || 'all';
  const paramDetail = searchParams.get('detail') || 'all';
  const paramBudget = searchParams.get('budget') || 'all';
  const paramSearch = searchParams.get('q') || '';
  const paramSort = searchParams.get('sort') || 'recommended';

  const [activeCategory, setActiveCategory] = useState(
    CATEGORY_CONFIG[paramCategory] ? paramCategory : 'all'
  );
  const [activeDetail, setActiveDetail] = useState(paramDetail);
  const [activeBudget, setActiveBudget] = useState(paramBudget);
  const [searchQuery, setSearchQuery] = useState(paramSearch);
  const [sortBy, setSortBy] = useState(paramSort);
  const [visibleCount, setVisibleCount] = useState(18);
  const [, startTransition] = useTransition();

  // Sync state changes with URL query string cleanly
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeCategory !== 'all') params.set('category', activeCategory);
    if (activeDetail !== 'all') params.set('detail', activeDetail);
    if (activeBudget !== 'all') params.set('budget', activeBudget);
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (sortBy !== 'recommended') params.set('sort', sortBy);

    const queryString = params.toString();
    const newUrl = queryString ? `/blog?${queryString}` : '/blog';

    window.history.replaceState(null, '', newUrl);
  }, [activeCategory, activeDetail, activeBudget, searchQuery, sortBy]);

  // Reset pagination when any filter changes
  useEffect(() => {
    setVisibleCount(18);
  }, [activeCategory, activeDetail, activeBudget, searchQuery, sortBy]);

  // Reset detail subcategory when changing top-level category
  const handleCategoryChange = (catKey) => {
    startTransition(() => {
      setActiveCategory(catKey);
      setActiveDetail('all');
    });
  };

  // Compute counts per category
  const categoryCounts = useMemo(() => {
    const counts = { all: initialPosts.length };
    for (const post of initialPosts) {
      const cat = post.category || 'shopping-strategy';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [initialPosts]);

  // Extract available detailCategories for the active category
  const availableDetailCategories = useMemo(() => {
    const details = new Set();
    const filteredByCategory =
      activeCategory === 'all'
        ? initialPosts
        : initialPosts.filter((p) => p.category === activeCategory);

    for (const post of filteredByCategory) {
      if (post.detailCategory) {
        details.add(post.detailCategory);
      }
    }
    return Array.from(details).sort();
  }, [initialPosts, activeCategory]);

  // Filtered and sorted posts
  const filteredPosts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return initialPosts
      .filter((post) => {
        // Category filter
        if (activeCategory !== 'all' && post.category !== activeCategory) {
          return false;
        }

        // Subcategory/Detail filter
        if (activeDetail !== 'all' && post.detailCategory !== activeDetail) {
          return false;
        }

        // Budget tier filter
        if (activeBudget !== 'all') {
          if (activeBudget === 'under-5000') {
            const allowed = ['under-1500', 'under-3000', 'under-5000'];
            if (!allowed.includes(post.budgetTier)) return false;
          } else if (activeBudget === 'under-15000') {
            const allowed = ['under-10000', 'under-15000'];
            if (!allowed.includes(post.budgetTier)) return false;
          } else if (activeBudget === 'under-25000') {
            const allowed = ['under-20000', 'under-25000'];
            if (!allowed.includes(post.budgetTier)) return false;
          } else if (activeBudget === 'under-50000') {
            const allowed = ['under-30000', 'under-40000', 'under-50000'];
            if (!allowed.includes(post.budgetTier)) return false;
          } else if (activeBudget === 'flagship') {
            const allowed = ['under-70000', 'flagship'];
            if (!allowed.includes(post.budgetTier)) return false;
          }
        }

        // Search text matching
        if (q) {
          const matchTitle = (post.title || '').toLowerCase().includes(q);
          const matchExcerpt = (post.excerpt || '').toLowerCase().includes(q);
          const matchNiche = (post.niche || '').toLowerCase().includes(q);
          const matchDetail = (post.detailCategory || '').toLowerCase().includes(q);
          if (!matchTitle && !matchExcerpt && !matchNiche && !matchDetail) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.date) - new Date(a.date);
        }
        if (sortBy === 'products') {
          return (b.productCount || 0) - (a.productCount || 0);
        }
        // Recommended / Featured sort:
        // Prioritize isFeatured, then displayOrder, then date
        if (a.isFeatured !== b.isFeatured) {
          return a.isFeatured ? -1 : 1;
        }
        if ((a.displayOrder || 999) !== (b.displayOrder || 999)) {
          return (a.displayOrder || 999) - (b.displayOrder || 999);
        }
        return new Date(b.date) - new Date(a.date);
      });
  }, [initialPosts, activeCategory, activeDetail, activeBudget, searchQuery, sortBy]);

  const displayedPosts = filteredPosts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredPosts.length;
  const isFiltered =
    activeCategory !== 'all' ||
    activeDetail !== 'all' ||
    activeBudget !== 'all' ||
    Boolean(searchQuery.trim());

  const resetAllFilters = () => {
    setActiveCategory('all');
    setActiveDetail('all');
    setActiveBudget('all');
    setSearchQuery('');
    setSortBy('recommended');
  };

  return (
    <div className="w-full">
      {/* Top Hero Banner */}
      <div className="rounded-b-[36px] bg-gradient-to-br from-[#090d16] via-[#0f172a] to-[#1e293b] px-5 pb-12 pt-10 text-white shadow-[0_12px_24px_rgba(0,0,0,0.12)] sm:px-8 md:pt-14">
        <div className="mx-auto w-full max-w-[1240px]">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-500/10 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-orange-400">
            <span>⚡ Buyer Intelligence Directory</span>
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
            <span className="text-[11px] font-semibold text-orange-200">{initialPosts.length} Active Buying Guides</span>
          </div>
          <h1 className="mb-3 text-[32px] font-black tracking-tight text-white sm:text-[42px] lg:text-[46px] leading-[1.15]">
            Smart Buyer&apos;s <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 bg-clip-text text-transparent">Guides &amp; Price Drop Audits</span>
          </h1>
          <p className="max-w-[760px] text-sm leading-relaxed text-[#94a3b8] sm:text-base">
            Data-backed product selections, 90-day price drop audits, and side-by-side spec comparisons across Amazon, Flipkart, Myntra, and Nykaa. Filter by category, budget tier, and specialized niche.
          </p>

          {/* Search Bar inside Hero */}
          <div className="mt-8 relative max-w-[680px]">
            <div className="relative flex items-center">
              <span className="absolute left-4 text-slate-400">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search 200+ guides (e.g. 1.5 Ton 5-Star AC, 5G phone under 20000, OLED TV, air fryer...)"
                className="w-full rounded-2xl border border-white/15 bg-white/10 py-3.5 pl-12 pr-10 text-sm font-medium text-white placeholder-slate-400 shadow-inner backdrop-blur-md transition-all focus:border-brand focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-3.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-slate-300 hover:bg-white/30 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-6 sm:py-10">
        {/* Tier 1: Primary Category Tabs */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Department / Category
            </h2>
            <span className="text-xs font-semibold text-slate-400">
              {filteredPosts.length} Guides Available
            </span>
          </div>

          <div className="flex flex-wrap gap-2 sm:gap-2.5">
            {Object.entries(CATEGORY_CONFIG).map(([catKey, config]) => {
              const count = categoryCounts[catKey] || 0;
              const isActive = activeCategory === catKey;

              return (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => handleCategoryChange(catKey)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20 ring-2 ring-slate-900'
                      : 'border border-slate-200/90 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span>{config.icon}</span>
                  <span>{config.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tier 2: Subcategory / Detail Category Chips */}
        {availableDetailCategories.length > 0 && (
          <div className="mb-6 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                Subcategory Focus {activeCategory !== 'all' ? `(${CATEGORY_CONFIG[activeCategory]?.label})` : ''}
              </span>
              {activeDetail !== 'all' && (
                <button
                  type="button"
                  onClick={() => setActiveDetail('all')}
                  className="text-xs font-bold text-brand hover:underline"
                >
                  View All Subcategories
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveDetail('all')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  activeDetail === 'all'
                    ? 'bg-brand text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                All Subcategories
              </button>
              {availableDetailCategories.map((detailSlug) => {
                const isActive = activeDetail === detailSlug;
                return (
                  <button
                    key={detailSlug}
                    type="button"
                    onClick={() => setActiveDetail(detailSlug)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-brand text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:text-slate-900'
                    }`}
                  >
                    {formatDetailLabel(detailSlug)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tier 3: Budget Filters & Sorting Bar */}
        <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs md:flex-row md:items-center md:justify-between">
          {/* Budget Pills */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">
              Budget:
            </span>
            {BUDGET_TIERS.map((tier) => {
              const isActive = activeBudget === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setActiveBudget(tier.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                  }`}
                >
                  {tier.label}
                </button>
              );
            })}
          </div>

          {/* Sort Control */}
          <div className="flex items-center justify-between md:justify-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs focus:border-brand focus:outline-none"
            >
              <option value="recommended">Recommended &amp; Featured</option>
              <option value="newest">Latest Published</option>
              <option value="products">Most Products Tested</option>
            </select>
          </div>
        </div>

        {/* Filter Feedback / Active Indicator */}
        {isFiltered && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-amber-900">
              <span className="font-bold">Active Filters:</span>
              {activeCategory !== 'all' && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 font-bold">
                  Category: {CATEGORY_CONFIG[activeCategory]?.label}
                </span>
              )}
              {activeDetail !== 'all' && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 font-bold">
                  Subcategory: {formatDetailLabel(activeDetail)}
                </span>
              )}
              {activeBudget !== 'all' && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 font-bold">
                  Budget: {BUDGET_TIERS.find((t) => t.id === activeBudget)?.label}
                </span>
              )}
              {searchQuery.trim() && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 font-bold">
                  Keyword: &ldquo;{searchQuery}&rdquo;
                </span>
              )}
              <span className="text-amber-800 font-medium">({filteredPosts.length} results)</span>
            </div>

            <button
              type="button"
              onClick={resetAllFilters}
              className="text-xs font-extrabold text-brand hover:underline"
            >
              Reset All Filters ✕
            </button>
          </div>
        )}

        {/* Posts Grid */}
        {displayedPosts.length === 0 ? (
          <div className="my-16 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <span className="text-4xl">🔍</span>
            <h3 className="mt-4 text-lg font-bold text-slate-800">No Buying Guides Match Your Criteria</h3>
            <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
              We couldn&apos;t find any guides matching your current combination of category, budget, and search terms.
            </p>
            <button
              type="button"
              onClick={resetAllFilters}
              className="mt-6 rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-brand-dark transition-all"
            >
              Reset Filters &amp; View All Guides
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {displayedPosts.map((post) => {
              const catInfo = CATEGORY_CONFIG[post.category] || CATEGORY_CONFIG['shopping-strategy'];

              return (
                <article
                  key={post.slug}
                  className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg"
                >
                  {/* Card Thumbnail Box */}
                  <Link href={`/blog/${post.slug}`} className="relative block overflow-hidden bg-slate-900 aspect-[16/9]">
                    <Image
                      src={post.imageUrl}
                      alt={post.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

                    {/* Top Badges */}
                    <div className="absolute left-3.5 top-3.5 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-slate-900/85 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur-md">
                        {catInfo.icon} {post.category?.replace('-', ' ')}
                      </span>
                      {post.isFeatured && (
                        <span className="rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-950 shadow-xs">
                          ★ Featured
                        </span>
                      )}
                    </div>

                    {/* Bottom Floating Stats */}
                    <div className="absolute bottom-3 left-3.5 right-3.5 flex items-center justify-between text-[11px] font-bold text-white">
                      {post.productCount > 0 ? (
                        <span className="rounded-md bg-white/20 px-2 py-0.5 backdrop-blur-md">
                          🔬 {post.productCount} Models Tested
                        </span>
                      ) : (
                        <span className="rounded-md bg-white/20 px-2 py-0.5 backdrop-blur-md">
                          📊 Price Audit
                        </span>
                      )}
                      {post.priceRange && (
                        <span className="rounded-md bg-emerald-500/90 px-2 py-0.5 text-white backdrop-blur-md">
                          {post.priceRange}
                        </span>
                      )}
                    </div>
                  </Link>

                  {/* Card Content */}
                  <div className="flex flex-1 flex-col p-5 sm:p-6">
                    {/* Meta info row */}
                    <div className="mb-2.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <span>
                        {new Date(post.date).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          timeZone: 'Asia/Kolkata',
                        })}
                      </span>
                      <span>·</span>
                      <span>{post.readTime}</span>
                    </div>

                    {/* Title */}
                    <h2 className="mb-2 text-base font-extrabold leading-snug text-ink transition-colors group-hover:text-brand line-clamp-2">
                      <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                    </h2>

                    {/* Detail category & niche tags */}
                    <div className="mb-3 flex flex-wrap items-center gap-1.5">
                      {post.detailCategory && (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                          {formatDetailLabel(post.detailCategory)}
                        </span>
                      )}
                      {post.niche && (
                        <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                          {post.niche}
                        </span>
                      )}
                    </div>

                    {/* Excerpt */}
                    <p className="mb-4 text-xs sm:text-sm leading-relaxed text-slate-600 line-clamp-2">
                      {post.excerpt}
                    </p>

                    {/* Footer / Store Support & CTA */}
                    <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3.5">
                      <div className="flex items-center gap-1">
                        {post.targetStores && post.targetStores.length > 0 ? (
                          post.targetStores.slice(0, 3).map((st) => (
                            <span
                              key={st}
                              className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-600"
                            >
                              {st}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400">Amazon · Flipkart</span>
                        )}
                      </div>

                      <Link
                        href={`/blog/${post.slug}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-brand transition-colors hover:text-brand-dark"
                      >
                        Read Guide →
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Load More Button */}
        {hasMore && (
          <div className="mt-12 text-center">
            <button
              type="button"
              onClick={() => setVisibleCount((prev) => prev + 18)}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-8 py-3.5 text-xs sm:text-sm font-extrabold text-white shadow-md shadow-slate-900/10 transition-all hover:bg-brand hover:shadow-brand/20"
            >
              <span>Load More Guides</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">
                +{Math.min(18, filteredPosts.length - visibleCount)}
              </span>
            </button>
            <p className="mt-2 text-xs text-slate-400">
              Showing {displayedPosts.length} of {filteredPosts.length} Guides
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
