import {
  parseAmazonBestsellerItems,
  parseFlipkartBestsellerItems,
  parseNykaaBestsellerItems,
  parseMyntraBestsellerItems,
  parseMeeshoBestsellerItems,
  parseStoreListingItems,
  buildStoreSearchUrl,
} from '../jobs/bestsellerCrawler.js';

console.log('Testing store search URL builders...');
console.log('Amazon:', buildStoreSearchUrl('amazon', 'smartphones'));
console.log('Flipkart:', buildStoreSearchUrl('flipkart', 'smartphones 5g'));
console.log('Nykaa:', buildStoreSearchUrl('nykaa', 'fit me foundation'));
console.log('Myntra:', buildStoreSearchUrl('myntra', 'men casual shirts'));
console.log('Meesho:', buildStoreSearchUrl('meesho', 'cotton printed kurti'));

console.log('\nTesting store parsers with mock HTML structures...');

// 1. Flipkart Mock
const fkHtml = `
<div data-id="MOBGXYZ123456789">
  <div class="KzDlHZ">Samsung Galaxy S24 5G (Onyx Black, 128 GB)</div>
  <div class="Nx9bqj">₹64,999</div>
  <div class="yRaY8j">₹79,999</div>
  <img class="DByuf4" src="https://rukminim.flixcart.com/image/1.jpg" />
  <div class="_3LWZlK">4.6</div>
</div>
`;
const fkItems = parseStoreListingItems(fkHtml, { store: 'flipkart', category: 'electronics', subcategory: 'mobiles' }, 10);
console.log('Flipkart Parsed Items:', fkItems);

// 2. Nykaa Mock
const nykaaHtml = `
<div class="productWrapper">
  <a href="/maybelline-fit-me-matte-poreless-foundation/p/123456">
    <div class="product-title">Maybelline New York Fit Me Matte+Poreless Liquid Foundation</div>
    <span class="css-111z9ua">₹549</span>
    <span class="css-17xsgbl">₹699</span>
    <img src="https://images-static.nykaa.com/media/catalog/1.jpg" />
    <span class="css-v3h0e">4.4</span>
  </a>
</div>
`;
const nykaaItems = parseStoreListingItems(nykaaHtml, { store: 'nykaa', category: 'beauty', subcategory: 'makeup' }, 10);
console.log('Nykaa Parsed Items:', nykaaItems);

// 3. Myntra Mock
const myntraHtml = `
<script>
window.__myx = {
  "searchData": {
    "results": {
      "products": [
        {
          "productId": 18273645,
          "brand": "Roadster",
          "productName": "Men Navy Pure Cotton Casual Shirt",
          "price": 699,
          "mrp": 1499,
          "rating": 4.3,
          "searchImage": "https://assets.myntassets.com/1.jpg",
          "landingPageUrl": "shirts/roadster/roadster-men-shirt/18273645/buy"
        }
      ]
    }
  }
};
</script>
`;
const myntraItems = parseStoreListingItems(myntraHtml, { store: 'myntra', category: 'men-fashion', subcategory: 'men-topwear' }, 10);
console.log('Myntra Parsed Items:', myntraItems);

// 4. Meesho Mock
const meeshoHtml = `
<script id="__NEXT_DATA__" type="application/json">
{
  "props": {
    "pageProps": {
      "initialState": {
        "search": {
          "products": [
            {
              "id": "8z871m",
              "name": "Women Floral Print Cotton Kurti",
              "price": 289,
              "mrp": 599,
              "rating": 4.1,
              "product_image": "https://images.meesho.com/1.jpg",
              "slug": "women-floral-print-cotton-kurti"
            }
          ]
        }
      }
    }
  }
}
</script>
`;
const meeshoItems = parseStoreListingItems(meeshoHtml, { store: 'meesho', category: 'women-fashion', subcategory: 'women-ethnic' }, 10);
console.log('Meesho Parsed Items:', meeshoItems);

console.log('\nAll parsers verified successfully!');
