/**
 * variantExtractor.js
 *
 * Extracts and normalizes product variant/size information from product titles
 * so that cross-store price comparisons can detect mismatches (e.g., comparing
 * a 2 kg pack on Amazon against a 1 kg pack on Flipkart, or a 128 GB phone against 256 GB,
 * or Shade 128 vs Shade 220 in beauty/cosmetics).
 *
 * Exported:
 *   extractVariant(title)         → VariantInfo | null
 *   variantsMatch(a, b)           → boolean
 *   variantMismatchReason(a, b)   → string | null
 */

/**
 * VariantInfo shape:
 * {
 *   raw: string,              // The matched text, e.g. "8 GB RAM / 256 GB • Blue"
 *   display: string,          // Clean display label, e.g. "256 GB • Blue" or "Shade: 128 Warm Nude"
 *   weightGrams: number|null, // Normalised weight in grams (or ml for liquids)
 *   packSize: number,         // Number of units in the pack (default 1)
 *   totalGrams: number|null,  // weightGrams * packSize — the true comparable unit
 *   storageGb: number|null,   // Internal storage in GB (e.g. 128, 256, 512, 1024)
 *   ramGb: number|null,       // RAM in GB (e.g. 6, 8, 12, 16)
 *   color: string|null,       // Color variant name (e.g. "Onyx Black", "Blue")
 *   shade: string|null,       // Beauty shade code/name (e.g. "128 Warm Nude", "NC25")
 *   type: 'weight'|'volume'|'count'|'piece'|'tech_storage'|'shade'|'unknown'
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
 * Returns null if no recognisable size/weight/storage/shade is found.
 */
export function extractVariant(title) {
  if (!title || typeof title !== 'string') return null;

  // ---- 1. Tech Storage & RAM (Smartphones, Tablets, Laptops) ----
  let ramGb = null;
  const ramMatch = title.match(/(\d+)\s*(?:GB|gb)\s*RAM\b/i);
  if (ramMatch) ramGb = parseInt(ramMatch[1], 10);

  let storageGb = null;
  const tbMatch = title.match(/(\d+)\s*(?:TB|tb)\s*(?:storage|rom)?(?!\s*RAM)\b/i);
  if (tbMatch) {
    storageGb = parseInt(tbMatch[1], 10) * 1024;
  } else {
    // Avoid matching RAM as storage
    const storageRegex = /(?:,\s*|\b)(\d+)\s*(?:GB|gb)\s*(?:storage|rom)?(?!\s*RAM)\b/gi;
    let sm;
    while ((sm = storageRegex.exec(title)) !== null) {
      const val = parseInt(sm[1], 10);
      if (val >= 16 && val <= 1024) {
        if (!ramGb || val !== ramGb) {
          storageGb = val;
        }
      }
    }
  }

  if (storageGb || ramGb) {
    let color = null;
    // Flipkart syntax: (Color, 128 GB)
    const fkMatch = title.match(/\(([^,()]+),\s*(?:\d+\s*(?:GB|TB))/i);
    if (fkMatch) {
      color = fkMatch[1].trim();
    } else {
      // Amazon syntax: (Color, 8GB RAM, 128GB Storage)
      const amzMatch = title.match(/\(([^,()]+),\s*(?:\d+GB\s*RAM|\d+GB\s*Storage)/i);
      if (amzMatch) color = amzMatch[1].trim();
    }

    let display = '';
    if (ramGb && storageGb) {
      display = `${ramGb} GB RAM / ${storageGb >= 1024 ? (storageGb / 1024) + ' TB' : storageGb + ' GB'}`;
    } else if (storageGb) {
      display = `${storageGb >= 1024 ? (storageGb / 1024) + ' TB' : storageGb + ' GB'}`;
    } else if (ramGb) {
      display = `${ramGb} GB RAM`;
    }

    if (color) display += ` • ${color}`;

    return {
      raw: display,
      display,
      weightGrams: null,
      packSize: 1,
      totalGrams: null,
      storageGb,
      ramGb,
      color,
      shade: null,
      type: 'tech_storage',
    };
  }

  // ---- 2. Cosmetic & Beauty Shade (Nykaa, Myntra, Amazon Beauty) ----
  const shadeMatch = title.match(/(?:[-–|]\s*)([A-Za-z0-9\s/+#.]+?)(?:\s*\(\s*(\d+(?:\.\d+)?)\s*(ml|g|gm|kg)\s*\))?$/i);
  if (shadeMatch) {
    const candidate = shadeMatch[1].trim();
    const isBeautyShade =
      /^\d{1,3}\b/.test(candidate) ||
      /^N[CW]\d{2}\b/i.test(candidate) ||
      /\b(?:shade|no\.)\b/i.test(candidate) ||
      (candidate.length <= 25 && /^[A-Z][a-z]+(?:\s+[A-Z0-9][A-Za-z0-9]*)*$/.test(candidate));

    if (isBeautyShade) {
      let volumeGrams = null;
      if (shadeMatch[2] && shadeMatch[3]) {
        const vVal = parseFloat(shadeMatch[2]);
        const vUnit = shadeMatch[3].toLowerCase();
        const multiplier = WEIGHT_UNITS[vUnit] || 1;
        volumeGrams = vVal * multiplier;
      }

      let display = `Shade: ${candidate}`;
      if (volumeGrams) {
        display += ` (${volumeGrams >= 1000 ? (volumeGrams / 1000) + ' L' : volumeGrams + ' ml'})`;
      }

      return {
        raw: candidate,
        display,
        weightGrams: volumeGrams,
        packSize: 1,
        totalGrams: volumeGrams,
        storageGb: null,
        ramGb: null,
        color: null,
        shade: candidate,
        type: 'shade',
      };
    }
  }

  // ---- 3. Weight / volume pattern: "2 kg", "500g", "1.5L", "250 ml", "500 gm" ----
  // Negative lookahead to ensure bytes/ram like "GB" or "TB" are not matched as grams
  const weightPattern = /(\d+(?:\.\d+)?)\s*(kg|kgs|kilogram|kilograms|g|gm|gms|gram|grams|mg|milligram|milligrams|l|lt|ltr|litre|litres|liter|liters|ml|milliliter|millilitre|milliliters|millilitres)\b(?!\s*(?:b|byte|bit|ram))/gi;

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
      storageGb: null,
      ramGb: null,
      color: null,
      shade: null,
      type,
    };
  }

  // ---- 4. Count / piece pattern: "Pack of 6", "6 pcs", "Combo of 3" ----
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
        storageGb: null,
        ramGb: null,
        color: null,
        shade: null,
        type: 'count',
      };
    }
  }

  // ---- 5. Clothing Size labels: "Small", "Medium", "Large", "XL", "XXL" ----
  const sizeMatch = title.match(/\b(XS|S|M|L|XL|XXL|XXXL|Small|Medium|Large|Extra\s*Large)\b/i);
  if (sizeMatch) {
    return {
      raw: sizeMatch[0],
      display: sizeMatch[0],
      weightGrams: null,
      packSize: 1,
      totalGrams: null,
      storageGb: null,
      ramGb: null,
      color: null,
      shade: null,
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
 * Returns true if two VariantInfo objects represent the same effective size or specification.
 * null variants are considered "unknown" — we return true (no mismatch flagged)
 * to avoid false positives on products without recognisable size info.
 */
export function variantsMatch(a, b) {
  if (!a || !b) return true; // unknown variant — don't flag

  // Tech storage and RAM comparison
  if (a.type === 'tech_storage' && b.type === 'tech_storage') {
    if (a.storageGb && b.storageGb && a.storageGb !== b.storageGb) return false;
    if (a.ramGb && b.ramGb && a.ramGb !== b.ramGb) return false;
    return true;
  }

  // Cosmetic shade comparison
  if (a.type === 'shade' && b.type === 'shade') {
    if (a.shade && b.shade && a.shade.toLowerCase() !== b.shade.toLowerCase()) return false;
    if (a.totalGrams !== null && b.totalGrams !== null) {
      const ratio = a.totalGrams / b.totalGrams;
      return ratio >= (1 - TOLERANCE) && ratio <= (1 + TOLERANCE);
    }
    return true;
  }

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

  if (a.type === 'tech_storage' && b.type === 'tech_storage') {
    if (a.storageGb && b.storageGb && a.storageGb !== b.storageGb) {
      const aS = a.storageGb >= 1024 ? `${a.storageGb / 1024} TB` : `${a.storageGb} GB`;
      const bS = b.storageGb >= 1024 ? `${b.storageGb / 1024} TB` : `${b.storageGb} GB`;
      return `Storage mismatch: ${aS} (this product) vs ${bS} (matched product). Prices are not comparable.`;
    }
    if (a.ramGb && b.ramGb && a.ramGb !== b.ramGb) {
      return `RAM mismatch: ${a.ramGb} GB RAM (this product) vs ${b.ramGb} GB RAM (matched product). Prices are not comparable.`;
    }
  }

  if (a.type === 'shade' && b.type === 'shade') {
    if (a.shade && b.shade && a.shade.toLowerCase() !== b.shade.toLowerCase()) {
      return `Shade mismatch: ${a.shade} (this product) vs ${b.shade} (matched product). Prices may vary significantly by shade.`;
    }
    if (a.totalGrams !== null && b.totalGrams !== null) {
      return `Size mismatch: ${a.display} vs ${b.display}.`;
    }
  }

  if (a && b && a.totalGrams !== null && b.totalGrams !== null) {
    return `Size mismatch: comparing ${a.display} (this product) vs ${b.display} (matched product). Prices may not be comparable.`;
  }
  if (a && b && a.type === 'count' && b.type === 'count') {
    return `Pack size mismatch: Pack of ${a.packSize} vs Pack of ${b.packSize}. Prices may not be comparable.`;
  }
  return `Variant mismatch: ${a?.display || '?'} vs ${b?.display || '?'}`;
}

