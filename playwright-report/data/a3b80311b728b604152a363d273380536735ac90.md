# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: shoppersdeals.spec.js >> ShoppersDeals E2E Website Tests >> Deal detail navigation should resolve and load detail view
- Location: tests/shoppersdeals.spec.js:71:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('a:has-text("Get Deal"), a:has-text("View on")').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('a:has-text("Get Deal"), a:has-text("View on")').first()

```

```yaml
- banner:
  - paragraph: ⚡ LIVE DEALS · Amazon · Flipkart · Myntra — refreshed every few seconds
  - link "ShoppersDeals Logo ShoppersDeals":
    - /url: /
    - img "ShoppersDeals Logo"
    - text: ShoppersDeals
  - navigation "Primary":
    - link "Live Feed":
      - /url: /
    - link "Hot Deals":
      - /url: /hot
    - link "Track Prices":
      - /url: /products
    - link "Categories":
      - /url: /categories
  - searchbox "Search deals"
  - link "Wishlist":
    - /url: /saved
    - img
    - text: Wishlist
  - link "Sign In":
    - /url: /profile
    - img
    - text: Sign In
  - link "🔥 Live Deals":
    - /url: /
  - link "📱 Mobiles & Tech":
    - /url: /?category=electronics
  - link "👗 Fashion Loot":
    - /url: /?category=fashion
  - link "🏠 Home & Kitchen":
    - /url: /?category=home
  - link "💄 Beauty & Care":
    - /url: /?category=beauty
  - link "⚡ 50%+ Drops":
    - /url: /hot
  - link "📊 Price Tracker":
    - /url: /products
  - link "❤️ Wishlist & Alerts":
    - /url: /saved
- main:
  - link "Back to Price Tracker":
    - /url: /products
    - img
    - text: Back to Price Tracker
  - text: electronics / amazon
  - main:
    - text: 🔥 JUST DROPPED • 85% OFF
    - img "Amazon"
    - img "Tygot T-M1 Auxiliary Omnidirectional Lavalier Clip On Collar Microphone for Mobile Phone, Camera with 6M Audio Cable, 3.5 MM TRRS Plug and 6.35 MM Adapter (Black)"
    - text: 🔥 All-Time Low! Buy Now
    - paragraph: Price is at its lowest recorded level (₹299). Great time to buy!
    - text: Current Price
    - paragraph: ₹299
    - text: 🟢 Lowest Ever
    - paragraph: ₹299
    - paragraph: 22 Aug
    - text: 🔴 Highest Price
    - paragraph: ₹299
    - paragraph: 22 Aug
    - text: 🟡 Average Price
    - paragraph: ₹299
    - heading "Price Trend & History" [level=3]
    - text: Live Tracker
    - button "1M"
    - button "3M"
    - button "6M"
    - button "ALL"
    - img: ₹344 ₹299 ₹254 22 Aug 2026 23 Aug 2026
    - text: 📅 23 Aug 2026 05:06 pm ₹299 ₹1,999 🟢 All-Time Lowest Price 👆 Hover/drag over the graph to inspect exact date and historical price 🕒 24-Hour Continuous Refresh Active
    - heading "📋 Product Highlights & Details" [level=3]
    - text: ✓
    - strong: "Tracked Merchant:"
    - img "Amazon"
    - text: ✓
    - strong: "Category:"
    - text: electronics ✓
    - strong: "Price Verification:"
    - text: Continuous 24h scraping schedule active
    - heading "Frequently Asked Questions" [level=3]
    - paragraph: Everything you need to know about price tracking and smart shopping
    - button "How accurate is the price history for Tygot T-M1 Auxiliary Omnidirectional Lavalier Clip On Collar Microphone for Mobile Phone, Camera with 6M Audio Cable, 3.5 MM TRRS Plug and 6.35 MM Adapter (Black)? −"
    - text: Our automated scrapers and Telegram verifiers track live price updates from Amazon multiple times daily. The graph captures real recorded sale prices, deal drops, and MRP strike-through changes.
    - button "How do I know if a deal on Amazon is genuine? +"
    - button "How do WhatsApp and Email price drop alerts work? +"
    - button "Can I track products from other stores like Flipkart or Myntra? +"
    - text: electronics
    - img "Amazon"
    - heading "Tygot T-M1 Auxiliary Omnidirectional Lavalier Clip On Collar Microphone for Mobile Phone, Camera with 6M Audio Cable, 3.5 MM TRRS Plug and 6.35 MM Adapter (Black)" [level=1]
    - text: ₹299 ₹1,999 85% OFF
    - paragraph: 🎉 You save ₹1,700 off the MRP!
    - text: Live Verified on
    - img "Amazon"
    - text: (17h ago)
    - button "⚡ Re-check Live Price"
    - link "Buy on Amazon at ₹299":
      - /url: https://www.amazon.in/dp/B09B3P85GV?tag=shoppersdea03-21
      - text: Buy on
      - img "Amazon"
      - text: at ₹299
      - img
    - button "🔔 Set Price Alert"
- contentinfo:
  - heading "How We Curate the Best Deals of the Day" [level=2]
  - paragraph: Most deal platforms work the same way - they pull data from an API, put a "SALE" badge on it, and call it a day. That's not how ShoppersDeals operates.
  - paragraph: Our deals of the day go through a two-layer verification process before they ever appear on this page. First, our proprietary price-tracking system - the same engine that monitors price drops in real-time - continuously monitors product prices across major platforms, including Amazon, Flipkart, Myntra, Ajio, and more. The system flags a product only when its current price drops meaningfully below its historical average, not just a marginal dip that barely moves the needle.
  - paragraph: "But data alone isn't enough. Our team at ShoppersDeals manually reviews every flagged deal to verify three things: whether the discount is genuine and not an inflated MRP trick, whether the product is actually in stock at the time of listing, and whether the savings hold up against both the 30-day and 90-day average price - not just what it cost yesterday."
  - paragraph: We also cross-reference with our AI engines and partner deal data to identify where additional savings can be stacked on top of the listed price. This combination of algorithmic tracking and human verification is what separates ShoppersDeals's daily deals from the noise you'll find on every other platform.
  - paragraph: "The result is straightforward: every deal on this page represents a verified, real-time price drop backed by original price research - not a sponsored listing or a promotional badge a brand paid to place here. When we say it's a deal, we've done the homework to prove it."
  - heading "Smart Shopping Guide - Get the Most Out of Daily Deals" [level=3]
  - paragraph: Online shopping involves real financial decisions. And in a market flooded with sale banners and discount badges, knowing how to separate a genuine deal from a marketing gimmick is one of the most valuable skills a shopper can have. Here's what you need to know before hitting "Buy Now."
  - heading "How to Identify Deceptive Discounts" [level=4]
  - paragraph: Not every "70% off" is what it looks like. A well-documented pattern across Indian e-commerce platforms involves inflating a product's MRP before a sale window and then "discounting" it back to its original price. The percentage looks impressive. The actual saving is zero.
  - paragraph: "Here's how to call the bluff every single time:"
  - list:
    - listitem: • Check the price history graph before buying. If a product has been sitting at the "discounted" price for months, it was never really on sale.
    - listitem: • Compare the current price against the 90-day average, not just what it cost yesterday.
    - listitem: • Be skeptical of deals that appear exclusively during major sale events with suspiciously round discount figures, "originally ₹9,999, now ₹4,999" is a classic pattern.
    - listitem: • Look for products where the price has genuinely dropped below its historical floor, that's where real, actionable savings exist.
  - heading "Why Daily Deals Expire Fast - And How to Secure Them" [level=4]
  - paragraph: Genuine price drops attract demand quickly. When a product hits its lowest recorded price, stock clears fast - often within a few hours of the deal going live. This isn't artificial scarcity; it's what happens when a real deal reaches a deal-aware audience.
  - paragraph: "Here's how to stay consistently ahead:"
  - list:
    - listitem: • Check our live feed regularly. You'll get notified the moment the price falls to your target.
    - listitem: • Don't add to the wishlist and wait to act when the alert arrives. Genuine deals don't wait for you.
    - listitem: • Check the deals page early morning, many price drops go live between midnight and 8 AM IST, before broader traffic arrives.
    - listitem: • Always verify stock availability before spending time comparing bank offers or cashback stacking options.
  - heading "Category-Wise Deal Breakdown - Where the Real Savings Are" [level=3]
  - paragraph: Different product categories behave very differently in pricing patterns, discount cycles, and the depth of genuine savings available. Here's how ShoppersDeals approaches each major category on the deals page - and what you should keep in mind when shopping each one.
  - list:
    - listitem:
      - strong: "Electronics:"
      - text: Price tracking delivers the highest return here. Smartphone prices, for instance, tend to drop sharply 2-3 months after a launch as inventory builds and newer models enter the pipeline. In the electronics category, ShoppersDeals prioritizes deals offering at least 20% genuine savings compared to the 3-month average price. For high-value items like laptops, smart TVs, and audio equipment, even a 10-15% real price drop translates to thousands of rupees in actual savings - especially when stacked with a bank offer.
    - listitem:
      - strong: "Fashion and Accessories:"
      - text: Fashion pricing is volatile and moves fast. Discounts on clothing and footwear can swing dramatically within the same week, depending on inventory levels and platform promotions. In this category, we focus on deals where the current price sits below the 30-day average with verified stock. End-of-season clearance events typically offer the deepest and most legitimate cuts in fashion - those get flagged and highlighted prominently on the deals page as they appear.
    - listitem:
      - strong: "Home Essentials & Appliances:"
      - text: Home appliances - air coolers, water purifiers, kitchen gadgets, and storage solutions - tend to see their best prices during festive season sales. Outside of major sale windows, genuine deals in this category are less frequent but more significant when they appear. ShoppersDeals tracks these products daily and flags deals only when the price crosses below its historical floor, not just a marginal dip.
    - listitem:
      - strong: "Grooming & Personal Care:"
      - text: FMCG and personal care products rotate quickly, and deals in this category are best evaluated on a per-unit-price basis. Combo packs and bundle offers often deliver more mathematical value than single-product discounts. ShoppersDeals tracks unit pricing across pack sizes so that the "deal" you see is one that actually makes economic sense - not just one that looks large on the label.
  - 'heading "Average Savings Comparison: Regular Shopping vs. Daily Deals" [level=3]'
  - paragraph: "Here's a data-backed breakdown of what verified daily deals on ShoppersDeals deliver compared to standard untracked online shopping:"
  - table:
    - rowgroup:
      - row "Savings Factor Regular Shopping Daily Deals (ShoppersDeals Verified)":
        - columnheader "Savings Factor"
        - columnheader "Regular Shopping"
        - columnheader "Daily Deals (ShoppersDeals Verified)"
    - rowgroup:
      - row "Avg. Discount on Electronics 5 - 10% 20 - 40%":
        - cell "Avg. Discount on Electronics"
        - cell "5 - 10%"
        - cell "20 - 40%"
      - row "Price Verification None Cross-checked via price history":
        - cell "Price Verification"
        - cell "None"
        - cell "Cross-checked via price history"
      - row "Bank Offers Not tracked Stackable tracked":
        - cell "Bank Offers"
        - cell "Not tracked"
        - cell "Stackable tracked"
      - row "Price History Check Manual effort Automated via ShoppersDeals AI":
        - cell "Price History Check"
        - cell "Manual effort"
        - cell "Automated via ShoppersDeals AI"
      - row "Deal Authenticity Unverified Manually reviewed":
        - cell "Deal Authenticity"
        - cell "Unverified"
        - cell "Manually reviewed"
      - row "Stock Availability Check No Yes - real-time":
        - cell "Stock Availability Check"
        - cell "No"
        - cell "Yes - real-time"
  - paragraph: Savings estimates based on ShoppersDeals historical price tracking data across Amazon, Flipkart, and partner platforms.
  - heading "Frequently Asked Questions" [level=3]
  - paragraph: We heard you. Get reliable, verified answers here.
  - list:
    - listitem:
      - strong: How frequently are deals updated?
      - text: Deals are updated in real-time. Our AI engine scans deals 24/7 and updates the feed instantly.
    - listitem:
      - strong: Are the deals verified?
      - text: Yes. Every deal goes through an automated price-history check and a manual review to ensure it's a genuine price drop.
  - heading "ShoppersDeals" [level=2]
  - paragraph: ShoppersDeals is India's premier live deal tracking platform. We scan Amazon, Flipkart, and Myntra 24/7 to bring you the biggest discounts, lightning deals, and price drops on smartphones, laptops, and fashion before they expire.
  - heading "Explore" [level=3]
  - list:
    - listitem:
      - link "Live Feed":
        - /url: /
    - listitem:
      - link "Hot Deals 🔥":
        - /url: /hot
    - listitem:
      - link "Shopping Guides":
        - /url: /blog
    - listitem:
      - link "Browse Categories":
        - /url: /categories
  - heading "Legal" [level=3]
  - list:
    - listitem:
      - link "Privacy Policy":
        - /url: /privacy
    - listitem:
      - link "Delete Your Account":
        - /url: /delete-account
    - listitem:
      - link "Affiliate Disclosure":
        - /url: /affiliate-disclosure
    - listitem: Terms of Service
    - listitem:
      - link "Support":
        - /url: /support
  - paragraph: © 2026 ShoppersDeals. All rights reserved. As an Amazon Associate we earn from qualifying purchases.
- alert: Tygot T-M1 Auxiliary Omnidirectional Lavalier Clip On Collar Microphone for Mobile Phone, Camera with 6M Audio Cable, 3.5 MM TRRS Plug and 6.35 MM Adapter (Black)
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('ShoppersDeals E2E Website Tests', () => {
  4   |   
  5   |   test.beforeEach(async ({ page }) => {
  6   |     // Navigate to homepage before each test
  7   |     await page.goto('/', { waitUntil: 'load', timeout: 30000 });
  8   |   });
  9   | 
  10  |   test('Homepage elements should render correctly', async ({ page }) => {
  11  |     // Check page title
  12  |     await expect(page).toHaveTitle(/ShoppersDeals/);
  13  | 
  14  |     // Check if the logo is present
  15  |     const logo = page.locator('img[alt*="Logo"], img[alt*="logo"]').first();
  16  |     await expect(logo).toBeVisible();
  17  | 
  18  |     // Check if the page contains deals/product cards
  19  |     const dealCards = page.locator('article, .sd-grid-card, [class*="card"]');
  20  |     const cardCount = await dealCards.count();
  21  |     console.log(`[Test] Total deal cards rendered: ${cardCount}`);
  22  |     expect(cardCount).toBeGreaterThan(0);
  23  | 
  24  |     // Check header/navigation controls
  25  |     const searchBar = page.locator('input[type="search"], input[placeholder*="search"], input[placeholder*="Search"]').first();
  26  |     await expect(searchBar).toBeVisible();
  27  |   });
  28  | 
  29  |   test('Category navigation should update URL', async ({ page }) => {
  30  |     const categories = ['Electronics', 'Fashion', 'Home', 'Beauty'];
  31  |     
  32  |     for (const cat of categories) {
  33  |       // Find category link/button
  34  |       const catBtn = page.locator(`a:has-text("${cat}"), button:has-text("${cat}")`).first();
  35  |       
  36  |       if (await catBtn.count() > 0) {
  37  |         await catBtn.click();
  38  |         await page.waitForTimeout(1000);
  39  |         
  40  |         // Assert that the URL query param contains the category name or filters it
  41  |         const currentUrl = page.url();
  42  |         console.log(`[Test] Navigated to category ${cat}: ${currentUrl}`);
  43  |         
  44  |         if (cat === 'Fashion') {
  45  |           // Fashion tab might link to men-fashion or women-fashion
  46  |           expect(currentUrl).toContain('fashion');
  47  |         } else {
  48  |           expect(currentUrl.toLowerCase()).toContain(cat.toLowerCase());
  49  |         }
  50  |       }
  51  |     }
  52  |   });
  53  | 
  54  |   test('Search input should return filtered items', async ({ page }) => {
  55  |     const searchInput = page.locator('input[type="search"], input[placeholder*="search"], input[placeholder*="Search"]').first();
  56  |     await expect(searchInput).toBeVisible();
  57  |     
  58  |     // Type search query
  59  |     await searchInput.fill('laptop');
  60  |     await page.keyboard.press('Enter');
  61  |     await page.waitForTimeout(3000);
  62  | 
  63  |     // Assert URL has the query parameter
  64  |     expect(page.url()).toContain('q=laptop');
  65  | 
  66  |     // Verify search result cards are displayed
  67  |     const cards = page.locator('article, .sd-grid-card, [class*="card"]');
  68  |     expect(await cards.count()).toBeGreaterThan(0);
  69  |   });
  70  | 
  71  |   test('Deal detail navigation should resolve and load detail view', async ({ page }) => {
  72  |     // Find first /deal/ link on the home feed
  73  |     const dealLink = page.locator('a[href*="/deal/"]').first();
  74  |     
  75  |     if (await dealLink.count() > 0) {
  76  |       const dealUrl = await dealLink.getAttribute('href');
  77  |       console.log(`[Test] Tapping deal card: ${dealUrl}`);
  78  |       
  79  |       await dealLink.click();
  80  |       await page.waitForLoadState('load');
  81  |       await page.waitForTimeout(2000);
  82  | 
  83  |       // Verify page loads successfully without a 404 or crash
  84  |       const currentUrl = page.url();
  85  |       expect(currentUrl).not.toContain('404');
  86  |       
  87  |       // Should redirect to a canonical product page if matched, or stay on deal page
  88  |       expect(currentUrl).toMatch(/\/product\/|\/deal\//);
  89  | 
  90  |       // Verify product detail features
  91  |       const buyButton = page.locator('a:has-text("Get Deal"), a:has-text("View on")').first();
> 92  |       await expect(buyButton).toBeVisible();
      |                               ^ Error: expect(locator).toBeVisible() failed
  93  |       
  94  |       // Price History table/chart check
  95  |       const priceHistoryHeader = page.locator(':has-text("Price History"), :has-text("Price Trend")').first();
  96  |       await expect(priceHistoryHeader).toBeVisible();
  97  |     } else {
  98  |       console.log('[Test] No deal links found on homepage to click.');
  99  |     }
  100 |   });
  101 | 
  102 |   test('Static utility pages should load correctly', async ({ page }) => {
  103 |     const pages = ['/privacy', '/affiliate-disclosure'];
  104 |     
  105 |     for (const p of pages) {
  106 |       const response = await page.goto(p);
  107 |       expect(response.status()).toBe(200);
  108 | 
  109 |       const mainHeading = page.locator('h1, h2').first();
  110 |       await expect(mainHeading).toBeVisible();
  111 |       
  112 |       const bodyText = await page.locator('body').textContent();
  113 |       expect(bodyText.length).toBeGreaterThan(500);
  114 |     }
  115 |   });
  116 | 
  117 | });
  118 | 
```