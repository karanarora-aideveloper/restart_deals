import { ObjectId } from 'mongodb';
import { getDb } from './mongodb';
import { computePriceStats } from './priceAnalytics';
import { isUsableImageUrl } from './affiliate';

/**
 * Normalizes a MongoDB document for Next.js JSON serialization
 */
function serializeDoc(doc) {
  if (!doc) return null;
  const res = { ...doc };
  if (res._id) {
    res._id = res._id.toString();
  }
  return res;
}

/**
 * Direct MongoDB fallback for fetching a product by ID or ASIN/PID
 */
export async function directFetchProductById(id) {
  if (!id) return null;
  try {
    const db = await getDb();
    const productsColl = db.collection('products');
    let product = null;

    // 1. Try finding by MongoDB _id
    if (typeof id === 'string' && ObjectId.isValid(id) && id.length === 24) {
      product = await productsColl.findOne({ _id: new ObjectId(id) });
    }

    // 2. Try finding by productId (ASIN / Flipkart PID)
    if (!product) {
      product = await productsColl.findOne({ productId: id });
    }

    // 3. Fallback: If id is actually a Deal _id, look up the deal and its corresponding product
    if (!product && typeof id === 'string' && ObjectId.isValid(id) && id.length === 24) {
      const deal = await db.collection('deals').findOne({ _id: new ObjectId(id) });
      if (deal) {
        if (deal.productId) {
          product = await productsColl.findOne({ productId: deal.productId });
        }
        if (!product && deal.matchedProductId && ObjectId.isValid(deal.matchedProductId)) {
          product = await productsColl.findOne({ _id: new ObjectId(deal.matchedProductId) });
        }
      }
    }

    if (!product) return null;

    const data = serializeDoc(product);

    // Image fallback from deals collection if missing
    if (!data.imageUrl && (!data.images || data.images.length === 0)) {
      const dealFallback = await db
        .collection('deals')
        .findOne({ productId: data.productId, merchant: data.merchant });
      if (dealFallback && (dealFallback.imageUrl || (dealFallback.images && dealFallback.images.length > 0))) {
        data.imageUrl = dealFallback.imageUrl || dealFallback.images[0];
        data.images = dealFallback.images && dealFallback.images.length > 0 ? dealFallback.images : [data.imageUrl];
        data.imageIsFromDeal = true;
      }
    }

    // Attach computed price statistics and buying verdict
    data.priceStats = computePriceStats(data);
    return data;
  } catch (err) {
    console.error(`[dbFallback] directFetchProductById failed for ${id}:`, err.message);
    // Surface infrastructure errors instead of returning null: null means "does not exist"
    // and makes the page render a (cacheable) 404 for a product that actually exists.
    throw err;
  }
}

/**
 * Same as directFetchProductById, but retries once on transient connection errors
 * (pool saturation / cold start) before giving up.
 */
export async function directFetchProductByIdWithRetry(id) {
  try {
    return await directFetchProductById(id);
  } catch {
    await new Promise((r) => setTimeout(r, 400));
    return await directFetchProductById(id);
  }
}

/**
 * Direct MongoDB fallback for fetching a deal by ID
 */
export async function directFetchDealById(id) {
  if (!id) return null;
  try {
    const db = await getDb();
    const dealsColl = db.collection('deals');
    let deal = null;

    if (typeof id === 'string' && ObjectId.isValid(id) && id.length === 24) {
      deal = await dealsColl.findOne({ _id: new ObjectId(id) });
    }
    if (!deal) {
      deal = await dealsColl.findOne({ productId: id });
    }

    // Fallback: If ID belongs to a Product, synthesize deal object
    if (!deal) {
      const product = await directFetchProductById(id);
      if (product) {
        const discountPct =
          product.originalPrice && product.price && product.originalPrice > product.price
            ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
            : 0;
        return {
          _id: product._id,
          productId: product.productId,
          title: product.title,
          dealUrl: product.cleanUrl,
          imageUrl: product.imageUrl || (product.images && product.images[0]),
          dealPrice: product.price,
          originalPrice: product.originalPrice,
          previousPrice: product.previousPrice,
          discountPercentage: discountPct,
          merchant: product.merchant,
          category: product.category,
          subcategory: product.subcategory,
          country: product.country || 'IN',
          isExpired: false,
          resolvedToProduct: true,
          matchedProductId: product._id,
          priceStats: computePriceStats(product),
        };
      }
      return null;
    }

    const data = serializeDoc(deal);
    data.priceStats = computePriceStats(data);
    return data;
  } catch (err) {
    console.error(`[dbFallback] directFetchDealById failed for ${id}:`, err.message);
    throw err;
  }
}

/**
 * Direct MongoDB fallback to resolve matching Product _id from a deal's productId + merchant
 */
export async function directFindMatchingProductId(productId, merchant) {
  if (!productId) return null;
  try {
    const db = await getDb();
    const query = { productId };
    if (merchant) {
      query.merchant = { $regex: new RegExp(`^${merchant}$`, 'i') };
    }
    const coll = db.collection('products');
    let match = await coll.findOne(query, { projection: { _id: 1 } });
    // Sister stores (a Flipkart deal tracked as a Shopsy product) share the same PID.
    if (!match && merchant) {
      match = await coll.findOne({ productId }, { projection: { _id: 1 } });
    }
    return match ? match._id.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Direct MongoDB fallback to find the latest deal for a product
 */
export async function directFindLatestDealForProduct(productId, merchant, country = 'in') {
  if (!productId) return null;
  try {
    const db = await getDb();
    const query = { productId };
    if (country) {
      query.country = { $regex: new RegExp(`^${country}$`, 'i') };
    }
    const deal = await db.collection('deals').find(query).sort({ createdAt: -1 }).limit(1).toArray();
    return deal.length > 0 ? serializeDoc(deal[0]) : null;
  } catch {
    return null;
  }
}

/**
 * Direct MongoDB fallback for fetching top products in a subcategory
 */
export async function directFetchTopProductsForSubcategory({ subcategory, category, limit = 12 }) {
  try {
    const db = await getDb();
    const query = { isActive: { $ne: false } };
    if (subcategory && subcategory !== 'all') query.subcategory = subcategory;
    if (category && category !== 'all') query.category = category;

    const docs = await db
      .collection('products')
      .find(query)
      .sort({ rating: -1, priceUpdatedAt: -1 })
      .limit(limit)
      .toArray();

    return docs.map(serializeDoc);
  } catch (err) {
    console.error('[dbFallback] directFetchTopProductsForSubcategory failed:', err.message);
    return [];
  }
}

/**
 * Direct MongoDB fallback for fetching product variants (siblings)
 */
export async function directFetchProductVariants(id) {
  if (!id) return null;
  try {
    const db = await getDb();
    const currentProduct = await directFetchProductById(id);
    if (!currentProduct) return null;

    const query = {
      _id: { $ne: new ObjectId(currentProduct._id) },
      country: currentProduct.country || 'IN',
      isActive: { $ne: false },
    };

    if (currentProduct.brand) {
      query.brand = currentProduct.brand;
    }
    if (currentProduct.subcategory) {
      query.subcategory = currentProduct.subcategory;
    }

    const siblings = await db
      .collection('products')
      .find(query)
      .limit(8)
      .toArray();

    return {
      success: true,
      currentProductId: currentProduct._id,
      variants: [currentProduct, ...siblings.map(serializeDoc)],
    };
  } catch {
    return null;
  }
}

/**
 * Direct MongoDB fallback for sitemaps deals
 */
export async function directFetchSitemapDeals() {
  try {
    const db = await getDb();
    const deals = await db
      .collection('deals')
      .find(
        {
          isExpired: { $ne: true },
          $or: [{ imageUrl: { $exists: true, $ne: '' } }, { 'images.0': { $exists: true, $ne: '' } }],
        },
        { projection: { _id: 1, updatedAt: 1, createdAt: 1 } }
      )
      .sort({ createdAt: -1 })
      .limit(10000)
      .toArray();

    return deals.map((d) => ({
      id: d._id.toString(),
      lastmod: d.updatedAt || d.createdAt || new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

/**
 * Direct MongoDB fallback for sitemaps products
 */
export async function directFetchSitemapProducts({ country = 'IN', page = 1, limit = 5000 }) {
  try {
    const db = await getDb();
    const skip = (page - 1) * limit;
    const countryRegex = new RegExp(`^${country}$`, 'i');

    const products = await db
      .collection('products')
      .find(
        {
          country: countryRegex,
          imageUrl: {
            $exists: true,
            $nin: ['', null],
            $not: /placeholder\.png|localhost|images-na\.ssl-images-amazon\.com\/images\/P\//i,
          },
        },
        { projection: { _id: 1, updatedAt: 1, lastChecked: 1 } }
      )
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return products.map((p) => ({
      id: p._id.toString(),
      lastmod: p.updatedAt || p.lastChecked || new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

/**
 * Direct MongoDB fallback for fetching verified deals feed
 */
export async function directFetchDeals({
  page = 1,
  limit = 40,
  category = 'all',
  merchant = 'all',
  country = 'in',
  minDiscount = 0,
  sort = 'newest',
} = {}) {
  try {
    const db = await getDb();
    const skip = (page - 1) * limit;

    const andConditions = [
      { isExpired: { $ne: true } },
      { isVerified: true },
      { previousPrice: { $exists: true, $gt: 0 } },
      { $expr: { $gt: ['$previousPrice', '$dealPrice'] } },
    ];

    const cCode = (country || 'in').toUpperCase();
    if (cCode === 'IN') {
      andConditions.push({ $or: [{ country: 'IN' }, { country: { $exists: false } }, { country: null }] });
    } else if (cCode !== 'ALL') {
      andConditions.push({ country: cCode });
    }

    const discountCond = { $lte: 90, $gt: 0 };
    if (minDiscount > 0) {
      discountCond.$gte = minDiscount;
    }
    andConditions.push({ discountPercentage: discountCond });

    if (category && category !== 'all') {
      const cat = category.toLowerCase().trim();
      if (cat === 'mobiles') {
        andConditions.push({
          $or: [
            { category: 'mobiles' },
            { subcategory: { $in: ['mobiles', 'Smartphones'] } },
          ],
          subcategory: { $nin: ['wearables', 'accessories', 'audio', 'gaming', 'cameras', 'laptops', 'tv', 'decor', 'bags', 'men-topwear'] },
          title: { $not: /\b(watch|smartwatch|fitness\s*band|smart\s*band|buds|earbuds|neckband|headphones|earphones|power\s*bank|tempered\s*glass|phone\s*case|back\s*cover|charging\s*cable|type-c\s*cable|usb\s*cable|wall\s*charger|mobile\s*stand|tripod|selfie\s*stick|phone\s*holder|car\s*mount)\b/i },
        });
      } else if (cat === 'laptops') {
        andConditions.push({
          $or: [
            { category: 'laptops' },
            { subcategory: { $in: ['laptops', 'computers'] } },
          ],
          subcategory: { $nin: ['wearables', 'accessories', 'audio', 'gaming', 'cameras', 'mobiles', 'tv', 'decor', 'bags', 'furniture'] },
          title: { $not: /\b(bag|sleeve|case|cover|stand|riser|adapter|charger|cable|cord|mouse|keyboard|mousepad|mouse\s*mat|docking\s*station|hub|cleaner|cleaning|skin|cooling\s*pad|desk)\b/i },
        });
      } else if (cat === 'electronics') {
        andConditions.push({
          $or: [
            { category: 'electronics' },
            { category: { $in: ['mobiles', 'laptops'] } },
            { subcategory: { $in: ['audio', 'cameras', 'tv', 'wearables', 'gaming', 'accessories', 'mobiles', 'laptops'] } },
          ],
          category: { $nin: ['appliances', 'home', 'men-fashion', 'women-fashion', 'beauty', 'auto'] },
          title: { $not: /\b(washing\s*machine|refrigerator|air\s*conditioner|water\s*purifier|chimney|geyser|air\s*fryer|microwave|dress|shirt|kurti|saree)\b/i },
        });
      } else if (cat === 'appliances') {
        andConditions.push({
          $or: [
            { category: 'appliances' },
            { subcategory: { $in: ['refrigerators', 'washing-machines', 'air-conditioners', 'water-purifiers', 'geysers', 'air-fryers', 'microwaves', 'chimneys', 'fans-coolers', 'kitchen-appliances'] } },
          ],
          title: { $not: /\b(pendrive|flash\s*drive|type-c\s*usb|laundry\s*bag|liquid\s*detergent|washing\s*powder|stain\s*remover|heating\s*pad)\b/i },
        });
      } else if (cat === 'fashion') {
        andConditions.push({
          $or: [
            { category: { $in: ['fashion', 'men-fashion', 'women-fashion', 'clothing', 'footwear'] } },
            { subcategory: { $in: ['clothing', 'footwear', 'apparel', 'jewellery', 'watches', 'kids', 'men-topwear', 'men-bottomwear', 'women-western', 'women-ethnic', 'women-footwear', 'women-watches', 'innerwear', 'women-innerwear'] } },
          ],
          subcategory: { $nin: ['bags', 'women-bags', 'luggage', 'diapers-wipes', 'accessories', 'storage', 'decor'] },
          title: {
            $not: /\b(pad|pads|whisper|stayfree|sofy|kotex|sanitary|napkin|napkins|tampon|tampons|period\s*panty|panty\s*liner|diaper|diapers|nappy|nappies|wipes|luggage|trolley|suitcase|duffle|duffel|backpack|daypack|rucksack|travel\s*bag|school\s*bag|laptop\s*bag|cabin\s*bag|cabin\s*luggage|hard\s*case|tote\s*bag|handbag|sling\s*bag|crossbody\s*bag|wallet|clutch|pouch|packing\s*cubes?|weighing\s*scale|weight\s*machine|cart|hanger|organizer)\b/i
          },
        });
      } else if (cat === 'beauty') {
        andConditions.push({
          $or: [
            { category: { $in: ['beauty', 'personal-care'] } },
            { subcategory: { $in: ['makeup', 'skincare', 'haircare', 'bath-body', 'fragrance', 'appliances', 'mens-grooming', 'nailcare'] } },
          ],
          subcategory: { $nin: ['feminine-hygiene'] },
          title: { $not: /\b(school\s*bag|backpack|daypack|luggage|shoes?|t-?shirt|dress|jeans)\b/i },
        });
      } else if (cat === 'home') {
        andConditions.push({
          $or: [
            { category: { $in: ['home', 'kitchen', 'home-kitchen'] } },
            { subcategory: { $in: ['decor', 'bedding', 'cleaning', 'furniture', 'storage', 'kitchen-dining', 'kitchen', 'tools', 'garden'] } },
          ],
          category: { $nin: ['men-fashion', 'women-fashion', 'fashion', 'beauty', 'auto', 'pets', 'books-stationery', 'travel', 'electronics'] },
          title: { $not: /\b(t-?shirt|shirt|polo|kurta|kurti|saree|sari|lehenga|dress|jeans|trouser|sneaker|shoes|heels|sandals|lipstick|perfume|deodorant|dog\s*food|cat\s*treat|chew\s*toy|trolley|suitcase|backpack|dash\s*cam)\b/i },
        });
      } else if (cat === 'fitness') {
        andConditions.push({
          $or: [
            { category: 'fitness' },
            { subcategory: { $in: ['fitness-apparel', 'trackers', 'gym-equipment', 'nutrition', 'sports-gear', 'yoga'] } },
          ],
          title: { $not: /\b(chocolate|cookie|biscuit|namkeen|chips|dress|kurti|saree)\b/i },
        });
      } else if (cat === 'grocery') {
        andConditions.push({
          $or: [
            { category: { $in: ['grocery', 'gourmet', 'food'] } },
            { subcategory: { $in: ['breakfast-dairy', 'coffee-tea', 'cooking-staples', 'dry-fruits', 'snacks-beverages'] } },
          ],
          title: { $not: /\b(coffee\s*table|centre\s*table|dining\s*table|sofa|chair|cat\s*treat|dog\s*food|chew|diya\s*batti|pooja|whey\s*protein|multivitamin)\b/i },
        });
      } else if (cat === 'travel' || cat === 'luggage' || cat === 'bags') {
        andConditions.push({
          $or: [
            { category: 'travel' },
            { subcategory: { $in: ['luggage', 'bags'] } },
          ],
        });
      } else if (cat === 'baby-kids') {
        andConditions.push({
          $or: [
            { category: 'baby-kids' },
            { subcategory: { $in: ['toys-games', 'diapers-wipes', 'baby-gear', 'feeding-nursing'] } },
          ],
        });
      } else if (cat === 'auto') {
        andConditions.push({
          $or: [
            { category: 'auto' },
            { subcategory: { $in: ['helmets-riding', 'car-accessories', 'bike-accessories', 'car-care'] } },
          ],
        });
      } else if (cat === 'books' || cat === 'books-stationery') {
        andConditions.push({
          $or: [
            { category: 'books-stationery' },
            { subcategory: { $in: ['books', 'stationery', 'craft-supplies', 'office-supplies'] } },
          ],
        });
      } else {
        andConditions.push({ category: cat });
      }
    }

    if (merchant && merchant !== 'all') {
      const mStr = merchant.toLowerCase().trim();
      andConditions.push({
        $or: [
          { merchant: new RegExp(mStr, 'i') },
          { dealUrl: new RegExp(mStr, 'i') },
        ],
      });
    }

    let sortObj = { createdAt: -1 };
    if (sort === 'discount') {
      sortObj = { discountPercentage: -1 };
    } else if (sort === 'price_asc') {
      sortObj = { dealPrice: 1 };
    } else if (sort === 'price_desc') {
      sortObj = { dealPrice: -1 };
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};

    const docs = await db
      .collection('deals')
      .find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .toArray();

    let deals = docs.map((d) => {
      const deal = serializeDoc(d);
      if (!deal.imageUrl || deal.imageUrl.includes('placeholder.png') || deal.imageUrl.includes('localhost')) {
        const alt = (deal.images || []).find((img) => img && !img.includes('placeholder.png') && !img.includes('localhost'));
        if (alt) deal.imageUrl = alt;
      }
      deal.priceStats = computePriceStats(deal);
      return deal;
    });

    if (category && category !== 'all' && deals.length < limit && page === 1) {
      try {
        const cat = category.toLowerCase().trim();
        const needed = limit - deals.length;
        const existingTitles = new Set(deals.map((d) => (d.title || '').toLowerCase().trim()));
        let prodFilter = {
          isActive: true,
          previousPrice: { $exists: true, $gt: 0 },
          $expr: { $gt: ['$previousPrice', '$price'] },
          $or: [{ country: 'IN' }, { country: { $exists: false } }, { country: null }],
        };

        if (cat === 'mobiles') {
          prodFilter.subcategory = 'mobiles';
          prodFilter.title = { $not: /\b(watch|smartwatch|fitness\s*band|smart\s*band|buds|earbuds|neckband|headphones|earphones|power\s*bank|tempered\s*glass|phone\s*case|back\s*cover|charging\s*cable|type-c\s*cable|usb\s*cable|wall\s*charger|mobile\s*stand|tripod|selfie\s*stick|phone\s*holder|car\s*mount)\b/i };
        } else if (cat === 'laptops') {
          prodFilter.subcategory = 'laptops';
          prodFilter.title = { $not: /\b(bag|sleeve|case|cover|stand|riser|adapter|charger|cable|cord|mouse|keyboard|mousepad|mouse\s*mat|docking\s*station|hub|cleaner|cleaning|skin|cooling\s*pad|desk)\b/i };
        } else if (cat === 'electronics') {
          prodFilter.$or = [
            { category: 'electronics' },
            { category: { $in: ['mobiles', 'laptops'] } },
            { subcategory: { $in: ['audio', 'cameras', 'tv', 'wearables', 'gaming', 'accessories', 'mobiles', 'laptops'] } }
          ];
          prodFilter.category = { $nin: ['appliances', 'home', 'men-fashion', 'women-fashion', 'beauty', 'auto'] };
          prodFilter.title = { $not: /\b(washing\s*machine|refrigerator|air\s*conditioner|water\s*purifier|chimney|geyser|air\s*fryer|microwave|dress|shirt|kurti|saree)\b/i };
        } else if (cat === 'appliances') {
          prodFilter.$or = [
            { category: 'appliances' },
            { subcategory: { $in: ['refrigerators', 'washing-machines', 'air-conditioners', 'water-purifiers', 'geysers', 'air-fryers', 'microwaves', 'chimneys', 'fans-coolers', 'kitchen-appliances'] } }
          ];
          prodFilter.title = { $not: /\b(pendrive|flash\s*drive|type-c\s*usb|laundry\s*bag|liquid\s*detergent|washing\s*powder|stain\s*remover|heating\s*pad)\b/i };
        } else if (cat === 'fashion') {
          prodFilter.$and = [
            {
              $or: [
                { category: { $in: ['fashion', 'men-fashion', 'women-fashion', 'clothing', 'footwear'] } },
                { subcategory: { $in: ['clothing', 'footwear', 'apparel', 'jewellery', 'watches', 'kids', 'men-topwear', 'men-bottomwear', 'women-western', 'women-ethnic', 'women-footwear', 'women-watches', 'innerwear', 'women-innerwear'] } }
              ]
            },
            { subcategory: { $nin: ['bags', 'women-bags', 'luggage', 'diapers-wipes', 'accessories', 'storage', 'decor'] } },
            {
              title: {
                $not: /\b(pad|pads|whisper|stayfree|sofy|kotex|sanitary|napkin|napkins|tampon|tampons|period\s*panty|panty\s*liner|diaper|diapers|nappy|nappies|wipes|luggage|trolley|suitcase|duffle|duffel|backpack|daypack|rucksack|travel\s*bag|school\s*bag|laptop\s*bag|cabin\s*bag|cabin\s*luggage|hard\s*case|tote\s*bag|handbag|sling\s*bag|crossbody\s*bag|wallet|clutch|pouch|packing\s*cubes?|weighing\s*scale|weight\s*machine|cart|hanger|organizer)\b/i
              }
            }
          ];
        } else if (cat === 'beauty') {
          prodFilter.$or = [
            { category: { $in: ['beauty', 'personal-care'] } },
            { subcategory: { $in: ['makeup', 'skincare', 'haircare', 'bath-body', 'fragrance', 'appliances', 'mens-grooming', 'nailcare'] } }
          ];
          prodFilter.subcategory = { $nin: ['feminine-hygiene'] };
          prodFilter.title = { $not: /\b(school\s*bag|backpack|daypack|luggage|shoes?|t-?shirt|dress|jeans)\b/i };
        } else if (cat === 'home') {
          prodFilter.$or = [
            { category: { $in: ['home', 'kitchen', 'home-kitchen'] } },
            { subcategory: { $in: ['decor', 'bedding', 'cleaning', 'furniture', 'storage', 'kitchen-dining', 'kitchen', 'tools', 'garden'] } }
          ];
          prodFilter.category = { $nin: ['men-fashion', 'women-fashion', 'fashion', 'beauty', 'auto', 'pets', 'books-stationery', 'travel', 'electronics'] };
          prodFilter.title = { $not: /\b(t-?shirt|shirt|polo|kurta|kurti|saree|sari|lehenga|dress|jeans|trouser|sneaker|shoes|heels|sandals|lipstick|perfume|deodorant|dog\s*food|cat\s*treat|chew\s*toy|trolley|suitcase|backpack|dash\s*cam)\b/i };
        } else if (cat === 'fitness') {
          prodFilter.$or = [
            { category: 'fitness' },
            { subcategory: { $in: ['fitness-apparel', 'trackers', 'gym-equipment', 'nutrition', 'sports-gear', 'yoga'] } }
          ];
          prodFilter.title = { $not: /\b(chocolate|cookie|biscuit|namkeen|chips|dress|kurti|saree)\b/i };
        } else if (cat === 'grocery') {
          prodFilter.$or = [
            { category: { $in: ['grocery', 'gourmet', 'food'] } },
            { subcategory: { $in: ['breakfast-dairy', 'coffee-tea', 'cooking-staples', 'dry-fruits', 'snacks-beverages'] } }
          ];
          prodFilter.title = { $not: /\b(coffee\s*table|centre\s*table|dining\s*table|sofa|chair|cat\s*treat|dog\s*food|chew|diya\s*batti|pooja|whey\s*protein|multivitamin)\b/i };
        } else if (cat === 'travel' || cat === 'luggage' || cat === 'bags') {
          prodFilter.$or = [
            { category: 'travel' },
            { subcategory: { $in: ['luggage', 'bags'] } }
          ];
        } else if (cat === 'baby-kids') {
          prodFilter.$or = [
            { category: 'baby-kids' },
            { subcategory: { $in: ['toys-games', 'diapers-wipes', 'baby-gear', 'feeding-nursing'] } }
          ];
        } else if (cat === 'auto') {
          prodFilter.$or = [
            { category: 'auto' },
            { subcategory: { $in: ['helmets-riding', 'car-accessories', 'bike-accessories', 'car-care'] } }
          ];
        } else if (cat === 'books' || cat === 'books-stationery') {
          prodFilter.$or = [
            { category: 'books-stationery' },
            { subcategory: { $in: ['books', 'stationery', 'craft-supplies', 'office-supplies'] } }
          ];
        } else {
          prodFilter.$or = [{ category: cat }, { subcategory: cat }];
        }

        const prodDocs = await db.collection('products').find(prodFilter).limit(needed * 2).toArray();

        for (const p of prodDocs) {
          if (deals.length >= limit) break;
          const cleanT = (p.title || '').toLowerCase().trim();
          if (existingTitles.has(cleanT)) continue;
          const discountPct = (p.previousPrice && p.price && p.previousPrice > p.price)
            ? Math.round(((p.previousPrice - p.price) / p.previousPrice) * 100)
            : 0;
          if (discountPct <= 0) continue;
          deals.push({
            _id: p._id.toString(),
            productId: p.productId,
            title: p.title,
            dealUrl: p.cleanUrl,
            imageUrl: p.imageUrl || (p.images && p.images[0]),
            dealPrice: p.price,
            originalPrice: p.originalPrice,
            previousPrice: p.previousPrice,
            discountPercentage: discountPct,
            merchant: p.merchant,
            category: p.category,
            subcategory: p.subcategory,
            country: p.country || 'IN',
            isExpired: false,
            resolvedToProduct: true,
          });
          existingTitles.add(cleanT);
        }
      } catch (e) {
        console.error('[dbFallback] catalog augmentation error:', e.message);
      }
    }

    return deals;
  } catch (err) {
    console.error('[dbFallback] directFetchDeals failed:', err.message);
    return [];
  }
}

/**
 * Direct MongoDB fallback for fetching products catalog
 */
export async function directFetchProducts({
  page = 1,
  limit = 40,
  category = 'all',
  subcategory = 'all',
  merchant = 'all',
  country = 'in',
  sort = 'recently_checked',
} = {}) {
  try {
    const db = await getDb();
    const skip = (page - 1) * limit;

    const andConditions = [
      { isActive: { $ne: false } },
      {
        imageUrl: {
          $exists: true,
          $nin: ['', null],
          $not: /placeholder\.png|localhost|images-na\.ssl-images-amazon\.com\/images\/P\//i,
        },
      },
    ];

    const cCode = (country || 'in').toUpperCase();
    if (cCode === 'IN') {
      andConditions.push({ $or: [{ country: 'IN' }, { country: { $exists: false } }, { country: null }] });
    } else if (cCode !== 'ALL') {
      andConditions.push({ country: cCode });
    }

    if (merchant && merchant !== 'all') {
      andConditions.push({ merchant: { $regex: new RegExp(`^${merchant}$`, 'i') } });
    }

    if (category && category !== 'all') {
      andConditions.push({ category: category.toLowerCase().trim() });
    }

    if (subcategory && subcategory !== 'all') {
      andConditions.push({ subcategory: subcategory.trim() });
    }

    let sortObj = { lastChecked: -1, updatedAt: -1, _id: -1 };
    if (sort === 'price_asc') sortObj = { price: 1, _id: -1 };
    else if (sort === 'price_desc') sortObj = { price: -1, _id: -1 };
    else if (sort === 'rating') sortObj = { rating: -1, _id: -1 };

    const docs = await db
      .collection('products')
      .find({ $and: andConditions })
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .toArray();

    return docs.map((d) => {
      const prod = serializeDoc(d);
      prod.priceStats = computePriceStats(prod);
      return prod;
    });
  } catch (err) {
    console.error('[dbFallback] directFetchProducts failed:', err.message);
    return [];
  }
}
