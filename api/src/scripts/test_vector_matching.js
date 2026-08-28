import { calculateProductSimilarity } from '../utils/vectorMatcher.js';

function runVectorTests() {
  console.log('==================================================');
  console.log('       TESTING SEMANTIC VECTOR MATCHING           ');
  console.log('==================================================\n');

  const testCases = [
    {
      name: 'Sony XM5 Headphones (Amazon vs Flipkart phrasing)',
      prodA: { title: 'Sony WH-1000XM5 Wireless Noise-Cancelling Headphones with Auto NC Optimizer, 30hr Battery - Black', category: 'electronics' },
      prodB: { title: 'SONY WH1000XM5/B Bluetooth Headset (Black, Over the Ear)', category: 'electronics' },
      expected: 'EXACT_MATCH'
    },
    {
      name: 'Apple iPhone 15 128GB (Amazon vs Myntra/Flipkart phrasing)',
      prodA: { title: 'Apple iPhone 15 (128 GB) - Black', category: 'electronics' },
      prodB: { title: 'Apple iPhone 15 (Black, 128GB Storage)', category: 'electronics' },
      expected: 'EXACT_MATCH'
    },
    {
      name: 'Puma Smash Sneakers (Amazon vs Myntra)',
      prodA: { title: 'Puma Unisex-Adult Smash V2 L Leather Sneaker', category: 'fashion' },
      prodB: { title: 'Puma White Smash V2 Leather Casual Shoes for Men', category: 'fashion' },
      expected: 'EXACT_MATCH'
    },
    {
      name: 'Different Models of Same Brand (Sony XM5 vs Sony XM4)',
      prodA: { title: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones', category: 'electronics' },
      prodB: { title: 'Sony WH-1000XM4 Wireless Active Noise Cancelling Headphones', category: 'electronics' },
      expected: 'SIMILAR_OR_DIFFERENT'
    },
    {
      name: 'Completely Different Products (Sneakers vs Air Fryer)',
      prodA: { title: 'Nike Revolution 7 Running Shoes', category: 'fashion' },
      prodB: { title: 'Philips Digital Air Fryer HD9252', category: 'kitchen' },
      expected: 'NO_MATCH'
    }
  ];

  for (const tc of testCases) {
    const result = calculateProductSimilarity(tc.prodA, tc.prodB);
    console.log(`Test: ${tc.name}`);
    console.log(`  • Product A: "${tc.prodA.title}"`);
    console.log(`  • Product B: "${tc.prodB.title}"`);
    console.log(`  • Score: ${result.score} (Cosine: ${result.cosine})`);
    console.log(`  • Classification: ${result.isExactMatch ? '🟢 EXACT MATCH' : result.isSimilar ? '🟡 SIMILAR' : '🔴 NO MATCH'}`);
    console.log(`  • Match Details: BrandsMatch=${result.brandsMatch}, SharedModel=${result.hasSharedModel}\n`);
  }
}

runVectorTests();
