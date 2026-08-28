/**
 * Backfills Deal.productId/merchant (added to fix Flipkart cleanUrl-slug-variance
 * duplicates) onto existing deals, then merges duplicate Deal docs that share the
 * same productId+merchant but ended up with different dealUrl slugs.
 *
 * For each duplicate group, keeps the most recently created deal (freshest price/link)
 * and deletes the rest.
 *
 * Usage:
 *   node scripts/merge_duplicate_deals.js            # dry run — report only
 *   node scripts/merge_duplicate_deals.js --execute   # actually writes/deletes
 */
import mongoose from 'mongoose';
import config from '../src/config.js';
import Deal from '../src/db/models/deal.js';
import { cleanAndParseUrl } from '../src/listener/verifier.js';

const EXECUTE = process.argv.includes('--execute');

async function run() {
  await mongoose.connect(config.mongodbUri);
  console.log(`[Merge] Connected. Mode: ${EXECUTE ? 'EXECUTE (will write/delete)' : 'DRY RUN (report only)'}\n`);

  try {
    const deals = await Deal.find({}).select('_id title dealUrl productId merchant createdAt').lean();
    console.log(`Total deals: ${deals.length}`);

    // ---- Step 1: backfill productId/merchant ----
    const toBackfill = [];
    const groups = new Map();

    for (const d of deals) {
      const { productId, merchant, isProductUrl } = cleanAndParseUrl(d.dealUrl);
      const valid = isProductUrl && (merchant === 'amazon' || merchant === 'flipkart');

      if (valid && (d.productId !== productId || d.merchant !== merchant)) {
        toBackfill.push({ _id: d._id, productId, merchant });
      }

      if (valid) {
        const key = `${merchant}:${productId}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ ...d, productId, merchant });
      }
    }

    console.log(`Deals needing productId/merchant backfill: ${toBackfill.length}`);

    // ---- Step 2: find duplicate groups ----
    const dupGroups = [...groups.entries()].filter(([, arr]) => arr.length > 1);
    let totalToDelete = 0;
    console.log(`\nDuplicate product groups: ${dupGroups.length}`);
    for (const [key, arr] of dupGroups) {
      arr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const [keep, ...remove] = arr;
      totalToDelete += remove.length;
      console.log(`\n  ${key} — "${keep.title}" (${arr.length} copies)`);
      console.log(`    KEEP   ${keep.createdAt.toISOString()}  ${keep.dealUrl}`);
      remove.forEach(r => console.log(`    DELETE ${r.createdAt.toISOString()}  ${r.dealUrl}`));
    }
    console.log(`\nTotal duplicate deals to delete: ${totalToDelete}`);

    if (!EXECUTE) {
      console.log(`\n[Merge] Dry run only — nothing changed. Re-run with --execute to apply.`);
      return;
    }

    // ---- Execute: backfill first ----
    if (toBackfill.length > 0) {
      const bulk = toBackfill.map(({ _id, productId, merchant }) => ({
        updateOne: { filter: { _id }, update: { $set: { productId, merchant } } }
      }));
      const res = await Deal.bulkWrite(bulk);
      console.log(`[Merge] Backfilled productId/merchant on ${res.modifiedCount} deals.`);
    }

    // ---- Execute: delete duplicates ----
    const idsToDelete = [];
    for (const [, arr] of dupGroups) {
      arr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      arr.slice(1).forEach(r => idsToDelete.push(r._id));
    }
    if (idsToDelete.length > 0) {
      const res = await Deal.deleteMany({ _id: { $in: idsToDelete } });
      console.log(`[Merge] Deleted ${res.deletedCount} duplicate deals.`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

run();
