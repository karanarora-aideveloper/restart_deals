/**
 * seriesAggregation.js
 *
 * Feed-level and search-level series aggregation.
 * Merges sibling SKUs of the same device/cosmetic series into a single representative card,
 * displaying starting prices ("From ₹X") and variant badges ("✨ 7 Options · 256GB, 512GB · 3 Colors"),
 * reducing clutter and eliminating duplicate listing fatigue.
 */

import { isUsableImageUrl } from './affiliate';

export function isAccessory(title) {
  if (!title) return false;
  return /\b(case|cover|back\s*cover|bumper|protector|guard|tempered\s*glass|skin|pouch|sleeve|bag|strap|band|cable|adapter|charger|charging|stand|holder|mount|dock|hub|dongle|riser|tray|power\s*bank|powerbank|upgrade\s*kit|jetdrive)\b/i.test(title);
}

export function extractColor(title) {
  if (!title) return null;
  const semiMatch = title.match(/;\s*([A-Za-z\s]+?)(?:\s*(?:Laptop|Notebook|with|\d|\||$))/i);
  if (semiMatch) {
    const c = semiMatch[1].trim();
    if (c.length >= 3 && c.length <= 25 && !/\b(ssd|ram|gb|tb|chip|display|retina|camera|touch|id)\b/i.test(c)) {
      return c;
    }
  }

  const techColors = /\b(Natural Titanium|Desert Titanium|Black Titanium|White Titanium|Space Grey|Space Gray|Space Black|Midnight|Starlight|Silver Shadow|Silver|Blush|Indigo|Gold|Rose Gold|Deep Purple|Phantom Black|Cream|Graphite|Alpine Green|Sierra Blue|Sky Blue|Coral|Product RED)\b/i;
  const tcMatch = title.match(techColors);
  if (tcMatch) return tcMatch[1].trim();

  const parenMatch = title.match(/\(([^,()]+?)(?:,\s*|\))/i);
  if (parenMatch) {
    const c = parenMatch[1].trim();
    if (
      c.length >= 3 &&
      c.length <= 25 &&
      !/^\d+\s*(?:gb|tb|mb|ram|rom)\b/i.test(c) &&
      !/\b(renewed|refurbished|combo|pack|set|\d+gb|\d+tb|ssd|ram|effectively|approx)\b/i.test(c)
    ) {
      return c;
    }
  }

  return null;
}

export function extractBeautyShade(title) {
  if (!title) return null;
  const shadeKeywordMatch = title.match(/\bshade(?:\s*no\.?|\s*code)?\s*[:\-–]?\s*([A-Za-z0-9\s/+#.]+?)(?:[,|(\n]|\s*\d+(?:\.\d+)?\s*(?:ml|g|gm|kg)|$)/i);
  if (shadeKeywordMatch) return shadeKeywordMatch[1].trim();

  const macMatch = title.match(/\b(N[CW]\d{1,2}(?:\.\d)?)\b/i);
  if (macMatch) return macMatch[1].toUpperCase();

  const numNameMatch = title.match(/(?:,\s*|\s*[-–|]\s*)(\d{1,3}\s+[A-Za-z]+(?:\s+[A-Za-z]+)?)(?:,\s*|\s*\(\s*|\s*[-–|]\s*|\s*\d+(?:\.\d+)?\s*(?:ml|g|gm|kg)|$)/i);
  if (numNameMatch) {
    const s = numNameMatch[1].trim();
    if (!/\b(ml|g|gm|kg|pcs|pack|combo|set|hrs|spf|oz)\b/i.test(s)) return s;
  }

  const commaEndMatch = title.match(/,\s*([A-Za-z0-9\s]+?),\s*\d+(?:\.\d+)?\s*(?:ml|g|gm|kg)\b/i);
  if (commaEndMatch) {
    const s = commaEndMatch[1].trim();
    if (s.length >= 3 && s.length <= 25 && !/\b(foundation|liquid|matte|cream|powder|skin|care)\b/i.test(s)) {
      return s;
    }
  }

  return null;
}

export function extractVariantTraits(title) {
  if (!title) return {};
  const color = extractColor(title);
  const shade = extractBeautyShade(title);

  let storage = null;
  const explicitTb = title.match(/(\d+)\s*(?:TB|tb)\s*(?:ssd|storage|rom)?\b/i);
  if (explicitTb && !/ram/i.test(explicitTb[0])) {
    storage = `${parseInt(explicitTb[1], 10)}TB`;
  } else {
    const explicitGb = title.match(/(\d+)\s*(?:GB|gb)\s*(?:ssd|storage|rom)\b/i);
    if (explicitGb) {
      storage = `${parseInt(explicitGb[1], 10)}GB`;
    } else {
      const allGb = /(?:,\s*|\b)(\d+)\s*(?:GB|gb)\b(?!\s*(?:unified memory|ram))/gi;
      let m;
      while ((m = allGb.exec(title)) !== null) {
        const v = parseInt(m[1], 10);
        if (v >= 16 && v <= 1024) storage = `${v}GB`;
      }
    }
  }

  let size = null;
  const mlMatch = title.match(/(\d+(?:\.\d+)?)\s*(?:ml|g|gm|kg)\b/i);
  if (mlMatch) size = mlMatch[0].toLowerCase();

  return { storage, color, shade, size };
}

export function generateSeriesKey(title, category = '', brand = '') {
  if (!title || typeof title !== 'string' || isAccessory(title)) return null;
  const lower = title.toLowerCase();

  // 1. MacBook Series
  if (lower.includes('macbook')) {
    let family = 'macbook';
    if (lower.includes('macbook neo')) family = 'macbook-neo';
    else if (lower.includes('macbook air')) family = 'macbook-air';
    else if (lower.includes('macbook pro')) family = 'macbook-pro';

    let screen = '';
    const screenMatch = lower.match(/(13(?:\.3|\.6)?|14(?:\.2)?|15(?:\.3)?|16(?:\.2)?)/);
    if (screenMatch) screen = '-' + Math.round(parseFloat(screenMatch[1]));

    let chip = '';
    if (lower.includes('a18 pro') || lower.includes('a18pro') || (family === 'macbook-neo' && lower.includes('2026'))) {
      chip = '-a18pro';
    } else if (lower.includes('m5')) chip = '-m5';
    else if (lower.includes('m4 pro')) chip = '-m4pro';
    else if (lower.includes('m4 max')) chip = '-m4max';
    else if (lower.includes('m4')) chip = '-m4';
    else if (lower.includes('m3 pro')) chip = '-m3pro';
    else if (lower.includes('m3 max')) chip = '-m3max';
    else if (lower.includes('m3')) chip = '-m3';
    else if (lower.includes('m2 pro')) chip = '-m2pro';
    else if (lower.includes('m2')) chip = '-m2';
    else if (lower.includes('m1')) chip = '-m1';

    return `apple-${family}${screen}${chip}`;
  }

  // 2. iPhone Series
  if (lower.includes('iphone')) {
    const m = lower.match(/iphone\s*(\d{1,2}(?:\s*se)?)(?:\s*(pro\s*max|pro|plus|mini))?/i);
    if (m) {
      const num = m[1].replace(/\s+/g, '');
      const tier = m[2] ? '-' + m[2].replace(/\s+/g, '-') : '';
      return `apple-iphone-${num}${tier}`;
    }
  }

  // 3. Samsung Galaxy S Series
  if (lower.includes('galaxy s')) {
    const m = lower.match(/galaxy\s*s(\d{2})(?:\s*(ultra|plus|\+))?/i);
    if (m) {
      const num = m[1];
      const tier = m[2] ? (m[2] === '+' ? '-plus' : '-' + m[2]) : '';
      return `samsung-galaxy-s${num}${tier}`;
    }
  }

  // 4. Beauty foundations & lipsticks
  if (category === 'beauty' || lower.includes('foundation') || lower.includes('lipstick') || lower.includes('lip tint')) {
    if (lower.includes('fit me') && (lower.includes('foundation') || lower.includes('matte'))) {
      return 'maybelline-fit-me-matte-poreless-foundation';
    }
    if (lower.includes('super stay') || lower.includes('superstay')) {
      return 'maybelline-superstay-matte-ink';
    }
    if (lower.includes('studio fix')) {
      return 'mac-studio-fix-fluid';
    }
    if (lower.includes('powerplay') || (lower.includes('lakme') && lower.includes('matte lipstick'))) {
      return 'lakme-powerplay-priming-matte-lipstick';
    }
  }

  return null;
}

/**
 * Aggregates a raw list of products or deals into a clean, deduplicated series feed.
 * For each series, retains 1 primary representative card (the lowest-priced variant)
 * and attaches aggregated variant statistics (count, available storages, colors, shades).
 */
export function aggregateSeriesFeed(items) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const seriesMap = new Map();
  const result = [];

  for (const item of items) {
    const key = generateSeriesKey(item.title, item.category, item.brand);
    if (!key) {
      result.push(item);
      continue;
    }

    if (!seriesMap.has(key)) {
      const group = {
        representative: { ...item },
        siblings: [item],
        resultIndex: result.length,
      };
      seriesMap.set(key, group);
      result.push(group.representative);
    } else {
      const group = seriesMap.get(key);
      group.siblings.push(item);

      const currentHasImage = isUsableImageUrl(group.representative.imageUrl);
      const candidateHasImage = isUsableImageUrl(item.imageUrl);
      const currentBestPrice = Number(group.representative.price || group.representative.dealPrice) || Infinity;
      const candidatePrice = Number(item.price || item.dealPrice) || Infinity;

      let shouldReplace = false;
      if (!currentHasImage && candidateHasImage) {
        shouldReplace = true;
      } else if (currentHasImage && !candidateHasImage) {
        shouldReplace = false;
      } else if (candidatePrice < currentBestPrice && candidatePrice > 0) {
        shouldReplace = true;
      }

      if (shouldReplace) {
        group.representative = { ...item };
        result[group.resultIndex] = group.representative;
      }
    }
  }

  // Enrich series representatives with aggregated traits
  for (const [key, group] of seriesMap.entries()) {
    if (group.siblings.length <= 1) continue;

    const prices = group.siblings
      .map((s) => Number(s.price || s.dealPrice))
      .filter((p) => p > 0);
    const lowestPrice = Math.min(...prices);
    const highestPrice = Math.max(...prices);

    const storages = Array.from(
      new Set(group.siblings.map((s) => extractVariantTraits(s.title).storage).filter(Boolean))
    );
    const colors = Array.from(
      new Set(group.siblings.map((s) => extractVariantTraits(s.title).color).filter(Boolean))
    );
    const shades = Array.from(
      new Set(group.siblings.map((s) => extractVariantTraits(s.title).shade).filter(Boolean))
    );
    const sizes = Array.from(
      new Set(group.siblings.map((s) => extractVariantTraits(s.title).size).filter(Boolean))
    );

    const rep = group.representative;
    rep.isSeriesCard = true;
    rep.seriesKey = key;
    rep.seriesVariantCount = group.siblings.length;
    rep.seriesLowestPrice = lowestPrice;
    rep.seriesHighestPrice = highestPrice;
    rep.seriesStorages = storages;
    rep.seriesColors = colors;
    rep.seriesShades = shades;
    rep.seriesSizes = sizes;
    rep.price = lowestPrice;
    if (rep.dealPrice) rep.dealPrice = lowestPrice;

    // Guaranteed Image Integrity: if representative has no usable image, inherit from sibling that does
    if (!isUsableImageUrl(rep.imageUrl)) {
      const siblingWithImage = group.siblings.find((s) => isUsableImageUrl(s.imageUrl));
      if (siblingWithImage) {
        rep.imageUrl = siblingWithImage.imageUrl;
      }
    }
  }

  return result;
}
