<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Design Standards (Mandatory)
All UI pages, catalogs, tables, and admin views must strictly adhere to [DESIGN_STANDARDS.md](file:///Users/karanarora/mystartups/restart_deals/admin/DESIGN_STANDARDS.md).
- Use 4-tier vertical layout with top KPI cards with 3px top accent lines.
- Dynamic master store tabs from `/api/master/store`.
- Multi-tier search and taxonomy filters.
- Separate Price and MRP table columns.
- Dedicated drawer components in `src/components/<name>-drawer.js`.
- Verify every build with `npm run build`.

