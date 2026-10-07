/**
 * Registry of Top Indian D2C Brands & Stores.
 * Covers Beauty & Skincare (Plum, Mamaearth, Minimalist, Derma Co, etc.),
 * Electronics & Audio (boAt, Noise, Boult, Portronics), and Fashion (Snitch, XYXX).
 */
export const D2C_STORES = [
  // --- Beauty, Skincare & Personal Care ---
  {
    merchant: 'plum',
    name: 'Plum Goodness',
    domains: ['plumgoodness.com'],
    category: 'beauty',
    subcategory: 'skincare',
    catalogUrl: 'https://plumgoodness.com/products.json?limit=250',
    productBaseUrl: 'https://plumgoodness.com/products/',
    tagColor: '#5c2d91',
    label: '🌿 Plum Goodness'
  },
  {
    merchant: 'mamaearth',
    name: 'Mamaearth',
    domains: ['mamaearth.in'],
    category: 'beauty',
    subcategory: 'skincare',
    catalogUrl: 'https://mamaearth.in/products.json?limit=250',
    productBaseUrl: 'https://mamaearth.in/products/',
    tagColor: '#00a651',
    label: '🌱 Mamaearth'
  },
  {
    merchant: 'thedermaco',
    name: 'The Derma Co',
    domains: ['thedermaco.com'],
    category: 'beauty',
    subcategory: 'skincare',
    catalogUrl: 'https://thedermaco.com/products.json?limit=250',
    productBaseUrl: 'https://thedermaco.com/products/',
    tagColor: '#005b94',
    label: '🔬 The Derma Co'
  },
  {
    merchant: 'minimalist',
    name: 'Minimalist',
    domains: ['beminimalist.co'],
    category: 'beauty',
    subcategory: 'skincare',
    catalogUrl: 'https://beminimalist.co/products.json?limit=250',
    productBaseUrl: 'https://beminimalist.co/products/',
    tagColor: '#222222',
    label: '✨ Minimalist'
  },
  {
    merchant: 'dotandkey',
    name: 'Dot & Key',
    domains: ['dotandkey.com'],
    category: 'beauty',
    subcategory: 'skincare',
    catalogUrl: 'https://dotandkey.com/products.json?limit=250',
    productBaseUrl: 'https://dotandkey.com/products/',
    tagColor: '#e91e63',
    label: '🍓 Dot & Key'
  },
  {
    merchant: 'mcaffeine',
    name: 'mCaffeine',
    domains: ['mcaffeine.com', 'www.mcaffeine.com'],
    category: 'beauty',
    subcategory: 'skincare',
    catalogUrl: 'https://www.mcaffeine.com/products.json?limit=250',
    productBaseUrl: 'https://www.mcaffeine.com/products/',
    tagColor: '#3d2314',
    label: '☕ mCaffeine'
  },
  {
    merchant: 'foxtale',
    name: 'Foxtale',
    domains: ['foxtale.in'],
    category: 'beauty',
    subcategory: 'skincare',
    catalogUrl: 'https://foxtale.in/products.json?limit=250',
    productBaseUrl: 'https://foxtale.in/products/',
    tagColor: '#f97316',
    label: '🦊 Foxtale'
  },
  {
    merchant: 'aqualogica',
    name: 'Aqualogica',
    domains: ['aqualogica.in'],
    category: 'beauty',
    subcategory: 'skincare',
    catalogUrl: 'https://aqualogica.in/products.json?limit=250',
    productBaseUrl: 'https://aqualogica.in/products/',
    tagColor: '#0284c7',
    label: '💧 Aqualogica'
  },
  {
    merchant: 'drsheths',
    name: "Dr. Sheth's",
    domains: ['drsheths.com', 'www.drsheths.com'],
    category: 'beauty',
    subcategory: 'skincare',
    catalogUrl: 'https://www.drsheths.com/products.json?limit=250',
    productBaseUrl: 'https://www.drsheths.com/products/',
    tagColor: '#059669',
    label: "🩺 Dr. Sheth's"
  },
  {
    merchant: 'bblunt',
    name: 'BBlunt',
    domains: ['bblunt.com'],
    category: 'beauty',
    subcategory: 'haircare',
    catalogUrl: 'https://bblunt.com/products.json?limit=250',
    productBaseUrl: 'https://bblunt.com/products/',
    tagColor: '#1e293b',
    label: '💇 BBlunt'
  },
  {
    merchant: 'sugar',
    name: 'SUGAR Cosmetics',
    domains: ['sugarcosmetics.com'],
    category: 'beauty',
    subcategory: 'makeup',
    catalogUrl: 'https://sugarcosmetics.com/products.json?limit=250',
    productBaseUrl: 'https://sugarcosmetics.com/products/',
    tagColor: '#2b2b2b',
    label: '💄 SUGAR Cosmetics'
  },
  {
    merchant: 'bombayshaving',
    name: 'Bombay Shaving Company',
    domains: ['bombayshavingcompany.com'],
    category: 'beauty',
    subcategory: 'mens-grooming',
    catalogUrl: 'https://bombayshavingcompany.com/products.json?limit=250',
    productBaseUrl: 'https://bombayshavingcompany.com/products/',
    tagColor: '#1e3a5f',
    label: '🪒 Bombay Shaving Co'
  },

  // --- Electronics, Audio & Wearables ---
  {
    merchant: 'boat',
    name: 'boAt',
    domains: ['boat-lifestyle.com', 'www.boat-lifestyle.com'],
    category: 'electronics',
    subcategory: 'audio',
    catalogUrl: 'https://www.boat-lifestyle.com/products.json?limit=250',
    productBaseUrl: 'https://www.boat-lifestyle.com/products/',
    tagColor: '#e60000',
    label: '🎧 boAt'
  },
  {
    merchant: 'noise',
    name: 'Noise',
    domains: ['gonoise.com', 'www.gonoise.com'],
    category: 'electronics',
    subcategory: 'wearables',
    catalogUrl: 'https://www.gonoise.com/products.json?limit=250',
    productBaseUrl: 'https://www.gonoise.com/products/',
    tagColor: '#000000',
    label: '⌚ Noise'
  },
  {
    merchant: 'boult',
    name: 'Boult Audio',
    domains: ['boultaudio.com'],
    category: 'electronics',
    subcategory: 'audio',
    catalogUrl: 'https://boultaudio.com/products.json?limit=250',
    productBaseUrl: 'https://boultaudio.com/products/',
    tagColor: '#dc2626',
    label: '🎵 Boult Audio'
  },
  {
    merchant: 'portronics',
    name: 'Portronics',
    domains: ['portronics.com', 'www.portronics.com'],
    category: 'electronics',
    subcategory: 'accessories',
    catalogUrl: 'https://www.portronics.com/products.json?limit=250',
    productBaseUrl: 'https://www.portronics.com/products/',
    tagColor: '#2563eb',
    label: '🔋 Portronics'
  },

  // --- Fashion, Innerwear & Lifestyle ---
  {
    merchant: 'snitch',
    name: 'Snitch',
    domains: ['snitch.co.in', 'www.snitch.co.in'],
    category: 'men-fashion',
    subcategory: 'men-topwear',
    catalogUrl: 'https://www.snitch.co.in/products.json?limit=250',
    productBaseUrl: 'https://www.snitch.co.in/products/',
    tagColor: '#171717',
    label: '👔 Snitch'
  },
  {
    merchant: 'xyxx',
    name: 'XYXX Apparels',
    domains: ['xyxxcrew.com'],
    category: 'men-fashion',
    subcategory: 'innerwear',
    catalogUrl: 'https://xyxxcrew.com/products.json?limit=250',
    productBaseUrl: 'https://xyxxcrew.com/products/',
    tagColor: '#0f766e',
    label: '🩲 XYXX Apparels'
  },
  {
    merchant: 'huft',
    name: 'Heads Up For Tails',
    domains: ['headsupfortails.com'],
    category: 'general',
    subcategory: 'pet-supplies',
    catalogUrl: 'https://headsupfortails.com/products.json?limit=250',
    productBaseUrl: 'https://headsupfortails.com/products/',
    tagColor: '#c2410c',
    label: '🐾 Heads Up For Tails'
  }
];

export const D2C_DOMAIN_MAP = new Map();
for (const store of D2C_STORES) {
  for (const domain of store.domains) {
    D2C_DOMAIN_MAP.set(domain.toLowerCase(), store);
  }
}

export function findD2CStoreByUrl(url) {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    for (const [domain, store] of D2C_DOMAIN_MAP.entries()) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) {
        return store;
      }
    }
  } catch (e) {}
  return null;
}
