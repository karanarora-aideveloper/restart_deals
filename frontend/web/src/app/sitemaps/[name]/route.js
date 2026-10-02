import blogsData from '@/data/blogs.json';
import { fetchSitemapProducts, fetchSitemapDeals } from '@/lib/api';
import { SITE_URL } from '@/lib/config';
import { TOP_CURATED_BEST_SLUGS } from '@/lib/bestCategories';
import { CATEGORY_LABELS, SUBCATEGORY_LABELS } from '@/lib/taxonomy';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

function toXmlUrlset(urls) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  for (const item of urls) {
    xml += `  <url>\n`;
    xml += `    <loc>${item.url}</loc>\n`;
    if (item.lastModified) {
      xml += `    <lastmod>${item.lastModified}</lastmod>\n`;
    }
    if (item.changeFrequency) {
      xml += `    <changefreq>${item.changeFrequency}</changefreq>\n`;
    }
    if (item.priority !== undefined) {
      xml += `    <priority>${item.priority}</priority>\n`;
    }
    xml += `  </url>\n`;
  }
  xml += `</urlset>`;
  return xml;
}

export async function GET(request, { params }) {
  const resolvedParams = params && typeof params.then === 'function' ? await params : params;
  const name = resolvedParams?.name || '';
  const now = new Date().toISOString();

  // 1. Core pages sitemap (/sitemaps/pages.xml)
  if (name === 'pages.xml') {
    const staticRoutes = [
      '',
      '/hot',
      '/products',
      '/compare',
      '/categories',
      '/sitemap',
      '/blog',
      '/privacy',
      '/affiliate-disclosure',
    ].map((path) => ({
      url: `${SITE_URL}${path}`,
      lastModified: now,
      changeFrequency: path === '' || path === '/hot' ? 'always' : 'daily',
      priority: path === '' ? 1.0 : 0.8,
    }));

    const categoryRoutes = Object.keys(CATEGORY_LABELS).map((cat) => ({
      url: `${SITE_URL}/categories/${cat}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.85,
    }));

    const allBestSlugs = Array.from(
      new Set([...Object.keys(TOP_CURATED_BEST_SLUGS), ...Object.keys(SUBCATEGORY_LABELS)])
    );

    const bestRoutes = allBestSlugs.map((slug) => ({
      url: `${SITE_URL}/best/${slug}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    }));

    const blogRoutes = (blogsData || []).map((post) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: post.date ? new Date(post.date).toISOString() : now,
      changeFrequency: 'monthly',
      priority: 0.7,
    }));

    const xml = toXmlUrlset([
      ...staticRoutes,
      ...categoryRoutes,
      ...bestRoutes,
      ...blogRoutes,
    ]);

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  }

  // 2. Deals sitemap (/sitemaps/deals.xml)
  if (name === 'deals.xml') {
    const deals = await fetchSitemapDeals();
    const dealUrls = deals.map((d) => ({
      url: `${SITE_URL}/deal/${d.id}`,
      lastModified: d.lastmod ? new Date(d.lastmod).toISOString() : now,
      changeFrequency: 'hourly',
      priority: 0.7,
    }));

    const xml = toXmlUrlset(dealUrls);
    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400',
      },
    });
  }

  // 3. India Products sitemap (/sitemaps/products-in-[page].xml)
  const inMatch = name.match(/^products-in-(\d+)\.xml$/);
  if (inMatch) {
    const page = parseInt(inMatch[1], 10);
    const products = await fetchSitemapProducts({ country: 'IN', page, limit: 5000 });
    const productUrls = products.map((p) => ({
      url: `${SITE_URL}/product/${p.id}`,
      lastModified: p.lastmod ? new Date(p.lastmod).toISOString() : now,
      changeFrequency: 'daily',
      priority: 0.75,
    }));

    const xml = toXmlUrlset(productUrls);
    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=7200, stale-while-revalidate=86400',
      },
    });
  }

  // 4. USA Products sitemap (/sitemaps/products-us-[page].xml)
  const usMatch = name.match(/^products-us-(\d+)\.xml$/);
  if (usMatch) {
    const page = parseInt(usMatch[1], 10);
    const products = await fetchSitemapProducts({ country: 'US', page, limit: 5000 });
    const productUrls = products.map((p) => ({
      url: `${SITE_URL}/product/${p.id}`,
      lastModified: p.lastmod ? new Date(p.lastmod).toISOString() : now,
      changeFrequency: 'daily',
      priority: 0.75,
    }));

    const xml = toXmlUrlset(productUrls);
    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=7200, stale-while-revalidate=86400',
      },
    });
  }

  return new Response('Sitemap Not Found', { status: 404 });
}
