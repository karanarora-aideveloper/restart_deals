import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import * as cheerio from 'cheerio';
import ScrapingAntToken from '../db/models/scrapingAntToken.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../backend/.env') });

async function debugFetch() {
  await mongoose.connect(process.env.MONGODB_URI);
  const tokenRecord = await ScrapingAntToken.findOne({ status: 'active' });

  const testUrl = 'https://www.amazon.in/s?k=smartphones&s=exact-aware-popularity-rank';
  const apiUrl = `https://api.scrapingant.com/v2/general?x-api-key=${tokenRecord.token}&url=${encodeURIComponent(testUrl)}&browser=true`;
  
  let html = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    console.log(`[Scraper] Fetch attempt ${attempt}...`);
    const res = await fetch(apiUrl);
    console.log('Status:', res.status);
    if (res.status === 409) {
      console.log('409 concurrency limit. Waiting 3s...');
      await new Promise(r => setTimeout(r, 3000));
      continue;
    }
    if (res.ok) {
      html = await res.text();
      break;
    }
  }

  if (!html) {
    console.log('Failed to fetch HTML.');
    await mongoose.disconnect();
    return;
  }

  console.log('HTML Length:', html.length);
  const $ = cheerio.load(html);
  const items = [];

  $('[data-asin]').each((_, el) => {
    const asin = $(el).attr('data-asin');
    if (!asin || asin.length < 5) return;
    const title = $(el).find('h2 span').text().trim() || $(el).find('h2').text().trim();
    const priceText = $(el).find('.a-price .a-offscreen').first().text().trim() || $(el).find('.a-price-whole').first().text().trim();
    const cleanPrice = parseFloat(priceText.replace(/[^\d.]/g, ''));
    const img = $(el).find('img.s-image').attr('src');
    if (title && cleanPrice > 0) {
      items.push({ asin, title: title.slice(0, 40), price: cleanPrice, img: !!img });
    }
  });

  console.log(`Parsed ${items.length} products:`);
  items.slice(0, 8).forEach((item, i) => {
    console.log(`  [${i + 1}] ${item.asin} - ₹${item.price} - ${item.title}`);
  });

  await mongoose.disconnect();
}

debugFetch().catch(console.error);
