import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: 'api/.env' });
dotenv.config({ path: 'backend/.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://arorakaran6992:FUpX6I53NEB4UhSW@cluster0.zid9f.mongodb.net/shoppers_deals?retryWrites=true&w=majority';

function isBrokenUrl(url) {
  if (!url || typeof url !== 'string') return true;
  const u = url.toLowerCase();
  if (u.includes('placeholder.png')) return true;
  if (u.includes('/media/telegram/')) return true;
  if (u.includes('shoppersdeals-backend')) return true;
  if (u.includes('localhost') || u.includes('127.0.0.1')) return true;
  if (u.includes('images-na.ssl-images-amazon.com/images/p/')) return true;
  return false;
}

function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  let u = url.trim();
  if (u.startsWith('http://') && !u.includes('localhost') && !u.includes('127.0.0.1')) {
    u = u.replace(/^http:\/\//i, 'https://');
  }
  return u;
}

function cleanTitle(title) {
  if (!title) return '';
  return title
    .replace(/^\[?apply\s+(?:₹?\d+%?|\d+%)?\s*(?:off)?\s*coupon\]?\s*[:|–-]?\s*/i, '')
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

async function fetchCdnImage(title) {
  const q = cleanTitle(title).split(' ').slice(0, 5).join(' ');
  if (!q || q.length < 3) return null;
  try {
    const res = await fetch('https://buyhatke.com/search?product=' + encodeURIComponent(q), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/(https:\/\/(?:rukminim\d*|static-assets-web)\.flixcart\.com\/image\/[^\s\"'>]+(?:\.jpeg|\.jpg))/i)
      || html.match(/(https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9+_-]+(?:\.jpg|\.png))/i);
    return match ? normalizeUrl(match[1]) : null;
  } catch {
    return null;
  }
}

async function run() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGODB_URI);

  const Deal = mongoose.model('Deal', new mongoose.Schema({}, { strict: false, collection: 'deals' }));
  const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false, collection: 'products' }));

  const activeDeals = await Deal.find(
    { isExpired: { $ne: true }, isVerified: true },
    { _id: 1, title: 1, productId: 1, imageUrl: 1, images: 1, dealUrl: 1, isVerified: 1, isExpired: 1 }
  ).lean();

  console.log(`Auditing ${activeDeals.length} active verified deals for broken/missing images...\n`);

  let healedFromImages = 0;
  let healedFromProduct = 0;
  let healedFromHttpUpgrade = 0;
  let healedFromCdn = 0;
  let expiredUnresolvable = 0;
  let alreadyHealthy = 0;

  for (let i = 0; i < activeDeals.length; i++) {
    const deal = activeDeals[i];
    let currentImg = normalizeUrl(deal.imageUrl || (Array.isArray(deal.images) && deal.images[0]) || '');
    let resolvedImage = null;

    // 1. If currently an insecure http:// URL that is otherwise healthy, simply upgrade to https
    if (deal.imageUrl && deal.imageUrl.startsWith('http://') && !isBrokenUrl(deal.imageUrl)) {
      resolvedImage = normalizeUrl(deal.imageUrl);
      healedFromHttpUpgrade++;
    }

    // 2. Check if deal.images contains a valid alternative
    if (!resolvedImage && isBrokenUrl(currentImg)) {
      const validInImages = (deal.images || []).map(normalizeUrl).find(img => !isBrokenUrl(img));
      if (validInImages) {
        resolvedImage = validInImages;
        healedFromImages++;
      }
    }

    // 3. Check corresponding Product catalog entry
    if (!resolvedImage && isBrokenUrl(currentImg) && deal.productId) {
      const prod = await Product.findOne({ productId: deal.productId }).lean();
      if (prod) {
        const prodImg = normalizeUrl(prod.imageUrl);
        if (!isBrokenUrl(prodImg)) {
          resolvedImage = prodImg;
          healedFromProduct++;
        } else {
          const validProdAlt = (prod.images || []).map(normalizeUrl).find(img => !isBrokenUrl(img));
          if (validProdAlt) {
            resolvedImage = validProdAlt;
            healedFromProduct++;
          }
        }
      }
    }

    // 4. Query external CDN / Buyhatke search if still broken
    if (!resolvedImage && isBrokenUrl(currentImg)) {
      const cdnImg = await fetchCdnImage(deal.title);
      if (cdnImg) {
        resolvedImage = cdnImg;
        healedFromCdn++;
      }
    }

    // Update or expire
    if (resolvedImage && resolvedImage !== deal.imageUrl) {
      const updatedImages = Array.isArray(deal.images) && deal.images.length > 0 ? [resolvedImage, ...deal.images.map(normalizeUrl).filter(img => !isBrokenUrl(img) && img !== resolvedImage)] : [resolvedImage];
      await Deal.updateOne({ _id: deal._id }, {
        $set: {
          imageUrl: resolvedImage,
          images: updatedImages,
          isVerified: true
        }
      });
      if (deal.productId) {
        await Product.updateOne({ productId: deal.productId }, {
          $set: { imageUrl: resolvedImage }
        }).catch(() => {});
      }
      console.log(`[${i+1}/${activeDeals.length}] ✓ HEALED: "${deal.title?.slice(0, 35)}" -> ${resolvedImage.slice(0, 60)}`);
    } else if (isBrokenUrl(currentImg)) {
      // Still broken after all attempts -> gracefully unverify/expire so homepage remains pristine
      expiredUnresolvable++;
      await Deal.updateOne({ _id: deal._id }, {
        $set: {
          isExpired: true,
          isVerified: false,
          expiredAt: new Date(),
          expiryReason: 'unresolvable_image'
        }
      });
      console.log(`[${i+1}/${activeDeals.length}] ✕ UNRESOLVABLE (Expired): "${deal.title?.slice(0, 35)}"`);
    } else {
      alreadyHealthy++;
    }

    // Slight pacing every 10 deals
    if (i % 10 === 0 && i > 0) {
      await new Promise(r => setTimeout(r, 60));
    }
  }

  console.log('\n======================================================');
  console.log('🎉 IMAGE HEALING SWEEP COMPLETE');
  console.log('======================================================');
  console.log(`Total Deals Audited:            ${activeDeals.length}`);
  console.log(`Already Healthy Deals:          ${alreadyHealthy}`);
  console.log(`Healed from HTTPS Upgrade:      ${healedFromHttpUpgrade}`);
  console.log(`Healed from deal.images array:  ${healedFromImages}`);
  console.log(`Healed from Product catalog:    ${healedFromProduct}`);
  console.log(`Healed from CDN / Buyhatke:     ${healedFromCdn}`);
  console.log(`Cleanly Expired (Unresolvable): ${expiredUnresolvable}`);
  console.log('======================================================\n');

  await mongoose.disconnect();
}

run().catch(console.error);
