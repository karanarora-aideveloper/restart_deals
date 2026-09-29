const targetApi = (process.env.NEXT_PUBLIC_API_URL || 'https://api.shoppersdeals.in').replace(/\/+$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${targetApi}/api/:path*`,
      },
      {
        source: '/crawler/:path*',
        destination: `${targetApi}/crawler/:path*`,
      },
    ];
  },
};

export default nextConfig;
