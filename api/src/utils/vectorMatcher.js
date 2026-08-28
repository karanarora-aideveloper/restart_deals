/**
 * Semantic Vectorization & Cross-Store Product Matching Engine
 * 
 * Uses character & subword n-gram vector embeddings, entity extraction (brand, model/SKU),
 * and cosine similarity to match identical products listed with different titles across
 * Amazon, Flipkart, Myntra, Nykaa, and Ajio.
 */

const KNOWN_BRANDS = new Set([
  'apple', 'samsung', 'sony', 'oneplus', 'boat', 'noise', 'realme', 'redmi', 'xiaomi',
  'iqoo', 'vivo', 'oppo', 'poco', 'motorola', 'moto', 'hp', 'dell', 'lenovo', 'asus',
  'acer', 'macbook', 'ipad', 'jbl', 'bose', 'sennheiser', 'zebronics', 'boult',
  'prestige', 'pigeon', 'philips', 'bajaj', 'havells', 'butterfly', 'milton', 'cello',
  'optimum nutrition', 'muscleblaze', 'bigmuscles', 'as-it-is', 'myprotein', 'dymatize',
  'nike', 'adidas', 'puma', 'reebok', 'crocs', 'woodland', 'bata', 'sparx', 'red tape',
  'uspa', 'u.s. polo assn.', 'levis', 'levi\'s', 'pepe', 'allen solly', 'van heusen',
  'cetaphil', 'minimalist', 'the derma co', 'dot & key', 'mamaearth', 'plum', 'nivea'
]);

const NOISE_WORDS = new Set([
  'with', 'for', 'and', 'the', 'inch', 'inches', 'cm', 'pack', 'of', 'combo', 'set',
  'unisex', 'men', 'women', 'man', 'woman', 'boys', 'girls', 'kids', 'adult', 'latest',
  'launch', 'new', 'edition', 'series', 'original', 'genuine', 'authentic', 'best',
  'stylish', 'casual', 'premium', 'high', 'quality', 'free', 'online', 'buy', 'offer',
  'deal', 'discount', 'warranty', 'fast', 'delivery', 'india', 'multicolor', 'color',
  'black', 'white', 'blue', 'red', 'green', 'grey', 'gray', 'silver', 'gold'
]);

/**
 * Normalize an alphanumeric model token (e.g. "WH-1000XM5/B" -> "wh1000xm5").
 */
export function normalizeModelCode(code) {
  if (!code) return '';
  return code
    .toLowerCase()
    .replace(/[/\-_]/g, '')
    .replace(/[b|w|blk|slv]$/i, ''); // strip trailing color suffix
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
  return firstWord || null;
}

/**
 * Extract Model / SKU identifier (e.g. "WH-1000XM5", "S24 Ultra", "Smash V2", "Iris Plus", "141").
 */
export function extractModelIdentifiers(title) {
  if (!title) return [];
  const list = [];
  const words = title.split(/[\s,()|/\[\]{}]+/);

  for (const word of words) {
    const clean = word.toLowerCase().replace(/[^a-z0-9]/g, '');
    const hasLetters = /[a-z]/.test(clean);
    const hasNumbers = /\d/.test(clean);

    // Matches any alphanumeric model code (e.g. wh1000xm5, s24, 15s, airdopes141, hd9252, bt3231)
    if (hasLetters && hasNumbers && clean.length >= 2 && clean.length <= 16) {
      list.push(normalizeModelCode(clean));
    } else if (hasNumbers && clean.length >= 3 && clean.length <= 6) {
      // Pure numerical model code (e.g. 141, 9252, 1000)
      list.push(clean);
    }
  }

  // Also check multi-word model signatures
  const lower = title.toLowerCase();
  if (lower.includes('smash v2') || lower.includes('smash-v2')) list.push('smashv2');
  if (lower.includes('airpods pro')) list.push('airpodspro');
  if (lower.includes('macbook air')) list.push('macbookair');
  if (lower.includes('macbook pro')) list.push('macbookpro');
  if (lower.includes('galaxy s24')) list.push('galaxys24');
  if (lower.includes('galaxy s23')) list.push('galaxys23');
  if (lower.includes('iphone 15')) list.push('iphone15');
  if (lower.includes('iphone 16')) list.push('iphone16');
  if (lower.includes('nord ce')) list.push('nordce');
  if (lower.includes('iris plus')) list.push('irisplus');

  return Array.from(new Set(list));
}

/**
 * Generate subword character n-grams (tri-grams and 4-grams) for dense vector representation.
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
 * Calculate multi-factor hybrid semantic similarity between two products.
 */
export function calculateProductSimilarity(productA, productB) {
  if (!productA?.title || !productB?.title) {
    return { score: 0, isExactMatch: false, isSimilar: false };
  }

  const tokensA = tokenizeTitle(productA.title);
  const tokensB = tokenizeTitle(productB.title);

  // 1. Vector Cosine Similarity
  const vecA = generateSubwordNGrams(tokensA);
  const vecB = generateSubwordNGrams(tokensB);
  const rawCosine = cosineSimilarity(vecA, vecB);

  // 2. Brand Match Check
  const brandA = extractBrand(productA.title);
  const brandB = extractBrand(productB.title);
  const brandsMatch = brandA && brandB && (brandA === brandB || brandA.includes(brandB) || brandB.includes(brandA));
  const brandMismatch = brandA && brandB && !brandsMatch;

  // 3. Model / SKU Identifier Match Check
  const modelsA = extractModelIdentifiers(productA.title);
  const modelsB = extractModelIdentifiers(productB.title);
  const sharedModels = modelsA.filter(m => modelsB.includes(m));
  const hasSharedModel = sharedModels.length > 0;
  const modelMismatch = modelsA.length > 0 && modelsB.length > 0 && sharedModels.length === 0;

  // 4. Category Check
  const catA = productA.category || '';
  const catB = productB.category || '';
  const categoryMismatch = catA && catB && catA !== 'general' && catB !== 'general' && catA !== catB;

  // Hybrid Score Formulation
  let score = rawCosine;

  if (brandsMatch) score += 0.15;
  if (hasSharedModel) score += 0.35;

  if (brandMismatch) score -= 0.40;
  if (modelMismatch) score -= 0.35; // Penalize if models are explicitly different (e.g. XM5 vs XM4)
  if (categoryMismatch) score -= 0.35;

  score = Math.max(0, Math.min(1, score));

  // Classification Thresholds
  const isExactMatch = (hasSharedModel && (brandsMatch || rawCosine >= 0.4)) || (brandsMatch && score >= 0.72 && !modelMismatch);
  const isSimilar = !isExactMatch && score >= 0.40 && (brandsMatch || rawCosine >= 0.50);

  return {
    score: parseFloat(score.toFixed(3)),
    cosine: parseFloat(rawCosine.toFixed(3)),
    brandA,
    brandB,
    brandsMatch,
    hasSharedModel,
    modelMismatch,
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
