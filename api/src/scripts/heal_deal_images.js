import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

import fs from 'fs';

// Auto-load .env
if (fs.existsSync('.env')) dotenv.config({ path: '.env' });
if (fs.existsSync('api/.env')) dotenv.config({ path: 'api/.env' });
if (fs.existsSync('../api/.env')) dotenv.config({ path: '../api/.env' });

const MONGODB_URI = process.env.MONGODB_URI;

function isBrokenUrl(url) {
  if (!url || typeof url !== 'string') return true;
  if (url.includes('shoppersdeals-backend-production.up.railway.app')) return true;
  if (url.includes('localhost') || url.includes('127.0.0.1')) return true;
  if (url.includes('placeholder.png')) return true;
  if (url.includes('images-na.ssl-images-amazon.com/images/P/')) return true;
  return false;
}

function cleanTitle(title) {
  if (!title) return '';
  return title
    .replace(/^[\s\d%]+off\s*[:\-|–]?\s*/i, '')
    .replace(/^(?:loot|deal|hot|steal|mega\s*offer|offer\s*zone|today(?:'s)?\s*deal|lightning\s*deal)\s*(?:deal|price)?\s*[:\-|–]?\s*/i, '')
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .split(/[|–—]/)[0]
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchImageFromBuyhatke(title, pid, merchant) {
  try {
    const q = cleanTitle(title).split(' ').slice(0, 5).join(' ');
    if (!q || q.length < 3) return null;

    const sRes = await fetch(`https://buyhatke.com/search?product=${encodeURIComponent(q)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(6000)
    });
    if (!sRes.ok) return null;
    const sHtml = await sRes.text();

    const regex = /href=["'](\/(?:amazon|flipkart|myntra|ajio|tatacliq|nykaa|croma|meesho)-[^"']*price-in-india-[^"']*)["']/g;
    let m;
    const candidates = [];
    while ((m = regex.exec(sHtml)) !== null) {
      candidates.push('https://buyhatke.com' + m[1]);
    }
    if (candidates.length === 0) return null;

    // Inspect first 2 candidates
    for (const cUrl of candidates.slice(0, 2)) {
      const pRes = await fetch(cUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(6000)
      });
      if (!pRes.ok) continue;
      const pHtml = await pRes.text();

      // Look for Flipkart rukminim image or Amazon media image
      const imgMatch = pHtml.match(/(https:\/\/(?:rukminim\d*|static-assets-web)\.flixcart\.com\/image\/[^\s"'>]+(?:\.jpeg|\.jpg))/i)
        || pHtml.match(/(https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9+_-]+(?:\.jpg|\.png))/i);

      if (imgMatch && imgMatch[1]) {
        let found = imgMatch[1];
        if (found.startsWith('https:////')) found = found.replace('https:////', 'https://');
        return found;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function run() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGODB_URI);

  const Deal = mongoose.model('Deal', new mongoose.Schema({}, { strict: false, collection: 'deals' }));
  const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false, collection: 'products' }));

  // Find all active deals with broken/missing images
  const brokenDeals = await Deal.find({
    isVerified: true,
    isExpired: { $ne: true },
    $or: [
      { imageUrl: /shoppersdeals-backend-production\.up\.railway\.app/ },
      { imageUrl: /placeholder\.png/ },
      { imageUrl: /localhost/ },
      { imageUrl: null },
      { imageUrl: '' },
      { imageUrl: { $exists: false } }
    ]
  }).sort({ createdAt: -1 });

  console.log(`Found ${brokenDeals.length} active verified deals with broken images.\n`);

  let healedFromImages = 0;
  let healedFromProduct = 0;
  let healedFromBuyhatke = 0;
  let stillBroken = 0;

  for (let i = 0; i < brokenDeals.length; i++) {
    const deal = brokenDeals[i];
    let resolvedImage = null;

    // Check deal.images array
    const validInImages = (deal.images || []).find(img => !isBrokenUrl(img));
    if (validInImages) {
      resolvedImage = validInImages;
      healedFromImages++;
    }

    // Check corresponding product document
    if (!resolvedImage && deal.productId) {
      const prod = await Product.findOne({ productId: deal.productId }).lean();
      if (prod) {
        if (!isBrokenUrl(prod.imageUrl)) {
          resolvedImage = prod.imageUrl;
          healedFromProduct++;
        } else {
          const validProdImg = (prod.images || []).find(img => !isBrokenUrl(img));
          if (validProdImg) {
            resolvedImage = validProdImg;
            healedFromProduct++;
          }
        }
      }
    }

    // Try Buyhatke lookup
    if (!resolvedImage) {
      const bhImg = await fetchImageFromBuyhatke(deal.title, deal.productId, deal.merchant);
      if (bhImg) {
        resolvedImage = bhImg;
        healedFromBuyhatke++;
      }
    }

    if (resolvedImage) {
      deal.imageUrl = resolvedImage;
      if (!Array.isArray(deal.images) || deal.images.length === 0 || isBrokenUrl(deal.images[0])) {
        deal.images = [resolvedImage];
      }
      await Deal.updateOne({ _id: deal._id }, {
        $set: {
          imageUrl: resolvedImage,
          images: deal.images
        }
      });

      // Also ensure Product collection is updated
      if (deal.productId) {
        await Product.updateOne({ productId: deal.productId }, {
          $set: { imageUrl: resolvedImage }
        });
      }

      console.log(`[${i+1}/${brokenDeals.length}] ✓ Healed: "${deal.title?.slice(0, 40)}" -> ${resolvedImage.slice(0, 60)}...`);
    } else {
      stillBroken++;
      console.log(`[${i+1}/${brokenDeals.length}] ✕ Could not heal: "${deal.title?.slice(0, 40)}" (ID: ${deal.productId})`);
    }

    // Friendly delay
    if (i % 10 === 0) await new Promise(r => setTimeout(r, 100));
  }

  console.log('\n======================================================');
  console.log(`🎉 Healing Complete:`);
  console.log(`- Healed from deal.images:     ${healedFromImages}`);
  console.log(`- Healed from Product catalog: ${healedFromProduct}`);
  console.log(`- Healed from Buyhatke CDN:    ${healedFromBuyhatke}`);
  console.log(`- Still broken / Unresolvable: ${stillBroken}`);
  console.log('======================================================\n');

  await mongoose.disconnect();
}

run().catch(console.error);
