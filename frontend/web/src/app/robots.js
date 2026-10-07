import { SITE_URL } from '@/lib/config';

export default function robots() {
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
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
