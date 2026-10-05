import mongoose from 'mongoose';

const uri = 'mongodb+srv://arorakaran6992:FUpX6I53NEB4UhSW@cluster0.zid9f.mongodb.net/shoppers_deals?retryWrites=true&w=majority';

export function classifyItem(title, currentCategory, currentSubcategory) {
  const t = (title || '').trim();
  const lower = t.toLowerCase();

  // 1. Non-electronics false positives
  if (lower.includes('cystone') || lower.includes('tablets 30\'s') || lower.includes('tablets 60\'s')) {
    return { category: 'wellness', subcategory: 'vitamins' };
  }
  if (/\b(toilet bowl cleaner|cleaner tablet|cleaning tablet|detergent tablet)\b/i.test(t)) {
    return { category: 'home', subcategory: 'cleaning' };
  }
  if (/\b(screwdriver|tool kit|repair kit|soldering|anti-static mat|esd safe)\b/i.test(t)) {
    return { category: 'home', subcategory: 'tools' };
  }
  if (/\b(treadmill|exercise bike|dumbbell)\b/i.test(t)) {
    return { category: 'fitness', subcategory: 'gym-equipment' };
  }
  if (/\b(baby mobile|crib mobile|nursery decor|activity center)\b/i.test(t)) {
    return { category: 'baby-kids', subcategory: 'baby-gear' };
  }
  if (/\b(writing tablet|lcd writing|drawing pad|drawing tablet|coloring books|toddler toys)\b/i.test(t)) {
    return { category: 'baby-kids', subcategory: 'toys-games' };
  }
  if (/\b(collapsible cart|folding cart|shopping cart)\b/i.test(t)) {
    return { category: 'home', subcategory: 'storage' };
  }
  if (/\b(desk organiser|pen stand with.*plant|desk organizer)\b/i.test(t)) {
    return { category: 'home', subcategory: 'decor' };
  }
  if (/\b(laptop backpack|backpack|crossbody bag|messenger bag|satchel)\b/i.test(t)) {
    return { category: 'men-fashion', subcategory: 'bags' };
  }

  // 2. Power banks (Always accessories)
  if (/\b(power ?bank|powerbank|energyshroom)\b/i.test(t)) {
    return { category: 'electronics', subcategory: 'accessories' };
  }

  // 3. Chargers, Adapters, Cables
  if (/\b(power adapter|wall charger|car charger|usb charger|wireless charger|charging pad|charging dock|charger with cable|type-c charger|fast charger\b|charging cable|usb-c cable|lightning cable|type-c cable|usb cable)\b/i.test(t) ||
      (/\b(adapter|charger)\b/i.test(t) && !/\b(phone|smartphone|mobile|tablet|pad|laptop)\b/i.test(t)) ||
      (/\b(adapter|charger)\b/i.test(t) && /\b(20w|25w|30w|33w|45w|65w|67w|80w|100w|120w)\b/i.test(t) && !/\b(gb ram|gb rom|gb storage|5g mobile|5g smartphone)\b/i.test(t))) {
    return { category: 'electronics', subcategory: 'accessories' };
  }

  // 4. Cases, Covers, Screen Protectors, Stands, Mounts, Grips, Stylus
  if (/\b(case for|cover for|\bcase\b|\bcover\b|book cover|flip cover|back cover|bumper case|protective case|sleeve for|screen protector|tempered glass|privacy screen|camera lens protector|lens protector|bubble-free|easy install|magic john|new'c)\b/i.test(t) ||
      /\b(mobile holder|phone holder|tablet holder|phone stand|mobile stand|tablet stand|car mount|phone mount|desk stand|phone grip|popsocket|waterproof pouch|stylus pen|stylus pencil|pencil for ipad)\b/i.test(t)) {
    const isRealKidTablet = /\b(toddler tablet|kids tablet|children tablet|kids edition tablet)\b/i.test(t) && /\b(wifi|android|32gb|64gb)\b/i.test(t);
    if (!isRealKidTablet) {
      return { category: 'electronics', subcategory: 'accessories' };
    }
  }

  // 5. Storage & Drives
  if (/\b(phone ssd|creator phone ssd|phone drive with usb|otg drive|pendrive|flash drive|microsd)\b/i.test(t)) {
    return { category: 'electronics', subcategory: 'accessories' };
  }

  // 6. Smartwatches & Wearables
  if (/\b(smartwatch|smart watch|fitness band|smart band|smart ring)\b/i.test(t) ||
      /\b(redmi watch|oneplus watch|galaxy watch|apple watch|noise watch|boat watch|fire-boltt)\b/i.test(t) ||
      (/\bwatch\b/i.test(t) && !/\b(phone|mobile|smartphone)\b/i.test(t))) {
    return { category: 'electronics', subcategory: 'wearables' };
  }

  // 7. Audio & Headphones
  const isAudio = /\b(earbuds?|tws in ear|in-ear earbuds|truly wireless|bluetooth neckband|neckbands?|headphones?|earphones?|bullets wireless|bluetooth speaker|soundbar|digital mixer)\b/i.test(t) ||
    (/\b(buds|airpods)\b/i.test(t) && !/\b(iphone 1[1-7]|galaxy s2[0-6]|mobile phone|smartphone)\b/i.test(t));
  if (isAudio) {
    return { category: 'electronics', subcategory: 'audio' };
  }

  // 8. Cameras, Tripods, Gimbals, Selfie Sticks, Photo Printers
  if (/\b(tripod|selfie stick|gimbal|photo printer|action cam|dslr|mirrorless|ring light)\b/i.test(t)) {
    return { category: 'electronics', subcategory: 'cameras' };
  }

  // 9. Gaming (Gamepads, controllers, consoles)
  if (/\b(gamepad|game controller|mobile controller|phone controller|gaming console|ps5|xbox|joystick)\b/i.test(t)) {
    return { category: 'electronics', subcategory: 'gaming' };
  }

  // 10. TV & Projectors
  if (/\b(projector|smart tv|led tv|qled tv|android tv)\b/i.test(t)) {
    return { category: 'electronics', subcategory: 'tv' };
  }

  // 11. Laptops & PC Peripherals
  if (/\b(wireless mouse|keyboard|laptop tabletop stand|laptop riser|macbook|thinkpad)\b/i.test(t)) {
    if (/\b(mouse|keyboard)\b/i.test(t)) return { category: 'electronics', subcategory: 'laptops' };
    return { category: 'electronics', subcategory: 'accessories' };
  }

  // 12. If currently classified as mobiles, keep as mobiles (genuine device)
  if (currentSubcategory === 'mobiles' || currentCategory === 'mobiles') {
    return { category: 'electronics', subcategory: 'mobiles' };
  }

  // Return unchanged if no pattern matched
  return { category: currentCategory, subcategory: currentSubcategory };
}

async function runMigration() {
  const conn = await mongoose.connect(uri);
  const db = conn.connection.db;
  const productsCol = db.collection('products');
  const dealsCol = db.collection('deals');

  console.log('[Migration] Connected to MongoDB Atlas.');

  const prodFilter = {
    $or: [
      { subcategory: 'mobiles' },
      { category: 'mobiles' }
    ]
  };

  const prods = await productsCol.find(prodFilter).toArray();
  console.log(`[Migration] Found ${prods.length} candidate products in mobiles to inspect.`);

  let prodUpdates = 0;
  for (const p of prods) {
    const updated = classifyItem(p.title, p.category, p.subcategory);
    if (updated.category !== p.category || updated.subcategory !== p.subcategory) {
      console.log(`[Product Reclassified] ${p.productId}: ${p.title.substring(0, 50)} -> ${updated.category}:${updated.subcategory}`);
      await productsCol.updateOne(
        { _id: p._id },
        { $set: { category: updated.category, subcategory: updated.subcategory } }
      );
      prodUpdates++;
    }
  }
  console.log(`[Migration] Updated ${prodUpdates} products with correct taxonomy.`);

  const dealFilter = {
    $or: [
      { subcategory: 'mobiles' },
      { category: 'mobiles' }
    ]
  };

  const deals = await dealsCol.find(dealFilter).toArray();
  console.log(`[Migration] Found ${deals.length} candidate deals in mobiles to inspect.`);

  let dealUpdates = 0;
  for (const d of deals) {
    const updated = classifyItem(d.title, d.category, d.subcategory);
    if (updated.category !== d.category || updated.subcategory !== d.subcategory) {
      console.log(`[Deal Reclassified] ${d.dealId || d._id}: ${d.title.substring(0, 50)} -> ${updated.category}:${updated.subcategory}`);
      await dealsCol.updateOne(
        { _id: d._id },
        { $set: { category: updated.category, subcategory: updated.subcategory } }
      );
      dealUpdates++;
    }
  }
  console.log(`[Migration] Updated ${dealUpdates} deals with correct taxonomy.`);

  const finalMobiles = await productsCol.find({ subcategory: 'mobiles' }).toArray();
  console.log(`[Final] Exactly ${finalMobiles.length} genuine smartphones and tablets remain in mobiles.`);

  await conn.disconnect();
}

runMigration().catch(console.error);
