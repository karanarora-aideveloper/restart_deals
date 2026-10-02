# ShoppersDeals Web (Next.js)

Server-rendered, SEO-first web app for ShoppersDeals — replaces the previous `expo export -p web`
static SPA build. The native iOS/Android app (`../`, one level up) is unaffected: this lives in
its own `web/` folder with its own `package.json`, `node_modules`, and Vercel project.

## Why this exists

The old web build was a client-only React Native Web bundle exported to a single `index.html`
and served for every route via a Vercel catch-all rewrite. Routing was simulated with
`window.location.pathname` read into React state, so `/deal/:id`, `/blog/:slug`, `/privacy`,
etc. all served byte-identical HTML with one hardcoded `<title>`/description and an empty
`#root` div — crawlers got nothing page-specific.

This app is real Next.js App Router: every route is server-rendered with its own
`generateMetadata`, canonical URL, Open Graph tags, and JSON-LD (Organization/Store/FAQ sitewide,
Product schema on deal pages, Article schema on blog posts). A dynamic `sitemap.xml` and
`robots.txt` are generated from the same data.

## Structure

- `src/app/*` — routes (`/`, `/hot`, `/products`, `/categories`, `/blog`, `/blog/[slug]`,
  `/deal/[id]`, `/privacy`, `/profile`, `/saved`)
- `src/components/*` — shared UI (header, footer, cards, filter bar, live feed, auth)
- `src/lib/*` — API client, affiliate URL/merchant helpers, Firebase auth, saved-deals storage
- `src/data/blogs.json` — same blog content as the native app (copy in sync manually for now)

## Notable behavior changes vs. the native app's web build

- **Real routes for tabs.** `/hot`, `/products`, `/categories` are now actual pages instead of
  client-only tab state — the old SPA's `WebFooter` even linked to `/?tab=hot`, a query param
  `App.js` never read back on reload. Filters (`category`, `merchant`, `q`) are URL search
  params so filtered views are shareable/bookmarkable.
- **Contacts sync is dropped.** `expo-contacts` is a native-only capability; it was already a
  no-op on web behind a `Platform.OS !== 'web'` guard for the permission prompt, and would have
  failed silently regardless.
- **Auth modal → dedicated `/profile` page.** Same Firebase Google popup + phone/OTP flow as
  before, laid out as a page instead of a modal (works better with real navigation).

## Env vars

Copy `.env.example` to `.env.local` and fill in Firebase web config, `NEXT_PUBLIC_API_URL`
(backend base URL), and `NEXT_PUBLIC_SITE_URL`. The `FIREBASE_APP_ID` currently mirrors the
Expo project's *Android* app id — register a dedicated Web app in the Firebase console for full
parity (Analytics, etc.) and swap it in.

## Commands

```bash
npm install
npm run dev     # http://localhost:3000, expects the backend on NEXT_PUBLIC_API_URL
npm run build
npm run start
```
