/**
 * Determines whether a deal originates from Engine 1 or Engine 2.
 * 
 * Engine 1: Telegram Deal Radar (crowdsourced deals from monitored Telegram channels).
 * Engine 2: Shoppers Deals Store Watcher & Discovery Engines (Top20 catalog watcher,
 *           bestseller crawler, D2C catalog sync, Amazon deals crawler, Buyhatke store scraper).
 * 
 * @param {string} sourceChannelId
 * @param {string} [sourceChannelName]
 * @returns {'engine1' | 'engine2'}
 */
export function classifySourceEngine(sourceChannelId, sourceChannelName = '') {
  if (!sourceChannelId) return 'engine1';
  
  const id = String(sourceChannelId).toLowerCase().trim();
  const name = String(sourceChannelName || '').toLowerCase().trim();

  // Engine 2 explicit identifiers
  if (
    id.includes('catalog') ||
    id.includes('engine') ||
    id.includes('crawler') ||
    id.includes('d2c') ||
    id.includes('buyhatke') ||
    id.includes('top20') ||
    id.includes('bestseller') ||
    id.includes('watcher') ||
    id.includes('amazon_deals') ||
    id === '-100_buyhatke_import'
  ) {
    return 'engine2';
  }

  // Engine 2 channel names
  if (
    name.includes('shoppers deals engine') ||
    name.includes('shoppersdeals price drop engine') ||
    name.includes('top-20 catalog') ||
    name.includes('buyhatke') ||
    name.includes('bestseller') ||
    name.includes('amazon deals') ||
    name.includes('d2c')
  ) {
    return 'engine2';
  }

  // Otherwise, numeric Telegram channel IDs belong to Engine 1 (Telegram Deal Radar)
  return 'engine1';
}

/**
 * Returns human-readable badges and labels for UI display.
 */
export function getSourceEngineMetadata(sourceEngine, sourceChannelName) {
  if (sourceEngine === 'engine2') {
    return {
      engine: 'engine2',
      badge: '🤖 Engine 2',
      label: 'Store Watcher',
      fullLabel: 'Engine 2 (Store Watcher)',
      bgClass: 'bg-purple-50 text-purple-700 border-purple-200/80',
      description: 'Discovered autonomously by store crawlers & price drop watchers'
    };
  }

  return {
    engine: 'engine1',
    badge: '📡 Engine 1',
    label: 'Telegram Radar',
    fullLabel: 'Engine 1 (Telegram Radar)',
    bgClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    description: sourceChannelName ? `Captured via ${sourceChannelName}` : 'Captured via Telegram Deal Radar'
  };
}
