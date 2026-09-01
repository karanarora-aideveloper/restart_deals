/**
 * variantExtractor.js
 *
 * Extracts and normalizes product variant/size information from product titles
 * so that cross-store price comparisons can detect mismatches (e.g., comparing
 * a 2 kg pack on Amazon against a 1 kg pack on Flipkart).
 *
 * Exported:
 *   extractVariant(title)         → VariantInfo | null
 *   variantsMatch(a, b)           → boolean
 *   variantMismatchReason(a, b)   → string | null
 */

/**
 * VariantInfo shape:
 * {
 *   raw: string,           // The matched text, e.g. "2 kg (Pack of 1)"
 *   display: string,       // Clean display label, e.g. "2 kg"
 *   weightGrams: number|null,  // Normalised weight in grams (or ml for liquids)
 *   packSize: number,      // Number of units in the pack (default 1)
 *   totalGrams: number|null,   // weightGrams * packSize — the true comparable unit
 *   type: 'weight'|'volume'|'count'|'piece'|'unknown'
 * }
 */

// Unit conversions to grams (or ml treated as grams for liquid comparisons)
const WEIGHT_UNITS = {
  kg: 1000,
  kgs: 1000,
  kilogram: 1000,
  kilograms: 1000,
  g: 1,
  gm: 1,
  gms: 1,
  gram: 1,
  grams: 1,
  mg: 0.001,
  milligram: 0.001,
  milligrams: 0.001,
  // liquids — treated as ml ≈ g for comparison purposes
  l: 1000,
  lt: 1000,
  ltr: 1000,
  litre: 1000,
  litres: 1000,
  liter: 1000,
  liters: 1000,
  ml: 1,
  milliliter: 1,
  millilitre: 1,
  milliliters: 1,
  millilitres: 1,
  fl: 1, // fluid oz (not exact but rarely used in IN)
};

const VOLUME_UNITS = new Set(['l', 'lt', 'ltr', 'litre', 'litres', 'liter', 'liters', 'ml', 'milliliter', 'millilitre', 'milliliters', 'millilitres']);

/**
 * Parse "pack of N" from a string.
 */
function parsePackSize(text) {
  const packMatch = text.match(/pack\s+of\s+(\d+)/i)
    || text.match(/(\d+)\s*(?:pack|pcs|pieces|nos|count|tablets|capsules|sachets|pouches|strips|units)/i)
    || text.match(/(?:combo|set)\s+of\s+(\d+)/i);
  if (packMatch) return parseInt(packMatch[1], 10);
  return 1;
}

/**
 * Extract variant information from a product title string.
 * Returns null if no recognisable size/weight/quantity is found.
 */
export function extractVariant(title) {
  if (!title || typeof title !== 'string') return null;

  // ---- 1. Weight / volume pattern: "2 kg", "500g", "1.5L", "250 ml", "500 gm" ----
  const weightPattern = /(\d+(?:\.\d+)?)\s*(kg|kgs|kilogram|kilograms|g|gm|gms|gram|grams|mg|milligram|milligrams|l|lt|ltr|litre|litres|liter|liters|ml|milliliter|millilitre|milliliters|millilitres)\b/gi;

  let bestWeight = null;
  let bestUnit = null;
  let bestRaw = '';

  let m;
  while ((m = weightPattern.exec(title)) !== null) {
    const val = parseFloat(m[1]);
    const unit = m[2].toLowerCase();
    const multiplier = WEIGHT_UNITS[unit];
    if (!multiplier) continue;
    const normalized = val * multiplier;
    // Prefer the largest/most-prominent weight mention (e.g. "2 kg" over "5 mg added")
    // but skip implausibly small (< 0.1 g) or large (> 50 kg) numbers
    if (normalized < 0.1 || normalized > 50000) continue;
    if (bestWeight === null || normalized > bestWeight) {
      bestWeight = normalized;
      bestUnit = unit;
      bestRaw = m[0];
    }
  }

  if (bestWeight !== null) {
    const packSize = parsePackSize(title);
    const totalGrams = bestWeight * packSize;
    const type = VOLUME_UNITS.has(bestUnit) ? 'volume' : 'weight';

    // Format display nicely
    let display = bestRaw.trim();
    if (bestWeight >= 1000 && (bestUnit === 'g' || bestUnit === 'gm' || bestUnit === 'gms' || bestUnit === 'gram' || bestUnit === 'grams')) {
      display = `${(bestWeight / 1000).toFixed(bestWeight % 1000 === 0 ? 0 : 1)} kg`;
    } else if (bestWeight >= 1000 && (bestUnit === 'ml' || bestUnit === 'milliliter' || bestUnit === 'millilitre')) {
      display = `${(bestWeight / 1000).toFixed(bestWeight % 1000 === 0 ? 0 : 1)} L`;
    }
    if (packSize > 1) display += ` × ${packSize}`;

    return {
      raw: bestRaw,
      display,
      weightGrams: bestWeight,
      packSize,
      totalGrams,
      type,
    };
  }

  // ---- 2. Count / piece pattern: "Pack of 6", "6 pcs", "Combo of 3" ----
  const countPattern = /(\d+)\s*(?:pcs?|pieces?|nos?\.?|units?|tablets?|capsules?|sachets?|pouches?|strips?|count)\b/i
    || /pack\s+of\s+(\d+)/i
    || /combo\s+of\s+(\d+)/i;

  const countMatch = title.match(/(\d+)\s*(?:pcs?|pieces?|nos?\.?|units?|tablets?|capsules?|sachets?|pouches?|strips?|count)\b/i)
    || title.match(/\bpack\s+of\s+(\d+)/i)
    || title.match(/\bcombo\s+of\s+(\d+)/i)
    || title.match(/\b(\d+)\s*-\s*pack\b/i);

  if (countMatch) {
    const count = parseInt(countMatch[1], 10);
    if (count >= 2 && count <= 500) {
      return {
        raw: countMatch[0],
        display: `Pack of ${count}`,
        weightGrams: null,
        packSize: count,
        totalGrams: null,
        type: 'count',
      };
    }
  }

  // ---- 3. Size labels: "Small", "Medium", "Large", "XL", "XXL" ----
  const sizeMatch = title.match(/\b(XS|S|M|L|XL|XXL|XXXL|Small|Medium|Large|Extra\s*Large)\b/i);
  if (sizeMatch) {
    return {
      raw: sizeMatch[0],
      display: sizeMatch[0],
      weightGrams: null,
      packSize: 1,
      totalGrams: null,
      type: 'piece',
    };
  }

  return null;
}

/**
 * Tolerance for "close enough" weight matches.
 * 5% tolerance handles minor rounding (e.g. 900g vs 1 kg labelled differently).
 */
const TOLERANCE = 0.05;

/**
 * Returns true if two VariantInfo objects represent the same effective size.
 * null variants are considered "unknown" — we return true (no mismatch flagged)
 * to avoid false positives on products without recognisable size info.
 */
export function variantsMatch(a, b) {
  if (!a || !b) return true; // unknown variant — don't flag

  // Both have weight: compare totalGrams within tolerance
  if (a.totalGrams !== null && b.totalGrams !== null) {
    const ratio = a.totalGrams / b.totalGrams;
    return ratio >= (1 - TOLERANCE) && ratio <= (1 + TOLERANCE);
  }

  // Both are count-only: compare pack sizes
  if (a.type === 'count' && b.type === 'count') {
    return a.packSize === b.packSize;
  }

  // Both are clothing sizes: compare display labels
  if (a.type === 'piece' && b.type === 'piece') {
    return a.display.toLowerCase() === b.display.toLowerCase();
  }

  // Mixed types — flag as unknown match
  return true;
}

/**
 * Returns a human-readable mismatch reason, or null if they match.
 */
export function variantMismatchReason(a, b) {
  if (variantsMatch(a, b)) return null;

  if (a && b && a.totalGrams !== null && b.totalGrams !== null) {
    return `Size mismatch: comparing ${a.display} (this product) vs ${b.display} (matched product). Prices may not be comparable.`;
  }
  if (a && b && a.type === 'count' && b.type === 'count') {
    return `Pack size mismatch: Pack of ${a.packSize} vs Pack of ${b.packSize}. Prices may not be comparable.`;
  }
  return `Variant mismatch: ${a?.display || '?'} vs ${b?.display || '?'}`;
}
