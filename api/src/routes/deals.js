import express from 'express';
import mongoose from 'mongoose';
import Deal from '../db/models/deal.js';
import Product from '../db/models/product.js';
import { cacheMiddleware } from '../utils/cache.js';

const router = express.Router();

/**
 * GET /api/deals
 * Paginated, tokenized multi-field filtered deals from MongoDB deals collection.
 */
router.get('/', cacheMiddleware(15), async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const andConditions = [];

    // Exclude expired deals and require authentic verified price drop against history
    if (req.query.includeExpired !== 'true') {
      andConditions.push({ isExpired: { $ne: true } });
      andConditions.push({ isVerified: true });
      andConditions.push({ previousPrice: { $exists: true, $gt: 0 } });
      andConditions.push({ $expr: { $gt: ['$previousPrice', '$dealPrice'] } });
    }

    if (req.query.category && req.query.category !== 'all') {
      const cat = req.query.category.toLowerCase().trim();
      if (cat === 'mobiles') {
        andConditions.push({
          $or: [
            { category: 'mobiles' },
            { subcategory: { $in: ['mobiles', 'Smartphones'] } }
          ],
          subcategory: { $nin: ['wearables', 'accessories', 'audio', 'gaming', 'cameras', 'laptops', 'tv', 'decor', 'bags', 'men-topwear'] },
          title: { $not: /\b(watch|smartwatch|fitness\s*band|smart\s*band|buds|earbuds|neckband|headphones|earphones|power\s*bank|tempered\s*glass|phone\s*case|back\s*cover|charging\s*cable|type-c\s*cable|usb\s*cable|wall\s*charger|mobile\s*stand|tripod|selfie\s*stick|phone\s*holder|car\s*mount)\b/i }
        });
      } else if (cat === 'laptops') {
        andConditions.push({
          $or: [
            { category: 'laptops' },
            { subcategory: { $in: ['laptops', 'computers'] } }
          ],
          subcategory: { $nin: ['wearables', 'accessories', 'audio', 'gaming', 'cameras', 'mobiles', 'tv', 'decor', 'bags', 'furniture'] },
          title: { $not: /\b(bag|sleeve|case|cover|stand|riser|adapter|charger|cable|cord|mouse|keyboard|mousepad|mouse\s*mat|docking\s*station|hub|cleaner|cleaning|skin|cooling\s*pad|desk)\b/i }
        });
      } else if (cat === 'electronics') {
        andConditions.push({
          $or: [
            { category: 'electronics' },
            { category: { $in: ['mobiles', 'laptops'] } },
            { subcategory: { $in: ['audio', 'cameras', 'tv', 'wearables', 'gaming', 'accessories', 'mobiles', 'laptops'] } }
          ],
          category: { $nin: ['appliances', 'home', 'men-fashion', 'women-fashion', 'beauty', 'auto'] },
          title: { $not: /\b(washing\s*machine|refrigerator|air\s*conditioner|water\s*purifier|chimney|geyser|air\s*fryer|microwave|dress|shirt|kurti|saree)\b/i }
        });
      } else if (cat === 'appliances') {
        andConditions.push({
          $or: [
            { category: 'appliances' },
            { subcategory: { $in: ['refrigerators', 'washing-machines', 'air-conditioners', 'water-purifiers', 'geysers', 'air-fryers', 'microwaves', 'chimneys', 'fans-coolers', 'kitchen-appliances'] } }
          ],
          title: { $not: /\b(pendrive|flash\s*drive|type-c\s*usb|laundry\s*bag|liquid\s*detergent|washing\s*powder|stain\s*remover|heating\s*pad)\b/i }
        });
      } else if (cat === 'fashion') {
        andConditions.push({
          $or: [
            { category: { $in: ['fashion', 'men-fashion', 'women-fashion', 'clothing', 'footwear'] } },
            { subcategory: { $in: ['clothing', 'footwear', 'apparel', 'jewellery', 'watches', 'kids', 'men-topwear', 'men-bottomwear', 'women-western', 'women-ethnic', 'women-footwear', 'women-watches', 'innerwear', 'women-innerwear'] } }
          ],
          subcategory: { $nin: ['bags', 'women-bags', 'luggage', 'diapers-wipes', 'accessories', 'storage', 'decor'] },
          title: {
            $not: /\b(pad|pads|whisper|stayfree|sofy|kotex|sanitary|napkin|napkins|tampon|tampons|period\s*panty|panty\s*liner|diaper|diapers|nappy|nappies|wipes|luggage|trolley|suitcase|duffle|duffel|backpack|daypack|rucksack|travel\s*bag|school\s*bag|laptop\s*bag|cabin\s*bag|cabin\s*luggage|hard\s*case|tote\s*bag|handbag|sling\s*bag|crossbody\s*bag|wallet|clutch|pouch|packing\s*cubes?|weighing\s*scale|weight\s*machine|cart|hanger|organizer)\b/i
          }
        });
      } else if (cat === 'beauty') {
        andConditions.push({
          $or: [
            { category: { $in: ['beauty', 'personal-care'] } },
            { subcategory: { $in: ['makeup', 'skincare', 'haircare', 'bath-body', 'fragrance', 'appliances', 'mens-grooming', 'nailcare'] } }
          ],
          subcategory: { $nin: ['feminine-hygiene'] },
          title: { $not: /\b(school\s*bag|backpack|daypack|luggage|shoes?|t-?shirt|dress|jeans)\b/i }
        });
      } else if (cat === 'home') {
        andConditions.push({
          $or: [
            { category: { $in: ['home', 'kitchen', 'home-kitchen'] } },
            { subcategory: { $in: ['decor', 'bedding', 'cleaning', 'furniture', 'storage', 'kitchen-dining', 'kitchen', 'tools', 'garden'] } }
          ],
          category: { $nin: ['men-fashion', 'women-fashion', 'fashion', 'beauty', 'auto', 'pets', 'books-stationery', 'travel', 'electronics'] },
          title: { $not: /\b(t-?shirt|shirt|polo|kurta|kurti|saree|sari|lehenga|dress|jeans|trouser|sneaker|shoes|heels|sandals|lipstick|perfume|deodorant|dog\s*food|cat\s*treat|chew\s*toy|trolley|suitcase|backpack|dash\s*cam)\b/i }
        });
      } else if (cat === 'fitness') {
        andConditions.push({
          $or: [
            { category: 'fitness' },
            { subcategory: { $in: ['fitness-apparel', 'trackers', 'gym-equipment', 'nutrition', 'sports-gear', 'yoga'] } }
          ],
          title: { $not: /\b(chocolate|cookie|biscuit|namkeen|chips|dress|kurti|saree)\b/i }
        });
      } else if (cat === 'grocery') {
        andConditions.push({
          $or: [
            { category: { $in: ['grocery', 'gourmet', 'food'] } },
            { subcategory: { $in: ['breakfast-dairy', 'coffee-tea', 'cooking-staples', 'dry-fruits', 'snacks-beverages'] } }
          ],
          title: { $not: /\b(coffee\s*table|centre\s*table|dining\s*table|sofa|chair|cat\s*treat|dog\s*food|chew|diya\s*batti|pooja|whey\s*protein|multivitamin)\b/i }
        });
      } else if (cat === 'travel' || cat === 'luggage' || cat === 'bags') {
        andConditions.push({
          $or: [
            { category: 'travel' },
            { subcategory: { $in: ['luggage', 'bags'] } }
          ]
        });
      } else if (cat === 'baby-kids') {
        andConditions.push({
          $or: [
            { category: 'baby-kids' },
            { subcategory: { $in: ['toys-games', 'diapers-wipes', 'baby-gear', 'feeding-nursing'] } }
          ]
        });
      } else if (cat === 'auto') {
        andConditions.push({
          $or: [
            { category: 'auto' },
            { subcategory: { $in: ['helmets-riding', 'car-accessories', 'bike-accessories', 'car-care'] } }
          ]
        });
      } else if (cat === 'books' || cat === 'books-stationery') {
        andConditions.push({
          $or: [
            { category: 'books-stationery' },
            { subcategory: { $in: ['books', 'stationery', 'craft-supplies', 'office-supplies'] } }
          ]
        });
      } else {
        andConditions.push({ category: cat });
      }
    }

    if (req.query.subcategory && req.query.subcategory !== 'all') {
      andConditions.push({ subcategory: req.query.subcategory.toLowerCase() });
    }

    if (req.query.merchant && req.query.merchant !== 'all') {
      const mStr = req.query.merchant.toLowerCase();
      andConditions.push({
        $or: [
          { merchant: new RegExp(mStr, 'i') },
          { dealUrl: new RegExp(mStr, 'i') }
        ]
      });
    }

    if (req.query.country && req.query.country !== 'all') {
      const cCode = req.query.country.toUpperCase();
      if (cCode === 'IN') {
        andConditions.push({ $or: [{ country: 'IN' }, { country: { $exists: false } }, { country: null }] });
      } else {
        andConditions.push({ country: cCode });
      }
    }

    if (req.query.hasCoupon === 'true') {
      andConditions.push({ 'coupon.label': { $exists: true, $ne: '' } });
    } else if (req.query.hasCoupon === 'false') {
      andConditions.push({
        $or: [{ coupon: null }, { 'coupon.label': { $in: ['', null] } }, { coupon: { $exists: false } }]
      });
    }

    if (req.query.q) {
      const qStr = req.query.q.trim();
      if (qStr.length > 0) {
        const searchTokens = qStr.split(/\s+/).filter(Boolean);
        searchTokens.forEach(token => {
          const regex = new RegExp(token, 'i');
          andConditions.push({
            $or: [
              { title: regex },
              { dealTitle: regex },
              { description: regex },
              { dealUrl: regex },
              { productId: regex },
              { sourceChannelName: regex },
              { merchant: regex }
            ]
          });
        });
      }
    }

    if (req.query.minPrice || req.query.maxPrice) {
      const priceCond = {};
      if (req.query.minPrice) priceCond.$gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice) priceCond.$lte = parseFloat(req.query.maxPrice);
      andConditions.push({ dealPrice: priceCond });
    }

    // Deals above 90% off are overwhelmingly bad scrapes rather than genuine steals.
    // Zero-discount items must also be excluded so non-deals never reach the user feed.
    const discountCond = { $lte: 90, $gt: 0 };
    if (req.query.minDiscount) {
      discountCond.$gte = Math.max(parseFloat(req.query.minDiscount) || 0, 1);
    }
    andConditions.push({ discountPercentage: discountCond });

    let sort = { createdAt: -1 };
    if (req.query.sort) {
      if (req.query.sort === 'discount') {
        sort = { discountPercentage: -1 };
      } else if (req.query.sort === 'price_asc') {
        sort = { dealPrice: 1 };
      } else if (req.query.sort === 'price_desc') {
        sort = { dealPrice: -1 };
      } else if (req.query.sort === 'rating') {
        sort = { rating: -1 };
      } else if (req.query.sort === 'latest' || req.query.sort === 'newest') {
        sort = { createdAt: -1 };
      }
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};

    let [total, dealsRaw] = await Promise.all([
      Deal.countDocuments(query),
      Deal.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean()
    ]);
    let deals = dealsRaw;

    // Auto-heal broken/placeholder images on the fly if an alternative image is present
    deals = deals.map(d => {
      if (!d.imageUrl || d.imageUrl.includes('shoppersdeals-backend') || d.imageUrl.includes('placeholder.png') || d.imageUrl.includes('localhost')) {
        const alt = (d.images || []).find(img => img && !img.includes('shoppersdeals-backend') && !img.includes('placeholder.png') && !img.includes('localhost'));
        if (alt) d.imageUrl = alt;
      }
      return d;
    });

    // Catalog Augmentation / Fallback: If searching by keyword or filtering by category (e.g. mobiles)
    // and fewer deals than requested limit exist, enrich the feed with active authentic products from the catalog
    // so shoppers always see full, high-value deals with 0 smartwatches or accessories in mobiles.
    if ((deals.length < limit || deals.length === 0) && (req.query.q || req.query.category) && page === 1) {
      const needed = limit - deals.length;
      if (needed > 0) {
        const existingTitles = new Set(deals.map(d => (d.title || '').toLowerCase().trim()));
        const existingIds = new Set(deals.map(d => (d.productId || d.matchedProductId || d._id?.toString())));

        let prodQuery = {
          isActive: true,
          previousPrice: { $exists: true, $gt: 0 },
          $expr: { $gt: ['$previousPrice', '$price'] },
          $or: [{ country: 'IN' }, { country: { $exists: false } }, { country: null }]
        };

        if (req.query.category && req.query.category !== 'all') {
          const cat = req.query.category.toLowerCase().trim();
          if (cat === 'mobiles') {
            prodQuery.subcategory = 'mobiles';
            prodQuery.title = { $not: /\b(watch|smartwatch|fitness\s*band|smart\s*band|buds|earbuds|neckband|headphones|earphones|power\s*bank|tempered\s*glass|phone\s*case|back\s*cover|charging\s*cable|type-c\s*cable|usb\s*cable|wall\s*charger|mobile\s*stand|tripod|selfie\s*stick|phone\s*holder|car\s*mount)\b/i };
          } else if (cat === 'laptops') {
            prodQuery.subcategory = 'laptops';
            prodQuery.title = { $not: /\b(bag|sleeve|case|cover|stand|riser|adapter|charger|cable|cord|mouse|keyboard|mousepad|mouse\s*mat|docking\s*station|hub|cleaner|cleaning|skin|cooling\s*pad|desk)\b/i };
          } else if (cat === 'electronics') {
            prodQuery.$or = [
              { category: 'electronics' },
              { category: { $in: ['mobiles', 'laptops'] } },
              { subcategory: { $in: ['audio', 'cameras', 'tv', 'wearables', 'gaming', 'accessories', 'mobiles', 'laptops'] } }
            ];
            prodQuery.category = { $nin: ['appliances', 'home', 'men-fashion', 'women-fashion', 'beauty', 'auto'] };
            prodQuery.title = { $not: /\b(washing\s*machine|refrigerator|air\s*conditioner|water\s*purifier|chimney|geyser|air\s*fryer|microwave|dress|shirt|kurti|saree)\b/i };
          } else if (cat === 'appliances') {
            prodQuery.$or = [
              { category: 'appliances' },
              { subcategory: { $in: ['refrigerators', 'washing-machines', 'air-conditioners', 'water-purifiers', 'geysers', 'air-fryers', 'microwaves', 'chimneys', 'fans-coolers', 'kitchen-appliances'] } }
            ];
            prodQuery.title = { $not: /\b(pendrive|flash\s*drive|type-c\s*usb|laundry\s*bag|liquid\s*detergent|washing\s*powder|stain\s*remover|heating\s*pad)\b/i };
          } else if (cat === 'fashion') {
            prodQuery.$and = [
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
            prodQuery.$or = [
              { category: { $in: ['beauty', 'personal-care'] } },
              { subcategory: { $in: ['makeup', 'skincare', 'haircare', 'bath-body', 'fragrance', 'appliances', 'mens-grooming', 'nailcare'] } }
            ];
            prodQuery.subcategory = { $nin: ['feminine-hygiene'] };
            prodQuery.title = { $not: /\b(school\s*bag|backpack|daypack|luggage|shoes?|t-?shirt|dress|jeans)\b/i };
          } else if (cat === 'home') {
            prodQuery.$or = [
              { category: { $in: ['home', 'kitchen', 'home-kitchen'] } },
              { subcategory: { $in: ['decor', 'bedding', 'cleaning', 'furniture', 'storage', 'kitchen-dining', 'kitchen', 'tools', 'garden'] } }
            ];
            prodQuery.category = { $nin: ['men-fashion', 'women-fashion', 'fashion', 'beauty', 'auto', 'pets', 'books-stationery', 'travel', 'electronics'] };
            prodQuery.title = { $not: /\b(t-?shirt|shirt|polo|kurta|kurti|saree|sari|lehenga|dress|jeans|trouser|sneaker|shoes|heels|sandals|lipstick|perfume|deodorant|dog\s*food|cat\s*treat|chew\s*toy|trolley|suitcase|backpack|dash\s*cam)\b/i };
          } else if (cat === 'fitness') {
            prodQuery.$or = [
              { category: 'fitness' },
              { subcategory: { $in: ['fitness-apparel', 'trackers', 'gym-equipment', 'nutrition', 'sports-gear', 'yoga'] } }
            ];
            prodQuery.title = { $not: /\b(chocolate|cookie|biscuit|namkeen|chips|dress|kurti|saree)\b/i };
          } else if (cat === 'grocery') {
            prodQuery.$or = [
              { category: { $in: ['grocery', 'gourmet', 'food'] } },
              { subcategory: { $in: ['breakfast-dairy', 'coffee-tea', 'cooking-staples', 'dry-fruits', 'snacks-beverages'] } }
            ];
            prodQuery.title = { $not: /\b(coffee\s*table|centre\s*table|dining\s*table|sofa|chair|cat\s*treat|dog\s*food|chew|diya\s*batti|pooja|whey\s*protein|multivitamin)\b/i };
          } else if (cat === 'travel' || cat === 'luggage' || cat === 'bags') {
            prodQuery.$or = [
              { category: 'travel' },
              { subcategory: { $in: ['luggage', 'bags'] } }
            ];
          } else if (cat === 'baby-kids') {
            prodQuery.$or = [
              { category: 'baby-kids' },
              { subcategory: { $in: ['toys-games', 'diapers-wipes', 'baby-gear', 'feeding-nursing'] } }
            ];
          } else if (cat === 'auto') {
            prodQuery.$or = [
              { category: 'auto' },
              { subcategory: { $in: ['helmets-riding', 'car-accessories', 'bike-accessories', 'car-care'] } }
            ];
          } else if (cat === 'books' || cat === 'books-stationery') {
            prodQuery.$or = [
              { category: 'books-stationery' },
              { subcategory: { $in: ['books', 'stationery', 'craft-supplies', 'office-supplies'] } }
            ];
          } else {
            prodQuery.$or = [{ category: cat }, { subcategory: cat }];
          }
        }

        if (req.query.merchant && req.query.merchant !== 'all') {
          prodQuery.merchant = req.query.merchant.toLowerCase().trim();
        }

        if (req.query.q) {
          const qStr = req.query.q.trim();
          const searchTokens = qStr.split(/\s+/).filter(Boolean);
          const searchConds = searchTokens.map(token => {
            const regex = new RegExp(token, 'i');
            return {
              $or: [
                { title: regex },
                { productId: regex },
                { brand: regex },
                { merchant: regex }
              ]
            };
          });
          prodQuery.$and = searchConds;
        }

        const prods = await Product.find(prodQuery)
          .select('_id productId title brand merchant category subcategory imageUrl images cleanUrl price originalPrice previousPrice rating country lastChecked')
          .limit(needed * 3)
          .lean();

        // Sort by genuine price drop percentage descending against previousPrice
        const sortedProds = prods.map(p => {
          const discountPct = (p.previousPrice && p.price && p.previousPrice > p.price)
            ? Math.round(((p.previousPrice - p.price) / p.previousPrice) * 100)
            : 0;
          return { ...p, calculatedDiscount: discountPct };
        }).filter(p => p.calculatedDiscount > 0).sort((a, b) => b.calculatedDiscount - a.calculatedDiscount);

        const mappedProds = [];
        for (const p of sortedProds) {
          if (mappedProds.length >= needed) break;
          const cleanTitle = (p.title || '').toLowerCase().trim();
          if (existingTitles.has(cleanTitle) || existingIds.has(p._id?.toString()) || (p.productId && existingIds.has(p.productId))) {
            continue;
          }

          mappedProds.push({
            _id: p._id,
            productId: p.productId,
            title: p.title,
            dealUrl: p.cleanUrl,
            imageUrl: p.imageUrl || (p.images && p.images[0]),
            dealPrice: p.price,
            originalPrice: p.originalPrice,
            previousPrice: p.previousPrice,
            discountPercentage: p.calculatedDiscount,
            merchant: p.merchant,
            category: p.category,
            subcategory: p.subcategory,
            country: p.country || 'IN',
            isExpired: false,
            resolvedToProduct: true,
            matchedProductId: p._id.toString(),
            linkedProductId: p._id.toString(),
          });
          existingTitles.add(cleanTitle);
          existingIds.add(p._id?.toString());
        }

        if (mappedProds.length > 0) {
          deals = deals.concat(mappedProds);
          total = Math.max(total, deals.length);
        }
      }
    }

    res.json({
      success: true,
      data: deals,
      deals,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('[API Error] GET /api/deals failed:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/deals/:id
 */
router.get('/:id', cacheMiddleware(30), async (req, res) => {
  try {
    let deal = null;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      deal = await Deal.findById(req.params.id).lean();
    }
    if (!deal) {
      deal = await Deal.findOne({ productId: req.params.id }).sort({ createdAt: -1 }).lean();
    }

    // Fallback: Check if the ID belongs to a canonical tracked Product
    if (!deal) {
      let product = null;
      if (mongoose.Types.ObjectId.isValid(req.params.id)) {
        product = await Product.findById(req.params.id).lean();
      }
      if (!product) {
        product = await Product.findOne({ productId: req.params.id }).lean();
      }
      if (product) {
        const discountPct = (product.originalPrice && product.price && product.originalPrice > product.price)
          ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
          : 0;
        return res.json({
          success: true,
          data: {
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
            matchedProductId: product._id.toString(),
          }
        });
      }
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }
    res.json({ success: true, data: deal });
  } catch (err) {
    console.error(`[API Error] GET /api/deals/${req.params.id} failed:`, err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * DELETE /api/deals/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    let deal = null;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      deal = await Deal.findByIdAndDelete(req.params.id);
    } else {
      deal = await Deal.findOneAndDelete({ productId: req.params.id });
    }
    if (!deal) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }
    res.json({ success: true, message: 'Deal deleted successfully' });
  } catch (err) {
    console.error(`[API Error] DELETE /api/deals/${req.params.id} failed:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/deals/bulk-delete
 */
router.post('/bulk-delete', async (req, res) => {
  try {
    const { dealIds } = req.body;
    if (!Array.isArray(dealIds) || dealIds.length === 0) {
      return res.status(400).json({ success: false, error: 'dealIds array is required' });
    }
    const result = await Deal.deleteMany({ _id: { $in: dealIds } });
    res.json({ success: true, message: `${result.deletedCount} deals deleted successfully` });
  } catch (err) {
    console.error('[API Error] POST /api/deals/bulk-delete failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
