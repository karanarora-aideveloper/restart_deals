/**
 * ShoppersDeals URL & Product Parser
 * Extracts merchant, canonical ID, clean URL, and product metadata.
 */

(function (root, factory) {
  const parserModule = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = parserModule;
  }
  if (root) {
    root.ShoppersParser = parserModule;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  function parseUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;

    try {
      const u = new URL(rawUrl);
      const host = u.hostname.toLowerCase();
      const pathname = u.pathname;

      // 1. Amazon India
      if (host.includes('amazon.')) {
        const asinMatch = pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i);
        if (asinMatch) {
          const asin = asinMatch[1].toUpperCase();
          return {
            merchant: 'amazon',
            productId: asin,
            cleanUrl: `https://www.amazon.in/dp/${asin}`,
            storeName: 'Amazon India',
            storeBadge: '🛍️ Amazon'
          };
        }
      }

      // 2. Flipkart
      if (host.includes('flipkart.')) {
        const pid = u.searchParams.get('pid');
        if (pid) {
          return {
            merchant: 'flipkart',
            productId: pid.trim(),
            cleanUrl: `https://www.flipkart.com/p/item?pid=${pid.trim()}`,
            storeName: 'Flipkart',
            storeBadge: '⚡ Flipkart'
          };
        }
        const itmMatch = pathname.match(/\/p\/(itm[a-zA-Z0-9]+)/i);
        if (itmMatch) {
          return {
            merchant: 'flipkart',
            productId: itmMatch[1],
            cleanUrl: `https://www.flipkart.com${pathname}`,
            storeName: 'Flipkart',
            storeBadge: '⚡ Flipkart'
          };
        }
      }

      // 3. Myntra
      if (host.includes('myntra.')) {
        const myntraMatch = pathname.match(/\/(\d{5,12})\/buy/i) || pathname.match(/\/(\d{5,12})$/);
        if (myntraMatch) {
          const styleId = myntraMatch[1];
          return {
            merchant: 'myntra',
            productId: styleId,
            cleanUrl: `https://www.myntra.com/${styleId}/buy`,
            storeName: 'Myntra',
            storeBadge: '👗 Myntra'
          };
        }
      }

      // 4. Nykaa
      if (host.includes('nykaa.')) {
        const nykaaMatch = pathname.match(/\/p\/(\d+)/i) || u.searchParams.get('productId') || u.searchParams.get('skuId');
        if (nykaaMatch) {
          const pid = typeof nykaaMatch === 'string' ? nykaaMatch : nykaaMatch[1];
          return {
            merchant: 'nykaa',
            productId: pid,
            cleanUrl: `https://www.nykaa.com/p/${pid}`,
            storeName: 'Nykaa',
            storeBadge: '💄 Nykaa'
          };
        }
      }

      // 5. Ajio
      if (host.includes('ajio.')) {
        const ajioMatch = pathname.match(/\/p\/([a-zA-Z0-9_-]+)/i);
        if (ajioMatch) {
          const code = ajioMatch[1];
          return {
            merchant: 'ajio',
            productId: code,
            cleanUrl: `https://www.ajio.com/p/${code}`,
            storeName: 'Ajio',
            storeBadge: '✨ Ajio'
          };
        }
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Robust price parser:
   * Correctly handles Indian Rupee formatting, commas, decimals, and trailing periods.
   * e.g. "₹59,990.00" -> 59990 (not 5999000!)
   * "59,990." -> 59990
   * "₹ 1,29,999" -> 129999
   */
  function parsePriceText(rawText) {
    if (!rawText || typeof rawText !== 'string') return null;
    let clean = rawText.replace(/[₹$€£\s]/g, '').trim();
    clean = clean.replace(/\.+$/, '');
    clean = clean.replace(/,/g, '');
    const match = clean.match(/(\d+(?:\.\d{1,2})?)/);
    if (!match) return null;
    const val = parseFloat(match[1]);
    return isNaN(val) || val <= 0 ? null : Math.round(val);
  }

  function extractLivePageDetails() {
    const parsed = parseUrl(window.location.href);
    if (!parsed) return null;

    let title = '';
    let currentPrice = null;
    let mrp = null;
    let imageUrl = '';

    try {
      if (parsed.merchant === 'amazon') {
        const titleEl = document.querySelector('#productTitle') ||
                        document.querySelector('#title span') ||
                        document.querySelector('h1#title') ||
                        document.querySelector('meta[property="og:title"]');
        title = titleEl ? (titleEl.innerText || titleEl.content || titleEl.textContent || '').trim() : '';

        // Amazon Price
        const priceSelectors = [
          '#corePriceDisplay_desktop_feature_div .priceToPay span.a-price-whole',
          '#corePriceDisplay_desktop_feature_div .priceToPay span.a-offscreen',
          '#corePriceDisplay_desktop_feature_div span.a-price-whole',
          '#corePrice_desktop .priceToPay span.a-price-whole',
          '#corePrice_desktop .priceToPay span.a-offscreen',
          '#corePrice_desktop span.a-price-whole',
          '#corePrice_desktop span.a-offscreen',
          '.apexPriceToPay span.a-price-whole',
          '.apexPriceToPay span.a-offscreen',
          '#apex_desktop .a-price span.a-offscreen',
          '#apex_desktop .a-price span.a-price-whole',
          '.priceToPay span.a-price-whole',
          '.priceToPay span.a-offscreen',
          '#tp_price_block_total_price_ww span.a-offscreen',
          '#priceblock_dealprice',
          '#priceblock_ourprice',
          '#priceblock_saleprice',
          '#price_inside_buybox',
          '.a-section.a-spacing-none.aok-align-center .a-price .a-offscreen',
          '.a-price.aok-align-center .a-offscreen'
        ];

        for (const sel of priceSelectors) {
          const el = document.querySelector(sel);
          if (el) {
            const parsedVal = parsePriceText(el.innerText || el.textContent);
            if (parsedVal && parsedVal > 0) {
              currentPrice = parsedVal;
              break;
            }
          }
        }

        // Amazon MRP (basis price / strike price)
        const mrpSelectors = [
          '#corePriceDisplay_desktop_feature_div .basisPrice span.a-offscreen',
          '#corePrice_desktop .basisPrice span.a-offscreen',
          '#corePriceDisplay_desktop_feature_div span.a-price.a-text-price span.a-offscreen',
          '#corePrice_desktop span.a-price.a-text-price span.a-offscreen',
          'span.a-price.a-text-price span.a-offscreen',
          '.basisPrice span.a-offscreen',
          '#priceblock_strike',
          '#regularprice_savings td.priceBlockStrikePriceString'
        ];

        for (const sel of mrpSelectors) {
          const el = document.querySelector(sel);
          if (el) {
            const parsedVal = parsePriceText(el.innerText || el.textContent);
            if (parsedVal && parsedVal > 0) {
              mrp = parsedVal;
              break;
            }
          }
        }

        // Amazon Image
        const imgEl = document.querySelector('#landingImage') ||
                      document.querySelector('#imgBlkFront') ||
                      document.querySelector('#main-image-container img');
        if (imgEl) {
          imageUrl = imgEl.getAttribute('data-old-hires') || imgEl.getAttribute('src') || '';
        }
        if (!imageUrl) {
          const ogImg = document.querySelector('meta[property="og:image"]');
          if (ogImg) imageUrl = ogImg.getAttribute('content') || '';
        }
      } else if (parsed.merchant === 'flipkart') {
        const titleEl = document.querySelector('h1._6EBuvd') ||
                        document.querySelector('h1.C5Mwzx') ||
                        document.querySelector('span.B_NuCI') ||
                        document.querySelector('h1');
        title = titleEl ? (titleEl.innerText || titleEl.textContent || '').trim() : '';

        const priceSelectors = [
          'div.Nx9bqj.CxhGGd',
          'div.Nx9bqj',
          'div._30jeq3._16Jk6d',
          'div._30jeq3'
        ];
        for (const sel of priceSelectors) {
          const el = document.querySelector(sel);
          if (el) {
            const parsedVal = parsePriceText(el.innerText || el.textContent);
            if (parsedVal && parsedVal > 0) {
              currentPrice = parsedVal;
              break;
            }
          }
        }

        const mrpSelectors = [
          'div.yRaY8j.A68rqU',
          'div.yRaY8j',
          'div._3I9_wc._2p6lqe',
          'div._3I9_wc'
        ];
        for (const sel of mrpSelectors) {
          const el = document.querySelector(sel);
          if (el) {
            const parsedVal = parsePriceText(el.innerText || el.textContent);
            if (parsedVal && parsedVal > 0) {
              mrp = parsedVal;
              break;
            }
          }
        }

        const imgEl = document.querySelector('img.DByuf4') ||
                      document.querySelector('img._396cs4') ||
                      document.querySelector('meta[property="og:image"]');
        if (imgEl) imageUrl = imgEl.getAttribute('src') || imgEl.getAttribute('content') || '';
      } else if (parsed.merchant === 'myntra') {
        const brand = document.querySelector('h1.pdp-title')?.innerText?.trim() || '';
        const name = document.querySelector('h1.pdp-name')?.innerText?.trim() || '';
        title = [brand, name].filter(Boolean).join(' ');

        const priceEl = document.querySelector('span.pdp-price');
        if (priceEl) currentPrice = parsePriceText(priceEl.innerText || priceEl.textContent);

        const mrpEl = document.querySelector('span.pdp-mrp');
        if (mrpEl) mrp = parsePriceText(mrpEl.innerText || mrpEl.textContent);

        const imgEl = document.querySelector('.image-grid-image') || document.querySelector('meta[property="og:image"]');
        if (imgEl) imageUrl = imgEl.getAttribute('src') || imgEl.getAttribute('content') || '';
      } else if (parsed.merchant === 'nykaa') {
        const titleEl = document.querySelector('h1.css-1gc4x7i') || document.querySelector('h1[class*="title"]');
        title = titleEl ? (titleEl.innerText || titleEl.textContent || '').trim() : '';

        const priceEl = document.querySelector('span.css-1jczs19') ||
                        document.querySelector('span[class*="post-discount"]') ||
                        document.querySelector('span[class*="price"]');
        if (priceEl) currentPrice = parsePriceText(priceEl.innerText || priceEl.textContent);

        const mrpEl = document.querySelector('span.css-u05rr') ||
                      document.querySelector('span[class*="mrp"]');
        if (mrpEl) mrp = parsePriceText(mrpEl.innerText || mrpEl.textContent);

        const imgEl = document.querySelector('img[class*="image-zoom"]') || document.querySelector('meta[property="og:image"]');
        if (imgEl) imageUrl = imgEl.getAttribute('src') || imgEl.getAttribute('content') || '';
      } else if (parsed.merchant === 'ajio') {
        const titleEl = document.querySelector('h1.prod-title');
        title = titleEl ? (titleEl.innerText || titleEl.textContent || '').trim() : '';

        const priceEl = document.querySelector('div.prod-sp');
        if (priceEl) currentPrice = parsePriceText(priceEl.innerText || priceEl.textContent);

        const mrpEl = document.querySelector('span.prod-cp');
        if (mrpEl) mrp = parsePriceText(mrpEl.innerText || mrpEl.textContent);

        const imgEl = document.querySelector('img.preview-image') || document.querySelector('meta[property="og:image"]');
        if (imgEl) imageUrl = imgEl.getAttribute('src') || imgEl.getAttribute('content') || '';
      }
    } catch (e) {
      console.warn('[ShoppersDeals] DOM extraction notice:', e);
    }

    if (currentPrice && mrp && mrp < currentPrice) {
      mrp = currentPrice;
    }

    return {
      ...parsed,
      liveTitle: title,
      livePrice: currentPrice,
      liveMRP: mrp,
      liveImage: imageUrl
    };
  }

  return {
    parseUrl,
    parsePriceText,
    extractLivePageDetails
  };
});
