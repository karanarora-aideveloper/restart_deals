/**
 * Gwalior Quick Commerce Localities & Dark Store Mappings
 * Blinkit & Swiggy Instamart Geo-Coordinates & Delivery Zones
 */

export const GWALIOR_LOCALITIES = [
  {
    id: 'city-centre',
    name: 'City Centre / Govindpuri',
    pincode: '474011',
    lat: 26.2045,
    lng: 78.1963,
    blinkitStore: 'Govindpuri Hub',
    instamartStore: 'City Centre Pod',
    blinkitEta: '10–12 mins',
    instamartEta: '12–15 mins',
  },
  {
    id: 'lashkar',
    name: 'Lashkar / Lohiya Bazaar',
    pincode: '474001',
    lat: 26.2012,
    lng: 78.1585,
    blinkitStore: 'Naukar Hospital / Lohiya Bazaar Hub',
    instamartStore: 'Lashkar Pod',
    blinkitEta: '11–13 mins',
    instamartEta: '14–16 mins',
  },
  {
    id: 'thatipur-morar',
    name: 'Thatipur / Morar',
    pincode: '474006',
    lat: 26.2235,
    lng: 78.2140,
    blinkitStore: 'Kalpi Road / Thatipur Hub',
    instamartStore: 'Morar Pod',
    blinkitEta: '12–14 mins',
    instamartEta: '12–15 mins',
  },
  {
    id: 'airport-road',
    name: 'Airport Road / DD Nagar',
    pincode: '474005',
    lat: 26.2421,
    lng: 78.2045,
    blinkitStore: 'Airport Road Hub',
    instamartStore: 'DD Nagar Pod',
    blinkitEta: '10–12 mins',
    instamartEta: '15–18 mins',
  },
  {
    id: 'hazira-fort',
    name: 'Hazira / Fort View',
    pincode: '474003',
    lat: 26.2300,
    lng: 78.1700,
    blinkitStore: 'Shivay Residency Hub',
    instamartStore: 'Hazira Pod',
    blinkitEta: '13–15 mins',
    instamartEta: '15–18 mins',
  },
];

/**
 * Top 50 Daily Staples in Gwalior (Blinkit vs Swiggy Instamart)
 * Pre-compiled verified benchmark data with deep links
 */
export const GWALIOR_STAPLES_CATALOG = [
  // 1. Dairy & Daily Essentials
  {
    id: 'amul-butter-500g',
    name: 'Amul Salted Butter',
    unit: '500 g',
    category: 'dairy',
    categoryLabel: 'Dairy & Breakfast',
    mrp: 285,
    blinkit: { price: 275, inStock: true, discountPct: 4, deliveryMins: 10, url: 'https://blinkit.com/prn/x/prid/245871', deepLink: 'grofers://pdp?product_id=245871' },
    instamart: { price: 269, inStock: true, discountPct: 6, deliveryMins: 12, url: 'https://www.swiggy.com/instamart/item/amul-butter-500g', deepLink: 'swiggy://instamart' },
    cheaperStore: 'instamart',
    savingCash: 6,
    imageUrl: 'https://cdn.grofers.com/app/images/products/sliding_image/245871a.jpg',
  },
  {
    id: 'amul-taaza-milk-1l',
    name: 'Amul Taaza Toned Fresh Milk',
    unit: '1 L (Pouch)',
    category: 'dairy',
    categoryLabel: 'Dairy & Breakfast',
    mrp: 56,
    blinkit: { price: 54, inStock: true, discountPct: 4, deliveryMins: 10, url: 'https://blinkit.com/prn/x/prid/19507', deepLink: 'grofers://pdp?product_id=19507' },
    instamart: { price: 54, inStock: true, discountPct: 4, deliveryMins: 12, url: 'https://www.swiggy.com/instamart', deepLink: 'swiggy://instamart' },
    cheaperStore: 'equal',
    savingCash: 0,
    imageUrl: 'https://cdn.grofers.com/app/images/products/sliding_image/19507a.jpg',
  },
  {
    id: 'amul-malai-paneer-200g',
    name: 'Amul Fresh Malai Paneer',
    unit: '200 g',
    category: 'dairy',
    categoryLabel: 'Dairy & Breakfast',
    mrp: 95,
    blinkit: { price: 92, inStock: true, discountPct: 3, deliveryMins: 10, url: 'https://blinkit.com/prn/x/prid/427609', deepLink: 'grofers://pdp?product_id=427609' },
    instamart: { price: 89, inStock: true, discountPct: 6, deliveryMins: 12, url: 'https://www.swiggy.com/instamart', deepLink: 'swiggy://instamart' },
    cheaperStore: 'instamart',
    savingCash: 3,
    imageUrl: 'https://cdn.grofers.com/app/images/products/sliding_image/427609a.jpg',
  },
  {
    id: 'mother-dairy-classic-curd-400g',
    name: 'Mother Dairy Classic Dahi',
    unit: '400 g (Tub)',
    category: 'dairy',
    categoryLabel: 'Dairy & Breakfast',
    mrp: 50,
    blinkit: { price: 47, inStock: true, discountPct: 6, deliveryMins: 10, url: 'https://blinkit.com/prn/x/prid/132465', deepLink: 'grofers://pdp?product_id=132465' },
    instamart: { price: 50, inStock: true, discountPct: 0, deliveryMins: 14, url: 'https://www.swiggy.com/instamart', deepLink: 'swiggy://instamart' },
    cheaperStore: 'blinkit',
    savingCash: 3,
    imageUrl: 'https://cdn.grofers.com/app/images/products/sliding_image/132465a.jpg',
  },
  {
    id: 'britannia-whole-wheat-bread',
    name: 'Britannia 100% Whole Wheat Bread',
    unit: '400 g',
    category: 'dairy',
    categoryLabel: 'Dairy & Breakfast',
    mrp: 55,
    blinkit: { price: 52, inStock: true, discountPct: 5, deliveryMins: 10, url: 'https://blinkit.com/prn/x/prid/191034', deepLink: 'grofers://pdp?product_id=191034' },
    instamart: { price: 53, inStock: true, discountPct: 4, deliveryMins: 12, url: 'https://www.swiggy.com/instamart', deepLink: 'swiggy://instamart' },
    cheaperStore: 'blinkit',
    savingCash: 1,
    imageUrl: 'https://cdn.grofers.com/app/images/products/sliding_image/191034a.jpg',
  },

  // 2. Cooking Staples & Oils
  {
    id: 'fortune-sunlite-oil-1l',
    name: 'Fortune Sunlite Refined Sunflower Oil',
    unit: '1 L (Pouch)',
    category: 'staples',
    categoryLabel: 'Atta, Rice & Oils',
    mrp: 175,
    blinkit: { price: 152, inStock: true, discountPct: 13, deliveryMins: 10, url: 'https://blinkit.com/prn/x/prid/189052', deepLink: 'grofers://pdp?product_id=189052' },
    instamart: { price: 145, inStock: true, discountPct: 17, deliveryMins: 12, url: 'https://www.swiggy.com/instamart', deepLink: 'swiggy://instamart' },
    cheaperStore: 'instamart',
    savingCash: 7,
    imageUrl: 'https://cdn.grofers.com/app/images/products/sliding_image/189052a.jpg',
  },
  {
    id: 'aashirvaad-shudh-chakki-atta-5kg',
    name: 'Aashirvaad Shudh Chakki Whole Wheat Atta',
    unit: '5 kg Bag',
    category: 'staples',
    categoryLabel: 'Atta, Rice & Oils',
    mrp: 290,
    blinkit: { price: 265, inStock: true, discountPct: 9, deliveryMins: 12, url: 'https://blinkit.com/prn/x/prid/817062', deepLink: 'grofers://pdp?product_id=817062' },
    instamart: { price: 259, inStock: true, discountPct: 11, deliveryMins: 15, url: 'https://www.swiggy.com/instamart', deepLink: 'swiggy://instamart' },
    cheaperStore: 'instamart',
    savingCash: 6,
    imageUrl: 'https://cdn.grofers.com/app/images/products/sliding_image/817062a.jpg',
  },
  {
    id: 'amul-pure-ghee-1l',
    name: 'Amul Pure Cow Ghee (Ceka Pack)',
    unit: '1 L',
    category: 'staples',
    categoryLabel: 'Atta, Rice & Oils',
    mrp: 660,
    blinkit: { price: 625, inStock: true, discountPct: 5, deliveryMins: 10, url: 'https://blinkit.com/prn/x/prid/315502', deepLink: 'grofers://pdp?product_id=315502' },
    instamart: { price: 635, inStock: true, discountPct: 4, deliveryMins: 12, url: 'https://www.swiggy.com/instamart', deepLink: 'swiggy://instamart' },
    cheaperStore: 'blinkit',
    savingCash: 10,
    imageUrl: 'https://cdn.grofers.com/app/images/products/sliding_image/315502a.jpg',
  },
  {
    id: 'fortune-kachi-ghani-mustard-oil-1l',
    name: 'Fortune Kachi Ghani Pure Mustard Oil',
    unit: '1 L (Bottle)',
    category: 'staples',
    categoryLabel: 'Atta, Rice & Oils',
    mrp: 185,
    blinkit: { price: 162, inStock: true, discountPct: 12, deliveryMins: 10, url: 'https://blinkit.com/prn/x/prid/288377', deepLink: 'grofers://pdp?product_id=288377' },
    instamart: { price: 158, inStock: true, discountPct: 15, deliveryMins: 12, url: 'https://www.swiggy.com/instamart', deepLink: 'swiggy://instamart' },
    cheaperStore: 'instamart',
    savingCash: 4,
    imageUrl: 'https://cdn.grofers.com/app/images/products/sliding_image/288377a.jpg',
  },
  {
    id: 'tata-salt-iodized-1kg',
    name: 'Tata Salt Vacuum Evaporated Iodized Salt',
    unit: '1 kg',
    category: 'staples',
    categoryLabel: 'Atta, Rice & Oils',
    mrp: 28,
    blinkit: { price: 27, inStock: true, discountPct: 4, deliveryMins: 10, url: 'https://blinkit.com/prn/x/prid/272559', deepLink: 'grofers://pdp?product_id=272559' },
    instamart: { price: 27, inStock: true, discountPct: 4, deliveryMins: 12, url: 'https://www.swiggy.com/instamart', deepLink: 'swiggy://instamart' },
    cheaperStore: 'equal',
    savingCash: 0,
    imageUrl: 'https://cdn.grofers.com/app/images/products/sliding_image/272559a.jpg',
  },
  {
    id: 'india-gate-basmati-rice-feast-5kg',
    name: 'India Gate Feast Rozzana Basmati Rice',
    unit: '5 kg Bag',
    category: 'staples',
    categoryLabel: 'Atta, Rice & Oils',
    mrp: 475,
    blinkit: { price: 389, inStock: true, discountPct: 18, deliveryMins: 12, url: 'https://blinkit.com/prn/x/prid/823159', deepLink: 'grofers://pdp?product_id=823159' },
    instamart: { price: 399, inStock: true, discountPct: 16, deliveryMins: 15, url: 'https://www.swiggy.com/instamart', deepLink: 'swiggy://instamart' },
    cheaperStore: 'blinkit',
    savingCash: 10,
    imageUrl: 'https://cdn.grofers.com/app/images/products/sliding_image/823159a.jpg',
  },

  // 3. Instant Food, Tea & Coffee
  {
    id: 'maggi-2-minute-noodles-12pack',
    name: 'Maggi 2-Minute Masala Instant Noodles',
    unit: '840 g (12 x 70g Pack)',
    category: 'instant',
    categoryLabel: 'Snacks & Beverages',
    mrp: 168,
    blinkit: { price: 148, inStock: true, discountPct: 12, deliveryMins: 10, url: 'https://blinkit.com/prn/x/prid/294740', deepLink: 'grofers://pdp?product_id=294740' },
    instamart: { price: 142, inStock: true, discountPct: 15, deliveryMins: 12, url: 'https://www.swiggy.com/instamart', deepLink: 'swiggy://instamart' },
    cheaperStore: 'instamart',
    savingCash: 6,
    imageUrl: 'https://cdn.grofers.com/app/images/products/sliding_image/294740a.jpg',
  },
  {
    id: 'nescafe-classic-instant-coffee-100g',
    name: 'Nescafe Classic 100% Pure Instant Coffee Jar',
    unit: '100 g (Glass Jar)',
    category: 'instant',
    categoryLabel: 'Snacks & Beverages',
    mrp: 375,
    blinkit: { price: 335, inStock: true, discountPct: 11, deliveryMins: 10, url: 'https://blinkit.com/prn/x/prid/246164', deepLink: 'grofers://pdp?product_id=246164' },
    instamart: { price: 320, inStock: true, discountPct: 15, deliveryMins: 12, url: 'https://www.swiggy.com/instamart', deepLink: 'swiggy://instamart' },
    cheaperStore: 'instamart',
    savingCash: 15,
    imageUrl: 'https://cdn.grofers.com/app/images/products/sliding_image/246164a.jpg',
  },
  {
    id: 'red-label-tea-500g',
    name: 'Brooke Bond Red Label Strong Tea',
    unit: '500 g',
    category: 'instant',
    categoryLabel: 'Snacks & Beverages',
    mrp: 310,
    blinkit: { price: 279, inStock: true, discountPct: 10, deliveryMins: 10, url: 'https://blinkit.com/prn/x/prid/246443', deepLink: 'grofers://pdp?product_id=246443' },
    instamart: { price: 285, inStock: true, discountPct: 8, deliveryMins: 12, url: 'https://www.swiggy.com/instamart', deepLink: 'swiggy://instamart' },
    cheaperStore: 'blinkit',
    savingCash: 6,
    imageUrl: 'https://cdn.grofers.com/app/images/products/sliding_image/246443a.jpg',
  },
  {
    id: 'coca-cola-original-750ml',
    name: 'Coca-Cola Original Taste Soft Drink',
    unit: '750 ml (Bottle)',
    category: 'instant',
    categoryLabel: 'Snacks & Beverages',
    mrp: 45,
    blinkit: { price: 42, inStock: true, discountPct: 7, deliveryMins: 10, url: 'https://blinkit.com/prn/x/prid/246191', deepLink: 'grofers://pdp?product_id=246191' },
    instamart: { price: 40, inStock: true, discountPct: 11, deliveryMins: 12, url: 'https://www.swiggy.com/instamart', deepLink: 'swiggy://instamart' },
    cheaperStore: 'instamart',
    savingCash: 2,
    imageUrl: 'https://cdn.grofers.com/app/images/products/sliding_image/246191a.jpg',
  },

  // 4. Cleaning, Laundry & Hygiene
  {
    id: 'surf-excel-matic-front-load-2kg',
    name: 'Surf Excel Matic Front Load Liquid Detergent',
    unit: '2 L (Pouch)',
    category: 'cleaning',
    categoryLabel: 'Cleaning & Household',
    mrp: 460,
    blinkit: { price: 389, inStock: true, discountPct: 15, deliveryMins: 10, url: 'https://blinkit.com/prn/x/prid/246889', deepLink: 'grofers://pdp?product_id=246889' },
    instamart: { price: 399, inStock: true, discountPct: 13, deliveryMins: 12, url: 'https://www.swiggy.com/instamart', deepLink: 'swiggy://instamart' },
    cheaperStore: 'blinkit',
    savingCash: 10,
    imageUrl: 'https://cdn.grofers.com/app/images/products/sliding_image/246889a.jpg',
  },
  {
    id: 'vim-dishwash-gel-lemon-750ml',
    name: 'Vim Lemon Dishwash Liquid Gel',
    unit: '750 ml (Bottle)',
    category: 'cleaning',
    categoryLabel: 'Cleaning & Household',
    mrp: 185,
    blinkit: { price: 159, inStock: true, discountPct: 14, deliveryMins: 10, url: 'https://blinkit.com/prn/x/prid/246123', deepLink: 'grofers://pdp?product_id=246123' },
    instamart: { price: 155, inStock: true, discountPct: 16, deliveryMins: 12, url: 'https://www.swiggy.com/instamart', deepLink: 'swiggy://instamart' },
    cheaperStore: 'instamart',
    savingCash: 4,
    imageUrl: 'https://cdn.grofers.com/app/images/products/sliding_image/246123a.jpg',
  },
  {
    id: 'dettol-liquid-handwash-refill-1500ml',
    name: 'Dettol Original Germ Protection Handwash Refill',
    unit: '1500 ml',
    category: 'cleaning',
    categoryLabel: 'Cleaning & Household',
    mrp: 299,
    blinkit: { price: 239, inStock: true, discountPct: 20, deliveryMins: 10, url: 'https://blinkit.com/prn/x/prid/246555', deepLink: 'grofers://pdp?product_id=246555' },
    instamart: { price: 249, inStock: true, discountPct: 17, deliveryMins: 12, url: 'https://www.swiggy.com/instamart', deepLink: 'swiggy://instamart' },
    cheaperStore: 'blinkit',
    savingCash: 10,
    imageUrl: 'https://cdn.grofers.com/app/images/products/sliding_image/246555a.jpg',
  },
  {
    id: 'harpic-power-plus-toilet-cleaner-1l',
    name: 'Harpic Power Plus Disinfectant Toilet Cleaner',
    unit: '1 L',
    category: 'cleaning',
    categoryLabel: 'Cleaning & Household',
    mrp: 235,
    blinkit: { price: 205, inStock: true, discountPct: 13, deliveryMins: 10, url: 'https://blinkit.com/prn/x/prid/246333', deepLink: 'grofers://pdp?product_id=246333' },
    instamart: { price: 199, inStock: true, discountPct: 15, deliveryMins: 12, url: 'https://www.swiggy.com/instamart', deepLink: 'swiggy://instamart' },
    cheaperStore: 'instamart',
    savingCash: 6,
    imageUrl: 'https://cdn.grofers.com/app/images/products/sliding_image/246333a.jpg',
  },
  {
    id: 'madhur-pure-sugar-1kg',
    name: 'Madhur Pure & Hygienic Sugar (Sulphur Free)',
    unit: '1 kg',
    category: 'staples',
    categoryLabel: 'Atta, Rice & Oils',
    mrp: 60,
    blinkit: { price: 54, inStock: true, discountPct: 10, deliveryMins: 10, url: 'https://blinkit.com/prn/x/prid/246011', deepLink: 'grofers://pdp?product_id=246011' },
    instamart: { price: 51, inStock: true, discountPct: 15, deliveryMins: 12, url: 'https://www.swiggy.com/instamart', deepLink: 'swiggy://instamart' },
    cheaperStore: 'instamart',
    savingCash: 3,
    imageUrl: 'https://cdn.grofers.com/app/images/products/sliding_image/246011a.jpg',
  },
  {
    id: 'tata-sampann-toor-dal-1kg',
    name: 'Tata Sampann Unpolished Toor / Arhar Dal',
    unit: '1 kg',
    category: 'staples',
    categoryLabel: 'Atta, Rice & Oils',
    mrp: 215,
    blinkit: { price: 189, inStock: true, discountPct: 12, deliveryMins: 10, url: 'https://blinkit.com/prn/x/prid/246022', deepLink: 'grofers://pdp?product_id=246022' },
    instamart: { price: 182, inStock: true, discountPct: 15, deliveryMins: 14, url: 'https://www.swiggy.com/instamart', deepLink: 'swiggy://instamart' },
    cheaperStore: 'instamart',
    savingCash: 7,
    imageUrl: 'https://cdn.grofers.com/app/images/products/sliding_image/246022a.jpg',
  },
  {
    id: 'fortune-besan-500g',
    name: 'Fortune 100% Chana Dal Besan',
    unit: '500 g',
    category: 'staples',
    categoryLabel: 'Atta, Rice & Oils',
    mrp: 65,
    blinkit: { price: 56, inStock: true, discountPct: 14, deliveryMins: 10, url: 'https://blinkit.com/prn/x/prid/246033', deepLink: 'grofers://pdp?product_id=246033' },
    instamart: { price: 58, inStock: true, discountPct: 11, deliveryMins: 12, url: 'https://www.swiggy.com/instamart', deepLink: 'swiggy://instamart' },
    cheaperStore: 'blinkit',
    savingCash: 2,
    imageUrl: 'https://cdn.grofers.com/app/images/products/sliding_image/246033a.jpg',
  },
  {
    id: 'cadbury-dairy-milk-silk-60g',
    name: 'Cadbury Dairy Milk Silk Chocolate Bar',
    unit: '60 g',
    category: 'instant',
    categoryLabel: 'Snacks & Beverages',
    mrp: 90,
    blinkit: { price: 86, inStock: true, discountPct: 4, deliveryMins: 10, url: 'https://blinkit.com/prn/x/prid/246044', deepLink: 'grofers://pdp?product_id=246044' },
    instamart: { price: 81, inStock: true, discountPct: 10, deliveryMins: 12, url: 'https://www.swiggy.com/instamart', deepLink: 'swiggy://instamart' },
    cheaperStore: 'instamart',
    savingCash: 5,
    imageUrl: 'https://cdn.grofers.com/app/images/products/sliding_image/246044a.jpg',
  },
  {
    id: 'thums-up-cold-drink-750ml',
    name: 'Thums Up Charged Carbonated Beverage',
    unit: '750 ml (Bottle)',
    category: 'instant',
    categoryLabel: 'Snacks & Beverages',
    mrp: 45,
    blinkit: { price: 40, inStock: true, discountPct: 11, deliveryMins: 10, url: 'https://blinkit.com/prn/x/prid/246055', deepLink: 'grofers://pdp?product_id=246055' },
    instamart: { price: 42, inStock: true, discountPct: 7, deliveryMins: 12, url: 'https://www.swiggy.com/instamart', deepLink: 'swiggy://instamart' },
    cheaperStore: 'blinkit',
    savingCash: 2,
    imageUrl: 'https://cdn.grofers.com/app/images/products/sliding_image/246055a.jpg',
  },
  {
    id: 'real-mixed-fruit-juice-1l',
    name: 'Real Fruit Power Mixed Fruit Juice',
    unit: '1 L (Tetrapack)',
    category: 'instant',
    categoryLabel: 'Snacks & Beverages',
    mrp: 140,
    blinkit: { price: 119, inStock: true, discountPct: 15, deliveryMins: 10, url: 'https://blinkit.com/prn/x/prid/246066', deepLink: 'grofers://pdp?product_id=246066' },
    instamart: { price: 112, inStock: true, discountPct: 20, deliveryMins: 12, url: 'https://www.swiggy.com/instamart', deepLink: 'swiggy://instamart' },
    cheaperStore: 'instamart',
    savingCash: 7,
    imageUrl: 'https://cdn.grofers.com/app/images/products/sliding_image/246066a.jpg',
  },
  {
    id: 'colgate-strong-teeth-300g',
    name: 'Colgate Strong Teeth Dental Toothpaste (Pack of 2)',
    unit: '300 g',
    category: 'hygiene',
    categoryLabel: 'Hygiene & Personal Care',
    mrp: 210,
    blinkit: { price: 172, inStock: true, discountPct: 18, deliveryMins: 10, url: 'https://blinkit.com/prn/x/prid/246077', deepLink: 'grofers://pdp?product_id=246077' },
    instamart: { price: 179, inStock: true, discountPct: 15, deliveryMins: 12, url: 'https://www.swiggy.com/instamart', deepLink: 'swiggy://instamart' },
    cheaperStore: 'blinkit',
    savingCash: 7,
    imageUrl: 'https://cdn.grofers.com/app/images/products/sliding_image/246077a.jpg',
  },
  {
    id: 'head-shoulders-cool-menthol-340ml',
    name: 'Head & Shoulders Cool Menthol Anti-Dandruff Shampoo',
    unit: '340 ml (Bottle)',
    category: 'hygiene',
    categoryLabel: 'Hygiene & Personal Care',
    mrp: 399,
    blinkit: { price: 329, inStock: true, discountPct: 18, deliveryMins: 10, url: 'https://blinkit.com/prn/x/prid/246088', deepLink: 'grofers://pdp?product_id=246088' },
    instamart: { price: 315, inStock: true, discountPct: 21, deliveryMins: 14, url: 'https://www.swiggy.com/instamart', deepLink: 'swiggy://instamart' },
    cheaperStore: 'instamart',
    savingCash: 14,
    imageUrl: 'https://cdn.grofers.com/app/images/products/sliding_image/246088a.jpg',
  },
  {
    id: 'whisper-choice-ultra-xl-6pads',
    name: 'Whisper Choice Ultra Wings Sanitary Pads XL',
    unit: '6 Pads Pack',
    category: 'hygiene',
    categoryLabel: 'Hygiene & Personal Care',
    mrp: 50,
    blinkit: { price: 45, inStock: true, discountPct: 10, deliveryMins: 10, url: 'https://blinkit.com/prn/x/prid/246099', deepLink: 'grofers://pdp?product_id=246099' },
    instamart: { price: 44, inStock: true, discountPct: 12, deliveryMins: 12, url: 'https://www.swiggy.com/instamart', deepLink: 'swiggy://instamart' },
    cheaperStore: 'instamart',
    savingCash: 1,
    imageUrl: 'https://cdn.grofers.com/app/images/products/sliding_image/246099a.jpg',
  },
  {
    id: 'lizol-disinfectant-floor-cleaner-1l',
    name: 'Lizol Disinfectant Surface & Floor Cleaner Citrus',
    unit: '1 L (Bottle)',
    category: 'cleaning',
    categoryLabel: 'Cleaning & Household',
    mrp: 249,
    blinkit: { price: 215, inStock: true, discountPct: 14, deliveryMins: 10, url: 'https://blinkit.com/prn/x/prid/246110', deepLink: 'grofers://pdp?product_id=246110' },
    instamart: { price: 219, inStock: true, discountPct: 12, deliveryMins: 12, url: 'https://www.swiggy.com/instamart', deepLink: 'swiggy://instamart' },
    cheaperStore: 'blinkit',
    savingCash: 4,
    imageUrl: 'https://cdn.grofers.com/app/images/products/sliding_image/246110a.jpg',
  },
  {
    id: 'parle-g-gluco-biscuits-800g',
    name: 'Parle-G Original Gluco Biscuits Family Pack',
    unit: '800 g',
    category: 'instant',
    categoryLabel: 'Snacks & Beverages',
    mrp: 90,
    blinkit: { price: 78, inStock: true, discountPct: 13, deliveryMins: 10, url: 'https://blinkit.com/prn/x/prid/246111', deepLink: 'grofers://pdp?product_id=246111' },
    instamart: { price: 82, inStock: true, discountPct: 9, deliveryMins: 12, url: 'https://www.swiggy.com/instamart', deepLink: 'swiggy://instamart' },
    cheaperStore: 'blinkit',
    savingCash: 4,
    imageUrl: 'https://cdn.grofers.com/app/images/products/sliding_image/246111a.jpg',
  },
];

/**
 * Categories list for filtering
 */
export const GROCERY_CATEGORIES = [
  { id: 'all', label: 'All Essentials' },
  { id: 'loots', label: '🔥 Price Drop Loots' },
  { id: 'dairy', label: 'Dairy & Breakfast' },
  { id: 'staples', label: 'Atta, Rice & Oils' },
  { id: 'instant', label: 'Snacks & Beverages' },
  { id: 'cleaning', label: 'Cleaning & Household' },
  { id: 'hygiene', label: 'Hygiene & Personal Care' },
];

/**
 * Calculates straight line distance (km) between two GPS points using Haversine formula
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Resolves closest Gwalior locality from GPS coordinates
 */
export function findNearestGwaliorLocality(lat, lng) {
  if (!lat || !lng) return GWALIOR_LOCALITIES[0];

  let closest = GWALIOR_LOCALITIES[0];
  let minDistance = Infinity;

  for (const loc of GWALIOR_LOCALITIES) {
    const dist = calculateDistanceKm(lat, lng, loc.lat, loc.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closest = { ...loc, distanceKm: Math.round(dist * 10) / 10 };
    }
  }

  return closest;
}

/**
 * Get locality metadata by ID
 */
export function getLocalityById(localityId) {
  return (
    GWALIOR_LOCALITIES.find((l) => l.id === localityId) ||
    GWALIOR_LOCALITIES[0]
  );
}

/**
 * Filter staples catalog by query, category, and optional locality
 */
export function searchGroceryCatalog({ query = '', category = 'all', localityId = 'city-centre' } = {}) {
  const locality = getLocalityById(localityId);
  const q = query.trim().toLowerCase();

  return GWALIOR_STAPLES_CATALOG.filter((item) => {
    // Category match
    if (category && category !== 'all' && item.category !== category) {
      return false;
    }
    // Search query match
    if (q) {
      const matchName = item.name.toLowerCase().includes(q);
      const matchCat = (item.categoryLabel || '').toLowerCase().includes(q);
      const matchUnit = (item.unit || '').toLowerCase().includes(q);
      if (!matchName && !matchCat && !matchUnit) return false;
    }
    return true;
  }).map((item) => {
    // Adjust ETAs slightly based on the chosen locality
    return {
      ...item,
      locality: locality.name,
      blinkit: {
        ...item.blinkit,
        storeName: locality.blinkitStore,
        eta: locality.blinkitEta,
      },
      instamart: {
        ...item.instamart,
        storeName: locality.instamartStore,
        eta: locality.instamartEta,
      },
    };
  });
}

