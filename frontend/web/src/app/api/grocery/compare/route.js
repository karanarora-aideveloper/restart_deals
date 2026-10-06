import { NextResponse } from 'next/server';
import {
  GWALIOR_LOCALITIES,
  findNearestGwaliorLocality,
  getLocalityById,
  searchGroceryCatalog,
} from '@/lib/groceryConfig';
import {
  fetchStoreEtas,
  fetchLiveQuickCommerce,
  DEFAULT_GWALIOR_ETAS,
} from '@/lib/quickCommerceLiveService';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    const category = searchParams.get('category') || 'all';
    let localityId = searchParams.get('locality') || '';
    let lat = parseFloat(searchParams.get('lat') || '0');
    let lng = parseFloat(searchParams.get('lng') || '0');

    const localityNameParam = searchParams.get('localityName');
    const cityParam = searchParams.get('city');
    const pincodeParam = searchParams.get('pincode');

    // Resolve locality
    let locality;
    if (lat && lng) {
      if (localityNameParam) {
        locality = {
          id: 'exact-gps',
          name: localityNameParam,
          city: cityParam || 'Your Location',
          pincode: pincodeParam || '',
          lat,
          lng,
          blinkitStore: 'Live Dark Store Hub',
          instamartStore: 'Live Pod',
          blinkitEta: '8–10 mins',
          instamartEta: '12–15 mins',
        };
      } else {
        locality = findNearestGwaliorLocality(lat, lng);
        localityId = locality.id;
      }
    } else {
      locality = getLocalityById(localityId || 'city-centre');
      localityId = locality.id;
      lat = locality.lat;
      lng = locality.lng;
    }

    const pincode = pincodeParam || locality.pincode || '474011';
    let items = [];
    let source = 'calibrated_benchmark';
    let storesEta = DEFAULT_GWALIOR_ETAS;

    // Fetch exact live dark store ETAs for user coordinates
    try {
      storesEta = await fetchStoreEtas({ lat, lon: lng, pincode, city: cityParam || locality.city || 'Gwalior' });
    } catch (etaErr) {
      console.warn('Failed to fetch exact store ETAs:', etaErr.message);
    }

    const liveBlinkitObj = storesEta.find((e) => (e.platform || '').toLowerCase().includes('blink'));
    const liveSwiggyObj = storesEta.find((e) => (e.platform || '').toLowerCase().includes('swiggy'));
    const liveBlinkitEta = liveBlinkitObj?.eta && liveBlinkitObj.eta !== 'N/A' && liveBlinkitObj.eta !== 'Closed' ? liveBlinkitObj.eta : null;
    const liveInstamartEta = liveSwiggyObj?.eta && liveSwiggyObj.eta !== 'N/A' && liveSwiggyObj.eta !== 'Closed' ? liveSwiggyObj.eta : null;

    // Determine dynamic query for live quick commerce pods
    let liveQuery = q;
    if (!liveQuery) {
      switch (category) {
        case 'loots':
          liveQuery = 'chocolate';
          break;
        case 'dairy':
          liveQuery = 'milk';
          break;
        case 'staples':
          liveQuery = 'atta';
          break;
        case 'instant':
          liveQuery = 'snack';
          break;
        case 'cleaning':
          liveQuery = 'detergent';
          break;
        case 'hygiene':
          liveQuery = 'shampoo';
          break;
        default:
          liveQuery = 'butter';
          break;
      }
    }

    // Query live dark stores for exact doorstep coordinates
    try {
      const liveRes = await fetchLiveQuickCommerce({
        query: liveQuery,
        lat,
        lon: lng,
        pincode,
        city: cityParam || locality.city || 'Your Location',
        etaList: storesEta,
      });

      if (liveRes.items && liveRes.items.length > 0) {
        items = liveRes.items;
        if (liveRes.storesEta && liveRes.storesEta.length > 0) {
          storesEta = liveRes.storesEta;
        }
        source = 'live';

        // If user specifically clicked 'loots' filter, show only verified deals
        if (category === 'loots') {
          const lootItems = items.filter((it) => it.isLoot);
          if (lootItems.length > 0) {
            items = lootItems;
          }
        }
      }
    } catch (liveErr) {
      console.warn('Live quick commerce query failed, using benchmark fallback:', liveErr.message);
    }

    // Fallback gracefully only if live APIs return 0 items (e.g. unserviceable area)
    if (items.length === 0) {
      items = searchGroceryCatalog({
        query: q,
        category: category === 'loots' ? 'all' : category,
        localityId,
      }).map((item) => ({
        ...item,
        blinkit: item.blinkit
          ? {
              ...item.blinkit,
              eta: liveBlinkitEta || item.blinkit.eta,
              storeOpen: liveBlinkitObj?.open !== false && liveBlinkitObj?.eta !== 'Closed',
            }
          : null,
        instamart: item.instamart
          ? {
              ...item.instamart,
              eta: liveInstamartEta || item.instamart.eta,
              storeOpen: liveSwiggyObj?.open !== false && liveSwiggyObj?.eta !== 'Closed',
            }
          : null,
      }));
    }

    // Summary statistics
    let blinkitCheaperCount = 0;
    let instamartCheaperCount = 0;
    let equalCount = 0;
    let totalPotentialSavings = 0;

    items.forEach((item) => {
      if (item.cheaperStore === 'blinkit') {
        blinkitCheaperCount++;
        totalPotentialSavings += item.savingCash || 0;
      } else if (item.cheaperStore === 'instamart') {
        instamartCheaperCount++;
        totalPotentialSavings += item.savingCash || 0;
      } else {
        equalCount++;
      }
    });

    return NextResponse.json({
      success: true,
      city: cityParam || locality?.city || 'Your City',
      locality,
      source,
      storesEta,
      availableLocalities: GWALIOR_LOCALITIES,
      stats: {
        totalItems: items.length,
        blinkitCheaperCount,
        instamartCheaperCount,
        equalCount,
        totalPotentialSavings,
      },
      results: items,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to compare grocery prices',
      },
      { status: 500 }
    );
  }
}
