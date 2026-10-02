import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import blogsData from '@/data/blogs.json';
import { SITE_URL } from '@/lib/config';

export function generateStaticParams() {
  return blogsData.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = blogsData.find((b) => b.slug === slug);
  if (!post) return { title: 'Article Not Found' };

  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt,
      url: `${SITE_URL}/blog/${slug}`,
      images: [post.imageUrl],
      publishedTime: post.date,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: [post.imageUrl],
    },
  };
}

function initials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/**
 * Parses markdown inline formatting:
 * 1. Bold links: **[label](url)**
 * 2. Standard links: [label](url)
 * 3. Bold text: **bold text**
 * 4. Italic text: *italic text*
 */
function renderFormattedText(text) {
  if (!text || typeof text !== 'string') return text;
  const tokenRegex = /(\*\*\[([^\]]+)\]\(([^)]+)\)\*\*|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let lastIndex = 0;
  let match;
  const parts = [];

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2] && match[3]) {
      // Bold Link **[label](url)**
      parts.push(
        <Link
          key={match.index}
          href={match[3]}
          className="font-bold text-brand underline underline-offset-4 hover:text-brand-dark transition-colors"
        >
          {match[2]}
        </Link>
      );
    } else if (match[4] && match[5]) {
      // Standard Link [label](url)
      parts.push(
        <Link
          key={match.index}
          href={match[5]}
          className="font-semibold text-brand underline underline-offset-4 hover:text-brand-dark transition-colors"
        >
          {match[4]}
        </Link>
      );
    } else if (match[6]) {
      // Bold **text**
      parts.push(
        <strong key={match.index} className="font-bold text-ink">
          {match[6]}
        </strong>
      );
    } else if (match[7]) {
      // Italic *text*
      parts.push(
        <em key={match.index} className="italic text-slate-700">
          {match[7]}
        </em>
      );
    }
    lastIndex = tokenRegex.lastIndex;
  }
  if (lastIndex === 0) return text;
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function ContentBlock({ block, index }) {
  switch (block.type) {
    case 'h2':
      return (
        <div key={index} className="mt-10 mb-4 border-b border-slate-200 pb-2.5 first:mt-0">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-ink">
            {renderFormattedText(block.text)}
          </h2>
        </div>
      );
    case 'h3':
      return (
        <h3 key={index} className="mt-6 mb-2 text-base sm:text-lg font-bold text-slate-800">
          {renderFormattedText(block.text)}
        </h3>
      );
    case 'lede':
      return (
        <div key={index} className="my-5 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/60 to-slate-50 p-4 sm:p-6 shadow-sm">
          <p className="text-sm sm:text-base md:text-lg leading-relaxed text-slate-700">
            {renderFormattedText(block.text)}
          </p>
        </div>
      );
    case 'quote':
      return (
        <blockquote key={index} className="my-6 rounded-2xl border-l-4 border-brand bg-slate-50 p-4 sm:p-6 shadow-sm">
          <p className="text-sm sm:text-base font-semibold italic leading-relaxed text-slate-800">
            "{block.text}"
          </p>
          {block.attribution && (
            <cite className="mt-2 block text-xs font-bold uppercase tracking-wider not-italic text-slate-500">
              — {block.attribution}
            </cite>
          )}
        </blockquote>
      );
    case 'image':
      return (
        <figure key={index} className="my-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-white">
            <img
              src={block.src}
              alt={block.alt || ''}
              loading="lazy"
              className="h-auto w-full object-cover"
            />
          </div>
          {(block.caption || block.credit) && (
            <figcaption className="mt-2 text-center text-xs leading-5 text-slate-500">
              {block.caption}
              {block.caption && block.credit ? ' ' : ''}
              {block.credit && <span className="italic">{block.credit}</span>}
            </figcaption>
          )}
        </figure>
      );
    case 'product-card':
      return (
        <div key={index} className="my-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
          {block.badge && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-2 sm:px-6">
              <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-amber-900">
                {block.badge}
              </span>
              {block.rank && (
                <span className="rounded-full bg-amber-200/70 px-2.5 py-0.5 text-[11px] font-bold text-amber-950">
                  {block.rank}
                </span>
              )}
            </div>
          )}

          <div className="p-4 sm:p-6 md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              {/* Product Image Box */}
              {block.imageUrl && (
                <div className="relative mx-auto flex h-48 w-48 sm:h-56 sm:w-56 shrink-0 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 p-4 md:mx-0">
                  <img
                    src={block.imageUrl}
                    alt={block.title || 'Product Image'}
                    loading="lazy"
                    className="max-h-full max-w-full object-contain"
                  />
                  {block.store && (
                    <span className="absolute bottom-2.5 left-2.5 rounded-md bg-white/95 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-600 shadow-sm border border-slate-200/60">
                      {block.store}
                    </span>
                  )}
                </div>
              )}

              {/* Product Info Column */}
              <div className="flex flex-1 flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  {block.rating > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                      ★ {block.rating}
                      {block.reviewsCount && (
                        <span className="font-normal text-emerald-600/80">({block.reviewsCount})</span>
                      )}
                    </span>
                  )}
                  {block.bestFor && (
                    <span className="rounded-md bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                      {block.bestFor}
                    </span>
                  )}
                </div>

                <h3 className="mt-2 text-base sm:text-xl font-bold leading-snug text-ink">
                  {block.productUrl ? (
                    <Link href={block.productUrl} className="hover:text-brand transition-colors">
                      {block.title}
                    </Link>
                  ) : (
                    block.title
                  )}
                </h3>

                {/* Price Row */}
                <div className="mt-3 flex flex-wrap items-baseline gap-2.5">
                  {block.price != null && (
                    <span className="text-xl sm:text-2xl font-black text-ink">
                      ₹{Number(block.price).toLocaleString('en-IN')}
                    </span>
                  )}
                  {block.originalPrice != null && block.originalPrice > block.price && (
                    <span className="text-xs sm:text-sm font-medium text-slate-400 line-through">
                      ₹{Number(block.originalPrice).toLocaleString('en-IN')}
                    </span>
                  )}
                  {block.discountPercentage > 0 && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-black text-emerald-800">
                      {block.discountPercentage}% OFF
                    </span>
                  )}
                  {block.priceNote && (
                    <span className="text-xs text-slate-500">({block.priceNote})</span>
                  )}
                </div>

                {/* Specs Box */}
                {block.specs && block.specs.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {block.specs.map((spec, sIdx) => (
                      <div key={sIdx} className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-2.5 py-2 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{spec.label}</p>
                        <p className="text-xs font-extrabold text-slate-900 mt-0.5">{spec.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Description */}
                {block.description && (
                  <p className="mt-3.5 text-xs sm:text-sm leading-relaxed text-slate-600">
                    {renderFormattedText(block.description)}
                  </p>
                )}

                {/* Pros and Cons Box */}
                {(block.pros || block.cons) && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {block.pros && block.pros.length > 0 && (
                      <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3.5">
                        <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                          <span>✓</span> Advantages
                        </p>
                        <ul className="space-y-1.5 text-xs leading-relaxed text-emerald-950">
                          {block.pros.map((p, pIdx) => (
                            <li key={pIdx} className="flex items-start gap-1.5">
                              <span className="text-emerald-600 font-bold shrink-0">•</span>
                              <span>{renderFormattedText(p)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {block.cons && block.cons.length > 0 && (
                      <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-3.5">
                        <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                          <span>⚠</span> Watch Out
                        </p>
                        <ul className="space-y-1.5 text-xs leading-relaxed text-amber-950">
                          {block.cons.map((c, cIdx) => (
                            <li key={cIdx} className="flex items-start gap-1.5">
                              <span className="text-amber-600 font-bold shrink-0">•</span>
                              <span>{renderFormattedText(c)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons Box */}
                <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  {block.merchantUrl && (
                    <a
                      href={block.merchantUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center justify-center rounded-xl bg-brand px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm transition hover:bg-brand-dark text-center"
                    >
                      Check Deal on {block.store || 'Store'} →
                    </a>
                  )}
                  {block.productUrl && (
                    <Link
                      href={block.productUrl}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-700 shadow-sm transition hover:border-brand hover:text-brand text-center"
                    >
                      View Live Price History
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    case 'table':
      return (
        <div key={index} className="my-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {block.title && (
            <div className="border-b border-slate-200 bg-[#0f172a] px-4 py-3.5 sm:px-6 sm:py-4 text-white">
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white">{block.title}</h3>
              {block.subtitle && (
                <p className="mt-0.5 text-xs text-slate-400">{block.subtitle}</p>
              )}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-xs sm:text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-700">
                <tr>
                  {block.headers.map((h, hIdx) => (
                    <th key={hIdx} className="px-3.5 py-3 first:pl-5 last:pr-5 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {block.rows.map((row, rIdx) => (
                  <tr key={rIdx} className={rIdx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white hover:bg-slate-50 transition-colors'}>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3.5 py-3 first:pl-5 first:font-bold first:text-ink last:pr-5">
                        {renderFormattedText(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.note && (
            <div className="border-t border-slate-200 bg-slate-50 px-4 py-2.5 sm:px-6 text-[11px] sm:text-xs text-slate-600">
              💡 {block.note}
            </div>
          )}
        </div>
      );
    case 'callout':
      return (
        <div key={index} className={`my-5 rounded-2xl border p-4 sm:p-5 text-xs sm:text-sm leading-relaxed ${
          block.variant === 'warning'
            ? 'border-amber-200 bg-amber-50/70 text-amber-950'
            : block.variant === 'success'
            ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
            : 'border-blue-200 bg-blue-50/70 text-blue-950'
        }`}>
          {block.title && (
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-base">{block.variant === 'warning' ? '⚠️' : block.variant === 'success' ? '✅' : '💡'}</span>
              <p className="font-extrabold text-xs sm:text-sm uppercase tracking-wider">{block.title}</p>
            </div>
          )}
          <p className="text-xs sm:text-sm leading-relaxed">
            {renderFormattedText(block.text)}
          </p>
        </div>
      );
    case 'specs':
      return (
        <div key={index} className="my-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          {block.title && (
            <p className="border-b border-slate-200 bg-white px-4 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-ink">
              {block.title}
            </p>
          )}
          <dl className="divide-y divide-slate-200">
            {block.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between gap-4 px-4 py-2.5 sm:px-5 sm:py-3">
                <dt className="text-xs sm:text-sm font-semibold text-slate-500">{item.label}</dt>
                <dd className="text-right text-xs sm:text-sm font-bold text-ink">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      );
    case 'list':
      return (
        <div key={index} className="my-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 sm:p-5">
          <ul className="space-y-2.5 text-xs sm:text-sm leading-relaxed text-slate-700">
            {block.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-brand font-black mt-0.5">•</span>
                <span className="flex-1">{renderFormattedText(item)}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    default:
      return (
        <p key={index} className="text-xs sm:text-sm md:text-base leading-relaxed text-slate-600 mb-3">
          {renderFormattedText(block.text)}
        </p>
      );
  }
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const post = blogsData.find((b) => b.slug === slug);
  if (!post) notFound();

  const author = post.author || { name: 'ShoppersDeals Team', role: 'Deals & Tech Desk' };
  const shareUrl = `${SITE_URL}/blog/${slug}`;
  const shareText = post.title;
  const related = [...blogsData]
    .filter((b) => b.slug !== slug)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3);

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: [post.imageUrl],
    datePublished: post.date,
    dateModified: post.date,
    author: { '@type': 'Organization', name: 'ShoppersDeals' },
    publisher: {
      '@type': 'Organization',
      name: 'ShoppersDeals',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/blog/${slug}` },
  };

  return (
    <div className="flex flex-col items-center bg-[#f8fafc] pb-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />

      <div className="hidden w-full max-w-[1200px] px-4 sm:px-6 py-5 md:block">
        <Link href="/blog" className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-500 hover:text-brand transition-colors">
          ← Back to Guides & Reviews
        </Link>
      </div>

      <article className="w-full max-w-[1200px] overflow-hidden bg-white md:rounded-3xl md:border md:border-slate-200/80 md:shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
        {/* Hero Header */}
        <div className="relative w-full h-[220px] sm:h-[320px] md:h-[400px] overflow-hidden bg-slate-900">
          <Link
            href="/blog"
            aria-label="Back to guides"
            className="absolute left-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-md backdrop-blur md:hidden"
          >
            ←
          </Link>
          <span className="absolute left-4 bottom-4 z-10 rounded-full bg-slate-900/85 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-white backdrop-blur">
            COMPREHENSIVE GUIDE
          </span>
          <img
            src={post.imageUrl}
            alt={post.title}
            className="h-full w-full object-cover"
          />
        </div>

        {/* Content Container */}
        <div className="px-4 py-6 sm:px-8 sm:py-8 md:px-12 md:py-10">
          <h1 className="mb-4 font-heading text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold leading-tight tracking-tight text-ink">
            {post.title}
          </h1>

          {/* Author & Share Bar */}
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-y border-slate-100 py-3.5 sm:py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-xs sm:text-sm font-extrabold text-white">
                {initials(author.name)}
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-ink">{author.name}</p>
                <p className="text-[11px] sm:text-xs font-medium text-slate-400">
                  {author.role} · {new Date(post.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' })} · {post.readTime}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on WhatsApp"
                className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-brand hover:text-brand"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.77.46 3.45 1.32 4.94L2 22l5.29-1.38a9.87 9.87 0 0 0 4.75 1.21h.01c5.46 0 9.91-4.45 9.91-9.92C21.96 6.45 17.5 2 12.04 2Zm5.79 14.02c-.24.68-1.4 1.3-1.94 1.38-.5.08-1.12.11-1.81-.11-.42-.13-.95-.31-1.64-.6-2.89-1.25-4.78-4.15-4.92-4.34-.14-.19-1.18-1.57-1.18-3 0-1.42.75-2.12 1.01-2.41.27-.29.58-.36.78-.36.19 0 .39 0 .56.01.18.01.42-.07.65.5.24.58.81 2 .88 2.14.07.15.12.32.02.51-.1.19-.15.31-.29.48-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.29.76 1.25 1.63 2.03 1.12 1 2.06 1.31 2.35 1.46.29.15.46.13.63-.08.17-.2.72-.84.92-1.13.19-.29.39-.24.65-.14.27.1 1.68.79 1.97.94.29.14.48.21.55.33.07.13.07.72-.17 1.4Z" /></svg>
              </a>
              <a
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on X"
                className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-brand hover:text-brand"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 2H22l-7.6 8.7L23.3 22H16.6l-5.3-6.9L5.2 22H2l8.1-9.3L1.5 2h6.9l4.8 6.3Zm-1.2 18.2h1.7L7.1 3.7H5.3Z" /></svg>
              </a>
            </div>
          </div>

          {/* Blocks */}
          <div className="space-y-4">
            {post.content.map((block, i) => (
              <ContentBlock key={i} block={block} index={i} />
            ))}
          </div>
        </div>
      </article>

      {/* Related Articles */}
      {related.length > 0 && (
        <div className="mt-12 w-full max-w-[1200px] px-4 sm:px-6">
          <h2 className="mb-4 font-heading text-lg sm:text-xl font-extrabold text-ink">Keep Reading</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/blog/${r.slug}`}
                className="sd-grid-card group overflow-hidden rounded-2xl border border-slate-200 bg-white hover:shadow-md transition-shadow"
              >
                <div className="overflow-hidden h-36 bg-slate-100">
                  <img
                    src={r.imageUrl}
                    alt={r.title}
                    loading="lazy"
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-4">
                  <p className="sd-line-clamp-2 text-xs sm:text-sm font-bold leading-snug text-ink">{r.title}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
