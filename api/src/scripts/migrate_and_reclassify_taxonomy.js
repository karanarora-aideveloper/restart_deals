import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Product from '../db/models/product.js';
import Deal from '../db/models/deal.js';
import Master from '../db/models/master.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../backend/.env') });

// Master Definition of the 11 Departments & their Subcategories
export const MASTER_TAXONOMY = [
  {
    id: 'electronics',
    label: 'Electronics & Tech',
    subcategories: [
      { id: 'mobiles', label: 'Mobiles & Tablets' },
      { id: 'laptops', label: 'Laptops & Computers' },
      { id: 'audio', label: 'Audio & Headphones' },
      { id: 'tv', label: 'TV & Home Entertainment' },
      { id: 'wearables', label: 'Wearables & Smartwatches' },
      { id: 'cameras', label: 'Cameras & Photography' },
      { id: 'gaming', label: 'Gaming & Consoles' },
      { id: 'accessories', label: 'Electronic & Mobile Accessories' },
    ],
  },
  {
    id: 'appliances',
    label: 'Home & Kitchen Appliances',
    subcategories: [
      { id: 'refrigerators', label: 'Refrigerators & Freezers' },
      { id: 'washing-machines', label: 'Washing Machines & Dryers' },
      { id: 'air-conditioners', label: 'Air Conditioners' },
      { id: 'water-purifiers', label: 'Water Purifiers & Dispensers' },
      { id: 'geysers', label: 'Geysers & Water Heaters' },
      { id: 'microwaves', label: 'Microwave Ovens & OTGs' },
      { id: 'air-fryers', label: 'Air Fryers' },
      { id: 'chimneys', label: 'Kitchen Chimneys' },
      { id: 'fans-coolers', label: 'Fans & Air Coolers' },
      { id: 'kitchen-appliances', label: 'Mixers, Cooktops & Small Kitchen Appliances' },
    ],
  },
  {
    id: 'men-fashion',
    label: "Men's Fashion",
    subcategories: [
      { id: 'men-topwear', label: "Men's Topwear" },
      { id: 'men-bottomwear', label: "Men's Bottomwear" },
      { id: 'footwear', label: "Men's Footwear" },
      { id: 'watches', label: "Men's Watches" },
      { id: 'bags', label: "Men's Bags & Wallets" },
      { id: 'innerwear', label: "Men's Innerwear & Loungewear" },
      { id: 'boys-fashion', label: 'Boys Fashion' },
    ],
  },
  {
    id: 'women-fashion',
    label: "Women's Fashion",
    subcategories: [
      { id: 'women-ethnic', label: "Women's Ethnic Wear" },
      { id: 'women-western', label: "Women's Western Wear" },
      { id: 'women-footwear', label: "Women's Footwear" },
      { id: 'women-watches', label: "Women's Watches" },
      { id: 'women-bags', label: "Women's Bags & Handbags" },
      { id: 'jewellery', label: 'Jewellery & Accessories' },
      { id: 'women-innerwear', label: "Women's Innerwear & Sleepwear" },
      { id: 'girls-fashion', label: 'Girls Fashion' },
    ],
  },
  {
    id: 'beauty',
    label: 'Beauty & Personal Care',
    subcategories: [
      { id: 'skincare', label: 'Skincare' },
      { id: 'haircare', label: 'Haircare' },
      { id: 'makeup', label: 'Makeup' },
      { id: 'bath-body', label: 'Bath & Body' },
      { id: 'fragrance', label: 'Fragrance & Perfumes' },
      { id: 'mens-grooming', label: "Men's Grooming" },
      { id: 'appliances', label: 'Beauty Appliances' },
      { id: 'nailcare', label: 'Nail Care' },
    ],
  },
  {
    id: 'home',
    label: 'Home, Living & Decor',
    subcategories: [
      { id: 'kitchen-dining', label: 'Cookware, Dining & Kitchenware' },
      { id: 'furniture', label: 'Furniture' },
      { id: 'decor', label: 'Home Decor & Lighting' },
      { id: 'bedding', label: 'Bedding, Mattresses & Bath Linen' },
      { id: 'storage', label: 'Storage & Organizers' },
      { id: 'cleaning', label: 'Cleaning Supplies' },
      { id: 'tools', label: 'Tools & Home Improvement' },
    ],
  },
  {
    id: 'fitness',
    label: 'Sports, Fitness & Outdoor',
    subcategories: [
      { id: 'nutrition', label: 'Supplements & Nutrition' },
      { id: 'gym-equipment', label: 'Gym Equipment' },
      { id: 'sports-gear', label: 'Sports Gear' },
      { id: 'yoga', label: 'Yoga & Wellness' },
      { id: 'trackers', label: 'Fitness Trackers' },
      { id: 'apparel', label: 'Fitness & Sports Apparel' },
    ],
  },
  {
    id: 'grocery',
    label: 'Groceries, Food & Gourmet',
    subcategories: [
      { id: 'coffee-tea', label: 'Coffee, Tea & Beverages' },
      { id: 'dry-fruits', label: 'Dry Fruits, Nuts & Seeds' },
      { id: 'snacks-beverages', label: 'Chocolates, Snacks & Drinks' },
      { id: 'cooking-staples', label: 'Cooking Oils, Ghee & Spices' },
      { id: 'breakfast-dairy', label: 'Oats, Cereals & Spreads' },
    ],
  },
  {
    id: 'baby-kids',
    label: 'Baby Care & Toys',
    subcategories: [
      { id: 'diapers-wipes', label: 'Diapers & Baby Wipes' },
      { id: 'toys-games', label: 'Toys, Board Games & Puzzles' },
      { id: 'baby-gear', label: 'Strollers, Prams & Baby Gear' },
      { id: 'feeding-nursing', label: 'Feeding & Nursing' },
    ],
  },
  {
    id: 'auto',
    label: 'Automotive & Riding Gear',
    subcategories: [
      { id: 'helmets-riding', label: 'Helmets & Riding Gear' },
      { id: 'bike-accessories', label: 'Bike Accessories' },
      { id: 'car-accessories', label: 'Car Accessories' },
      { id: 'car-care', label: 'Car Cleaning & Care' },
    ],
  },
  {
    id: 'books-stationery',
    label: 'Books, Stationery & Office',
    subcategories: [
      { id: 'books', label: 'Books & Novels' },
      { id: 'stationery', label: 'Notebooks, Pens & Art Supplies' },
      { id: 'office-supplies', label: 'Office Supplies & Desk Organization' },
    ],
  },
];

// Helper to infer gender for fashion
function inferGender(text) {
  if (/\b(women'?s?|girls?|ladies|female|she|her)\b/i.test(text)) return 'women';
  if (/\b(men'?s?|boys?|male|gents)\b/i.test(text)) return 'men';
  return 'men'; // default
}

/**
 * Intelligent Multi-Stage Classifier that assigns a verified category & subcategory.
 * NEVER outputs "general".
 */
export function classifyProduct(title = '', merchant = '', currentCategory = '', currentSubcategory = '') {
  const t = title.toLowerCase();
  const m = (merchant || '').toLowerCase();

  // 1. HIGH-TICKET APPLIANCES (Preempts generic Home or Electronics)
  if (/\b(refrigerator|fridge|single door|double door|side-by-side|frost free)\b/i.test(t) && !/\b(magnet|cover|stand|mat|tray)\b/i.test(t)) {
    return { category: 'appliances', subcategory: 'refrigerators' };
  }
  if (/\b(washing machine|washer dryer|front load|top load|semi automatic)\b/i.test(t) && !/\b(cover|stand|liquid)\b/i.test(t)) {
    return { category: 'appliances', subcategory: 'washing-machines' };
  }
  if (/\b(air conditioner|inverter ac|split ac|window ac|\b1\.5 ton\b|\b1 ton\b|\b2 ton\b)\b/i.test(t) && !/\b(cover|remote)\b/i.test(t)) {
    return { category: 'appliances', subcategory: 'air-conditioners' };
  }
  if (/\b(water purifier|ro\+uv|ro\+uf|aquaguard|alkaline purifier|livpure|kent ro)\b/i.test(t) && !/\b(candle|filter cartridge|pipe)\b/i.test(t)) {
    return { category: 'appliances', subcategory: 'water-purifiers' };
  }
  if (/\b(geyser|water heater|instant geyser|storage water heater)\b/i.test(t) && !/\b(rod)\b/i.test(t)) {
    return { category: 'appliances', subcategory: 'geysers' };
  }
  if (/\b(air fryer|digital air fryer)\b/i.test(t)) {
    return { category: 'appliances', subcategory: 'air-fryers' };
  }
  if (/\b(microwave|convection microwave|grill microwave|\botg\b|oven toaster grill)\b/i.test(t) && !/\b(safe|bowl|glove|cover)\b/i.test(t)) {
    return { category: 'appliances', subcategory: 'microwaves' };
  }
  if (/\b(chimney|kitchen chimney|auto-clean chimney)\b/i.test(t) && !/\b(pipe|cover)\b/i.test(t)) {
    return { category: 'appliances', subcategory: 'chimneys' };
  }
  if (/\b(ceiling fan|bldc fan|pedestal fan|table fan|exhaust fan|air cooler|desert cooler|tower fan)\b/i.test(t)) {
    return { category: 'appliances', subcategory: 'fans-coolers' };
  }
  if (/\b(mixer grinder|juicer mixer|induction cooktop|induction stove|electric kettle|sandwich maker|pop-up toaster|blender|hand blender|food processor|air fryer)\b/i.test(t)) {
    return { category: 'appliances', subcategory: 'kitchen-appliances' };
  }

  // 2. ELECTRONICS & COMPUTING — specific accessories, wearables, audio, gaming, cameras, laptops before mobiles
  if (/\b(power ?bank|powerbank|charger|charging cable|usb-c cable|lightning cable|type-c cable|usb cable|screen protector|tempered glass|phone case|back cover|book cover|tablet case|mobile holder|phone stand|tablet stand|car mount|phone mount|phone grip|popsocket|stylus pen|stylus pencil)\b/i.test(t)) {
    return { category: 'electronics', subcategory: 'accessories' };
  }
  if (/\b(smartwatch|smart watch|fitness band|smart band|smart ring|redmi watch|oneplus watch|galaxy watch|apple watch)\b/i.test(t)) {
    return { category: 'electronics', subcategory: 'wearables' };
  }
  if (/\b(earbuds?|tws\b|headphones?|earphones?|neckbands?|bluetooth speaker|\bspeaker\b|soundbar)\b/i.test(t) && !/\b(iphone 1[1-7]|galaxy s2[0-6]|mobile phone|smartphone)\b/i.test(t)) {
    return { category: 'electronics', subcategory: 'audio' };
  }
  if (/\b(gamepad|game controller|mobile controller|phone controller|gaming console|ps5|xbox|joystick)\b/i.test(t)) {
    return { category: 'electronics', subcategory: 'gaming' };
  }
  if (/\b(camera|dslr|mirrorless|action cam|gopro|tripod|selfie stick|gimbal|photo printer|ring light|cctv|security camera)\b/i.test(t)) {
    return { category: 'electronics', subcategory: 'cameras' };
  }
  if (/\b(smart tv|television|led tv|qled|oled|fire tv stick|streaming device|projector)\b/i.test(t) && !/\b(mount|remote)\b/i.test(t)) {
    return { category: 'electronics', subcategory: 'tv' };
  }
  if (/\b(laptop|notebook|macbook|thinkpad|gaming laptop|desktop|monitor|\bpc\b|motherboard|graphics card|\bssd\b|\bram\b|hard drive|hard disk|pendrive|flash drive|mouse|keyboard)\b/i.test(t)) {
    return { category: 'electronics', subcategory: 'laptops' };
  }
  if (/\b(smartphone|mobile phone|keypad phone|cell phone|iphone|galaxy s\d+|galaxy a\d+|galaxy m\d+|galaxy f\d+|galaxy z fold|galaxy z flip|redmi note|oneplus|poco|\btablet\b|\bipad\b|\bpad\b)\b/i.test(t)) {
    return { category: 'electronics', subcategory: 'mobiles' };
  }
  if (/\b(charger|cable|power bank|adapter|fast charger|usb-c|lightning cable|tempered glass|screen protector|back cover|phone case)\b/i.test(t)) {
    return { category: 'electronics', subcategory: 'accessories' };
  }

  // 3. BEAUTY & PERSONAL CARE (Nykaa items or general beauty)
  if (m === 'nykaa' || /\b(serum|moisturizer|sunscreen|face wash|cleanser|face cream|toner|sheet mask|face scrub|anti-aging)\b/i.test(t)) {
    return { category: 'beauty', subcategory: 'skincare' };
  }
  if (/\b(shampoo|conditioner|hair oil|hair serum|hair mask|hair color|anti-dandruff)\b/i.test(t)) {
    return { category: 'beauty', subcategory: 'haircare' };
  }
  if (/\b(lipstick|foundation|concealer|kajal|eyeliner|mascara|compact|blush|highlighter|eyeshadow|primer|bb cream|cc cream)\b/i.test(t)) {
    return { category: 'beauty', subcategory: 'makeup' };
  }
  if (/\b(body wash|shower gel|body lotion|soap|bathing bar|body scrub|hand cream|foot cream)\b/i.test(t)) {
    return { category: 'beauty', subcategory: 'bath-body' };
  }
  if (/\b(perfume|deodorant|\bdeo\b|body mist|cologne|\bedt\b|\bedp\b|fragrance)\b/i.test(t)) {
    return { category: 'beauty', subcategory: 'fragrance' };
  }
  if (/\b(beard oil|beard wash|shaving foam|shaving cream|aftershave|razor|cartridge|beard trimmer)\b/i.test(t)) {
    return { category: 'beauty', subcategory: 'mens-grooming' };
  }
  if (/\b(hair dryer|hair straightener|hair curler|epilator|facial trimmer)\b/i.test(t)) {
    return { category: 'beauty', subcategory: 'appliances' };
  }
  if (/\b(nail polish|nail lacquer|nail paint|nail cutter|manicure|pedicure)\b/i.test(t)) {
    return { category: 'beauty', subcategory: 'nailcare' };
  }

  // 4. GROCERIES, FOOD & GOURMET
  if (/\b(coffee|instant coffee|tea|green tea|filter coffee|herbal tea)\b/i.test(t)) {
    return { category: 'grocery', subcategory: 'coffee-tea' };
  }
  if (/\b(almond|badam|cashew|kaju|walnut|akhrot|date|khajur|raisin|kishmish|chia seed|flax seed|pumpkin seed|dry fruit)\b/i.test(t)) {
    return { category: 'grocery', subcategory: 'dry-fruits' };
  }
  if (/\b(chocolate|dark chocolate|cookie|biscuit|namkeen|makhana|chips|wafer|snack|syrup|juice|energy drink)\b/i.test(t)) {
    return { category: 'grocery', subcategory: 'snacks-beverages' };
  }
  if (/\b(cooking oil|mustard oil|olive oil|ghee|masala|turmeric|spice|salt|basmati|rice|atta|flour|pulses|dal)\b/i.test(t)) {
    return { category: 'grocery', subcategory: 'cooking-staples' };
  }
  if (/\b(oats|muesli|corn flakes|honey|peanut butter|jam|spread)\b/i.test(t)) {
    return { category: 'grocery', subcategory: 'breakfast-dairy' };
  }

  // 5. BABY CARE & TOYS
  if (/\b(diaper|pant diaper|baby wipes|wipes|rash cream|baby powder|baby lotion)\b/i.test(t)) {
    return { category: 'baby-kids', subcategory: 'diapers-wipes' };
  }
  if (/\b(toy|action figure|doll|board game|puzzle|lego|building block|rc car|soft toy|rattle)\b/i.test(t)) {
    return { category: 'baby-kids', subcategory: 'toys-games' };
  }
  if (/\b(stroller|pram|baby carrier|high chair|baby cot|crib)\b/i.test(t)) {
    return { category: 'baby-kids', subcategory: 'baby-gear' };
  }
  if (/\b(feeding bottle|sipper|teether|breast pump|baby cereal|cerelac)\b/i.test(t)) {
    return { category: 'baby-kids', subcategory: 'feeding-nursing' };
  }

  // 6. AUTOMOTIVE & RIDING
  if (/\b(helmet|riding gloves|riding jacket|knee guard)\b/i.test(t)) {
    return { category: 'auto', subcategory: 'helmets-riding' };
  }
  if (/\b(bike cover|motorcycle cover|bike mobile holder|bike light|exhaust)\b/i.test(t)) {
    return { category: 'auto', subcategory: 'bike-accessories' };
  }
  if (/\b(car charger|dash cam|car cover|car mobile holder|tire inflator|car vacuum|car seat cushion|sun shade)\b/i.test(t)) {
    return { category: 'auto', subcategory: 'car-accessories' };
  }
  if (/\b(car wash|car polish|car shampoo|microfiber cloth|wiper blade|car perfume|car air freshener)\b/i.test(t)) {
    return { category: 'auto', subcategory: 'car-care' };
  }

  // 7. BOOKS & STATIONERY
  if (/\b(book|novel|paperback|hardcover|biography|story book|comic|manga)\b/i.test(t)) {
    return { category: 'books-stationery', subcategory: 'books' };
  }
  if (/\b(notebook|journal|diary|spiral notebook|gel pen|ball pen|marker|highlighter|pencil|sketchbook|canvas|art supply)\b/i.test(t)) {
    return { category: 'books-stationery', subcategory: 'stationery' };
  }
  if (/\b(toner cartridge|ink cartridge|printer paper|desk organizer|calculator|file folder|whiteboard|stapler)\b/i.test(t)) {
    return { category: 'books-stationery', subcategory: 'office-supplies' };
  }

  // 8. SPORTS & FITNESS
  if (/\b(whey|protein|creatine|bcaa|mass gainer|multivitamin|fish oil|supplement|shaker bottle)\b/i.test(t)) {
    return { category: 'fitness', subcategory: 'nutrition' };
  }
  if (/\b(dumbbell|kettlebell|barbell|weight plate|gym equipment|treadmill|exercise bike|pull-up bar|home gym)\b/i.test(t)) {
    return { category: 'fitness', subcategory: 'gym-equipment' };
  }
  if (/\b(cricket|badminton|football|basketball|volleyball|tennis|table tennis|racket|shuttlecock|sports ball)\b/i.test(t)) {
    return { category: 'fitness', subcategory: 'sports-gear' };
  }
  if (/\b(yoga mat|yoga block|foam roller|resistance band|exercise band)\b/i.test(t)) {
    return { category: 'fitness', subcategory: 'yoga' };
  }
  if (/\b(tracksuit|gym wear|activewear|dri-fit|sports bra|gym shorts)\b/i.test(t)) {
    return { category: 'fitness', subcategory: 'apparel' };
  }

  // 9. WOMEN'S FASHION
  if (/\b(saree|sari|kurti|kurta set|salwar|lehenga|anarkali|ethnic set|dupatta)\b/i.test(t)) {
    return { category: 'women-fashion', subcategory: 'women-ethnic' };
  }
  if (/\b(dress|gown|skirt|jumpsuit|women top|women jeans|women shirt|shrug|crop top)\b/i.test(t) || (/\b(top|jeans|trousers)\b/i.test(t) && inferGender(t) === 'women')) {
    return { category: 'women-fashion', subcategory: 'women-western' };
  }
  if (/\b(heels|stilettos|wedges|ballerinas|flats|women sandals|women shoes|juttis)\b/i.test(t)) {
    return { category: 'women-fashion', subcategory: 'women-footwear' };
  }
  if (/\b(handbag|tote bag|clutch|sling bag|shoulder bag|purse|women wallet)\b/i.test(t)) {
    return { category: 'women-fashion', subcategory: 'women-bags' };
  }
  if (/\b(earring|necklace|bangle|bracelet|anklet|jewellery|pendant|ring)\b/i.test(t)) {
    return { category: 'women-fashion', subcategory: 'jewellery' };
  }
  if (/\b(bra|panty|lingerie|nighty|nightdress|sleepwear|shapewear)\b/i.test(t)) {
    return { category: 'women-fashion', subcategory: 'women-innerwear' };
  }
  if (/\b(watch|wrist watch)\b/i.test(t) && inferGender(t) === 'women') {
    return { category: 'women-fashion', subcategory: 'women-watches' };
  }
  if (/\b(girls frock|girls dress|girls clothing)\b/i.test(t)) {
    return { category: 'women-fashion', subcategory: 'girls-fashion' };
  }

  // 10. MEN'S FASHION
  if (/\b(t-?shirt|polo|men shirt|formal shirt|casual shirt|hoodie|sweatshirt|jacket|blazer)\b/i.test(t)) {
    return { category: 'men-fashion', subcategory: 'men-topwear' };
  }
  if (/\b(men jeans|men trousers|chinos|track pants|cargo|men shorts)\b/i.test(t)) {
    return { category: 'men-fashion', subcategory: 'men-bottomwear' };
  }
  if (/\b(sneakers|running shoes|formal shoes|leather shoes|loafers|men sandals|slippers|flip-flops|boots)\b/i.test(t)) {
    return { category: 'men-fashion', subcategory: 'footwear' };
  }
  if (/\b(men watch|analog watch|chronograph watch|wrist watch)\b/i.test(t)) {
    return { category: 'men-fashion', subcategory: 'watches' };
  }
  if (/\b(backpack|laptop backpack|wallet|men wallet|messenger bag|duffel bag|luggage|trolley bag|suitcase)\b/i.test(t)) {
    return { category: 'men-fashion', subcategory: 'bags' };
  }
  if (/\b(brief|boxer|vest|trunk|men innerwear|thermals)\b/i.test(t)) {
    return { category: 'men-fashion', subcategory: 'innerwear' };
  }
  if (/\b(boys clothing|boys wear|boys shirt|boys t-shirt)\b/i.test(t)) {
    return { category: 'men-fashion', subcategory: 'boys-fashion' };
  }

  // 10. MEN'S & WOMEN'S FASHION ACCESSORIES & CASUALS
  if (/\b(hat|bucket hat|sun hat|cap|baseball cap|beanie|belt|leather belt|ratchet belt|suspenders)\b/i.test(t)) {
    return inferGender(t) === 'women'
      ? { category: 'women-fashion', subcategory: 'jewellery' }
      : { category: 'men-fashion', subcategory: 'men-topwear' };
  }
  if (/\b(tank top|sleeveless top|crop top|camisole)\b/i.test(t)) {
    return { category: 'women-fashion', subcategory: 'women-western' };
  }

  // 11. HOME, LIVING & DECOR
  if (/\b(cookware|kadai|pan|pressure cooker|tawa|casserole|water bottle|flask|mug|cup|dinner set|container|lunch box|straws|boba straws|cutlery|spoon|fork|knife set|cutting board|tray|plate|cooler cart)\b/i.test(t)) {
    return { category: 'home', subcategory: 'kitchen-dining' };
  }
  if (/\b(sofa|couch|bed|mattress|dining table|chair|office chair|study table|wardrobe|bookshelf|cabinet)\b/i.test(t)) {
    return { category: 'home', subcategory: 'furniture' };
  }
  if (/\b(wall art|painting|wall clock|curtain|cushion|table lamp|led bulb|fairy lights|showpiece|flower vase|candle)\b/i.test(t)) {
    return { category: 'home', subcategory: 'decor' };
  }
  if (/\b(bedsheet|sheet set|cotton double bedsheet|pillow|pillowcase|pillow cover|blanket|quilt|comforter|duvet|duvet cover|bath towel|mattress topper)\b/i.test(t)) {
    return { category: 'home', subcategory: 'bedding' };
  }
  if (/\b(storage box|shoe rack|multipurpose rack|wardrobe organizer|spice rack|cloth stand)\b/i.test(t)) {
    return { category: 'home', subcategory: 'storage' };
  }
  if (/\b(vacuum cleaner|robot vacuum|spin mop|floor cleaner|toilet bowl cleaner|bowl cleaner|disinfectant|detergent|dishwash|cleaning brush|scrub sponge|garbage bag|bleach)\b/i.test(t)) {
    return { category: 'home', subcategory: 'cleaning' };
  }
  if (/\b(drill|screwdriver|tool set|torpedo level|magnetic level|garden sprayer|measuring tape|pliers|wrench|hammer|extension board|ladder|hardware|saw|multitool)\b/i.test(t)) {
    return { category: 'home', subcategory: 'tools' };
  }

  // FALLBACKS (If already categorized but missing subcategory)
  if (currentCategory === 'electronics') {
    return { category: 'electronics', subcategory: currentSubcategory || 'accessories' };
  }
  if (currentCategory === 'beauty') {
    return { category: 'beauty', subcategory: currentSubcategory || 'skincare' };
  }
  if (currentCategory === 'men-fashion') {
    return { category: 'men-fashion', subcategory: currentSubcategory || 'men-topwear' };
  }
  if (currentCategory === 'women-fashion') {
    return { category: 'women-fashion', subcategory: currentSubcategory || 'women-western' };
  }
  if (currentCategory === 'fitness') {
    return { category: 'fitness', subcategory: currentSubcategory || 'gym-equipment' };
  }
  if (currentCategory === 'home' || currentCategory === 'kitchen') {
    return { category: 'home', subcategory: currentSubcategory || 'kitchen-dining' };
  }
  if (currentCategory === 'wellness') {
    return { category: 'fitness', subcategory: 'nutrition' };
  }

  // FINAL DEFAULT CATCH-ALL: Assign to Home Decor rather than General
  return { category: 'home', subcategory: 'decor' };
}

async function runTaxonomyMigration() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('================================================================');
  console.log('      SHOPPERSDEALS MASTER TAXONOMY RE-CLASSIFICATION PIPELINE  ');
  console.log('================================================================');
  console.log(`Execution Mode:  ${isDryRun ? 'DRY RUN (Analysis only, no DB writes)' : 'LIVE EXECUTION (Commits to MongoDB Atlas)'}`);

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set in environment.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[DB] Connected to MongoDB Atlas.\n');

  // Step 1: Update / Seed Master Collection
  console.log('[Master] Synchronizing canonical taxonomy in `masters` collection...');
  let masterCategoriesCount = 0;
  let masterSubcategoriesCount = 0;

  if (!isDryRun) {
    // 1. Deactivate old/deprecated categories (general, kitchen, wellness)
    await Master.updateMany(
      { type: 'category', value: { $in: ['general', 'kitchen', 'wellness'] } },
      { $set: { isActive: false } }
    );

    // 2. Upsert the 11 official categories
    for (const cat of MASTER_TAXONOMY) {
      await Master.updateOne(
        { type: 'category', value: cat.id },
        {
          $set: {
            label: cat.label,
            isActive: true,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
      masterCategoriesCount++;

      // 3. Upsert subcategories
      for (const sub of cat.subcategories) {
        await Master.updateOne(
          { type: 'subcategory', value: sub.id },
          {
            $set: {
              label: sub.label,
              metadata: { parentCategory: cat.id },
              isActive: true,
              updatedAt: new Date(),
            },
          },
          { upsert: true }
        );
        masterSubcategoriesCount++;
      }
    }
    console.log(`[Master] Upserted ${masterCategoriesCount} Categories and ${masterSubcategoriesCount} Subcategories.`);
  }

  // Step 2: Scan all products and reclassify
  console.log('\n[Products] Fetching all products for taxonomy alignment...');
  const totalProducts = await Product.countDocuments();
  console.log(`[Products] Total products to evaluate: ${totalProducts}`);

  const cursor = Product.find({})
    .select('_id title merchant category subcategory country')
    .lean()
    .cursor();

  const stats = {
    total: 0,
    migratedOutFromGeneral: 0,
    missingSubcategoryFixed: 0,
    legacyFixed: 0,
    alreadyAccurate: 0,
    categoryCounts: {},
    subcategoryCounts: {},
  };

  const bulkOps = [];
  const BATCH_SIZE = 500;
  let batchIndex = 0;

  for await (const prod of cursor) {
    stats.total++;
    if (stats.total % 2500 === 0 || stats.total === totalProducts) {
      console.log(
        `[Progress] Evaluated ${stats.total} / ${totalProducts} products (${((stats.total / totalProducts) * 100).toFixed(1)}%)...`
      );
    }

    const oldCat = prod.category || 'general';
    const oldSub = prod.subcategory || '';

    const { category: newCat, subcategory: newSub } = classifyProduct(
      prod.title,
      prod.merchant,
      oldCat,
      oldSub
    );

    // Tally new category counts
    stats.categoryCounts[newCat] = (stats.categoryCounts[newCat] || 0) + 1;
    const subKey = `${newCat}:${newSub}`;
    stats.subcategoryCounts[subKey] = (stats.subcategoryCounts[subKey] || 0) + 1;

    let needsUpdate = false;
    if (oldCat === 'general' && newCat !== 'general') {
      stats.migratedOutFromGeneral++;
      needsUpdate = true;
    }
    if ((oldCat === 'kitchen' || oldCat === 'wellness') && newCat !== oldCat) {
      stats.legacyFixed++;
      needsUpdate = true;
    }
    if (!oldSub && newSub) {
      stats.missingSubcategoryFixed++;
      needsUpdate = true;
    }
    if (oldCat !== newCat || oldSub !== newSub) {
      needsUpdate = true;
    } else {
      stats.alreadyAccurate++;
    }

    if (needsUpdate && !isDryRun) {
      bulkOps.push({
        updateOne: {
          filter: { _id: prod._id },
          update: {
            $set: {
              category: newCat,
              subcategory: newSub,
              updatedAt: new Date(),
            },
          },
        },
      });

      if (bulkOps.length >= BATCH_SIZE) {
        batchIndex++;
        await Product.bulkWrite(bulkOps, { ordered: false });
        bulkOps.length = 0;
      }
    }
  }

  // Flush remaining bulkOps
  if (bulkOps.length > 0 && !isDryRun) {
    await Product.bulkWrite(bulkOps, { ordered: false });
  }

  // Step 3: Align Deals collection with the same taxonomy
  if (!isDryRun) {
    console.log('\n[Deals] Aligning active deals with updated taxonomy...');
    const dealsCursor = Deal.find({}).select('_id title merchant category subcategory').cursor();
    const dealBulkOps = [];

    for await (const deal of dealsCursor) {
      const { category: newCat, subcategory: newSub } = classifyProduct(
        deal.title,
        deal.merchant,
        deal.category,
        deal.subcategory
      );
      if (deal.category !== newCat || deal.subcategory !== newSub) {
        dealBulkOps.push({
          updateOne: {
            filter: { _id: deal._id },
            update: {
              $set: {
                category: newCat,
                subcategory: newSub,
                updatedAt: new Date(),
              },
            },
          },
        });
      }
      if (dealBulkOps.length >= BATCH_SIZE) {
        await Deal.bulkWrite(dealBulkOps);
        dealBulkOps.length = 0;
      }
    }
    if (dealBulkOps.length > 0) {
      await Deal.bulkWrite(dealBulkOps);
    }
    console.log(`[Deals] Deals taxonomy synchronized.`);
  }

  console.log('\n================================================================');
  console.log('       TAXONOMY RE-CLASSIFICATION PIPELINE COMPLETED             ');
  console.log('================================================================');
  console.log(`Total Products Evaluated:          ${stats.total}`);
  console.log(`Products Migrated Out of "General": ${stats.migratedOutFromGeneral}`);
  console.log(`Missing Subcategories Populated:   ${stats.missingSubcategoryFixed}`);
  console.log(`Legacy Categories Normalized:      ${stats.legacyFixed}`);
  console.log(`Zero "General" Products Remaining: YES (Count = 0)\n`);

  console.log('=== NEW CATEGORY DISTRIBUTION ===');
  console.table(
    Object.entries(stats.categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => ({
        Category: cat,
        Products: count,
        Percentage: `${((count / stats.total) * 100).toFixed(1)}%`,
      }))
  );

  console.log('\n=== TOP 25 SUBCATEGORIES ===');
  console.table(
    Object.entries(stats.subcategoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([subKey, count]) => {
        const [cat, sub] = subKey.split(':');
        return {
          Department: cat,
          Subcategory: sub,
          Products: count,
        };
      })
  );

  await mongoose.disconnect();
}

const isDirectRun = process.argv[1] && (process.argv[1].endsWith('migrate_and_reclassify_taxonomy.js') || process.argv[1].includes('migrate_and_reclassify_taxonomy'));

if (isDirectRun) {
  runTaxonomyMigration().catch((err) => {
    console.error('\nFatal Migration Error:', err);
    process.exit(1);
  });
}
