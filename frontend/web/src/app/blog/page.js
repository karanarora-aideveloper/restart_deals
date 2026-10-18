import { Suspense } from 'react';
import blogsData from '@/data/blogs.json';
import BlogListingClient from '@/components/BlogListingClient';
import { SITE_URL } from '@/lib/config';

export const metadata = {
  title: "200+ Smart Buyer's Guides, Specs & Price Drop Audits — ShoppersDeals",
  description:
    'Comprehensive data-backed buying guides, 90-day price drop audits, and side-by-side product comparisons across Amazon, Flipkart, Myntra, and Nykaa.',
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    title: "200+ Smart Buyer's Guides, Specs & Price Drop Audits — ShoppersDeals",
    description:
      'Data-backed product selections, 90-day price history audits, and side-by-side comparisons across top Indian stores.',
    url: `${SITE_URL}/blog`,
    type: 'website',
  },
};

export default function BlogListPage() {
  const posts = [...blogsData].sort((a, b) => {
    if (a.isFeatured !== b.isFeatured) {
      return a.isFeatured ? -1 : 1;
    }
    if ((a.displayOrder || 999) !== (b.displayOrder || 999)) {
      return (a.displayOrder || 999) - (b.displayOrder || 999);
    }
    return new Date(b.date) - new Date(a.date);
  });

  return (
    <main className="min-h-screen bg-[#f8fafc]">
      <Suspense
        fallback={
          <div className="w-full">
            <div className="rounded-b-[36px] bg-gradient-to-br from-[#090d16] via-[#0f172a] to-[#1e293b] px-5 pb-12 pt-10 text-white sm:px-8 md:pt-14">
              <div className="mx-auto w-full max-w-[1240px]">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-500/10 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-orange-400">
                  <span>⚡ Buyer Intelligence Directory</span>
                  <span className="text-[11px] font-semibold text-orange-200">
                    {posts.length} Active Buying Guides
                  </span>
                </div>
                <h1 className="mb-3 text-[32px] font-black tracking-tight text-white sm:text-[42px] lg:text-[46px]">
                  Smart Buyer&apos;s Guides &amp; Price Drop Audits
                </h1>
                <p className="max-w-[760px] text-sm text-[#94a3b8] sm:text-base">
                  Data-backed product selections, 90-day price drop audits, and side-by-side comparisons.
                </p>
              </div>
            </div>
            <div className="mx-auto grid w-full max-w-[1240px] grid-cols-1 gap-6 px-4 py-12 sm:grid-cols-2 lg:grid-cols-3">
              {posts.slice(0, 6).map((post) => (
                <div key={post.slug} className="h-80 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs animate-pulse" />
              ))}
            </div>
          </div>
        }
      >
        <BlogListingClient initialPosts={posts} />
      </Suspense>
    </main>
  );
}
