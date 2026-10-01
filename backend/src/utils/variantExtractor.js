/**
 * variantExtractor.js
 *
 * Extracts and normalizes product variant, size, and specification information
 * from product titles so that cross-store price comparisons (e.g. Amazon vs Flipkart)
 * strictly detect mismatches.
 *
 * Supported Domains:
 *   - Laptops & MacBooks: Chip (M1/M2/M3/M4/i5/i7/Ryzen), RAM, SSD/Storage, Screen Size (13"/15")
 *   - Smartphones & Tablets: Storage, RAM, Color
 *   - Washing Machines: Capacity (Kg), Load Type (Front Load vs Top Load)
 *   - Refrigerators: Capacity (Liters), Door Type (Single vs Double Door), Cooling Type (Direct Cool vs Frost Free)
 *   - Air Conditioners: Capacity (Tons), Type (Split vs Window)
 *   - Ceiling Fans: Motor Type (BLDC vs Standard), Blade Sweep (1200mm, 1400mm)
 *   - Cosmetics & Beauty: Exact Shade Code/Name, Bottle Volume (ml)
 *   - Packaged Goods & Supplements: Weight (Grams/Kg), Pack Size
 *   - Fashion: Apparel Sizes (S, M, L, XL, etc.)
 *
 * Exported:
 *   extractVariant(title)         → VariantInfo | null
 *   variantsMatch(a, b)           → boolean
 *   variantMismatchReason(a, b)   → string | null
 */

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
  fl: 1,
};

const VOLUME_UNITS = new Set(['l', 'lt', 'ltr', 'litre', 'litres', 'liter', 'liters', 'ml', 'milliliter', 'millilitre', 'milliliters', 'millilitres']);

function parsePackSize(text) {
  const packMatch = text.match(/pack\s+of\s+(\d+)/i)
    || text.match(/(\d+)\s*(?:pack|pcs|pieces|nos|count|tablets|capsules|sachets|pouches|strips|units)/i)
    || text.match(/(?:combo|set)\s+of\s+(\d+)/i);
  if (packMatch) return parseInt(packMatch[1], 10);
  return 1;
}

/**
 * Extract chip/processor from title (Apple Silicon, Intel, AMD).
 */
function extractChip(title) {
  const lower = title.toLowerCase();
  // Apple Silicon
  if (lower.match(/\bm4\s*(?:pro|max)\b/)) return 'm4_pro_max';
  if (lower.match(/\bm4\b/)) return 'm4';
  if (lower.match(/\bm3\s*(?:pro|max)\b/)) return 'm3_pro_max';
  if (lower.match(/\bm3\b/)) return 'm3';
  if (lower.match(/\bm2\s*(?:pro|max)\b/)) return 'm2_pro_max';
  if (lower.match(/\bm2\b/)) return 'm2';
  if (lower.match(/\bm1\s*(?:pro|max)\b/)) return 'm1_pro_max';
  if (lower.match(/\bm1\b/)) return 'm1';

  // Intel Core
  if (lower.match(/\bcore\s*i9\b|\bi9\b/)) return 'intel_i9';
  if (lower.match(/\bcore\s*i7\b|\bi7\b/)) return 'intel_i7';
  if (lower.match(/\bcore\s*i5\b|\bi5\b/)) return 'intel_i5';
  if (lower.match(/\bcore\s*i3\b|\bi3\b/)) return 'intel_i3';

  // AMD Ryzen
  if (lower.match(/\bryzen\s*9\b/)) return 'ryzen_9';
  if (lower.match(/\bryzen\s*7\b/)) return 'ryzen_7';
  if (lower.match(/\bryzen\s*5\b/)) return 'ryzen_5';
  if (lower.match(/\bryzen\s*3\b/)) return 'ryzen_3';

  return null;
}

/**
 * Extract screen size in inches (e.g. 13-inch, 13.3", 14", 15", 15.3", 16", 32", 43", 55", 65").
 */
function extractScreenSize(title) {
  const match = title.match(/(\d{1,2}(?:\.\d)?)\s*(?:-inch|inch|inches|["”])\b/i);
  if (match) {
    const sz = parseFloat(match[1]);
    if (sz >= 10 && sz <= 90) return sz;
  }
  return null;
}

/**
 * Extract variant specifications from a product title string.
 */
export function extractVariant(title) {
  if (!title || typeof title !== 'string') return null;

  const lower = title.toLowerCase();

  // ---- 1. Tech: Laptops, MacBooks, Smartphones, Tablets ----
  let ramGb = null;
  const ramMatch = title.match(/(\d+)\s*(?:GB|gb)\s*RAM\b/i);
  if (ramMatch) ramGb = parseInt(ramMatch[1], 10);

  let storageGb = null;
  const tbMatch = title.match(/(\d+)\s*(?:TB|tb)\s*(?:storage|rom|ssd)?(?!\s*RAM)\b/i);
  if (tbMatch) {
    storageGb = parseInt(tbMatch[1], 10) * 1024;
  } else {
    const storageRegex = /(?:,\s*|\b)(\d+)\s*(?:GB|gb)\s*(?:storage|rom|ssd)?(?!\s*RAM)\b/gi;
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

  const chip = extractChip(title);
  const screenSize = extractScreenSize(title);

  if (storageGb || ramGb || chip || (screenSize && (lower.includes('macbook') || lower.includes('laptop')))) {
    let color = null;
    const fkMatch = title.match(/\(([^,()]+),\s*(?:\d+\s*(?:GB|TB))/i);
    if (fkMatch) {
      color = fkMatch[1].trim();
    } else {
      const amzMatch = title.match(/\(([^,()]+),\s*(?:\d+GB\s*RAM|\d+GB\s*Storage)/i);
      if (amzMatch) color = amzMatch[1].trim();
    }

    const parts = [];
    if (chip) parts.push(chip.toUpperCase().replace('_', ' '));
    if (ramGb) parts.push(`${ramGb} GB RAM`);
    if (storageGb) parts.push(storageGb >= 1024 ? `${storageGb / 1024} TB SSD` : `${storageGb} GB`);
    if (screenSize) parts.push(`${screenSize}"`);
    if (color) parts.push(color);

    const display = parts.join(' • ');

    return {
      raw: display,
      display,
      weightGrams: null,
      packSize: 1,
      totalGrams: null,
      storageGb,
      ramGb,
      chip,
      screenSizeInches: screenSize,
      color,
      shade: null,
      type: 'tech_storage',
    };
  }

  // ---- 2. Major Appliances: Washing Machines, Refrigerators, ACs, Fans ----
  // A. Washing Machines
  if (lower.includes('washing machine') || lower.includes('washer')) {
    const kgMatch = title.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilo)\b/i);
    const capacityKg = kgMatch ? parseFloat(kgMatch[1]) : null;
    let loadType = null;
    if (lower.includes('front load')) loadType = 'front_load';
    else if (lower.includes('top load')) loadType = 'top_load';
    else if (lower.includes('semi-automatic') || lower.includes('semi automatic')) loadType = 'semi_automatic';

    const parts = [];
    if (capacityKg) parts.push(`${capacityKg} kg`);
    if (loadType) parts.push(loadType.replace('_', ' ').toUpperCase());

    if (parts.length > 0) {
      const display = parts.join(' • ');
      return {
        raw: display,
        display,
        weightGrams: capacityKg ? capacityKg * 1000 : null,
        packSize: 1,
        totalGrams: capacityKg ? capacityKg * 1000 : null,
        storageGb: null,
        ramGb: null,
        capacityKg,
        loadType,
        type: 'appliance_washing_machine',
      };
    }
  }

  // B. Refrigerators
  if (lower.includes('refrigerator') || lower.includes('fridge')) {
    const ltrMatch = title.match(/(\d+)\s*(?:l|ltr|litres|liter)\b/i);
    const capacityLiters = ltrMatch ? parseInt(ltrMatch[1], 10) : null;
    let doorType = null;
    if (lower.includes('single door')) doorType = 'single_door';
    else if (lower.includes('double door')) doorType = 'double_door';
    else if (lower.includes('side by side')) doorType = 'side_by_side';

    let coolingType = null;
    if (lower.includes('frost free')) coolingType = 'frost_free';
    else if (lower.includes('direct cool') || lower.includes('direct-cool')) coolingType = 'direct_cool';

    const parts = [];
    if (capacityLiters) parts.push(`${capacityLiters} L`);
    if (doorType) parts.push(doorType.replace('_', ' ').toUpperCase());
    if (coolingType) parts.push(coolingType.replace('_', ' ').toUpperCase());

    if (parts.length > 0) {
      const display = parts.join(' • ');
      return {
        raw: display,
        display,
        weightGrams: null,
        packSize: 1,
        totalGrams: null,
        storageGb: null,
        ramGb: null,
        capacityLiters,
        doorType,
        coolingType,
        type: 'appliance_refrigerator',
      };
    }
  }

  // C. Air Conditioners
  if (lower.includes('air conditioner') || lower.includes('split ac') || lower.includes('window ac') || (lower.includes('ac') && lower.includes('ton'))) {
    const tonMatch = title.match(/(\d+(?:\.\d+)?)\s*ton\b/i);
    const capacityTons = tonMatch ? parseFloat(tonMatch[1]) : null;
    let acType = null;
    if (lower.includes('split')) acType = 'split';
    else if (lower.includes('window')) acType = 'window';

    const parts = [];
    if (capacityTons) parts.push(`${capacityTons} Ton`);
    if (acType) parts.push(acType.toUpperCase());

    if (parts.length > 0) {
      const display = parts.join(' • ');
      return {
        raw: display,
        display,
        weightGrams: null,
        packSize: 1,
        totalGrams: null,
        storageGb: null,
        ramGb: null,
        capacityTons,
        acType,
        type: 'appliance_ac',
      };
    }
  }

  // D. Ceiling Fans
  if (lower.includes('fan') && (lower.includes('ceiling') || lower.includes('bldc') || lower.includes('sweep') || lower.includes('1200mm'))) {
    const isBldc = lower.includes('bldc');
    const sweepMatch = title.match(/(\d{3,4})\s*mm\b/i);
    const sweepMm = sweepMatch ? parseInt(sweepMatch[1], 10) : null;

    const parts = [];
    if (isBldc) parts.push('BLDC Motor');
    else parts.push('Standard Motor');
    if (sweepMm) parts.push(`${sweepMm} mm`);

    const display = parts.join(' • ');
    return {
      raw: display,
      display,
      weightGrams: null,
      packSize: 1,
      totalGrams: null,
      storageGb: null,
      ramGb: null,
      motorType: isBldc ? 'bldc' : 'standard',
      sweepMm,
      type: 'appliance_fan',
    };
  }

  // ---- 3. Cosmetic & Beauty Shade (Nykaa, Myntra, Amazon Beauty) ----
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

  // ---- 4. Weight / volume pattern for grocery/consumables: "2 kg", "500g", "1.5L", "250 ml", "500 gm" ----
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

  // ---- 5. Count / piece pattern: "Pack of 6", "6 pcs", "Combo of 3" ----
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

  // ---- 6. Clothing Size labels: "Small", "Medium", "Large", "XL", "XXL" ----
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

const TOLERANCE = 0.05;

/**
 * Returns true if two VariantInfo objects represent the exact same effective specification.
 */
export function variantsMatch(a, b) {
  if (!a || !b) return true; // unknown variant — don't flag as definite mismatch

  // Tech storage, RAM, Chip, and Screen Size comparison
  if (a.type === 'tech_storage' && b.type === 'tech_storage') {
    if (a.storageGb && b.storageGb && a.storageGb !== b.storageGb) return false;
    if (a.ramGb && b.ramGb && a.ramGb !== b.ramGb) return false;
    if (a.chip && b.chip && a.chip !== b.chip) return false;
    if (a.screenSizeInches && b.screenSizeInches) {
      if (Math.abs(a.screenSizeInches - b.screenSizeInches) > 0.6) return false;
    }
    return true;
  }

  // Washing Machine comparison
  if (a.type === 'appliance_washing_machine' && b.type === 'appliance_washing_machine') {
    if (a.capacityKg && b.capacityKg && a.capacityKg !== b.capacityKg) return false;
    if (a.loadType && b.loadType && a.loadType !== b.loadType) return false;
    return true;
  }

  // Refrigerator comparison
  if (a.type === 'appliance_refrigerator' && b.type === 'appliance_refrigerator') {
    if (a.capacityLiters && b.capacityLiters) {
      const ratio = a.capacityLiters / b.capacityLiters;
      if (ratio < 0.95 || ratio > 1.05) return false;
    }
    if (a.doorType && b.doorType && a.doorType !== b.doorType) return false;
    if (a.coolingType && b.coolingType && a.coolingType !== b.coolingType) return false;
    return true;
  }

  // Air Conditioner comparison
  if (a.type === 'appliance_ac' && b.type === 'appliance_ac') {
    if (a.capacityTons && b.capacityTons && a.capacityTons !== b.capacityTons) return false;
    if (a.acType && b.acType && a.acType !== b.acType) return false;
    return true;
  }

  // Fan comparison
  if (a.type === 'appliance_fan' && b.type === 'appliance_fan') {
    if (a.motorType && b.motorType && a.motorType !== b.motorType) return false;
    if (a.sweepMm && b.sweepMm && a.sweepMm !== b.sweepMm) return false;
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

  // Weight / Volume
  if (a.totalGrams !== null && b.totalGrams !== null) {
    const ratio = a.totalGrams / b.totalGrams;
    return ratio >= (1 - TOLERANCE) && ratio <= (1 + TOLERANCE);
  }

  // Count / Pack size
  if (a.type === 'count' && b.type === 'count') {
    return a.packSize === b.packSize;
  }

  // Clothing size
  if (a.type === 'piece' && b.type === 'piece') {
    return a.display.toLowerCase() === b.display.toLowerCase();
  }

  return true;
}

/**
 * Returns a human-readable mismatch reason, or null if they match.
 */
export function variantMismatchReason(a, b) {
  if (variantsMatch(a, b)) return null;

  if (a.type === 'tech_storage' && b.type === 'tech_storage') {
    if (a.chip && b.chip && a.chip !== b.chip) {
      return `Processor/Chip mismatch: ${a.chip.toUpperCase()} vs ${b.chip.toUpperCase()}`;
    }
    if (a.storageGb && b.storageGb && a.storageGb !== b.storageGb) {
      const aS = a.storageGb >= 1024 ? `${a.storageGb / 1024} TB` : `${a.storageGb} GB`;
      const bS = b.storageGb >= 1024 ? `${b.storageGb / 1024} TB` : `${b.storageGb} GB`;
      return `Storage mismatch: ${aS} vs ${bS}`;
    }
    if (a.ramGb && b.ramGb && a.ramGb !== b.ramGb) {
      return `RAM mismatch: ${a.ramGb} GB vs ${b.ramGb} GB`;
    }
    if (a.screenSizeInches && b.screenSizeInches && Math.abs(a.screenSizeInches - b.screenSizeInches) > 0.6) {
      return `Screen size mismatch: ${a.screenSizeInches}" vs ${b.screenSizeInches}"`;
    }
  }

  if (a.type === 'appliance_washing_machine' && b.type === 'appliance_washing_machine') {
    if (a.capacityKg && b.capacityKg && a.capacityKg !== b.capacityKg) {
      return `Capacity mismatch: ${a.capacityKg} kg vs ${b.capacityKg} kg`;
    }
    if (a.loadType && b.loadType && a.loadType !== b.loadType) {
      return `Load type mismatch: ${a.loadType.replace('_', ' ')} vs ${b.loadType.replace('_', ' ')}`;
    }
  }

  if (a.type === 'appliance_refrigerator' && b.type === 'appliance_refrigerator') {
    if (a.capacityLiters && b.capacityLiters && (a.capacityLiters / b.capacityLiters < 0.95 || a.capacityLiters / b.capacityLiters > 1.05)) {
      return `Volume mismatch: ${a.capacityLiters} L vs ${b.capacityLiters} L`;
    }
    if (a.doorType && b.doorType && a.doorType !== b.doorType) {
      return `Door type mismatch: ${a.doorType.replace('_', ' ')} vs ${b.doorType.replace('_', ' ')}`;
    }
  }

  if (a.type === 'appliance_ac' && b.type === 'appliance_ac') {
    if (a.capacityTons && b.capacityTons && a.capacityTons !== b.capacityTons) {
      return `AC Tonnage mismatch: ${a.capacityTons} Ton vs ${b.capacityTons} Ton`;
    }
    if (a.acType && b.acType && a.acType !== b.acType) {
      return `AC type mismatch: ${a.acType} vs ${b.acType}`;
    }
  }

  if (a.type === 'appliance_fan' && b.type === 'appliance_fan') {
    if (a.motorType && b.motorType && a.motorType !== b.motorType) {
      return `Motor type mismatch: ${a.motorType === 'bldc' ? 'BLDC' : 'Standard'} vs ${b.motorType === 'bldc' ? 'BLDC' : 'Standard'}`;
    }
  }

  if (a.type === 'shade' && b.type === 'shade') {
    if (a.shade && b.shade && a.shade.toLowerCase() !== b.shade.toLowerCase()) {
      return `Shade mismatch: ${a.shade} vs ${b.shade}`;
    }
  }

  if (a && b && a.totalGrams !== null && b.totalGrams !== null) {
    return `Size mismatch: ${a.display} vs ${b.display}`;
  }
  if (a && b && a.type === 'count' && b.type === 'count') {
    return `Pack size mismatch: Pack of ${a.packSize} vs Pack of ${b.packSize}`;
  }

  return `Variant mismatch: ${a?.display || '?'} vs ${b?.display || '?'}`;
}
