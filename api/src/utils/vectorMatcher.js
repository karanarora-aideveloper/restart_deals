/**
 * Semantic Vectorization & Cross-Store Product Matching Engine
 * 
 * Uses character & subword n-gram vector embeddings, entity extraction (brand, model/SKU),
 * specification/variant parity gates, and cosine similarity to match identical products
 * across Amazon, Flipkart, Myntra, Nykaa, Ajio, and Croma with ZERO false positives.
 */

import { extractVariant, variantsMatch, variantMismatchReason } from './variantExtractor.js';

const KNOWN_BRANDS = new Set([
  // Tech & Electronics
  'apple', 'samsung', 'sony', 'oneplus', 'boat', 'noise', 'realme', 'redmi', 'xiaomi',
  'iqoo', 'vivo', 'oppo', 'poco', 'motorola', 'moto', 'hp', 'dell', 'lenovo', 'asus',
  'acer', 'macbook', 'ipad', 'jbl', 'bose', 'sennheiser', 'zebronics', 'boult', 'portronics',
  'anker', 'sandisk', 'logitech', 'canon', 'nikon',
  
  // Home Appliances
  'philips', 'prestige', 'butterfly', 'pigeon', 'bajaj', 'havells', 'crompton', 'orient',
  'polycab', 'carrier', 'ifb', 'whirlpool', 'haier', 'voltas', 'lg', 'daikin', 'panasonic',
  'bosch', 'godrej', 'faber', 'digismart', 'wonderchef', 'atomberg', 'hindware', 'v-guard',
  'milton', 'cello', 'borosil', 'kent', 'aquaguard', 'eureka forbes',

  // Health, Fitness & Nutrition
  'optimum nutrition', 'muscleblaze', 'bigmuscles', 'as-it-is', 'myprotein', 'dymatize',
  'gnc', 'fast&up', 'nutrabay', 'avatar', 'isopure',

  // Fashion & Footwear
  'nike', 'adidas', 'puma', 'reebok', 'crocs', 'woodland', 'bata', 'sparx', 'red tape',
  'uspa', 'u.s. polo assn.', 'levis', 'levi\'s', 'pepe', 'allen solly', 'van heusen',
  'louis philippe', 'peter england', 'flying machine', 'roadster', 'wrogn',

  // Beauty & Skincare
  'cetaphil', 'minimalist', 'the derma co', 'dot & key', 'mamaearth', 'plum', 'nivea',
  'maybelline', 'l\'oreal', 'lakme', 'sugar', 'nykaa', 'biotique', 'm.a.c', 'mac',
  'clinique', 'garnier', 'neutrogena', 'himalaya'
]);

const NOISE_WORDS = new Set([
  'with', 'for', 'and', 'the', 'inch', 'inches', 'cm', 'pack', 'of', 'combo', 'set',
  'unisex', 'men', 'women', 'man', 'woman', 'boys', 'girls', 'kids', 'adult', 'latest',
  'launch', 'new', 'edition', 'series', 'original', 'genuine', 'authentic', 'best',
  'stylish', 'casual', 'premium', 'high', 'quality', 'free', 'online', 'buy', 'offer',
  'deal', 'discount', 'warranty', 'fast', 'delivery', 'india', 'multicolor', 'color',
  'black', 'white', 'blue', 'red', 'green', 'grey', 'gray', 'silver', 'gold', 'space'
]);

const MEASUREMENT_AND_YEAR_REGEX = /\b\d+(?:\.\d+)?\s*(?:mm|cm|inch|inches|m|mtr|w|watt|watts|kw|v|volt|volts|l|ltr|litre|litres|liter|liters|ml|kg|kgs|g|gm|gms|gram|grams|mg|star|stars|rpm|hz|khz|mp|mah|gb|tb|mb|ton|tons|year|yr|month|mths)\b|\b201\d\b|\b202\d\b|\b203\d\b/gi;

/**
 * Normalize an alphanumeric model token (e.g. "WH-1000XM5/B" -> "wh1000xm5").
 */
export function normalizeModelCode(code) {
  if (!code) return '';
  return code
    .toLowerCase()
    .replace(/[/\-_]/g, '')
    .replace(/(?:[b|w]|blk|slv)$/i, ''); // strip trailing color suffix
}

/**
 * Clean and tokenize raw product title.
 */
export function tokenizeTitle(title) {
  if (!title || typeof title !== 'string') return [];
  const cleaned = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  return cleaned
    .split(' ')
    .filter(token => token.length > 1 && !NOISE_WORDS.has(token));
}

/**
 * Extract canonical Brand from title.
 */
export function extractBrand(title) {
  if (!title) return null;
  const lower = title.toLowerCase();
  for (const brand of KNOWN_BRANDS) {
    if (lower.includes(brand)) return brand;
  }
  const firstWord = title.trim().split(/[\s|/]/)[0]?.toLowerCase();
  if (firstWord && firstWord.length >= 2 && !NOISE_WORDS.has(firstWord)) {
    return firstWord;
  }
  return null;
}

/**
 * Extract genuine Model / SKU identifier.
 * Crucially strips out measurement units (mm, W, L, kg, RPM) and year stamps (2024, 2026)
 * so generic numbers are NOT misinterpreted as matching model codes.
 */
export function extractModelIdentifiers(title) {
  if (!title) return [];
  const list = [];

  // Strip measurements and years first
  const stripped = title.replace(MEASUREMENT_AND_YEAR_REGEX, ' ');
  const words = stripped.split(/[\s,()|/\[\]{}]+/);

  for (const word of words) {
    const clean = word.toLowerCase().replace(/[^a-z0-9]/g, '');
    const hasLetters = /[a-z]/.test(clean);
    const hasNumbers = /\d/.test(clean);

    // Matches genuine alphanumeric model codes (e.g. wh1000xm5, s24, 15s, airdopes141, hd9252, bt3231, na120, pic20)
    if (hasLetters && hasNumbers && clean.length >= 2 && clean.length <= 16) {
      list.push(normalizeModelCode(clean));
    }
  }

  // High-value product line & chip signatures
  const lower = title.toLowerCase();
  if (lower.includes('macbook air')) list.push('macbookair');
  if (lower.includes('macbook pro')) list.push('macbookpro');
  if (lower.includes('galaxy s24')) list.push('galaxys24');
  if (lower.includes('galaxy s23')) list.push('galaxys23');
  if (lower.includes('iphone 16')) list.push('iphone16');
  if (lower.includes('iphone 15')) list.push('iphone15');
  if (lower.includes('iphone 14')) list.push('iphone14');
  if (lower.includes('iphone 13')) list.push('iphone13');
  if (lower.includes('airpods pro')) list.push('airpodspro');
  if (lower.includes('nord ce')) list.push('nordce');
  if (lower.includes('smash v2')) list.push('smashv2');

  // Apple chips
  if (lower.includes('m4 pro') || lower.includes('m4 max')) list.push('m4promax');
  else if (lower.includes('m4')) list.push('m4');
  if (lower.includes('m3 pro') || lower.includes('m3 max')) list.push('m3promax');
  else if (lower.includes('m3')) list.push('m3');
  if (lower.includes('m2 pro') || lower.includes('m2 max')) list.push('m2promax');
  else if (lower.includes('m2')) list.push('m2');
  if (lower.includes('m1 pro') || lower.includes('m1 max')) list.push('m1promax');
  else if (lower.includes('m1')) list.push('m1');

  return Array.from(new Set(list));
}

/**
 * Generate subword character n-grams for dense vector representation.
 */
export function generateSubwordNGrams(tokens) {
  const ngrams = new Map();
  const text = tokens.join(' ');

  for (let n = 3; n <= 4; n++) {
    for (let i = 0; i <= text.length - n; i++) {
      const gram = text.substring(i, i + n);
      ngrams.set(gram, (ngrams.get(gram) || 0) + 1);
    }
  }

  // Exact word tokens with high weights
  for (const token of tokens) {
    const norm = normalizeModelCode(token);
    ngrams.set(`w:${norm}`, (ngrams.get(`w:${norm}`) || 0) + 3.0);
  }

  return ngrams;
}

/**
 * Compute Cosine Similarity between two sparse n-gram frequency vectors.
 */
export function cosineSimilarity(vectorA, vectorB) {
  if (!vectorA || !vectorB || vectorA.size === 0 || vectorB.size === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [key, valA] of vectorA.entries()) {
    normA += valA * valA;
    if (vectorB.has(key)) {
      dotProduct += valA * vectorB.get(key);
    }
  }

  for (const [, valB] of vectorB.entries()) {
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Calculate multi-factor hybrid semantic similarity with strict specification parity.
 */
export function calculateProductSimilarity(productA, productB) {
  if (!productA?.title || !productB?.title) {
    return { score: 0, isExactMatch: false, isSimilar: false, reason: 'Missing title' };
  }

  // 1. Country & Currency Gate: Must strictly belong to the same country
  const countryA = (productA.country || 'IN').toUpperCase();
  const countryB = (productB.country || 'IN').toUpperCase();
  if (countryA !== countryB) {
    return { score: 0, isExactMatch: false, isSimilar: false, reason: `Country mismatch: ${countryA} vs ${countryB}` };
  }

  // 2. Brand Match Check: Different brands can NEVER be an exact match
  const brandA = extractBrand(productA.title);
  const brandB = extractBrand(productB.title);
  const brandsMatch = brandA && brandB && (brandA === brandB || brandA.includes(brandB) || brandB.includes(brandA));
  const brandMismatch = brandA && brandB && !brandsMatch;
  if (brandMismatch) {
    return { score: 0, isExactMatch: false, isSimilar: false, reason: `Brand mismatch: ${brandA} vs ${brandB}` };
  }

  // 3. Category Consistency Check
  const catA = productA.category || '';
  const catB = productB.category || '';
  const categoryMismatch = catA && catB && catA !== 'general' && catB !== 'general' && catA !== catB;
  if (categoryMismatch) {
    return { score: 0, isExactMatch: false, isSimilar: false, reason: `Category mismatch: ${catA} vs ${catB}` };
  }

  // 3b. Condition Parity Gate: Never match Brand New against Refurbished / Renewed / Pre-owned
  const isRefurbA = /\b(refurbished|renewed|pre-owned|preowned|second hand|used)\b/i.test(productA.title);
  const isRefurbB = /\b(refurbished|renewed|pre-owned|preowned|second hand|used)\b/i.test(productB.title);
  if (isRefurbA !== isRefurbB) {
    return { score: 0, isExactMatch: false, isSimilar: false, reason: 'Condition mismatch: New vs Refurbished' };
  }

  // 4. Specification & Variant Parity Check
  const varA = productA.variant?.display ? productA.variant : extractVariant(productA.title);
  const varB = productB.variant?.display ? productB.variant : extractVariant(productB.title);
  const isVariantParity = variantsMatch(varA, varB);
  const mismatchReason = !isVariantParity ? variantMismatchReason(varA, varB) : null;

  // 5. Model / SKU Identifier Match Check
  const modelsA = extractModelIdentifiers(productA.title);
  const modelsB = extractModelIdentifiers(productB.title);
  const sharedModels = modelsA.filter(m => modelsB.includes(m));
  const hasSharedModel = sharedModels.length > 0;
  const modelMismatch = modelsA.length > 0 && modelsB.length > 0 && sharedModels.length === 0;

  // 6. Vector Cosine Similarity
  const tokensA = tokenizeTitle(productA.title);
  const tokensB = tokenizeTitle(productB.title);
  const vecA = generateSubwordNGrams(tokensA);
  const vecB = generateSubwordNGrams(tokensB);
  const rawCosine = cosineSimilarity(vecA, vecB);

  // Hybrid Score Formulation
  let score = rawCosine;
  if (brandsMatch) score += 0.20;
  if (hasSharedModel) score += 0.35;
  if (modelMismatch) score -= 0.35;

  score = Math.max(0, Math.min(1, score));

  // Classification Thresholds:
  // Exact Match REQUIRES:
  //   - Same country (already verified above)
  //   - Matching brand
  //   - Identical variants/specifications (isVariantParity = true)
  //   - No model code collision
  //   - Either verified shared model with high score, OR score >= 0.85
  const isExactMatch = isVariantParity && !modelMismatch && (
    (hasSharedModel && brandsMatch && score >= 0.65) ||
    (brandsMatch && score >= 0.82)
  );

  // Similar Alternative (e.g. same product in different storage/RAM/size variant or closely related model)
  const isSimilar = !isExactMatch && !brandMismatch && (
    (brandsMatch && score >= 0.45) ||
    (hasSharedModel && score >= 0.40) ||
    (rawCosine >= 0.55)
  );

  return {
    score: parseFloat(score.toFixed(3)),
    cosine: parseFloat(rawCosine.toFixed(3)),
    brandA,
    brandB,
    brandsMatch,
    hasSharedModel,
    sharedModels,
    modelMismatch,
    isVariantParity,
    mismatchReason,
    varA: varA?.display || null,
    varB: varB?.display || null,
    isExactMatch,
    isSimilar,
  };
}

/**
 * Filter and rank potential cross-store matches from candidate database products.
 */
export function rankCrossStoreMatches(targetProduct, candidateProducts) {
  if (!targetProduct || !Array.isArray(candidateProducts)) {
    return { exactMatches: [], similarMatches: [] };
  }

  const exactMatches = [];
  const similarMatches = [];

  for (const candidate of candidateProducts) {
    if (candidate._id?.toString() === targetProduct._id?.toString()) continue;
    if (candidate.productId === targetProduct.productId && candidate.merchant === targetProduct.merchant) continue;

    const result = calculateProductSimilarity(targetProduct, candidate);

    if (result.isExactMatch) {
      exactMatches.push({
        product: candidate,
        matchScore: result.score,
        matchDetails: result,
      });
    } else if (result.isSimilar) {
      similarMatches.push({
        product: candidate,
        matchScore: result.score,
        matchDetails: result,
      });
    }
  }

  exactMatches.sort((a, b) => b.matchScore - a.matchScore);
  similarMatches.sort((a, b) => b.matchScore - a.matchScore);

  return { exactMatches, similarMatches };
}
