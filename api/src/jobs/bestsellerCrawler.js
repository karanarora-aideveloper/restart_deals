import cron from 'node-cron';
import * as cheerio from 'cheerio';
import Product from '../db/models/product.js';
import Deal from '../db/models/deal.js';
import CrawlerSeed from '../db/models/crawlerSeed.js';
import CrawlerConfig from '../db/models/crawlerConfig.js';
import CrawlerRunLog from '../db/models/crawlerRunLog.js';
import { apiCache } from '../utils/cache.js';
import { scraperQueue, PRIORITY } from '../services/scraperQueue.js';
import { meetsCategoryThreshold } from '../utils/categoryThresholds.js';
import { enqueueDealForPublishing } from '../services/dealPublishQueue.js';
import { evaluateAndTriggerPriceAlerts } from '../utils/priceAlertNotifier.js';
import { classifyProduct } from '../utils/categoryClassifier.js';
import ScrapingAntToken from '../db/models/scrapingAntToken.js';
import { recordEngineHeartbeat } from '../utils/engineTracker.js';
import { scrapeProductUrl } from '../utils/productScraper.js';
import { forceEnglishAmazonUrl, hasHindiCharacters, translateHindiToEnglish } from '../utils/languageUtils.js';

/**
 * Multi-Store Search URL Builder
 * Generates store-specific search/listing URLs ranked by popularity/relevance.
 */
export function buildStoreSearchUrl(store = 'amazon', keywords = '') {
  const enc = encodeURIComponent(keywords.trim());
  const cleanStore = (store || 'amazon').toLowerCase().trim();
  switch (cleanStore) {
    case 'flipkart':
      return `https://www.flipkart.com/search?q=${enc}&sort=popularity`;
    case 'nykaa':
      return `https://www.nykaa.com/search/result/?q=${enc}&sort=popularity`;
    case 'myntra':
      return `https://www.myntra.com/${encodeURIComponent(keywords.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'))}?sort=popularity`;
    case 'meesho':
      return `https://www.meesho.com/search?q=${enc}`;
    case 'ajio':
      return `https://www.ajio.com/search/?text=${enc}`;
    case 'croma':
      return `https://www.croma.com/searchB?q=${enc}%3Arelevance`;
    case 'shopsy':
      return `https://www.shopsy.in/search?q=${enc}`;
    case 'tatacliq':
      return `https://www.tatacliq.com/search/?searchCategory=all&text=${enc}`;
    case 'purplle':
      return `https://www.purplle.com/search?q=${enc}`;
    case 'amazon':
    default:
      return `https://www.amazon.in/s?k=${enc}&s=exact-aware-popularity-rank&language=en_IN`;
  }
}

/** Legacy alias for Amazon search URL builder */
export function buildAmazonSearchUrl(keywords) {
  return buildStoreSearchUrl('amazon', keywords);
}

/**
 * Categorized Default Seeds Across the Top 8 Indian E-Commerce Stores:
 * - Amazon India (Electronics, Mobile, Laptops, Home, Fitness, Groceries, Luggage)
 * - Flipkart (Mobiles 5G, Laptops, TVs, Large Appliances, Kitchen, Flipkart Assured)
 * - Myntra (Branded Fashion, Sneakers, Western Wear, Handbags, Ethnic Sets, Luxury Perfumes)
 * - Nykaa (Skincare Serums, Sunscreens, Foundations, Lipsticks, Haircare, Luxury Scents)
 * - Ajio (Streetwear, Sneakerhood, Casual Tees, High-Waist Jeans, Kurta Sets, Kids)
 * - Meesho (Hyper-Value Kurtis under 299, Sarees, Oxidised Jewellery, Daily Combos, Bedding)
 * - Shopsy (Flipkart's Value Arm: Budget Tees, Slippers, Tops under 149, Back Covers, Trimmers)
 * - Croma (Apple iPhone/MacBook, Samsung Galaxy, OLED TVs, Inverter ACs, Soundbars)
 */
export const DEFAULT_AMAZON_SEEDS = [
  // electronics
  { category: 'electronics', subcategory: 'mobiles', keywords: 'smartphones' },
  { category: 'electronics', subcategory: 'mobiles', keywords: '5g smartphones under 15000' },
  { category: 'electronics', subcategory: 'mobiles', keywords: 'flagship smartphones' },
  { category: 'electronics', subcategory: 'laptops', keywords: 'laptops' },
  { category: 'electronics', subcategory: 'laptops', keywords: 'gaming laptops rtx' },
  { category: 'electronics', subcategory: 'laptops', keywords: 'macbook air m2 m3' },
  { category: 'electronics', subcategory: 'audio', keywords: 'wireless earbuds headphones' },
  { category: 'electronics', subcategory: 'audio', keywords: 'noise cancelling headphones over ear' },
  { category: 'electronics', subcategory: 'audio', keywords: 'soundbar with subwoofer for tv' },
  { category: 'electronics', subcategory: 'tv', keywords: 'smart tv 4k' },
  { category: 'electronics', subcategory: 'tv', keywords: 'oled qled smart tv 55 inch' },
  { category: 'electronics', subcategory: 'cameras', keywords: 'dslr mirrorless camera' },
  { category: 'electronics', subcategory: 'cameras', keywords: 'action camera 4k vlogging' },
  { category: 'electronics', subcategory: 'wearables', keywords: 'smartwatches' },
  { category: 'electronics', subcategory: 'wearables', keywords: 'amoled smartwatch bluetooth calling' },
  { category: 'electronics', subcategory: 'gaming', keywords: 'gaming console controller' },
  { category: 'electronics', subcategory: 'gaming', keywords: 'mechanical gaming keyboard mouse' },
  { category: 'electronics', subcategory: 'accessories', keywords: 'mobile phone case charger cable' },
  { category: 'electronics', subcategory: 'accessories', keywords: 'fast power bank 20000mah' },
  // appliances
  { category: 'appliances', subcategory: 'refrigerators', keywords: 'double door refrigerator frost free' },
  { category: 'appliances', subcategory: 'washing-machines', keywords: 'front load washing machine fully automatic' },
  { category: 'appliances', subcategory: 'air-conditioners', keywords: '1.5 ton 5 star inverter split ac' },
  { category: 'appliances', subcategory: 'kitchen-appliances', keywords: 'air fryer digital otg' },
  { category: 'appliances', subcategory: 'kitchen-appliances', keywords: 'mixer grinder 750 watt' },
  { category: 'appliances', subcategory: 'water-purifiers', keywords: 'ro water purifier copper uv' },
  // men-fashion
  { category: 'men-fashion', subcategory: 'men-topwear', keywords: 'men t-shirts shirts' },
  { category: 'men-fashion', subcategory: 'men-topwear', keywords: 'men polo t-shirts regular fit' },
  { category: 'men-fashion', subcategory: 'men-bottomwear', keywords: 'men jeans trousers' },
  { category: 'men-fashion', subcategory: 'footwear', keywords: 'men sneakers running shoes' },
  { category: 'men-fashion', subcategory: 'kids', keywords: 'boys clothing' },
  { category: 'men-fashion', subcategory: 'bags', keywords: 'men wallets bags' },
  { category: 'men-fashion', subcategory: 'watches', keywords: 'men watches' },
  { category: 'men-fashion', subcategory: 'innerwear', keywords: 'men innerwear briefs' },
  // women-fashion
  { category: 'women-fashion', subcategory: 'women-ethnic', keywords: 'women kurtis kurta sets' },
  { category: 'women-fashion', subcategory: 'women-ethnic', keywords: 'anarkali suit kurta set with dupatta' },
  { category: 'women-fashion', subcategory: 'women-western', keywords: 'women dresses tops jeans' },
  { category: 'women-fashion', subcategory: 'jewellery', keywords: 'women jewellery earrings necklace' },
  { category: 'women-fashion', subcategory: 'women-footwear', keywords: 'women sandals heels' },
  { category: 'women-fashion', subcategory: 'women-watches', keywords: 'women watches' },
  { category: 'women-fashion', subcategory: 'women-bags', keywords: 'women handbags' },
  { category: 'women-fashion', subcategory: 'women-innerwear', keywords: 'women innerwear lingerie' },
  { category: 'women-fashion', subcategory: 'girls-fashion', keywords: 'girls clothing dresses' },
  // beauty
  { category: 'beauty', subcategory: 'makeup', keywords: 'makeup kit lipstick foundation' },
  { category: 'beauty', subcategory: 'skincare', keywords: 'face serum sunscreen moisturizer' },
  { category: 'beauty', subcategory: 'haircare', keywords: 'shampoo conditioner hair oil' },
  { category: 'beauty', subcategory: 'bath-body', keywords: 'body wash lotion soap' },
  { category: 'beauty', subcategory: 'fragrance', keywords: 'perfumes for men women' },
  { category: 'beauty', subcategory: 'mens-grooming', keywords: 'trimmer shaver men grooming kit' },
  { category: 'beauty', subcategory: 'appliances', keywords: 'hair dryer straightener beauty appliance' },
  { category: 'beauty', subcategory: 'nailcare', keywords: 'nail polish manicure kit' },
  // home
  { category: 'home', subcategory: 'kitchen', keywords: 'kitchen cookware appliances' },
  { category: 'home', subcategory: 'kitchen', keywords: 'cast iron kadai pan cookware' },
  { category: 'home', subcategory: 'furniture', keywords: 'sofa dining table furniture' },
  { category: 'home', subcategory: 'furniture', keywords: 'ergonomic office chair study table' },
  { category: 'home', subcategory: 'decor', keywords: 'home decor wall art showpiece' },
  { category: 'home', subcategory: 'bedding', keywords: 'bedsheet pillow blanket' },
  { category: 'home', subcategory: 'storage', keywords: 'storage box organizer' },
  { category: 'home', subcategory: 'cleaning', keywords: 'cleaning supplies mop detergent' },
  { category: 'home', subcategory: 'cleaning', keywords: 'robotic vacuum cleaner' },
  { category: 'home', subcategory: 'tools', keywords: 'drill screwdriver tool kit' },
  // fitness
  { category: 'fitness', subcategory: 'gym-equipment', keywords: 'dumbbell treadmill gym equipment' },
  { category: 'fitness', subcategory: 'yoga', keywords: 'yoga mat accessories' },
  { category: 'fitness', subcategory: 'sports-gear', keywords: 'cricket badminton sports gear' },
  { category: 'fitness', subcategory: 'nutrition', keywords: 'whey protein isolate supplements' },
  { category: 'fitness', subcategory: 'nutrition', keywords: 'creatine monohydrate powder' },
  { category: 'fitness', subcategory: 'apparel', keywords: 'gym wear fitness apparel' },
  { category: 'fitness', subcategory: 'trackers', keywords: 'fitness band tracker' },
  // travel
  { category: 'travel', subcategory: 'luggage', keywords: 'trolley bag set luggage suitcase' },
  { category: 'travel', subcategory: 'bags', keywords: 'cabin trolley bag 55cm' },
  // general
  { category: 'general', subcategory: 'groceries', keywords: 'grocery gourmet snacks' },
  { category: 'general', subcategory: 'baby-toys', keywords: 'kids toys baby products' },
  { category: 'general', subcategory: 'books-stationery', keywords: 'books notebooks stationery' },
  { category: 'general', subcategory: 'pet-supplies', keywords: 'dog cat pet supplies' },
  { category: 'general', subcategory: 'auto', keywords: 'car bike accessories dash cam' },
  { category: 'general', subcategory: 'gifts', keywords: 'gift sets hampers' },
];

export const DEFAULT_FLIPKART_SEEDS = [
  // electronics:mobiles
  { category: 'electronics', subcategory: 'mobiles', keywords: 'smartphones 5g' },
  { category: 'electronics', subcategory: 'mobiles', keywords: '5g mobile phones under 15000' },
  { category: 'electronics', subcategory: 'mobiles', keywords: 'budget smartphones under 10000' },
  { category: 'electronics', subcategory: 'mobiles', keywords: 'realme smartphones 5g' },
  { category: 'electronics', subcategory: 'mobiles', keywords: 'poco smartphones 5g' },
  { category: 'electronics', subcategory: 'mobiles', keywords: 'motorola smartphones 5g' },
  { category: 'electronics', subcategory: 'mobiles', keywords: 'samsung galaxy 5g smartphones' },
  { category: 'electronics', subcategory: 'mobiles', keywords: 'apple iphone 15 14' },
  { category: 'electronics', subcategory: 'mobiles', keywords: 'tablets android ipad' },
  // electronics:laptops
  { category: 'electronics', subcategory: 'laptops', keywords: 'laptops thin light gaming' },
  { category: 'electronics', subcategory: 'laptops', keywords: 'gaming laptops rtx' },
  { category: 'electronics', subcategory: 'laptops', keywords: 'hp dell lenovo laptops' },
  { category: 'electronics', subcategory: 'laptops', keywords: 'student laptops under 25000' },
  // electronics:audio
  { category: 'electronics', subcategory: 'audio', keywords: 'wireless earbuds bluetooth headphones' },
  { category: 'electronics', subcategory: 'audio', keywords: 'neckband bluetooth earphones' },
  { category: 'electronics', subcategory: 'audio', keywords: 'party bluetooth speaker bass' },
  { category: 'electronics', subcategory: 'audio', keywords: 'soundbar home theatre' },
  // electronics:tv
  { category: 'electronics', subcategory: 'tv', keywords: 'smart tv 4k 43 55 inch' },
  { category: 'electronics', subcategory: 'tv', keywords: 'qled oled smart tv' },
  { category: 'electronics', subcategory: 'tv', keywords: '32 inch smart tv budget' },
  // electronics:wearables & accessories
  { category: 'electronics', subcategory: 'wearables', keywords: 'smartwatches bluetooth calling' },
  { category: 'electronics', subcategory: 'accessories', keywords: 'fast charger power bank' },
  { category: 'electronics', subcategory: 'accessories', keywords: 'mobile back cover tempered glass' },
  // appliances
  { category: 'appliances', subcategory: 'refrigerators', keywords: 'refrigerator single door double door' },
  { category: 'appliances', subcategory: 'refrigerators', keywords: 'frost free double door refrigerator' },
  { category: 'appliances', subcategory: 'washing-machines', keywords: 'washing machine fully automatic front load' },
  { category: 'appliances', subcategory: 'washing-machines', keywords: 'top load washing machine 7kg' },
  { category: 'appliances', subcategory: 'air-conditioners', keywords: 'inverter split ac 1.5 ton 5 star' },
  { category: 'appliances', subcategory: 'air-conditioners', keywords: 'air cooler desert cooler for home' },
  { category: 'appliances', subcategory: 'kitchen-appliances', keywords: 'mixer grinder 750 watt' },
  { category: 'appliances', subcategory: 'kitchen-appliances', keywords: 'air fryer for cooking' },
  { category: 'appliances', subcategory: 'kitchen-appliances', keywords: 'microwave oven convection' },
  { category: 'appliances', subcategory: 'water-purifiers', keywords: 'water purifier ro uv alkaline' },
  // personal-care & grooming
  { category: 'personal-care', subcategory: 'grooming', keywords: 'beard trimmer for men' },
  { category: 'personal-care', subcategory: 'grooming', keywords: 'hair straightener dryer for women' },
  // fashion
  { category: 'men-fashion', subcategory: 'men-topwear', keywords: 'men t-shirts casual shirts' },
  { category: 'men-fashion', subcategory: 'men-bottomwear', keywords: 'men jeans cotton trousers' },
  { category: 'men-fashion', subcategory: 'footwear', keywords: 'men running shoes sneakers' },
  { category: 'women-fashion', subcategory: 'women-ethnic', keywords: 'women kurtis kurta set saree' },
  { category: 'women-fashion', subcategory: 'women-western', keywords: 'women dresses tops jeans' },
];

export const DEFAULT_NYKAA_SEEDS = [
  // makeup
  { category: 'beauty', subcategory: 'makeup', keywords: 'fit me foundation compact primer' },
  { category: 'beauty', subcategory: 'makeup', keywords: 'matte liquid lipstick lip gloss' },
  { category: 'beauty', subcategory: 'makeup', keywords: 'kajal eyeliner mascara eyeshadow' },
  { category: 'beauty', subcategory: 'makeup', keywords: 'blush highlighter contour palette' },
  { category: 'beauty', subcategory: 'makeup', keywords: 'setting spray loose powder makeup fixer' },
  { category: 'beauty', subcategory: 'makeup', keywords: 'bb cream cc cream skin tint' },
  { category: 'beauty', subcategory: 'makeup', keywords: 'lip balm lip oil tinted' },
  { category: 'beauty', subcategory: 'nailcare', keywords: 'nail polish gel enamel kit' },
  // skincare
  { category: 'beauty', subcategory: 'skincare', keywords: 'face serum niacinamide vitamin c' },
  { category: 'beauty', subcategory: 'skincare', keywords: 'sunscreen spf 50 moisturizer gel' },
  { category: 'beauty', subcategory: 'skincare', keywords: 'face wash cleanser foaming gentle' },
  { category: 'beauty', subcategory: 'skincare', keywords: 'salicylic acid serum for acne' },
  { category: 'beauty', subcategory: 'skincare', keywords: 'hyaluronic acid hydrating serum' },
  { category: 'beauty', subcategory: 'skincare', keywords: 'retinol anti aging night cream' },
  { category: 'beauty', subcategory: 'skincare', keywords: 'face toner mist pore tightening' },
  { category: 'beauty', subcategory: 'skincare', keywords: 'sheet mask clay face mask' },
  { category: 'beauty', subcategory: 'skincare', keywords: 'under eye cream dark circles' },
  // haircare
  { category: 'beauty', subcategory: 'haircare', keywords: 'keratin shampoo hair mask serum' },
  { category: 'beauty', subcategory: 'haircare', keywords: 'anti dandruff shampoo hair conditioner' },
  { category: 'beauty', subcategory: 'haircare', keywords: 'hair growth serum rosemary oil' },
  { category: 'beauty', subcategory: 'haircare', keywords: 'heat protection spray hair leave in cream' },
  // bath & body
  { category: 'beauty', subcategory: 'bath-body', keywords: 'body wash shower gel body lotion' },
  { category: 'beauty', subcategory: 'bath-body', keywords: 'body scrub exfoliator brightening' },
  { category: 'beauty', subcategory: 'bath-body', keywords: 'body butter deeply nourishing' },
  // fragrance
  { category: 'beauty', subcategory: 'fragrance', keywords: 'eau de parfum perfume for women men' },
  { category: 'beauty', subcategory: 'fragrance', keywords: 'luxury perfumes designer fragrances' },
  { category: 'beauty', subcategory: 'fragrance', keywords: 'body mist fragrance spray long lasting' },
  // men's grooming
  { category: 'beauty', subcategory: 'mens-grooming', keywords: 'beard oil face wash men grooming' },
  { category: 'beauty', subcategory: 'mens-grooming', keywords: 'men hair styling wax clay pomade' },
  { category: 'beauty', subcategory: 'mens-grooming', keywords: 'men cologne eau de toilette' },
  // beauty appliances
  { category: 'beauty', subcategory: 'appliances', keywords: 'hair dryer hair straightener styler' },
  { category: 'beauty', subcategory: 'appliances', keywords: 'hair curling tong hot air brush' },
  { category: 'beauty', subcategory: 'appliances', keywords: 'electric face epilator trimmer' },
];

export const DEFAULT_MYNTRA_SEEDS = [
  // men fashion
  { category: 'men-fashion', subcategory: 'men-topwear', keywords: 'men cotton casual shirts polo t-shirts' },
  { category: 'men-fashion', subcategory: 'men-topwear', keywords: 'men oversized graphic t-shirts' },
  { category: 'men-fashion', subcategory: 'men-topwear', keywords: 'men linen shirts formal shirts' },
  { category: 'men-fashion', subcategory: 'men-topwear', keywords: 'men hooded sweatshirts jackets' },
  { category: 'men-fashion', subcategory: 'men-bottomwear', keywords: 'men slim fit stretch jeans cargo trousers' },
  { category: 'men-fashion', subcategory: 'men-bottomwear', keywords: 'men formal trousers chinos' },
  { category: 'men-fashion', subcategory: 'men-bottomwear', keywords: 'men sweatpants joggers trackpants' },
  { category: 'men-fashion', subcategory: 'footwear', keywords: 'men running shoes white sneakers loafers' },
  { category: 'men-fashion', subcategory: 'footwear', keywords: 'men formal oxford derby leather shoes' },
  { category: 'men-fashion', subcategory: 'footwear', keywords: 'men sliders clogs flip flops' },
  { category: 'men-fashion', subcategory: 'bags', keywords: 'men genuine leather wallet office bag' },
  { category: 'men-fashion', subcategory: 'bags', keywords: 'unisex laptop backpack travel bag' },
  { category: 'men-fashion', subcategory: 'watches', keywords: 'men analog chronograph watch' },
  { category: 'men-fashion', subcategory: 'watches', keywords: 'men digital sports watch' },
  { category: 'men-fashion', subcategory: 'innerwear', keywords: 'men trunks boxers vests cotton' },
  // women fashion
  { category: 'women-fashion', subcategory: 'women-ethnic', keywords: 'anarkali kurti kurta palazzo set' },
  { category: 'women-fashion', subcategory: 'women-ethnic', keywords: 'silk georgette sarees with blouse' },
  { category: 'women-fashion', subcategory: 'women-ethnic', keywords: 'lehenga choli ethnic party wear' },
  { category: 'women-fashion', subcategory: 'women-ethnic', keywords: 'women ethnic dupattas ethnic jackets' },
  { category: 'women-fashion', subcategory: 'women-western', keywords: 'women maxi dress floral tops high waist jeans' },
  { category: 'women-fashion', subcategory: 'women-western', keywords: 'women jumpsuits coordinates set' },
  { category: 'women-fashion', subcategory: 'women-western', keywords: 'women denim jackets blazer coats' },
  { category: 'women-fashion', subcategory: 'jewellery', keywords: 'oxidised silver earrings necklace sets' },
  { category: 'women-fashion', subcategory: 'jewellery', keywords: 'gold plated jewellery necklace earrings' },
  { category: 'women-fashion', subcategory: 'women-footwear', keywords: 'women block heels casual flats wedges' },
  { category: 'women-fashion', subcategory: 'women-footwear', keywords: 'women white sneakers running shoes' },
  { category: 'women-fashion', subcategory: 'women-footwear', keywords: 'women kolhapuri ethnic juttis' },
  { category: 'women-fashion', subcategory: 'women-bags', keywords: 'women tote bag shoulder sling handbag' },
  { category: 'women-fashion', subcategory: 'women-bags', keywords: 'women clutch party wallet' },
  { category: 'women-fashion', subcategory: 'women-watches', keywords: 'women analog rose gold watch' },
  { category: 'women-fashion', subcategory: 'women-innerwear', keywords: 'women bra panty sets loungewear' },
  { category: 'beauty', subcategory: 'fragrance', keywords: 'men women perfumes deos body mist' },
  { category: 'fitness', subcategory: 'apparel', keywords: 'men women gym wear activewear tights' },
];

export const DEFAULT_AJIO_SEEDS = [
  // men fashion
  { category: 'men-fashion', subcategory: 'men-topwear', keywords: 'men t-shirts shirts' },
  { category: 'men-fashion', subcategory: 'men-topwear', keywords: 'men printed casual shirts cotton' },
  { category: 'men-fashion', subcategory: 'men-topwear', keywords: 'men polo neck t-shirts regular fit' },
  { category: 'men-fashion', subcategory: 'men-topwear', keywords: 'men oversized drop shoulder tees' },
  { category: 'men-fashion', subcategory: 'men-topwear', keywords: 'men hoodies jackets sweatshirts' },
  { category: 'men-fashion', subcategory: 'men-bottomwear', keywords: 'men jeans trousers' },
  { category: 'men-fashion', subcategory: 'men-bottomwear', keywords: 'men cargo jogger pants' },
  { category: 'men-fashion', subcategory: 'men-bottomwear', keywords: 'men cotton formal trousers chinos' },
  { category: 'men-fashion', subcategory: 'footwear', keywords: 'men sneakers shoes' },
  { category: 'men-fashion', subcategory: 'footwear', keywords: 'men high top streetwear sneakers' },
  { category: 'men-fashion', subcategory: 'footwear', keywords: 'men casual loafers slip on shoes' },
  { category: 'men-fashion', subcategory: 'footwear', keywords: 'men sports running walking shoes' },
  { category: 'men-fashion', subcategory: 'watches', keywords: 'men watches analog smart' },
  { category: 'men-fashion', subcategory: 'innerwear', keywords: 'men cotton briefs trunks boxers' },
  // women fashion
  { category: 'women-fashion', subcategory: 'women-western', keywords: 'women dresses tops' },
  { category: 'women-fashion', subcategory: 'women-western', keywords: 'women oversized tees graphic shirts' },
  { category: 'women-fashion', subcategory: 'women-western', keywords: 'women high waist jeans trousers' },
  { category: 'women-fashion', subcategory: 'women-western', keywords: 'women co-ord sets two piece' },
  { category: 'women-fashion', subcategory: 'women-ethnic', keywords: 'women kurtas kurtis' },
  { category: 'women-fashion', subcategory: 'women-ethnic', keywords: 'women kurta palazzo sets with dupatta' },
  { category: 'women-fashion', subcategory: 'women-ethnic', keywords: 'women printed ethnic dresses fusion' },
  { category: 'women-fashion', subcategory: 'women-ethnic', keywords: 'women sarees silk georgette' },
  { category: 'women-fashion', subcategory: 'footwear', keywords: 'women sandals heels' },
  { category: 'women-fashion', subcategory: 'footwear', keywords: 'women casual flat shoes sneakers' },
  { category: 'women-fashion', subcategory: 'handbags', keywords: 'women handbags totes' },
  { category: 'women-fashion', subcategory: 'handbags', keywords: 'women sling bags shoulder bags' },
  // kids & home
  { category: 'men-fashion', subcategory: 'kids', keywords: 'kids wear boys girls clothing' },
  { category: 'home', subcategory: 'decor', keywords: 'cushion covers bedsheets curtains' },
  { category: 'home', subcategory: 'decor', keywords: 'rugs carpets floor mats' },
];

export const DEFAULT_MEESHO_SEEDS = [
  // women ethnic & daily
  { category: 'women-fashion', subcategory: 'women-ethnic', keywords: 'cotton printed kurti daily wear' },
  { category: 'women-fashion', subcategory: 'women-ethnic', keywords: 'georgette designer saree ready to wear' },
  { category: 'women-fashion', subcategory: 'women-ethnic', keywords: 'kurti pant dupatta set under 400' },
  { category: 'women-fashion', subcategory: 'women-ethnic', keywords: 'cotton daily wear sarees combo' },
  { category: 'women-fashion', subcategory: 'women-ethnic', keywords: 'chanderi silk readymade suits' },
  { category: 'women-fashion', subcategory: 'women-western', keywords: 'women nighty night dress loungewear' },
  { category: 'women-fashion', subcategory: 'women-western', keywords: 'women tops combo under 200' },
  { category: 'women-fashion', subcategory: 'women-western', keywords: 'women jeans jeggings stretchable' },
  // jewellery
  { category: 'women-fashion', subcategory: 'jewellery', keywords: 'traditional oxidised jhumka earrings set' },
  { category: 'women-fashion', subcategory: 'jewellery', keywords: 'bridal jewellery set gold plated' },
  { category: 'women-fashion', subcategory: 'jewellery', keywords: 'choker necklace earrings mangtika set' },
  { category: 'women-fashion', subcategory: 'jewellery', keywords: 'bangles kada set for women' },
  // men fashion
  { category: 'men-fashion', subcategory: 'men-topwear', keywords: 'men combo pack t-shirts regular fit' },
  { category: 'men-fashion', subcategory: 'men-topwear', keywords: 'men casual shirts check printed' },
  { category: 'men-fashion', subcategory: 'men-topwear', keywords: 'men printed round neck tshirts' },
  { category: 'men-fashion', subcategory: 'men-bottomwear', keywords: 'men trackpants track pants lower' },
  { category: 'men-fashion', subcategory: 'men-bottomwear', keywords: 'men cargo pants cotton jeans' },
  { category: 'men-fashion', subcategory: 'men-bottomwear', keywords: 'men cotton shorts boxer shorts combo' },
  { category: 'men-fashion', subcategory: 'footwear', keywords: 'men lightweight mesh running sports shoes' },
  { category: 'men-fashion', subcategory: 'footwear', keywords: 'men casual loafers white sneakers budget' },
  { category: 'men-fashion', subcategory: 'footwear', keywords: 'men daily wear slippers flip flops' },
  // home & kitchen
  { category: 'home', subcategory: 'bedding', keywords: 'fitted elastic double bedsheet with pillow covers' },
  { category: 'home', subcategory: 'bedding', keywords: 'cotton single double bedsheet combo' },
  { category: 'home', subcategory: 'bedding', keywords: 'blanket comforter duvet soft' },
  { category: 'home', subcategory: 'kitchen', keywords: 'kitchen storage container set spice box organizer' },
  { category: 'home', subcategory: 'kitchen', keywords: 'vegetable chopper hand blender cutter' },
  { category: 'home', subcategory: 'kitchen', keywords: 'water bottle set fridge bottles' },
  { category: 'home', subcategory: 'decor', keywords: 'curtains for door window home decoration' },
  { category: 'home', subcategory: 'decor', keywords: 'wall stickers 3d wallpaper decor' },
  // baby & toys
  { category: 'baby-kids', subcategory: 'baby-clothing', keywords: 'baby clothes combo newborn dress set' },
  { category: 'baby-kids', subcategory: 'baby-toys', keywords: 'kids toys remote control car puzzle' },
];

export const DEFAULT_SHOPSY_SEEDS = [
  // hyper-value fashion & daily
  { category: 'men-fashion', subcategory: 'men-topwear', keywords: 'men t-shirts under 199' },
  { category: 'men-fashion', subcategory: 'men-topwear', keywords: 'men casual shirts under 299' },
  { category: 'men-fashion', subcategory: 'men-topwear', keywords: 'men oversized tshirts cotton' },
  { category: 'men-fashion', subcategory: 'men-bottomwear', keywords: 'men track pants lower under 250' },
  { category: 'men-fashion', subcategory: 'men-bottomwear', keywords: 'men jeans under 399' },
  { category: 'men-fashion', subcategory: 'footwear', keywords: 'men slippers chappal under 149' },
  { category: 'men-fashion', subcategory: 'footwear', keywords: 'men casual shoes sneakers under 299' },
  { category: 'women-fashion', subcategory: 'women-ethnic', keywords: 'women kurtis under 199' },
  { category: 'women-fashion', subcategory: 'women-ethnic', keywords: 'women kurta set under 349' },
  { category: 'women-fashion', subcategory: 'women-ethnic', keywords: 'printed sarees under 249' },
  { category: 'women-fashion', subcategory: 'women-western', keywords: 'women tops under 149' },
  { category: 'women-fashion', subcategory: 'women-western', keywords: 'women night suit night dress' },
  { category: 'women-fashion', subcategory: 'jewellery', keywords: 'earrings necklace jewellery under 99' },
  // budget electronics & trimmers
  { category: 'electronics', subcategory: 'accessories', keywords: 'mobile back cover cases' },
  { category: 'electronics', subcategory: 'accessories', keywords: 'mobile charger fast charging cable' },
  { category: 'electronics', subcategory: 'accessories', keywords: 'earphones with mic under 99' },
  { category: 'electronics', subcategory: 'wearables', keywords: 'budget smart watch under 499' },
  { category: 'personal-care', subcategory: 'grooming', keywords: 'rechargeable beard trimmer under 299' },
  { category: 'personal-care', subcategory: 'grooming', keywords: 'hair straightener comb under 249' },
  // home & kitchen budget
  { category: 'home', subcategory: 'kitchen', keywords: 'kitchen organizers container box' },
  { category: 'home', subcategory: 'kitchen', keywords: 'kitchen knife peeler chopper set' },
  { category: 'home', subcategory: 'kitchen', keywords: 'water bottle 1 litre combo' },
  { category: 'home', subcategory: 'decor', keywords: 'wall stickers home decoration' },
  { category: 'home', subcategory: 'decor', keywords: 'fairy led lights for bedroom' },
  { category: 'home', subcategory: 'bedding', keywords: 'cotton double bedsheet under 199' },
];

export const DEFAULT_CROMA_SEEDS = [
  // mobiles & tablets
  { category: 'electronics', subcategory: 'mobiles', keywords: 'smartphones' },
  { category: 'electronics', subcategory: 'mobiles', keywords: 'apple iphone 15 16' },
  { category: 'electronics', subcategory: 'mobiles', keywords: 'samsung galaxy s24 s23 ultra' },
  { category: 'electronics', subcategory: 'mobiles', keywords: 'oneplus 5g smartphones' },
  // laptops & computing
  { category: 'electronics', subcategory: 'laptops', keywords: 'laptops' },
  { category: 'electronics', subcategory: 'laptops', keywords: 'apple macbook air pro' },
  { category: 'electronics', subcategory: 'laptops', keywords: 'gaming laptops asus lenovo hp' },
  { category: 'electronics', subcategory: 'laptops', keywords: 'intel core i5 i7 laptops' },
  // audio
  { category: 'electronics', subcategory: 'audio', keywords: 'bluetooth earphones headphones soundbar' },
  { category: 'electronics', subcategory: 'audio', keywords: 'sony noise cancelling headphones' },
  { category: 'electronics', subcategory: 'audio', keywords: 'jbl bluetooth portable speaker' },
  { category: 'electronics', subcategory: 'audio', keywords: 'bose apple airpods audio' },
  // wearables & tv
  { category: 'electronics', subcategory: 'wearables', keywords: 'smartwatches' },
  { category: 'electronics', subcategory: 'wearables', keywords: 'apple watch samsung galaxy watch' },
  { category: 'electronics', subcategory: 'tv', keywords: 'smart tv 4k' },
  { category: 'electronics', subcategory: 'tv', keywords: 'oled qled 55 65 inch tv' },
  // large & kitchen appliances
  { category: 'appliances', subcategory: 'large-appliances', keywords: 'washing machine refrigerator air conditioner' },
  { category: 'appliances', subcategory: 'large-appliances', keywords: 'inverter split ac 1.5 ton 5 star' },
  { category: 'appliances', subcategory: 'large-appliances', keywords: 'front load washing machine 8kg' },
  { category: 'appliances', subcategory: 'large-appliances', keywords: 'double door frost free refrigerator' },
  { category: 'appliances', subcategory: 'kitchen-appliances', keywords: 'air fryer microwave mixer grinder' },
  { category: 'appliances', subcategory: 'kitchen-appliances', keywords: 'coffee maker espresso machine' },
  { category: 'personal-care', subcategory: 'grooming', keywords: 'trimmer hair dryer straightener' },
  { category: 'electronics', subcategory: 'accessories', keywords: 'power bank mobile charger cable' },
];

export const DEFAULT_SEEDS_BY_STORE = {
  amazon: DEFAULT_AMAZON_SEEDS,
  flipkart: DEFAULT_FLIPKART_SEEDS,
  nykaa: DEFAULT_NYKAA_SEEDS,
  myntra: DEFAULT_MYNTRA_SEEDS,
  meesho: DEFAULT_MEESHO_SEEDS,
  ajio: DEFAULT_AJIO_SEEDS,
  croma: DEFAULT_CROMA_SEEDS,
  shopsy: DEFAULT_SHOPSY_SEEDS,
};

/** Helper to clean raw price strings into safe numbers */
function cleanPriceVal(val) {
  if (val == null) return null;
  const num = parseFloat(String(val).replace(/[^\d.]/g, ''));
  return !isNaN(num) && num > 0 ? Math.round(num) : null;
}

/**
 * Bootstrap & synchronize crawler_seeds across all 8 stores using atomic bulk upserts.
 * Enrolls any newly added search seeds while preserving existing historical records.
 */
export async function ensureCrawlerDefaults() {
  for (const [store, seedList] of Object.entries(DEFAULT_SEEDS_BY_STORE)) {
    const ops = seedList.map(s => ({
      updateOne: {
        filter: { store, keywords: s.keywords },
        update: {
          $setOnInsert: {
            store,
            category: s.category,
            subcategory: s.subcategory,
            keywords: s.keywords,
            url: buildStoreSearchUrl(store, s.keywords),
            topN: 20,
            isEnabled: true,
            frequencyHours: 4,
          },
        },
        upsert: true,
      },
    }));

    if (ops.length > 0) {
      await CrawlerSeed.bulkWrite(ops, { ordered: false }).catch(err => {
        console.warn(`[Shoppers Deals Engine] Seed bulk upsert for ${store} notice:`, err.message);
      });
    }
  }

  const config = await CrawlerConfig.findOne({});
  if (!config) {
    console.log('[Shoppers Deals Engine] No config found — creating default (every 4h, enabled).');
    await CrawlerConfig.create({ isEnabled: true, intervalHours: 4 });
  }

  await CrawlerSeed.updateMany(
    { $or: [{ frequencyHours: { $exists: false } }, { frequencyHours: 24 }] },
    { $set: { frequencyHours: (config || {}).intervalHours || 4 } }
  ).catch(() => {});
}

/** Fetches a search page's HTML via the shared scraper queue at BESTSELLER priority. */
async function fetchCategoryHtml(url) {
  return await scraperQueue.enqueue(url, { priority: PRIORITY.BESTSELLER });
}

/**
 * Refines the category/subcategory of a scraped search result by its title.
 * Prevents sponsored or related accessories, smartwatches, and audio devices from
 * blindly inheriting a seed's category (e.g. powerbanks appearing under 'mobiles').
 */
export function refineCategoryFromTitle(title, seedCategory, seedSubcategory) {
  if (!title) return { category: seedCategory, subcategory: seedSubcategory };
  const t = title.trim();

  // Try high precision classifier first
  const highPrecision = classifyProduct(t);
  if (highPrecision) {
    // If the classified category is a clear correction (e.g. accessories/wearables found in mobiles, or travel bags found in fashion)
    if (seedCategory === 'electronics' || seedSubcategory === 'mobiles' || seedSubcategory === 'laptops') {
      if (highPrecision.category === 'electronics' || highPrecision.category === 'travel' || highPrecision.category === 'home') {
        return highPrecision;
      }
    }
    if (seedCategory === 'men-fashion' || seedCategory === 'women-fashion') {
      if (highPrecision.category === 'travel' || highPrecision.category === 'personal-care' || highPrecision.category === 'baby-kids' || highPrecision.category === 'auto') {
        return highPrecision;
      }
    }
  }

  // If seed is in electronics or mobiles, protect against powerbanks, smartwatches, audio, accessories
  if (seedCategory === 'electronics' || seedSubcategory === 'mobiles') {
    if (/\b(power ?bank|powerbank|energyshroom)\b/i.test(t)) {
      return { category: 'electronics', subcategory: 'accessories' };
    }
    if (/\b(smartwatch|smart watch|fitness band|smart band|smart ring|redmi watch|oneplus watch|galaxy watch|apple watch)\b/i.test(t) || (/\bwatch\b/i.test(t) && !/\b(phone|mobile|smartphone)\b/i.test(t))) {
      return { category: 'electronics', subcategory: 'wearables' };
    }
    if (/\b(earbuds?|tws\b|headphones?|earphones?|neckbands?|bluetooth speaker|\bspeaker\b|soundbar)\b/i.test(t) && !/\b(iphone 1[1-7]|galaxy s2[0-6]|mobile phone|smartphone)\b/i.test(t)) {
      return { category: 'electronics', subcategory: 'audio' };
    }
    if (/\b(case for|cover for|\bcase\b|\bcover\b|screen protector|tempered glass|mobile holder|phone stand|tablet stand|car mount|phone mount|phone grip|popsocket|charger|charging cable|usb-c cable|lightning cable|usb cable|type-c cable|adapter)\b/i.test(t)) {
      const isRealKidTablet = /\b(toddler tablet|kids tablet|children tablet)\b/i.test(t) && /\b(wifi|android|32gb|64gb)\b/i.test(t);
      if (!isRealKidTablet) {
        return { category: 'electronics', subcategory: 'accessories' };
      }
    }
    if (/\b(tripod|selfie stick|gimbal|photo printer)\b/i.test(t)) {
      return { category: 'electronics', subcategory: 'cameras' };
    }
    if (/\b(gamepad|game controller|mobile controller|phone controller)\b/i.test(t)) {
      return { category: 'electronics', subcategory: 'gaming' };
    }
  }

  return { category: seedCategory, subcategory: seedSubcategory };
}

/**
 * Parses an Amazon search/bestseller page and extracts topN items.
 */
export function parseAmazonBestsellerItems(html, categoryInfo, topN = 20) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const items = [];
  const seenAsins = new Set();

  $('[data-asin], .s-result-item[data-asin], .zg-grid-general-faceout').each((_, el) => {
    if (items.length >= topN) return false;

    const asin = $(el).attr('data-asin') || $(el).find('[data-asin]').attr('data-asin');
    if (!asin || asin.length < 5 || seenAsins.has(asin)) return;

    // Title
    const title = $(el).find('h2 span, h2 a, ._cDEzb_p13n-sc-css-line-clamp-1_1Fn1y, ._cDEzb_p13n-sc-css-line-clamp-2_EW2cb, .a-size-medium, .a-size-base-plus').first().text().trim();
    if (!title || title.length < 3) return;

    // Price
    const priceText = $(el).find('.a-price .a-offscreen, ._cDEzb_p13n-sc-price_3mJ9Z, .a-price-whole').first().text().trim();
    const cleanPrice = cleanPriceVal(priceText);
    if (!cleanPrice) return;

    // MRP / Original Price
    const mrpText = $(el).find('.a-text-price .a-offscreen, .a-size-small.a-color-secondary').first().text().trim();
    const cleanMrp = cleanPriceVal(mrpText);
    const originalPrice = cleanMrp && cleanMrp >= cleanPrice ? cleanMrp : cleanPrice;

    // Image URL
    const imageUrl = $(el).find('img.s-image, img._cDEzb_p13n-sc-dynamic-image_1zBhg, img').first().attr('src') || $(el).find('img').first().attr('data-src');

    // Rating
    const ratingText = $(el).find('.a-icon-alt').first().text().trim();
    const ratingMatch = ratingText.match(/([\d.]+)\s*out of/i);
    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 4.2;

    const refinedCat = refineCategoryFromTitle(title, categoryInfo.category, categoryInfo.subcategory);

    seenAsins.add(asin);
    items.push({
      productId: asin,
      merchant: 'amazon',
      cleanUrl: `https://www.amazon.in/dp/${asin}`,
      title,
      price: cleanPrice,
      originalPrice,
      imageUrl: imageUrl || null,
      images: imageUrl ? [imageUrl] : [],
      rating,
      category: refinedCat.category,
      subcategory: refinedCat.subcategory,
      isActive: true,
      country: 'IN',
    });
  });

  return items;
}

/**
 * Parses a Flipkart search/listing page and extracts topN items.
 */
export function parseFlipkartBestsellerItems(html, categoryInfo, topN = 20) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const items = [];
  const seenIds = new Set();

  $('div[data-id], a[href*="pid="], a[href*="/p/"]').each((_, el) => {
    if (items.length >= topN) return false;

    const $el = $(el);
    let pid = $el.attr('data-id');
    const href = $el.attr('href') || $el.find('a[href*="pid="]').attr('href') || $el.find('a[href*="/p/"]').attr('href');

    if (!pid && href) {
      const pidMatch = href.match(/pid=([A-Z0-9]{16})/i) || href.match(/\/p\/([a-z0-9]{16})/i);
      if (pidMatch) pid = pidMatch[1];
    }

    if (!pid || pid.length < 6 || seenIds.has(pid)) return;

    const card = $el.is('div[data-id]') ? $el : $el.closest('div[data-id], div[class*="_1AtVbE"], div[class*="cPHDOP"]');
    const scope = card.length ? card : $el;

    let title = scope.find('div.RG5Slk, div.KzDlHZ, a.WKTcLC, div._4rR01T, a.IRpwTa, a._2B099V, [class*="RG5Slk"]').first().text().trim();
    const brand = scope.find('div._2WkVRV').first().text().trim();
    if (brand && title && !title.toLowerCase().startsWith(brand.toLowerCase())) {
      title = `${brand} ${title}`;
    }
    if (!title) {
      title = scope.find('a[title]').first().attr('title') || scope.find('img').first().attr('alt');
    }
    if (!title || title.length < 3) return;

    const priceText = scope.find('div.hZ3P6w, div.DeU9vF, div.Nx9bqj, div._30jeq3, [class*="hZ3P6w"], [class*="Nx9bqj"]').first().text().trim();
    const cleanPrice = cleanPriceVal(priceText);
    if (!cleanPrice) return;

    const mrpText = scope.find('div.kRYCnD, div.gxR4EY, div.yRaY8j, div._3I9_R3, [class*="kRYCnD"], [class*="yRaY8j"]').first().text().trim();
    const cleanMrp = cleanPriceVal(mrpText);
    const originalPrice = cleanMrp && cleanMrp >= cleanPrice ? cleanMrp : cleanPrice;

    const imageUrl = scope.find('img.UCc1lI, img.DByuf4, img._53G40d, img[src*="flixcart.com"], img[src*="rukminim"], img').first().attr('src');
    const ratingText = scope.find('div.MKiFS6, div._5OesEi span div, div._3LWZlK, div[class*="_3LWZlK"]').first().text().trim();
    const ratingNum = parseFloat(ratingText);
    const rating = !isNaN(ratingNum) && ratingNum >= 1 && ratingNum <= 5 ? ratingNum : 4.2;

    const refinedCat = refineCategoryFromTitle(title, categoryInfo.category, categoryInfo.subcategory);

    seenIds.add(pid);
    items.push({
      productId: pid,
      merchant: 'flipkart',
      cleanUrl: `https://www.flipkart.com/product/p/itme?pid=${pid}`,
      title: title.slice(0, 200),
      price: cleanPrice,
      originalPrice,
      imageUrl: imageUrl || null,
      images: imageUrl ? [imageUrl] : [],
      rating,
      category: refinedCat.category,
      subcategory: refinedCat.subcategory,
      isActive: true,
      country: 'IN',
    });
  });

  return items;
}

/**
 * Parses a Shopsy (Flipkart Value Commerce) search/listing page and extracts topN items.
 * Uses Flipkart-compatible PID, pricing, and image selectors with Shopsy canonical URLs.
 */
export function parseShopsyBestsellerItems(html, categoryInfo, topN = 20) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const items = [];
  const seenIds = new Set();

  $('div[data-id], a[href*="pid="], a[href*="/p/"]').each((_, el) => {
    if (items.length >= topN) return false;

    const $el = $(el);
    let pid = $el.attr('data-id');
    const href = $el.attr('href') || $el.find('a[href*="pid="]').attr('href') || $el.find('a[href*="/p/"]').attr('href');

    if (!pid && href) {
      const pidMatch = href.match(/pid=([A-Z0-9]{16})/i) || href.match(/\/p\/([a-z0-9]{16})/i);
      if (pidMatch) pid = pidMatch[1];
    }

    if (!pid || pid.length < 6 || seenIds.has(pid)) return;

    const card = $el.is('div[data-id]') ? $el : $el.closest('div[data-id], div[class*="_1AtVbE"], div[class*="cPHDOP"]');
    const scope = card.length ? card : $el;

    let title = scope.find('div.KzDlHZ, a.WKTcLC, div._4rR01T, a.IRpwTa, a._2B099V, span[class*="title"]').first().text().trim();
    const brand = scope.find('div._2WkVRV').first().text().trim();
    if (brand && title && !title.toLowerCase().startsWith(brand.toLowerCase())) {
      title = `${brand} ${title}`;
    }
    if (!title) {
      title = scope.find('a[title]').first().attr('title') || scope.find('img').first().attr('alt');
    }
    if (!title || title.length < 3) return;

    const priceText = scope.find('div.Nx9bqj, div._30jeq3, div[class*="Nx9bqj"]').first().text().trim();
    const cleanPrice = cleanPriceVal(priceText);
    if (!cleanPrice) return;

    const mrpText = scope.find('div.yRaY8j, div._3I9_R3, div[class*="yRaY8j"]').first().text().trim();
    const cleanMrp = cleanPriceVal(mrpText);
    const originalPrice = cleanMrp && cleanMrp >= cleanPrice ? cleanMrp : cleanPrice;

    const imageUrl = scope.find('img.DByuf4, img._53G40d, img[src*="flixcart.com"], img[src*="rukminim"], img').first().attr('src');
    const ratingText = scope.find('div._5OesEi span div, div._3LWZlK, div[class*="_3LWZlK"]').first().text().trim();
    const ratingNum = parseFloat(ratingText);
    const rating = !isNaN(ratingNum) && ratingNum >= 1 && ratingNum <= 5 ? ratingNum : 4.0;

    const refinedCat = refineCategoryFromTitle(title, categoryInfo.category, categoryInfo.subcategory);

    seenIds.add(pid);
    items.push({
      productId: pid,
      merchant: 'shopsy',
      cleanUrl: `https://www.shopsy.in/product/p/itme?pid=${pid}`,
      title: title.slice(0, 200),
      price: cleanPrice,
      originalPrice,
      imageUrl: imageUrl || null,
      images: imageUrl ? [imageUrl] : [],
      rating,
      category: refinedCat.category,
      subcategory: refinedCat.subcategory,
      isActive: true,
      country: 'IN',
    });
  });

  return items;
}

/**
 * Parses a Nykaa search/listing page and extracts topN items.
 */
export function parseNykaaBestsellerItems(html, categoryInfo, topN = 20) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const items = [];
  const seenIds = new Set();

  // 1. Check window.__PRELOADED_STATE__ if present in SSR
  let preloadedProducts = null;
  $('script').each((_, el) => {
    if (preloadedProducts) return;
    const txt = $(el).contents().text();
    const idx = txt.indexOf('__PRELOADED_STATE__');
    if (idx !== -1) {
      try {
        const eqIdx = txt.indexOf('=', idx);
        if (eqIdx !== -1) {
          let jsonStr = txt.slice(eqIdx + 1).trim();
          if (jsonStr.endsWith(';')) jsonStr = jsonStr.slice(0, -1).trim();
          const parsed = JSON.parse(jsonStr);
          const candidateList = parsed.productSearch?.products || parsed.search?.products || parsed.products;
          if (Array.isArray(candidateList) && candidateList.length > 0) {
            preloadedProducts = candidateList;
          }
        }
      } catch {}
    }
  });

  if (Array.isArray(preloadedProducts) && preloadedProducts.length > 0) {
    for (const p of preloadedProducts) {
      if (items.length >= topN) break;
      const pid = String(p.id || p.productId || '');
      if (!pid || seenIds.has(pid)) continue;
      const price = cleanPriceVal(p.finalPrice || p.price || p.discountedPrice);
      if (!price) continue;
      const originalPrice = cleanPriceVal(p.mrp || p.originalPrice) || price;
      const title = p.title || p.name || '';
      if (!title) continue;

      seenIds.add(pid);
      items.push({
        productId: pid,
        merchant: 'nykaa',
        cleanUrl: p.slug ? `https://www.nykaa.com/${p.slug.replace(/^\//, '')}/p/${pid}` : `https://www.nykaa.com/product/p/${pid}`,
        title: title.slice(0, 200),
        price,
        originalPrice,
        imageUrl: p.imageUrl || p.image || null,
        images: (p.imageUrl || p.image) ? [p.imageUrl || p.image] : [],
        rating: typeof p.rating === 'number' ? p.rating : 4.3,
        category: categoryInfo.category || 'beauty',
        subcategory: categoryInfo.subcategory || 'makeup',
        isActive: true,
        country: 'IN',
      });
    }
    if (items.length > 0) return items;
  }

  // 2. DOM extraction: product cards with /p/ links
  $('a[href*="/p/"]').each((_, el) => {
    if (items.length >= topN) return false;
    const $a = $(el);
    const href = $a.attr('href') || '';
    const pidMatch = href.match(/\/p\/(\d+)/i);
    if (!pidMatch) return;
    const pid = pidMatch[1];
    if (seenIds.has(pid)) return;

    const card = $a.closest('div[class*="productWrapper"], div.product-card, div[class*="css-"], div');
    const scope = card.length ? card : $a;

    const title = scope.find('[class*="product-title"], [class*="title"], h2, div[class*="css-15vhhhd"]').first().text().trim() ||
                  scope.find('img').first().attr('alt');
    if (!title || title.length < 3) return;

    const priceText = scope.find('[class*="css-111z9ua"], [class*="price"], .post-discount-price').first().text().trim();
    const cleanPrice = cleanPriceVal(priceText);
    if (!cleanPrice) return;

    const mrpText = scope.find('[class*="css-17xsgbl"], [class*="mrp"], [class*="discount"]').first().text().trim();
    const cleanMrp = cleanPriceVal(mrpText);
    const originalPrice = cleanMrp && cleanMrp >= cleanPrice ? cleanMrp : cleanPrice;

    const imgEl = scope.find('img[src*="adn-image"], img[src*="nykaa"], img').first();
    let imageUrl = imgEl.attr('data-src') || imgEl.attr('data-lazy-src') || imgEl.attr('src');
    if (imageUrl && (imageUrl.startsWith('data:') || imageUrl.length < 10)) imageUrl = null;
    if (!imageUrl) {
      const srcset = imgEl.attr('srcset');
      if (srcset) {
        const parts = srcset.split(',').map(s => s.trim().split(' ')[0]);
        if (parts.length > 0 && parts[0].startsWith('http')) imageUrl = parts[0];
      }
    }
    const ratingText = scope.find('[class*="css-v3h0e"], [class*="rating"]').first().text().trim();
    const ratingNum = parseFloat(ratingText);
    const rating = !isNaN(ratingNum) && ratingNum >= 1 && ratingNum <= 5 ? ratingNum : 4.3;

    seenIds.add(pid);
    items.push({
      productId: pid,
      merchant: 'nykaa',
      cleanUrl: `https://www.nykaa.com${href.split('?')[0]}`,
      title: title.slice(0, 200),
      price: cleanPrice,
      originalPrice,
      imageUrl: imageUrl || null,
      images: imageUrl ? [imageUrl] : [],
      rating,
      category: categoryInfo.category || 'beauty',
      subcategory: categoryInfo.subcategory || 'makeup',
      isActive: true,
      country: 'IN',
    });
  });

  return items;
}

/**
 * Parses a Myntra search/listing page and extracts topN items.
 */
export function parseMyntraBestsellerItems(html, categoryInfo, topN = 20) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const items = [];
  const seenIds = new Set();

  // 1. Try window.__myx script first
  let myxProducts = null;
  $('script').each((_, el) => {
    if (myxProducts) return;
    const txt = $(el).contents().text();
    const idx = txt.indexOf('__myx');
    if (idx !== -1) {
      try {
        const eqIdx = txt.indexOf('=', idx);
        if (eqIdx !== -1) {
          let jsonStr = txt.slice(eqIdx + 1).trim();
          if (jsonStr.endsWith(';')) jsonStr = jsonStr.slice(0, -1).trim();
          const parsed = JSON.parse(jsonStr);
          const candidateList = parsed.searchData?.results?.products || parsed.pdpData?.products;
          if (Array.isArray(candidateList) && candidateList.length > 0) {
            myxProducts = candidateList;
          }
        }
      } catch {}
    }
  });

  if (Array.isArray(myxProducts) && myxProducts.length > 0) {
    for (const p of myxProducts) {
      if (items.length >= topN) break;
      const pid = String(p.productId || p.id || '');
      if (!pid || seenIds.has(pid)) continue;
      const price = cleanPriceVal(p.price);
      if (!price) continue;
      const originalPrice = cleanPriceVal(p.mrp) || price;
      const title = `${p.brand || ''} ${p.additionalInfo || p.productName || p.product || ''}`.trim();
      if (!title) continue;

      seenIds.add(pid);
      items.push({
        productId: pid,
        merchant: 'myntra',
        cleanUrl: p.landingPageUrl ? `https://www.myntra.com/${p.landingPageUrl.replace(/^\//, '')}` : `https://www.myntra.com/product/${pid}/buy`,
        title: title.slice(0, 200),
        price,
        originalPrice,
        imageUrl: p.searchImage || p.images?.[0]?.src || null,
        images: (p.searchImage || p.images?.[0]?.src) ? [p.searchImage || p.images[0].src] : [],
        rating: typeof p.rating === 'number' ? Math.round(p.rating * 10) / 10 : 4.2,
        category: categoryInfo.category,
        subcategory: categoryInfo.subcategory,
        isActive: true,
        country: 'IN',
      });
    }
    if (items.length > 0) return items;
  }

  // 2. DOM fallback
  $('li.product-base, div.product-base, a[href*="/buy"]').each((_, el) => {
    if (items.length >= topN) return false;
    const $el = $(el);
    const href = $el.attr('href') || $el.find('a[href*="/buy"]').attr('href') || '';
    const idMatch = href.match(/\/(\d+)\/buy/i);
    if (!idMatch) return;
    const pid = idMatch[1];
    if (seenIds.has(pid)) return;

    const brand = $el.find('.product-brand').first().text().trim();
    const prodName = $el.find('.product-product').first().text().trim();
    const title = `${brand} ${prodName}`.trim() || $el.find('img').first().attr('alt');
    if (!title || title.length < 3) return;

    const priceText = $el.find('.product-discountedPrice, .product-price').first().text().trim();
    const cleanPrice = cleanPriceVal(priceText);
    if (!cleanPrice) return;

    const mrpText = $el.find('.product-strike').first().text().trim();
    const cleanMrp = cleanPriceVal(mrpText);
    const originalPrice = cleanMrp && cleanMrp >= cleanPrice ? cleanMrp : cleanPrice;

    const imageUrl = $el.find('img.product-image, img[src*="myntassets"], img').first().attr('src');
    const ratingText = $el.find('.product-ratingsContainer span').first().text().trim();
    const ratingNum = parseFloat(ratingText);
    const rating = !isNaN(ratingNum) && ratingNum >= 1 && ratingNum <= 5 ? ratingNum : 4.2;

    seenIds.add(pid);
    items.push({
      productId: pid,
      merchant: 'myntra',
      cleanUrl: `https://www.myntra.com/${href.replace(/^\//, '')}`,
      title: title.slice(0, 200),
      price: cleanPrice,
      originalPrice,
      imageUrl: imageUrl || null,
      images: imageUrl ? [imageUrl] : [],
      rating,
      category: categoryInfo.category,
      subcategory: categoryInfo.subcategory,
      isActive: true,
      country: 'IN',
    });
  });

  return items;
}

/**
 * Parses a Meesho search/listing page and extracts topN items.
 */
export function parseMeeshoBestsellerItems(html, categoryInfo, topN = 20) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const items = [];
  const seenIds = new Set();

  // 1. Check __NEXT_DATA__
  const nextDataScript = $('script#__NEXT_DATA__').contents().text();
  if (nextDataScript) {
    try {
      const nextData = JSON.parse(nextDataScript);
      const searchProducts = nextData.props?.pageProps?.initialState?.search?.products ||
                             nextData.props?.pageProps?.data?.products ||
                             nextData.props?.pageProps?.products;
      if (Array.isArray(searchProducts) && searchProducts.length > 0) {
        for (const p of searchProducts) {
          if (items.length >= topN) break;
          const pid = String(p.id || p.product_id || p.slug || '');
          if (!pid || seenIds.has(pid)) continue;
          const price = cleanPriceVal(p.discounted_price || p.price || p.min_catalog_price);
          if (!price) continue;
          const originalPrice = cleanPriceVal(p.mrp || p.valid_mrp) || price;
          const title = p.name || p.title || '';
          if (!title) continue;

          seenIds.add(pid);
          items.push({
            productId: pid,
            merchant: 'meesho',
            cleanUrl: p.slug ? `https://www.meesho.com/${p.slug}/p/${pid}` : `https://www.meesho.com/s/p/${pid}`,
            title: title.slice(0, 200),
            price,
            originalPrice,
            imageUrl: p.product_image || p.images?.[0] || null,
            images: (p.product_image || p.images?.[0]) ? [p.product_image || p.images[0]] : [],
            rating: typeof p.rating === 'number' ? Math.round(p.rating * 10) / 10 : 4.0,
            category: categoryInfo.category,
            subcategory: categoryInfo.subcategory,
            isActive: true,
            country: 'IN',
          });
        }
        if (items.length > 0) return items;
      }
    } catch {}
  }

  // 2. DOM fallback
  $('a[href*="/p/"]').each((_, el) => {
    if (items.length >= topN) return false;
    const $a = $(el);
    const href = $a.attr('href') || '';
    const idMatch = href.match(/\/p\/([a-z0-9]+)/i);
    if (!idMatch) return;
    const pid = idMatch[1];
    if (seenIds.has(pid)) return;

    const card = $a.closest('div[class*="Card"], div[class*="ProductCard"], div');
    const scope = card.length ? card : $a;

    const title = scope.find('h5, p, span[class*="title"]').first().text().trim() ||
                  scope.find('img').first().attr('alt');
    if (!title || title.length < 3) return;

    let cleanPrice = null;
    let cleanMrp = null;
    scope.find('*').each((_, child) => {
      const txt = $(child).text().trim();
      if (/^₹\s*[\d,]+/.test(txt)) {
        const val = cleanPriceVal(txt);
        if (!cleanPrice) cleanPrice = val;
        else if (val && val > cleanPrice) cleanMrp = val;
      }
    });

    if (!cleanPrice) return;
    const originalPrice = cleanMrp && cleanMrp >= cleanPrice ? cleanMrp : cleanPrice;
    const imageUrl = scope.find('img[src*="meesho"], img').first().attr('src');

    seenIds.add(pid);
    items.push({
      productId: pid,
      merchant: 'meesho',
      cleanUrl: `https://www.meesho.com${href.split('?')[0]}`,
      title: title.slice(0, 200),
      price: cleanPrice,
      originalPrice,
      imageUrl: imageUrl || null,
      images: imageUrl ? [imageUrl] : [],
      rating: 4.0,
      category: categoryInfo.category,
      subcategory: categoryInfo.subcategory,
      isActive: true,
      country: 'IN',
    });
  });

  return items;
}

/**
 * Parses an Ajio search/listing page and extracts topN items.
 */
export function parseAjioBestsellerItems(html, categoryInfo, topN = 20) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const items = [];
  const seenIds = new Set();

  // 1. Try window.__PRELOADED_STATE__ script first
  let ajioProducts = null;
  $('script').each((_, el) => {
    if (ajioProducts) return;
    const txt = $(el).contents().text();
    const idx = txt.indexOf('__PRELOADED_STATE__');
    if (idx !== -1) {
      try {
        const eqIdx = txt.indexOf('=', idx);
        if (eqIdx !== -1) {
          let jsonStr = txt.slice(eqIdx + 1).trim();
          if (jsonStr.endsWith(';')) jsonStr = jsonStr.slice(0, -1).trim();
          const parsed = JSON.parse(jsonStr);
          const grid = parsed.grid?.entities || parsed.search?.products || parsed.gridData?.products;
          if (Array.isArray(grid) && grid.length > 0) {
            ajioProducts = grid;
          }
        }
      } catch {}
    }
  });

  if (Array.isArray(ajioProducts) && ajioProducts.length > 0) {
    for (const p of ajioProducts) {
      if (items.length >= topN) break;
      const pid = String(p.code || p.fnlColorVariantData?.outfitCode || p.id || '');
      if (!pid || seenIds.has(pid)) continue;
      const price = cleanPriceVal(p.price?.value || p.discountedPrice || p.price);
      if (!price) continue;
      const originalPrice = cleanPriceVal(p.wasPriceData?.value || p.mrp || p.originalPrice) || price;
      const title = `${p.brandName || ''} ${p.name || ''}`.trim() || p.name || '';
      if (!title) continue;

      const imgUrl = p.images?.[0]?.url || p.fnlColorVariantData?.galleryImages?.[0]?.url || null;

      seenIds.add(pid);
      items.push({
        productId: pid,
        merchant: 'ajio',
        cleanUrl: p.url ? (p.url.startsWith('http') ? p.url : `https://www.ajio.com${p.url}`) : `https://www.ajio.com/p/${pid}`,
        title: title.slice(0, 200),
        price,
        originalPrice,
        imageUrl: imgUrl,
        images: imgUrl ? [imgUrl] : [],
        rating: 4.2,
        category: categoryInfo.category || 'men-fashion',
        subcategory: categoryInfo.subcategory || 'men-topwear',
        isActive: true,
        country: 'IN',
      });
    }
    if (items.length > 0) return items;
  }

  // 2. DOM fallback
  $('a[href*="/p/"]').each((_, el) => {
    if (items.length >= topN) return false;
    const $a = $(el);
    const href = $a.attr('href') || '';
    const idMatch = href.match(/\/p\/([a-z0-9_]+)/i);
    if (!idMatch) return;
    const pid = idMatch[1];
    if (seenIds.has(pid)) return;

    const card = $a.closest('.item, div[aria-label*="product"], div.rilrtl-products-list__item, div[class*="product"]');
    const scope = card.length ? card : $a;

    const brand = scope.find('div.brand, .brand').first().text().trim();
    const name = scope.find('div.name, .name, [class*="prod-name"]').first().text().trim();
    let title = brand && name ? `${brand} ${name}` : (name || brand || scope.find('img').first().attr('alt'));
    if (!title || title.length < 3) return;

    const priceText = scope.find('span.price, .price, [class*="prod-sp"]').first().text().trim();
    const cleanPrice = cleanPriceVal(priceText);
    if (!cleanPrice) return;

    const mrpText = scope.find('span.orginal-price, [class*="prod-cp"], .orginal-price').first().text().trim();
    const cleanMrp = cleanPriceVal(mrpText);
    const originalPrice = cleanMrp && cleanMrp >= cleanPrice ? cleanMrp : cleanPrice;

    const imgEl = scope.find('img');
    let imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || null;
    if (imageUrl && (imageUrl.startsWith('data:') || imageUrl.length < 10)) imageUrl = null;

    seenIds.add(pid);
    items.push({
      productId: pid,
      merchant: 'ajio',
      cleanUrl: `https://www.ajio.com${href.split('?')[0]}`,
      title: title.slice(0, 200),
      price: cleanPrice,
      originalPrice,
      imageUrl: imageUrl || null,
      images: imageUrl ? [imageUrl] : [],
      rating: 4.2,
      category: categoryInfo.category || 'men-fashion',
      subcategory: categoryInfo.subcategory || 'men-topwear',
      isActive: true,
      country: 'IN',
    });
  });

  return items;
}

/**
 * Parses a Croma search/listing page and extracts topN items.
 */
export function parseCromaBestsellerItems(html, categoryInfo, topN = 20) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const items = [];
  const seenIds = new Set();

  $('li.product-item, div.cp-product, div[data-testid="product-card"], a[href*="/p/"]').each((_, el) => {
    if (items.length >= topN) return false;
    const $el = $(el);
    const $a = $el.is('a[href*="/p/"]') ? $el : $el.find('a[href*="/p/"]').first();
    const href = $a.attr('href') || '';
    const pidMatch = href.match(/\/p\/(\d+)/i) || href.match(/\/p\/([a-z0-9]+)/i);
    if (!pidMatch) return;
    const pid = pidMatch[1];
    if (seenIds.has(pid)) return;

    const scope = $el;
    const title = scope.find('h3.product-title, .product-title a, h3, [class*="productTitle"]').first().text().trim() ||
                  scope.find('img').first().attr('alt');
    if (!title || title.length < 3) return;

    const priceText = scope.find('span.amount, [data-testid="new-price"], .new-price, [class*="amount"]').first().text().trim();
    const cleanPrice = cleanPriceVal(priceText);
    if (!cleanPrice) return;

    const mrpText = scope.find('span.old-price, [data-testid="old-price"], .old-price, [class*="mrp"]').first().text().trim();
    const cleanMrp = cleanPriceVal(mrpText);
    const originalPrice = cleanMrp && cleanMrp >= cleanPrice ? cleanMrp : cleanPrice;

    const imgEl = scope.find('img[src*="croma"], img').first();
    let imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || null;
    if (imageUrl && (imageUrl.startsWith('data:') || imageUrl.length < 10)) imageUrl = null;

    const ratingText = scope.find('[class*="rating"], [data-testid="rating"]').first().text().trim();
    const ratingNum = parseFloat(ratingText);
    const rating = !isNaN(ratingNum) && ratingNum >= 1 && ratingNum <= 5 ? ratingNum : 4.2;

    seenIds.add(pid);
    items.push({
      productId: pid,
      merchant: 'croma',
      cleanUrl: href.startsWith('http') ? href.split('?')[0] : `https://www.croma.com${href.split('?')[0]}`,
      title: title.slice(0, 200),
      price: cleanPrice,
      originalPrice,
      imageUrl: imageUrl || null,
      images: imageUrl ? [imageUrl] : [],
      rating,
      category: categoryInfo.category || 'electronics',
      subcategory: categoryInfo.subcategory || 'mobiles',
      isActive: true,
      country: 'IN',
    });
  });

  return items;
}

/**
 * Universal Store Listing Parser Dispatcher
 */
export function parseStoreListingItems(html, seed, topN = 20) {
  const store = (seed.store || 'amazon').toLowerCase().trim();
  switch (store) {
    case 'flipkart':
      return parseFlipkartBestsellerItems(html, seed, topN);
    case 'nykaa':
      return parseNykaaBestsellerItems(html, seed, topN);
    case 'myntra':
      return parseMyntraBestsellerItems(html, seed, topN);
    case 'meesho':
      return parseMeeshoBestsellerItems(html, seed, topN);
    case 'ajio':
      return parseAjioBestsellerItems(html, seed, topN);
    case 'croma':
      return parseCromaBestsellerItems(html, seed, topN);
    case 'shopsy':
      return parseShopsyBestsellerItems(html, seed, topN);
    case 'amazon':
    default:
      return parseAmazonBestsellerItems(html, seed, topN);
  }
}

let isCrawling = false;

/**
 * Crawls a single seed: fetch its search page via the shared scraper queue, extract top-N
 * products across supported stores, upsert each into the catalog and synthesize authentic deals.
 */
async function crawlOneSeed(seed, stats) {
  const seedStartTime = Date.now();
  const storeName = (seed.store || 'amazon').toUpperCase();
  console.log(`[Shoppers Deals Engine] Crawling ${storeName} ${seed.category}/${seed.subcategory} ("${seed.keywords}")...`);

  const seedResult = { found: 0, enrolled: 0, updated: 0, dealsCreated: 0, error: null, itemsPreview: [] };
  try {
    const html = await fetchCategoryHtml(seed.url);
    if (!html) {
      console.warn(`[Shoppers Deals Engine] ⚠️ Could not fetch HTML for ${storeName} ${seed.category}/${seed.subcategory}`);
      stats.errors++;
      seedResult.error = 'No HTML returned from scraper queue';
    } else {
      const products = parseStoreListingItems(html, seed, seed.topN || 20);
      seedResult.found = products.length;
      console.log(`[Shoppers Deals Engine] Extracted ${products.length} top products for ${storeName} ${seed.subcategory}`);

      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

      for (const prodData of products) {
        if (prodData.title && hasHindiCharacters(prodData.title)) {
          prodData.title = await translateHindiToEnglish(prodData.title);
        }
        if (seedResult.itemsPreview.length < 10) {
          seedResult.itemsPreview.push({
            title: prodData.title ? prodData.title.slice(0, 140) : null,
            price: prodData.price || null,
            originalPrice: prodData.originalPrice || null,
            productId: prodData.productId,
            isNewProduct: false, // will update below if enrolled
          });
        }
        const existing = await Product.findOne({ productId: prodData.productId });

        if (existing) {
          existing.isActive = true;
          if (!existing.merchant || existing.merchant === 'unknown') existing.merchant = prodData.merchant;
          if (!existing.category || existing.category === 'general') existing.category = prodData.category;
          if (!existing.subcategory) existing.subcategory = prodData.subcategory;
          if (prodData.imageUrl && !existing.imageUrl) {
            existing.imageUrl = prodData.imageUrl;
            existing.images = prodData.images;
          }
          existing.isTop20 = true;
          existing.top20Category = prodData.category;
          existing.top20Subcategory = prodData.subcategory;
          if (!existing.productSource) existing.productSource = 'top20_catalog';

          // Check for price changes & synthesize deals
          if (prodData.price && prodData.price !== existing.price) {
            const priorPrice = existing.price;
            existing.previousPrice = priorPrice;
            existing.price = prodData.price;
            existing.priceUpdatedAt = now;

            if (!Array.isArray(existing.priceHistory)) existing.priceHistory = [];
            const dayIdx = existing.priceHistory.findIndex(e => e.date === todayStr);
            if (dayIdx >= 0) {
              if (prodData.price < existing.priceHistory[dayIdx].price) {
                existing.priceHistory[dayIdx].price = prodData.price;
                existing.priceHistory[dayIdx].timestamp = now;
              }
            } else {
              existing.priceHistory.push({
                date: todayStr,
                price: prodData.price,
                originalPrice: prodData.originalPrice || existing.originalPrice,
                timestamp: now,
              });
            }
            if (existing.priceHistory.length > 90) {
              existing.priceHistory = existing.priceHistory.slice(-90);
            }

            // Autonomous deal synthesis if qualifies
            if (priorPrice && priorPrice > prodData.price) {
              const effectiveMRP = existing.originalPrice || prodData.originalPrice || null;
              const sanitizedPrevPrice = (effectiveMRP && priorPrice > effectiveMRP)
                ? effectiveMRP
                : priorPrice;
              const genuineDiscount = Math.round(((sanitizedPrevPrice - prodData.price) / sanitizedPrevPrice) * 100);
              const cashDrop = sanitizedPrevPrice - prodData.price;
              const thresholdCheck = meetsCategoryThreshold(existing.category, existing.subcategory, genuineDiscount, cashDrop, 'IN');
              if (thresholdCheck.qualifies && sanitizedPrevPrice > prodData.price) {
                const deal = new Deal({
                  sourceChannelId: 'shoppers_deals_engine',
                  sourceMessageId: `sde_${prodData.productId}_${Date.now()}`,
                  sourceChannelName: 'Shoppers Deals Engine Discovery',
                  originalText: `Autonomous Price Drop Detected on ${existing.merchant.toUpperCase()} ${existing.subcategory}: ${existing.title} at ₹${prodData.price}`,
                  title: existing.title,
                  description: `Autonomous price drop detected via Shoppers Deals Engine (${existing.merchant}). Price dropped from ₹${sanitizedPrevPrice} to ₹${prodData.price}.`,
                  imageUrl: existing.imageUrl || (existing.images && existing.images[0]) || null,
                  images: existing.images || (existing.imageUrl ? [existing.imageUrl] : []),
                  rating: existing.rating || 4.2,
                  dealUrl: existing.cleanUrl,
                  productId: existing.productId,
                  merchant: existing.merchant,
                  originalPrice: effectiveMRP || null,
                  dealPrice: prodData.price,
                  previousPrice: sanitizedPrevPrice,
                  discountPercentage: genuineDiscount,
                  priceSource: 'price_history',
                  category: existing.category || 'general',
                  subcategory: existing.subcategory || '',
                  bankOffers: existing.bankOffers || [],
                  bankOfferPrice: (existing.bankOffers || []).reduce((min, o) => o.effectivePrice && o.effectivePrice < min ? o.effectivePrice : min, Infinity) !== Infinity
                    ? (existing.bankOffers || []).reduce((min, o) => o.effectivePrice && o.effectivePrice < min ? o.effectivePrice : min, Infinity)
                    : null,
                  coupon: existing.coupon ? { type: 'code', value: null, code: null, label: existing.coupon } : null,
                  isVerified: true,
                  isExpired: false,
                  lastVerifiedAt: now,
                  country: 'IN',
                  createdAt: now,
                  updatedAt: now,
                });
                await deal.save();
                seedResult.dealsCreated = (seedResult.dealsCreated || 0) + 1;
                apiCache.invalidatePattern('/api/deals');
                enqueueDealForPublishing(deal._id, { sourceEngine: 'shoppers_deals_engine' }).catch(() => {});
                evaluateAndTriggerPriceAlerts({
                  productId: existing.productId,
                  livePrice: prodData.price,
                  title: existing.title,
                  dealUrl: existing.cleanUrl,
                  imageUrl: existing.imageUrl,
                  merchant: existing.merchant,
                  category: existing.category,
                  subcategory: existing.subcategory,
                }).catch(() => {});

                // Tier 2 On-Demand PDP Enrichment (Locked Decision #23)
                // Pull full gallery, live bank offers, and coupons for newly detected deal
                scrapeProductUrl(existing.cleanUrl, PRIORITY.INTERACTIVE).then(async (scrapedPdp) => {
                  if (scrapedPdp) {
                    const updateFields = { lastPdpSyncAt: new Date() };
                    if (scrapedPdp.images && scrapedPdp.images.length > 1) {
                      updateFields.images = scrapedPdp.images;
                      updateFields.imageUrl = scrapedPdp.imageUrl || scrapedPdp.images[0];
                    }
                    if (scrapedPdp.bankOffers && scrapedPdp.bankOffers.length > 0) {
                      updateFields.bankOffers = scrapedPdp.bankOffers;
                    }
                    if (scrapedPdp.coupon) {
                      updateFields.coupon = scrapedPdp.coupon;
                    }
                    await Product.updateOne({ _id: existing._id }, { $set: updateFields }).catch(() => {});

                    const dealUpdate = {};
                    if (scrapedPdp.images && scrapedPdp.images.length > 1) {
                      dealUpdate.images = scrapedPdp.images;
                      dealUpdate.imageUrl = scrapedPdp.imageUrl || scrapedPdp.images[0];
                    }
                    if (scrapedPdp.bankOffers && scrapedPdp.bankOffers.length > 0) {
                      dealUpdate.bankOffers = scrapedPdp.bankOffers;
                      const lowestEffective = scrapedPdp.bankOffers.reduce((min, o) => o.effectivePrice && o.effectivePrice < min ? o.effectivePrice : min, Infinity);
                      if (lowestEffective !== Infinity && lowestEffective < prodData.price) {
                        dealUpdate.bankOfferPrice = lowestEffective;
                      }
                    }
                    if (scrapedPdp.coupon) {
                      dealUpdate.coupon = { type: 'code', value: null, code: null, label: scrapedPdp.coupon };
                    }
                    if (Object.keys(dealUpdate).length > 0) {
                      await Deal.updateOne({ _id: deal._id }, { $set: dealUpdate }).catch(() => {});
                      apiCache.invalidatePattern('/api/deals');
                    }
                  }
                }).catch(() => {});
              }
            }
          }

          await existing.save();
          stats.productsUpdated++;
          seedResult.updated++;
        } else {
          const newProduct = new Product({
            ...prodData,
            isTop20: true,
            top20Category: prodData.category,
            top20Subcategory: prodData.subcategory,
            productSource: 'top20_catalog',
            priceHistory: [{ date: todayStr, price: prodData.price, originalPrice: prodData.originalPrice, timestamp: now }],
            lastChecked: now,
            priceUpdatedAt: now,
            createdAt: now,
            updatedAt: now,
          });
          await newProduct.save();
          stats.productsEnrolled++;
          seedResult.enrolled++;
          console.log(`  ✓ Enrolled [${prodData.merchant.toUpperCase()}]: "${prodData.title.slice(0, 45)}..." (₹${prodData.price})`);
        }
      }

      apiCache.invalidatePattern('/api/products');
    }
  } catch (err) {
    console.error(`[Shoppers Deals Engine Error] Failed for ${storeName} ${seed.category}/${seed.subcategory}:`, err.message);
    stats.errors++;
    seedResult.error = err.message;
  }

  const durationMs = Date.now() - seedStartTime;
  stats.seedsCrawled++;

  const runDate = new Date();
  await CrawlerRunLog.create({
    seedId: seed._id,
    store: seed.store || 'amazon',
    category: seed.category,
    subcategory: seed.subcategory,
    keywords: seed.keywords,
    url: seed.url,
    status: seedResult.error ? 'error' : 'success',
    found: seedResult.found,
    enrolled: seedResult.enrolled,
    updated: seedResult.updated,
    dealsCreated: seedResult.dealsCreated || 0,
    durationMs,
    error: seedResult.error,
    itemsPreview: seedResult.itemsPreview || [],
    executedAt: runDate,
  }).catch(err => console.warn('[CrawlerRunLog Warning] Failed to save run log:', err.message));

  const seedUpdate = {
    lastRunAt: runDate,
    lastResult: seedResult,
    $inc: { totalRuns: 1 },
  };
  if (!seed.firstRunAt) {
    seedUpdate.firstRunAt = runDate;
  }
  await CrawlerSeed.updateOne({ _id: seed._id }, seedUpdate).catch(() => {});
}

/**
 * Runs seeds from the DB and enrolls/updates their top-N products.
 */
export async function runCategoryBestsellerCrawl(options = {}) {
  if (isCrawling) {
    console.log('[Shoppers Deals Engine] A crawl is already in progress. Skipping this trigger.');
    return { skipped: true, reason: 'already_running' };
  }

  // Pre-flight check: ensure active ScrapingAnt proxy tokens exist before starting category crawl
  const activeTokens = await ScrapingAntToken.countDocuments({ status: 'active' }).catch(() => 0);
  if (activeTokens === 0) {
    console.log('[Shoppers Deals Engine] ⏸️ 0 active ScrapingAnt tokens. Skipping crawl tick to preserve queue health.');
    return { skipped: true, reason: 'no_active_tokens' };
  }

  isCrawling = true;
  const startedAt = Date.now();

  console.log('==================================================');
  console.log('    RUNNING SHOPPERS DEALS ENGINE (ENGINE 2)');
  console.log('==================================================');

  const stats = { seedsCrawled: 0, productsEnrolled: 0, productsUpdated: 0, errors: 0 };

  try {
    await ensureCrawlerDefaults();
    await CrawlerConfig.updateOne({}, { isRunning: true }, { upsert: true });

    const filter = { isEnabled: true };
    if (options.seedIds && options.seedIds.length > 0) {
      filter._id = { $in: options.seedIds };
    } else if (options.dueOnly) {
      filter.$expr = {
        $or: [
          { $eq: ['$lastRunAt', null] },
          {
            $gte: [
              { $subtract: [new Date(), '$lastRunAt'] },
              { $multiply: ['$frequencyHours', 60 * 60 * 1000] },
            ],
          },
        ],
      };
    }
    const BATCH_SIZE = (options.seedIds && options.seedIds.length > 0) ? options.seedIds.length : (options.batchSize || 3);
    const seeds = await CrawlerSeed.find(filter)
      .sort({ lastRunAt: 1 })
      .limit(BATCH_SIZE)
      .lean();

    if (seeds.length === 0) {
      console.log('[Shoppers Deals Engine] No seeds due right now.');
    } else {
      console.log(`[Shoppers Deals Engine] Dispatching ${seeds.length} multi-store seed(s) with sequential pacing (batch size: ${BATCH_SIZE})...`);
      for (const seed of seeds) {
        await crawlOneSeed(seed, stats);
      }
    }
  } finally {
    const durationMs = Date.now() - startedAt;
    const now = new Date();
    const nextDueSeed = await CrawlerSeed.aggregate([
      { $match: { isEnabled: true } },
      {
        $addFields: {
          dueAt: {
            $cond: [
              { $eq: ['$lastRunAt', null] },
              now,
              { $add: ['$lastRunAt', { $multiply: ['$frequencyHours', 60 * 60 * 1000] }] },
            ],
          },
        },
      },
      { $sort: { dueAt: 1 } },
      { $limit: 1 },
    ]).catch(() => []);
    const nextRunAt = nextDueSeed[0]?.dueAt || null;

    await CrawlerConfig.updateOne(
      {},
      {
        isRunning: false,
        lastRunAt: now,
        lastRunStats: { ...stats, durationMs },
        nextRunAt,
      },
      { upsert: true }
    ).catch(() => {});
    isCrawling = false;
  }

  console.log('\n==================================================');
  console.log(`[Shoppers Deals Engine Finished] Seeds: ${stats.seedsCrawled} | Enrolled: ${stats.productsEnrolled} | Updated: ${stats.productsUpdated} | Errors: ${stats.errors}`);
  console.log('==================================================\n');

  return stats;
}

let isPipelineTickRunning = false;

/**
 * Continuous Elastic Backpressure Pipeline Feeder (Engine 2)
 *
 * Dynamically balances supply and demand:
 * - Checks live BullMQ queue depth and active worker count in Redis.
 * - If workers are free (queue depth < activeWorkers), calculates available headroom.
 * - Pulls oldest due search seeds from MongoDB and dispatches them at PRIORITY.BESTSELLER.
 * - If Telegram deals arrive (Priority 2) or workers are busy, automatically backs off.
 * - Auto-scales throughput as more workers (e.g. 5, 8, 10) are added without code changes.
 */
export async function tickContinuousSearchPipeline() {
  if (isPipelineTickRunning) return;
  isPipelineTickRunning = true;

  try {
    const config = await CrawlerConfig.findOne({});
    if (config && config.isEnabled === false) return;

    // 1. Pre-flight check: ensure active ScrapingAnt proxy tokens exist
    const activeTokens = await ScrapingAntToken.countDocuments({ status: 'active' }).catch(() => 0);
    if (activeTokens === 0) return;

    // 2. Queue Depth & Live Worker Capacity Inspection
    const queueStatus = await scraperQueue.getStatus();
    const activeWorkers = Math.max(1, queueStatus.activeWorkers || 1);
    const waitingJobs = queueStatus.counts?.waiting || 0;
    const activeJobs = queueStatus.counts?.active || 0;
    const currentQueueDepth = waitingJobs + activeJobs;

    // 3. Elastic Backpressure Calculation
    const freeCapacity = activeWorkers - currentQueueDepth;
    if (freeCapacity <= 0) {
      // Workers are fully saturated (processing Telegram drops or active seeds)
      return;
    }

    // Smooth streaming intake limit: feed at most freeCapacity (capped at 2 seeds per tick to prevent bursts)
    const intakeLimit = Math.min(freeCapacity, 2);

    const now = new Date();
    // Safety minimum cooldown per individual seed (45 minutes)
    // Ensures continuous round-robin streaming across all seeds whenever scrapers have free capacity,
    // without spamming the exact same search query in under 45 minutes.
    const MIN_SEED_COOLDOWN_MS = 45 * 60 * 1000;
    const cooldownCutoff = new Date(now.getTime() - MIN_SEED_COOLDOWN_MS);

    const eligibleFilter = {
      isEnabled: true,
      $or: [
        { lastRunAt: null },
        { lastRunAt: { $lte: cooldownCutoff } },
      ],
    };

    const eligibleSeeds = await CrawlerSeed.find(eligibleFilter)
      .sort({ lastRunAt: 1 })
      .limit(intakeLimit)
      .lean();

    if (!eligibleSeeds || eligibleSeeds.length === 0) {
      return; // All seeds were crawled within the last 45 minutes
    }

    console.log(`[Continuous Pipeline] ⚡ Available worker slots: ${freeCapacity}/${activeWorkers} (Queue depth: ${currentQueueDepth}). Feeding ${eligibleSeeds.length} search seed(s)...`);

    // Immediately mark lastRunAt = now so the next 15s tick won't double-enqueue the same seed while in flight
    const seedIds = eligibleSeeds.map(s => s._id);
    await CrawlerSeed.updateMany(
      { _id: { $in: seedIds } },
      { $set: { lastRunAt: now } }
    ).catch(() => {});

    const stats = { seedsCrawled: 0, productsEnrolled: 0, productsUpdated: 0, errors: 0 };
    for (const seed of eligibleSeeds) {
      crawlOneSeed(seed, stats).catch(err => {
        console.error(`[Continuous Pipeline Error] Failed for ${seed.store} ${seed.category}/${seed.subcategory}:`, err.message);
      });
    }
  } catch (err) {
    console.error('[Continuous Pipeline Error]:', err.message);
  } finally {
    isPipelineTickRunning = false;
  }
}

/**
 * Starts the continuous elastic pipeline loop.
 * Checks queue backpressure every 15 seconds.
 */
export function startBestsellerCrawlerScheduler() {
  console.log('[Continuous Pipeline] 🚀 Initializing Reactive Elastic Pipeline (15s backpressure loop)...');

  // Run the continuous elastic pipeline tick every 15 seconds
  setInterval(async () => {
    try {
      await tickContinuousSearchPipeline();
    } catch (err) {
      console.error('[Continuous Pipeline Loop Error]:', err.message);
    }
  }, 15000);

  // Periodically record Engine 3 (Bestseller Crawler) heartbeat to MongoDB Atlas every 60 seconds
  const sendCrawlerHeartbeat = async () => {
    try {
      const [totalSeeds, activeSeeds] = await Promise.all([
        CrawlerSeed.countDocuments({}).catch(() => 0),
        CrawlerSeed.countDocuments({ isEnabled: true }).catch(() => 0),
      ]);
      await recordEngineHeartbeat({
        engineId: 'engine_3_bestseller_crawler',
        name: 'Bestseller Category Crawler (Engine 3)',
        service: 'api',
        status: activeSeeds > 0 ? 'healthy' : 'idle',
        metrics: {
          totalSeeds,
          activeSeeds,
          tickIntervalSeconds: 15,
        },
        lastActivity: new Date(),
      });
    } catch (e) {}
  };
  sendCrawlerHeartbeat();
  setInterval(sendCrawlerHeartbeat, 60 * 1000);
}

/**
 * Auto-seed a new keyword into CrawlerSeed when a user searches for something
 * that returns zero results in our catalog.
 */
export async function autoSeedZeroResultQuery(queryText, preferredStore = 'amazon') {
  if (!queryText || typeof queryText !== 'string') return null;
  const clean = queryText.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  if (clean.length < 3 || clean.length > 60) return null;

  // Filter out pure numbers or generic stopwords
  if (/^\d+$/.test(clean) || ['the', 'and', 'for', 'all', 'deal', 'deals', 'price', 'track', 'product'].includes(clean)) {
    return null;
  }

  try {
    const existing = await CrawlerSeed.findOne({
      store: preferredStore,
      keywords: clean,
    });

    if (existing) {
      return existing;
    }

    const searchUrl = buildStoreSearchUrl(preferredStore, clean);
    const newSeed = await CrawlerSeed.create({
      store: preferredStore,
      category: 'search',
      subcategory: 'user_requested',
      keywords: clean,
      url: searchUrl,
      topN: 20,
      isEnabled: true,
      frequencyHours: 12, // User-requested search keywords crawled with higher priority (12h)
    });

    console.log(`[Crawler Auto-Seed] 🎯 Auto-seeded new keyword from user search miss: "${clean}" (${preferredStore})`);
    return newSeed;
  } catch (err) {
    // Ignore duplicate key collision
    return null;
  }
}
