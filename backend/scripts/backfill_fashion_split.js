// One-time backfill: the "fashion" Master category was split into "men-fashion" and
// "women-fashion" (see frontend/src/data/categoryTaxonomy.js and the Master collection).
// Existing Deal/Product records still carry the old, now-deactivated "fashion" value and are
// invisible to both new category filters until reclassified. Re-runs AI classification scoped
// to just the two fashion categories (cheaper/more accurate than the full category list, since
// we already know these are fashion items — the only open question is which side and which
// subcategory).
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

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
});

async function buildSubcategoryMap() {
  const subs = await Master.find({ type: 'subcategory', isActive: true });
  const map = {};
  for (const s of subs) {
    const parent = s.metadata?.parentCategory;
    if (parent !== 'men-fashion' && parent !== 'women-fashion') continue;
    if (!map[parent]) map[parent] = [];
    map[parent].push(s.label);
  }
  return map;
}

function buildSystemMessage(subcategoryMap) {
  return `You are a fashion product categorization AI. Every item given to you is already known to be a fashion/apparel product — your only job is to decide which of exactly two categories it belongs to, and which subcategory within that.

Categories: "men-fashion", "women-fashion". If a product is unisex or gender is genuinely unclear from the title, pick the more likely intended buyer based on the product description (e.g. cut, styling cues, brand context) rather than defaulting to one side arbitrarily.

Subcategories by category (pick the single best-fitting LABEL from the chosen category's own list, or "" if nothing fits confidently — do not invent one or borrow from the other category's list):
${JSON.stringify(subcategoryMap, null, 2)}

Respond ONLY with a valid JSON object matching this schema, no markdown, no explanation:
{"category": "men-fashion" or "women-fashion", "subcategory": "exact label from that category's list, or empty string"}`;
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

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const subcategoryMap = await buildSubcategoryMap();
  const subcategoryLabelToValue = new Map();
  const subs = await Master.find({ type: 'subcategory', isActive: true });
  for (const s of subs) {
    const parent = s.metadata?.parentCategory;
    if (parent === 'men-fashion' || parent === 'women-fashion') {
      subcategoryLabelToValue.set(`${parent}::${s.label}`, s.value);
    }
  }
  const systemMessage = buildSystemMessage(subcategoryMap);

  async function classifyAndSave(doc, modelName) {
    const userMessage = `Title: ${doc.title}\nDescription: ${doc.description || ''}`;
    try {
      const completion = await openai.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage },
        ],
        response_format: { type: 'json_object' },
      });
      const parsed = JSON.parse(completion.choices[0].message.content);
      const category = ['men-fashion', 'women-fashion'].includes(parsed.category) ? parsed.category : 'women-fashion';
      const subcategory = subcategoryLabelToValue.get(`${category}::${parsed.subcategory}`) || '';

      doc.category = category;
      doc.subcategory = subcategory;
      await doc.save();
      console.log(`[${modelName}] "${doc.title.slice(0, 50)}" -> ${category} / ${subcategory || '(none)'}`);
      return true;
    } catch (err) {
      console.error(`[${modelName}] FAILED "${doc.title?.slice(0, 50)}": ${err.message}`);
      return false;
    }
  }

  const deals = await Deal.find({ category: 'fashion' });
  console.log(`\nFound ${deals.length} deals with category "fashion"`);
  let dealsOk = 0;
  for (const deal of deals) {
    if (await classifyAndSave(deal, 'Deal')) dealsOk++;
    await new Promise((res) => setTimeout(res, 350));
  }

  const products = await Product.find({ category: 'fashion' });
  console.log(`\nFound ${products.length} products with category "fashion"`);
  let productsOk = 0;
  for (const product of products) {
    if (await classifyAndSave(product, 'Product')) productsOk++;
    await new Promise((res) => setTimeout(res, 350));
  }

  console.log(`\nDone. Deals: ${dealsOk}/${deals.length} reclassified. Products: ${productsOk}/${products.length} reclassified.`);
  process.exit(0);
}

run().catch((err) => {
  console.error('BACKFILL FAILED:', err);
  process.exit(1);
});
