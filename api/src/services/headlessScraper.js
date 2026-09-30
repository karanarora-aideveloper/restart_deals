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
  console.error(`[Direct Scraping Prohibited] Attempted to scrape ${url?.slice(0, 60)} with local browser. Direct scraping is permanently disabled.`);
  throw new Error('[Direct Scraping Prohibited] Direct headless browser scraping is permanently disabled on this system. All scrapes must route through ScrapingAnt via scraperQueue.');
}
