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
          $or: [{ imageUrl: { $exists: true, $ne: '' } }, { 'images.0': { $exists: true, $ne: '' } }],
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
