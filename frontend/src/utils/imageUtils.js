/**
 * Some deal/product records have `imageUrl` pointing at an unreachable localhost URL — a
 * backend fallback (Telegram photo download) that defaults its public base URL to localhost
 * when PUBLIC_BASE_URL isn't set in that service's environment. No real device can ever reach
 * it. Used to drop those deals from the feed entirely rather than showing them with a
 * missing/broken image.
 */
export function isUsableImageUrl(url) {
  if (!url) return false;
  return !/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?\//i.test(url);
}
