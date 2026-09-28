import { chromium } from 'playwright';

/**
 * Robust Headless Browser Scraper using Playwright.
 * Completely eliminates unreliable bare HTTP fetches and bypasses merchant anti-bot checks.
 *
 * @param {string} url
 * @param {object} options
 * @returns {Promise<string|null>} Full rendered HTML string or null on failure
 */
export async function scrapeWithHeadlessBrowser(url, options = {}) {
  const timeoutMs = options.timeoutMs || 35000;
  const startTime = Date.now();
  let browser = null;
  let context = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      viewport: { width: 1440, height: 900 },
      locale: 'en-IN',
      timezoneId: 'Asia/Kolkata',
    });

    const page = await context.newPage();

    // Block unnecessary media/font asset downloads to speed up rendering and save memory
    await page.route('**/*.{woff,woff2,ttf,otf}', route => route.abort());

    console.log(`[Headless Scraper] Navigating to ${url.slice(0, 60)}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

    // Staged scrolling to hydrate dynamic React/client-side elements (specs, customer reviews, dynamic images)
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.35)).catch(() => {});
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.75)).catch(() => {});
    await page.waitForTimeout(1000);

    const html = await page.content();
    const durationMs = Date.now() - startTime;
    console.log(`[Headless Scraper] ✓ Page loaded successfully (${(html.length / 1024).toFixed(1)} KB) in ${durationMs}ms`);

    return html;
  } catch (err) {
    console.error(`[Headless Scraper Error] Failed to scrape ${url.slice(0, 60)}:`, err.message);
    return null;
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}
