import { Suspense } from 'react';
import ProductCompareView from '@/components/ProductCompareView';
import { API_BASE_URL, SITE_URL } from '@/lib/config';

export const metadata = {
  title: 'Compare Electronics, Mobiles & TVs Side-by-Side | ShoppersDeals',
  description:
    'Compare technical specifications, camera benchmarks, battery life, processors, and live multi-store prices for 2 to 4 smartphones, 4K TVs, laptops, and electronics.',
  alternates: { canonical: `${SITE_URL}/compare` },
  openGraph: {
    title: 'Compare Electronics, Mobiles & TVs Side-by-Side | ShoppersDeals',
    description:
      'Compare technical specifications, camera benchmarks, battery life, processors, and live multi-store prices for 2 to 4 smartphones, 4K TVs, laptops, and electronics.',
    url: `${SITE_URL}/compare`,
  },
};

async function fetchProductsByIds(idString) {
  if (!idString) return [];
  const ids = idString.split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return [];

  const promises = ids.slice(0, 4).map(async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/products/${id}`, {
        next: { revalidate: 60 },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.success ? (data.data || data.product) : (data.product || data);
    } catch {
      return null;
    }
  });

  const results = await Promise.all(promises);
  return results.filter(Boolean);
}

export default async function ComparePage({ searchParams }) {
  const params = await searchParams;
  const ids = params?.ids || params?.pids || '';
  const initialProducts = await fetchProductsByIds(ids);

  return (
    <main className="min-h-screen bg-[#faf8ff] pb-20 pt-4">
      <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-16 text-center text-sm font-bold text-gray-500">Loading comparison matrix...</div>}>
        <ProductCompareView initialProducts={initialProducts} />
      </Suspense>
    </main>
  );
}
