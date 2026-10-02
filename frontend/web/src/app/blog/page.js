import Link from 'next/link';
import Image from 'next/image';
import blogsData from '@/data/blogs.json';

export const metadata = {
  title: "Smart Buyer's Guides & Monthly Comparisons — ShoppersDeals",
  description: 'Data-backed buying reports, 90-day price drop audits, and side-by-side product comparisons across Amazon, Flipkart, and Myntra.',
  alternates: { canonical: '/blog' },
};

export default function BlogListPage() {
  const posts = [...blogsData].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div>
      <div className="rounded-b-[32px] bg-gradient-to-br from-[#0f172a] to-[#1e293b] px-6 pb-10 pt-10 shadow-[0_10px_20px_rgba(0,0,0,0.1)] md:pt-14">
        <div className="mx-auto w-full max-w-[1200px]">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-orange-400/40 bg-orange-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-orange-400">
            <span>⚡ Monthly Buyer Intelligence</span>
          </div>
          <h1 className="mb-3 text-[32px] font-black tracking-tight text-white md:text-[40px]">
            Smart Buyer&apos;s <span className="text-brand">Guides &amp; Reports</span>
          </h1>
          <p className="max-w-[650px] text-sm leading-6 text-[#94a3b8] sm:text-base">
            Unbiased, data-backed buying reports with live store price audits, 90-day history &amp; side-by-side spec comparisons for high-ticket appliances and electronics.
          </p>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-6 px-5 pb-16 pt-8 md:grid-cols-2 md:px-6">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-[rgba(226,232,240,0.5)] bg-white shadow-[0_12px_24px_rgba(100,116,139,0.08)]"
          >
            <div className="relative">
              <Image
                src={post.imageUrl}
                alt={post.title}
                width={800}
                height={220}
                className="h-[220px] w-full bg-[#e2e8f0] object-cover"
              />
              <span className="absolute left-4 top-4 rounded-full bg-[rgba(15,23,42,0.75)] px-3 py-1.5 text-[11px] font-extrabold tracking-widest text-white backdrop-blur">
                GUIDE
              </span>
            </div>
            <div className="p-6">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[#94a3b8]">
                {new Date(post.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' })} · {post.readTime}
              </p>
              <h2 className="sd-line-clamp-2 mb-3 text-[22px] font-extrabold leading-[30px] tracking-tight text-[#0f172a]">
                {post.title}
              </h2>
              <p className="sd-line-clamp-3 mb-5 text-[15px] leading-6 text-[#475569]">{post.excerpt}</p>
              <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-bold text-brand">
                Read Buyer&apos;s Guide →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
