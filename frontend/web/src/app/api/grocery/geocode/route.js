import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GEO_CACHE = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const isReverse = searchParams.get('reverse') === '1';
    const q = (searchParams.get('q') || '').trim();
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');

    // 1. Reverse Geocode (GPS -> Address)
    if (isReverse && lat && lng) {
      const cacheKey = `rev:${lat.toFixed(4)}:${lng.toFixed(4)}`;
      const cached = GEO_CACHE.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return NextResponse.json(cached.data);
      }

      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'ShoppersDeals/1.0 (contact@shoppersdeals.in)',
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        return NextResponse.json({
          success: true,
          localityName: `Doorstep GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
          city: 'Your City',
          pincode: '',
          lat,
          lng,
        });
      }

      const data = await res.json();
      const addr = data.address || {};
      const neighborhood =
        addr.suburb ||
        addr.neighbourhood ||
        addr.residential ||
        addr.road ||
        addr.city_district ||
        addr.county;
      const city = addr.city || addr.town || addr.state_district || 'Your City';
      const localityName = neighborhood ? `${neighborhood}, ${city}` : city;

      const result = {
        success: true,
        localityName,
        city,
        pincode: addr.postcode || '',
        displayAddress: data.display_name || localityName,
        lat,
        lng,
      };

      GEO_CACHE.set(cacheKey, { timestamp: Date.now(), data: result });
      return NextResponse.json(result);
    }

    // 2. Address / Locality Autocomplete Search (Query -> Coordinates)
    if (q) {
      const cacheKey = `search:${q.toLowerCase()}`;
      const cached = GEO_CACHE.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return NextResponse.json(cached.data);
      }

      const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&q=${encodeURIComponent(
        q
      )}&limit=6`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'ShoppersDeals/1.0 (contact@shoppersdeals.in)',
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        return NextResponse.json({ success: true, suggestions: [] });
      }

      const raw = await res.json();
      if (!Array.isArray(raw)) {
        return NextResponse.json({ success: true, suggestions: [] });
      }

      const suggestions = raw.map((item) => {
        const parts = (item.display_name || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const label = parts.slice(0, 3).join(', ');
        return {
          label: label || item.display_name,
          fullAddress: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        };
      });

      const result = { success: true, suggestions };
      GEO_CACHE.set(cacheKey, { timestamp: Date.now(), data: result });
      return NextResponse.json(result);
    }

    return NextResponse.json({ success: false, error: 'Missing query or coordinates' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
