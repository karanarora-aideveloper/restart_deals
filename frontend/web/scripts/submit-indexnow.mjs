import https from 'https';
import { TOP_CURATED_BEST_SLUGS } from '../src/lib/bestCategories.js';
import { SUBCATEGORY_LABELS, CATEGORY_LABELS } from '../src/lib/taxonomy.js';
import blogsData from '../src/data/blogs.json' with { type: 'json' };

const HOST = 'www.shoppersdeals.in';
const KEY = 'e47c1a89f2504b7db8a36c9214d0f7a5';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

const coreUrls = [
  `https://${HOST}/`,
  `https://${HOST}/hot`,
  `https://${HOST}/products`,
  `https://${HOST}/compare`,
  `https://${HOST}/categories`,
  `https://${HOST}/blog`,
  `https://${HOST}/sitemap`,
];

const categoryUrls = Object.keys(CATEGORY_LABELS).map(cat => `https://${HOST}/categories/${cat}`);

const allBestSlugs = Array.from(new Set([
  ...Object.keys(TOP_CURATED_BEST_SLUGS),
  ...Object.keys(SUBCATEGORY_LABELS)
]));

const bestUrls = allBestSlugs.map(slug => `https://${HOST}/best/${slug}`);

const blogUrls = (blogsData || []).map(b => `https://${HOST}/blog/${b.slug}`);

const allUrls = Array.from(new Set([...coreUrls, ...categoryUrls, ...bestUrls, ...blogUrls]));

console.log(`Submitting ${allUrls.length} high-priority URLs to IndexNow...`);

const payload = JSON.stringify({
  host: HOST,
  key: KEY,
  keyLocation: KEY_LOCATION,
  urlList: allUrls,
});

const req = https.request(
  {
    hostname: 'api.indexnow.org',
    port: 443,
    path: '/indexnow',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
    },
  },
  (res) => {
    let body = '';
    res.on('data', (d) => { body += d; });
    res.on('end', () => {
      console.log(`IndexNow response: HTTP ${res.statusCode} ${res.statusMessage}`);
      if (res.statusCode === 200 || res.statusCode === 202) {
        console.log('✅ URLs successfully submitted to IndexNow (Bing, Yandex, Seznam, Naver)!');
      } else {
        console.log('Response body:', body);
      }
    });
  }
);

req.on('error', (e) => {
  console.error('IndexNow request failed:', e.message);
});

req.write(payload);
req.end();
