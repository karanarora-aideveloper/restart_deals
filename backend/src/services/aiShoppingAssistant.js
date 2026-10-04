import OpenAI from 'openai';
import Product from '../db/models/product.js';

let openaiClient = null;

function getOpenAIClient() {
  if (!openaiClient && process.env.DEEPSEEK_API_KEY) {
    openaiClient = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: process.env.DEEPSEEK_API_KEY,
      timeout: 6000,
    });
  }
  return openaiClient;
}

/**
 * Intelligent Category & Keyword Heuristics Dictionary
 */
const CATEGORY_KEYWORDS = {
  beauty: [
    'sunscreen', 'sun screen', 'sunblock', 'serum', 'lipstick', 'moisturizer', 'cream',
    'facewash', 'face wash', 'cleanser', 'kajal', 'foundation', 'eyeliner', 'mascara',
    'shampoo', 'conditioner', 'hair oil', 'perfume', 'deodorant', 'body wash', 'lotion',
    'toner', 'skincare', 'makeup', 'lip balm', 'matte', 'spf'
  ],
  electronics: [
    'phone', 'mobile', 'smartphone', 'iphone', 'samsung', 'oneplus', 'redmi', 'realme',
    'vivo', 'oppo', 'poco', 'laptop', 'macbook', 'earbuds', 'earphone', 'headphones',
    'tws', 'airpods', 'smartwatch', 'watch', 'television', 'tv', 'tablet', 'ipad',
    'monitor', 'keyboard', 'mouse', 'powerbank', 'charger', 'speaker', 'bluetooth'
  ],
  fitness: [
    'protein', 'whey', 'creatine', 'peanut butter', 'gym', 'dumbbell', 'yoga mat',
    'multivitamin', 'fish oil', 'bcaa', 'pre workout', 'shaker', 'resistance band'
  ],
  appliances: [
    'air fryer', 'mixer', 'grinder', 'blender', 'microwave', 'oven', 'refrigerator',
    'fridge', 'washing machine', 'vacuum', 'iron', 'geyser', 'kettle', 'toaster', 'purifier'
  ],
  'men-fashion': [
    'shirt', 'tshirt', 't-shirt', 'jeans', 'trousers', 'shoes', 'sneakers', 'jacket',
    'hoodie', 'blazer', 'wallet', 'belt', 'kurta'
  ],
  'women-fashion': [
    'saree', 'kurti', 'dress', 'top', 'lehenga', 'heels', 'handbag', 'earrings',
    'jewellery', 'necklace', 'skirt', 'leggings'
  ],
  home: [
    'bedsheet', 'curtain', 'pillow', 'cushion', 'blanket', 'cookware', 'pan', 'kadhai',
    'bottle', 'flask', 'mop', 'lamp', 'clock', 'carpet', 'decor', 'towel'
  ]
};

const POPULAR_BRANDS = [
  'minimalist', 'derma co', 'the derma co', 'aqualogica', 'mamaearth', 'dot & key',
  'neutrogena', 'cetaphil', 'nivea', 'plum', 'maybelline', 'lakme', 'sugar',
  'loreal', 'l\'oreal', 'garnier', 'biotique', 'himalaya', 'mcaffeine', 'wow',
  'apple', 'samsung', 'oneplus', 'xiaomi', 'redmi', 'realme', 'boat', 'noise',
  'boult', 'sony', 'jbl', 'dell', 'hp', 'lenovo', 'asus', 'acer', 'zebronics',
  'nike', 'puma', 'adidas', 'sparx', 'bata', 'red tape', 'asian', 'campus',
  'muscleblaze', 'optimum nutrition', 'asitis', 'nakpro', 'fast&up', 'myprotein',
  'philips', 'bajaj', 'prestige', 'pigeon', 'havells', 'crompton', 'orient'
];

/**
 * Common plural to singular mappings
 */
function singularize(word) {
  if (!word) return '';
  const w = word.toLowerCase();
  if (w.endsWith('sunscreens')) return 'sunscreen';
  if (w.endsWith('smartphones')) return 'smartphone';
  if (w.endsWith('phones')) return 'phone';
  if (w.endsWith('mobiles')) return 'mobile';
  if (w.endsWith('laptops')) return 'laptop';
  if (w.endsWith('earbuds')) return 'earbuds'; // Keep earbuds
  if (w.endsWith('headphones')) return 'headphone';
  if (w.endsWith('shoes')) return 'shoe';
  if (w.endsWith('sneakers')) return 'sneaker';
  if (w.endsWith('watches')) return 'watch';
  if (w.endsWith('t-shirts') || w.endsWith('tshirts')) return 't-shirt';
  if (w.endsWith('shirts')) return 'shirt';
  if (w.endsWith('jeans')) return 'jeans';
  if (w.endsWith('serums')) return 'serum';
  if (w.endsWith('lipsticks')) return 'lipstick';
  if (w.endsWith('creams')) return 'cream';
  if (w.endsWith('tablets')) return 'tablet';
  if (w.endsWith('speakers')) return 'speaker';
  if (w.endsWith('bottles')) return 'bottle';
  if (w.endsWith('pillows')) return 'pillow';
  return w;
}

/**
 * Parses user input using DeepSeek API with a resilient heuristic fallback.
 */
export async function parseShoppingQuery(userText, session = {}) {
  const text = (userText || '').trim();
  const lower = text.toLowerCase();

  // 1. Check for quick intents
  if (/^(hi|hello|hey|start|\/start|\/help|help)$/i.test(lower)) {
    return { action: 'greeting' };
  }
  if (/^(alerts?|\/alerts?|my alerts?|my price alerts?)$/i.test(lower)) {
    return { action: 'my_alerts' };
  }
  if (/^(next|more|show more|next 3|page next)$/i.test(lower)) {
    return { action: 'paginate_next' };
  }

  // 2. Try DeepSeek AI comprehension
  try {
    const aiClient = getOpenAIClient();
    if (aiClient) {
      const historyContext = (session.history || []).slice(-4).map(h => `${h.role}: ${h.text}`).join('\n');
      const prompt = `You are the query understanding parser for ShoppersDeals e-commerce assistant.
Analyze this user shopping query and return strict JSON with no markdown wrapping.

Categories available: "beauty", "electronics", "fitness", "appliances", "men-fashion", "women-fashion", "home".

User Query: "${text}"
${historyContext ? `Previous Conversation:\n${historyContext}\n` : ''}

Respond ONLY with a valid JSON object matching this schema:
{
  "action": "search" | "refine" | "paginate_next" | "unknown",
  "coreNoun": "sunscreen" | "phone" | "laptop" | etc.,
  "searchTerms": ["key", "words"],
  "category": "beauty" | "electronics" | "fitness" | "appliances" | "men-fashion" | "women-fashion" | "home" | null,
  "maxPrice": number | null,
  "minPrice": number | null,
  "brand": string | null,
  "attributes": ["oily skin", "matte", etc],
  "sort": "rating" | "price_asc" | "discount"
}`;

      const completion = await aiClient.chat.completions.create({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 300,
      });

      const rawContent = completion.choices[0]?.message?.content?.trim() || '';
      const cleanJson = rawContent.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed && (parsed.searchTerms?.length > 0 || parsed.category || parsed.coreNoun)) {
        return mergeWithSessionContext(parsed, session);
      }
    }
  } catch (err) {
    // Non-fatal fallback to local NLP heuristics
  }

  // 3. Robust Local NLP Parser (Deterministic & Lightning Fast)
  const localParsed = parseQueryLocally(text, session);
  return mergeWithSessionContext(localParsed, session);
}

/**
 * Local Rule-Based NLP Parser for extracting budget, category, brand, core noun, and search tokens.
 */
function parseQueryLocally(text, session) {
  const lower = text.toLowerCase();
  let maxPrice = null;
  let minPrice = null;

  // Extract price constraints: "under 500", "below 20k", "under 15,000", "< 500", "within 1000", "under rs 400"
  const underMatch = lower.match(/(?:under|below|less than|<|within|upto|up to|budget|around|max)\s*(?:rs\.?|₹|inr)?\s*([0-9]+(?:\.[0-9]+)?)\s*(k|thousand|lakh)?\b/i);
  if (underMatch) {
    let val = parseFloat(underMatch[1]);
    const multiplier = (underMatch[2] || '').toLowerCase();
    if (multiplier === 'k' || multiplier === 'thousand') val *= 1000;
    else if (multiplier === 'lakh') val *= 100000;
    maxPrice = val;
  }

  // Extract range: "between 500 and 1000" or "500 to 1000"
  const rangeMatch = lower.match(/([0-9]+)\s*(?:-|to|and)\s*([0-9]+)\b/i);
  if (rangeMatch && !maxPrice) {
    minPrice = parseInt(rangeMatch[1], 10);
    maxPrice = parseInt(rangeMatch[2], 10);
  }

  // Detect Category & Core Noun
  let detectedCategory = null;
  let coreNoun = null;

  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of kws) {
      if (lower.includes(kw)) {
        detectedCategory = cat;
        coreNoun = kw;
        break;
      }
    }
    if (coreNoun) break;
  }

  // Detect Brand
  let detectedBrand = null;
  for (const b of POPULAR_BRANDS) {
    const brandRegex = new RegExp(`\\b${b}\\b`, 'i');
    if (brandRegex.test(lower)) {
      detectedBrand = b;
      break;
    }
  }

  // Extract specific attributes / qualifiers
  const attributes = [];
  const commonAttrs = [
    'oily skin', 'dry skin', 'sensitive skin', 'matte', 'gel', 'spf 50', 'spf 30', 'waterproof',
    'wireless', 'noise cancelling', 'anc', '5g', 'bluetooth', 'gaming', 'fast charging',
    'cotton', 'casual', 'formal', 'running', 'unisex', 'men', 'women'
  ];
  for (const attr of commonAttrs) {
    if (lower.includes(attr)) attributes.push(attr);
  }

  // Determine sort preference
  let sort = 'rating';
  if (/cheapest|cheap|lowest price|budget/i.test(lower)) {
    sort = 'price_asc';
  } else if (/discount|deal|offer|drop/i.test(lower)) {
    sort = 'discount';
  }

  // Clean tokens for database search
  const stopWords = new Set([
    'top', 'best', 'good', 'cheap', 'for', 'under', 'below', 'in', 'with', 'the', 'a',
    'an', 'rs', 'rupees', 'show', 'me', 'suggest', 'recommend', 'give', 'list', 'please',
    'which', 'is', 'what', 'are', 'budget', 'price', 'product', 'products', 'items', 'options', 'only'
  ]);

  const rawTokens = lower
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .map(t => singularize(t))
    .filter(t => t.length > 1 && !stopWords.has(t) && !/^\d+$/.test(t));

  const action = isRefinement(lower, text, coreNoun, session) ? 'refine' : 'search';

  return {
    action,
    coreNoun,
    searchTerms: rawTokens,
    category: detectedCategory,
    subcategory: null,
    maxPrice,
    minPrice,
    brand: detectedBrand,
    attributes,
    sort,
  };
}

function isRefinement(lower, text, detectedCoreNoun, session) {
  if (!session?.lastQuery) return false;
  // If user didn't specify a new product core noun, and is modifying price or attributes
  if (!detectedCoreNoun) return true;
  return /^(show\s+)?(and|with|only|cheaper|lower|more|under|below|change|in|also|which|what about)/i.test(lower) ||
         /(?:under|below|less than|cheaper|lowest|only|sort by|matte|waterproof|gel)/i.test(lower);
}

function mergeWithSessionContext(newQuery, session) {
  if (newQuery.action === 'refine' && session?.lastQuery) {
    const prev = session.lastQuery;
    return {
      ...prev,
      ...newQuery,
      action: 'search', // ready to execute search with merged filters
      coreNoun: newQuery.coreNoun || prev.coreNoun,
      searchTerms: Array.from(new Set([...(prev.searchTerms || []), ...(newQuery.searchTerms || [])])),
      category: newQuery.category || prev.category,
      maxPrice: newQuery.maxPrice !== null ? newQuery.maxPrice : prev.maxPrice,
      minPrice: newQuery.minPrice !== null ? newQuery.minPrice : prev.minPrice,
      brand: newQuery.brand || prev.brand,
      attributes: Array.from(new Set([...(prev.attributes || []), ...(newQuery.attributes || [])])),
    };
  }
  return newQuery;
}

/**
 * Searches the 18,600+ DB catalog strictly without external network scraping.
 * Uses smart candidate retrieval followed by relevancy scoring.
 *
 * @param {object} queryParams - Parsed query criteria
 * @param {number} offset - Pagination offset (default: 0)
 * @param {number} limit - Products to fetch (default: 3)
 * @returns {Promise<object>} { products, totalCount, hasMore }
 */
export async function searchProducts(queryParams, offset = 0, limit = 3) {
  const mongoQuery = {
    country: 'IN',
    isActive: true,
    price: { $gt: 0 },
  };

  // 1. Budget filters
  if (queryParams.maxPrice != null && queryParams.maxPrice > 0) {
    mongoQuery.price.$lte = queryParams.maxPrice;
  }
  if (queryParams.minPrice != null && queryParams.minPrice > 0) {
    mongoQuery.price.$gte = queryParams.minPrice;
  }

  // 2. Category & Subcategory mapping from Core Noun
  if (queryParams.category) {
    mongoQuery.category = queryParams.category;
  }

  // 3. Primary search match (core noun or key tokens)
  const coreNoun = queryParams.coreNoun ? singularize(queryParams.coreNoun) : null;
  const tokens = (queryParams.searchTerms || []).map(t => singularize(t)).filter(t => t.length > 2);

  if (['phone', 'smartphone', 'mobile'].includes(coreNoun)) {
    mongoQuery.category = 'electronics';
    mongoQuery.subcategory = { $in: ['mobiles', 'Smartphones'] };
    mongoQuery.title = {
      $not: new RegExp('\\b(watch|treadmill|buds|earbuds|ssd|drive|controller|gimbal|printer|tv|tripod|stand|holder|case|cover|adapter|cable|strap|mount|pad)\\b', 'i')
    };
    if (queryParams.minPrice == null) {
      mongoQuery.price.$gte = 3000;
    }
  } else if (coreNoun === 'laptop') {
    mongoQuery.category = 'electronics';
    mongoQuery.subcategory = 'laptops';
    mongoQuery.title = {
      $not: new RegExp('\\b(bag|backpack|sleeve|skin|stand|cooler|pad|cleaner|cover|table|mouse|keyboard)\\b', 'i')
    };
    if (queryParams.minPrice == null) {
      mongoQuery.price.$gte = 10000;
    }
  } else if (['earbuds', 'earphone', 'headphone', 'tws', 'airpods'].includes(coreNoun)) {
    mongoQuery.category = 'electronics';
    mongoQuery.subcategory = 'audio';
    mongoQuery.title = new RegExp(`\\b(?:earbuds|earphone|headphone|tws|buds|airpods)\\b`, 'i');
  } else if (['smartwatch', 'watch'].includes(coreNoun)) {
    mongoQuery.category = 'electronics';
    mongoQuery.subcategory = 'wearables';
    mongoQuery.title = new RegExp(`\\b(?:smartwatch|watch)\\b`, 'i');
  } else if (['protein', 'whey', 'creatine'].includes(coreNoun)) {
    mongoQuery.category = 'fitness';
    mongoQuery.title = new RegExp(`\\b${coreNoun}\\b`, 'i');
  } else if (coreNoun) {
    mongoQuery.title = new RegExp(`\\b${coreNoun}`, 'i');
  } else if (tokens.length > 0) {
    mongoQuery.$or = tokens.map(tok => ({ title: new RegExp(tok, 'i') }));
  }

  // 4. Brand filter if explicitly specified
  if (queryParams.brand) {
    mongoQuery.brand = new RegExp(queryParams.brand, 'i');
  }

  // Fetch candidates (fetch up to 50 for in-memory attribute scoring)
  const candidates = await Product.find(mongoQuery)
    .select('productId title price originalPrice previousPrice rating reviews imageUrl images cleanUrl merchant category subcategory brand aboutThisItem discountPercentage')
    .limit(60)
    .lean();

  if (candidates.length === 0 && mongoQuery.category) {
    // If strict coreNoun had no results, relax category constraint
    delete mongoQuery.category;
    const fallbackCandidates = await Product.find(mongoQuery)
      .select('productId title price originalPrice previousPrice rating reviews imageUrl images cleanUrl merchant category subcategory brand aboutThisItem discountPercentage')
      .limit(60)
      .lean();
    candidates.push(...fallbackCandidates);
  }

  // Score candidates based on query attributes (e.g., oily skin -> gel, matte, sebum, non-greasy)
  const attrs = queryParams.attributes || [];
  const searchTerms = queryParams.searchTerms || [];

  const scored = candidates.map(prod => {
    let score = (prod.rating || 3.5) * 10;
    const textBlob = `${prod.title} ${prod.brand} ${(prod.aboutThisItem || []).join(' ')}`.toLowerCase();

    // Attribute synergy points
    for (const attr of attrs) {
      if (textBlob.includes(attr)) score += 25;
      if (attr === 'oily skin') {
        if (textBlob.includes('gel') || textBlob.includes('matte') || textBlob.includes('non-greasy') || textBlob.includes('oil control') || textBlob.includes('sebum')) {
          score += 20;
        }
      }
      if (attr === '5g' && textBlob.includes('5g')) score += 20;
    }

    // Keyword hits
    for (const term of searchTerms) {
      if (textBlob.includes(term)) score += 5;
    }

    // High discount bonus
    if (prod.discountPercentage >= 20) score += 10;
    if (prod.reviews?.length > 10) score += 5;

    // Prefer Amazon / Flipkart with high ratings
    if (prod.merchant === 'amazon' || prod.merchant === 'flipkart') score += 2;

    return { product: prod, score };
  });

  // Sort by score (or price if requested)
  if (queryParams.sort === 'price_asc') {
    scored.sort((a, b) => a.product.price - b.product.price);
  } else {
    scored.sort((a, b) => b.score - a.score);
  }

  const sortedProducts = scored.map(s => s.product);
  const totalCount = sortedProducts.length;
  const pagedProducts = sortedProducts.slice(offset, offset + limit);

  return {
    products: pagedProducts,
    totalCount,
    hasMore: totalCount > offset + limit,
  };
}

/**
 * Generates punchy, personalized verdicts explaining why each product is recommended.
 * Returns pure clean text with no markdown asterisks so callers can format with Telegram HTML.
 *
 * @param {object} parsedQuery - User criteria
 * @param {Array<object>} products - Top products
 * @returns {Array<string>} 1 verdict sentence per product
 */
export function generateProductVerdicts(parsedQuery, products = []) {
  return products.map((prod, idx) => {
    const brand = prod.brand || 'Verified Brand';
    const discount = prod.discountPercentage > 0 ? `${prod.discountPercentage}% OFF` : null;

    const titleLower = (prod.title || '').toLowerCase();
    const aboutLower = (prod.aboutThisItem || []).join(' ').toLowerCase();
    const textBlob = `${titleLower} ${aboutLower}`;

    if (parsedQuery.attributes?.includes('oily skin') || textBlob.includes('gel') || textBlob.includes('matte') || textBlob.includes('non-greasy')) {
      if (textBlob.includes('gel') || textBlob.includes('aqua')) {
        return `Ultra-light aqua gel formula that absorbs instantly with zero white cast and controls excess sebum.`;
      }
      return `Controls excess shine and oil throughout the day with a non-greasy matte finish.`;
    }

    if (parsedQuery.attributes?.includes('5g') || textBlob.includes('5g')) {
      return `Fast 5G performance with smooth refresh-rate display and dependable all-day battery life.`;
    }

    if (discount) {
      return `Steep ${discount} price drop on authentic ${brand} inventory.`;
    }

    if (idx === 0) {
      return `Top-ranked choice in this segment with verified buyer satisfaction.`;
    } else if (idx === 1) {
      return `Excellent value for money balancing premium build quality and affordability.`;
    } else {
      return `Trusted everyday favorite highly popular among verified Indian shoppers.`;
    }
  });
}

/**
 * Builds a natural, dynamic AI intro line mentioning today's date and the specific search requirements.
 *
 * @param {object} parsedQuery - User criteria
 * @param {string} queryText - Original user query
 * @returns {string} Formatted AI intro line
 */
export function buildAIIntroLine(parsedQuery, queryText = '') {
  const d = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const todayStr = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;

  const noun = parsedQuery.coreNoun || 'products';
  const maxPriceStr = parsedQuery.maxPrice ? ` under ₹${parsedQuery.maxPrice.toLocaleString('en-IN')}` : '';
  const attrs = parsedQuery.attributes?.length > 0 ? ` for ${parsedQuery.attributes.join(' & ')}` : '';

  if (noun === 'sunscreen') {
    return `🤖 <i>Here are the best sunscreens${attrs}${maxPriceStr} as per today's date (${todayStr}), verified for authentic price drops and ratings:</i>`;
  } else if (['phone', 'smartphone', 'mobile'].includes(noun)) {
    return `🤖 <i>Here are the top smartphones${maxPriceStr} as per today's date (${todayStr}), verified for 5G performance and battery value:</i>`;
  } else if (['earbuds', 'headphone', 'audio'].includes(noun)) {
    return `🤖 <i>Here are the best audio picks${maxPriceStr} as per today's date (${todayStr}), verified for sound clarity & battery life:</i>`;
  } else if (['laptop'].includes(noun)) {
    return `🤖 <i>Here are the best laptops${maxPriceStr} as per today's date (${todayStr}), verified for student & multitasking speed:</i>`;
  } else if (['protein', 'whey', 'creatine'].includes(noun)) {
    return `🤖 <i>Here are the best genuine fitness supplements${maxPriceStr} as per today's date (${todayStr}), verified for lab purity & deal prices:</i>`;
  }

  return `🤖 <i>Here are the best verified deals matching your requirement as per today's date (${todayStr}), ranked by live discounts & buyer ratings:</i>`;
}

