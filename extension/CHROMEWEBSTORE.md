# Chrome Web Store Listing — ShoppersDeals: Price History & Tracker

> Last Updated: 2026-10-09

## Store Listing

**Extension Name** [REQUIRED]
ShoppersDeals: Price History & Tracker

**Short Description** [REQUIRED]
Price history graphs, lowest price tracker, 1-click wishlist import, auto-coupons & quick grocery compare for 8+ Indian stores.

**Detailed Description** [REQUIRED]
ShoppersDeals helps you shop smarter in India by revealing authentic price history graphs, alerting you when prices drop to genuine all-time lows, auto-applying verified checkout coupons, and finding dark-store grocery deals.

KEY FEATURES:

• Interactive Price History Graphs: View genuine 365-day historical price checkpoints across Amazon India, Flipkart, Myntra, Nykaa, Ajio, Croma, Shopsy, and Meesho right on the product page.
• 'Buy Now vs. Wait' Drop Probability Engine: Predictive intelligence calculating whether you should buy immediately or wait for an upcoming drop, featuring All-Time Low (ATL) and price inflated warnings.
• 1-Click Wishlist Importer: Open your Amazon or Flipkart wishlist and track all your saved items with one click. Automatically arms price drop alerts so you never miss a bargain.
• Auto-Coupon Finder & Runner: Automatically surfaces verified promo codes at checkout and cart pages for Amazon, Flipkart, Myntra, Nykaa, and Ajio, auto-filling and copying the highest-discount code with one tap.
• Quick Commerce Grocery Compare: Compare instant delivery prices across Blinkit, Zepto, and Instamart side-by-side to always pick the cheapest dark store.
• Cross-Store Price Comparison: See if the identical product is currently available cheaper on alternative stores before you buy.
• One-Click Price Drop Alerts: Set your desired target price and receive instant, free notifications via the ShoppersDeals Telegram Bot (@ShoppersDealsAlertBot), email, or push.
• Zero-Noise Feed: Browse verified, high-discount price drops curated in real time by our automated verification network.

HOW TO USE:

1. Browse any product page on Amazon.in, Flipkart.com, Myntra.com, Nykaa.com, Ajio.com, Croma.com, Shopsy.in, or Meesho.com.
2. The ShoppersDeals floating badge automatically displays the lowest tracked price.
3. Click the badge to expand the full price history graph, statistical breakdown, and cross-store comparison.
4. On Wishlist pages, click "Track All" to bulk-monitor your saved items.
5. On Cart / Checkout pages, click the coupon pill to review and auto-apply verified promo codes.
6. Click the extension icon in your toolbar anytime to search price history, compare grocery items, or discover trending verified deals.

PRIVACY & PERMISSIONS:

Unlike legacy extensions that demand access to all websites you visit, ShoppersDeals operates with strict, minimal host permissions limited exclusively to the specific shopping platforms it supports (Amazon India, Flipkart, Myntra, Nykaa, Ajio, Croma, Shopsy, Meesho). Your browsing on any other website remains completely untouched and private. We never collect personal identification data, payment information, or search history.

SUPPORT & COMMUNITY:

Website: https://shoppersdeals.in
Telegram Alerts Bot: @ShoppersDealsAlertBot
Support Email: support@shoppersdeals.in

**Category** [REQUIRED]
Shopping

**Single Purpose** [REQUIRED]
Tracks authentic price history and notifies shoppers of genuine price drops across major Indian e-commerce stores.

**Primary Language** [REQUIRED]
English

---

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|---|---|---|---|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `icons/icon-128.png` |
| Extension Icon 16 | 16×16 PNG | ✅ Ready | `icons/icon-16.png` |
| Extension Icon 32 | 32×32 PNG | ✅ Ready | `icons/icon-32.png` |
| Extension Icon 48 | 48×48 PNG | ✅ Ready | `icons/icon-48.png` |
| Screenshot 1 [REQUIRED] | 1280×800 | ⬜ Pending | In-page price history graph on Amazon India |
| Screenshot 2 [RECOMMENDED] | 1280×800 | ⬜ Pending | Cross-store comparison on Flipkart |
| Screenshot 3 [RECOMMENDED] | 1280×800 | ⬜ Pending | Extension popup with trending drops, grocery compare & wishlist |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Pending | Brand card with "Never Overpay Again" |
| Marquee Promo Tile | 1400×560 | ⬜ Pending | Feature banner |

---

## Permissions Justification

| Permission | Type | Justification |
|---|---|---|
| `storage` | permissions | Used to locally cache product price lookup responses to minimize network requests and improve page load speed. |
| `alarms` | permissions | Used to run periodic background housekeeping to clear stale local cache checkpoints. |
| `tabs` | permissions | Used to detect if the currently active browser tab is viewing a supported e-commerce product URL to display relevant price history in the popup. |
| `scripting` | permissions | Used by the extension popup to extract live product titles and current prices directly from the active tab. |
| `*://*.amazon.in/*` | host_permissions | Allows the content script to detect Amazon India product detail pages, wishlists, and checkout pages to display the price tracker, wishlist importer, and coupon runner. |
| `*://*.amazon.com/*` | host_permissions | Allows the content script to detect Amazon US product pages for international currency tracking. |
| `*://*.flipkart.com/*` | host_permissions | Allows the content script to detect Flipkart product pages, wishlists, and checkout pages to display price graphs and coupon tools. |
| `*://*.myntra.com/*` | host_permissions | Allows the content script to detect Myntra product detail pages and wishlists to track fashion pricing. |
| `*://*.nykaa.com/*` | host_permissions | Allows the content script to detect Nykaa beauty product pages and cart pages. |
| `*://*.ajio.com/*` | host_permissions | Allows the content script to detect Ajio product detail and checkout pages. |
| `*://*.croma.com/*` | host_permissions | Allows the content script to detect Croma electronics product pages for price tracking. |
| `*://*.shopsy.in/*` | host_permissions | Allows the content script to detect Shopsy budget product listings and verify real discounts. |
| `*://*.meesho.com/*` | host_permissions | Allows the content script to detect Meesho marketplace product pages and track authentic pricing. |
| `https://api.shoppersdeals.in/*` | host_permissions | Connects to the ShoppersDeals API backend to fetch verified price history records, cross-store pricing, and submit price drop alerts. |

---

## Privacy & Data Use

### Data Collection

| Data Type | Collected? | Purpose |
|---|---|---|
| Personally Identifiable Information (PII) | Only email/phone if explicitly entered by user | Used solely for delivering requested price drop notifications. |
| Financial & Payment Information | ❌ No | Never collected or accessed. |
| Health Information | ❌ No | Never collected or accessed. |
| Authentication Information | ❌ No | Extension does not handle passwords or login sessions. |
| Personal Communications | ❌ No | Never collected or accessed. |
| Location | ❌ No | Never collected or accessed. |
| Web Browsing History | ❌ No | Browsing history is not collected or stored. URL checks occur locally and only on matching store domains. |
| User Activity (clicks, scrolling) | ❌ No | In-extension clicks only. |
| Website Content | Store product metadata (ASIN, title, public price) | Extracted publicly to query price history records. |

### Privacy Disclosures

- [x] Does not sell user data to third parties.
- [x] Does not use or transfer user data for purposes unrelated to the extension's single purpose.
- [x] Does not use or transfer user data to determine creditworthiness or for lending purposes.

---

## Version History

| Version | Date | Summary |
|---|---|---|
| 1.1.0 | 2026-10-09 | Major Feature Expansion: Added 1-Click Wishlist Importer for Amazon/Flipkart/Myntra, Auto-Coupon Finder & Runner for checkout pages, Quick Commerce Dark-Store Price Compare (Blinkit vs Zepto vs Instamart), 'Buy Now vs. Wait' Drop Probability Barometer, and expanded store support to Croma, Shopsy & Meesho. |
| 1.0.0 | 2026-10-01 | Initial release: Manifest V3 extension featuring in-page price history graph, floating price pill, cross-store comparison, Telegram price drop alert integration, and popup deals explorer. |
