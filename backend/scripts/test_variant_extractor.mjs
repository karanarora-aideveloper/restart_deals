import { extractVariant, variantsMatch, variantMismatchReason } from '../src/utils/variantExtractor.js';

console.log('====================================================');
console.log('  TESTING TECH & BEAUTY VARIANT EXTRACTION SYSTEM   ');
console.log('====================================================\n');

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    console.log(`✓ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`✗ [FAIL] ${message}`);
    process.exitCode = 1;
  }
}

// 1. Flipkart Phone Format (Color, Storage)
const ip15_128_blue = extractVariant('Apple iPhone 15 (Blue, 128 GB)');
const ip15_256_blue = extractVariant('Apple iPhone 15 (Blue, 256 GB)');
const ip15_128_black = extractVariant('Apple iPhone 15 (Black, 128 GB)');

assert(ip15_128_blue?.type === 'tech_storage', 'iPhone 15 128GB detected as tech_storage');
assert(ip15_128_blue?.storageGb === 128, 'iPhone 15 storage is 128 GB');
assert(ip15_128_blue?.color === 'Blue', 'iPhone 15 color is Blue');
assert(!variantsMatch(ip15_128_blue, ip15_256_blue), 'iPhone 128GB vs 256GB correctly flags mismatch');
assert(variantsMatch(ip15_128_blue, ip15_128_black), 'iPhone 128GB Blue vs 128GB Black matches storage');
assert(variantMismatchReason(ip15_128_blue, ip15_256_blue)?.includes('Storage mismatch'), 'Reason specifies storage mismatch');

// 2. Flipkart Phone Format with RAM (Color, Storage) (RAM RAM)
const s24_256_8ram = extractVariant('SAMSUNG Galaxy S24 5G (Onyx Black, 256 GB)  (8 GB RAM)');
const s24_512_8ram = extractVariant('SAMSUNG Galaxy S24 5G (Onyx Black, 512 GB)  (8 GB RAM)');
const s24_256_12ram = extractVariant('SAMSUNG Galaxy S24 5G (Onyx Black, 256 GB)  (12 GB RAM)');

assert(s24_256_8ram?.ramGb === 8, 'Galaxy S24 RAM is 8 GB');
assert(s24_256_8ram?.storageGb === 256, 'Galaxy S24 storage is 256 GB');
assert(s24_256_8ram?.color === 'Onyx Black', 'Galaxy S24 color is Onyx Black');
assert(!variantsMatch(s24_256_8ram, s24_512_8ram), 'S24 256GB vs 512GB flags storage mismatch');
assert(!variantsMatch(s24_256_8ram, s24_256_12ram), 'S24 8GB RAM vs 12GB RAM flags RAM mismatch');

// 3. Amazon Phone Format (Color, RAM, Storage)
const op_nord = extractVariant('OnePlus Nord CE4 Lite 5G (Super Silver, 8GB RAM, 128GB Storage)');
assert(op_nord?.ramGb === 8 && op_nord?.storageGb === 128, 'Amazon format extracts 8GB RAM and 128GB storage');
assert(op_nord?.color === 'Super Silver', 'Amazon format extracts Super Silver color');

// 4. Beauty & Cosmetic Shades (Nykaa & Amazon)
const maybelline_128 = extractVariant('Maybelline New York Fit Me Matte + Poreless Liquid Foundation - 128 Warm Nude (30ml)');
const maybelline_220 = extractVariant('Maybelline New York Fit Me Matte + Poreless Liquid Foundation - 220 Natural Beige (30ml)');
const maybelline_128_tube = extractVariant('Maybelline New York Fit Me Matte + Poreless Liquid Foundation - 128 Warm Nude (18ml)');
const mac_nc25 = extractVariant('M.A.C Studio Fix Fluid SPF 15 - NC25 (30ml)');
const sugar_01 = extractVariant('Sugar Cosmetics Smudge Me Not Liquid Lipstick - 01 Brazen Raisin');
const sugar_08 = extractVariant('Sugar Cosmetics Smudge Me Not Liquid Lipstick - 08 Wine And Shine');

assert(maybelline_128?.type === 'shade', 'Maybelline foundation detected as shade');
assert(maybelline_128?.shade === '128 Warm Nude', 'Extracted shade is 128 Warm Nude');
assert(maybelline_128?.totalGrams === 30, 'Extracted volume is 30ml');
assert(!variantsMatch(maybelline_128, maybelline_220), 'Shade 128 vs Shade 220 flags mismatch');
assert(!variantsMatch(maybelline_128, maybelline_128_tube), 'Same shade but 30ml vs 18ml flags size mismatch');
assert(mac_nc25?.shade === 'NC25', 'MAC NC25 tone correctly identified');
assert(!variantsMatch(sugar_01, sugar_08), 'Sugar Lipstick 01 vs 08 flags shade mismatch');

// 5. FMCG & Grocery (Backward Compatibility)
const exo_2l = extractVariant('Exo Touch Dishwash Liquid 2L');
const exo_1l = extractVariant('Exo Touch Dishwash Liquid 1L');
const milton_6pack = extractVariant('Milton Pacific Pack of 6 Water Bottles, 1 Litre each');

assert(exo_2l?.type === 'volume' && exo_2l?.totalGrams === 2000, 'Exo 2L parsed as 2000g volume');
assert(!variantsMatch(exo_2l, exo_1l), 'Exo 2L vs 1L flags volume mismatch');
assert(milton_6pack?.packSize === 6, 'Milton 6-pack parsed correctly');

console.log(`\n====================================================`);
console.log(`  RESULTS: ${passed}/${total} TESTS PASSED! `);
console.log(`====================================================\n`);
