import assert from 'assert';
import { classifyProduct } from '../src/utils/categoryClassifier.js';

const testCases = [
  // 1. Electronics
  {
    title: "POCO M8 Power 5G (Electric Green, 6GB RAM, 128GB Storage)",
    expected: { category: "electronics", subcategory: "mobiles" }
  },
  {
    title: "Apple iPhone 15 (128 GB) - Blue",
    expected: { category: "electronics", subcategory: "mobiles" }
  },
  {
    title: "Apple MacBook Air Laptop: Apple M2 chip, 13.6-inch Liquid Retina Display, 8GB RAM, 256GB SSD",
    expected: { category: "electronics", subcategory: "laptops" }
  },
  {
    title: "Sony WH-1000XM5 Wireless Noise Cancelling Headphones",
    expected: { category: "electronics", subcategory: "audio" }
  },
  {
    title: "OnePlus 108 cm (43 inches) Y Series 4K Ultra HD Smart Android LED TV 43Y1S Pro",
    expected: { category: "electronics", subcategory: "tv" }
  },
  {
    title: "Fastrack Limitless Glide Advanced UltraVU HD Display Smartwatch",
    expected: { category: "electronics", subcategory: "wearables" }
  },
  {
    title: "SanDisk Ultra Dual Drive Go Type-C 128GB Flash Drive",
    expected: { category: "electronics", subcategory: "accessories" }
  },

  // 2. Beauty & Grooming
  {
    title: "Cetaphil Gentle Skin Cleanser for Dry to Normal Sensitive Skin 250ml",
    expected: { category: "beauty", subcategory: "skincare" }
  },
  {
    title: "Aqueria Pack of 3 Underarm Brightening Roll-On for Women",
    expected: { category: "beauty", subcategory: "fragrance" }
  },
  {
    title: "Dot & Key 10% Niacinamide Face Serum with Zinc for Acne Scars",
    expected: { category: "beauty", subcategory: "skincare" }
  },
  {
    title: "Maybelline New York Matte Lipstick, Long-lasting",
    expected: { category: "beauty", subcategory: "makeup" }
  },
  {
    title: "Philips BT3231/15 Smart Beard Trimmer",
    expected: { category: "beauty", subcategory: "appliances" }
  },

  // 3. Appliances
  {
    title: "LG 7 Kg 5 Star Smart Inverter Fully-Automatic Front Loading Washing Machine",
    expected: { category: "appliances", subcategory: "washing-machines" }
  },
  {
    title: "Samsung 236 L 3 Star Frost Free Double Door Refrigerator",
    expected: { category: "appliances", subcategory: "refrigerators" }
  },
  {
    title: "Kent Grand RO Water Purifier 8L",
    expected: { category: "appliances", subcategory: "water-purifiers" }
  },
  {
    title: "LEVOIT Air Purifier for Home Pets Bedroom Washable Pre-Filter",
    expected: { category: "appliances", subcategory: "air-purifiers" }
  },

  // 4. Fashion
  {
    title: "Sam Edelman Women's Bianka Sling Pump Buff Tan 7.5 M",
    expected: { category: "women-fashion", subcategory: "women-footwear" }
  },
  {
    title: "Fastrack Stunners Quartz Analog White Dial Silver Metal Strap Watch for Men",
    expected: { category: "men-fashion", subcategory: "watches" }
  },
  {
    title: "Amazon Brand - Symbol Men's Regular Fit Mid Rise Thermal Bottom",
    expected: { category: "men-fashion", subcategory: "innerwear" }
  },
  {
    title: "SHAPERX Women's Tummy Control Shapewear Thong Bodysuit Seamless Waist",
    expected: { category: "women-fashion", subcategory: "women-innerwear" }
  },

  // 5. Home & Kitchen & Tools
  {
    title: "Wonderchef Galaxy Kadhai with Lid 24 cm 2 litres",
    expected: { category: "home", subcategory: "kitchen-dining" }
  },
  {
    title: "Pigeon by Stovekraft Cruise 1800 watt Induction Cooktop",
    expected: { category: "appliances", subcategory: "kitchen-appliances" }
  },
  {
    title: "Sulfar Power Action IGBT Welding Machine TIG/MMA200 Inverter",
    expected: { category: "home", subcategory: "tools" }
  },
  {
    title: "Metabo HPT 6 Gallon Pancake Air Compressor",
    expected: { category: "home", subcategory: "tools" }
  },
  {
    title: "Odomos Universal Liquid Vaporiser 45ml X Pack Of 6",
    expected: { category: "home", subcategory: "cleaning" }
  },

  // 6. Grocery
  {
    title: "Saffola Cold Pressed Sesame Oil | Unrefined, 0 trans fat, Chemical free 1L",
    expected: { category: "grocery", subcategory: "cooking-staples" }
  },
  {
    title: "PUR Gum, Spearmint, Xylitol Gum, No Artificial Flavor, 165 Count",
    expected: { category: "grocery", subcategory: "snacks-beverages" }
  },

  // 7. Baby & Kids
  {
    title: "Evenflo Revolve360 Extend All-in-One Rotational Convertible Car Seat",
    expected: { category: "baby-kids", subcategory: "baby-gear" }
  },
  {
    title: "Pampers All round Protection Pants Diapers, Large",
    expected: { category: "baby-kids", subcategory: "diapers-wipes" }
  },

  // 8. Auto
  {
    title: "R1 Concepts Rear Brake Kit Fits 2016-2021 Hyundai Tucson",
    expected: { category: "auto", subcategory: "car-accessories" }
  },

  // 9. Books
  {
    title: "A Long Walk to Water: A Powerful Adventure of Survival, Perseverance",
    expected: { category: "books-stationery", subcategory: "books" }
  },

  // 10. Travel
  {
    title: "American Tourister Ivy 68 cms Medium Check-in Polypropylene Hard Luggage Suitcase",
    expected: { category: "travel", subcategory: "luggage" }
  }
];

console.log(`Running Taxonomy Classification Test Suite (${testCases.length} cases)...`);
let passed = 0;
let failed = 0;

for (const { title, merchant, expected } of testCases) {
  const result = classifyProduct(title, merchant || '');
  try {
    assert(result != null, `Result was null for "${title}"`);
    assert.strictEqual(result.category, expected.category, `Category mismatch for "${title}": expected ${expected.category}, got ${result.category}`);
    assert.strictEqual(result.subcategory, expected.subcategory, `Subcategory mismatch for "${title}": expected ${expected.subcategory}, got ${result.subcategory}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL: ${err.message}`);
    failed++;
  }
}

console.log(`\n=========================================`);
console.log(`Results: ${passed}/${testCases.length} PASSED (${failed} failed)`);
console.log(`=========================================`);

if (failed > 0) process.exit(1);
process.exit(0);
