import { NextResponse } from 'next/server';
import { directFetchDeals } from '@/lib/dbFallback';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '24', 10);
    const category = searchParams.get('category') || 'all';
    const merchant = searchParams.get('merchant') || 'all';
    const country = searchParams.get('country') || 'in';
    const minDiscount = parseInt(searchParams.get('minDiscount') || '0', 10);
    const sort = searchParams.get('sort') || 'newest';

    const deals = await directFetchDeals({
      page,
      limit,
      category,
      merchant,
      country,
      minDiscount,
      sort,
    });

    const total = deals.length >= limit ? page * limit + 1 : (page - 1) * limit + deals.length;
    const pages = deals.length >= limit ? page + 1 : page;

    return NextResponse.json({
      success: true,
      data: deals,
      deals,
      pagination: {
        page,
        limit,
        total,
        pages,
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (err) {
    console.error('[/api/deals route error]:', err);
    return NextResponse.json(
      { success: false, error: err.message, data: [], deals: [] },
      { status: 500 }
    );
  }
}
