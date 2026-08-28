/**
 * Finds and (optionally) deletes Deal / Product records whose URL isn't an
 * actual product page — search/category pages like amazon.in/s?k=..., or
 * anything that isn't Amazon/Flipkart. These predate the isProductUrl fix in
 * verifier.js and were saved by the old urls[0]-only logic.
 *
 * Usage:
 *   node scripts/cleanup_non_product_entries.js            # dry run — report only
 *   node scripts/cleanup_non_product_entries.js --execute  # actually deletes
 */
import mongoose from 'mongoose';
import config from '../src/config.js';
import Deal from '../src/db/models/deal.js';
import Product from '../src/db/models/product.js';
import { cleanAndParseUrl } from '../src/listener/verifier.js';

const EXECUTE = process.argv.includes('--execute');

function isBad(url) {
  if (!url) return { bad: true, reason: 'no URL' };
  const { merchant, isProductUrl } = cleanAndParseUrl(url);
  if (merchant !== 'amazon' && merchant !== 'flipkart') {
    return { bad: true, reason: `merchant "${merchant}" (not amazon/flipkart)` };
  }
  if (!isProductUrl) {
    return { bad: true, reason: `${merchant} link with no product ID (search/category page)` };
  }
  return { bad: false };
}

async function run() {
  await mongoose.connect(config.mongodbUri);
  console.log(`[Cleanup] Connected. Mode: ${EXECUTE ? 'EXECUTE (will delete)' : 'DRY RUN (report only)'}\n`);

  try {
    // ---- Deals ----
    const deals = await Deal.find({}).select('_id title dealUrl category createdAt').lean();
    const badDeals = [];
    for (const d of deals) {
      const check = isBad(d.dealUrl);
      if (check.bad) badDeals.push({ ...d, reason: check.reason });
    }

    console.log(`=== Deals ===`);
    console.log(`Total: ${deals.length} | Non-product: ${badDeals.length} | Keeping: ${deals.length - badDeals.length}\n`);
    badDeals.slice(0, 25).forEach(d => {
      console.log(`  - [${d.reason}] "${d.title}" — ${d.dealUrl}`);
    });
    if (badDeals.length > 25) console.log(`  ... and ${badDeals.length - 25} more`);

    // ---- Products ----
    const products = await Product.find({}).select('_id title cleanUrl merchant').lean();
    const badProducts = [];
    for (const p of products) {
      const check = isBad(p.cleanUrl);
      if (check.bad) badProducts.push({ ...p, reason: check.reason });
    }

    console.log(`\n=== Products ===`);
    console.log(`Total: ${products.length} | Non-product: ${badProducts.length} | Keeping: ${products.length - badProducts.length}\n`);
    badProducts.slice(0, 25).forEach(p => {
      console.log(`  - [${p.reason}] "${p.title}" — ${p.cleanUrl}`);
    });
    if (badProducts.length > 25) console.log(`  ... and ${badProducts.length - 25} more`);

    if (EXECUTE) {
      console.log(`\n[Cleanup] Deleting ${badDeals.length} deals and ${badProducts.length} products...`);
      if (badDeals.length > 0) {
        const res1 = await Deal.deleteMany({ _id: { $in: badDeals.map(d => d._id) } });
        console.log(`[Cleanup] Deleted ${res1.deletedCount} deals.`);
      }
      if (badProducts.length > 0) {
        const res2 = await Product.deleteMany({ _id: { $in: badProducts.map(p => p._id) } });
        console.log(`[Cleanup] Deleted ${res2.deletedCount} products.`);
      }
    } else {
      console.log(`\n[Cleanup] Dry run only — nothing deleted. Re-run with --execute to delete the records listed above.`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

run();
