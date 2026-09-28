/**
 * Category-Wise Price Drop Threshold Matrix
 *
 * Implements the dual qualification rule:
 * A price change qualifies as a genuine deal if:
 *   (Price Drop % >= minDropPercent) OR (Flat Cash Drop >= minCashFloor)
 */

export const CATEGORY_THRESHOLDS = {
  // Electronics
  'electronics:mobiles':          { minPercent: 3.5, minCash: 1000, label: 'Smartphones & Tablets' },
  'electronics:laptops':          { minPercent: 4.0, minCash: 1500, label: 'Laptops & Computers' },
  'electronics:audio':            { minPercent: 8.0, minCash: 400,  label: 'Audio & Headphones' },
  'electronics:tv':               { minPercent: 6.0, minCash: 1500, label: 'Smart TVs & Monitors' },
  'electronics:wearables':        { minPercent: 8.0, minCash: 400,  label: 'Wearables & Smartwatches' },
  'electronics:cameras':          { minPercent: 5.0, minCash: 1500, label: 'Cameras & Lenses' },
  'electronics:gaming':           { minPercent: 6.0, minCash: 800,  label: 'Gaming & Consoles' },
  'electronics:accessories':      { minPercent: 12.0, minCash: 250, label: 'Electronic Accessories' },
  'electronics':                  { minPercent: 5.0, minCash: 800,  label: 'General Electronics' },

  // Appliances
  'appliances':                   { minPercent: 6.0, minCash: 1500, label: 'Large Appliances' },
  'home:appliances-large':        { minPercent: 6.0, minCash: 1500, label: 'Large Home Appliances' },

  // Beauty & Grooming
  'beauty:skincare':              { minPercent: 10.0, minCash: 250, label: 'Skincare' },
  'beauty:fragrance':             { minPercent: 10.0, minCash: 250, label: 'Fragrances & Perfumes' },
  'beauty:makeup':                { minPercent: 15.0, minCash: 150, label: 'Makeup & Cosmetics' },
  'beauty:haircare':              { minPercent: 12.0, minCash: 200, label: 'Haircare' },
  'beauty:mens-grooming':         { minPercent: 12.0, minCash: 250, label: "Men's Grooming" },
  'beauty:appliances':            { minPercent: 10.0, minCash: 350, label: 'Beauty Appliances' },
  'beauty':                       { minPercent: 12.0, minCash: 200, label: 'General Beauty' },

  // Fashion & Apparel
  'men-fashion':                  { minPercent: 20.0, minCash: 300, label: "Men's Fashion" },
  'women-fashion':                { minPercent: 20.0, minCash: 300, label: "Women's Fashion" },
  'men-fashion:footwear':         { minPercent: 15.0, minCash: 400, label: "Men's Shoes" },
  'women-fashion:women-footwear': { minPercent: 15.0, minCash: 400, label: "Women's Shoes" },
  'men-fashion:watches':          { minPercent: 12.0, minCash: 500, label: "Men's Watches" },
  'women-fashion:women-watches':  { minPercent: 12.0, minCash: 500, label: "Women's Watches" },
  'fashion':                      { minPercent: 20.0, minCash: 300, label: 'General Fashion' },

  // Home & Kitchen
  'home:kitchen':                 { minPercent: 12.0, minCash: 350, label: 'Kitchen & Cookware' },
  'home:furniture':               { minPercent: 10.0, minCash: 800, label: 'Furniture' },
  'home:decor':                   { minPercent: 15.0, minCash: 250, label: 'Home Decor' },
  'home:bedding':                 { minPercent: 15.0, minCash: 300, label: 'Bedding & Linen' },
  'home':                         { minPercent: 12.0, minCash: 350, label: 'General Home' },

  // Fitness
  'fitness:gym-equipment':        { minPercent: 8.0, minCash: 600,  label: 'Gym Equipment' },
  'fitness':                      { minPercent: 10.0, minCash: 400, label: 'General Fitness' },

  // Default Fallback
  'general':                      { minPercent: 10.0, minCash: 200, label: 'General Goods' },
};

/**
 * Check if a price drop qualifies as an authentic deal based on category margins.
 *
 * @param {string} category - Primary category (e.g. 'electronics', 'beauty')
 * @param {string} subcategory - Subcategory (e.g. 'mobiles', 'skincare')
 * @param {number} dropPercent - Computed drop percentage (e.g. 5.5)
 * @param {number} cashDrop - Absolute cash drop amount in local currency (rupees or dollars)
 * @param {string} country - Country code ('IN', 'US', etc., default: 'IN')
 * @returns {{ qualifies: boolean, reason: string, threshold: object }}
 */
export function meetsCategoryThreshold(category, subcategory, dropPercent, cashDrop, country = 'IN') {
  if (dropPercent <= 0 && cashDrop <= 0) {
    return { qualifies: false, reason: 'No price reduction', threshold: null };
  }

  const subKey = (category && subcategory) ? `${category}:${subcategory}`.toLowerCase() : null;
  const catKey = category ? category.toLowerCase() : null;

  const threshold = (subKey && CATEGORY_THRESHOLDS[subKey])
    || (catKey && CATEGORY_THRESHOLDS[catKey])
    || CATEGORY_THRESHOLDS['general'];

  const upperCountry = (country || 'IN').toUpperCase();
  const isUS = upperCountry === 'US';
  const currencySymbol = isUS ? '$' : '₹';

  // Normalize cash floor: Indian thresholds are in INR. For US, convert to USD floor (~80:1)
  const effectiveMinCash = isUS
    ? Math.max(1, Math.round(threshold.minCash / 80 * 10) / 10)
    : threshold.minCash;

  const percentMet = dropPercent >= threshold.minPercent;
  const cashMet = cashDrop >= effectiveMinCash;

  if (percentMet || cashMet) {
    const reason = percentMet && cashMet
      ? `Drop of ${dropPercent}% (>= ${threshold.minPercent}%) AND ${currencySymbol}${cashDrop} (>= ${currencySymbol}${effectiveMinCash})`
      : (percentMet
        ? `Drop of ${dropPercent}% (>= ${threshold.minPercent}% for ${threshold.label})`
        : `Flat cash drop of ${currencySymbol}${cashDrop} (>= ${currencySymbol}${effectiveMinCash} floor for ${threshold.label})`);

    return { qualifies: true, reason, threshold };
  }

  return {
    qualifies: false,
    reason: `Below threshold for ${threshold.label}: ${dropPercent}% < ${threshold.minPercent}% and ${currencySymbol}${cashDrop} < ${currencySymbol}${effectiveMinCash}`,
    threshold,
  };
}
