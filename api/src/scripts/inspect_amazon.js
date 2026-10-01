import fs from 'fs';
import * as cheerio from 'cheerio';

const html = fs.readFileSync('/Users/karanarora/.gemini/antigravity/brain/84e1a719-e450-4364-b854-65136ea7c28a/scratch/amazon_scraped.html', 'utf-8');
const $ = cheerio.load(html);

console.log('--- #corePriceDisplay_desktop_feature_div ---');
console.log($('#corePriceDisplay_desktop_feature_div').text().replace(/\s+/g, ' ').trim());

console.log('\n--- #corePrice_feature_div ---');
console.log($('#corePrice_feature_div').text().replace(/\s+/g, ' ').trim());

console.log('\n--- .priceToPay elements ---');
$('.priceToPay').each((i, el) => {
  console.log(`[${i}] class="${$(el).attr('class')}" text="${$(el).text().replace(/\s+/g, ' ').trim()}" offscreen="${$(el).find('.a-offscreen').text().trim()}"`);
});

console.log('\n--- .basisPrice elements ---');
$('.basisPrice').each((i, el) => {
  console.log(`[${i}] text="${$(el).text().replace(/\s+/g, ' ').trim()}" offscreen="${$(el).find('.a-offscreen').text().trim()}"`);
});

console.log('\n--- All .a-price elements in #centerCol or #ppd ---');
$('#centerCol .a-price, #ppd .a-price').each((i, el) => {
  console.log(`[${i}] class="${$(el).attr('class')}" parent="${$(el).parent().attr('class') || $(el).parent().attr('id')}" offscreen="${$(el).find('.a-offscreen').text().trim()}" text="${$(el).text().replace(/\s+/g, ' ').trim()}"`);
});

console.log('\n--- Let us test the exact parser logic on this HTML ---');
const amazonPriceSelectors = [
  '.apexPriceToPay .a-offscreen',
  '.priceToPay .a-offscreen',
  '#priceblock_dealprice',
  '#priceblock_ourprice',
  '.a-price .a-offscreen',
  '.a-price-whole',
];
const amazonRoots = ['#corePrice_feature_div', '#corePriceDisplay_desktop_feature_div', '#ppd', '#centerCol'];

for (const rootSel of amazonRoots) {
  const root = $(rootSel);
  console.log(`Root "${rootSel}" exists: ${root.length > 0}`);
  if (root.length) {
    for (const sel of amazonPriceSelectors) {
      const match = root.find(sel);
      console.log(`  Selector "${sel}" in "${rootSel}": count=${match.length}, text="${match.first().text().trim()}"`);
    }
  }
}
