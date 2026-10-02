/**
 * Category + subcategory taxonomy for the Browse section and the FilterBar category pills.
 *
 * The top-level ids here match the canonical Master collection in MongoDB Atlas.
 * Every subcategory id matches a Master subcategory value with metadata.parentCategory.
 */

export const CATEGORY_TAXONOMY = [
  {
    id: 'electronics',
    label: 'Electronics & Tech',
    pillLabel: 'Electronics',
    icon: 'hardware-chip',
    emoji: '📱',
    color: '#7c3aed',
    bgColor: '#f5f3ff',
    subcategories: [
      { id: 'mobiles', label: 'Mobiles & Tablets', icon: 'phone-portrait-outline', keywords: 'smartphone|mobile\\s?phone|tablet|iphone|android\\s?phone' },
      { id: 'laptops', label: 'Laptops & Computers', icon: 'laptop-outline', keywords: 'laptop|notebook\\s?pc|desktop|monitor|keyboard|mouse|macbook' },
      { id: 'audio', label: 'Audio & Headphones', icon: 'headset-outline', keywords: 'earbuds|headphone|earphone|speaker|neckband|soundbar' },
      { id: 'tv', label: 'TV & Home Entertainment', icon: 'tv-outline', keywords: 'smart\\s?tv|television|led\\s?tv|projector' },
      { id: 'wearables', label: 'Wearables & Smartwatches', icon: 'watch-outline', keywords: 'smart\\s?watch|fitness\\s?band|smart\\s?band' },
      { id: 'cameras', label: 'Cameras & Photography', icon: 'camera-outline', keywords: 'camera|dslr|action\\s?camera|webcam|gopro' },
      { id: 'gaming', label: 'Gaming & Consoles', icon: 'game-controller-outline', keywords: 'gaming\\s?console|playstation|xbox|gaming\\s?laptop|gaming\\s?mouse|controller' },
      { id: 'accessories', label: 'Electronic Accessories', icon: 'battery-charging-outline', keywords: 'phone\\s?case|charger|power\\s?bank|cable|screen\\s?guard' },
    ],
  },
  {
    id: 'appliances',
    label: 'Home & Kitchen Appliances',
    pillLabel: 'Appliances',
    icon: 'flash',
    emoji: '🔌',
    color: '#0284c7',
    bgColor: '#f0f9ff',
    subcategories: [
      { id: 'refrigerators', label: 'Refrigerators', icon: 'cube-outline', keywords: 'refrigerator|fridge|double\\s?door|single\\s?door|frost\\s?free' },
      { id: 'washing-machines', label: 'Washing Machines', icon: 'sync-outline', keywords: 'washing\\s?machine|front\\s?load|top\\s?load|washer' },
      { id: 'air-conditioners', label: 'Air Conditioners', icon: 'snow-outline', keywords: 'air\\s?conditioner|inverter\\s?ac|split\\s?ac|window\\s?ac' },
      { id: 'water-purifiers', label: 'Water Purifiers', icon: 'water-outline', keywords: 'water\\s?purifier|ro\\+uv|aquaguard|kent' },
      { id: 'geysers', label: 'Geysers & Water Heaters', icon: 'flame-outline', keywords: 'geyser|water\\s?heater|instant\\s?geyser' },
      { id: 'microwaves', label: 'Microwave Ovens', icon: 'hardware-chip-outline', keywords: 'microwave|convection|grill\\s?microwave|otg' },
      { id: 'air-fryers', label: 'Air Fryers', icon: 'restaurant-outline', keywords: 'air\\s?fryer|digital\\s?air\\s?fryer' },
      { id: 'chimneys', label: 'Kitchen Chimneys', icon: 'funnel-outline', keywords: 'chimney|kitchen\\s?chimney|auto-clean' },
      { id: 'fans-coolers', label: 'Fans & Air Coolers', icon: 'refresh-outline', keywords: 'ceiling\\s?fan|bldc\\s?fan|air\\s?cooler|table\\s?fan' },
      { id: 'kitchen-appliances', label: 'Mixers & Cooktops', icon: 'cafe-outline', keywords: 'mixer\\s?grinder|induction|electric\\s?kettle|toaster|blender' },
    ],
  },
  {
    id: 'men-fashion',
    label: "Men's Fashion",
    pillLabel: "Men's Fashion",
    icon: 'man',
    emoji: '👔',
    color: '#FF6B00',
    bgColor: '#fff4ed',
    subcategories: [
      { id: 'men-topwear', label: "Men's Topwear", icon: 'shirt-outline', keywords: 't-?shirt|shirt|sweatshirt|hoodie|jacket\\s?for\\s?men' },
      { id: 'men-bottomwear', label: "Men's Bottomwear", icon: 'body-outline', keywords: 'jeans|trousers|men\\s?shorts|track\\s?pants' },
      { id: 'footwear', label: "Men's Footwear", icon: 'footsteps-outline', keywords: 'men\\s?shoes|sneakers|sandals|slippers|formal\\s?shoes|flip\\s?flop' },
      { id: 'watches', label: "Men's Watches", icon: 'watch-outline', keywords: 'watch|wrist\\s?watch|analog\\s?watch|chronograph' },
      { id: 'bags', label: "Men's Bags & Wallets", icon: 'bag-handle-outline', keywords: 'backpack|wallet|sling\\s?bag|messenger\\s?bag' },
      { id: 'innerwear', label: "Men's Innerwear", icon: 'moon-outline', keywords: 'innerwear|briefs|vest|boxer' },
      { id: 'boys-fashion', label: 'Boys Fashion', icon: 'happy-outline', keywords: 'boys\\s?clothing|boys\\s?wear|boys\\s?shoes' },
    ],
  },
  {
    id: 'women-fashion',
    label: "Women's Fashion",
    pillLabel: "Women's Fashion",
    icon: 'woman',
    emoji: '👗',
    color: '#EC4899',
    bgColor: '#fdf2f8',
    subcategories: [
      { id: 'women-ethnic', label: "Women's Ethnic Wear", icon: 'flower-outline', keywords: 'kurti|saree|salwar|lehenga|ethnic\\s?wear' },
      { id: 'women-western', label: "Women's Western Wear", icon: 'shirt-outline', keywords: 'dress|women\\s?top|women\\s?jeans|skirt|jumpsuit' },
      { id: 'women-footwear', label: "Women's Footwear", icon: 'footsteps-outline', keywords: 'heels|sandals|flats|women\\s?shoes|sneakers' },
      { id: 'women-watches', label: "Women's Watches", icon: 'watch-outline', keywords: 'watch|wrist\\s?watch|analog\\s?watch' },
      { id: 'women-bags', label: "Women's Bags & Handbags", icon: 'bag-handle-outline', keywords: 'handbag|clutch|tote\\s?bag|sling\\s?bag' },
      { id: 'jewellery', label: 'Jewellery & Accessories', icon: 'diamond-outline', keywords: 'earrings|necklace|bracelet|sunglasses|jewellery' },
      { id: 'women-innerwear', label: "Women's Innerwear & Sleepwear", icon: 'moon-outline', keywords: 'innerwear|nightwear|loungewear|bra|lingerie' },
      { id: 'girls-fashion', label: 'Girls Fashion', icon: 'happy-outline', keywords: 'girls\\s?dress|girls\\s?clothing|girls\\s?wear' },
    ],
  },
  {
    id: 'beauty',
    label: 'Beauty & Personal Care',
    pillLabel: 'Beauty',
    icon: 'color-palette',
    emoji: '💄',
    color: '#d946ef',
    bgColor: '#fdf4ff',
    subcategories: [
      { id: 'skincare', label: 'Skincare', icon: 'water-outline', keywords: 'moisturizer|serum|sunscreen|face\\s?wash|cleanser|face\\s?mask|toner' },
      { id: 'haircare', label: 'Haircare', icon: 'cut-outline', keywords: 'shampoo|conditioner|hair\\s?oil|hair\\s?serum|hair\\s?mask' },
      { id: 'makeup', label: 'Makeup', icon: 'color-palette-outline', keywords: 'lipstick|foundation|concealer|mascara|eyeliner|kajal|compact|blush|highlighter' },
      { id: 'bath-body', label: 'Bath & Body', icon: 'flower-outline', keywords: 'body\\s?wash|body\\s?lotion|soap|body\\s?scrub|hand\\s?cream' },
      { id: 'fragrance', label: 'Fragrance & Perfumes', icon: 'flask-outline', keywords: 'perfume|deodorant|body\\s?mist|cologne|\\bedt\\b|\\bedp\\b' },
      { id: 'mens-grooming', label: "Men's Grooming", icon: 'man-outline', keywords: 'beard\\s?oil|trimmer|shaving|aftershave|men\\s?grooming' },
      { id: 'appliances', label: 'Beauty Appliances', icon: 'flash-outline', keywords: 'hair\\s?dryer|straightener|hair\\s?curler|epilator' },
      { id: 'nailcare', label: 'Nail Care', icon: 'brush-outline', keywords: 'nail\\s?polish|nail\\s?kit|manicure|nail\\s?art' },
    ],
  },
  {
    id: 'home',
    label: 'Home, Living & Decor',
    pillLabel: 'Home',
    icon: 'restaurant',
    emoji: '🏠',
    color: '#FFB800',
    bgColor: '#fffbeb',
    subcategories: [
      { id: 'kitchen-dining', label: 'Cookware & Dining', icon: 'restaurant-outline', keywords: 'cookware|dinner\\s?set|pressure\\s?cooker|water\\s?bottle' },
      { id: 'furniture', label: 'Furniture', icon: 'cube-outline', keywords: 'sofa|bed\\b|dining\\s?table|chair|wardrobe' },
      { id: 'decor', label: 'Home Decor & Lighting', icon: 'bulb-outline', keywords: 'wall\\s?art|home\\s?decor|lighting|curtains|wall\\s?clock' },
      { id: 'bedding', label: 'Bedding & Bath', icon: 'bed-outline', keywords: 'bedsheet|pillow|towel|blanket|mattress' },
      { id: 'storage', label: 'Storage & Organization', icon: 'file-tray-stacked-outline', keywords: 'storage\\s?box|organizer|wardrobe\\s?organizer' },
      { id: 'cleaning', label: 'Cleaning Supplies', icon: 'sparkles-outline', keywords: 'vacuum\\s?cleaner|mop|cleaning\\s?supplies|detergent' },
      { id: 'tools', label: 'Tools & Home Improvement', icon: 'construct-outline', keywords: 'tool\\s?kit|drill\\s?machine|hardware\\s?tools' },
    ],
  },
  {
    id: 'fitness',
    label: 'Sports & Fitness',
    pillLabel: 'Fitness',
    icon: 'barbell',
    emoji: '🏋️',
    color: '#059669',
    bgColor: '#f0fdf4',
    subcategories: [
      { id: 'nutrition', label: 'Supplements & Nutrition', icon: 'nutrition-outline', keywords: 'protein|supplement|whey|creatine' },
      { id: 'gym-equipment', label: 'Gym Equipment', icon: 'barbell-outline', keywords: 'dumbbell|gym\\s?equipment|home\\s?gym|treadmill|exercise\\s?bike' },
      { id: 'sports-gear', label: 'Sports Gear', icon: 'football-outline', keywords: 'cricket\\s?bat|badminton|football|sports\\s?gear|racket' },
      { id: 'yoga', label: 'Yoga & Wellness', icon: 'leaf-outline', keywords: 'yoga\\s?mat|resistance\\s?band|yoga\\s?block' },
      { id: 'trackers', label: 'Fitness Trackers', icon: 'watch-outline', keywords: 'fitness\\s?band|smart\\s?watch|fitness\\s?tracker' },
      { id: 'apparel', label: 'Fitness Apparel', icon: 'shirt-outline', keywords: 'gym\\s?wear|sports\\s?shoes|activewear|track\\s?suit' },
    ],
  },
  {
    id: 'grocery',
    label: 'Groceries & Gourmet',
    pillLabel: 'Groceries',
    icon: 'basket',
    emoji: '🛒',
    color: '#16a34a',
    bgColor: '#f0fdf4',
    subcategories: [
      { id: 'coffee-tea', label: 'Coffee, Tea & Beverages', icon: 'cafe-outline', keywords: 'coffee|tea|green\\s?tea|filter\\s?coffee' },
      { id: 'dry-fruits', label: 'Dry Fruits, Nuts & Seeds', icon: 'nutrition-outline', keywords: 'almond|cashew|walnut|dates|raisins|makhana' },
      { id: 'snacks-beverages', label: 'Snacks & Drinks', icon: 'fast-food-outline', keywords: 'chocolate|cookie|biscuit|namkeen|chips' },
      { id: 'cooking-staples', label: 'Cooking Staples & Oils', icon: 'restaurant-outline', keywords: 'cooking\\s?oil|ghee|spices|masala|atta|rice' },
      { id: 'breakfast-dairy', label: 'Breakfast & Dairy', icon: 'sunny-outline', keywords: 'oats|muesli|corn\\s?flakes|honey|peanut\\s?butter' },
    ],
  },
  {
    id: 'baby-kids',
    label: 'Baby Care & Toys',
    pillLabel: 'Baby & Toys',
    icon: 'happy',
    emoji: '🧸',
    color: '#f59e0b',
    bgColor: '#fffbeb',
    subcategories: [
      { id: 'diapers-wipes', label: 'Diapers & Wipes', icon: 'shield-checkmark-outline', keywords: 'diaper|pant\\s?diaper|baby\\s?wipes|rash\\s?cream' },
      { id: 'toys-games', label: 'Toys & Board Games', icon: 'game-controller-outline', keywords: 'toy|action\\s?figure|doll|board\\s?game|lego|puzzle' },
      { id: 'baby-gear', label: 'Strollers & Baby Gear', icon: 'car-sport-outline', keywords: 'stroller|pram|baby\\s?carrier|high\\s?chair' },
      { id: 'feeding-nursing', label: 'Feeding & Nursing', icon: 'nutrition-outline', keywords: 'feeding\\s?bottle|sipper|teether|baby\\s?food' },
    ],
  },
  {
    id: 'auto',
    label: 'Automotive & Riding',
    pillLabel: 'Auto & Riding',
    icon: 'car',
    emoji: '🏍️',
    color: '#dc2626',
    bgColor: '#fef2f2',
    subcategories: [
      { id: 'helmets-riding', label: 'Helmets & Riding Gear', icon: 'shield-outline', keywords: 'helmet|riding\\s?gloves|riding\\s?jacket' },
      { id: 'bike-accessories', label: 'Bike Accessories', icon: 'bicycle-outline', keywords: 'bike\\s?cover|bike\\s?mobile\\s?holder|bike\\s?light' },
      { id: 'car-accessories', label: 'Car Accessories', icon: 'car-outline', keywords: 'car\\s?charger|dash\\s?cam|car\\s?cover|car\\s?vacuum' },
      { id: 'car-care', label: 'Car Cleaning & Care', icon: 'sparkles-outline', keywords: 'car\\s?wash|car\\s?polish|wiper\\s?blade' },
    ],
  },
  {
    id: 'books-stationery',
    label: 'Books & Stationery',
    pillLabel: 'Books & Office',
    icon: 'book',
    emoji: '📚',
    color: '#6366f1',
    bgColor: '#eef2ff',
    subcategories: [
      { id: 'books', label: 'Books & Novels', icon: 'book-outline', keywords: 'book|novel|paperback|hardcover' },
      { id: 'stationery', label: 'Notebooks & Stationery', icon: 'pencil-outline', keywords: 'stationery|notebook|pen\\s?set|gel\\s?pen' },
      { id: 'office-supplies', label: 'Office Supplies & Desk', icon: 'briefcase-outline', keywords: 'printer\\s?paper|toner\\s?cartridge|office\\s?chair' },
    ],
  },
];

// Flat subcategoryId -> {label, icon, parentCategoryId, parentColor, parentLabel} lookup
export const SUBCATEGORY_LOOKUP = CATEGORY_TAXONOMY.reduce((acc, cat) => {
  cat.subcategories.forEach((sub) => {
    acc[sub.id] = {
      label: sub.label,
      icon: sub.icon,
      parentCategoryId: cat.id,
      parentColor: cat.color,
      parentLabel: cat.label,
    };
  });
  return acc;
}, {});

export const TOP_LEVEL_CATEGORIES = [
  { id: 'all', label: 'All', color: '#FF6B00', icon: 'apps' },
  ...CATEGORY_TAXONOMY.map((cat, idx) => ({
    ...cat,
    label: cat.pillLabel,
    icon: `${cat.icon}-outline`,
    localImage: require(`../../assets/categories/cat_${(idx % 7) + 1}.png`),
  })),
];
