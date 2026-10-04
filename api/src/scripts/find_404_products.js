import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Product from '../db/models/product.js';
import Deal from '../db/models/deal.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../backend/.env') });

async function diagnose() {
  console.log('================================================================');
  console.log('       IN-DEPTH 404 DIAGNOSTIC FOR PRODUCTS & DEALS             ');
  console.log('================================================================\n');

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[DB] Connected to MongoDB Atlas.');

  // 1. Fetch all products into memory
  console.log('[1] Fetching all product IDs from MongoDB...');
  const t0 = Date.now();
  const allProducts = await Product.find({}, '_id productId country merchant cleanUrl title').lean();
  console.log(` -> Loaded ${allProducts.length} products in ${Date.now() - t0}ms.`);

  const productById = new Set(allProducts.map((p) => p._id.toString()));
  const productByPid = new Map();
  for (const p of allProducts) {
    if (p.productId) {
      productByPid.set(p.productId, p);
    }
  }

  // 2. Fetch all deals into memory
  console.log('\n[2] Fetching all active deals from MongoDB...');
  const t1 = Date.now();
  const allDeals = await Deal.find({}, '_id productId country merchant dealUrl title matchedProductId isExpired').lean();
  console.log(` -> Loaded ${allDeals.length} deals in ${Date.now() - t1}ms.`);

  // 3. Analyze Deals vs Products
  console.log('\n[3] Checking Deals -> Products linkage...');
  const dealsWithNoProductDoc = [];
  const dealsWithNoPid = [];

  for (const deal of allDeals) {
    if (!deal.productId) {
      dealsWithNoPid.push(deal);
      continue;
    }
    const matched = productByPid.get(deal.productId);
    if (!matched) {
      dealsWithNoProductDoc.push(deal);
    }
  }

  console.log(` -> Total Deals: ${allDeals.length}`);
  console.log(` -> Deals without productId: ${dealsWithNoPid.length}`);
  console.log(` -> Deals with NO corresponding Product in database: ${dealsWithNoProductDoc.length}`);

  if (dealsWithNoProductDoc.length > 0) {
    console.log('\nSample Deals missing from Product catalog (these 404 if /product/:id is visited):');
    dealsWithNoProductDoc.slice(0, 10).forEach((d) => {
      console.log(`   - Deal ID: ${d._id} | PID: ${d.productId} | Store: ${d.merchant} | Title: "${d.title?.substring(0, 45)}"`);
    });
  }

  // 4. Test live website URLs from sitemaps to catch real 404s!
  console.log('\n[4] Testing live website URLs from ShoppersDeals sitemaps...');
  try {
    const sitemapRes = await fetch('https://www.shoppersdeals.in/sitemaps/pages.xml', { headers: { 'User-Agent': 'curl/7.88.1' } });
    console.log(` -> pages.xml HTTP status: ${sitemapRes.status}`);

    const dealsSitemapRes = await fetch('https://www.shoppersdeals.in/sitemaps/deals.xml', { headers: { 'User-Agent': 'curl/7.88.1' } });
    console.log(` -> deals.xml HTTP status: ${dealsSitemapRes.status}`);

    if (dealsSitemapRes.ok) {
      const dealsXml = await dealsSitemapRes.text();
      const dealUrls = [...dealsXml.matchAll(/<loc>(https:\/\/www\.shoppersdeals\.in\/deal\/[^<]+)<\/loc>/g)].map(m => m[1]);
      console.log(` -> Found ${dealUrls.length} deal URLs in /sitemaps/deals.xml.`);

      // Test first 20 deal URLs
      console.log(' -> Testing 20 sample deal URLs on live site:');
      const test404s = [];
      for (const u of dealUrls.slice(0, 20)) {
        const r = await fetch(u, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0' } });
        const dealId = u.split('/').pop();
        if (r.status === 404) {
          test404s.push({ url: u, status: 404, id: dealId });
        } else if (r.status === 308 || r.status === 307 || r.status === 301) {
          const loc = r.headers.get('location');
          // If redirected to /product/..., check if the product page returns 404!
          if (loc) {
            const fullLoc = loc.startsWith('http') ? loc : `https://www.shoppersdeals.in${loc}`;
            const prodRes = await fetch(fullLoc, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (prodRes.status === 404) {
              test404s.push({ url: u, redirectedTo: fullLoc, status: 404, id: dealId });
            }
          }
        }
      }
      console.log(` -> 404s found in sample: ${test404s.length}`);
      if (test404s.length > 0) {
        console.log('404 URLs found:', JSON.stringify(test404s, null, 2));
      }
    }

    // Check India products sitemap
    const prodsInRes = await fetch('https://www.shoppersdeals.in/sitemaps/products-in-1.xml', { headers: { 'User-Agent': 'curl/7.88.1' } });
    console.log(` -> products-in-1.xml HTTP status: ${prodsInRes.status}`);
    if (prodsInRes.ok) {
      const prodsXml = await prodsInRes.text();
      const prodUrls = [...prodsXml.matchAll(/<loc>(https:\/\/www\.shoppersdeals\.in\/product\/[^<]+)<\/loc>/g)].map(m => m[1]);
      console.log(` -> Found ${prodUrls.length} product URLs in /sitemaps/products-in-1.xml.`);

      console.log(' -> Testing 20 sample product URLs on live site:');
      const prod404s = [];
      for (const u of prodUrls.slice(0, 20)) {
        const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (r.status === 404) {
          prod404s.push({ url: u, status: 404, id: u.split('/').pop() });
        }
      }
      console.log(` -> 404s found in product sample: ${prod404s.length}`);
      if (prod404s.length > 0) {
        console.log('404 Product URLs found:', JSON.stringify(prod404s, null, 2));
      }
    }
  } catch (err) {
    console.error('Error testing live URLs:', err.message);
  }

  await mongoose.disconnect();
  console.log('\n[Done] Diagnostic concluded.');
}

diagnose().catch(console.error);
