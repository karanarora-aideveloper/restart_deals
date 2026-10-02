/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silences the "multiple lockfiles" workspace-root inference warning — this app has its own
  // package-lock.json but sits inside the frontend/ repo which has one too.
  turbopack: {
    root: import.meta.dirname,
  },
  images: {
    // Deal/product images come from arbitrary merchant + Telegram-media CDNs that can't be
    // enumerated in advance, so those are rendered with plain <img> instead of next/image.
    // next/image is only used for our own static assets and the blog's Unsplash images.
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  // Permanently redirect bare domain → www to prevent Google from treating them as two
  // separate sites with duplicate content. Both must be configured as domains in Vercel.
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'shoppersdeals.in' }],
        destination: 'https://www.shoppersdeals.in/:path*',
        permanent: true,
      },
      {
        source: '/deals',
        destination: '/',
        permanent: true,
      },
      {
        source: '/deals/:path*',
        destination: '/:path*',
        permanent: true,
      },
      {
        source: '/deal',
        destination: '/',
        permanent: true,
      },
      {
        source: '/product',
        destination: '/products',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/media/telegram/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'https://api.shoppersdeals.in'}/media/telegram/:path*`,
      },
    ];
  },
};

export default nextConfig;
