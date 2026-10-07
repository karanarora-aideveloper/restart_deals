import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://arorakaran6992:FUpX6I53NEB4UhSW@cluster0.zid9f.mongodb.net/shoppers_deals?retryWrites=true&w=majority';

// Curated authentic Ajio items with official PIDs
const CURATED_AJIO_CODES = [
  '443114762_ltbrown',  // DNMX Women My Space Oversized T-Shirt
  '443115576_green',    // DNMX Men Typographic Print T-Shirt
  '702425190_black',    // Red Tape Men Sneakers
  '443605343_navy',     // GAP Printed Regular Fit T-Shirt
  '703619921_grey',     // Red Tape Flip Flop & Slippers
  '463292672_purple',   // The Bear House Men Slim Fit Shirt
  '469802390_grey',     // Adidas Breaknet 3.0 Sneakers
  '443602498_jetblack', // Flying Machine Men Twill Shirt
  '703590533_lavender', // Nyrika Women Embroidered Kurta Set
  '466736777_multi',    // USOXO Men Pack of 3 Socks
  '466766429_green',    // Jack & Jones Men Slim Fit Polo
  '410263518_whitesilvmt', // Kids 7-8 yrs
  '4945813960_multi',   // Cellecor Neckband Headphone
  '443120042_offwhite', // YB DNMX Boys Boxy Fit T-Shirt
  '703623002_aqua',     // Nyrika Women Kurta Set
];

async function fetchAjioPdp(code) {
  try {
    const url = `https://www.ajio.com/p/${code}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-IN,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!res.ok) {
      console.warn(`[Ajio Fetch] ${code} HTTP ${res.status}`);
      return null;
    }

    const html = await res.text();
    let productDetails = null;

    // 1. Try PRELOADED_STATE
    const stateMatch = html.match(/window\.__PRELOADED_STATE__\s*=\s*(\{.*?\});\s*<\/script>/s);
    if (stateMatch) {
      try {
        const state = JSON.parse(stateMatch[1]);
        productDetails = state.product?.productDetails || null;
      } catch (err) {
        console.warn(`[Ajio Fetch] Failed to parse state for ${code}:`, err.message);
      }
    }

    // 2. Extract official high-resolution image from assets.ajio.com
    let officialImage = null;
    let images = [];

    if (productDetails?.images && Array.isArray(productDetails.images)) {
      images = productDetails.images
        .map((img) => img.url)
        .filter((u) => u && u.includes('assets.ajio.com'))
        .map((u) => u.replace(/-78Wx98H-|-288Wx360H-/, '-473Wx593H-'));
      officialImage = images[0] || null;
    }

    if (!officialImage) {
      const hiResMatch = html.match(/https:\/\/assets\.ajio\.com\/medias\/sys_master\/[^\s\"\'\<\>]+473Wx593H[^\s\"\'\<\>]+/);
      if (hiResMatch) {
        officialImage = hiResMatch[0];
      }
    }

    if (!officialImage) {
      const ogMatch = html.match(/property=[\"']og:image[\"']\s+content=[\"']([^\"']+)[\"']/i) ||
                      html.match(/content=[\"']([^\"']+)[\"']\s+property=[\"']og:image[\"']/i);
      if (ogMatch && ogMatch[1].includes('assets.ajio.com')) {
        officialImage = ogMatch[1].replace(/-78Wx98H-|-288Wx360H-/, '-473Wx593H-');
      }
    }

    if (!officialImage) {
      const anyMatch = html.match(/https:\/\/assets\.ajio\.com\/medias\/sys_master\/[^\s\"\'\<\>]+/);
      if (anyMatch) {
        officialImage = anyMatch[0];
      }
    }

    if (!officialImage) return null;

    if (images.length === 0 && officialImage) {
      images = [officialImage];
    }

    const brandName = productDetails?.brandName || '';
    const rawName = productDetails?.name || '';
    const title = brandName ? `${brandName} ${rawName}` : rawName;
    const price = productDetails?.price?.value || 0;
    const wasPrice = productDetails?.wasPriceData?.value || Math.round(price * 1.4);

    return {
      code,
      title: title.trim(),
      brand: brandName,
      officialImage,
      images,
      price,
      wasPrice,
      cleanUrl: `https://www.ajio.com/p/${code}`,
    };
  } catch (err) {
    console.error(`[Ajio Fetch Error] ${code}:`, err.message);
    return null;
  }
}

async function main() {
  console.log('Connecting to MongoDB Atlas...');
  const conn = await mongoose.connect(MONGODB_URI);
  const db = conn.connection.db;

  console.log('\n--- 1. Remove Invalid / Promotional Placeholder Ajio Items ---');
  const deleteResult = await db.collection('products').deleteMany({
    merchant: 'ajio',
    $or: [
      { price: null },
      { price: { $exists: false } },
      { title: { $in: ['Master Link :', 'SALE IS LIVE!', 'Mens Clothing .', 'Big Loot : Kurta sets', 'Loot : Kurta sets', 'Upto 90% off on ASOS DESIGN women dresses'] } },
      { productId: { $regex: '^https://ajio.me' } },
    ],
  });
  console.log(`Cleaned up ${deleteResult.deletedCount} invalid promotional placeholder items.`);

  console.log('\n--- 2. Fetch Official Images for Curated Ajio Items ---');
  for (const code of CURATED_AJIO_CODES) {
    console.log(`Fetching official PDP data for ${code}...`);
    const data = await fetchAjioPdp(code);
    if (!data || !data.officialImage) {
      console.warn(`Could not resolve official image for ${code}`);
      continue;
    }

    console.log(`✅ ${data.title} -> ${data.officialImage}`);

    const discountPct = data.wasPrice > data.price
      ? Math.round(((data.wasPrice - data.price) / data.wasPrice) * 100)
      : 15;

    // Upsert into products collection
    await db.collection('products').updateOne(
      { productId: code, merchant: 'ajio' },
      {
        $set: {
          title: data.title,
          brand: data.brand,
          cleanUrl: data.cleanUrl,
          imageUrl: data.officialImage,
          images: data.images,
          price: data.price,
          previousPrice: data.wasPrice,
          originalPrice: data.wasPrice,
          discountPercentage: discountPct,
          hasPriceHistory: true,
          isActive: true,
          merchant: 'ajio',
          country: 'IN',
          currency: 'INR',
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    // Upsert as active verified deal if discounted
    if (discountPct > 0) {
      await db.collection('deals').updateOne(
        { productId: code, merchant: 'ajio' },
        {
          $set: {
            title: data.title,
            brand: data.brand,
            dealUrl: data.cleanUrl,
            imageUrl: data.officialImage,
            images: data.images,
            dealPrice: data.price,
            previousPrice: data.wasPrice,
            originalPrice: data.wasPrice,
            discountPercentage: discountPct,
            hasPriceHistory: true,
            isVerified: true,
            isExpired: false,
            merchant: 'ajio',
            sourceEngine: 'engine2',
            sourceChannelId: 'ajio_store_watcher',
            sourceChannelName: 'Ajio Store Watcher',
            sourceMessageId: 'ajio_' + code,
            country: 'IN',
            currency: 'INR',
            category: 'fashion',
            subcategory: 'clothing',
            updatedAt: new Date(),
            lastVerifiedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );
    }
  }

  console.log('\n--- 3. Fix Existing Ajio Products Image URLs ---');
  const existingAjio = await db.collection('products').find({ merchant: 'ajio' }).toArray();
  for (const p of existingAjio) {
    if (p.imageUrl && p.imageUrl.includes('assets.ajio.com')) continue;

    // Check cleanUrl or productId for code
    let code = p.productId;
    if (p.cleanUrl && p.cleanUrl.includes('/p/')) {
      const match = p.cleanUrl.match(/\/p\/([^\/\?#]+)/);
      if (match) code = match[1];
    }

    if (code && !code.startsWith('bh_') && !code.startsWith('http')) {
      const data = await fetchAjioPdp(code);
      if (data && data.officialImage) {
        console.log(`Updated existing product ${p.title} -> ${data.officialImage}`);
        await db.collection('products').updateOne(
          { _id: p._id },
          {
            $set: {
              imageUrl: data.officialImage,
              images: data.images,
              title: data.title || p.title,
            },
          }
        );

        // Also update any matching deals
        await db.collection('deals').updateMany(
          { productId: p.productId, merchant: 'ajio' },
          {
            $set: {
              imageUrl: data.officialImage,
              images: data.images,
              title: data.title || p.title,
              isExpired: false,
              isVerified: true,
            },
          }
        );
      }
    } else if (p.cleanUrl && p.cleanUrl.includes('buyhatke.com')) {
      // Extract from buyhatke
      try {
        const res = await fetch(p.cleanUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (res.ok) {
          const text = await res.text();
          const match = text.match(/https:\/\/assets\.ajio\.com\/medias\/sys_master\/[^\s\"\'\<\>\;\)]+/);
          if (match) {
            const officialImg = match[0].replace(/-78Wx98H-|-288Wx360H-/, '-473Wx593H-');
            console.log(`Buyhatke resolved image for ${p.title} -> ${officialImg}`);
            await db.collection('products').updateOne(
              { _id: p._id },
              { $set: { imageUrl: officialImg, images: [officialImg] } }
            );
          }
        }
      } catch (err) {}
    }
  }

  console.log('\n--- 4. Verify Final Ajio Item Images in Database ---');
  const finalProds = await db.collection('products').find({ merchant: 'ajio' }).toArray();
  const finalDeals = await db.collection('deals').find({ merchant: 'ajio', isExpired: { $ne: true } }).toArray();

  console.log(`Total Ajio Products: ${finalProds.length}`);
  finalProds.forEach((p, i) => {
    const isOfficial = p.imageUrl?.includes('assets.ajio.com');
    console.log(`${i + 1}. [${isOfficial ? 'OFFICIAL ✅' : 'OTHER ⚠️'}] ${p.title?.slice(0, 45)} | ${p.imageUrl?.slice(0, 65)}`);
  });

  console.log(`\nTotal Active Ajio Deals: ${finalDeals.length}`);
  finalDeals.forEach((d, i) => {
    const isOfficial = d.imageUrl?.includes('assets.ajio.com');
    console.log(`${i + 1}. [${isOfficial ? 'OFFICIAL ✅' : 'OTHER ⚠️'}] ${d.title?.slice(0, 45)} | Price: ₹${d.dealPrice} (was ₹${d.previousPrice}) | ${d.imageUrl?.slice(0, 65)}`);
  });

  await conn.disconnect();
  console.log('\nMigration and enrichment complete!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
