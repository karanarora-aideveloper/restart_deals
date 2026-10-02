import { fetchSitemapSummary } from '@/lib/api';
import { SITE_URL } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export async function GET() {
  const summary = await fetchSitemapSummary();
  const inChunks = summary.inChunks || 2;
  const usChunks = summary.usChunks || 2;
  const now = new Date().toISOString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  // 1. Core pages sitemap (Static, categories, best-of guides, blogs - 115 URLs)
  xml += `  <sitemap>\n`;
  xml += `    <loc>${SITE_URL}/sitemaps/pages.xml</loc>\n`;
  xml += `    <lastmod>${now}</lastmod>\n`;
  xml += `  </sitemap>\n`;

  // 2. Active deals sitemap
  xml += `  <sitemap>\n`;
  xml += `    <loc>${SITE_URL}/sitemaps/deals.xml</loc>\n`;
  xml += `    <lastmod>${now}</lastmod>\n`;
  xml += `  </sitemap>\n`;

  // 3. India Products sitemaps (chunked in 5,000s)
  for (let i = 1; i <= inChunks; i++) {
    xml += `  <sitemap>\n`;
    xml += `    <loc>${SITE_URL}/sitemaps/products-in-${i}.xml</loc>\n`;
    xml += `    <lastmod>${now}</lastmod>\n`;
    xml += `  </sitemap>\n`;
  }

  // 4. USA Products sitemaps (chunked in 5,000s)
  for (let i = 1; i <= usChunks; i++) {
    xml += `  <sitemap>\n`;
    xml += `    <loc>${SITE_URL}/sitemaps/products-us-${i}.xml</loc>\n`;
    xml += `    <lastmod>${now}</lastmod>\n`;
    xml += `  </sitemap>\n`;
  }

  xml += `</sitemapindex>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
