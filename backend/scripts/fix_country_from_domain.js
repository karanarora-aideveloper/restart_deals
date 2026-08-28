/**
 * Corrects Deal.country / Product.country to be derived from the merchant URL's own domain
 * (amazon.in/flipkart.com -> IN, amazon.com -> US, etc.) instead of whatever the posting
 * channel's admin-configured country happened to be — see cleanAndParseUrl()'s derivedCountry.
 *
 * This was causing genuinely-India products to disappear from the India filter: Product.country
 * is a single mutable field shared across every channel that ever reposts that product, so a
 * later repost from a differently-tagged channel could silently flip a product's country.
 *
 * Usage:
 *   node scripts/fix_country_from_domain.js            # dry run — report only
 *   node scripts/fix_country_from_domain.js --execute   # actually writes
 */
import mongoose from 'mongoose';
import config from '../src/config.js';
import Deal from '../src/db/models/deal.js';
import Product from '../src/db/models/product.js';
import { cleanAndParseUrl } from '../src/listener/verifier.js';

const EXECUTE = process.argv.includes('--execute');

async function run() {
  await mongoose.connect(config.mongodbUri);
  console.log(`[FixCountry] Connected. Mode: ${EXECUTE ? 'EXECUTE (will write)' : 'DRY RUN (report only)'}\n`);

  try {
    // ---- Deals ----
    const deals = await Deal.find({}).select('_id title dealUrl country').lean();
    const dealFixes = [];
    for (const d of deals) {
      const { derivedCountry } = cleanAndParseUrl(d.dealUrl);
      if (derivedCountry && derivedCountry !== d.country) {
        dealFixes.push({ _id: d._id, title: d.title, from: d.country, to: derivedCountry, url: d.dealUrl });
      }
    }

    console.log(`=== Deals ===`);
    console.log(`Total: ${deals.length} | Need country fix: ${dealFixes.length}\n`);
    const dealSummary = {};
    dealFixes.forEach(f => { const k = `${f.from} -> ${f.to}`; dealSummary[k] = (dealSummary[k] || 0) + 1; });
    console.log('By transition:', dealSummary);
    dealFixes.slice(0, 10).forEach(f => console.log(`  [${f.from} -> ${f.to}] "${f.title}" — ${f.url}`));
    if (dealFixes.length > 10) console.log(`  ... and ${dealFixes.length - 10} more`);

    // ---- Products ----
    const products = await Product.find({}).select('_id title cleanUrl country').lean();
    const productFixes = [];
    for (const p of products) {
      const { derivedCountry } = cleanAndParseUrl(p.cleanUrl);
      if (derivedCountry && derivedCountry !== p.country) {
        productFixes.push({ _id: p._id, title: p.title, from: p.country, to: derivedCountry, url: p.cleanUrl });
      }
    }

    console.log(`\n=== Products ===`);
    console.log(`Total: ${products.length} | Need country fix: ${productFixes.length}\n`);
    const productSummary = {};
    productFixes.forEach(f => { const k = `${f.from} -> ${f.to}`; productSummary[k] = (productSummary[k] || 0) + 1; });
    console.log('By transition:', productSummary);
    productFixes.slice(0, 10).forEach(f => console.log(`  [${f.from} -> ${f.to}] "${f.title}" — ${f.url}`));
    if (productFixes.length > 10) console.log(`  ... and ${productFixes.length - 10} more`);

    if (EXECUTE) {
      if (dealFixes.length > 0) {
        const res1 = await Deal.bulkWrite(dealFixes.map(f => ({
          updateOne: { filter: { _id: f._id }, update: { $set: { country: f.to } } }
        })));
        console.log(`\n[FixCountry] Updated ${res1.modifiedCount} deals.`);
      }
      if (productFixes.length > 0) {
        const res2 = await Product.bulkWrite(productFixes.map(f => ({
          updateOne: { filter: { _id: f._id }, update: { $set: { country: f.to } } }
        })));
        console.log(`[FixCountry] Updated ${res2.modifiedCount} products.`);
      }
    } else {
      console.log(`\n[FixCountry] Dry run only — nothing changed. Re-run with --execute to apply.`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

run();
