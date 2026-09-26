import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';
import input from 'input';
import PQueue from 'p-queue';
import config from '../config.js';
import Channel from '../db/models/channel.js';
import { verifyAndProcessMessage } from './verifier.js';
import { publishToTelegram } from './publisher.js';
import { downloadMessagePhoto } from '../utils/telegramMedia.js';
import { scraperQueue } from '../services/scraperQueue.js';
import { defaultRedis } from '../utils/redis.js';
import crypto from 'crypto';

// Dynamic concurrency queue to process incoming messages across channels in parallel.
// Concurrency dynamically scales to match the number of active scraper workers available.
const INITIAL_CONCURRENCY = parseInt(process.env.SCRAPER_CONCURRENCY || '3', 10);
const queue = new PQueue({ concurrency: Math.max(1, INITIAL_CONCURRENCY) });

export function getQueueLength() {
  return queue.size + queue.pending;
}

export function getQueueConcurrency() {
  return queue.concurrency;
}

/**
 * Update queue concurrency based on the number of active scraper workers connected to Redis.
 * Ensures Telegram message processing throughput dynamically matches scraper fleet capacity.
 */
export async function syncQueueConcurrencyWithScrapers() {
  try {
    const activeWorkers = await scraperQueue.getActiveWorkerCount();
    const forcedConcurrency = process.env.FORCE_SCRAPER_CONCURRENCY
      ? parseInt(process.env.FORCE_SCRAPER_CONCURRENCY, 10)
      : null;
    const fallbackConcurrency = process.env.SCRAPER_CONCURRENCY
      ? parseInt(process.env.SCRAPER_CONCURRENCY, 10)
      : 3;

    let target;
    if (forcedConcurrency && forcedConcurrency > 0) {
      target = forcedConcurrency;
    } else if (activeWorkers > 0) {
      target = Math.max(3, activeWorkers * 2);
    } else {
      target = Math.max(3, fallbackConcurrency);
    }

    target = Math.max(1, target);

    if (queue.concurrency !== target) {
      console.log(`[Queue Dynamic Concurrency] Concurrency scaled ${queue.concurrency} ➔ ${target} (active scrapers in Redis: ${activeWorkers}, fallback: ${fallbackConcurrency})`);
      queue.concurrency = target;
    }

    return target;
  } catch (err) {
    console.warn('[Queue Dynamic Concurrency] Sync failed (non-fatal):', err.message);
    return queue.concurrency;
  }
}

// 75s ceiling for single-message verification (allows ScrapingAnt full browser renders without blocking indefinitely)
const MESSAGE_PROCESSING_TIMEOUT_MS = 75000;

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms waiting for ${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Normalize any Telegram channel ID variant (bare "123", MTProto "-100123", or
 * bot-API "-123") to the bare digit-string form that Channel.channelId is stored
 * as in MongoDB.
 */
function toBareChannelId(id) {
  return id.toString().replace(/^-100/, '').replace(/^-/, '');
}

let client;
const resolvedChannelIds = new Set(); // Fast lookup set for active channel IDs/handles
const channelTitlesMap = new Map();   // Maps channel ID -> Channel Title for clean logs
const channelCountryMap = new Map();  // Maps channel ID -> Country Code
const channelCategoryMap = new Map(); // Maps channel ID -> admin-configured category ('auto' if unset)
const dialogEntitiesMap = new Map();  // Cached GramJS entity objects from getDialogs()
const channelPtsMap = new Map();      // Maps bareChannelId -> current MTProto PTS sequence
const lastEnqueuedMessageId = new Map(); // Tracks highest message ID enqueued per channel

let currentHandler = null;

/**
 * Extract full message text including URLs hidden inside Telegram hyperlink entities.
 * Telegram admins often use "Buy Now" hyperlinks where the URL is in message.entities
 * as MessageEntityTextUrl, not visible in message.message plain text.
 */
function extractMessageText(message) {
  let text = message.message || '';

  if (message.entities && message.entities.length > 0) {
    const entityUrls = [];
    for (const entity of message.entities) {
      if (entity.className === 'MessageEntityTextUrl' && entity.url) {
        entityUrls.push(entity.url);
      }
    }

    if (entityUrls.length > 0) {
      const unique = [...new Set(entityUrls)];
      text = text + '\n' + unique.join('\n');
    }
  }

  return text;
}

/**
 * Unified entry point for incoming channel messages (live socket pushes & MTProto delta syncs).
 */
async function enqueueIncomingMessage(rawChannelId, message) {
  try {
    if (!message || message.id == null) return;
    const bareChannelId = toBareChannelId(rawChannelId);
    const messageId = message.id.toString();

    // Deduplicate against last enqueued message ID
    const lastEnqueued = lastEnqueuedMessageId.get(bareChannelId) || 0;
    if (message.id <= lastEnqueued) {
      return;
    }
    lastEnqueuedMessageId.set(bareChannelId, message.id);

    const messageText = extractMessageText(message);
    if (!messageText || messageText.trim().length === 0) return;

    const channelName = channelTitlesMap.get(bareChannelId) || bareChannelId;
    const displayName = `"${channelName}"`;
    const preview = messageText.substring(0, 45).replace(/\n/g, ' ');

    console.log(`[Telegram Listener] ⚡ Captured message ${messageId} in [${displayName}] (ID: ${bareChannelId}) - ${preview}`);

    // Update DB captured metrics
    Channel.updateOne(
      { channelId: bareChannelId },
      { $inc: { messagesCapturedCount: 1 }, $set: { lastMessageAt: new Date() } }
    ).catch(err => console.warn(`[Channel Metrics] Update failed for ${bareChannelId}:`, err.message));

    const country = channelCountryMap.get(bareChannelId) || 'IN';
    const category = channelCategoryMap.get(bareChannelId) || 'auto';
    const sourceChannelName = channelTitlesMap.get(bareChannelId) || bareChannelId;

    // Enqueue message processing with dynamic scraper-based concurrency
    queue.add(async () => {
      try {
        const getTelegramPhotoUrl = () => downloadMessagePhoto(client, message);
        const deal = await withTimeout(
          verifyAndProcessMessage(bareChannelId, messageId, messageText, country, sourceChannelName, getTelegramPhotoUrl, category),
          MESSAGE_PROCESSING_TIMEOUT_MS,
          `verifyAndProcessMessage(${messageId})`
        );
        if (deal) {
          await withTimeout(publishToTelegram(client, deal), 30000, `publishToTelegram(${messageId})`);
          Channel.updateOne(
            { channelId: bareChannelId },
            { $inc: { dealsProducedCount: 1 }, $set: { lastDealAt: new Date() } }
          ).catch(() => {});
        }
      } catch (err) {
        console.error(`[Queue Error] Processing failed for message ${messageId}:`, err.message);
      }
    });
  } catch (err) {
    console.error('[Telegram Listener Error] enqueueIncomingMessage error:', err.message);
  }
}

/**
 * Synchronize channel PTS state via native Telegram MTProto updates.getChannelDifference.
 * This establishes the client's PTS on Telegram's servers so Telegram sends passive socket updates,
 * and recovers any pending delta messages if gaps exist.
 */
async function syncChannelDifference(bareChannelId, entity) {
  try {
    if (!client || !client.connected || !entity) return;

    let pts = channelPtsMap.get(bareChannelId);
    if (!pts) {
      // First time: fetch full channel to establish the latest PTS baseline
      const full = await client.invoke(new Api.channels.GetFullChannel({ channel: entity }));
      pts = full.fullChat?.pts || 1;
      channelPtsMap.set(bareChannelId, pts);
      console.log(`[MTProto Sync] Established PTS baseline for "${entity.title || bareChannelId}": ${pts}`);
    }

    const diff = await client.invoke(new Api.updates.GetChannelDifference({
      channel: entity,
      filter: new Api.ChannelMessagesFilterEmpty(),
      pts: pts,
      limit: 50
    }));

    if (diff.pts) {
      channelPtsMap.set(bareChannelId, diff.pts);
    }

    // Process any new messages returned in the difference
    if (diff.newMessages && diff.newMessages.length > 0) {
      console.log(`[MTProto Sync] Retrieved ${diff.newMessages.length} message(s) from "${entity.title || bareChannelId}" via channel difference.`);
      for (const msg of diff.newMessages) {
        await enqueueIncomingMessage(bareChannelId, msg);
      }
    }
  } catch (err) {
    if (err.message && err.message.includes('PERSISTENT_TIMESTAMP_OUTDATED')) {
      try {
        const full = await client.invoke(new Api.channels.GetFullChannel({ channel: entity }));
        if (full.fullChat?.pts) {
          channelPtsMap.set(bareChannelId, full.fullChat.pts);
        }
      } catch (_) {}
    }
  }
}

/**
 * Master MTProto update handler for all incoming Telegram updates.
 * Dispatches UpdateNewChannelMessage, UpdateNewMessage, and UpdateChannelTooLong.
 */
async function handleTelegramUpdate(update) {
  try {
    if (!update) return;

    // Direct channel or private message
    if (update instanceof Api.UpdateNewChannelMessage || update instanceof Api.UpdateNewMessage) {
      const msg = update.message;
      if (!msg) return;
      const cId = msg.peerId?.channelId?.toString() || msg.peerId?.chatId?.toString();
      if (!cId) return;

      const bareId = toBareChannelId(cId);
      if (resolvedChannelIds.has(bareId) || resolvedChannelIds.has(cId)) {
        if (update.pts) {
          channelPtsMap.set(bareId, update.pts);
        }
        await enqueueIncomingMessage(bareId, msg);
      }
      return;
    }

    // UpdateChannelTooLong: Telegram notifies us that channel has an update gap or activity burst
    if (update instanceof Api.UpdateChannelTooLong) {
      const channelId = update.channelId?.toString();
      if (!channelId) return;
      const bareId = toBareChannelId(channelId);
      if (resolvedChannelIds.has(bareId) || resolvedChannelIds.has(channelId)) {
        console.log(`[MTProto] UpdateChannelTooLong for channel ${bareId} (pts: ${update.pts}). Recovering delta...`);
        let entity = dialogEntitiesMap.get(bareId) || dialogEntitiesMap.get('-100' + bareId);
        if (!entity) {
          try { entity = await client.getEntity(BigInt('-100' + bareId)); } catch {}
        }
        if (entity) {
          await syncChannelDifference(bareId, entity);
        }
      }
      return;
    }

    // Compound updates container (Updates or UpdatesCombined)
    if (update instanceof Api.Updates || update instanceof Api.UpdatesCombined) {
      for (const u of update.updates || []) {
        if (u instanceof Api.UpdateNewChannelMessage || u instanceof Api.UpdateNewMessage) {
          const msg = u.message;
          if (msg && msg.peerId?.channelId) {
            const bareId = toBareChannelId(msg.peerId.channelId.toString());
            if (resolvedChannelIds.has(bareId)) {
              if (u.pts) channelPtsMap.set(bareId, u.pts);
              await enqueueIncomingMessage(bareId, msg);
            }
          }
        } else if (u instanceof Api.UpdateChannelTooLong) {
          const bareId = toBareChannelId(u.channelId.toString());
          if (resolvedChannelIds.has(bareId)) {
            let entity = dialogEntitiesMap.get(bareId) || dialogEntitiesMap.get('-100' + bareId);
            if (entity) await syncChannelDifference(bareId, entity);
          }
        }
      }
      return;
    }

    // Short update wrapper
    if (update instanceof Api.UpdateShort) {
      if (update.update) {
        await handleTelegramUpdate(update.update);
      }
    }
  } catch (err) {
    console.error('[Telegram Dispatcher Error]', err.message);
  }
}

const CONTAINER_INSTANCE_ID = crypto.randomUUID();
let heartbeatInterval = null;

async function acquireTelegramLock() {
  const LOCK_KEY = 'telegram:active_listener';
  const LOCK_TTL_SEC = 25;

  while (true) {
    try {
      const acquired = await defaultRedis.set(LOCK_KEY, CONTAINER_INSTANCE_ID, 'EX', LOCK_TTL_SEC, 'NX');
      if (acquired === 'OK') {
        console.log(`[Telegram Lock] Acquired master Telegram listener lock (${CONTAINER_INSTANCE_ID.slice(0, 8)}).`);
        
        heartbeatInterval = setInterval(async () => {
          try {
            const current = await defaultRedis.get(LOCK_KEY);
            if (current === CONTAINER_INSTANCE_ID) {
              await defaultRedis.expire(LOCK_KEY, LOCK_TTL_SEC);
            }
          } catch (_) {}
        }, 8000);
        return;
      }

      const currentOwner = await defaultRedis.get(LOCK_KEY);
      console.log(`[Telegram Lock] Previous container (${currentOwner?.slice(0, 8) || 'unknown'}) is active. Waiting 5s for socket handover...`);
      await new Promise(r => setTimeout(r, 5000));
    } catch (lockErr) {
      console.warn('[Telegram Lock Warning] Redis lock check failed, proceeding cautiously:', lockErr.message);
      return;
    }
  }
}

async function releaseTelegramLock() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  try {
    const current = await defaultRedis.get('telegram:active_listener');
    if (current === CONTAINER_INSTANCE_ID) {
      await defaultRedis.del('telegram:active_listener');
      console.log('[Telegram Lock] Master listener lock released cleanly.');
    }
  } catch (_) {}
}

/**
 * Start GramJS client and bind listener
 */
export async function stopTelegramListener() {
  if (client) {
    try {
      console.log('[Telegram] Disconnecting Telegram client gracefully...');
      await client.disconnect();
      console.log('[Telegram] Client disconnected.');
    } catch (e) {
      console.warn('[Telegram] Disconnect error (ignored):', e.message);
    }
  }
  await releaseTelegramLock();
}

export async function startTelegramListener() {
  const { session, apiId, apiHash } = config.telegram;

  if (!apiId || !apiHash) {
    console.error('[Telegram Error] TELEGRAM_API_ID or TELEGRAM_API_HASH is not set in config.');
    return;
  }

  // Acquire distributed lock before connecting socket to prevent rolling-deploy collision
  await acquireTelegramLock();

  console.log('[Telegram] Initializing client...');
  const stringSession = new StringSession(session);

  let isAuthorized = false;
  const maxAttempts = 10;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (client) {
        try { await client.disconnect(); } catch (_) {}
      }
      client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
      });
      await client.connect();
      isAuthorized = await client.checkAuthorization();
      break;
    } catch (connErr) {
      const errStr = String(connErr?.message || connErr);
      const isAuthDuplicated = errStr.includes('AUTH_KEY_DUPLICATED') || connErr?.code === 406;
      if (isAuthDuplicated && attempt < maxAttempts) {
        console.warn(`[Telegram Warning] AUTH_KEY_DUPLICATED (previous container shutting down). Retrying connection in 6s (attempt ${attempt}/${maxAttempts})...`);
        await new Promise(r => setTimeout(r, 6000));
      } else {
        throw connErr;
      }
    }
  }

  if (!isAuthorized) {
    if (!process.stdin.isTTY || process.env.NODE_ENV === 'production') {
      console.warn('[Telegram Auth Warning] Telegram session is not authorized or expired. In non-interactive/production environment, skipping interactive login prompt to prevent process hang. Please update TELEGRAM_SESSION with a valid session string.');
      return;
    }
    // Login flow
    await client.start({
      phoneNumber: async () => await input.text('Enter your Telegram Phone Number (with country code): '),
      password: async () => await input.text('Enter your Telegram 2FA Password (if enabled): '),
      phoneCode: async () => await input.text('Enter the Telegram verification code received: '),
      onError: (err) => console.error('[Telegram Auth Error]', err.message),
    });
  }

  console.log('[Telegram] Authenticated successfully!');
  
  // Output session string
  const currentSession = client.session.save();
  console.log('\n=================== TELEGRAM SESSION STRING ===================');
  console.log('Copy & paste this updated session string into backend/.env as TELEGRAM_SESSION:');
  console.log(currentSession);
  console.log('===============================================================\n');

  // Pre-fetch all joined dialogs into GramJS entity cache
  await fetchJoinedDialogs();

  // Attach permanent MTProto event dispatcher
  if (!currentHandler) {
    currentHandler = handleTelegramUpdate;
    client.addEventHandler(currentHandler);
    console.log('[Telegram] Registered native MTProto update dispatcher.');
  }

  // Sync global update state baseline
  try {
    console.log('[Telegram] Syncing global update state (GetState)...');
    await client.invoke(new Api.updates.GetState());
    console.log('[Telegram] Global update state synced.');
  } catch (cuErr) {
    console.warn('[Telegram Warning] GetState() sync failed (non-fatal):', cuErr.message);
  }

  // Load active channels into lookup Set and initialize their PTS baselines
  await refreshMonitoredChannels();

  // Periodically refresh channel list from DB every 5 seconds (auto-detect Admin changes)
  setInterval(async () => {
    try {
      await refreshMonitoredChannels();
    } catch (err) {
      console.error('[Telegram Refresh Error] Failed to refresh channel list:', err.message);
    }
  }, 5 * 1000);

  // In accordance with Telegram MTProto spec, keep channel subscriptions active via delta sync
  startChannelKeepAliveSync();

  // Initial sync with active scrapers in Redis to determine dynamic queue concurrency
  await syncQueueConcurrencyWithScrapers();

  // Periodically refresh scraper concurrency every 20 seconds to dynamically scale with the scraper fleet
  setInterval(syncQueueConcurrencyWithScrapers, 20 * 1000);
}

/**
 * MTProto subscription keep-alive sync:
 * Periodically invokes updates.getChannelDifference for monitored channels to:
 * 1. Maintain active server-side socket push subscription on Telegram MTProto gateways.
 * 2. Instantly recover any updates missed during network reconnects or gap conditions.
 * Returns in ~20ms with ChannelDifferenceEmpty when there are no new messages.
 */
function startChannelKeepAliveSync() {
  const SYNC_INTERVAL_MS = 25 * 1000; // 25 seconds

  setInterval(async () => {
    if (!client || !client.connected) return;

    const channelIds = [...resolvedChannelIds].filter(id => /^\d+$/.test(id));
    if (channelIds.length === 0) return;

    for (const rawId of channelIds) {
      try {
        let entity = dialogEntitiesMap.get(rawId) || dialogEntitiesMap.get('-100' + rawId);
        if (!entity) {
          try { entity = await client.getEntity(BigInt('-100' + rawId)); } catch { continue; }
        }
        await syncChannelDifference(rawId, entity);
      } catch (err) {
        // non-fatal
      }
    }
  }, SYNC_INTERVAL_MS);

  console.log('[MTProto] Channel subscription keep-alive sync active (every 25s).');
}

/**
 * Pre-fetch all joined dialogs to cache GramJS entities & titles
 */
async function fetchJoinedDialogs() {
  try {
    console.log('[Telegram] Pre-fetching dialogs to populate entity cache...');
    const dialogs = await client.getDialogs({});
    dialogEntitiesMap.clear();

    for (const d of dialogs) {
      if (d.entity && d.entity.id) {
        const idStr = d.entity.id.toString();
        const rawId = idStr.replace('-100', '');
        const titleStr = d.entity.title || d.entity.username || '';

        dialogEntitiesMap.set(idStr, d.entity);
        dialogEntitiesMap.set(rawId, d.entity);
        dialogEntitiesMap.set('-100' + rawId, d.entity);

        if (titleStr) {
          channelTitlesMap.set(idStr, titleStr);
          channelTitlesMap.set(rawId, titleStr);
          channelTitlesMap.set('-100' + rawId, titleStr);
        }

        if (d.entity.username) {
          const u = d.entity.username.toLowerCase();
          dialogEntitiesMap.set(u, d.entity);
          dialogEntitiesMap.set('@' + u, d.entity);
          channelTitlesMap.set(u, titleStr);
          channelTitlesMap.set('@' + u, titleStr);
        }
      }
    }
    console.log(`[Telegram] Cached ${dialogEntitiesMap.size} GramJS dialog entities from joined chats.`);
  } catch (dErr) {
    console.warn('[Telegram Warning] Could not pre-fetch dialogs:', dErr.message);
  }
}

let lastActiveHash = '';

/**
 * Refresh the active monitored channels from DB and bind GramJS listener dynamically
 */
export async function refreshMonitoredChannels() {
  try {
    const activeChannels = await Channel.find({ isActive: true }).select('channelId username name isActive country').lean();
    
    // Hash current active state to detect any changes
    const currentHash = activeChannels.map(c => `${c._id}:${c.channelId}:${c.isActive}:${c.country}`).sort().join('|');
    if (currentHash === lastActiveHash) {
      return; // No changes in DB, skip
    }
    lastActiveHash = currentHash;

    if (activeChannels.length === 0) {
      console.warn('[Telegram Config] All monitored channels are currently disabled. Listener paused.');
      resolvedChannelIds.clear();
      return;
    }

    console.log(`[Telegram] Channel configuration updated! Refreshing lookup set for ${activeChannels.length} active channels...`);
    const newChannelIds = new Set();

    for (const channel of activeChannels) {
      let rawId = channel.channelId.replace('-100', '').replace('-', '');
      const chanName = channel.name || channel.username || rawId;

      newChannelIds.add(rawId);
      newChannelIds.add('-100' + rawId);
      newChannelIds.add(channel.channelId);

      channelTitlesMap.set(rawId, chanName);
      channelTitlesMap.set('-100' + rawId, chanName);
      channelTitlesMap.set(channel.channelId, chanName);

      const chanCountry = channel.country || 'IN';
      channelCountryMap.set(rawId, chanCountry);
      channelCountryMap.set('-100' + rawId, chanCountry);
      channelCountryMap.set(channel.channelId, chanCountry);

      const chanCategory = channel.category || 'auto';
      channelCategoryMap.set(rawId, chanCategory);
      channelCategoryMap.set('-100' + rawId, chanCategory);
      channelCategoryMap.set(channel.channelId, chanCategory);

      if (channel.username) {
        const cleanUsername = channel.username.replace('@', '').trim().toLowerCase();
        if (/^[a-zA-Z0-9_]{3,32}$/.test(cleanUsername)) {
          newChannelIds.add(cleanUsername);
          newChannelIds.add('@' + cleanUsername);
          channelTitlesMap.set(cleanUsername, chanName);
          channelTitlesMap.set('@' + cleanUsername, chanName);
          channelCountryMap.set(cleanUsername, chanCountry);
          channelCountryMap.set('@' + cleanUsername, chanCountry);
          channelCategoryMap.set(cleanUsername, chanCategory);
          channelCategoryMap.set('@' + cleanUsername, chanCategory);
        }
      }
    }

    resolvedChannelIds.clear();
    newChannelIds.forEach(id => resolvedChannelIds.add(id));
    
    console.log(`[Telegram Listener] Active for ${activeChannels.length} active channels (${resolvedChannelIds.size} lookup variations).`);

  } catch (err) {
    console.error('[Telegram DB Error] Failed to query monitored channels:', err.message);
  }
}

/**
 * Fetch joined dialogs from active Telegram client and sync ALL joined channels to DB
 */
export async function syncChannelsFromTelegram() {
  if (!client) throw new Error('Telegram client is not initialized');
  
  await fetchJoinedDialogs();
  const dialogs = await client.getDialogs({});
  
  let addedCount = 0;
  for (const dialog of dialogs) {
    const entity = dialog.entity;
    if ((dialog.isChannel || dialog.isGroup) && entity) {
      const title = entity.title || '';
      const username = entity.username || '';
      const channelId = entity.id.toString();
      const rawId = channelId.replace('-100', '');

      const existing = await Channel.findOne({ 
        $or: [
          { channelId: rawId },
          { channelId: '-100' + rawId },
          { channelId }
        ] 
      });

      if (!existing) {
        const newChan = new Channel({
          channelId: rawId,
          username: username ? `@${username}` : (title || 'Private Channel'),
          name: title || 'Unnamed Channel',
          isActive: false // Synced from Telegram as disabled by default
        });
        await newChan.save();
        addedCount++;
        console.log(`[Telegram Sync] Discovered joined channel/group: "${title}" (${username}) - Saved as disabled.`);
      }
    }
  }
  
  await refreshMonitoredChannels();
  return addedCount;
}

/**
 * Manually add a channel to monitor by handle or ID
 */
export async function addChannelToMonitor(target) {
  if (!client) throw new Error('Telegram client is not initialized');

  const cleanTarget = target.trim();
  let entity;

  try {
    entity = await client.getEntity(cleanTarget.replace('@', ''));
  } catch (err) {
    if (/^-?\d+$/.test(cleanTarget)) {
      const rawId = cleanTarget.replace('-100', '');
      entity = await client.getEntity(BigInt('-100' + rawId));
    } else {
      throw new Error(`Could not find channel "${cleanTarget}": ${err.message}`);
    }
  }

  if (!entity || !entity.id) {
    throw new Error(`Could not resolve Telegram entity for "${cleanTarget}"`);
  }

  const rawId = entity.id.toString().replace('-100', '');
  const username = entity.username ? `@${entity.username}` : (entity.title || cleanTarget);
  const name = entity.title || cleanTarget;

  let existing = await Channel.findOne({ 
    $or: [
      { channelId: rawId },
      { channelId: '-100' + rawId }
    ]
  });

  if (existing) {
    existing.isActive = true;
    if (name) existing.name = name;
    if (username) existing.username = username;
    await existing.save();
  } else {
    existing = new Channel({
      channelId: rawId,
      username,
      name,
      isActive: true
    });
    await existing.save();
  }

  await refreshMonitoredChannels();
  return existing;
}
