import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Product from '../db/models/product.js';
import { extractVariant } from '../utils/variantExtractor.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../backend/.env') });

const CROSS_STORE_PAIRS = [
  // 1. MacBook Air M2 256GB
  {
    amazon: {
      productId: 'B0B3C42581',
      merchant: 'amazon',
      cleanUrl: 'https://www.amazon.in/dp/B0B3C42581',
      title: 'Apple MacBook Air Laptop with M2 chip: 34.46 cm (13.6-inch) Liquid Retina Display, 8GB RAM, 256GB SSD Storage, Backlit Keyboard, 1080p FaceTime HD Camera - Midnight',
      price: 79990,
      originalPrice: 99900,
      imageUrl: 'https://m.media-amazon.com/images/I/710TJuHTMhL._SX679_.jpg',
      category: 'electronics',
      subcategory: 'laptops',
      rating: 4.6,
      country: 'IN',
      variant: { display: '8GB RAM • 256GB • Midnight', storageGb: 256, ramGb: 8, color: 'Midnight', type: 'tech_storage' }
    },
    flipkart: {
      productId: 'COMGFKGCHXGK2F9B',
      merchant: 'flipkart',
      cleanUrl: 'https://www.flipkart.com/apple-macbook-air-m2-8-gb-256-gb-ssd-mac-os-monterey-mly33hn-a/p/itmdb2eb76a26df1',
      title: 'Apple MacBook Air M2 - (8 GB/256 GB SSD/Mac OS Monterey) MLY33HN/A (13.6 Inch, Midnight, 1.24 Kg)',
      price: 77590,
      originalPrice: 99900,
      imageUrl: 'https://rukminim2.flixcart.com/image/832/832/xif0q/computer/m/b/n/-original-imagfde56rzhudat.jpeg',
      category: 'electronics',
      subcategory: 'laptops',
      rating: 4.7,
      country: 'IN',
      variant: { display: '8GB RAM • 256GB • Midnight', storageGb: 256, ramGb: 8, color: 'Midnight', type: 'tech_storage' }
    }
  },

  // 2. MacBook Air M2 512GB
  {
    amazon: {
      productId: 'B0B3BZZS57',
      merchant: 'amazon',
      cleanUrl: 'https://www.amazon.in/dp/B0B3BZZS57',
      title: 'Apple MacBook Air Laptop with M2 chip: 34.46 cm (13.6-inch) Liquid Retina Display, 8GB RAM, 512GB SSD Storage, Backlit Keyboard - Starlight',
      price: 99990,
      originalPrice: 119900,
      imageUrl: 'https://m.media-amazon.com/images/I/71eXNID3jFS._SX679_.jpg',
      category: 'electronics',
      subcategory: 'laptops',
      rating: 4.6,
      country: 'IN',
      variant: { display: '8GB RAM • 512GB • Starlight', storageGb: 512, ramGb: 8, color: 'Starlight', type: 'tech_storage' }
    },
    flipkart: {
      productId: 'COMGFKGCEQ4YFGGY',
      merchant: 'flipkart',
      cleanUrl: 'https://www.flipkart.com/apple-macbook-air-m2-8-gb-512-gb-ssd-mac-os-monterey-mly23hn-a/p/itmd69661448b111',
      title: 'Apple MacBook Air M2 - (8 GB/512 GB SSD/Mac OS Monterey) MLY23HN/A (13.6 Inch, Starlight, 1.24 Kg)',
      price: 97490,
      originalPrice: 119900,
      imageUrl: 'https://rukminim2.flixcart.com/image/832/832/xif0q/computer/m/b/n/-original-imagfde56rzhudat.jpeg',
      category: 'electronics',
      subcategory: 'laptops',
      rating: 4.7,
      country: 'IN',
      variant: { display: '8GB RAM • 512GB • Starlight', storageGb: 512, ramGb: 8, color: 'Starlight', type: 'tech_storage' }
    }
  },

  // 3. Apple iPhone 16 128GB
  {
    amazon: {
      productId: 'B0DGJ9B8NW',
      merchant: 'amazon',
      cleanUrl: 'https://www.amazon.in/dp/B0DGJ9B8NW',
      title: 'Apple iPhone 16 (128 GB) - Black',
      price: 79900,
      originalPrice: 79900,
      imageUrl: 'https://m.media-amazon.com/images/I/714R8G4bMTL._SX679_.jpg',
      category: 'electronics',
      subcategory: 'mobiles',
      rating: 4.6,
      country: 'IN',
      variant: { display: '128GB • Black', storageGb: 128, color: 'Black', type: 'tech_storage' }
    },
    flipkart: {
      productId: 'MOBH4DQ2GGHRYZGH',
      merchant: 'flipkart',
      cleanUrl: 'https://www.flipkart.com/apple-iphone-16-black-128-gb/p/itm5b93bf81b99a8',
      title: 'Apple iPhone 16 (Black, 128 GB)',
      price: 77999,
      originalPrice: 79900,
      imageUrl: 'https://rukminim2.flixcart.com/image/832/832/xif0q/mobile/k/l/l/-original-imagtc5fz9spysyk.jpeg',
      category: 'electronics',
      subcategory: 'mobiles',
      rating: 4.7,
      country: 'IN',
      variant: { display: '128GB • Black', storageGb: 128, color: 'Black', type: 'tech_storage' }
    }
  },

  // 4. Apple iPhone 15 128GB
  {
    amazon: {
      productId: 'B0CHX1W1XY',
      merchant: 'amazon',
      cleanUrl: 'https://www.amazon.in/dp/B0CHX1W1XY',
      title: 'Apple iPhone 15 (128 GB) - Blue',
      price: 69900,
      originalPrice: 79900,
      imageUrl: 'https://m.media-amazon.com/images/I/71d7rfSl0wL._SX679_.jpg',
      category: 'electronics',
      subcategory: 'mobiles',
      rating: 4.5,
      country: 'IN',
      variant: { display: '128GB • Blue', storageGb: 128, color: 'Blue', type: 'tech_storage' }
    },
    flipkart: {
      productId: 'MOBGTAGPAQNVFZZY',
      merchant: 'flipkart',
      cleanUrl: 'https://www.flipkart.com/apple-iphone-15-blue-128-gb/p/itmbf507f05bd14f',
      title: 'Apple iPhone 15 (Blue, 128 GB)',
      price: 66999,
      originalPrice: 79900,
      imageUrl: 'https://rukminim2.flixcart.com/image/832/832/xif0q/mobile/k/l/l/-original-imagtc5fz9spysyk.jpeg',
      category: 'electronics',
      subcategory: 'mobiles',
      rating: 4.6,
      country: 'IN',
      variant: { display: '128GB • Blue', storageGb: 128, color: 'Blue', type: 'tech_storage' }
    }
  },

  // 5. Samsung Galaxy S24 Ultra 5G
  {
    amazon: {
      productId: 'B0CS5X8286',
      merchant: 'amazon',
      cleanUrl: 'https://www.amazon.in/dp/B0CS5X8286',
      title: 'Samsung Galaxy S24 Ultra 5G (Titanium Gray, 12GB, 256GB Storage)',
      price: 129999,
      originalPrice: 134999,
      imageUrl: 'https://m.media-amazon.com/images/I/71RVu83NOmL._SX679_.jpg',
      category: 'electronics',
      subcategory: 'mobiles',
      rating: 4.5,
      country: 'IN',
      variant: { display: '12GB RAM • 256GB • Titanium Gray', storageGb: 256, ramGb: 12, color: 'Titanium Gray', type: 'tech_storage' }
    },
    flipkart: {
      productId: 'MOBGY2Y7YQY3WUZQ',
      merchant: 'flipkart',
      cleanUrl: 'https://www.flipkart.com/samsung-galaxy-s24-ultra-5g-titanium-gray-256-gb/p/itmd5b28d689622d',
      title: 'SAMSUNG Galaxy S24 Ultra 5G (Titanium Gray, 256 GB) (12 GB RAM)',
      price: 124999,
      originalPrice: 134999,
      imageUrl: 'https://rukminim2.flixcart.com/image/832/832/xif0q/mobile/5/t/j/-original-imagx9eg4e8gh8eh.jpeg',
      category: 'electronics',
      subcategory: 'mobiles',
      rating: 4.7,
      country: 'IN',
      variant: { display: '12GB RAM • 256GB • Titanium Gray', storageGb: 256, ramGb: 12, color: 'Titanium Gray', type: 'tech_storage' }
    }
  },

  // 6. Sony WH-1000XM5
  {
    amazon: {
      productId: 'B09XS7JWHH',
      merchant: 'amazon',
      cleanUrl: 'https://www.amazon.in/dp/B09XS7JWHH',
      title: 'Sony WH-1000XM5 Wireless Industry Leading Noise Canceling Headphones with Auto NC Optimizer, Crystal Clear Hands-Free Calling, and Alexa Voice Control, Black',
      price: 29990,
      originalPrice: 34990,
      imageUrl: 'https://m.media-amazon.com/images/I/61VbKHdE0rL._SX679_.jpg',
      category: 'electronics',
      subcategory: 'audio',
      rating: 4.4,
      country: 'IN',
      variant: { display: 'Black', color: 'Black', type: 'color' }
    },
    flipkart: {
      productId: 'ACCGEMR9TGY2VXZQ',
      merchant: 'flipkart',
      cleanUrl: 'https://www.flipkart.com/sony-wh-1000xm5-active-noise-cancellation-enabled-bluetooth-headset/p/itm5b93bf81b99a8',
      title: 'SONY WH-1000XM5 with Active Noise Cancellation (Black, Over the Ear)',
      price: 27490,
      originalPrice: 34990,
      imageUrl: 'https://rukminim2.flixcart.com/image/832/832/xif0q/headphone/d/h/v/-original-imaggt5vwhgqy2ez.jpeg',
      category: 'electronics',
      subcategory: 'audio',
      rating: 4.6,
      country: 'IN',
      variant: { display: 'Black', color: 'Black', type: 'color' }
    }
  },

  // 7. Apple AirPods Pro (2nd Gen) USB-C
  {
    amazon: {
      productId: 'B0CHX68YC2',
      merchant: 'amazon',
      cleanUrl: 'https://www.amazon.in/dp/B0CHX68YC2',
      title: 'Apple AirPods Pro (2nd Generation) with MagSafe Case (USB-C) ​​​​​​​',
      price: 23990,
      originalPrice: 24900,
      imageUrl: 'https://m.media-amazon.com/images/I/61SUj2aKoEL._SX679_.jpg',
      category: 'electronics',
      subcategory: 'audio',
      rating: 4.6,
      country: 'IN',
      variant: { display: 'White • USB-C', color: 'White', type: 'color' }
    },
    flipkart: {
      productId: 'ACCGTEK6GY2HXZ8Q',
      merchant: 'flipkart',
      cleanUrl: 'https://www.flipkart.com/apple-airpods-pro-2nd-generation-magsafe-case-usb-c-bluetooth-headset/p/itmd5b28d689622d',
      title: 'Apple AirPods Pro (2nd generation) with MagSafe Case (USB-C) Bluetooth Headset (White, True Wireless)',
      price: 21990,
      originalPrice: 24900,
      imageUrl: 'https://rukminim2.flixcart.com/image/832/832/xif0q/headphone/p/r/z/-original-imagtc5fv7rghyzk.jpeg',
      category: 'electronics',
      subcategory: 'audio',
      rating: 4.7,
      country: 'IN',
      variant: { display: 'White • USB-C', color: 'White', type: 'color' }
    }
  },

  // 8. Maybelline Fit Me Matte+Poreless Foundation Shade 128
  {
    amazon: {
      productId: 'B077ZCG696',
      merchant: 'amazon',
      cleanUrl: 'https://www.amazon.in/dp/B077ZCG696',
      title: 'Maybelline New York Liquid Foundation, Matte & Poreless, Normal to Oily Skin, Fit Me, 128 Warm Nude, 30 ml',
      price: 449,
      originalPrice: 599,
      imageUrl: 'https://m.media-amazon.com/images/I/51rPq4+a1qL._SX679_.jpg',
      category: 'beauty',
      subcategory: 'makeup',
      rating: 4.3,
      country: 'IN',
      variant: { display: 'Shade: 128 Warm Nude • 30ml', shade: '128 Warm Nude', type: 'shade' }
    },
    flipkart: {
      productId: 'FNDFGG8TZGHY9XZQ',
      merchant: 'flipkart',
      cleanUrl: 'https://www.flipkart.com/maybelline-new-york-fit-me-matte-poreless-liquid-foundation-warm-nude-128/p/itm5b93bf81b99a8',
      title: 'MAYBELLINE NEW YORK Fit Me Matte+Poreless Liquid Foundation (128 Warm Nude, 30 ml)',
      price: 399,
      originalPrice: 599,
      imageUrl: 'https://rukminim2.flixcart.com/image/832/832/xif0q/foundation/w/n/1/-original-imaggt5vwhgqy2ez.jpeg',
      category: 'beauty',
      subcategory: 'makeup',
      rating: 4.4,
      country: 'IN',
      variant: { display: 'Shade: 128 Warm Nude • 30ml', shade: '128 Warm Nude', type: 'shade' }
    }
  }
];

async function seedCrossStoreCatalog() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB successfully.\n');

  const now = new Date();
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  for (const pair of CROSS_STORE_PAIRS) {
    for (const [storeKey, item] of Object.entries(pair)) {
      const priceHistory = [{
        date: todayStr,
        price: item.price,
        originalPrice: item.originalPrice,
        timestamp: now
      }];

      const updateData = {
        productId: item.productId,
        merchant: item.merchant,
        cleanUrl: item.cleanUrl,
        title: item.title,
        price: item.price,
        originalPrice: item.originalPrice,
        imageUrl: item.imageUrl,
        images: [item.imageUrl],
        category: item.category,
        subcategory: item.subcategory,
        rating: item.rating,
        country: item.country,
        isActive: true,
        variant: item.variant,
        priceUpdatedAt: now,
        lastChecked: now,
        $setOnInsert: {
          priceHistory,
          priceStats: {
            lowestPrice: item.price,
            highestPrice: item.originalPrice,
            averagePrice: item.price,
            currentPrice: item.price
          }
        }
      };

      const res = await Product.findOneAndUpdate(
        { productId: item.productId, merchant: item.merchant },
        updateData,
        { upsert: true, new: true }
      );

      console.log(`✓ Upserted [${item.merchant.toUpperCase()}] ${item.title.slice(0, 50)}... -> ₹${item.price} (ID: ${res._id})`);
    }
    console.log('---');
  }

  console.log('\nAll cross-store product counterparts successfully seeded into MongoDB Atlas!');
  await mongoose.disconnect();
}

seedCrossStoreCatalog().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
