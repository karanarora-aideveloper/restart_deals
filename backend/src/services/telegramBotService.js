import PriceAlert from '../db/models/priceAlert.js';
import User from '../db/models/user.js';
import Product from '../db/models/product.js';
import { parseShoppingQuery, searchProducts, generateProductVerdicts, buildAIIntroLine } from './aiShoppingAssistant.js';
import { getSession, saveSession, updateSession } from './telegramSession.js';
import { buildAffiliateUrl } from '../utils/affiliate.js';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const BASE_API = TELEGRAM_BOT_TOKEN ? `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}` : '';
const WEBSITE_URL = (process.env.WEBSITE_BASE_URL || 'https://www.shoppersdeals.in').replace(/\/+$/, '');

let isPolling = false;
let pollAbortController = null;
let lastUpdateId = 0;

/**
 * Escapes raw text for safe Telegram HTML rendering.
 */
function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Makes a Telegram Bot API HTTP request.
 */
async function callTelegram(method, payload = {}, timeoutMs = 15000) {
  if (!TELEGRAM_BOT_TOKEN) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN not configured' };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${BASE_API}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const json = await res.json();
    if (!json.ok) {
      console.warn(`[Telegram Bot API] ${method} returned error:`, json.description || json);
    }
    return json;
  } catch (err) {
    if (err.name === 'AbortError' || err.message?.includes('aborted')) {
      return { ok: false, error: 'timeout' };
    }
    return { ok: false, error: err.message };
  }
}

/**
 * Sends a chat action (e.g. typing)
 */
async function sendChatAction(chatId, action = 'typing') {
  return callTelegram('sendChatAction', { chat_id: chatId, action });
}

/**
 * Starts the Telegram Customer Assistant long-polling loop.
 */
export async function startTelegramBot() {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('[Telegram Bot Warning] TELEGRAM_BOT_TOKEN is not configured. Telegram bot service disabled.');
    return;
  }
  if (isPolling) {
    console.log('[Telegram Bot] Bot is already running.');
    return;
  }

  isPolling = true;
  pollAbortController = new AbortController();
  console.log('[Telegram Bot] 🚀 ShoppersDeals AI Shopping Assistant Bot starting up...');

  // Set bot commands menu in Telegram
  await callTelegram('setMyCommands', {
    commands: [
      { command: 'start', description: 'Start the shopping assistant' },
      { command: 'alerts', description: 'View your active price drop alerts' },
      { command: 'help', description: 'How to use this bot' }
    ]
  });

  // Long polling loop
  pollLoop();
}

/**
 * Stops the long-polling loop gracefully.
 */
export function stopTelegramBot() {
  isPolling = false;
  if (pollAbortController) {
    pollAbortController.abort();
    pollAbortController = null;
  }
  console.log('[Telegram Bot] Stopped.');
}

async function pollLoop() {
  while (isPolling) {
    try {
      const res = await callTelegram('getUpdates', {
        offset: lastUpdateId + 1,
        timeout: 20,
        allowed_updates: ['message', 'callback_query']
      }, 35000);

      if (!res.ok) {
        if (res.error_code === 409 || res.description?.includes('conflict') || res.description?.includes('terminated by other getUpdates')) {
          console.warn('[Telegram Bot] ⏸️ Overlapping polling instance detected (409 Conflict). Backing off for 30s...');
          await new Promise(r => setTimeout(r, 30000));
        } else if (res.error_code === 429) {
          const retryAfter = res.parameters?.retry_after || 10;
          console.warn(`[Telegram Bot] Rate limited (429). Waiting ${retryAfter}s...`);
          await new Promise(r => setTimeout(r, retryAfter * 1000));
        } else {
          await new Promise(r => setTimeout(r, 3000));
        }
        continue;
      }

      if (res.ok && Array.isArray(res.result) && res.result.length > 0) {
        for (const update of res.result) {
          lastUpdateId = update.update_id;
          handleUpdate(update).catch(err => {
            console.error('[Telegram Bot] Error handling update:', err);
          });
        }
      }
    } catch (err) {
      if (!isPolling) break;
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

/**
 * Main update router
 */
async function handleUpdate(update) {
  if (update.message) {
    await handleMessage(update.message);
  } else if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
  }
}

/**
 * Handles incoming text messages and commands
 */
async function handleMessage(message) {
  const chatId = message.chat?.id;
  const rawText = (message.text || '').trim();
  const username = message.from?.username || '';
  const firstName = message.from?.first_name || 'Shopper';

  if (!chatId || !rawText) return;

  const session = await getSession(chatId);

  // 1. Check if user is entering an email address to link account / confirm alert
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailRegex.test(rawText)) {
    await handleEmailSubmission(chatId, rawText.toLowerCase(), username, firstName, session);
    return;
  }

  // 1.5 Handle deep-link /start alert_PRODUCTID or /start track_PRODUCTID
  const alertDeepLinkMatch = rawText.match(/^\/start\s+(?:alert_|track_)([A-Za-z0-9_-]+)/i);
  if (alertDeepLinkMatch) {
    const pId = alertDeepLinkMatch[1];
    await handleDeepLinkAlert(chatId, pId, username, firstName);
    return;
  }

  // 2. Command: /start or greeting
  if (/^\/(start|help)$/i.test(rawText) || /^(hi|hello|hey)$/i.test(rawText)) {
    await sendWelcomeMessage(chatId, firstName);
    return;
  }

  // 3. Command: /alerts
  if (/^\/(alerts|myalerts)$/i.test(rawText) || /^my alerts$/i.test(rawText)) {
    await showUserAlerts(chatId);
    return;
  }

  // 4. Quick Suggestion Pill Matches
  let queryText = rawText;
  if (rawText === '☀️ Sunscreen for Oily Skin') queryText = 'Top 3 sunscreens for oily skin under 500';
  else if (rawText === '📱 Best Phones under ₹20k') queryText = 'Best 5G phones under 20000';
  else if (rawText === '🎧 Earbuds under ₹1,500') queryText = 'Wireless earbuds under 1500';
  else if (rawText === '🔔 My Active Alerts') {
    await showUserAlerts(chatId);
    return;
  }

  // 5. Send Typing Indicator
  await sendChatAction(chatId, 'typing');

  // 6. Parse Query with AI & Local NLP
  const parsed = await parseShoppingQuery(queryText, session);

  if (parsed.action === 'greeting') {
    await sendWelcomeMessage(chatId, firstName);
    return;
  }

  if (parsed.action === 'my_alerts') {
    await showUserAlerts(chatId);
    return;
  }

  if (parsed.action === 'paginate_next') {
    await paginateProducts(chatId, session, 3);
    return;
  }

  // 7. Execute Database Search
  const { products, totalCount, hasMore } = await searchProducts(parsed, 0, 3);

  if (products.length === 0) {
    await callTelegram('sendMessage', {
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `🔍 <b>No exact products found for "${escapeHtml(queryText)}"</b>\n\nTry relaxing your budget, or search with different keywords (e.g., <i>"sunscreens under 600"</i> or <i>"phones under 25000"</i>).`,
      reply_markup: {
        keyboard: [
          [{ text: '☀️ Sunscreen for Oily Skin' }, { text: '📱 Best Phones under ₹20k' }],
          [{ text: '🎧 Earbuds under ₹1,500' }, { text: '🔔 My Active Alerts' }]
        ],
        resize_keyboard: true
      }
    });
    return;
  }

  // 8. Update Session
  session.lastQuery = parsed;
  session.currentIndex = 0;
  session.candidateProductIds = products.map(p => p.productId);
  session.history.push({ role: 'user', text: queryText });
  if (session.history.length > 8) session.history = session.history.slice(-8);
  await saveSession(chatId, session);

  // 9. Generate Verdicts and Send Response
  const verdicts = generateProductVerdicts(parsed, products);
  await sendProductRecommendations(chatId, queryText, products, verdicts, totalCount, 0, hasMore, parsed);
}

/**
 * Handles 1-tap price drop alert activation via deep-link (/start alert_PRODUCTID)
 */
async function handleDeepLinkAlert(chatId, rawProductId, username, firstName) {
  try {
    let product = await Product.findOne({ productId: rawProductId });
    if (!product && rawProductId.length === 24) {
      product = await Product.findById(rawProductId).catch(() => null);
    }

    if (!product) {
      await callTelegram('sendMessage', {
        chat_id: chatId,
        text: `👋 Hey ${firstName}! We received your alert request, but couldn't find this item in our catalog. You can search for it directly by typing its name below!`,
      });
      return;
    }

    const currentPrice = product.price || 0;
    const targetPrice = currentPrice > 0 ? Math.round(currentPrice * 0.9) : 0; // Default 10% drop target

    await PriceAlert.findOneAndUpdate(
      { productId: product.productId, telegramChatId: String(chatId), status: 'active' },
      {
        $set: {
          productId: product.productId,
          merchant: product.merchant || 'amazon',
          title: product.title,
          imageUrl: product.imageUrl || (product.images && product.images[0]) || '',
          cleanUrl: product.cleanUrl || '',
          targetPrice: targetPrice,
          initialPrice: currentPrice,
          telegramChatId: String(chatId),
          telegramUsername: username,
          source: 'telegram_bot_deeplink',
          status: 'active',
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        }
      },
      { upsert: true, new: true }
    );

    const priceText = currentPrice > 0 ? `₹${currentPrice.toLocaleString('en-IN')}` : 'Current price';
    const targetText = targetPrice > 0 ? `₹${targetPrice.toLocaleString('en-IN')}` : 'a lower price';

    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: `🎉 <b>Price Drop Alert Activated!</b>\n\n` +
        `📦 <b>${escapeHtml((product.title || 'Tracked Product').slice(0, 80))}...</b>\n\n` +
        `💰 Current Price: <b>${priceText}</b>\n` +
        `🎯 Alert Target: <b>${targetText}</b> (10% drop)\n\n` +
        `⚡ We monitor this product 24/7. The moment the merchant drops the price, we will ping you right here on Telegram!`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🛍️ View On Store', url: product.cleanUrl || 'https://shoppersdeals.in' },
            { text: '🔔 View All Alerts', callback_data: 'my_alerts' }
          ]
        ]
      }
    });
  } catch (err) {
    console.error('[Telegram Bot] Deep link alert error:', err);
    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: `Sorry ${firstName}, could not activate the alert at this moment. Please try again!`,
    });
  }
}

/**
 * Formats merchant identifier into human-readable brand name
 */
function formatMerchantName(merchant = '') {
  const m = String(merchant).toLowerCase();
  if (m === 'amazon') return 'Amazon India';
  if (m === 'flipkart') return 'Flipkart';
  if (m === 'nykaa') return 'Nykaa';
  if (m === 'myntra') return 'Myntra';
  if (m === 'ajio') return 'Ajio';
  if (m === 'meesho') return 'Meesho';
  if (m === 'croma') return 'Croma';
  return merchant ? merchant.charAt(0).toUpperCase() + merchant.slice(1) : 'Store';
}

/**
 * Short merchant label for compact inline keyboard buttons
 */
function formatMerchantShort(merchant = '') {
  const m = String(merchant).toLowerCase();
  if (m === 'amazon') return 'Amazon';
  if (m === 'flipkart') return 'Flipkart';
  if (m === 'nykaa') return 'Nykaa';
  if (m === 'myntra') return 'Myntra';
  if (m === 'ajio') return 'Ajio';
  if (m === 'meesho') return 'Meesho';
  if (m === 'croma') return 'Croma';
  return merchant ? merchant.toUpperCase() : 'BUY';
}

/**
 * Formats and dispatches the Top 3 product recommendation cards.
 * Adheres strictly to Telegram HTML guidelines with clean spacing and separation.
 */
async function sendProductRecommendations(chatId, query, products, verdicts, totalCount, offset = 0, hasMore = false, parsedQuery = null) {
  // Top product photo banner preview if available
  const topProductImage = products[0]?.imageUrl || (products[0]?.images && products[0]?.images[0]);
  let messageText = '';
  if (topProductImage && topProductImage.startsWith('http')) {
    messageText += `<a href="${topProductImage}">&#8205;</a>`;
  }

  // 1. Heading with underline separator
  messageText += `🎯 <b>Top ${products.length} Picks for "${escapeHtml(query)}"</b>\n`;
  messageText += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // 2. AI Requirement Intro Line with today's date
  const introLine = parsedQuery ? buildAIIntroLine(parsedQuery, query) : '';
  if (introLine) {
    messageText += `${introLine}\n\n`;
  }

  // 3. Subtitle with clean spacing before cards
  messageText += `🔍 <i>Found ${totalCount} verified deals in catalog (Ranked by Rating & Value)</i>\n\n`;
  messageText += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // 4. Rich Product Cards with Direct In-Card Buy Links
  products.forEach((prod, idx) => {
    const rank = offset + idx + 1;
    const title = escapeHtml(prod.title);
    const storeName = formatMerchantName(prod.merchant);
    const priceStr = `₹${prod.price.toLocaleString('en-IN')}`;
    const origStr = prod.originalPrice && prod.originalPrice > prod.price ? `<s>₹${prod.originalPrice.toLocaleString('en-IN')}</s>` : '';
    const discountPct = prod.discountPercentage > 0 
      ? prod.discountPercentage 
      : (prod.originalPrice && prod.originalPrice > prod.price ? Math.round(((prod.originalPrice - prod.price) / prod.originalPrice) * 100) : 0);
    const discountBadge = discountPct > 0 ? `🔥 <b>${discountPct}% OFF</b>` : '';
    const ratingValue = prod.rating != null ? `${Number(prod.rating).toFixed(1)}★` : '4.0★';
    const reviewCount = prod.reviews?.length ? `<i>(${prod.reviews.length}+ reviews)</i>` : '';

    // Clean verdict: strip any accidental duplicate rating mentions or markdown asterisks
    let rawVerdict = (verdicts[idx] || '')
      .replace(/rated\s+\d+(\.\d+)?(\s*[\/★\w]*)?/gi, '')
      .replace(/\b\d+(\.\d+)?\s*★/g, '')
      .replace(/\*{1,3}/g, '')
      .trim();
    const cleanVerdict = escapeHtml(rawVerdict);

    const buyUrl = buildAffiliateUrl(prod.cleanUrl, 'IN', prod.merchant);

    // Title line
    messageText += `<b>${rank}️⃣ <a href="${buyUrl}">${title}</a></b>\n\n`;

    // Price line on its own row
    messageText += `💰 <b>Price:</b> <b>${priceStr}</b> ${origStr}  ${discountBadge}\n\n`;

    // Rating line on its own row (strictly 1 star icon, no duplicate rating)
    messageText += `⭐ <b>Rating:</b> <b>${ratingValue}</b> ${reviewCount}\n\n`;

    // Store line on its own row (never on the same row as rating)
    messageText += `🏪 <b>Store:</b> <b>${storeName}</b>\n\n`;

    // Verdict section (with empty line before and after)
    if (cleanVerdict) {
      messageText += `💡 <b>Verdict:</b>\n<i>${cleanVerdict}</i>\n\n`;
    }

    // Direct Buy Link (with empty line before and after)
    messageText += `👉 🛒 <b><a href="${buyUrl}">Buy on ${storeName} (${priceStr}) ➔</a></b>\n\n`;

    // Card divider
    messageText += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  });

  // 5. Clean, Non-Cluttered Action Toolbar at the bottom
  const inlineKeyboard = [];

  // Row 1: Direct 1-tap Buy links with store name & price side-by-side
  const buyShortcuts = products.map((prod, idx) => ({
    text: `🛒 #${offset + idx + 1} ${formatMerchantShort(prod.merchant)} (₹${prod.price.toLocaleString('en-IN')})`,
    url: buildAffiliateUrl(prod.cleanUrl, 'IN', prod.merchant)
  }));
  inlineKeyboard.push(buyShortcuts);

  // Row 2: Price alert picker & pagination
  const actionRow = [
    { text: '🔔 Set Price Alert', callback_data: 'alert_select' }
  ];
  if (hasMore) {
    actionRow.push({ text: '▶️ Next 3 Picks', callback_data: 'page:next' });
  }
  inlineKeyboard.push(actionRow);

  // Row 3: Cheaper filter & Website link
  inlineKeyboard.push([
    { text: '📉 Show Cheaper Options', callback_data: 'refine:cheaper' },
    { text: '🌐 Open ShoppersDeals', url: `${WEBSITE_URL}?src=tgbot` }
  ]);

  await callTelegram('sendMessage', {
    chat_id: chatId,
    parse_mode: 'HTML',
    disable_web_page_preview: false,
    text: messageText,
    reply_markup: {
      inline_keyboard: inlineKeyboard
    }
  });
}

/**
 * Handles pagination (Next 3 products)
 */
async function paginateProducts(chatId, session, step = 3) {
  if (!session?.lastQuery) {
    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: 'What are you looking for? Type a query like "Top 3 sunscreens under 500" to begin.'
    });
    return;
  }

  const nextOffset = (session.currentIndex || 0) + step;
  const { products, totalCount, hasMore } = await searchProducts(session.lastQuery, nextOffset, 3);

  if (products.length === 0) {
    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: '🏁 You have viewed all matching products for this search. Try a new query or ask to see cheaper options!'
    });
    return;
  }

  session.currentIndex = nextOffset;
  await saveSession(chatId, session);

  const verdicts = generateProductVerdicts(session.lastQuery, products);
  await sendProductRecommendations(chatId, session.lastQuery.searchTerms.join(' '), products, verdicts, totalCount, nextOffset, hasMore, session.lastQuery);
}

/**
 * Handles inline button callbacks
 */
async function handleCallbackQuery(callbackQuery) {
  const callbackId = callbackQuery.id;
  const data = callbackQuery.data;
  const chatId = callbackQuery.message?.chat?.id;
  const username = callbackQuery.from?.username || '';
  const firstName = callbackQuery.from?.first_name || 'Shopper';

  if (!chatId || !data) return;

  const session = await getSession(chatId);

  // Acknowledge callback immediately to dismiss Telegram spinner
  await callTelegram('answerCallbackQuery', { callback_query_id: callbackId });

  // 1. Alert button tapped directly for product: alert:<productId>
  if (data.startsWith('alert:')) {
    const productId = data.replace('alert:', '').trim();
    await handleAlertButton(chatId, productId, username, firstName, session);
    return;
  }

  // 2. Open Price Alert Product Picker
  if (data === 'alert_select') {
    const offset = session.currentIndex || 0;
    const { products } = await searchProducts(session.lastQuery || {}, offset, 3);

    if (!products || products.length === 0) {
      await callTelegram('sendMessage', {
        chat_id: chatId,
        text: '⚠️ Please perform a product search first before tracking.'
      });
      return;
    }

    const pickerButtons = products.map((p, i) => ([
      {
        text: `🔔 Track #${offset + i + 1}: ${p.title.slice(0, 28)}... (₹${p.price})`,
        callback_data: `alert:${p.productId}`
      }
    ]));
    pickerButtons.push([{ text: '❌ Close', callback_data: 'alert_cancel' }]);

    await callTelegram('sendMessage', {
      chat_id: chatId,
      parse_mode: 'HTML',
      text: '🔔 <b>Which product would you like to track for price drops?</b>\n<i>Tap an item below and we will notify you here the moment its price drops:</i>',
      reply_markup: {
        inline_keyboard: pickerButtons
      }
    });
    return;
  }

  // 3. Cancel Alert Picker
  if (data === 'alert_cancel') {
    await callTelegram('deleteMessage', { chat_id: chatId, message_id: callbackQuery.message?.message_id });
    return;
  }

  // 4. Next page button tapped
  if (data === 'page:next') {
    await paginateProducts(chatId, session, 3);
    return;
  }

  // 5. Show cheaper options
  if (data === 'refine:cheaper') {
    if (session?.lastQuery) {
      const currentMax = session.lastQuery.maxPrice || 1000;
      session.lastQuery.maxPrice = Math.round(currentMax * 0.75);
      session.lastQuery.sort = 'price_asc';
      session.currentIndex = 0;
      await saveSession(chatId, session);

      await sendChatAction(chatId, 'typing');
      const { products, totalCount, hasMore } = await searchProducts(session.lastQuery, 0, 3);
      const verdicts = generateProductVerdicts(session.lastQuery, products);
      await sendProductRecommendations(chatId, `Budget under ₹${session.lastQuery.maxPrice}`, products, verdicts, totalCount, 0, hasMore, session.lastQuery);
    }
  }
}

/**
 * Handles "Set Price Alert" button click
 */
async function handleAlertButton(chatId, productId, username, firstName, session) {
  // Find product details
  const product = await Product.findOne({ productId }).lean();
  if (!product) {
    await callTelegram('sendMessage', {
      chat_id: chatId,
      text: '⚠️ Product details could not be found. Please try another product.'
    });
    return;
  }

  // Check if chat is already linked to an email or user
  let user = await User.findOne({ telegramChatId: String(chatId) });
  let userEmail = session.linkedEmail || user?.email;

  if (userEmail) {
    // Already linked! Set alert immediately
    const targetPrice = Math.round((product.price || 500) * 0.9); // default 10% drop target
    await createOrUpdateAlert({
      productId: product.productId,
      merchant: product.merchant || 'amazon',
      title: product.title,
      imageUrl: product.imageUrl,
      cleanUrl: product.cleanUrl,
      targetPrice,
      initialPrice: product.price,
      telegramChatId: String(chatId),
      telegramUsername: username,
      email: userEmail,
      userId: user?._id
    });

    await callTelegram('sendMessage', {
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `✅ <b>Price Alert Activated!</b> 🔔\n\nWe are tracking: <b>${escapeHtml(product.title)}</b>\n• Current Price: <b>₹${product.price?.toLocaleString('en-IN')}</b>\n• Alert Target: <b>₹${targetPrice.toLocaleString('en-IN')}</b> (10% drop)\n\n<i>You will receive an instant direct message here as soon as this price drops!</i>`
    });
  } else {
    // Chat not linked yet. Prompt for email.
    session.pendingAlert = {
      productId: product.productId,
      merchant: product.merchant,
      title: product.title,
      price: product.price,
      imageUrl: product.imageUrl,
      cleanUrl: product.cleanUrl
    };
    await saveSession(chatId, session);

    await callTelegram('sendMessage', {
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `🔔 <b>Link Your Account for Price Drop Alerts</b>\n\nTo alert you when <b>${escapeHtml(product.title)}</b> drops below ₹${product.price?.toLocaleString('en-IN')}, please reply with your <b>Email Address</b>:\n\n<i>Example: name@gmail.com</i>\n\nThis links your Telegram directly to ShoppersDeals so you never miss a deal!`
    });
  }
}

/**
 * Handles user entering their email address in chat
 */
async function handleEmailSubmission(chatId, email, username, firstName, session) {
  // Update or create User in DB
  let user = await User.findOne({ email });
  if (user) {
    user.telegramChatId = String(chatId);
    if (username) user.telegramUsername = username;
    await user.save();
  } else {
    user = new User({
      email,
      name: firstName,
      telegramChatId: String(chatId),
      telegramUsername: username || null
    });
    await user.save();
  }

  session.linkedEmail = email;

  // If user was in the middle of setting an alert
  if (session.pendingAlert) {
    const alertData = session.pendingAlert;
    const targetPrice = Math.round((alertData.price || 500) * 0.9);

    await createOrUpdateAlert({
      productId: alertData.productId,
      merchant: alertData.merchant || 'amazon',
      title: alertData.title,
      imageUrl: alertData.imageUrl,
      cleanUrl: alertData.cleanUrl,
      targetPrice,
      initialPrice: alertData.price,
      telegramChatId: String(chatId),
      telegramUsername: username,
      email,
      userId: user._id
    });

    session.pendingAlert = null;
    await saveSession(chatId, session);

    await callTelegram('sendMessage', {
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `🎉 <b>Account Linked & Alert Set!</b>\n\n• Email: <b>${escapeHtml(email)}</b>\n• Tracking: <b>${escapeHtml(alertData.title)}</b>\n• Alert Target: <b>₹${targetPrice.toLocaleString('en-IN')}</b>\n\n<i>We will message you right here on Telegram the second the price drops!</i>`
    });
  } else {
    await saveSession(chatId, session);
    await callTelegram('sendMessage', {
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `✅ <b>Account Linked Successfully!</b>\n\nYour Telegram is now connected to <b>${escapeHtml(email)}</b>.\nYou can now tap <b>[🔔 Alert Price Drop]</b> on any product to track it with 1 tap!`
    });
  }
}

/**
 * Creates or updates a PriceAlert document with Telegram Chat ID
 */
async function createOrUpdateAlert(params) {
  const existing = await PriceAlert.findOne({
    productId: params.productId,
    telegramChatId: params.telegramChatId,
    status: 'active'
  });

  if (existing) {
    existing.targetPrice = params.targetPrice;
    existing.initialPrice = params.initialPrice;
    existing.title = params.title || existing.title;
    existing.imageUrl = params.imageUrl || existing.imageUrl;
    existing.email = params.email || existing.email;
    existing.updatedAt = new Date();
    await existing.save();
    return existing;
  }

  const alert = new PriceAlert({
    productId: params.productId,
    merchant: params.merchant || 'amazon',
    title: params.title,
    imageUrl: params.imageUrl,
    cleanUrl: params.cleanUrl,
    targetPrice: params.targetPrice,
    initialPrice: params.initialPrice,
    telegramChatId: params.telegramChatId,
    telegramUsername: params.telegramUsername,
    email: params.email,
    userId: params.userId,
    source: 'telegram_bot',
    status: 'active'
  });

  await alert.save();
  return alert;
}

/**
 * Shows user's active price alerts
 */
async function showUserAlerts(chatId) {
  const alerts = await PriceAlert.find({
    telegramChatId: String(chatId),
    status: 'active'
  }).limit(10).lean();

  if (alerts.length === 0) {
    await callTelegram('sendMessage', {
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `🔔 <b>You don't have any active price alerts yet.</b>\n\nAsk for any product (e.g. <i>"Top sunscreens under 500"</i>) and tap <b>[🔔 Alert Price Drop]</b> on any item to start tracking!`
    });
    return;
  }

  let text = `🔔 <b>Your Active Price Drop Alerts (${alerts.length})</b>\n\n`;
  alerts.forEach((a, i) => {
    const title = escapeHtml(a.title || 'Product');
    const target = a.targetPrice ? `₹${a.targetPrice.toLocaleString('en-IN')}` : 'Any drop';
    text += `<b>${i+1}. ${title}</b>\n• Alert Target: <b>${target}</b>\n• Store: ${a.merchant.toUpperCase()}\n\n`;
  });

  await callTelegram('sendMessage', {
    chat_id: chatId,
    parse_mode: 'HTML',
    text
  });
}

/**
 * Sends welcome onboarding message
 */
async function sendWelcomeMessage(chatId, firstName) {
  const welcomeText = `👋 <b>Hi ${escapeHtml(firstName)}, welcome to ShoppersDeals AI Assistant!</b> 🛍️

I help you find the <b>highest-rated products, authentic price drops, and verified bargains</b> across Amazon, Flipkart, Nykaa, and Myntra.

💡 <b>Ask me anything naturally, for example:</b>
• <i>"Top 3 sunscreens for oily skin under 500"</i>
• <i>"Best 5G phones under 20000"</i>
• <i>"Wireless earbuds under 1500"</i>
• <i>"Best whey protein for muscle gain"</i>
• <i>"Laptops for students under 40000"</i>

Tap any button below to try a popular search right now 👇`;

  await callTelegram('sendMessage', {
    chat_id: chatId,
    parse_mode: 'HTML',
    text: welcomeText,
    reply_markup: {
      keyboard: [
        [{ text: '☀️ Sunscreen for Oily Skin' }, { text: '📱 Best Phones under ₹20k' }],
        [{ text: '🎧 Earbuds under ₹1,500' }, { text: '🔔 My Active Alerts' }]
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  });
}

/**
 * Public function to send a high-priority price drop direct message to a user.
 * Called by priceAlertNotifier when Engine 1 or Engine 2 detects an authentic price drop.
 */
export async function sendPriceDropTelegramNotification({
  chatId,
  title,
  livePrice,
  previousPrice,
  targetPrice,
  dealUrl,
  merchant = 'amazon',
  imageUrl = ''
}) {
  if (!chatId) return false;

  const priceStr = `₹${Math.round(livePrice).toLocaleString('en-IN')}`;
  const targetStr = targetPrice ? `₹${Math.round(targetPrice).toLocaleString('en-IN')}` : '';
  const buyUrl = buildAffiliateUrl(dealUrl, 'IN', merchant);

  const text = `🚨 <b>PRICE DROP ALERT!</b> 📉\n\n<b><a href="${buyUrl}">${escapeHtml(title)}</a></b>\n\n` +
    `💰 <b>Dropped to: ${priceStr}!</b>\n` +
    (targetStr ? `🎯 Your Target: ${targetStr}\n` : '') +
    `🏪 Store: <b>${merchant.toUpperCase()}</b>\n\n` +
    `<i>⚡ Deals expire fast! Grab it before stock runs out:</i>`;

  return callTelegram('sendMessage', {
    chat_id: chatId,
    parse_mode: 'HTML',
    text,
    reply_markup: {
      inline_keyboard: [
        [{ text: `🛒 BUY NOW AT ${priceStr}`, url: buyUrl }],
        [{ text: `🌐 View on ShoppersDeals`, url: `${WEBSITE_URL}?src=tg_alert` }]
      ]
    }
  });
}
