import express from 'express';
import Deal from '../db/models/deal.js';
import Product from '../db/models/product.js';

const router = express.Router();

/**
 * GET /api/seo/sitemap-data
 * Fast, lightweight endpoint for Next.js dynamic sitemap generator.
 * Returns only necessary fields for URL construction and lastmod.
 */
router.get('/sitemap-data', async (req, res) => {
  try {
    const [products, deals] = await Promise.all([
      Product.find(
        { imageUrl: { $exists: true, $ne: '' } },
        '_id productId merchant imageUrl updatedAt lastChecked category subcategory'
      )
        .sort({ updatedAt: -1 })
        .limit(10000)
        .lean(),
      Deal.find(
        { imageUrl: { $exists: true, $ne: '' }, isExpired: { $ne: true } },
        '_id productId merchant imageUrl updatedAt createdAt category subcategory'
      )
        .sort({ createdAt: -1 })
        .limit(5000)
        .lean(),
    ]);

    res.json({
      success: true,
      products,
      deals,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[API Error] GET /api/seo/sitemap-data failed:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch sitemap data' });
  }
});

/**
 * GET /sitemap.xml
 * Dynamically generates sitemap from active deals and products.
 */
router.get('/sitemap.xml', async (req, res) => {
  try {
    // Fetch recent 1000 deals (or all active)
    const deals = await Deal.find({}, '_id updatedAt').sort({ createdAt: -1 }).limit(1000);
    const products = await Product.find({}, '_id updatedAt').sort({ createdAt: -1 }).limit(1000);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Static pages
    const baseUrl = 'https://www.shoppersdeals.in';
    const staticPages = ['', '/privacy'];
    
    for (const page of staticPages) {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}${page}</loc>\n`;
      xml += `    <changefreq>daily</changefreq>\n`;
      xml += `    <priority>${page === '' ? '1.0' : '0.5'}</priority>\n`;
      xml += `  </url>\n`;
    }

    // Deals
    for (const deal of deals) {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/deal/${deal._id}</loc>\n`;
      const date = deal.updatedAt ? new Date(deal.updatedAt).toISOString() : new Date().toISOString();
      xml += `    <lastmod>${date}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    }

    xml += `</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    console.error('[API Error] GET /sitemap.xml failed:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * GET /deal/:id
 * Server-Side Rendered (SSR) HTML for SEO and Social Sharing
 */
router.get('/deal/:id', async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id);
    if (!deal) {
      return res.status(404).send('Deal not found');
    }

    const title = deal.title || 'Shoppers Deals';
    const desc = deal.description || 'Get the best deals on Shoppers Deals';
    const image = deal.imageUrl || 'https://www.shoppersdeals.in/logo.png'; // Fallback
    const url = `https://www.shoppersdeals.in/deal/${deal._id}`;
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta name="description" content="${desc.replace(/"/g, '&quot;')}">
    
    <!-- Open Graph / Social Media -->
    <meta property="og:title" content="${title.replace(/"/g, '&quot;')}">
    <meta property="og:description" content="${desc.replace(/"/g, '&quot;')}">
    <meta property="og:image" content="${image}">
    <meta property="og:url" content="${url}">
    <meta property="og:type" content="website">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title.replace(/"/g, '&quot;')}">
    <meta name="twitter:description" content="${desc.replace(/"/g, '&quot;')}">
    <meta name="twitter:image" content="${image}">

    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
        .card { background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); max-width: 500px; width: 100%; overflow: hidden; text-align: center; }
        .image-container { background: white; padding: 20px; text-align: center; }
        .image-container img { max-width: 100%; max-height: 300px; object-fit: contain; }
        .content { padding: 24px; text-align: left; }
        .title { font-size: 1.25rem; font-weight: 700; color: #111827; margin: 0 0 12px 0; }
        .price { font-size: 1.5rem; font-weight: 800; color: #ff6b00; margin: 0 0 8px 0; }
        .desc { color: #4b5563; font-size: 0.95rem; line-height: 1.5; margin: 0 0 24px 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        .btn { display: block; width: 100%; background: #ff6b00; color: white; text-align: center; padding: 14px 0; border-radius: 8px; font-weight: 600; text-decoration: none; font-size: 1.1rem; box-sizing: border-box; }
        .btn:hover { background: #ea580c; }
        .header { background: #111827; padding: 16px; text-align: center; }
        .header a { color: white; text-decoration: none; font-weight: 700; font-size: 1.2rem; }
    </style>
    <script>
      // Auto-redirect to the actual deal URL if they land here
      // Commented out to allow Google to read the page normally and users to see the landing page.
      // setTimeout(() => { window.location.href = "${deal.dealUrl}"; }, 3000);
    </script>
</head>
<body>
    <div class="card">
        <div class="header">
            <a href="https://www.shoppersdeals.in">Shoppers Deals</a>
        </div>
        <div class="image-container">
            <img src="${image}" alt="${title.replace(/"/g, '&quot;')}">
        </div>
        <div class="content">
            <h1 class="title">${title}</h1>
            ${deal.dealPrice ? `<div class="price">₹${deal.dealPrice.toLocaleString('en-IN')}</div>` : ''}
            <p class="desc">${desc}</p>
            <a href="${deal.dealUrl}" class="btn" rel="nofollow noreferrer">Get Deal Now</a>
        </div>
    </div>
</body>
</html>`;
    
    res.send(html);
  } catch (err) {
    console.error('[API Error] GET /deal/:id failed:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

export default router;
