/**
 * Universal Bank Offers & Promotional Coupon Extractor
 * Extracts structured bank promotions, instant card discounts, and on-page coupons across:
 * - Amazon India (HDFC, SBI, ICICI, Axis, HSBC, OneCard)
 * - Flipkart & Shopsy (SBI, Flipkart Axis, HDFC, Kotak)
 * - Croma (Tata Croma card offers, ICICI, HDFC)
 * - Myntra & Nykaa (Bank partnerships, coupon codes)
 */

export const KNOWN_BANKS = [
  { name: 'HDFC Bank', regex: /\b(hdfc)\b/i },
  { name: 'SBI Card', regex: /\b(sbi|state bank)\b/i },
  { name: 'ICICI Bank', regex: /\b(icici)\b/i },
  { name: 'Axis Bank', regex: /\b(axis)\b/i },
  { name: 'Kotak Bank', regex: /\b(kotak)\b/i },
  { name: 'Federal Bank', regex: /\b(federal)\b/i },
  { name: 'IDFC FIRST Bank', regex: /\b(idfc)\b/i },
  { name: 'BOB Card', regex: /\b(bob|bank of baroda)\b/i },
  { name: 'HSBC Bank', regex: /\b(hsbc)\b/i },
  { name: 'OneCard', regex: /\b(onecard)\b/i },
  { name: 'RBL Bank', regex: /\b(rbl)\b/i },
  { name: 'Yes Bank', regex: /\b(yes bank)\b/i },
  { name: 'IndusInd Bank', regex: /\b(indusind)\b/i },
  { name: 'Amazon Pay ICICI', regex: /\b(amazon pay)\b/i },
  { name: 'Flipkart Axis', regex: /\b(flipkart axis)\b/i },
];

/**
 * Identifies the bank name from promotion text.
 */
export function detectBank(text) {
  if (!text) return 'Bank Offer';
  for (const b of KNOWN_BANKS) {
    if (b.regex.test(text)) return b.name;
  }
  return 'Bank Offer';
}

/**
 * Extracts a numeric discount amount from promotional text.
 * Handles patterns like:
 * - "up to ₹1,500" / "upto INR 1000" / "Flat ₹1250 Instant Discount" / "Save ₹250"
 */
export function extractDiscountAmount(text) {
  if (!text) return null;
  // Match "up to ₹1,500" or "upto INR 1000" or "Flat INR 1250"
  const m = text.match(/(?:up\s*to|upto|flat|max(?:imum)?\s*discount\s*(?:of)?)\s*(?:inr|rs\.?|₹)?\s*([0-9,]+)/i);
  if (m && m[1]) {
    const num = parseInt(m[1].replace(/,/g, ''), 10);
    if (!isNaN(num) && num > 0 && num <= 100000) return num;
  }
  // Match "₹1,250 off" or "Rs. 500 discount"
  const mFlat = text.match(/(?:inr|rs\.?|₹)\s*([0-9,]+)\s*(?:off|discount|instant)/i);
  if (mFlat && mFlat[1]) {
    const num = parseInt(mFlat[1].replace(/,/g, ''), 10);
    if (!isNaN(num) && num > 0 && num <= 100000) return num;
  }
  return null;
}

/**
 * Universal Cheerio Parser for Bank Offers & Coupons.
 *
 * @param {object} $ - Cheerio loaded instance of the PDP HTML
 * @param {string} merchant - 'amazon' | 'flipkart' | 'croma' | 'myntra' | 'nykaa' | 'shopsy'
 * @param {number} livePrice - Current selling price for calculating effectivePrice
 * @returns {{ bankOffers: Array<{ bank: string, description: string, discountAmount: number|null, effectivePrice: number|null }>, coupon: string|null }}
 */
export function extractBankOffersAndCoupons($, merchant, livePrice = 0) {
  const bankOffers = [];
  let couponText = null;
  const seenDesc = new Set();
  const cleanMerchant = (merchant || '').toLowerCase();

  try {
    if (cleanMerchant.includes('amazon')) {
      // 1. Amazon Bank Offers
      const amzOfferSelectors = [
        '#itembox-InstantBankDiscount',
        '#sopp_feature_div',
        '#offers_feature_div',
        'div[data-csa-c-slot-id="offers"]',
        '#instant-bank-discount',
        '.offers-items'
      ];

      $(amzOfferSelectors.join(', ')).find('li, .a-carousel-card, [class*="offer"], span.a-truncate-cut, .offer-title, span.a-size-small').each((_, el) => {
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        if (text.length >= 15 && text.length <= 250 && !seenDesc.has(text)) {
          if (/bank|card|instant discount|cashback|emi\b/i.test(text)) {
            seenDesc.add(text);
            const bank = detectBank(text);
            const discountAmount = extractDiscountAmount(text);
            const effectivePrice = livePrice && discountAmount && livePrice > discountAmount ? livePrice - discountAmount : null;
            bankOffers.push({
              bank,
              description: text,
              discountAmount,
              effectivePrice,
            });
          }
        }
      });

      // 2. Amazon On-Page Coupons
      const cpnEl = $('#vpcButton, span[id*="couponText"], label[for*="coupon"], .coupon-badge').first();
      const cpnRaw = cpnEl.text().replace(/\s+/g, ' ').trim();
      if (cpnRaw && /coupon|save|off/i.test(cpnRaw) && cpnRaw.length < 100) {
        couponText = cpnRaw;
      }

    } else if (cleanMerchant.includes('flipkart') || cleanMerchant.includes('shopsy')) {
      // 1. Flipkart / Shopsy Bank Offers
      $('li, div.XqK-AI div, div._16eBzU div, div.WT_PvR div').each((_, el) => {
        const $el = $(el);
        const text = $el.text().replace(/\s+/g, ' ').trim();
        if ((text.startsWith('Bank Offer') || text.startsWith('Special Price') || text.includes('Bank Offer')) && text.length >= 15 && text.length <= 250) {
          if ($el.children().length <= 3 && !seenDesc.has(text)) {
            seenDesc.add(text);
            const bank = detectBank(text);
            const discountAmount = extractDiscountAmount(text);
            const effectivePrice = livePrice && discountAmount && livePrice > discountAmount ? livePrice - discountAmount : null;
            bankOffers.push({
              bank,
              description: text,
              discountAmount,
              effectivePrice,
            });
          }
        }
      });

      // 2. Flipkart Coupons
      $('div[class*="coupon"], span:contains("Coupon")').each((_, el) => {
        if (couponText) return;
        const t = $(el).text().replace(/\s+/g, ' ').trim();
        if (t && /coupon/i.test(t) && t.length < 80) {
          couponText = t;
        }
      });

    } else if (cleanMerchant.includes('croma')) {
      $('[class*="bank-offer"], [class*="offer-item"], [data-testid*="offer"]').each((_, el) => {
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        if (text.length >= 15 && text.length <= 250 && !seenDesc.has(text)) {
          if (/bank|card|instant|cashback|emi/i.test(text)) {
            seenDesc.add(text);
            const bank = detectBank(text);
            const discountAmount = extractDiscountAmount(text);
            const effectivePrice = livePrice && discountAmount && livePrice > discountAmount ? livePrice - discountAmount : null;
            bankOffers.push({
              bank,
              description: text,
              discountAmount,
              effectivePrice,
            });
          }
        }
      });

    } else if (cleanMerchant.includes('myntra') || cleanMerchant.includes('nykaa')) {
      $('.pdp-offers-offer, .pdp-offers-bankOffer, div[class*="offer-card"], div[class*="coupon-wrapper"]').each((_, el) => {
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        if (text.length >= 15 && text.length <= 250 && !seenDesc.has(text)) {
          seenDesc.add(text);
          const bank = detectBank(text);
          const discountAmount = extractDiscountAmount(text);
          const effectivePrice = livePrice && discountAmount && livePrice > discountAmount ? livePrice - discountAmount : null;
          bankOffers.push({
            bank,
            description: text,
            discountAmount,
            effectivePrice,
          });
        }
      });
    }
  } catch (err) {
    // Fail silently without breaking the main scraper
  }

  let couponObj = null;
  if (couponText) {
    const cleanText = couponText.replace(/\s+/g, ' ').trim();
    const percentMatch = cleanText.match(/(\d{1,2}(?:\.\d+)?)\s*%\s*(?:off|coupon)/i) || cleanText.match(/coupon.*?(\d{1,2}(?:\.\d+)?)\s*%/i);
    const flatMatch = cleanText.match(/(?:₹|rs\.?\s*)\s*([\d,]+)\s*(?:off|coupon)/i) || cleanText.match(/coupon.*?(?:₹|rs\.?\s*)\s*([\d,]+)/i);

    if (percentMatch) {
      const val = parseFloat(percentMatch[1]);
      if (val > 0 && val <= 100) {
        couponObj = { type: 'percent', value: val, code: null, label: cleanText };
      }
    } else if (flatMatch) {
      const val = parseFloat(flatMatch[1].replace(/,/g, ''));
      if (val > 0) {
        couponObj = { type: 'flat', value: val, code: null, label: cleanText };
      }
    } else {
      couponObj = { type: 'code', value: null, code: null, label: cleanText };
    }
  }

  return {
    bankOffers: bankOffers.slice(0, 5), // Keep top 5 most relevant offers
    coupon: couponText || null,
    couponObj,
  };
}
