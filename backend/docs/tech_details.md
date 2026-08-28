# Technical Documentation: Shoppers Deals — Backend

This document reflects the actual code in `backend/src/` as of this writing (verified by reading
every source file, not inferred). Where a section applies to the wider monorepo rather than just
this backend, that's called out explicitly.

---

## 1. Technical Stack

* **Runtime**: Node.js, ESM (`"type": "module"` in [package.json](../package.json)).
* **Database**: MongoDB via Mongoose (`^8.2.1`).
* **Telegram**: `telegram` (GramJS, MTProto) — a real user session, not a bot — for both listening
  and publishing.
* **REST API**: Express 4.
* **AI**: `openai` SDK pointed at DeepSeek's OpenAI-compatible endpoint (`deepseek-chat`).
* **Scraping**: ScrapingAnt (`v2/general`, `browser=true`) + `cheerio` for HTML parsing.
* **Queueing**: `p-queue` (`concurrency: 1`).
* **Twitter/X**: `twitter-api-v2`, OAuth 1.0a.
* **WhatsApp**: no SDK — plain `fetch` against WAHA, Meta Cloud API, or a generic webhook,
  selected per `OutputChannel`.
* **Config**: `dotenv`, single `src/config.js` module, warns (does not throw) on missing
  `MONGODB_URI` / `TELEGRAM_API_ID` / `TELEGRAM_API_HASH`.

Scripts: `npm start` runs `node src/index.js`; `npm run dev` runs the same with `--watch`.

---

## 2. Database Schemas (Mongoose / MongoDB)

All schemas live in `src/db/models/`. Collection name is given in parens.

### 2.1 `Channel` (`monitored_channels`)

Source channels the listener watches.

```js
{
  channelId: String,           // required, unique — bare numeric ID (no "-100" prefix)
  username: String,            // required
  name: String,
  isActive: Boolean,           // default false — disabled by default when synced from Telegram
  country: String,             // default 'IN'
  messagesCapturedCount: Number,  // default 0, incremented on every captured message
  dealsProducedCount: Number,     // default 0, incremented only when a Deal is produced
  lastMessageAt: Date,
  lastDealAt: Date,             // distinct from lastMessageAt — gap between the two flags a stale channel
  category: String,             // default 'auto' — 'auto' defers to the per-message AI classifier;
                                 // any other value is a Master-managed category slug (no hardcoded enum)
  categoryPreference: String,   // default 'auto' — SUPERSEDED by `category`, kept only so old docs
                                 // still validate; do not use for new logic
  relevance: 'unreviewed' | 'relevant' | 'not_relevant',  // default 'unreviewed' — manual editorial review
  relevanceNote: String,
  relevanceReviewedAt: Date,
  isOwner: Boolean,             // default false — true if TELEGRAM_SESSION's account owns this
                                 // channel (set only by scripts/sync_channel_ownership.js)
  createdAt: Date
}
```

### 2.2 `Deal` (`deals`)

One published/publishable deal instance, matched by `(sourceChannelId, sourceMessageId)` uniquely
and looked up by `dealUrl` OR `(productId, merchant)` for upsert/dedup purposes.

```js
{
  sourceChannelId: String,      // required
  sourceMessageId: String,      // required
  country: String,              // default 'IN' — derived from merchant TLD, see cleanAndParseUrl()
  sourceChannelName: String,
  originalText: String,         // required — the raw Telegram message text
  title: String,
  description: String,
  imageUrl: String,
  images: [String],
  rating: Number,
  reviews: [{ author, text, rating, date }],
  dealUrl: String,               // required — canonical cleaned URL
  productId: String,             // ASIN / Flipkart PID / Myntra ID / Nykaa ID / Ajio ID / Shopsy pid — the real cross-post identity
  merchant: String,              // 'amazon' | 'flipkart' | 'myntra' | 'nykaa' | 'ajio' | 'shopsy'
  originalPrice: Number,
  dealPrice: Number,
  previousPrice: Number,         // substitute-MRP baseline, ONLY set on a genuine (>=5%) price-history drop
  discountPercentage: Number,
  priceSource: 'scraped' | 'ai_text' | 'price_history',
  coupon: { type: 'percent'|'flat'|'code', value: Number, code: String, label: String } | null,
  category: String,              // default 'general'
  subcategory: String,           // default '' — Master-managed, no hardcoded enum
  isVerified: Boolean,           // default false
  publishedStatus: {
    mobileApp: Boolean, webApp: Boolean, telegram: Boolean, whatsapp: Boolean
    // NOTE: outputChannels (array of OutputChannel _ids actually published to) is written by
    // publisher.js via $addToSet but is not declared in the schema — Mongoose stores it anyway
    // (no strict-mode issue observed), but it's effectively undocumented in the model itself.
  },
  createdAt: Date,               // bumped to "now" on every repost, so reposts float to top of feed
  updatedAt: Date
}
// indexes: {sourceChannelId,sourceMessageId} unique, {dealUrl}, {productId,merchant}
```

### 2.3 `Product` (`products`)

Canonical, cross-post product record — persisted for *every* product mentioned, whether or not it
ever becomes a displayable Deal.

```js
{
  productId: String,             // required, unique
  country: String,               // default 'IN'
  sourceChannelName: String,
  cleanUrl: String,              // required
  merchant: String,              // required
  title: String,
  images: [String],
  imageUrl: String,
  rating: Number,
  reviews: [{ author, text, rating, date }],
  price: Number,
  previousPrice: Number,         // same price-history semantics as Deal.previousPrice
  priceSource: 'scraped' | 'ai_text' | 'price_history',
  originalPrice: Number,
  priceUpdatedAt: Date,
  priceHistory: [{ price, originalPrice, timestamp }],
  category: String,              // default 'general'
  subcategory: String,           // default ''
  isActive: Boolean,             // default true
  needsEnrichment: Boolean,      // default false — true = pipeline couldn't verify image+price+discount yet;
                                  // only ever flips false, never re-set true by the pipeline
  isFlagged: Boolean,            // default false — admin-only, human "this looks wrong" flag,
                                  // set/cleared exclusively via PATCH /api/products/:id/flag
  flagReason: String,            // default ''
  flaggedAt: Date,
  lastChecked: Date,
  createdAt: Date,
  updatedAt: Date
}
// index: {cleanUrl}
```

> Note: the `isFlagged`/`flagReason`/`flaggedAt` fields' own comment references a
> `PATCH /api/products/:id/flag` route. That route never existed in this backend's REST API
> (which has since been removed entirely — see §4) and lives on the sibling `api/` project instead
> (`api/src/routes/products.js`), which is what actually manages these fields today.

### 2.4 `VerifiedLink` (`verified_links`)

Scrape-result cache, keyed by canonical URL.

```js
{
  originalUrl: String,   // required
  cleanUrl: String,      // required, unique
  productId: String,     // required
  title: String,
  merchant: String,      // required
  images: [String],
  rating: Number,
  reviews: [{ author, text, rating, date }],
  price: Number,
  originalPrice: Number,
  isActive: Boolean,     // default true
  lastChecked: Date
}
// index: {productId}
```

### 2.5 `ScrapingAntToken` (`scraping_ant_tokens`)

```js
{
  token: String,          // required, unique
  email: String,          // default null
  usageCount: Number,     // default 0
  status: 'active' | 'exhausted',  // default 'active'
  exhaustedAt: Date,
  lastUsedAt: Date
}
// index: {status, lastUsedAt}
```

### 2.6 `Master` (no explicit collection override — default `masters`)

Dynamic taxonomy store: categories, subcategories (linked via `metadata.parentCategory`),
countries, etc. Used so category/subcategory lists never need a schema migration to change.

```js
{
  type: String,      // required, indexed — 'category' | 'subcategory' | 'country' | 'store' ...
  value: String,      // required — e.g. 'electronics', 'IN'
  label: String,      // required — display label, e.g. 'Electronics', 'India'
  metadata: Mixed,     // e.g. { parentCategory: 'electronics' } for a subcategory, or { currency: '₹' }
  isActive: Boolean    // default true
}
// index: {type, value} unique; timestamps: true (createdAt/updatedAt)
```

### 2.7 `OutputChannel` (`output_channels`)

Where verified deals actually get published — one document per destination.

```js
{
  name: String,            // required
  platform: 'telegram' | 'twitter' | 'whatsapp',  // required
  country: String,          // default 'IN' — 'IN'|'US'|'UK'|'CA'|'AU'|'all'
  category: String,         // default 'all' — Master-managed, no hardcoded enum
  isActive: Boolean,        // default true
  rateLimitMinutes: Number, // default null — min minutes between sends on this channel;
                             // a deal arriving mid-cooldown is SKIPPED for this channel, not queued
  credentials: Mixed,       // shape depends on platform — see 3.5 below
  stats: { dealsPublished: Number, lastPublishedAt: Date },
  createdAt: Date,
  updatedAt: Date
}
```

### 2.8 `XAccount` (`x_accounts`)

Centralized Twitter/X credentials + billing, referenced from an `OutputChannel`'s
`credentials.xAccountId` so several output rows can share one account's OAuth keys.

```js
{
  label: String,     // required
  handle: String,
  isActive: Boolean,  // default true
  login: { email, password, notes },       // reference only — plain text, no encryption; prefer a password manager
  oauth1: { apiKey, apiSecret, accessToken, accessSecret },  // used for posting + media upload
  oauth2: { clientId, clientSecret },       // present in schema, unused by twitterPublisher.js today
  bearerToken: String,
  billing: { cardLabel, monthlySpendLimitUsd, lastKnownBalanceUsd, lastKnownBalanceAt, notes },
  createdAt: Date, updatedAt: Date
}
```

---

## 3. Core System Workflows

### 3.1 Telegram Listening (`src/listener/telegram.js`)

* **Auth**: GramJS `client.start()` with interactive `input` prompts for phone/2FA/code if
  `TELEGRAM_SESSION` isn't set; prints the resulting session string to stdout for you to copy into
  `.env`.
* **Dialog pre-fetch**: `client.getDialogs({})` populates an entity/title cache keyed by numeric
  ID (bare, `-100`-prefixed, and username variants) so later lookups don't need a network call.
* **`catchUp()`**: called once after login — without it GramJS silently drops broadcast-channel
  updates.
* **Live handler**: `client.addEventHandler(handleNewMessage, new NewMessage({}))`. For every
  event it builds a set of possible ID representations (bare, `-100`-prefixed, from `chatId` and
  from `message.peerId.channelId/chatId/userId`) and checks each against the active
  `resolvedChannelIds` set — only one needs to match.
* **Polling fallback** (`startChannelPoller`, every 30s): for each active numeric channel ID,
  fetches the latest 10 messages via `client.getMessages`. On the very first poll for a channel it
  only records a baseline (does not process history). Subsequent polls process anything newer
  than `lastEnqueuedMessageId`.
* **Race prevention between the two paths**: both the live handler and the poller read/write the
  same `lastEnqueuedMessageId` map (keyed by bare channel ID) *before* enqueueing — whichever path
  sees a message ID first claims it, so the other never double-processes it.
* **Channel refresh**: `refreshMonitoredChannels()` queries `Channel.find({isActive: true})` every
  5 seconds; it hashes the result and no-ops if nothing changed, so this is cheap even at high
  frequency.
* **Metrics**: `Channel.messagesCapturedCount` / `lastMessageAt` bump on every captured message
  (fire-and-forget, errors swallowed); `dealsProducedCount` / `lastDealAt` bump only when a Deal
  actually results.
* **Channel management functions**: `syncChannelsFromTelegram()` — walks all joined dialogs,
  inserts any not already in `monitored_channels` as **disabled**; `addChannelToMonitor(target)` —
  resolves a handle/ID via `client.getEntity` and upserts it as **active**. Both remain exported
  from this module (along with `refreshMonitoredChannels()` and `getQueueLength()`) even though
  the local REST routes that used to call them are gone (see §4) — they're plain exported
  functions, not dead code, in case something needs to drive channel management from this backend
  again later (a script, a future route, etc.).

### 3.2 Sequential Queueing (FIFO)

Single `p-queue` instance, `concurrency: 1`, shared by both the live handler and the poller. Every
verification run completes (dedup check through Deal save) before the next one starts, so the
60-minute dedup check in step 3.4 is always working off up-to-date data.

### 3.3 Link Extraction, Redirects & Cleaning (`src/listener/verifier.js`)

* `extractUrls(text)` — simple `https?://` regex, trims trailing punctuation.
* `unwrapEmbeddedUrl(url)` — inspects query-string values (and, as a second pass, the raw decoded
  URL string) for an embedded merchant URL matching `SUPPORTED_MERCHANT_DOMAINS`
  (`amazon.*`/`flipkart.com`/`amzn.to`/`fkrt.it`/`myntra.com`/`nykaa.com`/`ajio.com`/`shopsy.in`),
  e.g. `go.bigtricks.in/?o=https%3A%2F%2Famazon.in%2Fdp%2F...` → the inner Amazon URL directly.
  This domain list is the single source of truth shared by both unwrap passes — add a merchant
  here too, not just in `cleanAndParseUrl()`, or embedded/tracker-wrapped links for it won't
  unwrap.
* `resolveRedirect(url, depth)` — recursive, max depth 5. Sends `HEAD` (falls back to `GET`) with
  **browser-like headers** (Chrome UA + Accept headers) deliberately, because Node's default
  `User-Agent: node` gets blocked or served an interstitial by several affiliate redirectors.
  `redirect: 'manual'`, follows the `location` header itself.
* `cleanAndParseUrl(url)` — returns `{ cleanUrl, merchant, productId, isProductUrl, derivedCountry }`.
  - Amazon: requires `/dp/ASIN` or `/gp/product/ASIN` in the path; anything else (search, category,
    storefront) is `isProductUrl: false`. `derivedCountry` from TLD (`amazon.in`→IN, `.com`→US,
    `.co.uk`→UK, `.ca`→CA, `.com.au`→AU).
  - Flipkart: requires a `pid` query param or `/p/<16-char-id>` path segment; `derivedCountry`
    always `'IN'` (Flipkart is India-only).
  - Myntra: requires a numeric ID immediately before `/buy` in the path (e.g.
    `/tshirts/roadster/.../1234567/buy`); `derivedCountry` always `'IN'` — Myntra has no `.in`
    domain, the `.com` is not a US signal for this merchant.
  - Nykaa: requires a numeric ID after `/p/` in the path (e.g. `/lakme-.../p/475677`);
    `derivedCountry` always `'IN'` — same `.com`-is-not-US caveat as Myntra.
  - Ajio: requires a code after `/p/` in the path, optionally suffixed `_<colour>` (e.g.
    `/neonomad-.../p/702341640_green`); the colour suffix is kept as part of `productId` — a
    different colour is a genuinely different SKU (own price/stock), not the same product under a
    different link, unlike Amazon's ASIN. `derivedCountry` always `'IN'` — same `.com`-is-not-US
    caveat as Myntra/Nykaa (Ajio is Reliance Retail, India-only).
  - Shopsy: requires a `pid` query param (preferred) or, failing that, an `itm<hex>` path segment
    right after `/p/` (e.g. `/rino-.../p/itm769d096c2afa7?pid=XPTGRF47SFZQKTGH`); `derivedCountry`
    always `'IN'` (`.in` TLD outright, and Flipkart-owned/India-only besides). Shopsy runs on
    Flipkart's own commerce platform — its `pid` is the identical 16-char alphanumeric shape
    Flipkart uses, and its images serve off Flipkart's own `rukmini*.flixcart.com` CDN — but it is
    tracked as its own `merchant: 'shopsy'`, never coerced into `'flipkart'`.
  - Anything else: generic tracking-param stripping (`utm_*`, `gclid`, `fbclid`), merchant guessed
    from the domain's first label — but this branch is moot for pipeline purposes, since only a
    merchant in `SUPPORTED_MERCHANTS` (`amazon`/`flipkart`/`myntra`/`nykaa`/`ajio`/`shopsy`) with
    `isProductUrl: true` is ever accepted downstream.
* **Why country is derived from the URL, not the channel**: a `Product` is shared across every
  channel that ever mentions it; trusting the posting channel's configured country let a later
  repost from a differently-tagged channel silently flip a product's country for everyone. The
  channel's configured country is only used as a last-resort fallback when the domain itself
  didn't resolve to a known country. This is also exactly why Myntra/Nykaa/Ajio/Shopsy are all
  hardcoded to `'IN'` despite three of them having a `.com` TLD — same reasoning as Flipkart, just
  a different merchant each time.
* **Candidate loop**: `verifyAndProcessMessage` tries every URL found in the message *in order*
  and uses the first one that resolves to an actual product page on a `SUPPORTED_MERCHANTS`
  merchant — messages often lead with an intro/tracking link before the real product link.

### 3.4 Deduplication (60-Minute Window)

`isDuplicateLast60Mins(cleanUrl, productId, merchant)` — `Deal.countDocuments` with
`createdAt >= now-60min` AND (`dealUrl == cleanUrl` OR `(productId, merchant)` match). Matching on
`dealUrl` alone was insufficient because the same product can resolve to a different landing-page
slug depending on which link led there.

### 3.5 AI Extraction (DeepSeek) — runs *before* scraping

`extractDealWithDeepSeek(originalText, productDetails)`:

* Falls back to `fallbackParseDeal()` (regex price/keyword extraction) immediately if
  `DEEPSEEK_API_KEY` is unset, or if the API call throws.
* Category list and subcategory taxonomy are pulled live from `Master` (`type: 'category'` /
  `type: 'subcategory'`, `isActive: true`) and injected into the system prompt every call — no
  hardcoded category enum anywhere in this path.
* Prompt instructs the model to prefer prices stated in the *current* message text over any
  "previously recorded" price/rating/reviews passed in from `productDetails` (the cache), since
  the cache can be stale.
* Also extracts a structured `coupon` object (`percent` / `flat` / `code`) for an *additional*
  merchant-page coupon mentioned in the message — explicitly distinct from the deal's own
  discount, and explicitly excludes bank/card offers ("10% off on HDFC cards").
* Response validated against the live category list (`finalCategory`, defaults to `'general'` if
  the model returns something not in the list) and the live subcategory map, scoped to the chosen
  category (a label valid under a different category, or invented, is discarded to `''`).
* `normalizeCoupon()` sanitizes the AI's coupon output before it's ever persisted or shown — drops
  a `percent` value >100 (misparse), drops an empty/non-actionable coupon (no value and no code),
  synthesizes a `label` if the model didn't provide one.

### 3.6 Product Cache Lookup & Conditional Scraping

* Look up `Product` and `VerifiedLink` by `productId`/`cleanUrl`, requiring at least one image
  present (`"images.0": { $exists: true }`).
* **Cache is valid (scrape skipped) when**: images exist AND (a price was extracted by AI or
  already cached), OR images exist and the cache is younger than 1 hour even without a price yet.
* **Otherwise**, calls `scrapeProductDetails(cleanUrl)`:
  - Picks the oldest-`lastUsedAt` **active** `ScrapingAntToken` (load-balances across keys).
  - `GET https://api.scrapingant.com/v2/general?x-api-key=<token>&url=<encoded>&browser=true`.
  - **403/429** → marks that token `exhausted` with `exhaustedAt: now`, recursively retries with
    the next active token.
  - **200** → increments `usageCount`, parses with Cheerio using merchant-specific selectors
    (Amazon: `#productTitle`, `#landingImage`/`#imgTagWrapperId img`, `.a-icon-alt` rating,
    `.review-text-content` reviews, `.apexPriceToPay`/`.a-price-whole` price,
    `span.a-text-strike`/`#listPrice` original price; Flipkart: `.B_NuCI`/`.VU-ZEz` title,
    `img[src*="/image/"]`, `._30jeq3` price, `._3I9_R3` original price, `._3LWZlK` rating,
    `._2-t18p`/`.t-yNPA` reviews; Myntra: `og:title`/`og:image` primary + `.pdp-title`/`.pdp-name`
    title, `.pdp-price strong` price, `.pdp-mrp s` original price, `.index-overallRating` rating
    (no reviews extraction); Nykaa: `og:title`/`og:image` + `product:price:amount`/`[itemprop=
    price]` meta only (no MRP/rating/reviews attempted); Ajio: `h1.prod-name` title (falls back to
    `og:title`/`<title>`), `og:image` + `.img-alignment` images, `.prod-sp` price, `.prod-cp`
    original price, `.rating-popup` rating (text is like `"3.5  5.9K Ratings"` —
    `parseFloat` stops at the first non-numeric character so it cleanly yields `3.5`; no reviews
    extraction); Shopsy: `og:title`/`og:image` meta only, same as Nykaa (no price/MRP/rating/
    reviews attempted); generic: `og:title`/`og:image`/`<title>` fallback).
    **Myntra, Nykaa, and Shopsy selectors are best-effort, not verified against live markup** as
    of when they were added — all three are heavy client-rendered SPAs (Myntra mixes some
    relatively stable `pdp-*` class names with CSS background-image product photos instead of
    `<img src>`; Nykaa and Shopsy both use fully hashed/atomic class names — Nykaa is CSS-in-JS,
    Shopsy is a React Native Web build with class names like `css-146c3p1 r-cqee49 ...` that
    regenerate per build — so only `og:*`/schema.org meta tags were trusted at all for either).
    **Ajio's selectors ARE verified against live markup** (checked directly against a real product
    page when added — Ajio is server-rendered with stable, non-hashed `prod-*` class names, no
    React-hash risk). If scraper logs show empty price/rating for Myntra/Nykaa/Shopsy after real
    deals start flowing, that's expected until someone checks live markup and tunes the selectors
    in `scrapeProductDetails()` (`src/listener/verifier.js`). This degrades gracefully rather than
    breaking: the price-history fallback (§3.7) and the Telegram-photo fallback image (described
    just above in this section) both apply per-merchant with no special-casing, so a Myntra/Nykaa/
    Shopsy deal missing a scraped price/MRP can still verify and publish exactly like any other
    merchant.
  - On success, upserts `VerifiedLink` (creates if absent, else updates images/title/rating/
    reviews/price/lastChecked) — this is the shared scrape cache.
  - **If scraping yields no images**: falls back to the existing DB product's images if any exist;
    otherwise downloads the Telegram message's own photo via `downloadMessagePhoto()` (lazy —
    only actually hits the Telegram API if truly needed) as a last resort; if that also fails, the
    message is dropped entirely (`return null`).
  - If a fresh scrape supplied a price/original price the AI/text didn't have, `parsedDeal` is
    updated and discount is recomputed.

### 3.7 Price-History Fallback

If, after AI parsing and scraping, `discountPercentage` is still not `> 0`, look up this exact
product's last-known `price` in the `Product` collection and diff against the newly parsed
`dealPrice`. A ≥5% drop (`PRICE_DROP_MIN_PERCENT`) is treated as a genuine drop
(`previousPrice`/`genuinePriceDrop` gets set, `priceSource = 'price_history'`); below 5% the
computed discount is still used but not flagged as a confirmed drop. This is a deliberate
trade-off: freshness of the cached comparison price isn't tracked, but "we've seen this product
before at price X" beats rejecting the deal outright.

### 3.8 Verification Gate & Persistence

* **`Product` upsert always happens**, even for an incomplete deal — this is what makes
  `needsEnrichment: true` products visible for later backfill jobs. `needsEnrichment` only ever
  flips **false**, never back to true, once a pass clears the bar.
* **`Deal` is only created/updated** when `hasImage && hasPrice && hasDiscount`, where `hasDiscount`
  is true if there's a real MRP-based discount OR the price-history fallback fired (even at 0%).
  If the gate fails, the function returns `null` and no Deal is touched.
* Deal upsert matches on `dealUrl` OR `(productId, merchant)` — an existing Deal for the same
  product gets its fields refreshed and `createdAt` bumped to `now` (so reposts float to the top
  of a chronologically-sorted feed) rather than creating a duplicate document.
* `coupon` is **always overwritten** on update, including with `null` — a coupon is tied to the
  specific post that mentioned it, so a repost without one means it's no longer being offered.

### 3.9 Output Publishing (`src/listener/publisher.js` + `publishers/*.js`)

* `publishToTelegram(client, deal)` (name is legacy — it dispatches to all platforms, not just
  Telegram) queries `OutputChannel.find({ isActive: true, country: {$in:[deal.country,'all']},
  category: {$in:[deal.category,'all']} })`.
* **No `OutputChannel` documents at all** → falls back to a single synthetic channel doc pointing
  at `config.telegram.fitnessChannel` or `.generalChannel` from `.env`, publishes via
  `publishTelegram`.
* For each matching channel: skip if `rateLimitMinutes` cooldown hasn't elapsed since
  `stats.lastPublishedAt` (does not queue for later — just drops for that channel this cycle);
  otherwise dispatch by `platform`:
  - **`telegram`** (`telegramPublisher.js`): HTML-formatted message via
    `client.sendMessage(channel, {parseMode:'html'})` using the same GramJS client instance the
    listener uses. An invisible `<a href="imageUrl">&#8203;</a>` at the top triggers Telegram's
    link-preview image.
  - **`whatsapp`** (`whatsappPublisher.js`): provider resolved from `credentials.provider`
    (`waha` | `meta` | `webhook`), with a legacy inference fallback (presence of `webhookUrl` /
    `wahaBaseUrl` / else Meta) for rows saved before `provider` existed.
    - **WAHA**: simulates a "typing" presence call scaled to message length (1.2–4s) before
      sending, both to look human to WhatsApp's anti-spam heuristics and because WAHA docs
      recommend it; sends via `/api/sendImage` (deal has an image — WAHA fetches the URL itself)
      or `/api/sendText`.
    - **Meta Cloud API**: plain `graph.facebook.com/v18.0/{phoneNumberId}/messages`, text-only
      (no image support in this path currently).
    - **webhook**: POSTs `{ message, deal }` to an arbitrary `webhookUrl` — no image handling,
      no auth beyond whatever the URL itself expects.
  - **`twitter`** (`twitterPublisher.js`): OAuth 1.0a via `twitter-api-v2`. Credentials resolved
    either from a centralized `XAccount` (via `credentials.xAccountId` — preferred, lets several
    output rows share one account) or, as a legacy fallback, directly from `credentials` on the
    `OutputChannel` itself. Images are downloaded and uploaded via the classic v1.1
    `media/upload.json` endpoint (`twitterClient.v1.uploadMedia`) — deliberately *not* the newer
    split `/2/media/upload/{initialize,append,finalize}` flow, which rejects OAuth 1.0a with a 401.
    Tweet text is trimmed to fit 280 chars, dropping the coupon line first if still over.
* On any successful send, `OutputChannel.stats.dealsPublished` increments and
  `stats.lastPublishedAt` updates. `Deal.publishedStatus.telegram` is set `true` and the
  channel's `_id` is added to `publishedStatus.outputChannels` if *any* platform succeeded (the
  flag name is legacy from when Telegram was the only output).

### 3.10 Daily Token Reset (`src/listener/tokenReset.js`)

Runs once at startup and then every 24h: any `ScrapingAntToken` with `status: 'exhausted'` and
`exhaustedAt` ≥30 days ago is reset to `active`, `usageCount: 0`, `exhaustedAt` cleared.

### 3.11 Telegram Media Fallback (`src/utils/telegramMedia.js`)

`downloadMessagePhoto(client, message)` — downloads the source message's own photo (if any) to
`backend/public/telegram-media/<chatId>_<messageId>.jpg`, served statically at
`/media/telegram/...` with a 7-day cache (filenames are content-stable, never overwritten). Only
invoked lazily when the verifier actually needs a fallback image. Never throws — returns `null` on
any failure so it can't break the pipeline. `config.publicBaseUrl` must be a real,
internet-reachable URL in production for Telegram's own link-preview fetcher and the app's
`<Image>` to load it.

### 3.12 Log Buffer — removed

There used to be a `src/utils/loggerBuffer.js` monkey-patching `console.log/info/warn/error` into
a capped in-memory ring buffer, exposed via `GET /api/admin/logs`. Removed along with the rest of
§4's REST API — once that route was gone, the buffer had zero readers left (fill-only, never
drained), so both `interceptLogs()` and its call site in `src/index.js` were deleted rather than
left running for no purpose. Logs today go to stdout only, same as everything else in this
process — capture them at the process/hosting level (e.g. `pm2 logs`, a platform's log stream) if
you need history.

---

## 4. HTTP Server (`src/api/server.js`)

> **History note:** this used to be a full REST API (`/api/deals`, `/api/products`, `/api/channels`,
> `/api/admin`, plus a static admin-portal mount) mirroring routes that live on now in the sibling
> `api/` service. It was removed here because tracing every consumer in the monorepo (admin
> portal, Expo app, Next.js web app) by their actual configured API base URLs showed none of them
> ever called this backend — they all default to the sibling `api/` service (port `5001` dev /
> `https://api.shopscanner.store` prod), not this backend's port `3000`. The static admin-portal
> mount was additionally non-functional on its own terms (`admin/` is a plain Next.js app with no
> `output: 'export'`/`out/` build to serve statically). Route source, if ever needed for reference,
> is recoverable from version history; `channels.js`'s `PATCH /:id/category` bug (wrote the
> superseded `categoryPreference` field against a hardcoded `['auto','fitness','general']` list
> instead of the live Master-validated `category` field) was fixed shortly before removal — see
> `api/src/routes/channels.js` for the equivalent, still-live route with the correct pattern.

What's left is deliberately minimal — just what's actually load-bearing:

* `GET /health` — `{ status: 'ok', time }`. Likely a hosting-platform liveness probe.
* `/media/telegram/*` — serves Telegram-photo fallback images (7-day cache; see
  [`telegramMedia.js`](../src/utils/telegramMedia.js) and §3.11 below). This one is real
  infrastructure: `Deal.imageUrl` can point at a URL on this backend's `config.publicBaseUrl`,
  and end-user apps/browsers load that image directly — not proxied through `api/`.

Generic `express.json()` body parsing and an open CORS header middleware
(`Access-Control-Allow-Origin: *`, with Private Network Access support for Vercel-hosted HTTPS
callers) remain in place, harmless even with no routes left to need them.

---

## 5. Frontend / Admin (out of scope of this repo)

The `admin/` and `frontend/` folders are **siblings of `backend/`**, not part of it — this file no
longer documents their internals (the previous version of this doc described a planned Expo
React Native app structure that does not exist anywhere in this repository; verify current
frontend architecture directly in the `frontend/` folder if you need it). This backend's only
contract with them is the REST API above plus the static file mounts in `server.js`.
</content>
