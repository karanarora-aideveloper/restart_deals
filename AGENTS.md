# AGENTS.md — Master Architecture, Autonomous Agents & System Blueprint
# ShoppersDeals — Automated E-Commerce Price Drop & Distribution Network

> **Status**: Authoritative Master Specification  
> **Last Updated**: September 2026  
> **Target Stores**: Amazon India, Flipkart, Myntra, Nykaa, Ajio, Shopsy, Meesho, Croma  
> **Database Architecture**: MongoDB Atlas Free Tier Optimization (<512MB for 100,000+ users)  
> **Queue Engine**: Redis + BullMQ Distributed Prioritized Queues  

---

## 1. System Vision & Core Mission

ShoppersDeals is an autonomous, high-throughput e-commerce price-drop detection, verification, and multi-channel broadcast network. It solves the fundamental limitation of Indian e-commerce scraping: **scraping 100M+ products continuously is economically and technically impossible.**

To achieve total market coverage with minimal proxy cost, the system deploys **Two Independent Discovery Engines** that feed into a **Single Unified Downstream Distribution Pipeline**.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   INCOMING ENGINES                                     │
│                                                                                        │
│   [ ENGINE 1: Telegram Deal Radar ]             [ ENGINE 2: Top-20 Catalog Watcher ]   │
│   • Reactive / Event-driven                      • Proactive / Scheduled (every 12h)   │
│   • Crowdsourced deal hunting                    • Curated Top 20 per subcategory      │
│   • High velocity, bursty spikes                 • Predictable, steady-state cadence   │
└───────────────────────────┬──────────────────────────────────────────┬─────────────────┘
                            │                                          │
                            ▼                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                             UNIFIED VERIFICATION CORE                                  │
│                                                                                        │
│   • Anti-Detect Rotating-IP Store Scrape (Amazon, Flipkart, Myntra, Ajio, Nykaa)       │
│   • Compare live price strictly against DB history (Never trust channel claims)        │
│   • Category-Wise Dual Threshold: (Drop % >= Min%) OR (Flat Cash Drop >= MinCashFloor) │
│   • Update lastStoreSyncAt and record daily priceHistory checkpoint                    │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        UNIFIED DOWNSTREAM DISTRIBUTION (Shared)                        │
│                                                                                        │
│   ┌───────────────────────────┬───────────────────────────┬────────────────────────┐   │
│   ▼                           ▼                           ▼                        │   │
│   [ 1. Web & Mobile App ]     [ 2. User Price Alerts ]    [ 3. Output Channels ]   │   │
│   • Save to `deals` DB        • Evaluate user alerts      • Enqueue to Redis       │   │
│   • Invalidate API cache      • Send Bot / WebPush alerts • Paced Broadcaster      │   │
│   • Live on shoppersdeals.in  • "Price dropped to ₹X"       - Telegram Broadcast   │   │
│                                                             - Twitter / X          │   │
│                                                             - WhatsApp Channels    │   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The 7 Autonomous Agents & Service Topology

The system is decoupled into 7 specialized, independent agents running across microservices. No agent blocks another; failure of one agent does not interrupt the others.

### Agent 1: `TelegramDealRadarAgent` (Engine 1 — Ingestion & Verification)
- **Runtime**: `backend` (Daemon process)
- **Role**: Listens to monitored third-party Telegram channels via native MTProto sockets (`telegram.js`).
- **Core Rules**:
  - Never trusts incoming message claims (prices, discounts, or MRPs).
  - Enforces **60-Minute Scrape Cache Gate**: if `lastStoreSyncAt < 60 minutes`, skips store scrape, reuses DB data, and responds in $<20$ms.
  - In-flight promise coalescing (`inFlightScrapes`): identical ASINs posted concurrently across channels share 1 single scrape.
  - Logs every message arrival into `deal_channel_events` (`cache_hit` vs `scraped`) to track channel overlap.
  - When verified, pushes deal to Unified Downstream Pipeline.

### Agent 2: `Top20CatalogWatcherAgent` (Engine 2 — Proactive Store Watcher)
- **Runtime**: `api` (Dedicated Cron Runner — `top20PriceWatcher.js`)
- **Role**: Guarantees a strict **12-hour sync cadence** for the Top 20 bestselling products across all ~40 subcategories (~800 core products).
- **Core Rules**:
  - Hybrid curation: Automated weekly bestseller rankings + Admin panel manual pinning (`isPinned: true`).
  - Queries products where `isTop20: true` and `lastStoreSyncAt < 12 hours ago` (or `null`).
  - Paced throughput: 5 products every 3 minutes = ~67 products/hour = easily covers 800 products every 12 hours.
  - Automatically synthesizes an authentic Deal whenever live price drops below tracked price by category thresholds.
  - Pushes synthesized deal to Unified Downstream Pipeline.

### Agent 3: `ScraperFleetAgent` (Distributed Scraper & Token Lease Manager)
- **Runtime**: `scraper-worker` fleet (Horizontally scalable processes — `scraperWorker.js`)
- **Role**: Claims jobs from Redis `scraper-queue`, leases active ScrapingAnt proxy tokens, and executes anti-detect headless rendering.
- **Core Rules**:
  - Priority queue scheduling: `INTERACTIVE` (1) > `TELEGRAM` (2) > `CATALOG_TOP20` (3) > `DAILY_REFRESH` (4).
  - Geolocation Injection: Injects Delhi (`110001`) / Mumbai (`400001`) delivery cookies to force maximum national Prime/Assured stock availability.
  - Zero-Downtime Fallback: If ScrapingAnt tokens are exhausted, immediately routes to local Playwright headless Chromium with desktop user agent and stealth patches.
  - Multi-shade extraction: Extracts all shade SKUs from embedded page JSON in a single scrape.

### Agent 4: `PacedBroadcasterAgent` (Outbound Deal Broadcaster)
- **Runtime**: `backend` (Dedicated Worker on `deal-publish-queue`)
- **Role**: Dispatches verified deals to external distribution channels (Telegram, Twitter/X, WhatsApp).
- **Core Rules**:
  - **60-Second Token-Bucket Pacing**: Enforces minimum 60-second gap between posts per channel to eliminate follower fatigue and avoid Telegram `FLOOD_WAIT` bans.
  - Idempotency & Dedup: Checks `deal.publishedStatus.publishedTo` so no deal is ever double-posted to the same channel.
  - 12-Hour Yo-Yo Pricing Cooldown: Will not re-broadcast the same product at the same price within 12 hours.
  - Trust Gate: Only broadcasts items with rating $\ge 3.8$ stars and $\ge 15$ reviews.

### Agent 5: `PersonalAlertDispatcherAgent` (Personalized Notification Engine)
- **Runtime**: `api` & `backend` (`priceAlertNotifier.js`)
- **Role**: Matches live prices against user subscriptions in `price_alerts`.
- **Core Rules**:
  - Variant & Shade Awareness: Evaluates alerts by specific variant (e.g. *Maybelline Fit Me Shade 128*).
  - Store-Agnostic: Alerts if the target drops on Nykaa OR Amazon OR Flipkart OR Myntra.
  - Instant Delivery: Sends notification via `@ShoppersDealsAlertBot` (Telegram Bot API — 98% open rate, free) and Browser WebPush.

### Agent 6: `VariantAndShadeMatcherAgent` (Beauty & Variant Normalizer)
- **Runtime**: Embedded in Scraper & Verifier (`variantExtractor.js`)
- **Role**: Resolves the parent-variant hierarchy for beauty, fashion, and sizing.
- **Core Rules**:
  - Extracts shade names, SKU IDs, sizes, and stock status.
  - Normalizes unit pricing: calculates **Price per ML** or **Price per Gram** to expose misleading pack-size marketing.
  - Embeds all variants inside the parent `Product` document, keeping MongoDB storage $<4$KB per product.

### Agent 7: `MonetizationAndRedirectAgent` (Universal Link Cloaker & Deep-Linker)
- **Runtime**: `api` (Route: `GET /r/:dealId`)
- **Role**: Monetizes, tracks, and routes outbound clicks.
- **Core Rules**:
  - Strips third-party affiliate tags and cleanly injects ShoppersDeals affiliate tags (`buildAffiliateUrl`).
  - Logs real-time click analytics (channel source, device, timestamp, IP country).
  - **Smart App Deep-Linking**: Bypasses Telegram's in-app webview by issuing native OS intents (`intent://`, `amazon://`, `flipkart://`, `nykaa://`) to open the native mobile app where the shopper is already logged in with saved cards. Increases conversion rates by 300%–500%.

---

## 3. Comprehensive Questions, Answers & Locked Decisions Log

| # | Question / Architectural Problem | Decision & Engineering Solution | Locked Status |
|---|---|---|---|
| **1** | **Top-20 Catalog Population**: Automated crawl vs. manual curation? | **Hybrid Model**: Automated weekly bestseller crawler populates the 20 slots per subcategory; Admin panel allows pinning (`isPinned: true`) specific products that crawlers cannot remove. | **LOCKED** |
| **2** | **Channel Broadcast Pacing**: Blast immediately or pace? | **Paced Queue (60s Delay)**: Verified deals enter `deal-publish-queue`. Broadcaster uses a token-bucket delay of 60 seconds per channel. Website/app gets deals in 0ms; social channels receive an orderly stream. | **LOCKED** |
| **3** | **Price Drop Qualification**: Flat percentage vs. category thresholds? | **Category-Wise Dual Threshold**: Dual rule: `(Drop % >= CategoryMin%) OR (Flat Cash Drop >= MinCashFloor)`. Electronics Mobiles = 3.5% / ₹1,000; Laptops = 4% / ₹1,500; Beauty = 10%–15% / ₹150–₹250; Fashion = 20% / ₹300. | **LOCKED** |
| **4** | **Cross-Engine Synergy**: What happens when an Engine 2 product arrives via Telegram? | **Bidirectional Cache Synergy (`lastStoreSyncAt`)**: If Engine 2 synced $<60$m ago, Telegram serves in $<20$ms with 0 scrapes. If Telegram scrapes a fresh drop, it updates `lastStoreSyncAt`, automatically pushing Engine 2's next sync 12 hours forward. | **LOCKED** |
| **5** | **Yo-Yo Pricing Spam**: Seller bots oscillating prices back and forth? | **12-Hour Cooldown**: System enforces a 12-hour re-broadcast cooldown per channel for the same product at the same price. Drops to a new lower price bypass cooldown. | **LOCKED** |
| **6** | **Rogue Seller Hijacking**: Fake listings (e.g. ₹4,999 iPhone)? | **Prime/Assured Gate + 65% Cap**: Auto-broadcast requires Amazon Prime / Fulfilled by Amazon or Flipkart Assured badge. Drops $>65\%$ in Electronics route to Admin Review Queue. | **LOCKED** |
| **7** | **Variant & Size Traps**: 1kg vs 250g mismatch? | **Child ASIN Pinning & Unit Price**: Engine 2 pins explicit variant child ASINs (`?th=1`). Scrapers normalize price per ml/gram to prevent fake crash hallucinations. | **LOCKED** |
| **8** | **Bank Offers vs. Direct Price**: How to treat card-specific discounts? | **Dual-Price Architecture**: Scrapes both flat checkout price (`dealPrice`) and bank offer price (`bankOfferPrice`), displaying clear badges (e.g. *"₹49,999 with HDFC Cards"*). | **LOCKED** |
| **9** | **Monetization & Redirection**: Direct affiliate links vs cloaker? | **Universal Cloaker (`/r/:dealId?src=tg`) with App Deep-Linking**: Strips competitor tags, injects our tags, logs click attribution, and deep-links into native Amazon/Flipkart/Nykaa apps. | **LOCKED** |
| **10** | **Cross-Store Product Matching**: Matching ASIN to Flipkart PID? | **Automated Model/SKU Extraction with AI Fallback**: Normalizes brand + manufacturer model code (`BT3325/15`), enabling cross-store price comparison badges (*"₹200 cheaper on Flipkart"*). | **LOCKED** |
| **11** | **Lightning Deals & Timers**: Expired deals lingering on feed? | **Proactive Countdown Expiration**: Scraper extracts `lightningDealEndsAt`. System schedules automatic expiration within 120 seconds of timer zero. | **LOCKED** |
| **12** | **MongoDB Atlas Free Tier Optimization (<512MB)**: Document growth? | **Rolling Daily Compaction**: 1 normalized checkpoint per calendar day in `priceHistory`. 365-day rolling window compaction. Embedded `variants` array avoids 40x document explosion. | **LOCKED** |
| **13** | **Nykaa & Makeup Shades**: Managing 30+ shades per lipstick/foundation? | **Single-Scrape Batch Extraction**: Scrapes the embedded JSON state to update all 30 shades in 1 single request. Users track their exact shade (*"Maybelline Shade 128"*). | **LOCKED** |
| **14** | **Pincode Pricing Trap**: Geolocation altering prices & stock? | **Metro Pincode Injection**: Scraper requests inject Delhi (`110001`) / Mumbai (`400001`) cookies, guaranteeing authentic national Prime/Assured pricing. | **LOCKED** |
| **15** | **Personal Price Alert Delivery**: Low open-rate emails? | **Personal Telegram Bot (`@ShoppersDealsAlertBot`) + WebPush**: Free, instant, 98% open-rate delivery directly to user DMs. | **LOCKED** |
| **16** | **Trust & Quality Score**: Protecting followers from junk items? | **Minimum Trust Gate**: Requires $\ge 3.8$ stars and $\ge 15$ reviews for main channel broadcast. Lower-rated items are labeled with budget warning badges on website. | **LOCKED** |
| **17** | **Stock Scarcity & FOMO**: Converting hesitant shoppers? | **Scarcity Badging**: Scraper extracts *"Only X left in stock"* and *"% claimed"* to feature bold urgency tags on posts. | **LOCKED** |
| **18** | **Category Broadcast Balancing**: Traffic hooks vs Cash cows? | **Dynamic User-Driven Mix**: Mix adapts dynamically to user segments and inbound category interest rather than rigid static quotas. | **LOCKED** |
| **19** | **All-Time Low (ATL) Badging**: When to introduce ATL claims? | **1-Year Historical Data Requirement**: ATL claims are strictly deferred until the system has accumulated at least 1 year (or 180+ days) of empirical DB price checkpoints to prevent misleading claims. | **LOCKED** |
| **20** | **Multi-Store Out-of-Stock Failover**: What happens if the deal store goes OOS? | **Smart Switch Redirection**: `/r/:dealId` detects if primary store is out of stock and dynamically redirects clicks to alternative in-stock stores (e.g. Nykaa or Flipkart) to preserve commissions. | **LOCKED** |
| **21** | **Replenishment Cycles**: Consumables retention & LTV? | **Automated Replenishment Nudges**: Tracks estimated depletion dates for consumables (supplements, skincare) to send timely re-order deal alerts via Telegram bot/push. | **LOCKED** |
| **22** | **USA & International Deals Processing**: How to handle foreign stores (Amazon US) without corrupting Indian distribution? | **Strict Locale & Currency Segregation**: Derived from TLD (`amazon.com` → `country: 'US'`, `currency: 'USD'`). Category thresholds convert cash floor at ₹80:$1 (e.g. ₹1000 floor → $12.50). Injects `AMAZON_US_AFFILIATE_TAG`. Broadcaster suppresses non-IN deals if no US channel exists in DB, preventing spamming Indian followers. Engine 2 catalog watcher is scoped exclusively to India for current phase. | **LOCKED** |
| **23** | **Search Term / Listing Batch Scraping**: How to monitor 800+ products with 90% fewer proxy credits? | **Two-Tier Search & Watcher Architecture**: Tier 1 scrapes 40 category bestseller/search query listing pages (Amazon, Nykaa, Myntra), updating 20–30 products per single scrape (~92% credit savings: ~5,400 credits vs ~71,200). Tier 2 triggers an on-demand `INTERACTIVE` PDP scrape ONLY when an item exhibits a qualifying price drop, pulling full bank offers, shade variants, and stock scarcity before broadcasting. | **LOCKED** |
| **24** | **Flipkart Smartphone Spec & Color Normalization Architecture**: How to prevent false drops when comparing different storage/RAM tiers? | **Flipkart Standard Extraction**: Flipkart mobile titles follow `Brand Model (Color, Storage) (RAM RAM)`. `variantExtractor.js` normalizes `storageGb`, `ramGb`, and `color`. Cross-store matching and price drop verifiers strictly compare storage and RAM tiers, completely eliminating false price drops (e.g. comparing 128 GB against a 256 GB baseline). | **LOCKED** |
| **25** | **Nykaa Beauty Shade-Oriented Price Drop & Search Matrix**: Managing extreme shade price disparity in cosmetics? | **Shade & Volume Normalization Matrix**: Nykaa/beauty titles are parsed for exact shade codes/names (`128 Warm Nude`, `NC25`, `01 Brazen Raisin`) and bottle sizes (30ml vs 18ml). Monitored search terms (Fit Me Foundation, SuperStay Matte Ink, MAC Studio Fix, Sugar Smudge Me Not) evaluate drops per shade, ensuring users track and receive alerts for their exact shade. | **LOCKED** |
| **26** | **Search Engine Optimization & Real-Time Intent Mapping**: Maximizing organic search traffic from high-intent shoppers? | **Intent-Driven Metadata & Crawl Graph**: Product title metadata dynamically optimized for buyer intent: `{DisplayTitle} Price History & Drops — Lowest Price ₹{Price} | ShoppersDeals`. Blog system upgraded with markdown link parsing to route crawler equity directly into `/best/mobiles` and category hubs. Stale blog headings aligned to unblock GSC indexing. | **LOCKED** |
| **27** | **Zero-Discount Deal Suppression & Feed Authenticity**: How to prevent non-discounted products from cluttering the deals feed? | **Strict Discount Gate**: Deals require `discountPercentage > 0` to be marked `isVerified: true` and enqueued for broadcast. Non-discounted items update `products` collection price history but are never created as active deals. Compacted 6,400+ historical 0% records. | **LOCKED** |
| **28** | **Google Rich Snippets & Programmatic Category Hubs**: Maximizing organic search CTR? | **Schema.org Product Stars & Curated Hubs**: Embedded `aggregateRating`, `brand`, `sku`, and `priceValidUntil` in JSON-LD on all product pages for Google star badges. Expanded `/best` programmatic directory with high-intent `/best/mobiles` (targeting "best phones under 20000"), `/best/makeup`, and `/best/gym-equipment`. | **LOCKED** |
| **29** | **Product Internal Link Crawl Graph & Orphan Page Elimination**: Why are only ~4 pages showing on Google `site:` search when sitemap has 7,325 URLs? | **Spider Web Interconnection**: Googlebot prioritizes pages discovered via HTML links over sitemap-only URLs. Because `/products` uses client-side infinite scroll, 7,300+ pages were orphan dead ends. Added a server-rendered "Similar Tracked Products & Price Drops" crawl grid to every product page (linking to 6 peer items in the subcategory with native `<a href="/product/:id">` links). Deployed to Vercel production and re-submitted sitemap to GSC. | **LOCKED** |
| **30** | **Admin Portal Operation & Store Search Seed Architecture**: How to inspect and control all scraping engines and search query seeds? | **Local Admin Next.js App (`http://localhost:3002`)**: Mounted in `admin/`, backed by production API via `x-admin-key`. Exposes live scraping telemetry for all 4 engines (`TelegramDealRadar`, `Top20CatalogWatcher`, `BestsellerCategoryCrawler`, and `Interactive/DailyRefresher`). Maintains 53 subcategory keyword seeds in `crawler_seeds` for Amazon with automated discovery and Top-N upserting. Store expansion roadmap defines Flipkart/Nykaa/Myntra query parsers. | **LOCKED** |
| **31** | **Playwright Linux Container Resilience & ScrapingAnt Token Pool Autorecovery**: What happens when ScrapingAnt tokens are exhausted and Playwright crashes in Linux containers? | **Nixpacks OS Dependencies & Automated Token Provisioning**: Added `nixpacks.toml` specifying Debian `aptPkgs` (`libglib2.0-0`, `libnss3`, `libatk`, etc.) and `postinstall` browser installations across `api` and `backend` so Playwright fallback never crashes on Linux. Disabled Mongoose `versionKey` and optimistic concurrency on `Product` to eliminate concurrency save collisions between engines. Added background automated token replenishment via 2Captcha solver, maintaining $\ge 8$ active tokens (80,000+ credits) in MongoDB Atlas. | **LOCKED** |
| **32** | **Zero Direct Scraping Enforcement & Autonomous Token Pool Replenishment**: Direct IP scraping / local headless browser fallback risks IP bans and merchant blocks? | **Strict 100% ScrapingAnt Proxy & Autonomous Replenishment**: Direct scraping and local headless browser scraping are permanently disabled across all services (`verifier.js`, `scraperWorker.js`, and `headlessScraper.js`). 100% of merchant fetches route exclusively through ScrapingAnt proxy tokens via BullMQ queue. A background token replenisher daemon monitors pool health every 30 minutes and reactively triggers autonomous generation via 2Captcha whenever active tokens fall below 5, maintaining a safe pool of 8+ active tokens (~80,000+ credits) in MongoDB Atlas with zero human intervention. Jobs without an immediately available token retry via BullMQ backoff rather than falling back to direct IP scraping. | **LOCKED** |

---

## 4. Category-Wise Price Drop Threshold Matrix

$$\text{Qualifies as Deal} = (\text{Drop \%} \ge \text{Min Category \%}) \quad \mathbf{OR} \quad (\text{Flat Cash Drop} \ge \text{Min Cash Floor})$$

Stored in `category_threshold_configs` collection and implemented in `src/utils/categoryThresholds.js`:

```javascript
export const CATEGORY_THRESHOLDS = {
  'electronics:mobiles':          { minPercent: 3.5, minCash: 1000, label: 'Smartphones & Tablets' },
  'electronics:laptops':          { minPercent: 4.0, minCash: 1500, label: 'Laptops & Computers' },
  'electronics:audio':            { minPercent: 8.0, minCash: 400,  label: 'Audio & Headphones' },
  'electronics:tv':               { minPercent: 6.0, minCash: 1500, label: 'Smart TVs & Monitors' },
  'electronics:wearables':        { minPercent: 8.0, minCash: 400,  label: 'Wearables & Smartwatches' },
  'appliances':                   { minPercent: 6.0, minCash: 1500, label: 'Large Appliances' },
  'beauty:skincare':              { minPercent: 10.0, minCash: 250, label: 'Skincare' },
  'beauty:fragrance':             { minPercent: 10.0, minCash: 250, label: 'Fragrances & Perfumes' },
  'beauty:makeup':                { minPercent: 15.0, minCash: 150, label: 'Makeup & Cosmetics' },
  'beauty:mens-grooming':         { minPercent: 12.0, minCash: 250, label: "Men's Grooming" },
  'men-fashion':                  { minPercent: 20.0, minCash: 300, label: "Men's Fashion" },
  'women-fashion':                { minPercent: 20.0, minCash: 300, label: "Women's Fashion" },
  'home:kitchen':                 { minPercent: 12.0, minCash: 350, label: 'Kitchen & Cookware' },
  'home:furniture':               { minPercent: 10.0, minCash: 800, label: 'Furniture' },
  'fitness:gym-equipment':        { minPercent: 8.0, minCash: 600,  label: 'Gym Equipment' },
  'general':                      { minPercent: 10.0, minCash: 200, label: 'General Goods' },
};
```

---

## 5. Database Collections & Schema Architecture

All schemas are strictly synchronized between `backend/src/db/models/` and `api/src/db/models/`:

### 1. `products` Collection
- `productId` (String, Unique, Index): ASIN / PID / SKU.
- `cleanUrl` (String, Index): Canonical store URL.
- `merchant` (String, Index): `amazon`, `flipkart`, `myntra`, `nykaa`, `ajio`.
- `title`, `brand`, `imageUrl`, `images`: Enriched visual assets.
- `aboutThisItem` (Array): Bullet points.
- `technicalSpecifications` (Map): Key-value specs.
- `rating` (Number), `reviews` (Array of objects with headline, author, verifiedPurchase).
- `price` (Number), `previousPrice` (Number), `originalPrice` (Number - MRP).
- `variants` (Array): Embedded shade/size SKUs:
  `[{ skuId, shadeName, size, price, previousPrice, inStock, url }]`
- `productSource`: `'telegram' | 'top20_catalog' | 'user_search' | 'bestseller'`.
- `isTop20` (Boolean, Index): Flags core catalog items.
- `isPinned` (Boolean): Admin override protecting from crawler rotation.
- `top20Category`, `top20Subcategory`, `top20Rank`.
- `isAvailable` (Boolean): Stock availability.
- `lastStoreSyncAt` (Date, Index): Exact timestamp of actual merchant network scrape.
- `lastTelegramSeenAt` (Date): Last timestamp a Telegram channel posted this link.
- `metadataUpdatedAt` (Date): Controls the 30-day rich asset refresh cycle.
- `priceHistory`: `[{ date: 'YYYY-MM-DD', price, originalPrice, timestamp }]` (1 entry per calendar day).

### 2. `deals` Collection
- `productId`, `dealUrl`, `merchant`, `title`, `brand`, `description`, `imageUrl`.
- `dealPrice`, `originalPrice`, `previousPrice`, `discountPercentage`.
- `coupon`: `{ type, value, code, label }`.
- `bankOffers`: `[{ bank, discountAmount, effectivePrice, description }]`.
- `isVerified` (Boolean, Index): `true` once confirmed by live scrape.
- `isExpired` (Boolean, Index): `true` when price increases or stock ends.
- `priceSource`: `'price_history' | 'scraped' | 'ai_text'`.
- `publishedStatus`:
  - `telegram` (Boolean)
  - `outputChannels` (Array of ObjectIds)
  - `publishedTo` (Array of Strings — e.g. `telegram:lootdealsindia`)
- `lightningDealEndsAt` (Date): Countdown timer target.

### 3. `deal_channel_events` Collection (Append-Only Audit Log)
- `productId`, `cleanUrl`, `merchant`.
- `sourceChannelId`, `sourceChannelName`, `sourceMessageId`, `country`, `price`.
- `event`: `'scraped' | 'cache_hit'`.
- `cacheAgeMinutes` (Number).
- `createdAt` (Date, TTL Index: 90 days).

### 4. `price_alerts` Collection
- `userId`, `email`, `phone`, `telegramChatId`.
- `productId`, `targetPrice`, `preferredVariant` (e.g. *Shade 128*).
- `status`: `'active' | 'triggered' | 'cancelled'`.
- `triggeredPrice`, `triggeredAt`.

---

## 6. Distributed Queues & Scaling Topology

All queues run on Redis via BullMQ with strict single-flight concurrency:

| Queue Name | Producers | Consumers | Priority Slicing | Pacing & Rate Limit |
| :--- | :--- | :--- | :--- | :--- |
| **`scraper-queue`** | `verifier.js`, `dailyProductRefresher.js`, `top20PriceWatcher.js`, User Search | `scraperWorker.js` fleet | `INTERACTIVE` (1) > `TELEGRAM` (2) > `CATALOG_TOP20` (3) > `DAILY_REFRESH` (4) | Token lease rotation, 90s max render timeout |
| **`deal-publish-queue`** | `verifier.js` (Engine 1), `top20PriceWatcher.js` (Engine 2), Admin Panel | `dealPublishWorker.js` (`backend`) | FIFO with priority override for mega loots | **60s token-bucket delay per channel** |
| **`top20-sync-queue`** | `top20PriceWatcher.js` scheduler | Scraper Worker fleet | Batch size 5 every 3 minutes | Continuous 12-hour loop |

---

## 7. Developer & Autonomous Agent Runbook

When implementing features or debugging this codebase:

1. **Never scrape merchant URLs directly**: Direct scraping and local browser scraping are permanently disabled. 100% of store scraping must route through `scraperQueue.enqueue(url)` using leased ScrapingAnt proxy tokens. If tokens are low, `tokenReplenisher.js` autonomously provisions fresh tokens.
2. **Never calculate discounts against statutory MRP**: Always compare against `existingProduct.price` from MongoDB history to ensure authentic price drops.
3. **Respect `lastStoreSyncAt`**: Only update this field when an actual network scrape to the merchant store succeeded. Do not update on cache hits.
4. **Preserve MongoDB Free Tier (<512MB)**: Always use `date: 'YYYY-MM-DD'` daily normalization in `priceHistory`. Never push multiple checkpoints on the same calendar day.
5. **Deduplicate Outbound Posts**: Always verify `destinationKey(platform, channelDoc)` against `deal.publishedStatus.publishedTo` before broadcasting.
