<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project: ShoppersDeals Consumer Web Frontend

## Vercel Deployment & Account Info
- **Vercel Account/Team**: `arora9408` (`team_dPoVzhL3JBPcnmAscW13elcG`)
- **Vercel Project**: `web` (`prj_tJJPI1K5wN3Vey7knPEUL9E9D5hn`)
- **Custom Domains**: `https://www.shoppersdeals.in` & `https://shoppersdeals.in` (apex 308 redirects to www)
- **Deploy Command**: `cd /Users/karanarora/mystartups/restart_deals/frontend/web && vercel deploy --prod` (Must be logged into `arora9408` account via `vercel login`)
- **ISR Caching Rule**: All deal & product dynamic routes use 300s (5-minute) revalidation in `src/lib/api.js`. Do NOT lower revalidation intervals below 300s to avoid exceeding Vercel Hobby ISR cache write quotas (200k/mo).
