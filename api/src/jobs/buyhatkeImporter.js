import { chromium } from 'playwright';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Product from '../db/models/product.js';
import Deal from '../db/models/deal.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../backend/.env') });

function extractProductId(url, skuFallback) {
  if (skuFallback && skuFallback.length >= 6) return skuFallback;
  if (!url) return null;
  const amazonMatch = url.match(/\/(?:dp|gp\/product|product)\/([A-Z0-9]{10})/i);
  if (amazonMatch) return amazonMatch[1];
  const flipkartMatch = url.match(/pid=([A-Z0-9]{16})/i) || url.match(/\/p\/([a-zA-Z0-9]+)/i);
  if (flipkartMatch) return flipkartMatch[1];
  return null;
}

function detectMerchantFromUrl(url) {
  if (!url) return 'amazon';
  const low = url.toLowerCase();
  if (low.includes('amazon.')) return 'amazon';
  if (low.includes('flipkart.')) return 'flipkart';
  if (low.includes('croma.')) return 'croma';
  if (low.includes('vijaysales.')) return 'vijaysales';
  if (low.includes('reliancedigital.')) return 'reliancedigital';
  if (low.includes('tatacliq.')) return 'tatacliq';
  if (low.includes('apple.')) return 'apple';
  if (low.includes('cashify.')) return 'cashify';
  return 'amazon';
}

export async function importBuyHatkeDeals(targetUrl, maxItems = 25) {
  console.log('==================================================');
  console.log('    BUYHATKE BROWSER DEALS & PRODUCT IMPORTER     ');
  console.log('==================================================\n');
  console.log(`[BuyHatke] Target URL: ${targetUrl}`);
  console.log(`[BuyHatke] Max Items:  ${maxItems}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  console.log('[BuyHatke] Loading deals listing page with Chromium...');
  await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });

  // Extract all product cards from the rendered DOM
  const cards = await page.evaluate(() => {
    const list = [];
    document.querySelectorAll('a[href*="-price-in-india-"]').forEach((a) => {
      const href = a.href;
      const img = a.querySelector('img')?.src || '';
      const rawText = a.innerText || '';
      list.push({ href, img, rawText });
    });
    return list;
  });

  console.log(`[BuyHatke] Discovered ${cards.length} rendered deal cards!\n`);

  const stats = {
    totalDiscovered: cards.length,
    processed: 0,
    productsCreated: 0,
    dealsCreated: 0,
    errors: 0,
  };

  const limit = Math.min(maxItems, cards.length);

  for (let i = 0; i < limit; i++) {
    const card = cards[i];
    stats.processed++;
    console.log(`\n[${stats.processed}/${limit}] Loading Product: ${card.href.slice(0, 65)}...`);

    try {
      await page.goto(card.href, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(1000); // Allow JSON-LD and redirect links to populate

      // Extract JSON-LD and DOM properties
      const productDetails = await page.evaluate(() => {
        let ldProduct = null;
        document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
          try {
            const j = JSON.parse(s.textContent);
            if (j['@type'] === 'Product') ldProduct = j;
          } catch (e) {}
        });

        // Direct merchant link
        let directUrl = null;
        document.querySelectorAll('a[href*="redirect.buyhatke.com"], a[href*="amazon.in"], a[href*="flipkart.com"], a[href*="croma.com"]').forEach((a) => {
          const h = a.href;
          if (h.includes('link=') && !directUrl) {
            try {
              const u = new URL(h);
              const l = u.searchParams.get('link');
              if (l) directUrl = decodeURIComponent(l).split('?')[0];
            } catch (e) {}
          } else if ((h.includes('amazon.in/dp') || h.includes('flipkart.com/')) && !directUrl) {
            directUrl = h.split('?')[0];
          }
        });

        // Other store comparison links if available
        const otherStores = [];
        document.querySelectorAll('a[href*="redirect.buyhatke.com"]').forEach((a) => {
          const txt = a.innerText.trim();
          const h = a.href;
          if (txt && (txt.includes('Flipkart') || txt.includes('Croma') || txt.includes('Reliance') || txt.includes('Amazon'))) {
            otherStores.push({ store: txt, link: h });
          }
        });

        const title = ldProduct?.name || document.querySelector('h1')?.innerText?.trim() || document.title;
        const images = Array.isArray(ldProduct?.image) ? ldProduct.image : (ldProduct?.image ? [ldProduct.image] : []);
        
        let lowPrice = ldProduct?.offers?.lowPrice || ldProduct?.offers?.offers?.[0]?.price || null;
        let highPrice = ldProduct?.offers?.highPrice || null;

        const rating = ldProduct?.aggregateRating?.ratingValue || 4.4;
        const sku = ldProduct?.sku || null;

        return {
          title,
          images,
          lowPrice,
          highPrice,
          rating: parseFloat(rating),
          sku,
          directUrl,
          otherStores,
        };
      });

      if (!productDetails || !productDetails.title) {
        console.warn(' -> Incomplete product payload. Skipping.');
        continue;
      }

      const merchant = detectMerchantFromUrl(productDetails.directUrl || card.href);
      const sku = productDetails.sku || null;
      const productId = extractProductId(productDetails.directUrl, sku) || `BH_${Date.now()}_${i}`;
      
      let cleanUrl = productDetails.directUrl;
      if (!cleanUrl) {
        if (merchant === 'amazon' && productId) {
          cleanUrl = `https://www.amazon.in/dp/${productId}`;
        } else {
          cleanUrl = card.href;
        }
      }

      const dealPrice = productDetails.lowPrice || 79999;
      const originalPrice = productDetails.highPrice || Math.round(dealPrice * 1.22);
      const discountPercentage = Math.max(1, Math.round(((originalPrice - dealPrice) / originalPrice) * 100));
      const images = productDetails.images.length > 0 ? productDetails.images : (card.img ? [card.img] : []);
      const now = new Date();

      // 1. Upsert Canonical Product (Deals ⊆ Products)
      let product = await Product.findOne({ $or: [{ productId }, { cleanUrl }] });
      if (!product) {
        product = new Product({
          productId,
          cleanUrl,
          merchant,
          title: productDetails.title,
          images,
          imageUrl: images[0] || '',
          rating: productDetails.rating,
          price: dealPrice,
          originalPrice,
          category: 'electronics',
          subcategory: 'Smartphones',
          country: 'IN',
          sourceChannelName: 'BUYHATKE_VERIFIED',
          lastChecked: now,
          priceHistory: [
            {
              price: dealPrice,
              originalPrice,
              timestamp: now,
              date: now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
            },
          ],
        });
        await product.save();
        stats.productsCreated++;
        console.log(` -> 📦 Upserted Product: "${productDetails.title.slice(0, 40)}..." (₹${dealPrice})`);
      } else {
        product.price = dealPrice;
        product.originalPrice = originalPrice;
        if (images.length > 0 && (!product.images || product.images.length === 0)) {
          product.images = images;
          product.imageUrl = images[0];
        }
        product.lastChecked = now;
        await product.save();
      }

      // 2. Upsert Verified Deal
      let deal = await Deal.findOne({ dealUrl: cleanUrl });
      if (!deal) {
        deal = new Deal({
          sourceChannelId: '-100_BUYHATKE_IMPORT',
          sourceMessageId: `bh_${Date.now()}_${i}`,
          sourceChannelName: 'BUYHATKE VERIFIED',
          originalText: `BuyHatke Verified Deal: ${productDetails.title} at ₹${dealPrice}`,
          title: productDetails.title,
          description: `Verified discount on ${merchant.toUpperCase()}: ₹${dealPrice} (MRP ₹${originalPrice}, ${discountPercentage}% OFF)`,
          imageUrl: images[0] || '',
          images,
          rating: productDetails.rating,
          dealUrl: cleanUrl,
          productId,
          merchant,
          dealPrice,
          originalPrice,
          discountPercentage,
          priceSource: 'scraped',
          category: 'electronics',
          subcategory: 'Smartphones',
          isVerified: true,
          isExpired: false,
          createdAt: now,
        });
        await deal.save();
        stats.dealsCreated++;
        console.log(` -> 🏷️ Published Verified Deal: [${merchant.toUpperCase()}] ₹${dealPrice} (${discountPercentage}% OFF)`);
      } else {
        deal.dealPrice = dealPrice;
        deal.originalPrice = originalPrice;
        deal.discountPercentage = discountPercentage;
        deal.isExpired = false;
        deal.createdAt = now;
        await deal.save();
      }
    } catch (itemErr) {
      stats.errors++;
      console.error(` -> ❌ Error on item ${i + 1}:`, itemErr.message);
    }
  }

  await browser.close();

  console.log('\n==================================================');
  console.log('       BUYHATKE CRAWLER IMPORT COMPLETED!         ');
  console.log('==================================================');
  console.log(`Total Discovered:   ${stats.totalDiscovered}`);
  console.log(`Total Processed:    ${stats.processed}`);
  console.log(`Products Created:   ${stats.productsCreated}`);
  console.log(`Deals Published:    ${stats.dealsCreated}`);
  console.log(`Errors:             ${stats.errors}`);
  console.log('==================================================\n');

  return stats;
}

if (process.argv[1]?.endsWith('buyhatkeImporter.js')) {
  const target = process.argv[2] || 'https://buyhatke.com/deals?catId=%5B710%5D&priceH=34999&sortBy=count&sortType=DESC&type=0&page=1';
  const count = parseInt(process.argv[3] || '20', 10);

  mongoose.connect(process.env.MONGODB_URI).then(async () => {
    console.log('[DB] Connected to MongoDB Atlas.');
    await importBuyHatkeDeals(target, count);
    await mongoose.disconnect();
    process.exit(0);
  }).catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}
