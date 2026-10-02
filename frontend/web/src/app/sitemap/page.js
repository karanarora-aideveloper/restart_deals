import Link from 'next/link';
import { SITE_URL } from '@/lib/config';
import { TOP_CURATED_BEST_SLUGS } from '@/lib/bestCategories';
import { CATEGORY_LABELS, SUBCATEGORY_LABELS } from '@/lib/taxonomy';
import blogsData from '@/data/blogs.json';

export const metadata = {
  title: 'ShoppersDeals Sitemap & Deal Directory — All Categories & Guides',
  description:
    'Comprehensive sitemap and directory of all categories, top 20 buying guides, store deals, and shopping resources on ShoppersDeals.',
  alternates: { canonical: '/sitemap' },
};

export default function SitemapPage() {
  const allBestSlugs = Array.from(
    new Set([...Object.keys(TOP_CURATED_BEST_SLUGS), ...Object.keys(SUBCATEGORY_LABELS)])
  );

  const topStores = [
    { name: 'Amazon Deals', href: '/?merchant=amazon', logo: '🛍️' },
    { name: 'Flipkart Deals', href: '/?merchant=flipkart', logo: '⚡' },
    { name: 'Myntra Deals', href: '/?merchant=myntra', logo: '👗' },
    { name: 'Meesho Deals', href: '/?merchant=meesho', logo: '🏷️' },
    { name: 'Shopsy Deals', href: '/?merchant=shopsy', logo: '🛍️' },
  ];

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 md:px-8 md:py-12">
      <nav className="mb-6 text-xs text-gray-500" aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5">
          <li><Link href="/" className="hover:text-brand">Home</Link></li>
          <li>/</li>
          <li className="font-semibold text-gray-800">Sitemap Directory</li>
        </ol>
      </nav>

      <div className="mb-10">
        <h1 className="text-2xl font-black tracking-tight text-gray-900 sm:text-3xl">
          ShoppersDeals Directory &amp; Sitemap
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Browse all live deal sections, category directories, top 20 buying guides, and official store tracking hubs.
        </p>
      </div>

      {/* Main Sections Grid */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {/* Core Pages */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
          <h2 className="text-base font-extrabold text-gray-900 mb-4 flex items-center gap-2">
            <span>🧭</span> Core Navigation
          </h2>
          <ul className="space-y-2 text-sm">
            <li><Link href="/" className="text-brand font-medium hover:underline">Live Deal Stream (Homepage)</Link></li>
            <li><Link href="/hot" className="text-gray-700 hover:text-brand">Hot Lightning Deals 🔥</Link></li>
            <li><Link href="/products" className="text-gray-700 hover:text-brand">Price Tracker &amp; Product Directory</Link></li>
            <li><Link href="/compare" className="text-gray-700 hover:text-brand">Multi-Product Price Comparison</Link></li>
            <li><Link href="/categories" className="text-gray-700 hover:text-brand">Category Hubs</Link></li>
            <li><Link href="/blog" className="text-gray-700 hover:text-brand">Shopping &amp; Sale Guides</Link></li>
          </ul>
        </div>

        {/* Top Stores */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
          <h2 className="text-base font-extrabold text-gray-900 mb-4 flex items-center gap-2">
            <span>🏪</span> Stores Tracked
          </h2>
          <ul className="space-y-2 text-sm">
            {topStores.map((st) => (
              <li key={st.href}>
                <Link href={st.href} className="text-gray-700 hover:text-brand flex items-center gap-2">
                  <span>{st.logo}</span> {st.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Main Categories */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
          <h2 className="text-base font-extrabold text-gray-900 mb-4 flex items-center gap-2">
            <span>🏷️</span> Main Categories
          </h2>
          <ul className="space-y-2 text-sm">
            {Object.entries(CATEGORY_LABELS).map(([catKey, label]) => (
              <li key={catKey}>
                <Link href={`/categories/${catKey}`} className="text-gray-700 hover:text-brand">
                  {label} Deals
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Top 20 Curated Buying Guides */}
      <div className="mt-12 rounded-2xl border border-gray-200 bg-white p-6 md:p-8 shadow-xs">
        <h2 className="text-lg font-black text-gray-900 mb-2 flex items-center gap-2">
          <span>🏆</span> Top 20 Curated Buying Guides (2026)
        </h2>
        <p className="text-xs text-gray-500 mb-6">
          Real-time price comparisons and 90-day price history trackers across Amazon, Flipkart, Myntra &amp; Shopsy.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(TOP_CURATED_BEST_SLUGS).map(([slug, data]) => (
            <Link
              key={slug}
              href={`/best/${slug}`}
              className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-2.5 text-xs font-bold text-gray-800 transition-colors hover:border-brand/40 hover:bg-brand/5 hover:text-brand"
            >
              <span>{data.title}</span>
              <span className="text-gray-400">→</span>
            </Link>
          ))}
        </div>
      </div>

      {/* All Subcategory Hubs */}
      <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 md:p-8 shadow-xs">
        <h2 className="text-lg font-black text-gray-900 mb-2 flex items-center gap-2">
          <span>📦</span> All Subcategory Buying Guides ({allBestSlugs.length})
        </h2>
        <p className="text-xs text-gray-500 mb-6">
          Explore top products, deal comparisons, and genuine discounts for every department.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs">
          {allBestSlugs.map((slug) => {
            const label = SUBCATEGORY_LABELS[slug] || slug.replace(/-/g, ' ');
            return (
              <Link
                key={slug}
                href={`/best/${slug}`}
                className="truncate rounded-lg px-2.5 py-1.5 text-gray-600 hover:bg-gray-100 hover:text-brand"
                title={`Best ${label} in India`}
              >
                Top 20 {label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Shopping Guides & Editorial */}
      <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 md:p-8 shadow-xs">
        <h2 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
          <span>📚</span> Shopping Guides &amp; Festive Analysis
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(blogsData || []).map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group rounded-xl border border-gray-100 p-4 transition-colors hover:border-brand/30 hover:bg-brand/5"
            >
              <h3 className="text-sm font-bold text-gray-900 group-hover:text-brand">{post.title}</h3>
              <p className="mt-1 text-xs text-gray-500 line-clamp-2">{post.description || post.summary}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
