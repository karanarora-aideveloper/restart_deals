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

// Sequential queue (Concurrency = 1) to prevent race conditions on duplicate checks
const queue = new PQueue({ concurrency: 1 });

export function getQueueLength() {
  return queue.size + queue.pending;
}

/**
 * Normalize any Telegram channel ID variant (bare "123", MTProto "-100123", or
 * bot-API "-123") to the bare digit-string form that Channel.channelId is stored
 * as in MongoDB (see addChannelToMonitor / syncChannelsFromTelegram). Anchored to
 * the start of the string — a bare, un-prefixed .replace('-100', '') would remove
 * ANY occurrence of that substring, not just a leading one, and previously left
 * Channel.updateOne() matching against a value that could never equal what's
 * actually stored, silently no-op'ing the metrics update whenever a caller passed
 * in an ID that was already -100-prefixed.
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

/**
 * Shared between the live GramJS event handler AND the polling fallback — tracks the highest
 * message ID already enqueued per channel (keyed by toBareChannelId()). Whichever path sees a
 * message first "claims" it here, so the other path's later look never re-enqueues the same
 * message. Before this was unified, the poller only tracked messages it had personally seen, so
 * a message the live handler had already processed a moment earlier still looked "new" to the
 * next poll tick — burning a full redirect-resolution pass and double-counting
 * messagesCapturedCount for that one message every time.
 */
const lastEnqueuedMessageId = new Map();

let currentHandler = null;

/**
 * Extract full message text including URLs hidden inside Telegram hyperlink entities.
 * Telegram admins often use "Buy Now" hyperlinks where the URL is in message.entities
 * as MessageEntityTextUrl, not visible in message.message plain text.
 *
 * @param {object} message - GramJS Message object
 * @returns {string} - Plain text + any hidden entity URLs appended
 */
function extractMessageText(message) {
  let text = message.message || '';

  if (message.entities && message.entities.length > 0) {
    const entityUrls = [];
    for (const entity of message.entities) {
      // MessageEntityTextUrl: text is a label, entity.url holds the actual link
      if (entity.className === 'MessageEntityTextUrl' && entity.url) {
        entityUrls.push(entity.url);
      }
      // MessageEntityUrl: the URL IS the text slice (already in plain text, but double-check)
      // These are already captured by the regex in extractUrls(), so no need to re-add.
    }

    if (entityUrls.length > 0) {
      const unique = [...new Set(entityUrls)];
      console.log(`[Entities] Found ${unique.length} hidden hyperlink URL(s) in message entities: ${unique.join(', ')}`);
      // Append hidden URLs to the text so extractUrls() in verifier.js picks them up
      text = text + '\n' + unique.join('\n');
    }
  }

  return text;
}

/**
 * Event handler for new messages across all monitored Telegram channels
 */
async function handleNewMessage(event) {
  try {
    const message = event.message;
    if (!message) return;

    // Collect all possible numeric ID and handle formats for the incoming message
    const possibleIds = new Set();

    if (event.chatId) {
      const cStr = event.chatId.toString();
      possibleIds.add(cStr);
      const raw = cStr.replace('-100', '').replace('-', '');
      possibleIds.add(raw);
      possibleIds.add('-100' + raw);
    }

    if (message.peerId) {
      if (message.peerId.channelId) {
        const cId = message.peerId.channelId.toString();
        possibleIds.add(cId);
        possibleIds.add('-100' + cId.replace('-100', ''));
      }
      if (message.peerId.chatId) {
        const cId = message.peerId.chatId.toString();
        possibleIds.add(cId);
        possibleIds.add('-100' + cId.replace('-100', ''));
      }
      if (message.peerId.userId) {
        const cId = message.peerId.userId.toString();
        possibleIds.add(cId);
      }
    }

    // Match against active monitored channels
    let matchedId = null;
    for (const id of possibleIds) {
      if (resolvedChannelIds.has(id)) {
        matchedId = id;
        break;
      }
    }

    if (!matchedId) return; // Message from a non-monitored channel — skip silently

    // Resolve human-readable channel title
    let channelName = channelTitlesMap.get(matchedId);
    if (!channelName) {
      try {
        const chat = event.chat || (await event.getChat());
        if (chat) {
          channelName = chat.title || chat.username || '';
          if (channelName) {
            for (const pid of possibleIds) {
              channelTitlesMap.set(pid, channelName);
            }
          }
        }
      } catch (e) {}
    }

    const displayName = channelName ? `"${channelName}"` : matchedId;
    const preview = message.message ? message.message.substring(0, 35).replace(/\n/g, ' ') : 'none';

    console.log(`[DEBUG] New message captured in [${displayName}] (ID: ${matchedId}) - Preview: ${preview}`);

    const channelId = matchedId;
    const messageId = message.id ? message.id.toString() : Date.now().toString();
    const channelKey = toBareChannelId(channelId);

    // Claim this message ID before doing anything else — if the poller already grabbed it
    // (or a duplicate GramJS update redelivered it), skip entirely rather than double-process.
    if (message.id != null) {
      const lastEnqueued = lastEnqueuedMessageId.get(channelKey) || 0;
      if (message.id <= lastEnqueued) {
        console.log(`[Queue] Message ${messageId} from channel ${displayName} was already enqueued (live/poller race). Skipping.`);
        return;
      }
      lastEnqueuedMessageId.set(channelKey, message.id);
    }

    // Extract text + any URLs hidden in hyperlink entities
    const messageText = extractMessageText(message);

    console.log(`[Queue] Received message ${messageId} from channel ${displayName} (${channelId}). Enqueueing...`);

    // Increment channel captured metrics in DB
    Channel.updateOne(
      { channelId: channelKey },
      { $inc: { messagesCapturedCount: 1 }, $set: { lastMessageAt: new Date() } }
    ).catch(() => {});

    const country = channelCountryMap.get(matchedId) || 'IN';
    const category = channelCategoryMap.get(matchedId) || 'auto';
    const sourceChannelName = channelTitlesMap.get(matchedId) || channelId;

    // Push the deal verification process to the sequential queue
    queue.add(async () => {
      try {
        // Lazy — only actually downloads if the verifier needs a fallback image
        const getTelegramPhotoUrl = () => downloadMessagePhoto(client, message);
        const deal = await verifyAndProcessMessage(channelId, messageId, messageText, country, sourceChannelName, getTelegramPhotoUrl, category);
        if (deal) {
          await publishToTelegram(client, deal);
          Channel.updateOne(
            { channelId: channelKey },
            { $inc: { dealsProducedCount: 1 }, $set: { lastDealAt: new Date() } }
          ).catch(() => {});
        }
      } catch (err) {
        console.error(`[Queue Error] Processing failed for message ${messageId}:`, err.message);
      }
    });
  } catch (err) {
    console.error('[Telegram Listener Error] Handler error:', err.message);
  }
}

/**
 * Start GramJS client and bind listener
 */
export async function startTelegramListener() {
  const { apiId, apiHash, session } = config.telegram;

  if (!apiId || !apiHash) {
    console.error('[Telegram Error] TELEGRAM_API_ID or TELEGRAM_API_HASH is not set in config.');
    return;
  }

  console.log('[Telegram] Initializing client...');
  const stringSession = new StringSession(session);
  
  client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  // Login flow
  await client.start({
    phoneNumber: async () => await input.text('Enter your Telegram Phone Number (with country code): '),
    password: async () => await input.text('Enter your Telegram 2FA Password (if enabled): '),
    phoneCode: async () => await input.text('Enter the Telegram verification code received: '),
    onError: (err) => console.error('[Telegram Auth Error]', err.message),
  });

  console.log('[Telegram] Authenticated successfully!');
  
  // Output session string
  const currentSession = client.session.save();
  console.log('\n=================== TELEGRAM SESSION STRING ===================');
  console.log('Copy & paste this updated session string into backend/.env as TELEGRAM_SESSION:');
  console.log(currentSession);
  console.log('===============================================================\n');

  // Pre-fetch all joined dialogs into GramJS entity cache
  await fetchJoinedDialogs();

  // Attach permanent GramJS listener ONCE
  if (!currentHandler) {
    currentHandler = handleNewMessage;
    client.addEventHandler(currentHandler, new NewMessage({}));
    console.log('[Telegram] Registered event listener for incoming messages.');
  }

  // CRITICAL: Sync GramJS channel PTS state so broadcast channel updates are received.
  // Without this, GramJS silently drops NewMessage events from channels.
  //
  // client.catchUp() is NOT usable for this — checked the installed `telegram` package source
  // directly (node_modules/telegram/client/updates.js): in this version (2.26.22) it's a literal
  // no-op stub —
  //   /** @hidden */
  //   function catchUp() { // TODO }
  // — explicitly marked @hidden, never wired onto TelegramClient.prototype at all (unlike
  // getDialogs/getMessages/etc., which ARE real prototype methods in this same file). That's why
  // it fails with "client.catchUp is not a function" rather than doing nothing silently — GramJS
  // never finished porting Telethon's catch_up() in this release. The client's own internal
  // update loop does call Api.updates.GetState() (updates.js, inside _updateLoop), but only as a
  // 30-MINUTE keepalive nudge to stop Telegram from cutting off updates on an idle connection —
  // it doesn't run at connect time and isn't a state-resync/gap-backfill step.
  //
  // Substitute: invoke Api.updates.GetState() directly, once, right after connecting. This
  // establishes a real PTS/qts/date/seq baseline (the actual first half of what catch_up does)
  // so incoming channel updates have a known state to validate against — it does NOT backfill any
  // gap since being offline (that needs GetDifference/GetChannelDifference, which this doesn't
  // attempt). Whether this alone meaningfully improves broadcast-channel live delivery isn't
  // something we could fully verify without an extended live-traffic observation window, so the
  // 30s poller stays exactly as-is as the guaranteed fallback — that poller exists independently
  // of this catchUp gap anyway (GramJS event push is documented as unreliable for large broadcast
  // channels regardless; see startChannelPoller() below), not solely because of it.
  try {
    console.log('[Telegram] Syncing update state (GetState)...');
    await client.invoke(new Api.updates.GetState());
    console.log('[Telegram] Update state synced — PTS baseline established.');
  } catch (cuErr) {
    console.warn('[Telegram Warning] GetState() sync failed (non-fatal):', cuErr.message);
  }

  // Load active channels into lookup Set
  await refreshMonitoredChannels();

  // Periodically refresh channel list from DB every 5 seconds (auto-detect Admin changes)
  setInterval(async () => {
    try {
      await refreshMonitoredChannels();
    } catch (err) {
      console.error('[Telegram Refresh Error] Failed to refresh channel list:', err.message);
    }
  }, 5 * 1000);

  // Polling fallback: GramJS does NOT reliably fire NewMessage for large broadcast channels
  // via MTProto push. We poll every 30s as a guaranteed fallback.
  startChannelPoller();
}

/**
 * Polling fallback for broadcast channels — GramJS event push is unreliable for
 * high-subscriber Telegram channels. This fetches the latest messages directly.
 */
function startChannelPoller() {
  const POLL_INTERVAL_MS = 30 * 1000; // 30 seconds

  setInterval(async () => {
    if (!client || !client.connected) return;

    // Get a snapshot of the currently active channel IDs (raw numeric, no -100)
    const channelIds = [...resolvedChannelIds].filter(id => /^\d+$/.test(id));
    if (channelIds.length === 0) return;

    for (const rawId of channelIds) {
      try {
        // Resolve GramJS entity — use cached entity or fetch fresh
        let entity = dialogEntitiesMap.get(rawId) || dialogEntitiesMap.get('-100' + rawId);
        if (!entity) {
          try { entity = await client.getEntity(BigInt('-100' + rawId)); } catch { continue; }
        }

        // Fetch the latest 10 messages from this channel
        const messages = await client.getMessages(entity, { limit: 10 });
        if (!messages || messages.length === 0) continue;

        const channelName = channelTitlesMap.get(rawId) || rawId;
        // Shared with the live handler — if it already claimed messages on this channel (the
        // common case, since live events arrive well before the next 30s tick), this reflects
        // that and the filter below correctly skips them instead of re-enqueueing.
        const lastSeen = lastEnqueuedMessageId.get(rawId) || 0;
        const newest = messages[0].id;

        // On first poll (and only if the live handler hasn't already claimed anything on this
        // channel), just record the baseline — don't process historical messages.
        if (lastSeen === 0) {
          lastEnqueuedMessageId.set(rawId, newest);
          console.log(`[Poller] Baseline set for "${channelName}" — last message ID: ${newest}`);
          continue;
        }

        // Filter only messages newer than last seen
        const newMessages = messages.filter(m => m.id > lastSeen && m.message);
        if (newMessages.length === 0) continue;

        console.log(`[Poller] Caught ${newMessages.length} new message(s) in "${channelName}" via polling.`);
        lastEnqueuedMessageId.set(rawId, newest);

        // Process each new message through the same queue pipeline
        for (const msg of newMessages.reverse()) { // oldest first
          const messageId = msg.id.toString();
          // Extract text + any URLs hidden in hyperlink entities
          const messageText = extractMessageText(msg);

          console.log(`[Poller→Queue] Enqueueing polled message ${messageId} from "${channelName}"`);

          Channel.updateOne(
            { channelId: toBareChannelId(rawId) },
            { $inc: { messagesCapturedCount: 1 }, $set: { lastMessageAt: new Date() } }
          ).catch(() => {});

          queue.add(async () => {
            try {
              const country = channelCountryMap.get(rawId) || 'IN';
              const category = channelCategoryMap.get(rawId) || 'auto';
              const sourceChannelName = channelTitlesMap.get(rawId) || rawId;
              // Lazy — only actually downloads if the verifier needs a fallback image
              const getTelegramPhotoUrl = () => downloadMessagePhoto(client, msg);
              const deal = await verifyAndProcessMessage(rawId, messageId, messageText, country, sourceChannelName, getTelegramPhotoUrl, category);
              if (deal) {
                await publishToTelegram(client, deal);
                Channel.updateOne(
                  { channelId: toBareChannelId(rawId) },
                  { $inc: { dealsProducedCount: 1 }, $set: { lastDealAt: new Date() } }
                ).catch(() => {});
              }
            } catch (err) {
              console.error(`[Poller Queue Error] Processing failed for message ${messageId}:`, err.message);
            }
          });
        }
      } catch (err) {
        // Non-fatal — just skip this channel this cycle
      }
    }
  }, POLL_INTERVAL_MS);

  console.log('[Poller] Channel polling fallback started (every 30s).');
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
