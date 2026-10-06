import { getDb } from '@/lib/mongodb';

const COLLECTION_NAME = 'grocery_price_history';

/**
 * Enriches quick commerce items with real historical price drop data from MongoDB,
 * and asynchronously records today's price checkpoint in the database.
 *
 * Prevents false claims based on printed MRP:
 * - A Price Drop strictly requires: Current Live Price < Yesterday's Recorded Price in DB.
 * - Everyday MRP markdowns are preserved purely as retail discount information.
 * - Pack size / unit is isolated ({ platform, storeId, productId, unit }) to eliminate
 *   false crashes from multi-pack variations (e.g. 100g vs 3x100g).
 *
 * @param {Object} params
 * @param {Array} params.items - Parsed quick commerce product groups
 * @param {Array} params.storesEta - Real-time dark store status with storeIds
 * @param {Object} params.locality - User doorstep locality
 * @returns {Promise<Array>} Enriched items with real price drop metrics
 */
export async function recordAndEnrichPriceHistory({ items = [], storesEta = [], locality = {} }) {
  if (!items || items.length === 0) return items;

  // Extract store identifiers for exact dark stores
  const liveBlinkitObj = storesEta.find((e) => (e.platform || '').toLowerCase().includes('blink'));
  const liveSwiggyObj = storesEta.find((e) => (e.platform || '').toLowerCase().includes('swiggy'));

  const blinkitStoreId = liveBlinkitObj?.storeId || 'general';
  const instamartStoreId = liveSwiggyObj?.storeId || 'general';
  const city = locality?.city || 'India';
  const today = new Date().toISOString().split('T')[0];

  let db;
  try {
    db = await getDb();
  } catch (err) {
    console.warn('[PriceTracker] MongoDB connection unavailable:', err.message);
    return items;
  }

  const col = db.collection(COLLECTION_NAME);

  // 1. Gather all keys to lookup from MongoDB (pack-size isolated)
  const lookupKeys = [];
  items.forEach((item) => {
    const cleanUnit = (item.unit || 'default').trim().toLowerCase();
    if (item.blinkit?.productId && item.blinkit?.price) {
      lookupKeys.push({
        platform: 'blinkit',
        storeId: String(blinkitStoreId),
        productId: String(item.blinkit.productId),
        unit: cleanUnit,
      });
    }
    if (item.instamart?.productId && item.instamart?.price) {
      lookupKeys.push({
        platform: 'instamart',
        storeId: String(instamartStoreId),
        productId: String(item.instamart.productId),
        unit: cleanUnit,
      });
    }
  });

  if (lookupKeys.length === 0) return items;

  // 2. Fetch existing historical records in 1 fast indexed query
  let existingRecords = [];
  try {
    existingRecords = await col
      .find({
        $or: lookupKeys,
      })
      .toArray();
  } catch (findErr) {
    console.warn('[PriceTracker] Query error:', findErr.message);
  }

  const historyMap = new Map();
  existingRecords.forEach((doc) => {
    const key = `${doc.platform}:${doc.storeId}:${doc.productId}:${doc.unit}`;
    historyMap.set(key, doc);
  });

  const bulkOps = [];
  const now = new Date();

  // 3. Evaluate each item for REAL price drops
  items.forEach((item) => {
    const cleanUnit = (item.unit || 'default').trim().toLowerCase();

    // Check Blinkit
    if (item.blinkit?.productId && item.blinkit?.price) {
      const bKey = `blinkit:${blinkitStoreId}:${item.blinkit.productId}:${cleanUnit}`;
      const existingDoc = historyMap.get(bKey);
      const bPrice = item.blinkit.price;

      if (existingDoc) {
        // If we have previous price recorded from an earlier date
        const prevPrice = existingDoc.previousPrice || existingDoc.currentPrice;
        if (prevPrice && bPrice < prevPrice) {
          const dropCash = Math.round(prevPrice - bPrice);
          const dropPct = Math.round((dropCash / prevPrice) * 100);
          item.blinkit.priceDropCash = dropCash;
          item.blinkit.priceDropPct = dropPct;
          item.blinkit.previousPrice = prevPrice;
        }

        // Prepare bulk update
        const hasToday = (existingDoc.history || []).some((h) => h.date === today);
        if (hasToday) {
          bulkOps.push({
            updateOne: {
              filter: {
                platform: 'blinkit',
                storeId: String(blinkitStoreId),
                productId: String(item.blinkit.productId),
                unit: cleanUnit,
              },
              update: {
                $set: {
                  currentPrice: bPrice,
                  mrp: item.blinkit.mrp || bPrice,
                  name: item.name,
                  city,
                  lastSeenAt: now,
                },
              },
            },
          });
        } else {
          // New calendar day: capture yesterday's price as previousPrice
          const prevDayPrice = existingDoc.currentPrice;
          const dropCash = prevDayPrice > bPrice ? Math.round(prevDayPrice - bPrice) : 0;
          const dropPct = dropCash > 0 ? Math.round((dropCash / prevDayPrice) * 100) : 0;

          bulkOps.push({
            updateOne: {
              filter: {
                platform: 'blinkit',
                storeId: String(blinkitStoreId),
                productId: String(item.blinkit.productId),
                unit: cleanUnit,
              },
              update: {
                $set: {
                  currentPrice: bPrice,
                  previousPrice: prevDayPrice,
                  priceDropCash: dropCash,
                  priceDropPct: dropPct,
                  mrp: item.blinkit.mrp || bPrice,
                  name: item.name,
                  city,
                  lastSeenAt: now,
                },
                $push: {
                  history: {
                    $each: [{ date: today, price: bPrice }],
                    $slice: -30, // Compact to 30-day rolling window
                  },
                },
              },
            },
          });
        }
      } else {
        // First time seeing this product in this dark store
        bulkOps.push({
          updateOne: {
            filter: {
              platform: 'blinkit',
              storeId: String(blinkitStoreId),
              productId: String(item.blinkit.productId),
              unit: cleanUnit,
            },
            update: {
              $set: {
                name: item.name,
                unit: cleanUnit,
                currentPrice: bPrice,
                previousPrice: bPrice,
                priceDropCash: 0,
                priceDropPct: 0,
                mrp: item.blinkit.mrp || bPrice,
                city,
                lastSeenAt: now,
              },
              $setOnInsert: {
                firstSeenAt: now,
                history: [{ date: today, price: bPrice }],
              },
            },
            upsert: true,
          },
        });
      }
    }

    // Check Swiggy Instamart
    if (item.instamart?.productId && item.instamart?.price) {
      const sKey = `instamart:${instamartStoreId}:${item.instamart.productId}:${cleanUnit}`;
      const existingDoc = historyMap.get(sKey);
      const sPrice = item.instamart.price;

      if (existingDoc) {
        const prevPrice = existingDoc.previousPrice || existingDoc.currentPrice;
        if (prevPrice && sPrice < prevPrice) {
          const dropCash = Math.round(prevPrice - sPrice);
          const dropPct = Math.round((dropCash / prevPrice) * 100);
          item.instamart.priceDropCash = dropCash;
          item.instamart.priceDropPct = dropPct;
          item.instamart.previousPrice = prevPrice;
        }

        const hasToday = (existingDoc.history || []).some((h) => h.date === today);
        if (hasToday) {
          bulkOps.push({
            updateOne: {
              filter: {
                platform: 'instamart',
                storeId: String(instamartStoreId),
                productId: String(item.instamart.productId),
                unit: cleanUnit,
              },
              update: {
                $set: {
                  currentPrice: sPrice,
                  mrp: item.instamart.mrp || sPrice,
                  name: item.name,
                  city,
                  lastSeenAt: now,
                },
              },
            },
          });
        } else {
          const prevDayPrice = existingDoc.currentPrice;
          const dropCash = prevDayPrice > sPrice ? Math.round(prevDayPrice - sPrice) : 0;
          const dropPct = dropCash > 0 ? Math.round((dropCash / prevDayPrice) * 100) : 0;

          bulkOps.push({
            updateOne: {
              filter: {
                platform: 'instamart',
                storeId: String(instamartStoreId),
                productId: String(item.instamart.productId),
                unit: cleanUnit,
              },
              update: {
                $set: {
                  currentPrice: sPrice,
                  previousPrice: prevDayPrice,
                  priceDropCash: dropCash,
                  priceDropPct: dropPct,
                  mrp: item.instamart.mrp || sPrice,
                  name: item.name,
                  city,
                  lastSeenAt: now,
                },
                $push: {
                  history: {
                    $each: [{ date: today, price: sPrice }],
                    $slice: -30,
                  },
                },
              },
            },
          });
        }
      } else {
        bulkOps.push({
          updateOne: {
            filter: {
              platform: 'instamart',
              storeId: String(instamartStoreId),
              productId: String(item.instamart.productId),
              unit: cleanUnit,
            },
            update: {
              $set: {
                name: item.name,
                unit: cleanUnit,
                currentPrice: sPrice,
                previousPrice: sPrice,
                priceDropCash: 0,
                priceDropPct: 0,
                mrp: item.instamart.mrp || sPrice,
                city,
                lastSeenAt: now,
              },
              $setOnInsert: {
                firstSeenAt: now,
                history: [{ date: today, price: sPrice }],
              },
            },
            upsert: true,
          },
        });
      }
    }

    // Determine overall item badge:
    // Real Price Drop wins over everything else!
    const bDrop = item.blinkit?.priceDropCash || 0;
    const sDrop = item.instamart?.priceDropCash || 0;
    const maxRealDrop = Math.max(bDrop, sDrop);

    if (maxRealDrop > 0) {
      item.isRealDrop = true;
      item.isLoot = true;
      item.realDropCash = maxRealDrop;
      const dropStore = bDrop >= sDrop ? 'Blinkit' : 'Instamart';
      const dropPct = bDrop >= sDrop ? item.blinkit.priceDropPct : item.instamart.priceDropPct;
      item.lootBadge = `📉 ₹${maxRealDrop} Price Drop (${dropPct}% on ${dropStore})`;
    } else if (item.savingCash >= 15 && item.cheaperStore !== 'equal') {
      // Cross-store savings arbitrage
      item.isLoot = true;
      item.lootBadge = `⚡ Save ₹${item.savingCash} on ${item.cheaperStore === 'blinkit' ? 'Blinkit' : 'Instamart'}`;
    } else {
      item.isLoot = false;
      item.lootBadge = null;
    }
  });

  // 4. Asynchronously commit updates in MongoDB in background
  if (bulkOps.length > 0) {
    col.bulkWrite(bulkOps, { ordered: false }).catch((err) => {
      console.warn('[PriceTracker] Background bulkWrite error:', err.message);
    });
  }

  // Re-sort: items with real price drops or top cross-store savings on top
  items.sort((a, b) => {
    if (a.isRealDrop && !b.isRealDrop) return -1;
    if (!a.isRealDrop && b.isRealDrop) return 1;
    if (a.isLoot && !b.isLoot) return -1;
    if (!a.isLoot && b.isLoot) return 1;
    return (b.savingCash || 0) - (a.savingCash || 0);
  });

  return items;
}
