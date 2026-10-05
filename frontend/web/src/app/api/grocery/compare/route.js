import { NextResponse } from 'next/server';
import {
  GWALIOR_LOCALITIES,
  findNearestGwaliorLocality,
  getLocalityById,
  searchGroceryCatalog,
} from '@/lib/groceryConfig';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const category = searchParams.get('category') || 'all';
    let localityId = searchParams.get('locality') || '';
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');

    // If user passed coordinates, find nearest Gwalior dark store zone
    let locality;
    if (lat && lng && !localityId) {
      locality = findNearestGwaliorLocality(lat, lng);
      localityId = locality.id;
    } else {
      locality = getLocalityById(localityId || 'city-centre');
      localityId = locality.id;
    }

    const items = searchGroceryCatalog({
      query: q,
      category,
      localityId,
    });

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
