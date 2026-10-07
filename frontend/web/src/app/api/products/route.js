import { NextResponse } from 'next/server';
import { directFetchProducts } from '@/lib/dbFallback';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '40', 10);
    const q = searchParams.get('q') || searchParams.get('search') || '';
    const category = searchParams.get('category') || 'all';
    const subcategory = searchParams.get('subcategory') || 'all';
    const merchant = searchParams.get('merchant') || 'all';
    const country = searchParams.get('country') || 'in';
    const sort = searchParams.get('sort') || 'recently_checked';

    const products = await directFetchProducts({
      page,
      limit,
      q,
      category,
      subcategory,
      merchant,
      country,
      sort,
    });

    const total = products.length >= limit ? page * limit + 1 : (page - 1) * limit + products.length;
    const pages = products.length >= limit ? page + 1 : page;

    return NextResponse.json({
      success: true,
      data: products,
      products,
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
    console.error('[/api/products route error]:', err);
    return NextResponse.json(
      { success: false, error: err.message, data: [], products: [] },
      { status: 500 }
    );
  }
}
