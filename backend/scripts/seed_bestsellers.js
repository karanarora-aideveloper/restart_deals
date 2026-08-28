import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../src/db/models/product.js';
import { scrapeProductDetails } from '../src/listener/verifier.js';

dotenv.config();

// Curated high-demand bestselling product list across key categories in Indian eCommerce
const BESTSELLER_CATALOG = [
  // 1. SMARTPHONES & TABLETS
  {
    cleanUrl: 'https://www.amazon.in/dp/B0CHX1W1XY',
    productId: 'B0CHX1W1XY',
    merchant: 'amazon',
    category: 'electronics',
    title: 'Apple iPhone 15 (128 GB) - Black',
    defaultMRP: 79900,
    defaultPrice: 65999
  },
  {
    cleanUrl: 'https://www.amazon.in/dp/B0CX24B49L',
    productId: 'B0CX24B49L',
    merchant: 'amazon',
    category: 'electronics',
    title: 'OnePlus Nord CE 4 5G (Dark Chrome, 8GB RAM, 128GB Storage)',
    defaultMRP: 24999,
    defaultPrice: 22999
  },
  {
    cleanUrl: 'https://www.amazon.in/dp/B0CS5X6D93',
    productId: 'B0CS5X6D93',
    merchant: 'amazon',
    category: 'electronics',
    title: 'Samsung Galaxy S24 Ultra 5G (Titanium Gray, 12GB, 256GB Storage)',
    defaultMRP: 134999,
    defaultPrice: 119999
  },
  {
    cleanUrl: 'https://www.amazon.in/dp/B09G9FPHY6',
    productId: 'B09G9FPHY6',
    merchant: 'amazon',
    category: 'electronics',
    title: 'Apple iPad (10th Generation): with A14 Bionic chip, 64GB, Wi-Fi',
    defaultMRP: 39900,
    defaultPrice: 34900
  },

  // 2. AUDIO & WEARABLES
  {
    cleanUrl: 'https://www.amazon.in/dp/B09XS7JWHH',
    productId: 'B09XS7JWHH',
    merchant: 'amazon',
    category: 'electronics',
    title: 'Sony WH-1000XM5 Wireless Industry Leading Noise Canceling Headphones',
    defaultMRP: 34990,
    defaultPrice: 26990
  },
  {
    cleanUrl: 'https://www.amazon.in/dp/B09N3ZNHTY',
    productId: 'B09N3ZNHTY',
    merchant: 'amazon',
    category: 'electronics',
    title: 'boAt Airdopes 141 Bluetooth Truly Wireless in Ear Earbuds',
    defaultMRP: 4490,
    defaultPrice: 1099
  },
  {
    cleanUrl: 'https://www.amazon.in/dp/B09NVPSCQT',
    productId: 'B09NVPSCQT',
    merchant: 'amazon',
    category: 'electronics',
    title: 'Noise ColorFit Pulse Grand Smart Watch with 1.69" HD Display',
    defaultMRP: 3999,
    defaultPrice: 1299
  },
  {
    cleanUrl: 'https://www.amazon.in/dp/B09G96TFF7',
    productId: 'B09G96TFF7',
    merchant: 'amazon',
    category: 'electronics',
    title: 'Apple AirPods Pro (2nd Generation) with MagSafe Case (USB-C)',
    defaultMRP: 24900,
    defaultPrice: 21990
  },

  // 3. LAPTOPS & COMPUTING
  {
    cleanUrl: 'https://www.amazon.in/dp/B0B3B7NWVG',
    productId: 'B0B3B7NWVG',
    merchant: 'amazon',
    category: 'electronics',
    title: 'Apple MacBook Air Laptop M2 chip: 13.6-inch Liquid Retina Display',
    defaultMRP: 99900,
    defaultPrice: 87990
  },
  {
    cleanUrl: 'https://www.amazon.in/dp/B09BD6F2VJ',
    productId: 'B09BD6F2VJ',
    merchant: 'amazon',
    category: 'electronics',
    title: 'HP 15s 12th Gen Intel Core i5 15.6inch FHD Laptop (16GB RAM/512GB SSD)',
    defaultMRP: 68900,
    defaultPrice: 52990
  },

  // 4. HOME & KITCHEN APPLIANCES
  {
    cleanUrl: 'https://www.amazon.in/dp/B00935MG14',
    productId: 'B00935MG14',
    merchant: 'amazon',
    category: 'kitchen',
    title: 'Prestige Iris Plus 750 Watt Mixer Grinder with 4 Jars',
    defaultMRP: 6295,
    defaultPrice: 3199
  },
  {
    cleanUrl: 'https://www.amazon.in/dp/B097RFHGK4',
    productId: 'B097RFHGK4',
    merchant: 'amazon',
    category: 'kitchen',
    title: 'Philips Digital Air Fryer HD9252/90 with Rapid Air Technology (4.1 Liter)',
    defaultMRP: 11995,
    defaultPrice: 7999
  },
  {
    cleanUrl: 'https://www.amazon.in/dp/B07WMS7TWB',
    productId: 'B07WMS7TWB',
    merchant: 'amazon',
    category: 'kitchen',
    title: 'Pigeon by Stovekraft 1.5 Litre Electric Kettle (Stainless Steel)',
    defaultMRP: 1195,
    defaultPrice: 599
  },

  // 5. FITNESS & HEALTH SUPPLEMENTS
  {
    cleanUrl: 'https://www.amazon.in/dp/B002DYJZXG',
    productId: 'B002DYJZXG',
    merchant: 'amazon',
    category: 'fitness',
    title: 'Optimum Nutrition (ON) Gold Standard 100% Whey Protein Powder - 2 lbs (Double Rich Chocolate)',
    defaultMRP: 3899,
    defaultPrice: 3099
  },
  {
    cleanUrl: 'https://www.amazon.in/dp/B07S84Y67L',
    productId: 'B07S84Y67L',
    merchant: 'amazon',
    category: 'fitness',
    title: 'MuscleBlaze Biozyme Performance Whey Protein (Rich Chocolate, 1 kg / 2.2 lb)',
    defaultMRP: 3199,
    defaultPrice: 2299
  },
  {
    cleanUrl: 'https://www.amazon.in/dp/B0GPM1V9C5',
    productId: 'B0GPM1V9C5',
    merchant: 'amazon',
    category: 'fitness',
    title: 'Bigmuscles Nutrition Creatine Monohydrate 250g (Unflavoured)',
    defaultMRP: 1199,
    defaultPrice: 725
  },

  // 6. BEAUTY & PERSONAL CARE
  {
    cleanUrl: 'https://www.amazon.in/dp/B01CCGW4OE',
    productId: 'B01CCGW4OE',
    merchant: 'amazon',
    category: 'beauty',
    title: 'Cetaphil Gentle Skin Cleanser for Dry to Normal Sensitive Skin 250ml',
    defaultMRP: 635,
    defaultPrice: 540
  },
  {
    cleanUrl: 'https://www.amazon.in/dp/B08FF3HDJB',
    productId: 'B08FF3HDJB',
    merchant: 'amazon',
    category: 'beauty',
    title: 'Minimalist 10% Niacinamide Face Serum with Zinc for Acne Scars & Blemishes 30ml',
    defaultMRP: 599,
    defaultPrice: 569
  },
  {
    cleanUrl: 'https://www.amazon.in/dp/B09V7N7GZ2',
    productId: 'B09V7N7GZ2',
    merchant: 'amazon',
    category: 'beauty',
    title: 'Philips BT3231/15 Smart Beard Trimmer - 20 Length Settings',
    defaultMRP: 2095,
    defaultPrice: 1549
  },

  // 7. FOOTWEAR & FASHION
  {
    cleanUrl: 'https://www.amazon.in/dp/B000GDC52G',
    productId: 'B000GDC52G',
    merchant: 'amazon',
    category: 'men-fashion',
    title: 'Crocs Unisex-Adult Classic Clogs (Lightweight Water-Resistant)',
    defaultMRP: 3995,
    defaultPrice: 2495
  },
  {
    cleanUrl: 'https://www.amazon.in/dp/B07DW51HBC',
    productId: 'B07DW51HBC',
    merchant: 'amazon',
    category: 'men-fashion',
    title: 'Puma Unisex-Adult Smash V2 L Leather Sneaker',
    defaultMRP: 4499,
    defaultPrice: 2249
  }
];

async function seedBestsellers() {
  console.log('==================================================');
  console.log('      SEEDING BESTSELLER E-COMMERCE CATALOG       ');
  console.log('==================================================');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[DB] Connected to MongoDB.');

  let createdCount = 0;
  let updatedCount = 0;

  for (const item of BESTSELLER_CATALOG) {
    try {
      let existing = await Product.findOne({ productId: item.productId });

      if (existing) {
        // Ensure canonical MRP is set properly
        let updated = false;
        if (!existing.originalPrice && item.defaultMRP) {
          existing.originalPrice = item.defaultMRP;
          updated = true;
        }
        if (!existing.price && item.defaultPrice) {
          existing.price = item.defaultPrice;
          updated = true;
        }
        if (updated) {
          await existing.save();
          console.log(`[Update] Enhanced canonical details for "${existing.title}"`);
          updatedCount++;
        } else {
          console.log(`[Exists] "${existing.title}" already verified in DB.`);
        }
        continue;
      }

      console.log(`[Scraping] Fetching live data for bestseller: ${item.title}...`);
      const scraped = await scrapeProductDetails(item.cleanUrl).catch(() => null);

      const title = scraped?.title || item.title;
      const images = (scraped?.images && scraped.images.length > 0)
        ? scraped.images
        : [`https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500`];
      const imageUrl = images[0] || '';
      const price = scraped?.price || item.defaultPrice;
      const originalPrice = scraped?.originalPrice || item.defaultMRP;
      const rating = scraped?.rating || 4.5;
      const now = new Date();

      const newProduct = new Product({
        productId: item.productId,
        cleanUrl: item.cleanUrl,
        merchant: item.merchant,
        title,
        images,
        imageUrl,
        rating,
        price,
        originalPrice,
        category: item.category,
        priceSource: scraped?.price ? 'scraped' : 'ai_text',
        priceUpdatedAt: now,
        priceHistory: [{
          price,
          originalPrice,
          timestamp: now
        }],
        lastChecked: now,
        isActive: true,
        createdAt: now,
        updatedAt: now
      });

      await newProduct.save();
      console.log(`[Created] ✓ Ingested bestseller "${title}" (Price: ₹${price}, MRP: ₹${originalPrice})`);
      createdCount++;

      // Small delay between requests to be gentle on scraper
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.error(`[Error] Failed to seed "${item.title}":`, err.message);
    }
  }

  console.log('\n==================================================');
  console.log(`  SEEDING COMPLETE: ${createdCount} Created, ${updatedCount} Updated`);
  console.log('==================================================');

  await mongoose.disconnect();
  process.exit(0);
}

seedBestsellers().catch(err => {
  console.error('Fatal seeding error:', err);
  process.exit(1);
});
