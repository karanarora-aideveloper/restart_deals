import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import Deal from '../src/db/models/deal.js';
import Product from '../src/db/models/product.js';
import Master from '../src/db/models/master.js';

// One-time backfill: classifies subcategory for every existing Deal + Product that doesn't have
// one yet (subcategory: '' — the default for anything written before this field existed, or
// anything a previous run of this same script left unclassified). Same AI (DeepSeek) and the
// same Master-collection-driven taxonomy backend/src/listener/verifier.js uses for new deals
// going forward, so backfilled data matches that quality bar rather than a cheaper heuristic.
//
// Resumable: only queries subcategory:'' each run, so interrupting and re-running never
// re-processes (or re-pays for) an already-classified record.
//
// Usage:
//   node scripts/backfill_subcategories.js                 # full backlog, both collections
//   node scripts/backfill_subcategories.js --limit=20       # test batch (applies to each collection)
//   node scripts/backfill_subcategories.js --only=deals      # just deals
//   node scripts/backfill_subcategories.js --only=products    # just products

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
});

const RATE_LIMIT_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs() {
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const onlyArg = args.find((a) => a.startsWith('--only='));
  return {
    limit: limitArg ? parseInt(limitArg.split('=')[1], 10) : null,
    only: onlyArg ? onlyArg.split('=')[1] : null, // 'deals' | 'products' | null (both)
  };
}

async function classifySubcategory(item, subcategoriesByCategory) {
  const category = item.category || 'general';
  const validSubcats = subcategoriesByCategory[category] || []; // [{value, label}, ...]

  if (validSubcats.length === 0) {
    // No subcategories registered for this category (shouldn't happen post-seed, but don't
    // spend an API call on a guaranteed-empty result).
    return '';
  }

  // Show the AI human-readable labels ("Kitchen & Dining"), not bare ids ("kitchen") — a raw id
  // alone is a much weaker signal (e.g. a cast-iron Dutch oven doesn't obviously read as
  // "kitchen" without the fuller "Kitchen & Dining" framing). It responds with the label; we map
  // that back to the stored value.
  const labelToValue = new Map(validSubcats.map((s) => [s.label, s.value]));
  const subcatString = validSubcats.map((s) => `"${s.label}"`).join(', ');
  const systemMessage = `You are a product subcategorization AI. Given a product title already known to belong to the category "${category}", pick the single best-fitting subcategory strictly from this list: [${subcatString}]. Only choose one if it is a clear, confident match for what the product actually is — do not force the closest-sounding option onto a product that doesn't really belong there (e.g. a yoga mat is not "Home Decor" just because its category happens to be "home"; a light bulb is not a "Large Appliance"). If nothing in the list is a genuinely good fit, respond with an empty string. Respond ONLY with a valid JSON object matching this schema: {"subcategory": "chosen_label_or_empty_string"}. Do not output markdown or explanation.`;
  const userMessage = `Title: ${item.title || ''}`;

  const completion = await openai.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
  });

  const parsed = JSON.parse(completion.choices[0].message.content);
  return labelToValue.get(parsed.subcategory) || '';
}

async function backfillCollection(Model, label, subcategoriesByCategory, limit) {
  // Mongoose schema defaults only apply when a document is read/created through Mongoose — they
  // don't retroactively exist in already-stored BSON, so "not yet classified" means the field is
  // literally absent on old records, not stored as ''. Match both that and '' (a record this
  // same script already visited and found no confident subcategory for).
  const query = {
    $or: [{ subcategory: { $exists: false } }, { subcategory: '' }],
    category: { $exists: true, $ne: null },
  };
  let cursor = Model.find(query);
  if (limit) cursor = cursor.limit(limit);
  const items = await cursor;

  console.log(`\n[${label}] Found ${items.length} record(s) needing subcategory classification.`);

  let updated = 0;
  let skipped = 0;
  let errored = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const progress = `${i + 1}/${items.length}`;
    try {
      const subcategory = await classifySubcategory(item, subcategoriesByCategory);
      if (subcategory) {
        item.subcategory = subcategory;
        await item.save();
        updated++;
        console.log(`[${label} ${progress}] "${(item.title || '').substring(0, 50)}" [${item.category}] -> ${subcategory}`);
      } else {
        // Leaving subcategory as '' here means it'll be re-attempted on the next run rather than
        // silently marked "done with no match" — cheap enough given the low per-item cost, and
        // avoids permanently stranding a record that a taxonomy tweak later would actually match.
        skipped++;
        console.log(`[${label} ${progress}] "${(item.title || '').substring(0, 50)}" [${item.category}] -> no confident match`);
      }
    } catch (err) {
      errored++;
      console.error(`[${label} ${progress}] Error on ${item._id}:`, err.message);
    }
    await sleep(RATE_LIMIT_MS);
  }

  console.log(`[${label}] Done. ${updated} classified, ${skipped} no match, ${errored} errored.`);
  return { updated, skipped, errored };
}

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('Missing MONGODB_URI');
    process.exit(1);
  }
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('Missing DEEPSEEK_API_KEY');
    process.exit(1);
  }

  const { limit, only } = parseArgs();

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const subcats = await Master.find({ type: 'subcategory', isActive: true });
  const subcategoriesByCategory = {};
  for (const s of subcats) {
    const parent = s.metadata?.parentCategory;
    if (!parent) continue;
    if (!subcategoriesByCategory[parent]) subcategoriesByCategory[parent] = [];
    subcategoriesByCategory[parent].push({ value: s.value, label: s.label });
  }
  console.log('Subcategory taxonomy loaded:', JSON.stringify(subcategoriesByCategory));

  const results = {};
  if (!only || only === 'deals') {
    results.deals = await backfillCollection(Deal, 'Deals', subcategoriesByCategory, limit);
  }
  if (!only || only === 'products') {
    results.products = await backfillCollection(Product, 'Products', subcategoriesByCategory, limit);
  }

  console.log('\n=== Summary ===');
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
