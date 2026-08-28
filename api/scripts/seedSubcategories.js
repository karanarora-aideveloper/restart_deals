import 'dotenv/config';
import { connectDB, disconnectDB } from '../src/db/connection.js';
import Master from '../src/db/models/master.js';
import { CATEGORY_TAXONOMY } from '../../frontend/src/data/categoryTaxonomy.js';

// One-time seed: registers every subcategory from the frontend's category taxonomy (the same
// file the Browse tab renders from) into the Master collection as type: 'subcategory', with
// metadata.parentCategory linking it back to its top-level category id. This is what
// backend/src/listener/verifier.js reads at classify-time to build the AI prompt's valid
// subcategory list per category, and what api/src/routes/deals.js|products.js validate a
// `?subcategory=` filter against.
//
// Idempotent — upserts by {type: 'subcategory', value}, safe to re-run after editing the
// taxonomy file (e.g. adding a new subcategory) to sync the change into Mongo.
//
// Usage: node scripts/seedSubcategories.js

async function main() {
  await connectDB();

  let created = 0;
  let updated = 0;

  for (const cat of CATEGORY_TAXONOMY) {
    for (const sub of cat.subcategories) {
      const res = await Master.findOneAndUpdate(
        { type: 'subcategory', value: sub.id },
        {
          $set: {
            label: sub.label,
            isActive: true,
            metadata: { parentCategory: cat.id },
          },
        },
        { upsert: true, new: true, rawResult: true }
      );
      if (res.lastErrorObject?.upserted) {
        created += 1;
        console.log(`[Seed] + Created "${sub.label}" (${sub.id}) under "${cat.id}"`);
      } else {
        updated += 1;
      }
    }
  }

  console.log(`\n[Seed] Done. ${created} created, ${updated} already existed (label/metadata refreshed).`);
  await disconnectDB();
}

main().catch((err) => {
  console.error('[Seed] Fatal error:', err);
  process.exit(1);
});
