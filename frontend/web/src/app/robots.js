import { SITE_URL, getBaseUrl } from '@/lib/config';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function robots() {
  let baseUrl = SITE_URL;
  try {
    const headerList = await headers();
    const host = headerList.get('x-site-host') || headerList.get('x-forwarded-host') || headerList.get('host') || '';
    baseUrl = getBaseUrl(host);
  } catch (_) {}

  const bots = [
    'GPTBot',
    'OAI-SearchBot',
    'ClaudeBot',
    'Anthropic-ai',
    'PerplexityBot',
    'Google-Extended',
    'Applebot-Extended',
    'Meta-ExternalAgent',
    'Amazonbot',
    'FacebookBot',
    'CCBot',
    'cohere-ai',
  ];

  return {
    rules: [
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/saved', '/profile', '/delete-account', '/api/', '/r/'],
      },
      {
        userAgent: 'Bingbot',
        allow: '/',
        disallow: ['/saved', '/profile', '/delete-account', '/api/', '/r/'],
      },
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/saved',
          '/profile',
          '/delete-account',
          '/api/',
          '/r/',
          '/*?*sort=*',
          '/*?*filter=*',
        ],
      },
      ...bots.map((userAgent) => ({ userAgent, allow: '/' })),
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
