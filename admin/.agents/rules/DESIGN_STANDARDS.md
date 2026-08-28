# Restart Deals Admin UI/UX Design Standards

> **Mandatory Guidelines for all AI Agents and Engineers.**  
> Every directory, catalog, feed, and table view in the Restart Deals Admin portal must strictly follow these UI/UX design patterns to maintain visual harmony, peak operational utility, and flawless React 19 / Turbopack compilation.

---

## 1. Core Visual Architecture & Layout Hierarchy

Every administrative management page must follow a clean 4-tier vertical structure:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Header Context Bar (Title + Live Pulse Tag + Actions)     │
├─────────────────────────────────────────────────────────────┤
│ 2. KPI Status & Metric Health Cards (Top 3px Accent Lines) │
├─────────────────────────────────────────────────────────────┤
│ 3. Main Glass Directory Card                                │
│    ├── Tier 1: Directory Title + Store Tabs + Search + Limit│
│    ├── Tier 2: Taxonomy & Admin Intelligence Filter Bar     │
│    ├── Standardized Data Table (minWidth: 1200px - 1400px) │
│    └── Pagination Footer (Showing X to Y of Total)          │
├─────────────────────────────────────────────────────────────┤
│ 4. Overlays: Side Drawer + Floating Action Bar + Modals     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Top KPI Status & Health Cards

- Render a 4-column responsive grid (`grid-cards` with `minmax(220px, 1fr)`).
- **Top Accent Line**: Use an explicit colored top border (`borderTop: '3px solid <color>'`):
  - 🟣 Indigo (`#818cf8`): Total Catalog / Volume
  - 🟢 Emerald (`#10b981`): High Confidence / Steal Deals / Multiple Deals
  - 🔴 Rose / Red (`#ef4444`): Flagged Issues / Alerts
  - 🟡 Amber (`#f59e0b`): Registered Marketplaces / Active Filter Indicator
  - 🌸 Pink (`#ec4899`): Coupons / Vouchers
- **Icon Box**: Rounded square with 12% opacity background tint (e.g. `rgba(99, 102, 241, 0.12)`).
- **Interactive Quick-Filters**: Clicking a KPI card should immediately toggle its corresponding filter (e.g., clicking "Multiple Deals" filters `dealsFilter === 'multiple'`, clicking "Flagged Issues" toggles flagged records).

---

## 3. Two-Tier Filter & Directory Header Standards

### Tier 1: Catalog Header & Store Quick Tabs
- **Container**: `display: flex, justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--border)'`.
- **Dynamic Stores Master**: Fetch stores from `GET /api/master/store` (never hardcode Amazon/Flipkart).
- **Store Quick Tabs**: Pill button group (`All Stores (<count>)`, `Amazon`, `Flipkart`, `Myntra`, `Ajio`, etc.).
- **Search Bar**: Input with leading search icon and trailing cancel `(X)` button when populated.
- **Limit Selector**: Standardized dropdown (`15 / page`, `30 / page`, `50 / page`, `100 / page`).

### Tier 2: Taxonomy & Deep Intelligence Filter Bar
- **Container**: `background: rgba(0, 0, 0, 0.015) - rgba(0, 0, 0, 0.025)`, padding: `0.75rem 1.5rem`.
- **Required Filter Selects**:
  1. **Store**: Master store select.
  2. **Category**: Dynamic categories.
  3. **Subcategory**: Subcategories grouped hierarchically by parent category.
  4. **Country**: Flag emojis: `🇮🇳 India (IN)`, `🇺🇸 United States (US)`, `🇬🇧 UK (UK)`, `🇨🇦 Canada (CA)`, `🇦🇺 Australia (AU)`.
  5. **Deals Frequency**: `All Deals`, `🔥 Multiple Deals (> 1)`, `Single Deal (1)`, `Zero Deals (0)`.
  6. **Discount**: `Any Discount`, `≥ 30% OFF`, `≥ 50% OFF`, `≥ 70% Steal Deals`.
  7. **Confidence Source**: `All Sources`, `✅ Scraped (Verified)`, `🧠 AI Extracted`, `📈 Price History`.
  8. **Asset Health**: `All Images`, `Has Image`, `⚠️ Missing Image`.
  9. **Sort**: Standardized sort options (`Recently Checked`, `Newest`, `Price: Low to High`, `Price: High to Low`, `Rating`, `Deals Count`).
  10. **Reset Button**: `Reset All Filters` button with `clear_all` icon displayed whenever any filter is active.

---

## 4. Standardized Table Architecture & Column Rules

Tables must use standard semantic HTML `<table>` elements with `minWidth: 1200px - 1400px` to prevent cramped columns.

| Column | Standard Width | Requirements & Styling |
| :--- | :--- | :--- |
| **Checkbox** | `44px` (center) | Select all header checkbox + row select. Highlights row on check. |
| **Item Image** | `64px` | `44x44px` square, `border-radius: 8px`, white bg, contain fit. Indicator badge if photo is borrowed from Telegram fallback. |
| **Title & PID** | `minWidth: 260px` | 2-line title clamp with full tooltip. Monospace PID tag with single-click Copy button and store external link. |
| **Store** | `100px` | Merchant badge (`.merchant-badge.merchant-<name>`). |
| **Category** | `110px` | Reduced font size (`0.72rem`, `padding: 2px 7px`), font-weight 600, pastel background matching category hash. |
| **Subcategory** | `130px` | Soft gray pill (`0.72rem`, `padding: 2px 7px`), `—` when unassigned. Sortable header. |
| **Price** | `120px` | **Bold Current / Deal Price** (`0.92rem`, `fontWeight: 800`). Shows discount badge (`78% OFF`) underneath. Sortable. |
| **MRP** | `95px` | **Original / List Price** in muted strikethrough (`0.84rem`). `—` when unassigned. Sortable. |
| **Deals / History** | `85px - 90px` | Interactive count badges (`DealsCountBadge`, `HistoryBadge`). Clicking opens respective drawer tab or modal. |
| **Country** | `85px` | Flag emoji + country code (`🇮🇳 IN`). |
| **Last Checked / Posted**| `110px` | Relative time (`formatTime`, e.g. `6m ago`) with full ISO timestamp in hover tooltip. |
| **Actions** | `130px` (right) | Secondary `View` button (opens Drawer) + subtle red `Delete` button. |

---

## 5. Overlays & Secondary Views

### A. Quick View Drawer (`ProductDrawer`, `DealDrawer`)
- Place component definition in `src/components/<name>-drawer.js` (never inline inside `page.js`).
- Render conditionally with `{selectedItem && <Drawer ... />}`.
- Include **Previous / Next** item navigation shortcuts at the top.
- Tab bar for switching between Overview and Linked Deals / History.
- Clickable copy buttons for Product IDs, coupon codes, and URLs.

### B. Sticky Multi-Select Action Bar
- Sticky bar fixed to the bottom of the table card when `selectedIds.length > 0`.
- Displays `N item(s) selected`, `Deselect all`, and primary `Delete Selected (N)` action.

### C. Floating Toast Notifications
- Dark blur pill in bottom right (`rgba(15, 23, 42, 0.92)` backdrop blur) with check icon. Auto-dismiss in 3000ms.

---

## 6. Code & Next.js 16 / React 19 Best Practices

1. **Avoid Monolithic Page Files**: Keep page files under ~600 lines by modularizing drawers and modals into `src/components/`.
2. **Conditional Overlay Rendering**: Always use `{state && <ModalOrDrawer ... />}` to prevent AST hoisting mismatches.
3. **Master Data First**: Always query `/api/master/:type` for taxonomies rather than hardcoding.
4. **Build Verification**: Every page change must pass `npm run build` with **0 errors**.
