/**
 * Shared price-bucket / discount-tag / sort-option definitions used by the home screen's
 * circular "Shop by Budget" strip (HomeSections.js) and the deals page's Sort/Filter bottom
 * sheets (SortFilterBar.js) — kept in one place so both surfaces stay in sync, and a tap from
 * either one maps straight onto the exact `maxPrice` / `minDiscount` / `sort` query params the
 * backend's /api/deals route already understands (see api/src/routes/deals.js) — no new backend
 * work needed.
 */

export const PRICE_BUCKETS = [
  { key: 'under99', label: 'Under ₹99', short: '₹99', maxPrice: 99, colors: ['#22c55e', '#15803d'] },
  { key: 'under199', label: 'Under ₹199', short: '₹199', maxPrice: 199, colors: ['#FF6B00', '#c2410c'] },
  { key: 'under299', label: 'Under ₹299', short: '₹299', maxPrice: 299, colors: ['#7c3aed', '#5b21b6'] },
  { key: 'under499', label: 'Under ₹499', short: '₹499', maxPrice: 499, colors: ['#2563eb', '#1e40af'] },
  { key: 'under999', label: 'Under ₹999', short: '₹999', maxPrice: 999, colors: ['#d946ef', '#a21caf'] },
];

export const DISCOUNT_TAGS = [
  { key: 'disc10', label: '10% or more off', short: '10%+', minDiscount: 10, colors: ['#fbbf24', '#d97706'] },
  { key: 'disc25', label: '25% or more off', short: '25%+', minDiscount: 25, colors: ['#fb923c', '#c2410c'] },
  { key: 'disc50', label: '50% or more off', short: '50%+', minDiscount: 50, colors: ['#f87171', '#b91c1c'] },
  { key: 'disc70', label: '70% or more off', short: '70%+', minDiscount: 70, colors: ['#ef4444', '#7f1d1d'] },
];

export const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest First', icon: 'time-outline' },
  { key: 'price_asc', label: 'Price: Low to High', icon: 'arrow-up-outline' },
  { key: 'price_desc', label: 'Price: High to Low', icon: 'arrow-down-outline' },
  { key: 'discount', label: 'Biggest Discount', icon: 'flame-outline' },
  { key: 'rating', label: 'Top Rated', icon: 'star-outline' },
];
