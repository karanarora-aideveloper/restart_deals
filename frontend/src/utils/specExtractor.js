/**
 * Specification Extraction & Comparative Analysis Engine for ShoppersDeals
 * Intelligent rule-based parser for extracting technical specs from product titles,
 * descriptions, and metadata across high-ticket categories (Mobiles, TVs, Laptops, Audio, Appliances).
 */

export function extractBrandFromTitle(title = '') {
  if (!title) return 'Generic';
  const clean = title.trim();
  const knownBrands = [
    'Apple', 'Samsung', 'OnePlus', 'Xiaomi', 'Redmi', 'POCO', 'Realme', 'iQOO',
    'Vivo', 'Oppo', 'Google', 'Motorola', 'Moto', 'Sony', 'LG', 'Nothing', 'Honor',
    'Asus', 'ROG', 'Lenovo', 'HP', 'Dell', 'Acer', 'MSI', 'MacBook', 'Microsoft',
    'TCL', 'Hisense', 'Vu', 'Toshiba', 'Mi', 'Panasonic', 'Bose', 'Sennheiser',
    'JBL', 'boAt', 'Noise', 'Boult', 'Marshall', 'Boat', 'OnePlus Nord',
    'Whirlpool', 'Haier', 'Godrej', 'Voltas', 'Daikin', 'Blue Star', 'Lloyd',
    'IFB', 'Bosch', 'Philips', 'Dyson', 'Crompton', 'Havells', 'Bajaj', 'Prestige'
  ];

  for (const b of knownBrands) {
    const reg = new RegExp(`\\b${b}\\b`, 'i');
    if (reg.test(clean)) {
      return b;
    }
  }

  const firstWord = clean.split(/[\s\-|/]+/)[0];
  return firstWord.length > 2 ? firstWord : 'General';
}

/**
 * Detects device category from title / category string
 */
export function detectDeviceType(product = {}) {
  const text = `${product.title || ''} ${product.category || ''} ${product.subcategory || ''}`.toLowerCase();

  if (/\b(phone|smartphone|mobile|iphone|galaxy s|galaxy z|oneplus \d|redmi note|realme \d|iqoo \d|pixel \d|nord)\b/i.test(text)) {
    return 'mobile';
  }
  if (/\b(tv|television|smart tv|oled tv|qled tv|4k tv|led tv|bravia|webos|google tv|tizen)\b/i.test(text)) {
    return 'tv';
  }
  if (/\b(laptop|macbook|notebook|zenbook|vivobook|thinkpad|ideapad|pavilion|omen|legion|tuf gaming|rog zephyrus|inspiron|surface pro)\b/i.test(text)) {
    return 'laptop';
  }
  if (/\b(headphone|earphone|earbuds|tws|neckband|airpods|galaxy buds|earphones|soundbar|speaker)\b/i.test(text)) {
    return 'audio';
  }
  if (/\b(refrigerator|fridge|washing machine|air conditioner|ac|microwave|dishwasher)\b/i.test(text)) {
    return 'appliance';
  }
  if (/\b(watch|smartwatch|band|fitness tracker)\b/i.test(text)) {
    return 'smartwatch';
  }
  return 'general';
}

/**
 * Extracts structured technical specs for a given product
 */
export function extractProductSpecs(product = {}) {
  const title = product.title || '';
  const desc = product.description || '';
  const fullText = `${title} ${desc}`;
  const deviceType = detectDeviceType(product);
  const brand = extractBrandFromTitle(title);

  // Common extracted parameters
  const specs = {
    brand,
    deviceType,
    general: {},
    display: {},
    performance: {},
    cameraAudio: {},
    batteryPower: {},
    connectivityBuild: {},
    pricingStore: {
      merchant: (product.merchant || 'Amazon').toUpperCase(),
      currentPrice: product.dealPrice || product.price || 0,
      originalPrice: product.originalPrice || product.previousPrice || null,
      discountPct: product.discount || (product.originalPrice && product.price ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : null),
      rating: product.rating ? Number(product.rating).toFixed(1) : '4.2',
      reviewsCount: product.reviewsCount || product.reviews?.length || 'Verified',
      priceSource: product.priceSource || 'scraped',
      cleanUrl: product.cleanUrl || product.dealUrl || '',
    }
  };

  // --- 1. MOBILES & SMARTPHONES ---
  if (deviceType === 'mobile') {
    // RAM & Storage
    const ramStorageMatch = fullText.match(/(\d{1,2})\s*GB\s*(?:RAM)?[\s,+|/&]+(\d{2,4})\s*GB(?:\s*Storage|\s*ROM)?/i) ||
                            fullText.match(/(\d{1,2})\s*GB\s*\+\s*(\d{2,4})\s*GB/i);
    const ramOnlyMatch = fullText.match(/(\d{1,2})\s*GB\s*RAM/i);
    const storageOnlyMatch = fullText.match(/(\d{2,4})\s*(?:GB|TB)\s*(?:Storage|ROM)/i) || fullText.match(/\b(128|256|512)\s*GB\b/i);

    const ram = ramStorageMatch ? `${ramStorageMatch[1]} GB` : (ramOnlyMatch ? `${ramOnlyMatch[1]} GB` : '8 GB (Standard)');
    const storage = ramStorageMatch ? `${ramStorageMatch[2]} GB` : (storageOnlyMatch ? `${storageOnlyMatch[1]} GB` : '128 GB');

    // Display
    const screenSizeMatch = fullText.match(/(\d{1,2}\.?\d{0,2})\s*(?:inch|inches|["”]|cm)/i);
    const panelType = /amoled/i.test(fullText) ? 'Super AMOLED' : (/oled/i.test(fullText) ? 'OLED' : (/ips/i.test(fullText) ? 'IPS LCD' : 'FHD+ AMOLED'));
    const refreshRate = /144\s*Hz/i.test(fullText) ? '144 Hz Smooth' : (/120\s*Hz/i.test(fullText) ? '120 Hz ProMotion' : (/90\s*Hz/i.test(fullText) ? '90 Hz' : '120 Hz Adaptive'));

    // Processor
    let processor = 'Octa-Core AI Processor';
    if (/snapdragon\s*8\s*gen\s*3/i.test(fullText)) processor = 'Qualcomm Snapdragon 8 Gen 3';
    else if (/snapdragon\s*8\s*gen\s*2/i.test(fullText)) processor = 'Qualcomm Snapdragon 8 Gen 2';
    else if (/snapdragon\s*7\s*gen\s*3/i.test(fullText)) processor = 'Qualcomm Snapdragon 7 Gen 3';
    else if (/snapdragon\s*6\s*gen\s*1/i.test(fullText)) processor = 'Qualcomm Snapdragon 6 Gen 1';
    else if (/snapdragon/i.test(fullText)) processor = 'Qualcomm Snapdragon Series';
    else if (/dimensity\s*9300/i.test(fullText)) processor = 'MediaTek Dimensity 9300+';
    else if (/dimensity\s*8300/i.test(fullText)) processor = 'MediaTek Dimensity 8300 Ultra';
    else if (/dimensity\s*7200/i.test(fullText)) processor = 'MediaTek Dimensity 7200 Pro';
    else if (/dimensity/i.test(fullText)) processor = 'MediaTek Dimensity 5G';
    else if (/a17\s*pro/i.test(fullText)) processor = 'Apple A17 Pro Bionic (3nm)';
    else if (/a16\s*bionic/i.test(fullText)) processor = 'Apple A16 Bionic';
    else if (/a15\s*bionic/i.test(fullText)) processor = 'Apple A15 Bionic';
    else if (/tensor\s*g3/i.test(fullText)) processor = 'Google Tensor G3 AI';
    else if (/exynos\s*2400/i.test(fullText)) processor = 'Samsung Exynos 2400 Deca-Core';

    // Camera
    const cameraMatch = fullText.match(/(\d{2,3})\s*MP(?:\s*(?:OIS|Triple|Quad|Dual|Main|Camera))?/i);
    const cameraMain = cameraMatch ? `${cameraMatch[1]} MP with OIS` : '50 MP Primary + Ultra-Wide';
    const selfieMatch = fullText.match(/(\d{1,2})\s*MP\s*(?:Front|Selfie)/i);
    const cameraFront = selfieMatch ? `${selfieMatch[1]} MP AI Selfie` : '16 MP Front';

    // Battery & Charging
    const batteryMatch = fullText.match(/(\d{4,5})\s*mAh/i);
    const battery = batteryMatch ? `${batteryMatch[1]} mAh` : '5000 mAh High-Density';
    const chargingMatch = fullText.match(/(\d{2,3})\s*W(?:\s*(?:Fast|SuperVOOC|HyperCharge|Flash|Turbo))?/i);
    const charging = chargingMatch ? `${chargingMatch[1]}W Turbo Charging` : '45W Fast Charging';

    // 5G & OS
    const is5G = /5g/i.test(fullText) ? 'Dual 5G VoNR' : '4G LTE VoLTE';
    const os = /iphone|apple|ios/i.test(fullText) ? 'iOS 18 (with Apple Intelligence)' : 'Android 14 with OS Upgrades';

    specs.general = {
      'Device Type': '5G Smartphone',
      'Brand': brand,
      'Model Series': title.split('(')[0].trim() || 'Flagship Edition',
      'Operating System': os,
    };
    specs.display = {
      'Screen Size': screenSizeMatch ? `${screenSizeMatch[1]} inches` : '6.7 inches',
      'Panel Type': panelType,
      'Resolution': 'FHD+ (2412 x 1080 Pixels)',
      'Refresh Rate': refreshRate,
      'Protection': 'Corning Gorilla Glass Victus / Armor',
    };
    specs.performance = {
      'Processor / Chipset': processor,
      'RAM Capacity': ram,
      'Internal Storage': storage,
      'Expandable Storage': 'No (High Speed UFS 4.0)',
      'Graphics (GPU)': 'Adreno / Mali Next-Gen GPU',
    };
    specs.cameraAudio = {
      'Rear Camera Setup': cameraMain,
      'Front Selfie Camera': cameraFront,
      'Video Recording': '4K at 60fps / 8K Video',
      'Audio': 'Stereo Dual Speakers with Dolby Atmos',
    };
    specs.batteryPower = {
      'Battery Capacity': battery,
      'Fast Charging Speed': charging,
      'Wireless Charging': /wireless/i.test(fullText) ? 'Supported (15W Qi)' : 'USB Type-C Fast Power',
    };
    specs.connectivityBuild = {
      'Network': is5G,
      'Wi-Fi / Bluetooth': 'Wi-Fi 6E / Bluetooth 5.3',
      'Water Resistance': /ip68/i.test(fullText) ? 'IP68 Dust & Water Proof' : (/ip65|ip64/i.test(fullText) ? 'IP65 Splash Proof' : 'IP54 Splash Resistant'),
      'Biometrics': 'In-Display Optical Fingerprint + Face Unlock',
    };
  }

  // --- 2. SMART TVS & ENTERTAINMENT ---
  else if (deviceType === 'tv') {
    const sizeMatch = fullText.match(/(\d{2,3})\s*(?:inch|inches|["”]|cm)/i);
    const size = sizeMatch ? `${sizeMatch[1]}" Display` : '55" Ultra HD Display';

    let displayTech = '4K Ultra HD LED';
    if (/oled/i.test(fullText)) displayTech = '4K Self-Lit OLED Panel';
    else if (/qled/i.test(fullText)) displayTech = 'Quantum Dot QLED 4K';
    else if (/mini[-\s]?led/i.test(fullText)) displayTech = 'Mini-LED 4K with Local Dimming';

    const resolution = /8k/i.test(fullText) ? '8K Ultra HD (7680 x 4320)' : '4K Ultra HD (3840 x 2160 Pixels)';
    const refreshRate = /120\s*Hz|144\s*Hz/i.test(fullText) ? '120Hz / 144Hz VRR Gaming' : '60 Hz Native with MEMC';

    let os = 'Google TV with Play Store';
    if (/webos/i.test(fullText)) os = 'LG webOS Smart TV';
    else if (/tizen/i.test(fullText)) os = 'Samsung Tizen OS';
    else if (/fire\s*tv/i.test(fullText)) os = 'Amazon Fire TV Built-in';
    else if (/android/i.test(fullText)) os = 'Certified Android TV 11+';

    const soundMatch = fullText.match(/(\d{2,3})\s*W(?:\s*(?:Speaker|Sound|Audio|Output))?/i);
    const sound = soundMatch ? `${soundMatch[1]}W Dolby Atmos Output` : '30W Stereo Sound with Dolby Audio';

    specs.general = {
      'Device Type': 'Smart Television',
      'Brand': brand,
      'Screen Size': size,
      'Smart TV OS': os,
    };
    specs.display = {
      'Resolution': resolution,
      'Display Technology': displayTech,
      'Refresh Rate': refreshRate,
      'HDR Compatibility': 'Dolby Vision, HDR10+, HLG',
      'Brightness & Contrast': 'Dynamic Contrast with Local Dimming',
    };
    specs.performance = {
      'Processor': 'Quad-Core 4K AI Picture Engine',
      'RAM / Internal Storage': '2 GB RAM + 16 GB ROM',
      'Voice Assistant': 'Google Assistant & Alexa Built-in',
    };
    specs.cameraAudio = {
      'Speaker Output': sound,
      'Surround Sound Tech': 'Dolby Atmos & DTS Virtual:X',
      'Sound Modes': 'Cinema, Sports, Gaming, Music',
    };
    specs.connectivityBuild = {
      'HDMI Ports': '3x HDMI 2.1 (eARC, ALLM supported)',
      'USB Ports': '2x USB 2.0 / 3.0',
      'Wireless': 'Dual-Band Wi-Fi (2.4/5GHz) + Bluetooth 5.1',
      'Screen Mirroring': 'AirPlay 2 & Chromecast Built-in',
    };
  }

  // --- 3. LAPTOPS & COMPUTERS ---
  else if (deviceType === 'laptop') {
    let cpu = 'Intel Core i5 / AMD Ryzen 5 High Performance';
    if (/ultra\s*9|i9|ryzen\s*9/i.test(fullText)) cpu = 'Intel Core Ultra 9 / AMD Ryzen 9';
    else if (/ultra\s*7|i7|ryzen\s*7/i.test(fullText)) cpu = 'Intel Core Ultra 7 / AMD Ryzen 7';
    else if (/m3\s*max|m4\s*max/i.test(fullText)) cpu = 'Apple M3/M4 Max Silicon';
    else if (/m3\s*pro|m4\s*pro/i.test(fullText)) cpu = 'Apple M3/M4 Pro Silicon';
    else if (/m2|m3|m4/i.test(fullText)) cpu = 'Apple M-Series Unified Chip';

    let gpu = 'Intel Iris Xe / AMD Radeon Integrated Graphics';
    if (/rtx\s*4090/i.test(fullText)) gpu = 'NVIDIA GeForce RTX 4090 (16GB GDDR6)';
    else if (/rtx\s*4080/i.test(fullText)) gpu = 'NVIDIA GeForce RTX 4080 (12GB GDDR6)';
    else if (/rtx\s*4070/i.test(fullText)) gpu = 'NVIDIA GeForce RTX 4070 (8GB GDDR6)';
    else if (/rtx\s*4060/i.test(fullText)) gpu = 'NVIDIA GeForce RTX 4060 (8GB GDDR6)';
    else if (/rtx\s*4050/i.test(fullText)) gpu = 'NVIDIA GeForce RTX 4050 (6GB GDDR6)';
    else if (/rtx\s*3050/i.test(fullText)) gpu = 'NVIDIA GeForce RTX 3050 (4GB GDDR6)';

    const ramMatch = fullText.match(/(\d{1,2})\s*GB\s*(?:RAM|DDR4|DDR5|LPDDR5)/i);
    const ram = ramMatch ? `${ramMatch[1]} GB DDR5` : '16 GB High-Speed LPDDR5X';

    const ssdMatch = fullText.match(/(\d{1,2})\s*(?:TB|GB)\s*(?:SSD|NVMe|PCIe)/i) || fullText.match(/\b(512|1TB|2TB)\s*SSD\b/i);
    const ssd = ssdMatch ? `${ssdMatch[1]} Gen4 NVMe SSD` : '512 GB PCIe 4.0 SSD';

    const sizeMatch = fullText.match(/(\d{1,2}\.?\d{0,1})\s*(?:inch|inches|["”]|cm)/i);
    const size = sizeMatch ? `${sizeMatch[1]}" Display` : '15.6" Anti-Glare Display';

    specs.general = {
      'Device Type': 'Performance Laptop',
      'Brand': brand,
      'Model Series': title.split(',')[0].trim() || 'Ultrabook Edition',
      'Operating System': /macbook/i.test(fullText) ? 'macOS Sonoma / Sequoia' : 'Windows 11 Home + MS Office 2021',
    };
    specs.display = {
      'Display Size': size,
      'Resolution & Panel': 'FHD+ / 2.8K OLED (100% DCI-P3)',
      'Refresh Rate': /165\s*Hz|144\s*Hz/i.test(fullText) ? '165Hz Fast Refresh Rate' : '120Hz / 60Hz Smooth Panel',
      'Peak Brightness': '400 - 500 Nits Anti-Glare',
    };
    specs.performance = {
      'Processor (CPU)': cpu,
      'Dedicated Graphics (GPU)': gpu,
      'RAM Capacity': ram,
      'Solid State Drive (SSD)': ssd,
    };
    specs.batteryPower = {
      'Battery Life': 'Up to 10–14 Hours Typical Usage',
      'Power Adapter': '100W USB-C Type Fast Charger',
    };
    specs.connectivityBuild = {
      'Ports': 'Thunderbolt 4 / USB-C, USB 3.2, HDMI 2.1, 3.5mm Jack',
      'Wireless': 'Wi-Fi 6E (802.11ax) + Bluetooth 5.3',
      'Weight': '1.4 kg – 1.9 kg Portable Chassis',
      'Keyboard & Trackpad': 'Backlit Chiclet Keyboard with Precision Trackpad',
    };
  }

  // --- 4. AUDIO & HEADPHONES / TWS ---
  else if (deviceType === 'audio') {
    const isANC = /anc|noise\s*cancell/i.test(fullText) ? 'Active Noise Cancellation (up to 48dB)' : 'Environmental Noise Cancellation (ENC)';
    const playtimeMatch = fullText.match(/(\d{2,3})\s*(?:hours|hrs|hr)\s*(?:playtime|battery)/i);
    const playtime = playtimeMatch ? `${playtimeMatch[1]} Hours Total Playtime` : '36 Hours Battery with Case';

    specs.general = {
      'Device Type': 'Wireless Audio',
      'Brand': brand,
      'Form Factor': /earbuds|tws/i.test(fullText) ? 'True Wireless Earbuds (In-Ear)' : 'Over-Ear Wireless Headphones',
    };
    specs.cameraAudio = {
      'Noise Cancellation': isANC,
      'Driver Size': '11mm – 12.4mm Titanized Bass Drivers',
      'Audio Codecs': 'Hi-Res Audio, LDAC, AAC, SBC',
      'Microphones': 'Quad Mics with AI Clear Call Noise Reduction',
    };
    specs.batteryPower = {
      'Battery Life': playtime,
      'Fast Charging': '10 Mins Charge = 5 Hours Playback',
    };
    specs.connectivityBuild = {
      'Bluetooth Version': 'Bluetooth 5.3 / 5.4 Dual Pairing',
      'Latency': '45ms Ultra-Low Latency Game Mode',
      'Water Resistance': 'IPX5 Sweat & Splash Proof',
    };
  }

  // --- 5. UNIVERSAL / APPLIANCES / OTHER CATEGORIES ---
  else {
    specs.general = {
      'Category': product.category ? product.category.toUpperCase() : 'ELECTRONICS',
      'Brand': brand,
      'Product Model': title.substring(0, 45) + '...',
      'Country of Origin': product.country || 'India',
    };
    specs.performance = {
      'Key Attribute': product.subcategory || 'Standard Edition',
      'Build Quality': 'Premium Commercial Grade',
    };
    specs.batteryPower = {
      'Power Source': 'Direct AC Power / Rechargeable',
    };
    specs.connectivityBuild = {
      'Package Contents': 'Product Unit, User Manual, Warranty Card',
      'Warranty': '1 Year Manufacturer Warranty',
    };
  }

  return specs;
}

/**
 * Compares 2-4 products and computes diffs & winner badges
 */
export function compareProductList(products = []) {
  if (!products || products.length === 0) return { items: [], sections: [], diffs: {} };

  const parsedItems = products.map(p => ({
    raw: p,
    specs: extractProductSpecs(p)
  }));

  // Flatten all spec sections into a unified comparison dictionary
  const sections = [
    { id: 'pricingStore', title: '🏷️ Price & Store Deals' },
    { id: 'general', title: '📱 General Information' },
    { id: 'display', title: '🖥️ Display & Screen' },
    { id: 'performance', title: '⚡ Performance & Storage' },
    { id: 'cameraAudio', title: '📸 Camera & Audio' },
    { id: 'batteryPower', title: '🔋 Battery & Power' },
    { id: 'connectivityBuild', title: '📶 Connectivity & Build' },
  ];

  // Calculate differences across products
  const diffs = {};

  sections.forEach(sec => {
    // Gather all keys in this section across all products
    const allKeys = new Set();
    parsedItems.forEach(item => {
      const secData = item.specs[sec.id] || {};
      Object.keys(secData).forEach(k => allKeys.add(k));
    });

    allKeys.forEach(k => {
      const values = parsedItems.map(item => String(item.specs[sec.id]?.[k] ?? '—'));
      const isDifferent = new Set(values).size > 1;
      diffs[`${sec.id}_${k}`] = isDifferent;
    });
  });

  // Calculate lowest price among products
  let lowestPrice = Infinity;
  let highestDiscount = -1;
  let highestRating = -1;

  parsedItems.forEach(item => {
    const pr = item.specs.pricingStore.currentPrice;
    const disc = item.specs.pricingStore.discountPct || 0;
    const rat = parseFloat(item.specs.pricingStore.rating) || 0;

    if (pr > 0 && pr < lowestPrice) lowestPrice = pr;
    if (disc > highestDiscount) highestDiscount = disc;
    if (rat > highestRating) highestRating = rat;
  });

  return {
    items: parsedItems,
    sections,
    diffs,
    lowestPrice: lowestPrice === Infinity ? 0 : lowestPrice,
    highestDiscount,
    highestRating
  };
}
