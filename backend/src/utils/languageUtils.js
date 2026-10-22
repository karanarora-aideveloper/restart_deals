/**
 * Language normalization utilities:
 * Detects Hindi/Devanagari characters and translates back to authentic English.
 * Also enforces English localization headers, cookies, and URL query params for Amazon India.
 */

export function hasHindiCharacters(text) {
  if (!text || typeof text !== 'string') return false;
  return /[\u0900-\u097F]/.test(text);
}

export function forceEnglishAmazonUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
  if (!rawUrl.includes('amazon.in')) return rawUrl;
  try {
    const u = new URL(rawUrl);
    if (!u.searchParams.has('language') || u.searchParams.get('language') !== 'en_IN') {
      u.searchParams.set('language', 'en_IN');
    }
    return u.toString();
  } catch (_) {
    return rawUrl;
  }
}

export async function translateHindiToEnglish(text) {
  if (!hasHindiCharacters(text)) return text;
  try {
    const enc = encodeURIComponent(text.trim());
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=hi&tl=en&dt=t&q=${enc}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    if (!res.ok) return text;
    const data = await res.json();
    if (Array.isArray(data) && Array.isArray(data[0])) {
      const translated = data[0].map(item => item[0]).filter(Boolean).join('').trim();
      if (translated && translated.length > 2) {
        return translated;
      }
    }
  } catch (err) {
    // If translation fails or network times out, return original text safely
  }
  return text;
}
