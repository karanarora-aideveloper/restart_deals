import Link from 'next/link';

export const metadata = { title: 'Page Not Found' };

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-20 text-center">
      <h1 className="mb-3 text-2xl font-extrabold text-[#111827]">Page Not Found</h1>
      <p className="mb-6 max-w-sm text-sm text-[#6b7280]">
        The page or deal you&apos;re looking for doesn&apos;t exist or may have expired.
      </p>
      <Link href="/" className="rounded-lg bg-[#111827] px-6 py-3 text-sm font-semibold text-white">
        Go to Live Deals
      </Link>
    </div>
  );
}
