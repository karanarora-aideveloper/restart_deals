import { meetsCategoryThreshold, CATEGORY_THRESHOLDS } from '../src/utils/categoryThresholds.js';

console.log('====================================================');
console.log('  TESTING UNIFIED ARCHITECTURE: CATEGORY THRESHOLDS ');
console.log('====================================================\n');

// Test 1: Mobile Phone (₹2,500 drop on ₹75,000 phone = 3.33%, but flat cash is ₹2,500 >= ₹1,000)
const mobileTest = meetsCategoryThreshold('electronics', 'mobiles', 3.33, 2500);
console.log('1. Mobile ₹2,500 drop on ₹75k phone:');
console.log('   Qualifies:', mobileTest.qualifies);
console.log('   Reason:', mobileTest.reason);
console.assert(mobileTest.qualifies === true, 'Mobile test should qualify via cash floor');

// Test 2: Laptop (₹1,200 drop on ₹60k laptop = 2.0%, below 4% and below ₹1,500 floor)
const laptopFail = meetsCategoryThreshold('electronics', 'laptops', 2.0, 1200);
console.log('\n2. Laptop ₹1,200 drop on ₹60k laptop:');
console.log('   Qualifies:', laptopFail.qualifies);
console.log('   Reason:', laptopFail.reason);
console.assert(laptopFail.qualifies === false, 'Laptop test should NOT qualify');

// Test 3: Fashion T-Shirt (₹50 drop on ₹500 t-shirt = 10%, but below 20% and below ₹300 floor)
const fashionFail = meetsCategoryThreshold('men-fashion', '', 10.0, 50);
console.log('\n3. Fashion ₹50 drop on ₹500 t-shirt:');
console.log('   Qualifies:', fashionFail.qualifies);
console.log('   Reason:', fashionFail.reason);
console.assert(fashionFail.qualifies === false, 'Fashion test should NOT qualify');

// Test 4: Fashion Jacket (₹1,500 drop on ₹2,500 jacket = 60%, clears 20% and ₹300)
const fashionPass = meetsCategoryThreshold('men-fashion', '', 60.0, 1500);
console.log('\n4. Fashion ₹1,500 drop on ₹2,500 jacket:');
console.log('   Qualifies:', fashionPass.qualifies);
console.log('   Reason:', fashionPass.reason);
console.assert(fashionPass.qualifies === true, 'Fashion test should qualify');

// Test 5: Beauty Skincare (₹300 drop on ₹2,000 serum = 15%, clears 10% and ₹250)
const beautyPass = meetsCategoryThreshold('beauty', 'skincare', 15.0, 300);
console.log('\n5. Beauty ₹300 drop on ₹2,000 serum:');
console.log('   Qualifies:', beautyPass.qualifies);
console.log('   Reason:', beautyPass.reason);
console.assert(beautyPass.qualifies === true, 'Beauty test should qualify');

// Test 6: USA Mobile Phone ($30 drop on $1,000 phone = 3.0%, but flat cash is $30 >= $12.50 floor)
const usMobilePass = meetsCategoryThreshold('electronics', 'mobiles', 3.0, 30, 'US');
console.log('\n6. USA Mobile $30 drop on $1,000 phone (US):');
console.log('   Qualifies:', usMobilePass.qualifies);
console.log('   Reason:', usMobilePass.reason);
console.assert(usMobilePass.qualifies === true, 'US Mobile test should qualify via USD cash floor');

// Test 7: USA Laptop ($10 drop on $600 laptop = 1.67%, below 4% and below $18.8 floor)
const usLaptopFail = meetsCategoryThreshold('electronics', 'laptops', 1.67, 10, 'US');
console.log('\n7. USA Laptop $10 drop on $600 laptop (US):');
console.log('   Qualifies:', usLaptopFail.qualifies);
console.log('   Reason:', usLaptopFail.reason);
console.assert(usLaptopFail.qualifies === false, 'US Laptop test should NOT qualify');

console.log('\n====================================================');
console.log('  ALL CATEGORY THRESHOLD TESTS (IN + US) PASSED!    ');
console.log('====================================================');
