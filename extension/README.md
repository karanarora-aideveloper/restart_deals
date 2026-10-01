# ShoppersDeals Chrome Extension (Manifest V3)

> Production-ready, privacy-respecting browser extension for authentic price history graphs, lowest price detection, cross-store comparison, and price drop alerts across major Indian e-commerce platforms.

---

## 🚀 Features

1. **In-Page Floating Widget & Price Graph (Shadow DOM)**
   - Injects seamlessly on Amazon India, Flipkart, Myntra, Nykaa, and Ajio product pages.
   - Shows lowest tracked price badge ("All-Time Low", "Great Deal", "Price Inflated").
   - Expands into an interactive, zero-dependency SVG price history chart.
   - Cross-store comparison ("Available on Flipkart for ₹X cheaper").
   - 1-click price drop alert subscription (Telegram bot or email/phone).

2. **Extension Popup UI**
   - Automatically detects current active tab product.
   - URL search bar: paste any Amazon or Flipkart URL to instantly query price history.
   - Live stream of verified trending price drops across India.
   - One-click launch to `@ShoppersDealsAlertBot` on Telegram.

3. **Privacy-First Architecture**
   - **No `<all_urls>` permission** — only runs on explicit supported store domains.
   - Pure client-side parsing; zero browsing history tracking.

---

## 📁 Directory Structure

```
extension/
├── manifest.json              # Manifest V3 specification
├── background.js              # Service Worker (lifecycle, alarms, badge updates)
├── content/
│   ├── content.js             # Content script (detects PDPs and SPA page transitions)
│   ├── injector.js            # Shadow DOM isolated widget renderer
│   └── styles.css             # Scoped stylesheet for in-page elements
├── popup/
│   ├── popup.html             # Toolbar popup interface
│   ├── popup.css              # Popup styling
│   └── popup.js               # Tab detection, deal feed & search logic
├── utils/
│   ├── api.js                 # ShoppersDeals REST API client
│   ├── parser.js              # Store URL & DOM extractor (Amazon, Flipkart, etc.)
│   └── chart.js               # Pure SVG interactive price history chart generator
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
6. The extension **ShoppersDeals: Price History & Tracker** will immediately appear in your extensions list!
7. Pin the extension to your browser toolbar.

### Testing In-Page Price Tracker:
1. Open any product on [Amazon.in](https://www.amazon.in) (e.g. any smartphone, headphone, or laptop).
2. Look at the bottom-right corner of the page: the floating ShoppersDeals pill appears showing the lowest price.
3. Click the pill: the price history chart, verdict, stats, and alert box expand smoothly.
4. Open the extension popup from the toolbar to inspect active tab stats or paste product links.

---

## 🌐 Backend API Configuration

The extension connects by default to:
- Production: `https://api.shoppersdeals.in`
- Local Development Fallback: `http://localhost:5001`
