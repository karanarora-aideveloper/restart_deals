/**
 * Live Quick Commerce Bridge Service
 * Real-time price and inventory bridge for Blinkit, Swiggy Instamart, BigBasket & Zepto
 */

const QC_ENC_KEY = '04026aadf583caa59cbbf8599d15889274c2fff741b3a8a19229861aa25c6290';

// In-memory cache to store live quick commerce results (TTL: 15 minutes)
const QC_CACHE = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000;

// Default dark store pods for instant fallback
export const DEFAULT_FALLBACK_ETAS = [
  { platform: 'BlinkIt', storeId: 'auto', open: true, eta: '8–12 mins' },
  { platform: 'Swiggy', storeId: 'auto', open: true, eta: '12–15 mins', serviceabilityStatus: 'SERVICEABLE' },
  { platform: 'BigBasket', storeId: 'auto', open: true, eta: '10–15 mins' },
  { platform: 'Zepto', storeId: '', open: false }
];
export const DEFAULT_GWALIOR_ETAS = DEFAULT_FALLBACK_ETAS;

function xorEncrypt(text, key) {
  let res = '';
  for (let i = 0; i < text.length; i++) {
    res += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return res;
}

function generateUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });
}

export function generateQCRequestId() {
  const uuid = generateUuid();
  const encrypted = xorEncrypt(uuid, QC_ENC_KEY);
  return Buffer.from(unescape(encodeURIComponent(encrypted))).toString('base64');
}

/**
 * Fetch live dark store ETAs & availability
 */
export async function fetchStoreEtas({ lat, lon, pincode = '474011', city = 'Gwalior' }) {
  const cacheKey = `eta:${lat.toFixed(3)}:${lon.toFixed(3)}`;
  const cached = QC_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const reqId = generateQCRequestId();
  const url = `https://api.quickcompare.in/qc?lat=${lat}&lon=${lon}&type=home`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'X-Request-ID': reqId,
        'X-User-ID': `sd_user_${Date.now()}`,
        'X-Clean-User-ID': `sd_clean_${Date.now()}`,
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Referer: 'https://quickcompare.in/',
        'x-geolocation-city': city,
        'x-geolocation-pincode': pincode,
        'x-geolocation-latitude': lat.toString(),
        'x-geolocation-longitude': lon.toString(),
      },
    });

    clearTimeout(timeoutId);
    if (!res.ok) return DEFAULT_GWALIOR_ETAS;

    const data = await res.json();
    const etas = data.eta && data.eta.length > 0 ? data.eta : DEFAULT_GWALIOR_ETAS;
    QC_CACHE.set(cacheKey, { timestamp: Date.now(), data: etas });
    return etas;
  } catch (err) {
    clearTimeout(timeoutId);
    return DEFAULT_GWALIOR_ETAS;
  }
}

/**
 * Fetch live grouped products across Blinkit & Swiggy Instamart
 */
export async function fetchLiveQuickCommerce({
  query,
  lat,
  lon,
  pincode = '474011',
  city = 'Gwalior',
  etaList = null,
}) {
  if (!query || query.trim() === '') {
    return { items: [], storesEta: [] };
  }

  const q = query.trim().toLowerCase();
  const cacheKey = `search:${q}:${pincode}:${lat.toFixed(3)}:${lon.toFixed(3)}`;
  const cached = QC_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // Use pre-configured dark store pods directly (0ms network overhead)
  const etas = etaList && etaList.length > 0 ? etaList : DEFAULT_FALLBACK_ETAS;

  const reqId = generateQCRequestId();
  const searchUrl = `https://api.quickcompare.in/qc?lat=${lat}&lon=${lon}&type=groupsearch&query=${encodeURIComponent(
    q
  )}&pincode=${pincode}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(searchUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': reqId,
        'X-User-ID': `sd_user_${Date.now()}`,
        'X-Clean-User-ID': `sd_clean_${Date.now()}`,
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Referer: 'https://quickcompare.in/',
        'x-geolocation-city': city,
        'x-geolocation-pincode': pincode,
        'x-geolocation-latitude': lat.toString(),
        'x-geolocation-longitude': lon.toString(),
      },
      body: JSON.stringify({
        eta: etas,
        pincode,
        address: {
          latitude: lat,
          longitude: lon,
          city,
          pincode,
        },
      }),
    });

    clearTimeout(timeoutId);
    if (!res.ok) {
      throw new Error(`QC API responded with status ${res.status}`);
    }

    const rawGroups = await res.json();
    if (!Array.isArray(rawGroups)) {
      return { items: [], storesEta: etas };
    }

    // Step 3: Normalize items for ShoppersDeals comparison UI
    const liveBlinkitObj = etas.find((e) => (e.platform || '').toLowerCase().includes('blink'));
    const liveSwiggyObj = etas.find((e) => (e.platform || '').toLowerCase().includes('swiggy'));
    const liveBlinkitEta = liveBlinkitObj?.eta && liveBlinkitObj.eta !== 'N/A' && liveBlinkitObj.eta !== 'Closed' ? liveBlinkitObj.eta : null;
    const liveInstamartEta = liveSwiggyObj?.eta && liveSwiggyObj.eta !== 'N/A' && liveSwiggyObj.eta !== 'Closed' ? liveSwiggyObj.eta : null;

    const items = [];
    rawGroups.forEach((group, idx) => {
      if (!group.data || !Array.isArray(group.data) || group.data.length === 0) return;

      const blinkitItem = group.data.find((d) =>
        (d.platform?.name || '').toLowerCase().includes('blink')
      );
      const swiggyItem = group.data.find((d) =>
        (d.platform?.name || '').toLowerCase().includes('swiggy')
      );
      const bbItem = group.data.find((d) =>
        (d.platform?.name || '').toLowerCase().includes('bigbasket')
      );
      const zeptoItem = group.data.find((d) =>
        (d.platform?.name || '').toLowerCase().includes('zepto')
      );

      // Representative item for primary metadata
      const rep = blinkitItem || swiggyItem || bbItem || group.data[0];
      if (!rep) return;

      const bPrice = blinkitItem
        ? parseFloat(blinkitItem.offer_price || blinkitItem.mrp || 0)
        : null;
      const sPrice = swiggyItem
        ? parseFloat(swiggyItem.offer_price || swiggyItem.mrp || 0)
        : null;

      let cheaperStore = 'equal';
      let savingCash = 0;

      if (bPrice && sPrice) {
        if (bPrice < sPrice) {
          cheaperStore = 'blinkit';
          savingCash = Math.round(sPrice - bPrice);
        } else if (sPrice < bPrice) {
          cheaperStore = 'instamart';
          savingCash = Math.round(bPrice - sPrice);
        }
      } else if (bPrice && !sPrice) {
        cheaperStore = 'blinkit';
      } else if (sPrice && !bPrice) {
        cheaperStore = 'instamart';
      }

      const bMrp = blinkitItem?.mrp ? parseFloat(blinkitItem.mrp) : bPrice;
      const sMrp = swiggyItem?.mrp ? parseFloat(swiggyItem.mrp) : sPrice;
      const bDisc = bMrp && bPrice && bMrp > bPrice ? Math.round(((bMrp - bPrice) / bMrp) * 100) : 0;
      const sDisc = sMrp && sPrice && sMrp > sPrice ? Math.round(((sMrp - sPrice) / sMrp) * 100) : 0;
      const maxDiscountPct = Math.max(bDisc, sDisc);

      const isLoot = maxDiscountPct >= 20 || savingCash >= 25;
      let lootBadge = null;
      if (maxDiscountPct >= 40) {
        lootBadge = `🔥 ${maxDiscountPct}% OFF Loot`;
      } else if (maxDiscountPct >= 20) {
        lootBadge = `📉 ${maxDiscountPct}% Drop`;
      } else if (savingCash >= 20) {
        lootBadge = `⚡ Save ₹${savingCash} on ${cheaperStore === 'blinkit' ? 'Blinkit' : 'Instamart'}`;
      }

      // Infer clean category label from title
      const nameLower = rep.name.toLowerCase();
      let category = 'staples';
      let categoryLabel = 'Atta, Rice & Oils';
      if (
        nameLower.includes('milk') ||
        nameLower.includes('butter') ||
        nameLower.includes('paneer') ||
        nameLower.includes('dahi') ||
        nameLower.includes('curd') ||
        nameLower.includes('cheese') ||
        nameLower.includes('bread')
      ) {
        category = 'dairy';
        categoryLabel = 'Dairy & Breakfast';
      } else if (
        nameLower.includes('maggi') ||
        nameLower.includes('noodle') ||
        nameLower.includes('tea') ||
        nameLower.includes('coffee') ||
        nameLower.includes('biscuit') ||
        nameLower.includes('cookie') ||
        nameLower.includes('chip') ||
        nameLower.includes('snack') ||
        nameLower.includes('juice') ||
        nameLower.includes('drink') ||
        nameLower.includes('cola')
      ) {
        category = 'instant';
        categoryLabel = 'Snacks & Beverages';
      } else if (
        nameLower.includes('surf') ||
        nameLower.includes('vim') ||
        nameLower.includes('harpic') ||
        nameLower.includes('detergent') ||
        nameLower.includes('cleaner') ||
        nameLower.includes('dishwash')
      ) {
        category = 'cleaning';
        categoryLabel = 'Cleaning & Household';
      } else if (
        nameLower.includes('soap') ||
        nameLower.includes('shampoo') ||
        nameLower.includes('paste') ||
        nameLower.includes('brush') ||
        nameLower.includes('pad') ||
        nameLower.includes('dettol')
      ) {
        category = 'hygiene';
        categoryLabel = 'Hygiene & Personal Care';
      }

      items.push({
        id: `live-${rep.id || idx}`,
        name: rep.name,
        brand: rep.brand || null,
        unit: rep.quantity || '',
        category,
        categoryLabel,
        imageUrl: rep.images?.[0] || '',
        mrp: parseFloat(rep.mrp || bPrice || sPrice || 0),
        blinkit: blinkitItem
          ? {
              price: bPrice,
              mrp: parseFloat(blinkitItem.mrp || bPrice),
              inStock: blinkitItem.available !== false,
              discountPct: blinkitItem.mrp
                ? Math.max(
                    0,
                    Math.round(
                      ((blinkitItem.mrp - bPrice) / blinkitItem.mrp) * 100
                    )
                  )
                : 0,
              eta: blinkitItem.platform?.sla || liveBlinkitEta || '8–10 mins',
              storeOpen: liveBlinkitObj?.open !== false && liveBlinkitObj?.eta !== 'Closed',
              deepLink: blinkitItem.deeplink?.startsWith('http')
                ? blinkitItem.deeplink
                : `https://blinkit.com/prn/x/prid/${blinkitItem.id}`,
              url: `https://blinkit.com/prn/x/prid/${blinkitItem.id}`,
            }
          : null,
        instamart: swiggyItem
          ? {
              price: sPrice,
              mrp: parseFloat(swiggyItem.mrp || sPrice),
              inStock: swiggyItem.available !== false,
              discountPct: swiggyItem.mrp
                ? Math.max(
                    0,
                    Math.round(
                      ((swiggyItem.mrp - sPrice) / swiggyItem.mrp) * 100
                    )
                  )
                : 0,
              eta: swiggyItem.platform?.sla || liveInstamartEta || '12–15 mins',
              storeOpen: liveSwiggyObj?.open !== false && liveSwiggyObj?.eta !== 'Closed',
              deepLink: swiggyItem.deeplink || 'swiggy://instamart',
              url: swiggyItem.deeplink || 'https://www.swiggy.com/instamart',
            }
          : null,
        cheaperStore,
        savingCash,
        isLoot,
        lootBadge,
        maxDiscountPct,
        allStores: group.data.map((d) => ({
          store: d.platform?.name,
          price: parseFloat(d.offer_price || d.mrp || 0),
          mrp: parseFloat(d.mrp || d.offer_price || 0),
          eta: d.platform?.sla || '',
          inStock: d.available !== false,
          url: d.deeplink,
        })),
      });
    });

    // Sort: loots and items that have Blinkit and/or Instamart with savings first
    items.sort((a, b) => {
      if (a.isLoot && !b.isLoot) return -1;
      if (!a.isLoot && b.isLoot) return 1;
      const aBoth = a.blinkit && a.instamart ? 2 : (a.blinkit || a.instamart ? 1 : 0);
      const bBoth = b.blinkit && b.instamart ? 2 : (b.blinkit || b.instamart ? 1 : 0);
      if (aBoth !== bBoth) return bBoth - aBoth;
      return (b.savingCash || 0) - (a.savingCash || 0);
    });

    const result = {
      items,
      storesEta: etas,
    };

    // Cache the result for 15 minutes
    QC_CACHE.set(cacheKey, { timestamp: Date.now(), data: result });

    return result;
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('Error fetching live QC data:', err.message);
    return { items: [], storesEta: etas || [] };
  }
}
