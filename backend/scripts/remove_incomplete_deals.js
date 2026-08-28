/**
 * Removes existing Deal documents that don't meet the new bar: a real image, a real price, and a
 * genuine discount are all required to call something "a deal" (see the gate added to
 * verifyAndProcessMessage() in src/listener/verifier.js). Applies that same rule retroactively.
 *
 * Products are left untouched — they're a general catalog, not "deals", and may still hold useful
 * price/image data even for an item whose current Deal posting didn't clear the bar.
 *
 * Usage:
 *   node scripts/remove_incomplete_deals.js            # dry run — report only
 *   node scripts/remove_incomplete_deals.js --execute   # actually deletes
 */
import mongoose from 'mongoose';
import config from '../src/config.js';
import Deal from '../src/db/models/deal.js';

const EXECUTE = process.argv.includes('--execute');

function isIncomplete(d) {
  const hasImage = (d.images && d.images.length > 0) || !!d.imageUrl;
  const hasPrice = d.dealPrice != null;
  const hasDiscount = d.discountPercentage != null && d.discountPercentage > 0;
  const reasons = [];
  if (!hasImage) reasons.push('no image');
  if (!hasPrice) reasons.push('no price');
  if (!hasDiscount) reasons.push('no discount');
  return reasons.length > 0 ? reasons : null;
}

async function run() {
  await mongoose.connect(config.mongodbUri);
  console.log(`[Cleanup] Connected. Mode: ${EXECUTE ? 'EXECUTE (will delete)' : 'DRY RUN (report only)'}\n`);

  try {
    const deals = await Deal.find({}).select('_id title images imageUrl dealPrice discountPercentage country merchant').lean();
    console.log(`Total deals: ${deals.length}`);

    const bad = [];
    const reasonCounts = { 'no image': 0, 'no price': 0, 'no discount': 0 };
    for (const d of deals) {
      const reasons = isIncomplete(d);
      if (reasons) {
        bad.push({ ...d, reasons });
        reasons.forEach(r => reasonCounts[r]++);
      }
    }

    console.log(`Incomplete deals (missing image and/or price and/or discount): ${bad.length}`);
    console.log(`Keeping: ${deals.length - bad.length}\n`);
    console.log('Breakdown by reason (a deal can have more than one):', reasonCounts);

    const byCountry = {};
    bad.forEach(d => { byCountry[d.country || 'unknown'] = (byCountry[d.country || 'unknown'] || 0) + 1; });
    console.log('By country:', byCountry, '\n');

    bad.slice(0, 25).forEach(d => {
      console.log(`  - [${d.reasons.join(', ')}] "${d.title}" | price: ${d.dealPrice} | discount: ${d.discountPercentage} | images: ${(d.images||[]).length}`);
    });
    if (bad.length > 25) console.log(`  ... and ${bad.length - 25} more`);

    if (EXECUTE) {
      if (bad.length > 0) {
        const res = await Deal.deleteMany({ _id: { $in: bad.map(d => d._id) } });
        console.log(`\n[Cleanup] Deleted ${res.deletedCount} incomplete deals.`);
      }
    } else {
      console.log(`\n[Cleanup] Dry run only — nothing deleted. Re-run with --execute to delete the deals listed above.`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

run();
