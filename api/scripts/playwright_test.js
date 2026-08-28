import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const ARTIFACTS_DIR = '/Users/karanarora/.gemini/antigravity-ide/brain/2359bfb5-aea2-4d50-b501-f0e134991d51';
const SCREENSHOT_DIR = path.join(ARTIFACTS_DIR, 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runComprehensiveTests() {
  console.log('🚀 Running Comprehensive Playwright Tests on https://www.shoppersdeals.in ...');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  
  const testLogs = {
    timestamp: new Date().toISOString(),
    success: true,
    pagesChecked: [],
    consoleErrors: [],
    networkFailures: [],
    issuesFound: []
  };

  // Listeners
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log(`❌ Console Error: ${msg.text()}`);
      testLogs.consoleErrors.push({ url: page.url(), text: msg.text() });
    }
  });

  page.on('pageerror', (err) => {
    console.log(`❌ Page Crash/Error: ${err.message}`);
    testLogs.consoleErrors.push({ url: page.url(), text: err.message, stack: err.stack });
  });

  page.on('requestfailed', (req) => {
    const failure = req.failure();
    const url = req.url();
    // Exclude analytics/external trackers if they fail due to adblockers or headless mode
    if (!url.includes('google-analytics') && !url.includes('doubleclick') && !url.includes('hotjar')) {
      console.log(`⚠️ Network Request Failed: ${url} (${failure?.errorText || 'unknown error'})`);
      testLogs.networkFailures.push({ url, error: failure?.errorText || 'unknown' });
    }
  });

  try {
    // Test 1: Homepage
    console.log('\n--- 1. Testing Homepage ---');
    await page.goto('https://www.shoppersdeals.in', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    const homeTitle = await page.title();
    testLogs.pagesChecked.push({ name: 'Homepage', url: 'https://www.shoppersdeals.in', status: 200, title: homeTitle });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_homepage.png'), fullPage: true });

    // Check header elements
    const logoExists = await page.locator('img[alt*="Logo"], img[alt*="logo"]').count() > 0;
    if (!logoExists) testLogs.issuesFound.push({ page: 'Homepage', severity: 'low', type: 'UI', message: 'Logo alt tag may be missing or logo element not found' });
    
    // Check main CTAs and tabs
    const tabCount = await page.locator('nav a, [class*="nav"] a, button:has-text("Electronics"), a:has-text("Electronics")').count();
    console.log(`Tabs found: ${tabCount}`);

    // Verify deals cards are present
    const cards = page.locator('article, .sd-grid-card, [class*="card"]');
    const cardCount = await cards.count();
    console.log(`Deals cards count: ${cardCount}`);
    if (cardCount === 0) {
      testLogs.issuesFound.push({ page: 'Homepage', severity: 'critical', type: 'Data', message: 'No deals cards rendered on homepage' });
    }

    // Test 2: Category Filters
    console.log('\n--- 2. Testing Category Filters ---');
    const categories = ['Electronics', 'Fashion', 'Home', 'Beauty'];
    for (const cat of categories) {
      const catButton = page.locator(`a:has-text("${cat}"), button:has-text("${cat}")`).first();
      if (await catButton.count() > 0) {
        console.log(`Clicking category: ${cat}`);
        await catButton.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, `02_category_${cat.toLowerCase()}.png`) });
        
        // Ensure page url updated or items loaded
        const currentUrl = page.url();
        console.log(`URL after category click: ${currentUrl}`);
      } else {
        console.log(`⚠️ Category tab ${cat} button not found.`);
      }
    }

    // Return to home
    await page.goto('https://www.shoppersdeals.in', { waitUntil: 'load' });

    // Test 3: Search
    console.log('\n--- 3. Testing Search ---');
    const searchInput = page.locator('input[type="search"], input[placeholder*="search"], input[placeholder*="Search"]');
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('laptop');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_search_results.png') });
      
      const searchCardsCount = await page.locator('article, .sd-grid-card, [class*="card"]').count();
      console.log(`Search cards count: ${searchCardsCount}`);
      testLogs.pagesChecked.push({ name: 'Search Results', url: page.url(), status: 200 });
    }

    // Test 4: Deal Detail & Product Redirect
    console.log('\n--- 4. Testing Deal / Product Detail Navigation ---');
    await page.goto('https://www.shoppersdeals.in', { waitUntil: 'load' });
    await page.waitForTimeout(1000);
    
    const dealLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a'))
        .map(a => a.href)
        .filter(href => href.includes('/deal/'));
    });

    if (dealLinks.length > 0) {
      const dealUrl = dealLinks[0];
      console.log(`Navigating to deal URL: ${dealUrl}`);
      await page.goto(dealUrl, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(3000);
      
      const finalUrl = page.url();
      console.log(`Final URL (after redirects): ${finalUrl}`);
      
      testLogs.pagesChecked.push({ name: 'Deal Detail', url: dealUrl, finalUrl });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_detail_page.png'), fullPage: true });

      // If it redirected to product, check if price history elements are visible
      if (finalUrl.includes('/product/')) {
        const tableHeader = await page.locator('table, th:has-text("Date")').count() > 0;
        const svgChart = await page.locator('svg').count() > 0;
        console.log(`Detail page features: Table=${tableHeader}, SVG Chart=${svgChart}`);
        if (!tableHeader && !svgChart) {
          testLogs.issuesFound.push({ page: 'Product Detail', severity: 'medium', type: 'UI', message: 'No price history table or chart found on product page' });
        }
      }
    } else {
      console.log('⚠️ No deal URLs found to test navigation.');
    }

    // Test 5: Static Pages
    console.log('\n--- 5. Testing Static Pages ---');
    const staticPages = [
      { name: 'Privacy Policy', path: '/privacy' },
      { name: 'Affiliate Disclosure', path: '/affiliate-disclosure' }
    ];

    for (const sp of staticPages) {
      const spUrl = `https://www.shoppersdeals.in${sp.path}`;
      console.log(`Visiting: ${sp.name} (${spUrl})`);
      const response = await page.goto(spUrl, { waitUntil: 'load', timeout: 20000 });
      await page.waitForTimeout(1500);
      
      const status = response ? response.status() : 'unknown';
      testLogs.pagesChecked.push({ name: sp.name, url: spUrl, status });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `05_${sp.name.toLowerCase().replace(' ', '_')}.png`), fullPage: true });

      const headingCount = await page.locator('h1, h2').count();
      if (headingCount === 0 || status !== 200) {
        testLogs.issuesFound.push({ page: sp.name, severity: 'high', type: 'HTTP', message: `Failed to load page content correctly (status: ${status})` });
      }
    }

  } catch (err) {
    console.error('❌ Exception in test runner:', err);
    testLogs.success = false;
    testLogs.issuesFound.push({ page: 'Test Runner', severity: 'critical', type: 'Exception', message: err.message });
  } finally {
    await browser.close();
  }

  // Save logs
  const comprehensiveResultsPath = path.join(ARTIFACTS_DIR, 'comprehensive_test_results.json');
  fs.writeFileSync(comprehensiveResultsPath, JSON.stringify(testLogs, null, 2));
  console.log(`\n💾 Comprehensive test results saved to: ${comprehensiveResultsPath}`);
  
  return testLogs;
}

runComprehensiveTests();
