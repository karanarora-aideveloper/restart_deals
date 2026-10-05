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

    // Resolve locality
    let locality;
    if (lat && lng && !localityId) {
      locality = findNearestGwaliorLocality(lat, lng);
      localityId = locality.id;
    } else {
      locality = getLocalityById(localityId || 'city-centre');
      localityId = locality.id;
      if (!lat || !lng) {
        lat = locality.lat;
        lng = locality.lng;
      }
    }

    const pincode = locality.pincode || '474011';
    let items = [];
    let source = 'calibrated_benchmark';
    let storesEta = DEFAULT_GWALIOR_ETAS;

    // Fast-path: If no search query, return calibrated benchmark catalog instantly (0ms)
    if (!q) {
      items = searchGroceryCatalog({
        query: '',
        category,
        localityId,
      });
    } else {
      // Attempt live fetch with tight timeout
      try {
        const liveRes = await fetchLiveQuickCommerce({
          query: q,
          lat,
          lon: lng,
          pincode,
          city: 'Gwalior',
        });

        if (liveRes.items && liveRes.items.length > 0) {
          items = liveRes.items;
          storesEta = liveRes.storesEta || DEFAULT_GWALIOR_ETAS;
          source = 'live';
        }
      } catch (liveErr) {
        console.warn('Live quick commerce query failed, using benchmark fallback:', liveErr.message);
      }

      // If no live items returned (timeout or no match), fallback to local catalog immediately
      if (items.length === 0) {
        items = searchGroceryCatalog({
          query: q,
          category,
          localityId,
        });
      }
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
      city: 'Gwalior',
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
