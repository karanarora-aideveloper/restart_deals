# ShoppersDeals Chrome Extension (Manifest V3)

> Production-ready, privacy-respecting browser extension for authentic 365-day price history graphs, lowest price detection, 1-click wishlist tracking, auto-checkout coupons, dark-store grocery price comparison, and real-time price drop alerts across major Indian e-commerce platforms.

---

## 🚀 Features & Benchmark Parity (vs. Buyhatke)

1. **In-Page Floating Widget & 365-Day Price History (Shadow DOM)**
   - Injects seamlessly on Amazon India, Amazon US, Flipkart, Myntra, Nykaa, Ajio, Croma, Shopsy, and Meesho.
   - Shows authoritative lowest tracked price badge ("All-Time Low", "Great Deal", "Price Inflated").
   - **'Buy Now vs. Wait' Drop Probability Engine**: Statistical drop probability % and deal verdict score.
   - Expands into an interactive, zero-dependency SVG price history chart with 90d/180d/365d ranges.
   - Cross-store comparison ("Available on Flipkart for ₹X cheaper" with 1-click store switcher).
   - 1-click price drop alert subscription (Telegram bot or email/phone).

2. **1-Click Wishlist Importer (`wishlistImporter.js`)**
   - Automatically detects Amazon, Flipkart, and Myntra wishlist pages (`/hz/wishlist/ls/...`, `/wishlist`).
   - Injects a floating sticky button showing the total detected items on the page.
   - 1 click extracts all ASINs/PIDs and bulk-tracks them via `POST /api/products/wishlist-import`, hydrating 365-day price history and automatically arming price drop alerts.

3. **Auto-Coupon Runner at Checkout (`couponRunner.js`)**
   - Detects `/cart` and `/checkout` pages on supported platforms.
   - Injects a floating coupon pill showing verified active promo codes.
   - 1-click auto-applies and copies the best discount code into the merchant's promo input box.

4. **Multi-Tab Popup UI (`popup.html`)**
   - **📈 Tracker Tab**: Detects active tab product or allows pasting any store URL for instant price verification.
   - **🔥 Drops Tab**: Real-time stream of verified price drops with instant category filters (Electronics, Fashion, Beauty, Home, Grocery).
   - **🛒 Quick Grocery Tab**: Instant dark-store price comparison across Blinkit, Zepto, and Instamart.
   - **🔔 Tracked Items Tab**: View all imported wishlist products and active price alerts with live vs target pricing.

5. **Privacy-First Architecture**
   - **No `<all_urls>` permission** — strictly scoped host permissions.
   - Zero browsing history tracking; pure client-side DOM parsing.

---

## 📁 Directory Structure

```
extension/
├── manifest.json              # Manifest V3 specification (v1.1.0)
├── background.js              # Service Worker (lifecycle, badge counter, alarms)
├── content/
│   ├── content.js             # Content script (detects PDPs and SPA page transitions)
│   ├── injector.js            # Shadow DOM isolated widget & price graph renderer
│   ├── wishlistImporter.js    # 1-Click Amazon & Flipkart Wishlist bulk tracker
│   ├── couponRunner.js        # Checkout & cart auto-coupon finder & auto-filler
│   └── styles.css             # Scoped stylesheet for in-page elements
├── popup/
│   ├── popup.html             # Multi-tab toolbar popup interface (Tracker, Drops, Grocery, Wishlist)
│   ├── popup.css              # Popup styling & responsive tab layouts
│   └── popup.js               # Tab switching, dark-store compare & tracked wishlist logic
├── utils/
│   ├── api.js                 # ShoppersDeals REST API client (batch tracking, coupons, grocery)
│   ├── parser.js              # Store URL & DOM extractor (Amazon, Flipkart, Nykaa, Croma, Shopsy, Meesho, etc.)
│   └── chart.js               # Pure SVG interactive price history chart & analytics generator
├── icons/                     # 16x16, 32x32, 48x48, 128x128 icons
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-128.png
├── scripts/
│   └── generate_icons.py      # Icon generator script
├── CHROMEWEBSTORE.md          # Chrome Web Store submission & compliance documentation
└── README.md                  # This file
```

---

## 🛠️ How to Install and Test Locally in Chrome / Edge / Brave

1. Open **Google Chrome** (or Edge / Brave).
2. Navigate to `chrome://extensions/` in your address bar.
3. Toggle on **Developer mode** in the top-right corner.
4. Click **Load unpacked** in the top-left toolbar.
5. Select the folder:
   ```
   /Users/karanarora/mystartups/restart_deals/extension
   ```
6. The extension **ShoppersDeals: Price History & Tracker** (v1.1.0) will immediately appear in your extensions list!
7. Pin the extension to your browser toolbar.

### Testing Features:
- **Price History**: Open any product on [Amazon.in](https://www.amazon.in) or [Flipkart.com](https://www.flipkart.com). The floating pill appears with lowest price & verdict.
- **Wishlist 1-Click Track**: Open your Amazon Wishlist. The floating `[🔔 Track Wishlist]` pill appears. Click it to bulk-track all items!
- **Auto Coupons**: Open Amazon Cart or Flipkart Cart. The `[🏷️ Coupons]` pill appears. Click to review and auto-apply codes!
- **Grocery Compare**: Click the extension icon in the toolbar, select the `🛒 Grocery` tab, and type any item (e.g. "Milk" or "Butter") to compare Blinkit, Zepto, and Instamart prices.
