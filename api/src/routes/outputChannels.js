import express from 'express';
import OutputChannel from '../db/models/outputChannel.js';
import XAccount from '../db/models/xAccount.js';
import Lead from '../db/models/lead.js';

const router = express.Router();

/**
 * GET /api/output-channels
 * List all output channels with optional filter by platform, country, or search query.
 */
router.get('/', async (req, res) => {
  try {
    const query = {};

    if (req.query.platform && req.query.platform !== 'all') {
      query.platform = req.query.platform;
    }

    if (req.query.country && req.query.country !== 'all') {
      query.country = req.query.country;
    }

    if (req.query.category && req.query.category !== 'all') {
      query.category = req.query.category;
    }

    if (req.query.q) {
      const regex = new RegExp(req.query.q.trim(), 'i');
      query.$or = [{ name: regex }, { platform: regex }, { country: regex }];
    }

    const channels = await OutputChannel.find(query).sort({ createdAt: -1 });

    const total = await OutputChannel.countDocuments();
    const active = await OutputChannel.countDocuments({ isActive: true });
    
    // Breakdown by platform
    const platformAgg = await OutputChannel.aggregate([
      { $group: { _id: '$platform', count: { $sum: 1 }, activeCount: { $sum: { $cond: ['$isActive', 1, 0] } } } }
    ]);

    const stats = {
      total,
      active,
      telegramCount: platformAgg.find(p => p._id === 'telegram')?.count || 0,
      twitterCount: platformAgg.find(p => p._id === 'twitter')?.count || 0,
      whatsappCount: platformAgg.find(p => p._id === 'whatsapp')?.count || 0
    };

    res.json({
      success: true,
      channels,
      stats
    });
  } catch (err) {
    console.error('[API Error] GET /api/output-channels failed:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/output-channels
 * Create a new output channel configuration.
 */
router.post('/', async (req, res) => {
  try {
    const { name, platform, country, category, credentials, isActive, rateLimitMinutes } = req.body;

    if (!name || !platform) {
      return res.status(400).json({ success: false, error: 'Name and Platform are required.' });
    }

    const channel = new OutputChannel({
      name,
      platform,
      country: country || 'IN',
      category: category || 'all',
      isActive: isActive !== undefined ? isActive : true,
      rateLimitMinutes: rateLimitMinutes !== undefined && rateLimitMinutes !== '' ? Number(rateLimitMinutes) : null,
      credentials: credentials || {}
    });

    await channel.save();
    res.status(201).json({ success: true, channel });
  } catch (err) {
    console.error('[API Error] POST /api/output-channels failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/output-channels/:id
 * Toggle status or update fields of an output channel.
 */
router.patch('/:id', async (req, res) => {
  try {
    const { name, platform, country, category, isActive, credentials, rateLimitMinutes, resetStats } = req.body;
    const update = { updatedAt: new Date() };

    if (name !== undefined) update.name = name;
    if (platform !== undefined) update.platform = platform;
    if (country !== undefined) update.country = country;
    if (category !== undefined) update.category = category;
    if (isActive !== undefined) update.isActive = isActive;
    if (credentials !== undefined) update.credentials = credentials;
    if (rateLimitMinutes !== undefined) update.rateLimitMinutes = rateLimitMinutes === '' ? null : Number(rateLimitMinutes);
    // Corrects the counter when past "successful" sends never actually delivered (e.g. a
    // stuck WAHA session accepted the API call but WhatsApp silently dropped the message).
    if (resetStats === true) {
      update['stats.dealsPublished'] = 0;
      update['stats.lastPublishedAt'] = null;
    }

    const channel = await OutputChannel.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!channel) {
      return res.status(404).json({ success: false, error: 'Output channel not found' });
    }

    res.json({ success: true, channel });
  } catch (err) {
    console.error(`[API Error] PATCH /api/output-channels/${req.params.id} failed:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/output-channels/:id
 * Delete an output channel.
 */
router.delete('/:id', async (req, res) => {
  try {
    const channel = await OutputChannel.findByIdAndDelete(req.params.id);
    if (!channel) {
      return res.status(404).json({ success: false, error: 'Output channel not found' });
    }

    res.json({ success: true, message: 'Output channel deleted successfully' });
  } catch (err) {
    console.error(`[API Error] DELETE /api/output-channels/${req.params.id} failed:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/output-channels/:id/test
 * Send a test payload to the configured output channel.
 */
router.post('/:id/test', async (req, res) => {
  try {
    const channel = await OutputChannel.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ success: false, error: 'Output channel not found' });
    }

    const testDeal = {
      _id: 'test-deal-id',
      title: '🔥 Test Deal: Premium Wireless Earbuds',
      dealPrice: 999,
      originalPrice: 2999,
      discountPercentage: 67,
      rating: 4.5,
      dealUrl: 'https://www.amazon.in/dp/B00TEST123',
      imageUrl: 'https://m.media-amazon.com/images/I/51xnoYMnFSL.jpg',
      category: channel.category === 'all' ? 'general' : channel.category,
      country: channel.country === 'all' ? 'IN' : channel.country
    };

    // WhatsApp via WAHA is a plain HTTP call this service can make directly, so it's the one
    // platform this endpoint can genuinely test end-to-end (Telegram needs the daemon's live
    // GramJS client; Twitter/Meta/webhook aren't wired here yet — those stay simulated below).
    if (channel.platform === 'whatsapp' && channel.credentials?.provider === 'waha') {
      const { wahaBaseUrl, wahaApiKey, wahaSession, recipientPhoneNumber } = channel.credentials;
      const chatIdRaw = (recipientPhoneNumber || '').trim();
      const chatId = chatIdRaw.includes('@') ? chatIdRaw : `${chatIdRaw.replace(/[^\d]/g, '')}@c.us`;

      if (!wahaBaseUrl || !chatId) {
        return res.status(400).json({ success: false, error: 'WAHA channel is missing wahaBaseUrl or recipientPhoneNumber.' });
      }

      try {
        const text = `*${testDeal.title}*\n\n💰 *Price:* ₹${testDeal.dealPrice} ~₹${testDeal.originalPrice}~ *${testDeal.discountPercentage}% OFF*\n🛒 *Buy Now:* ${testDeal.dealUrl}\n\n_Test post from ShoppersDeals Admin_`;
        const baseUrl = wahaBaseUrl.replace(/\/+$/, '');
        const session = wahaSession || 'default';
        const headers = {
          'Content-Type': 'application/json',
          ...(wahaApiKey ? { 'X-Api-Key': wahaApiKey } : {})
        };

        // Same human-like typing pause the real publisher uses (see whatsappPublisher.js) —
        // keeps Test Post representative of what a live deal send actually looks like.
        try {
          await fetch(`${baseUrl}/api/${session}/presence`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ chatId, presence: 'typing' })
          });
          await new Promise((resolve) => setTimeout(resolve, Math.min(4000, Math.max(1200, text.length * 30))));
        } catch (_typingErr) {
          // Presence is cosmetic — never let it block the actual test send.
        }

        const wahaRes = await fetch(`${baseUrl}/api/sendText`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ session, chatId, text })
        });

        if (!wahaRes.ok) {
          const errBody = await wahaRes.text();
          return res.status(502).json({ success: false, error: `WAHA responded ${wahaRes.status}: ${errBody}` });
        }

        return res.json({
          success: true,
          message: `Test message actually sent via WAHA to ${chatId} for "${channel.name}".`,
          testPayload: testDeal
        });
      } catch (err) {
        return res.status(502).json({ success: false, error: `Could not reach WAHA at ${wahaBaseUrl}: ${err.message}` });
      }
    }

    // X/Twitter — OAuth 1.0a (API Key/Secret + Access Token/Secret) still works for both
    // POST /2/tweets and the classic v1.1-style media/upload.json (see twitterPublisher.js
    // for why the newer split /2/media/upload/{initialize,append,finalize} path is avoided —
    // it 401s under OAuth 1.0a). A real test post here is billed by X like any other post:
    // ~$0.20 since it contains a link, ~$0.015 if it didn't.
    if (channel.platform === 'twitter') {
      // credentials.xAccountId (managed via /network/connections) is the current path; direct
      // inline credentials on the channel are a fallback for rows saved before XAccount existed.
      let oauth1 = channel.credentials || {};
      if (channel.credentials?.xAccountId) {
        const account = await XAccount.findById(channel.credentials.xAccountId);
        if (!account) {
          return res.status(400).json({ success: false, error: 'This channel points at an X account that no longer exists. Repoint it from the Output Channel form.' });
        }
        oauth1 = account.oauth1 || {};
      }
      const { apiKey, apiSecret, accessToken, accessSecret } = oauth1;
      if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
        return res.status(400).json({ success: false, error: 'X/Twitter channel is missing one or more OAuth 1.0a credentials (API Key, API Secret, Access Token, Access Token Secret).' });
      }

      try {
        const { TwitterApi } = await import('twitter-api-v2');
        const twitterClient = new TwitterApi({ appKey: apiKey, appSecret: apiSecret, accessToken, accessSecret });
        const text = `Test Deal: Premium Wireless Earbuds\n\nPrice: Rs999 (67% OFF)\nBuy: ${testDeal.dealUrl}\n\nTest post from ShoppersDeals Admin`;

        let mediaId = null;
        try {
          const imgRes = await fetch(testDeal.imageUrl);
          if (imgRes.ok) {
            const buffer = Buffer.from(await imgRes.arrayBuffer());
            mediaId = await twitterClient.v1.uploadMedia(buffer, { mimeType: imgRes.headers.get('content-type') || 'image/jpeg' });
          }
        } catch (_imgErr) {
          // Non-fatal — falls back to a text-only test post.
        }

        const tweet = await twitterClient.v2.tweet(mediaId ? { text, media: { media_ids: [mediaId] } } : text);

        return res.json({
          success: true,
          message: `Test post actually published to X for "${channel.name}" (post id ${tweet.data.id}). Billed ~$0.20 by X's pay-per-use pricing since it contains a link.`,
          testPayload: testDeal
        });
      } catch (err) {
        return res.status(502).json({ success: false, error: `X API call failed: ${err.message}` });
      }
    }

    res.json({
      success: true,
      message: `Test post triggered for "${channel.name}" (${channel.platform.toUpperCase()}).`,
      testPayload: testDeal
    });
  } catch (err) {
    console.error(`[API Error] POST /api/output-channels/${req.params.id}/test failed:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * WAHA session management — lets the admin fully manage a WhatsApp connection (login via QR,
 * status, stop, logout) without ever leaving the ShoppersDeals admin. Every route here just
 * proxies to the channel's own WAHA instance so the API key never has to leave the server and
 * the admin frontend doesn't need CORS access to WAHA directly.
 * See https://waha.devlike.pro/docs/how-to/sessions/
 */
function getWahaConfig(channel) {
  if (channel.platform !== 'whatsapp' || channel.credentials?.provider !== 'waha') return null;
  const { wahaBaseUrl, wahaApiKey, wahaSession } = channel.credentials;
  if (!wahaBaseUrl) return null;
  return {
    baseUrl: wahaBaseUrl.replace(/\/+$/, ''),
    apiKey: wahaApiKey || '',
    session: wahaSession || 'default'
  };
}

async function wahaFetch(waha, path, options = {}) {
  const res = await fetch(`${waha.baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(waha.apiKey ? { 'X-Api-Key': waha.apiKey } : {}),
      ...(options.headers || {})
    }
  });
  return res;
}

async function loadWahaChannelOr404(req, res) {
  const channel = await OutputChannel.findById(req.params.id);
  if (!channel) {
    res.status(404).json({ success: false, error: 'Output channel not found' });
    return null;
  }
  const waha = getWahaConfig(channel);
  if (!waha) {
    res.status(400).json({ success: false, error: 'This channel is not a WAHA-backed WhatsApp channel, or is missing its WAHA Base URL.' });
    return null;
  }
  return { channel, waha };
}

/**
 * GET /api/output-channels/:id/waha/status
 * Current session status (STOPPED / STARTING / SCAN_QR_CODE / WORKING / FAILED / ...).
 */
router.get('/:id/waha/status', async (req, res) => {
  try {
    const ctx = await loadWahaChannelOr404(req, res);
    if (!ctx) return;
    const { waha } = ctx;

    const wahaRes = await wahaFetch(waha, `/api/sessions/${encodeURIComponent(waha.session)}`);
    if (wahaRes.status === 404) {
      return res.json({ success: true, status: 'STOPPED', me: null });
    }
    if (!wahaRes.ok) {
      const body = await wahaRes.text();
      return res.status(502).json({ success: false, error: `WAHA responded ${wahaRes.status}: ${body}` });
    }
    const data = await wahaRes.json();
    res.json({ success: true, status: data.status, me: data.me || null });
  } catch (err) {
    console.error(`[API Error] GET /api/output-channels/${req.params.id}/waha/status failed:`, err.message);
    res.status(502).json({ success: false, error: `Could not reach WAHA: ${err.message}` });
  }
});

/**
 * POST /api/output-channels/:id/waha/start
 * Idempotent: starts the session if it exists and is stopped, or creates it if it never existed.
 */
router.post('/:id/waha/start', async (req, res) => {
  try {
    const ctx = await loadWahaChannelOr404(req, res);
    if (!ctx) return;
    const { waha } = ctx;

    let wahaRes = await wahaFetch(waha, `/api/sessions/${encodeURIComponent(waha.session)}/start`, { method: 'POST' });

    if (wahaRes.status === 404) {
      // Session has never been created on this WAHA instance yet.
      wahaRes = await wahaFetch(waha, '/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ name: waha.session, start: true, config: {} })
      });
    }

    if (!wahaRes.ok) {
      const body = await wahaRes.text();
      return res.status(502).json({ success: false, error: `WAHA responded ${wahaRes.status}: ${body}` });
    }

    const data = await wahaRes.json();
    res.json({ success: true, status: data.status, me: data.me || null });
  } catch (err) {
    console.error(`[API Error] POST /api/output-channels/${req.params.id}/waha/start failed:`, err.message);
    res.status(502).json({ success: false, error: `Could not reach WAHA: ${err.message}` });
  }
});

/**
 * GET /api/output-channels/:id/waha/qr
 * Base64 QR code to scan with WhatsApp (Linked Devices -> Link a Device). Only meaningful
 * while status is SCAN_QR_CODE — WAHA rotates the QR periodically, so the admin polls this.
 */
router.get('/:id/waha/qr', async (req, res) => {
  try {
    const ctx = await loadWahaChannelOr404(req, res);
    if (!ctx) return;
    const { waha } = ctx;

    const wahaRes = await wahaFetch(waha, `/api/${encodeURIComponent(waha.session)}/auth/qr`, {
      headers: { Accept: 'application/json' }
    });

    if (!wahaRes.ok) {
      const body = await wahaRes.text();
      return res.status(502).json({ success: false, error: `WAHA responded ${wahaRes.status}: ${body}` });
    }

    const data = await wahaRes.json();
    res.json({ success: true, mimetype: data.mimetype || 'image/png', data: data.data });
  } catch (err) {
    console.error(`[API Error] GET /api/output-channels/${req.params.id}/waha/qr failed:`, err.message);
    res.status(502).json({ success: false, error: `Could not reach WAHA: ${err.message}` });
  }
});

/**
 * POST /api/output-channels/:id/waha/stop
 * Halts the session without dropping its login — resuming later skips the QR scan.
 */
router.post('/:id/waha/stop', async (req, res) => {
  try {
    const ctx = await loadWahaChannelOr404(req, res);
    if (!ctx) return;
    const { waha } = ctx;

    const wahaRes = await wahaFetch(waha, `/api/sessions/${encodeURIComponent(waha.session)}/stop`, { method: 'POST' });
    if (!wahaRes.ok) {
      const body = await wahaRes.text();
      return res.status(502).json({ success: false, error: `WAHA responded ${wahaRes.status}: ${body}` });
    }
    res.json({ success: true, status: 'STOPPED' });
  } catch (err) {
    console.error(`[API Error] POST /api/output-channels/${req.params.id}/waha/stop failed:`, err.message);
    res.status(502).json({ success: false, error: `Could not reach WAHA: ${err.message}` });
  }
});

/**
 * POST /api/output-channels/:id/waha/logout
 * Drops the linked-device pairing entirely — next start will require a fresh QR scan.
 */
router.post('/:id/waha/logout', async (req, res) => {
  try {
    const ctx = await loadWahaChannelOr404(req, res);
    if (!ctx) return;
    const { waha } = ctx;

    const wahaRes = await wahaFetch(waha, `/api/sessions/${encodeURIComponent(waha.session)}/logout`, { method: 'POST' });
    if (!wahaRes.ok) {
      const body = await wahaRes.text();
      return res.status(502).json({ success: false, error: `WAHA responded ${wahaRes.status}: ${body}` });
    }
    res.json({ success: true, status: 'SCAN_QR_CODE' });
  } catch (err) {
    console.error(`[API Error] POST /api/output-channels/${req.params.id}/waha/logout failed:`, err.message);
    res.status(502).json({ success: false, error: `Could not reach WAHA: ${err.message}` });
  }
});

/**
 * WAHA group browsing + lead import — lets the admin see every group the connected WhatsApp
 * account is in, which ones it administers, and pull participant phone numbers into the `Lead`
 * collection (Audience > Leads) as potential customers, tagged with the group they came from.
 * See https://waha.devlike.pro/docs/how-to/groups/
 */

// WAHA ids show up either as a plain "919999999999@c.us" string or (in the WEBJS engine's
// inline group-list payload) as a rich {server, user, _serialized} object — normalize both.
function idString(id) {
  if (!id) return '';
  return typeof id === 'string' ? id : (id._serialized || '');
}

// Strip the "@c.us"/"@lid" suffix. WhatsApp's privacy mode hides some participants' real number
// behind an opaque "@lid" identifier with no phone number attached at all — that numeric part is
// NOT a phone number and must never be treated as one (see isHiddenId below).
function bareId(id) {
  return idString(id).split('@')[0];
}

function isHiddenId(id) {
  return idString(id).endsWith('@lid');
}

/**
 * GET /api/output-channels/:id/waha/groups
 * Every group the session is in, with an `isAdmin` flag for whether the connected account
 * itself administers that group. Participant data comes back inline with the group list
 * (nested under groupMetadata for the WEBJS engine), so this is a single WAHA call — no N+1
 * even with a large (100s of groups) account.
 */
router.get('/:id/waha/groups', async (req, res) => {
  try {
    const ctx = await loadWahaChannelOr404(req, res);
    if (!ctx) return;
    const { waha } = ctx;

    const meRes = await wahaFetch(waha, `/api/sessions/${encodeURIComponent(waha.session)}`);
    const meData = meRes.ok ? await meRes.json() : null;
    const myId = idString(meData?.me?.id);

    const groupsRes = await wahaFetch(waha, `/api/${encodeURIComponent(waha.session)}/groups`);
    if (!groupsRes.ok) {
      const body = await groupsRes.text();
      return res.status(502).json({ success: false, error: `WAHA responded ${groupsRes.status}: ${body}` });
    }
    const groups = await groupsRes.json();

    const shaped = (Array.isArray(groups) ? groups : []).map(g => {
      // WEBJS nests the real metadata under groupMetadata; fall back to top-level for other engines.
      const meta = g.groupMetadata || g;
      const participants = meta.participants || [];
      const mine = participants.find(p => idString(p.id) === myId);
      const isAdmin = mine ? !!(mine.isAdmin || mine.isSuperAdmin || mine.role === 'admin' || mine.role === 'superadmin') : false;
      return {
        id: idString(meta.id) || idString(g.id),
        subject: meta.subject || meta.name || '(untitled group)',
        participantCount: participants.length || null,
        isAdmin
      };
    });

    res.json({ success: true, groups: shaped, me: myId });
  } catch (err) {
    console.error(`[API Error] GET /api/output-channels/${req.params.id}/waha/groups failed:`, err.message);
    res.status(502).json({ success: false, error: `Could not reach WAHA: ${err.message}` });
  }
});

/**
 * GET /api/output-channels/:id/waha/groups/:groupId/participants
 * Participant list for one group — bare phone number, role, and whether the number is hidden
 * (WhatsApp's "@lid" privacy identifiers give no real phone number — those are marked `hidden`
 * and MUST NOT be imported as a phone number).
 */
router.get('/:id/waha/groups/:groupId/participants', async (req, res) => {
  try {
    const ctx = await loadWahaChannelOr404(req, res);
    if (!ctx) return;
    const { waha } = ctx;

    const partRes = await wahaFetch(
      waha,
      `/api/${encodeURIComponent(waha.session)}/groups/${encodeURIComponent(req.params.groupId)}/participants/v2`
    );
    if (!partRes.ok) {
      const body = await partRes.text();
      return res.status(502).json({ success: false, error: `WAHA responded ${partRes.status}: ${body}` });
    }
    const participants = await partRes.json();

    const shaped = (Array.isArray(participants) ? participants : []).map(p => {
      // `pn` (phone number id) is the reliable field when WhatsApp's privacy mode is active;
      // fall back to `id` only when it isn't a "@lid" opaque identifier.
      const numberSource = p.pn || (!isHiddenId(p.id) ? p.id : null);
      return {
        id: idString(p.id),
        phoneNumber: numberSource ? bareId(numberSource) : null,
        hidden: !numberSource,
        role: p.role || (p.isSuperAdmin ? 'superadmin' : p.isAdmin ? 'admin' : 'participant')
      };
    });

    res.json({ success: true, participants: shaped });
  } catch (err) {
    console.error(`[API Error] GET /api/output-channels/${req.params.id}/waha/groups/${req.params.groupId}/participants failed:`, err.message);
    res.status(502).json({ success: false, error: `Could not reach WAHA: ${err.message}` });
  }
});

// Run `items` through `worker` with at most `size` in flight at once — avoids hammering the
// single WAHA/Chromium instance with hundreds of simultaneous requests (a large group can have
// 1000+ members; this is also why name lookup below is opt-in and capped, not automatic).
async function mapWithConcurrency(items, size, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
  return results;
}

/**
 * POST /api/output-channels/:id/waha/groups/:groupId/participant-names
 * Body: { ids: string[] }  (WAHA ids, e.g. "919999999999@c.us" — NOT phone numbers)
 * Opt-in, scoped to a set of ids the admin explicitly chose to look up (the participants of one
 * group they opened) — never an account-wide bulk pull, which is what filled the disk last time.
 * Hard-capped server-side regardless of what's requested.
 */
router.post('/:id/waha/groups/:groupId/participant-names', async (req, res) => {
  try {
    const ctx = await loadWahaChannelOr404(req, res);
    if (!ctx) return;
    const { waha } = ctx;

    const ids = Array.isArray(req.body.ids) ? req.body.ids.slice(0, 500) : [];
    if (ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids must be a non-empty array.' });
    }

    const names = {};
    await mapWithConcurrency(ids, 5, async (id) => {
      try {
        const cRes = await wahaFetch(waha, `/api/contacts?session=${encodeURIComponent(waha.session)}&contactId=${encodeURIComponent(id)}`);
        if (!cRes.ok) return;
        const c = await cRes.json();
        const name = c.name || c.pushname || c.shortName || '';
        if (name || c.isMyContact || c.isBusiness) {
          names[id] = { name, isMyContact: !!c.isMyContact, isBusiness: !!c.isBusiness };
        }
      } catch {
        // A single failed lookup shouldn't fail the whole batch — that id just stays unnamed.
      }
    });

    res.json({ success: true, names });
  } catch (err) {
    console.error(`[API Error] POST /api/output-channels/${req.params.id}/waha/groups/${req.params.groupId}/participant-names failed:`, err.message);
    res.status(502).json({ success: false, error: `Could not reach WAHA: ${err.message}` });
  }
});

/**
 * POST /api/output-channels/:id/waha/groups/:groupId/import-leads
 * Body: { groupName: string, phoneNumbers: [{ phoneNumber, role, name?, isMyContact?, isBusiness? }] }
 * One Lead per phone number globally — if this number is already a Lead (from a previous import,
 * possibly from a DIFFERENT group), this MERGES into that same document (adds this group to
 * sourceGroups, adds this group's name to tags) instead of creating a duplicate row.
 */
router.post('/:id/waha/groups/:groupId/import-leads', async (req, res) => {
  try {
    const ctx = await loadWahaChannelOr404(req, res);
    if (!ctx) return;

    const { groupName, phoneNumbers } = req.body;
    if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return res.status(400).json({ success: false, error: 'phoneNumbers must be a non-empty array.' });
    }

    // Participants WhatsApp reports as privacy-hidden (@lid, no real number) have no usable
    // phoneNumber — never write those into Lead as if they were one.
    const importable = phoneNumbers.filter(p => p.phoneNumber);
    const skippedHidden = phoneNumbers.length - importable.length;

    let imported = 0;
    let updated = 0;
    for (const p of importable) {
      const existing = await Lead.findOne({ phoneNumber: p.phoneNumber });
      const thisGroup = { groupId: req.params.groupId, groupName: groupName || '', role: p.role || 'participant' };

      if (existing) {
        // Same phone seen in another group before — merge in, don't duplicate.
        const alreadyHasGroup = existing.sourceGroups.some(g => g.groupId === thisGroup.groupId);
        if (!alreadyHasGroup) existing.sourceGroups.push(thisGroup);
        else existing.sourceGroups = existing.sourceGroups.map(g => (g.groupId === thisGroup.groupId ? thisGroup : g));

        const tagSet = new Set(existing.tags || []);
        if (thisGroup.groupName) tagSet.add(thisGroup.groupName);
        existing.tags = Array.from(tagSet);

        if (p.name && !existing.name) existing.name = p.name;
        if (p.isMyContact) existing.isMyContact = true;
        if (p.isBusiness) existing.isBusiness = true;
        existing.updatedAt = new Date();
        await existing.save();
        updated++;
      } else {
        await Lead.create({
          phoneNumber: p.phoneNumber,
          name: p.name || '',
          isMyContact: !!p.isMyContact,
          isBusiness: !!p.isBusiness,
          sourceGroups: [thisGroup],
          tags: thisGroup.groupName ? [thisGroup.groupName] : [],
          status: 'new'
        });
        imported++;
      }
    }

    res.json({ success: true, imported, updated, skippedHidden, total: phoneNumbers.length });
  } catch (err) {
    console.error(`[API Error] POST /api/output-channels/${req.params.id}/waha/groups/${req.params.groupId}/import-leads failed:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Broader WAHA management — profile, chats, contacts, a manual message composer, and a debug
 * screenshot, so the connected WhatsApp account can be fully managed from this admin without
 * ever opening WAHA's own dashboard. Every list endpoint here is always called with a bounded
 * `limit` server-side — an unbounded account-wide pull is exactly what filled the host disk
 * once already (see GroupsBrowser / participant-names above for the same reasoning).
 */

/**
 * GET /api/output-channels/:id/waha/profile
 * The connected account's own name/number/picture.
 */
router.get('/:id/waha/profile', async (req, res) => {
  try {
    const ctx = await loadWahaChannelOr404(req, res);
    if (!ctx) return;
    const { waha } = ctx;

    const profRes = await wahaFetch(waha, `/api/${encodeURIComponent(waha.session)}/profile`);
    if (!profRes.ok) {
      const body = await profRes.text();
      return res.status(502).json({ success: false, error: `WAHA responded ${profRes.status}: ${body}` });
    }
    const profile = await profRes.json();

    const verRes = await wahaFetch(waha, '/api/version');
    const version = verRes.ok ? await verRes.json() : null;

    res.json({ success: true, profile, version });
  } catch (err) {
    console.error(`[API Error] GET /api/output-channels/${req.params.id}/waha/profile failed:`, err.message);
    res.status(502).json({ success: false, error: `Could not reach WAHA: ${err.message}` });
  }
});

/**
 * GET /api/output-channels/:id/waha/chats?limit=&offset=
 * Recent chats (both direct and group), newest activity first. `limit` is capped at 100
 * regardless of what's requested.
 */
router.get('/:id/waha/chats', async (req, res) => {
  try {
    const ctx = await loadWahaChannelOr404(req, res);
    if (!ctx) return;
    const { waha } = ctx;

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    // WAHA's real validation accepts conversationTimestamp/id/name — not "messageTimestamp" as
    // some docs suggest.
    const params = new URLSearchParams({ limit, offset, sortBy: 'conversationTimestamp', sortOrder: 'desc' });
    const chatsRes = await wahaFetch(waha, `/api/${encodeURIComponent(waha.session)}/chats?${params.toString()}`);
    if (!chatsRes.ok) {
      const body = await chatsRes.text();
      return res.status(502).json({ success: false, error: `WAHA responded ${chatsRes.status}: ${body}` });
    }
    const chats = await chatsRes.json();

    const shaped = (Array.isArray(chats) ? chats : []).map(c => ({
      id: idString(c.id),
      name: c.name || bareId(c.id),
      isGroup: idString(c.id).endsWith('@g.us'),
      lastMessage: c.lastMessage ? { body: c.lastMessage.body, timestamp: c.lastMessage.timestamp, fromMe: c.lastMessage.fromMe } : null
    }));

    res.json({ success: true, chats: shaped, limit, offset });
  } catch (err) {
    console.error(`[API Error] GET /api/output-channels/${req.params.id}/waha/chats failed:`, err.message);
    res.status(502).json({ success: false, error: `Could not reach WAHA: ${err.message}` });
  }
});

/**
 * GET /api/output-channels/:id/waha/contacts?limit=&offset=&q=
 * Paginated contact browser — deliberately NEVER an unbounded "all contacts" pull (`limit` is
 * capped at 200). `q` filters only within the page that comes back, not server-side across the
 * whole account, to keep every call cheap and bounded.
 */
router.get('/:id/waha/contacts', async (req, res) => {
  try {
    const ctx = await loadWahaChannelOr404(req, res);
    if (!ctx) return;
    const { waha } = ctx;

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;

    const params = new URLSearchParams({ session: waha.session, limit, offset, sortBy: 'name', sortOrder: 'asc' });
    const cRes = await wahaFetch(waha, `/api/contacts/all?${params.toString()}`);
    if (!cRes.ok) {
      const body = await cRes.text();
      return res.status(502).json({ success: false, error: `WAHA responded ${cRes.status}: ${body}` });
    }
    let contacts = await cRes.json();
    contacts = Array.isArray(contacts) ? contacts : [];

    const q = (req.query.q || '').trim().toLowerCase();
    if (q) {
      contacts = contacts.filter(c =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.pushname || '').toLowerCase().includes(q) ||
        bareId(c.id).includes(q)
      );
    }

    const seen = new Set();
    const shaped = [];
    for (const c of contacts) {
      if (c.isGroup || c.isMe) continue;
      const id = idString(c.id);
      if (seen.has(id)) continue; // WAHA can return the same contact twice (lid + phone entries)
      seen.add(id);
      shaped.push({
        id,
        phoneNumber: bareId(c.id),
        name: c.name || c.pushname || c.shortName || '',
        isMyContact: !!c.isMyContact,
        isBusiness: !!c.isBusiness
      });
    }

    res.json({ success: true, contacts: shaped, limit, offset });
  } catch (err) {
    console.error(`[API Error] GET /api/output-channels/${req.params.id}/waha/contacts failed:`, err.message);
    res.status(502).json({ success: false, error: `Could not reach WAHA: ${err.message}` });
  }
});

/**
 * POST /api/output-channels/:id/waha/send-text
 * Body: { chatId, text }
 * A generic manual composer — separate from the deal-publishing path in whatsappPublisher.js.
 * This only ever fires when the admin explicitly clicks Send on a message they typed themselves.
 */
router.post('/:id/waha/send-text', async (req, res) => {
  try {
    const ctx = await loadWahaChannelOr404(req, res);
    if (!ctx) return;
    const { waha } = ctx;

    const { chatId, text } = req.body;
    if (!chatId || !text) {
      return res.status(400).json({ success: false, error: 'chatId and text are required.' });
    }
    const targetChatId = chatId.includes('@') ? chatId : `${chatId.replace(/[^\d]/g, '')}@c.us`;

    const sendRes = await wahaFetch(waha, '/api/sendText', {
      method: 'POST',
      body: JSON.stringify({ session: waha.session, chatId: targetChatId, text })
    });
    if (!sendRes.ok) {
      const body = await sendRes.text();
      return res.status(502).json({ success: false, error: `WAHA responded ${sendRes.status}: ${body}` });
    }

    res.json({ success: true, message: `Sent to ${targetChatId}.` });
  } catch (err) {
    console.error(`[API Error] POST /api/output-channels/${req.params.id}/waha/send-text failed:`, err.message);
    res.status(502).json({ success: false, error: `Could not reach WAHA: ${err.message}` });
  }
});

/**
 * GET /api/output-channels/:id/waha/screenshot
 * Base64 screenshot of the live WhatsApp Web session — debug aid for a session stuck in an
 * unexpected state.
 */
router.get('/:id/waha/screenshot', async (req, res) => {
  try {
    const ctx = await loadWahaChannelOr404(req, res);
    if (!ctx) return;
    const { waha } = ctx;

    const shotRes = await wahaFetch(waha, `/api/screenshot?session=${encodeURIComponent(waha.session)}`, {
      headers: { Accept: 'application/json' }
    });
    if (!shotRes.ok) {
      const body = await shotRes.text();
      return res.status(502).json({ success: false, error: `WAHA responded ${shotRes.status}: ${body}` });
    }
    const data = await shotRes.json();
    res.json({ success: true, mimetype: data.mimetype || 'image/png', data: data.data });
  } catch (err) {
    console.error(`[API Error] GET /api/output-channels/${req.params.id}/waha/screenshot failed:`, err.message);
    res.status(502).json({ success: false, error: `Could not reach WAHA: ${err.message}` });
  }
});

export default router;
