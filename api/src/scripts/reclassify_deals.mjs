import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Deal from '../db/models/deal.js';
import Product from '../db/models/product.js';
import { classifyProduct } from '../utils/categoryClassifier.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

/**
 * Extracts a human-readable title from an e-commerce URL slug if available.
 * Specifically handles Flipkart PDP URLs like /product-title-slug/p/itm...
 */
export function extractTitleFromUrlSlug(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('flipkart.com')) {
      const match = parsed.pathname.match(/^\/([^\/]+)\/p\//);
      if (match && match[1] && match[1] !== 'flipkart' && match[1] !== 'item') {
        const words = match[1]
          .split('-')
          .filter(Boolean)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
        if (words.length >= 3) {
          return words.join(' ').slice(0, 140);
        }
      }
    }
  } catch (e) {}
  return null;
}

const JUNK_TITLE_REGEX = /^(apply\s*\d+%|unknown\s*product|exclusive\s*deal|bbd\s*exclusive|loot\b|\d+\s*loot|time:\s*\d+|deal\s*time|steal\s*deal)/i;

/**
 * Automated Taxonomy & Deal Hygiene Engine
 * Evaluates active deals, repairs generic message captions via URL slugs,
 * reclassifies categories into canonical taxonomy, and expires irrecoverable junk.
 */
export async function runTaxonomyHygiene({ silent = false } = {}) {
  const activeDeals = await Deal.find({ isExpired: false }).lean();
  if (!silent) console.log(`[Taxonomy Guardian] Inspecting ${activeDeals.length} active deals...`);

  let updatedDealsCount = 0;
  let updatedProductsCount = 0;
  let recoveredSlugsCount = 0;
  let expiredJunkCount = 0;
  const categoryShiftStats = {};

  for (const deal of activeDeals) {
    let currentTitle = deal.title || '';
    let titleWasRecovered = false;

    // 1. Check for Telegram caption noise as title
    if (JUNK_TITLE_REGEX.test(currentTitle.trim())) {
      const slugTitle = extractTitleFromUrlSlug(deal.dealUrl);
      if (slugTitle) {
        currentTitle = slugTitle;
        titleWasRecovered = true;
        recoveredSlugsCount++;
      } else if (/^(unknown\s*product|apply\s*\d+%)/i.test(currentTitle.trim())) {
        // Irrecoverable junk without valid title or slug — expire so it doesn't pollute user feed
        await Deal.updateOne(
          { _id: deal._id },
          { $set: { isExpired: true, expiredAt: new Date() } }
        );
        expiredJunkCount++;
        continue;
      }
    }

    // 2. Classify product
    const classification = classifyProduct(currentTitle, deal.merchant);
    const oldCat = deal.category || 'none';
    const oldSub = deal.subcategory || 'none';

    let shouldUpdateDeal = titleWasRecovered;
    const updateFields = {};

    if (titleWasRecovered) {
      updateFields.title = currentTitle;
    }

    if (classification) {
      const { category, subcategory } = classification;
      if (category !== oldCat || subcategory !== oldSub) {
        updateFields.category = category;
        updateFields.subcategory = subcategory;
        shouldUpdateDeal = true;

        const shiftKey = `${oldCat}:${oldSub} ➔ ${category}:${subcategory}`;
        categoryShiftStats[shiftKey] = (categoryShiftStats[shiftKey] || 0) + 1;
      }
    }

    if (shouldUpdateDeal) {
      await Deal.updateOne({ _id: deal._id }, { $set: updateFields });
      updatedDealsCount++;

      // Also align matching Product record
      if (deal.productId) {
        const prodUpdate = {};
        if (updateFields.category) prodUpdate.category = updateFields.category;
        if (updateFields.subcategory) prodUpdate.subcategory = updateFields.subcategory;
        if (titleWasRecovered) prodUpdate.title = currentTitle;

        if (Object.keys(prodUpdate).length > 0) {
          const prodRes = await Product.updateOne(
            { $or: [{ productId: deal.productId }, { cleanUrl: deal.dealUrl }] },
            { $set: prodUpdate }
          );
          if (prodRes.modifiedCount > 0) {
            updatedProductsCount++;
          }
        }
      }
    }
  }

  const results = {
    totalScanned: activeDeals.length,
    updatedDeals: updatedDealsCount,
    updatedProducts: updatedProductsCount,
    recoveredSlugs: recoveredSlugsCount,
    expiredJunk: expiredJunkCount,
    shifts: categoryShiftStats,
  };

  if (!silent) {
    console.log(`\n======================================================`);
    console.log(`✓ Taxonomy Guardian Hygiene Pass Complete:`);
    console.log(`  • Deals Evaluated:    ${results.totalScanned}`);
    console.log(`  • Deals Reclassified: ${results.updatedDeals}`);
    console.log(`  • Products Aligned:   ${results.updatedProducts}`);
    console.log(`  • Slugs Recovered:    ${results.recoveredSlugs}`);
    console.log(`  • Junk Deals Expired: ${results.expiredJunk}`);
    console.log(`======================================================\n`);
    const sortedShifts = Object.entries(categoryShiftStats).sort((a, b) => b[1] - a[1]);
    if (sortedShifts.length > 0) {
      console.log(`Top Category Shifts:`);
      for (const [shift, count] of sortedShifts.slice(0, 15)) {
        console.log(`  ${shift.padEnd(50)} : ${count} deal(s)`);
      }
    }
  }

  return results;
}

// Standalone execution wrapper
if (process.argv[1] && process.argv[1].endsWith('reclassify_deals.mjs')) {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('MONGODB_URI is not defined.');
    process.exit(1);
  }

  mongoose.connect(MONGODB_URI)
    .then(() => runTaxonomyHygiene({ silent: false }))
    .then(() => mongoose.disconnect())
    .catch(err => {
      console.error('Taxonomy Guardian failed:', err);
      process.exit(1);
    });
}
