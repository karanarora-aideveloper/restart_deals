// Display labels for the real category/subcategory values stored on every Deal/Product — see
// backend/src/db/models/master.js (type: 'category' / 'subcategory') for the source of truth.
// Kept as a static map rather than fetched live: the taxonomy is small (8 categories, ~50
// subcategories) and changes rarely, and this avoids an extra request on every deal-list render.
// Falls back to a capitalized raw value for anything added to Master after this was last synced.
export const CATEGORY_LABELS = {
  electronics: 'Electronics',
  home: 'Home',
  beauty: 'Beauty',
  fitness: 'Fitness',
  'men-fashion': "Men's Fashion",
  'women-fashion': "Women's Fashion",
  kitchen: 'Kitchen',
  wellness: 'Wellness',
  general: 'General',
};

export const SUBCATEGORY_LABELS = {
  audio: 'Audio',
  'bath-body': 'Bath & Body',
  appliances: 'Beauty Appliances',
  bedding: 'Bedding & Bath',
  'books-stationery': 'Books & Stationery',
  kids: 'Boys Fashion',
  cameras: 'Cameras',
  auto: 'Car & Bike Accessories',
  cleaning: 'Cleaning Supplies',
  'fitness-apparel': 'Fitness Apparel',
  trackers: 'Fitness Trackers',
  fragrance: 'Fragrance',
  furniture: 'Furniture',
  gaming: 'Gaming',
  gifts: 'Gifts & Occasions',
  'girls-fashion': 'Girls Fashion',
  groceries: 'Groceries & Gourmet',
  'gym-equipment': 'Gym Equipment',
  haircare: 'Haircare',
  decor: 'Home Decor',
  jewellery: 'Jewellery & Accessories',
  kitchen: 'Kitchen & Dining',
  laptops: 'Laptops & Computers',
  'appliances-large': 'Large Appliances',
  makeup: 'Makeup',
  bags: "Men's Bags & Wallets",
  'men-bottomwear': "Men's Bottomwear",
  footwear: "Men's Footwear",
  'mens-grooming': "Men's Grooming",
  innerwear: "Men's Innerwear",
  'men-topwear': "Men's Topwear",
  watches: "Men's Watches",
  accessories: 'Mobile Accessories',
  mobiles: 'Mobiles & Tablets',
  musical: 'Musical Instruments',
  nailcare: 'Nail Care',
  office: 'Office & School',
  'pet-supplies': 'Pet Supplies',
  skincare: 'Skincare',
  'sports-gear': 'Sports Gear',
  storage: 'Storage & Organization',
  nutrition: 'Supplements & Nutrition',
  tv: 'TV & Entertainment',
  tools: 'Tools & Improvement',
  'baby-toys': 'Toys & Baby Products',
  wearables: 'Wearables',
  'women-bags': "Women's Bags & Handbags",
  'women-ethnic': "Women's Ethnic Wear",
  'women-footwear': "Women's Footwear",
  'women-innerwear': "Women's Innerwear & Sleepwear",
  'women-watches': "Women's Watches",
  'women-western': "Women's Western Wear",
  yoga: 'Yoga & Wellness',
};

function titleCase(slug) {
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function categoryLabel(value) {
  if (!value) return '';
  return CATEGORY_LABELS[value] || titleCase(value);
}

export function subcategoryLabel(value) {
  if (!value) return '';
  return SUBCATEGORY_LABELS[value] || titleCase(value);
}
