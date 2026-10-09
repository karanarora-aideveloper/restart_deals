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

      // 6. Croma
      if (host.includes('croma.')) {
        const cromaMatch = pathname.match(/\/p\/(\d+)/i) || pathname.match(/\/([a-zA-Z0-9-]+)\/p\/(\d+)/i);
        if (cromaMatch) {
          const code = cromaMatch[2] || cromaMatch[1];
          return {
            merchant: 'croma',
            productId: code,
            cleanUrl: `https://www.croma.com/p/${code}`,
            storeName: 'Croma',
            storeBadge: '⚡ Croma'
          };
        }
      }

      // 7. Shopsy
      if (host.includes('shopsy.')) {
        const pid = u.searchParams.get('pid');
        if (pid) {
          return {
            merchant: 'shopsy',
            productId: pid.trim(),
            cleanUrl: `https://www.shopsy.in/p/item?pid=${pid.trim()}`,
            storeName: 'Shopsy',
            storeBadge: '🛍️ Shopsy'
          };
        }
        const itmMatch = pathname.match(/\/p\/(itm[a-zA-Z0-9]+)/i);
        if (itmMatch) {
          return {
            merchant: 'shopsy',
            productId: itmMatch[1],
            cleanUrl: `https://www.shopsy.in${pathname}`,
            storeName: 'Shopsy',
            storeBadge: '🛍️ Shopsy'
          };
        }
      }

      // 8. Meesho
      if (host.includes('meesho.')) {
        const meeshoMatch = pathname.match(/\/p\/([a-zA-Z0-9]+)/i);
        if (meeshoMatch) {
          const code = meeshoMatch[1];
          return {
            merchant: 'meesho',
            productId: code,
            cleanUrl: `https://www.meesho.com/p/${code}`,
            storeName: 'Meesho',
            storeBadge: '📦 Meesho'
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
   * Correctly handles Indian Rupee formatting, commas, decimals, percentages, and trailing periods.
   * e.g. "₹59,990.00" -> 59990
   * "-14% ₹67,990" -> 67990 (prioritizes currency amount, does not match "14"!)
   * "59,990." -> 59990
   * "₹ 1,29,999" -> 129999
   * Rejects discount percentages like "-14%", "32% off", "(25% savings)".
   */
  function parsePriceText(rawText) {
    if (!rawText || typeof rawText !== 'string') return null;
    const str = rawText.trim();
    if (!str) return null;

    // 1. Reject strings that are strictly percentage discounts or savings without price
    if (/^[-+]?\s*\d+%\s*$/i.test(str) || /^\(?\d+%\s*(?:off|savings|discount)?\)?$/i.test(str)) {
      return null;
    }

    // 2. Prioritize Rupee / currency-prefixed amount: "₹67,990.00", "Rs. 18,999", "₹ 1,29,999", "-14% ₹67,990"
    const currencyMatch = str.match(/(?:₹|Rs\.?|INR|\$|€|£)\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (currencyMatch) {
      const numStr = currencyMatch[1].replace(/,/g, '');
      const val = parseFloat(numStr);
      if (!isNaN(val) && val > 0 && val <= 10000000) {
        return Math.round(val);
      }
    }

    // 3. Fallback for bare numbers (like .a-price-whole "67,990." or "18,999")
    let clean = str.replace(/\.+$/, '').replace(/,/g, '');
    if (clean.includes('%')) {
      const parts = clean.split('%');
      clean = parts[parts.length - 1]; // take what follows percentage if any
    }
    const match = clean.match(/(\d+(?:\.\d{1,2})?)/);
    if (!match) return null;
    const val = parseFloat(match[1]);
    if (isNaN(val) || val <= 0 || val > 10000000) return null;
    return Math.round(val);
  }

  function isExcludedAmazonNode(el) {
    if (!el) return true;
    try {
      // Exclude strikethrough / MRP nodes
      if (
        el.classList?.contains('a-text-price') ||
        el.classList?.contains('apex-basisprice-value') ||
        el.classList?.contains('basisPrice') ||
        el.classList?.contains('a-text-strike') ||
        el.getAttribute?.('data-a-strike') === 'true' ||
        (el.closest && el.closest('.basisPrice, .apex-basisprice-value, span.a-text-price, [data-a-strike="true"], .a-text-strike, #priceblock_strike, #regularprice_savings'))
      ) {
        return true;
      }
      // Exclude trade-in / exchange / addons / warranties / EMI / finance / carousels
      if (el.closest && el.closest('#tradeInFeature_desktop_feature_div, #tradeIn_buybox_feature_div, #attach-warranty-pane, #attach-accessory-pane, #ineligibleForExchangeText, [id*="tradein" i], [id*="warranty" i], [class*="warranty" i], [class*="exchange" i], [id*="exchange" i], #bundle-v2-btf-content, .sims-carousel-holder, #similarities_feature_div, #sponsoredProducts2_feature_div')) {
        return true;
      }
      // Exclude text that refers to EMI installments or exchange
      const txt = (el.innerText || el.textContent || '').toLowerCase();
      if (txt.includes('/month') || txt.includes('/mo') || txt.includes('per month') || txt.includes('no cost emi') || txt.includes('with exchange')) {
        return true;
      }
    } catch (e) {}
    return false;
  }

  function extractJsonLd() {
    try {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const s of scripts) {
        try {
          const raw = s.textContent || s.innerText;
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          const roots = Array.isArray(parsed) ? parsed : [parsed];
          for (const root of roots) {
            const nodes = root['@graph'] ? root['@graph'] : [root];
            for (const node of nodes) {
              if (node && (node['@type'] === 'Product' || node.offers)) {
                let title = node.name || '';
                let image = Array.isArray(node.image) ? node.image[0] : (node.image?.url || node.image || '');
                let price = null;
                let mrp = null;
                if (node.offers) {
                  const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
                  if (offer) {
                    price = parsePriceText(String(offer.price ?? offer.lowPrice ?? ''));
                    mrp = parsePriceText(String(offer.highPrice ?? ''));
                  }
                }
                if (price && price >= 10) {
                  return { title, image, price, mrp };
                }
              }
            }
          }
        } catch (e) {}
      }
    } catch (e) {}
    return null;
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
        title = titleEl ? (titleEl.innerText || titleEl.content || titleEl.textContent || '').replace(/\s+/g, ' ').trim() : '';

        // Amazon Selling Price: Strictly scoped to primary price containers
        const amazonPriceRoots = [
          '#corePriceDisplay_desktop_feature_div',
          '#corePrice_desktop',
          '#corePrice_feature_div',
          '#apex_desktop .apexPriceToPay',
          '#apex_desktop .priceToPay',
          '#corePrice_mobile_feature_div',
          '#centerCol .priceToPay',
          '#ppd .priceToPay',
          '.priceToPay',
          '.apexPriceToPay',
          '#priceblock_dealprice',
          '#priceblock_ourprice',
          '#priceblock_saleprice',
          '#price_inside_buybox',
          '#tp_price_block_total_price_ww'
        ];

        for (const rootSel of amazonPriceRoots) {
          const root = document.querySelector(rootSel);
          if (!root || isExcludedAmazonNode(root)) continue;

          // 1. Try .a-price-whole inside root (e.g. "67,990." or "18,999")
          const wholeNodes = root.querySelectorAll('.a-price-whole');
          for (const wEl of wholeNodes) {
            if (isExcludedAmazonNode(wEl)) continue;
            const parsedVal = parsePriceText(wEl.innerText || wEl.textContent);
            if (parsedVal && parsedVal >= 10) {
              currentPrice = parsedVal;
              break;
            }
          }
          if (currentPrice) break;

          // 2. Try .a-offscreen inside root (e.g. "₹67,990.00")
          const offNodes = root.querySelectorAll('.a-offscreen');
          for (const oEl of offNodes) {
            if (isExcludedAmazonNode(oEl)) continue;
            const parsedVal = parsePriceText(oEl.innerText || oEl.textContent);
            if (parsedVal && parsedVal >= 10) {
              currentPrice = parsedVal;
              break;
            }
          }
          if (currentPrice) break;

          // 3. Try container text itself
          const directVal = parsePriceText(root.innerText || root.textContent);
          if (directVal && directVal >= 10) {
            currentPrice = directVal;
            break;
          }
        }

        // Amazon MRP (basis price / strike price)
        const mrpSelectors = [
          '#corePriceDisplay_desktop_feature_div .basisPrice span.a-offscreen',
          '#corePrice_desktop .basisPrice span.a-offscreen',
          '#corePriceDisplay_desktop_feature_div span.a-price.a-text-price span.a-offscreen',
          '#corePrice_desktop span.a-price.a-text-price span.a-offscreen',
          '.basisPrice span.a-offscreen',
          '.apex-basisprice-value span.a-offscreen',
          '.basisPrice .a-price-whole',
          '.apex-basisprice-value .a-price-whole',
          '#priceblock_strike',
          '#priceblock_listprice',
          '#regularprice_savings td.priceBlockStrikePriceString'
        ];

        for (const sel of mrpSelectors) {
          const el = document.querySelector(sel);
          if (el) {
            const parsedVal = parsePriceText(el.innerText || el.textContent);
            if (parsedVal && parsedVal >= 10) {
              mrp = parsedVal;
              break;
            }
          }
        }

        // Regex fallback for MRP if not found via selectors
        if (!mrp) {
          const textScan = (
            document.querySelector('#corePriceDisplay_desktop_feature_div')?.innerText ||
            document.querySelector('#corePrice_desktop')?.innerText ||
            document.querySelector('#centerCol')?.innerText ||
            ''
          );
          const mrpMatch = textScan.match(/M\.?R\.?P\.?:?\s*(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d{1,2})?)/i);
          if (mrpMatch) {
            const parsedVal = parsePriceText(mrpMatch[1]);
            if (parsedVal && parsedVal >= 10) {
              mrp = parsedVal;
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
        title = titleEl ? (titleEl.innerText || titleEl.textContent || '').replace(/\s+/g, ' ').trim() : '';

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
            if (parsedVal && parsedVal >= 10) {
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
            if (parsedVal && parsedVal >= 10) {
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
        title = [brand, name].filter(Boolean).join(' ').replace(/\s+/g, ' ');

        const priceEl = document.querySelector('span.pdp-price');
        if (priceEl) currentPrice = parsePriceText(priceEl.innerText || priceEl.textContent);

        const mrpEl = document.querySelector('span.pdp-mrp');
        if (mrpEl) mrp = parsePriceText(mrpEl.innerText || mrpEl.textContent);

        const imgEl = document.querySelector('.image-grid-image') || document.querySelector('meta[property="og:image"]');
        if (imgEl) imageUrl = imgEl.getAttribute('src') || imgEl.getAttribute('content') || '';
      } else if (parsed.merchant === 'nykaa') {
        const titleEl = document.querySelector('h1.css-1gc4x7i') || document.querySelector('h1[class*="title"]');
        title = titleEl ? (titleEl.innerText || titleEl.textContent || '').replace(/\s+/g, ' ').trim() : '';

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
        title = titleEl ? (titleEl.innerText || titleEl.textContent || '').replace(/\s+/g, ' ').trim() : '';

        const priceEl = document.querySelector('div.prod-sp');
        if (priceEl) currentPrice = parsePriceText(priceEl.innerText || priceEl.textContent);

        const mrpEl = document.querySelector('span.prod-cp');
        if (mrpEl) mrp = parsePriceText(mrpEl.innerText || mrpEl.textContent);

        const imgEl = document.querySelector('img.preview-image') || document.querySelector('meta[property="og:image"]');
        if (imgEl) imageUrl = imgEl.getAttribute('src') || imgEl.getAttribute('content') || '';
      } else if (parsed.merchant === 'croma') {
        const titleEl = document.querySelector('h1.pd-title') || document.querySelector('h1');
        title = titleEl ? (titleEl.innerText || titleEl.textContent || '').replace(/\s+/g, ' ').trim() : '';

        const priceEl = document.querySelector('span.amount[data-testid="new-price"]') ||
                        document.querySelector('span.amount') ||
                        document.querySelector('span[class*="new-price"]');
        if (priceEl) currentPrice = parsePriceText(priceEl.innerText || priceEl.textContent);

        const mrpEl = document.querySelector('span.amount[data-testid="old-price"]') ||
                      document.querySelector('span[class*="old-price"]') ||
                      document.querySelector('span[class*="mrp"]');
        if (mrpEl) mrp = parsePriceText(mrpEl.innerText || mrpEl.textContent);

        const imgEl = document.querySelector('img.product-img') ||
                      document.querySelector('img[class*="product-image"]') ||
                      document.querySelector('meta[property="og:image"]');
        if (imgEl) imageUrl = imgEl.getAttribute('src') || imgEl.getAttribute('content') || '';
      } else if (parsed.merchant === 'shopsy') {
        const titleEl = document.querySelector('h1') || document.querySelector('span.B_NuCI');
        title = titleEl ? (titleEl.innerText || titleEl.textContent || '').replace(/\s+/g, ' ').trim() : '';

        const priceEl = document.querySelector('div.Nx9bqj') || document.querySelector('div._30jeq3');
        if (priceEl) currentPrice = parsePriceText(priceEl.innerText || priceEl.textContent);

        const mrpEl = document.querySelector('div.yRaY8j') || document.querySelector('div._3I9_wc');
        if (mrpEl) mrp = parsePriceText(mrpEl.innerText || mrpEl.textContent);

        const imgEl = document.querySelector('img.DByuf4') || document.querySelector('meta[property="og:image"]');
        if (imgEl) imageUrl = imgEl.getAttribute('src') || imgEl.getAttribute('content') || '';
      } else if (parsed.merchant === 'meesho') {
        const titleEl = document.querySelector('h1') || document.querySelector('span.sc-eDvSVe') || document.querySelector('h4');
        title = titleEl ? (titleEl.innerText || titleEl.textContent || '').replace(/\s+/g, ' ').trim() : '';

        const priceEl = document.querySelector('h4[class*="Price"]') ||
                        document.querySelector('span[class*="Price"]') ||
                        document.querySelector('h4');
        if (priceEl) currentPrice = parsePriceText(priceEl.innerText || priceEl.textContent);

        const mrpEl = document.querySelector('p[class*="mrp"]') ||
                      document.querySelector('span[class*="mrp"]');
        if (mrpEl) mrp = parsePriceText(mrpEl.innerText || mrpEl.textContent);

        const imgEl = document.querySelector('img[class*="ProductImage"]') || document.querySelector('meta[property="og:image"]');
        if (imgEl) imageUrl = imgEl.getAttribute('src') || imgEl.getAttribute('content') || '';
      }

      // Universal Schema.org JSON-LD Fallback
      if (!currentPrice || !title) {
        const jsonLd = extractJsonLd();
        if (jsonLd) {
          if (!currentPrice && jsonLd.price) currentPrice = jsonLd.price;
          if (!mrp && jsonLd.mrp) mrp = jsonLd.mrp;
          if (!title && jsonLd.title) title = jsonLd.title.replace(/\s+/g, ' ').trim();
          if (!imageUrl && jsonLd.image) imageUrl = jsonLd.image;
        }
      }
    } catch (e) {
      console.warn('[ShoppersDeals] DOM extraction notice:', e);
    }

    // Sanity checks: reject out-of-range prices
    if (currentPrice && (currentPrice < 10 || currentPrice > 10000000)) {
      currentPrice = null;
    }
    if (mrp && (mrp < 10 || mrp > 10000000)) {
      mrp = null;
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

  function detectStore(url = '') {
    const raw = (url || (typeof window !== 'undefined' ? window.location.href : '')).toLowerCase();
    if (raw.includes('amazon.')) return 'amazon';
    if (raw.includes('flipkart.')) return 'flipkart';
    if (raw.includes('myntra.')) return 'myntra';
    if (raw.includes('nykaa.')) return 'nykaa';
    if (raw.includes('ajio.')) return 'ajio';
    if (raw.includes('croma.')) return 'croma';
    if (raw.includes('shopsy.')) return 'shopsy';
    if (raw.includes('meesho.')) return 'meesho';
    return 'store';
  }

  function isWishlistPage(url = '') {
    const raw = (url || (typeof window !== 'undefined' ? window.location.href : '')).toLowerCase();
    if (raw.includes('amazon.') && (raw.includes('/hz/wishlist') || raw.includes('/registry/wishlist') || raw.includes('/gp/registry/wishlist'))) return true;
    if (raw.includes('flipkart.') && raw.includes('/wishlist')) return true;
    if (raw.includes('myntra.') && raw.includes('/wishlist')) return true;
    if (raw.includes('nykaa.') && raw.includes('/wishlist')) return true;
    if (raw.includes('ajio.') && raw.includes('/wishlist')) return true;
    return false;
  }

  function isCheckoutPage(url = '') {
    const raw = (url || (typeof window !== 'undefined' ? window.location.href : '')).toLowerCase();
    return raw.includes('/cart') ||
           raw.includes('/checkout') ||
           raw.includes('/gp/buy') ||
           raw.includes('/order') ||
           raw.includes('/viewcart') ||
           raw.includes('/bag') ||
           raw.includes('/payment');
  }

  function extractWishlistItems() {
    if (typeof document === 'undefined') return [];
    const items = [];
    const merchant = detectStore(window.location.href);

    try {
      if (merchant === 'amazon') {
        // Amazon Wishlist DOM selectors
        const rows = document.querySelectorAll('li[data-itemid], li.g-item-sortable, div[id^="item_"]');
        rows.forEach(row => {
          try {
            // Find ASIN
            let asin = '';
            const linkEl = row.querySelector('a[href*="/dp/"]');
            if (linkEl) {
              const m = linkEl.href.match(/\/dp\/([A-Z0-9]{10})/i);
              if (m) asin = m[1].toUpperCase();
            }
            if (!asin && row.dataset && row.dataset.itemprimeinfo) {
              try {
                const info = JSON.parse(row.dataset.itemprimeinfo);
                if (info.asin) asin = info.asin.toUpperCase();
              } catch (e) {}
            }
            if (!asin) {
              const delBtn = row.querySelector('[name*="deleteItem"]');
              if (delBtn && delBtn.value) asin = delBtn.value.toUpperCase();
            }
            if (!asin) return;

            // Title
            const titleEl = row.querySelector('a[id*="itemName_"]') ||
                            row.querySelector('h2 a') ||
                            linkEl ||
                            row.querySelector('h3');
            const title = titleEl ? titleEl.textContent.trim().replace(/\s+/g, ' ') : '';
            if (!title) return;

            // Price
            let price = null;
            const priceEl = row.querySelector('.a-price .a-offscreen') ||
                            row.querySelector('span[id*="itemPrice_"]') ||
                            row.querySelector('.a-color-price');
            if (priceEl) price = parsePriceText(priceEl.textContent);

            // MRP
            let mrp = null;
            const mrpEl = row.querySelector('.a-text-price .a-offscreen');
            if (mrpEl) mrp = parsePriceText(mrpEl.textContent);

            // Image
            let imageUrl = '';
            const imgEl = row.querySelector('img[id*="itemImage_"]') || row.querySelector('img');
            if (imgEl) imageUrl = imgEl.src || imgEl.getAttribute('data-src') || '';

            items.push({
              merchant: 'amazon',
              productId: asin,
              title,
              price: price || 0,
              mrp: mrp || price || 0,
              originalPrice: mrp || price || 0,
              imageUrl,
              url: `https://www.amazon.in/dp/${asin}`,
              cleanUrl: `https://www.amazon.in/dp/${asin}`,
              sourceUrl: linkEl ? linkEl.href : `https://www.amazon.in/dp/${asin}`
            });
          } catch (rowErr) {}
        });
      } else if (merchant === 'flipkart') {
        // Flipkart Wishlist DOM selectors
        const rows = document.querySelectorAll('div[class*="_1AtVbE"], div[class*="wishlist"], div[class*="_2kHMtA"]');
        rows.forEach(row => {
          try {
            const linkEl = row.querySelector('a[href*="pid="]');
            if (!linkEl) return;
            const m = linkEl.href.match(/pid=([a-zA-Z0-9]+)/i);
            if (!m) return;
            const pid = m[1];

            const titleEl = row.querySelector('div._4rR01T') ||
                            row.querySelector('a.s1Q9rs') ||
                            row.querySelector('div[class*="title"]') ||
                            linkEl;
            const title = titleEl ? titleEl.textContent.trim().replace(/\s+/g, ' ') : '';
            if (!title) return;

            let price = null;
            const priceEl = row.querySelector('div._30jeq3') || row.querySelector('div[class*="price"]');
            if (priceEl) price = parsePriceText(priceEl.textContent);

            let mrp = null;
            const mrpEl = row.querySelector('div._3I9_wc') || row.querySelector('div[class*="strike"]');
            if (mrpEl) mrp = parsePriceText(mrpEl.textContent);

            let imageUrl = '';
            const imgEl = row.querySelector('img');
            if (imgEl) imageUrl = imgEl.src || '';

            items.push({
              merchant: 'flipkart',
              productId: pid,
              title,
              price: price || 0,
              mrp: mrp || price || 0,
              originalPrice: mrp || price || 0,
              imageUrl,
              url: `https://www.flipkart.com/p/item?pid=${pid}`,
              cleanUrl: `https://www.flipkart.com/p/item?pid=${pid}`,
              sourceUrl: linkEl.href
            });
          } catch (rowErr) {}
        });
      } else if (merchant === 'myntra') {
        // Myntra Wishlist DOM selectors
        const rows = document.querySelectorAll('.itemcard-itemCard, div[class*="itemCard"]');
        rows.forEach(row => {
          try {
            const linkEl = row.querySelector('a[href*="/"]');
            const href = linkEl ? linkEl.href : '';
            const idMatch = href.match(/\/(\d{5,12})\/buy/) || href.match(/\/(\d{5,12})/);
            const styleId = idMatch ? idMatch[1] : '';
            if (!styleId) return;

            const titleEl = row.querySelector('.itemdetails-itemDetailsLabel') || row.querySelector('.itemdetails-boldFont');
            const title = titleEl ? titleEl.textContent.trim() : 'Myntra Product';

            let price = null;
            const priceEl = row.querySelector('.itemdetails-boldFont');
            if (priceEl) price = parsePriceText(priceEl.textContent);

            let mrp = null;
            const mrpEl = row.querySelector('.itemdetails-strike');
            if (mrpEl) mrp = parsePriceText(mrpEl.textContent);

            let imageUrl = '';
            const imgEl = row.querySelector('img');
            if (imgEl) imageUrl = imgEl.src || '';

            items.push({
              merchant: 'myntra',
              productId: styleId,
              title,
              price: price || 0,
              mrp: mrp || price || 0,
              originalPrice: mrp || price || 0,
              imageUrl,
              url: `https://www.myntra.com/${styleId}/buy`,
              cleanUrl: `https://www.myntra.com/${styleId}/buy`,
              sourceUrl: href
            });
          } catch (rowErr) {}
        });
      }
    } catch (err) {
      console.warn('[ShoppersDeals Parser] Wishlist extraction note:', err);
    }

    // Deduplicate by productId
    const seen = new Set();
    return items.filter(it => {
      if (seen.has(it.productId)) return false;
      seen.add(it.productId);
      return true;
    });
  }

  function extractCouponInput() {
    if (typeof document === 'undefined') return { input: null, button: null };
    const input = document.querySelector([
      'input[name*="coupon" i]',
      'input[id*="coupon" i]',
      'input[name*="promo" i]',
      'input[id*="promo" i]',
      'input[placeholder*="coupon" i]',
      'input[placeholder*="promo" i]',
      'input[placeholder*="voucher" i]',
      'input[placeholder*="gift card" i]',
      'input[placeholder*="discount code" i]',
      'input[aria-label*="coupon" i]',
      'input[aria-label*="promo" i]',
      'input[name*="voucher" i]'
    ].join(', '));

    let button = null;
    if (input) {
      const container = input.closest('form') || input.parentElement || document;
      button = container.querySelector([
        'button[type="submit"]',
        'button[class*="coupon" i]',
        'button[class*="apply" i]',
        'button[id*="apply" i]',
        'input[type="submit"][value*="Apply" i]',
        'input[type="button"][value*="Apply" i]',
        'button'
      ].join(', '));
    }

    return { input, button };
  }

  return {
    parseUrl,
    parsePriceText,
    extractLivePageDetails,
    detectStore,
    isWishlistPage,
    isCheckoutPage,
    extractWishlistItems,
    extractCouponInput
  };
});

