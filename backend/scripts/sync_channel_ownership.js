/**
 * Determines which monitored channels the Telegram account behind TELEGRAM_SESSION actually
 * owns (Telegram's `creator` flag on the dialog entity — true only for the channel's creator,
 * not just any admin), and writes that onto Channel.isOwner so the admin can separate "my own
 * broadcast channels" from third-party channels being scraped for deals.
 *
 * Re-derives from Telegram on every run and overwrites isOwner for every existing channel
 * (not just newly-found owned ones) so a transferred/left channel's flag also gets corrected.
 *
 * Usage:
 *   node scripts/sync_channel_ownership.js            # dry run — report only
 *   node scripts/sync_channel_ownership.js --execute   # actually writes
 */
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import mongoose from 'mongoose';
import config from '../src/config.js';
import Channel from '../src/db/models/channel.js';

const EXECUTE = process.argv.includes('--execute');

async function run() {
  const { apiId, apiHash, session } = config.telegram;
  if (!apiId || !apiHash || !session) {
    console.error('Missing TELEGRAM_API_ID / TELEGRAM_API_HASH / TELEGRAM_SESSION in .env');
    process.exit(1);
  }

  await mongoose.connect(config.mongodbUri);
  console.log(`[SyncOwnership] Connected to DB. Mode: ${EXECUTE ? 'EXECUTE (will write)' : 'DRY RUN (report only)'}\n`);

  const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 5 });
  await client.connect();
  console.log('[SyncOwnership] Connected to Telegram.\n');

  try {
    const dialogs = await client.getDialogs({});
    console.log(`Fetched ${dialogs.length} dialogs.\n`);

    // channelId -> { title, creator }
    const ownershipById = new Map();
    for (const dialog of dialogs) {
      const entity = dialog.entity;
      if (!dialog.isChannel || !entity) continue;
      ownershipById.set(entity.id.toString(), {
        title: entity.title || entity.username || '(untitled)',
        creator: !!entity.creator
      });
    }

    const monitored = await Channel.find({});
    console.log(`=== Monitored channels: ${monitored.length} ===\n`);

    const ownedTracked = [];
    const ownedNotTracked = [];
    const toFlip = [];

    for (const ch of monitored) {
      const info = ownershipById.get(ch.channelId);
      const isOwnerNow = !!info?.creator;
      if (isOwnerNow) ownedTracked.push({ name: ch.name, channelId: ch.channelId });
      if (isOwnerNow !== ch.isOwner) toFlip.push({ ch, from: !!ch.isOwner, to: isOwnerNow });
    }

    // Owned channels that exist on Telegram but were never added to monitored_channels at all.
    const trackedIds = new Set(monitored.map(c => c.channelId));
    for (const [channelId, info] of ownershipById.entries()) {
      if (info.creator && !trackedIds.has(channelId)) {
        ownedNotTracked.push({ title: info.title, channelId });
      }
    }

    console.log(`Owned channels found (creator=true), currently tracked: ${ownedTracked.length}`);
    ownedTracked.forEach(c => console.log(`  - ${c.name} (${c.channelId})`));

    if (ownedNotTracked.length > 0) {
      console.log(`\nOwned channels found on Telegram but NOT in monitored_channels (informational only, not added):`);
      ownedNotTracked.forEach(c => console.log(`  - ${c.title} (${c.channelId})`));
    }

    console.log(`\nChannels needing an isOwner flip: ${toFlip.length}`);
    toFlip.forEach(f => console.log(`  - ${f.ch.name} (${f.ch.channelId}): ${f.from} -> ${f.to}`));

    if (EXECUTE) {
      for (const f of toFlip) {
        await Channel.findByIdAndUpdate(f.ch._id, { isOwner: f.to });
      }
      console.log('\nDone — isOwner flags updated.');
    } else {
      console.log('\nDry run only — no writes made. Re-run with --execute to apply.');
    }
  } finally {
    await client.disconnect();
    await mongoose.disconnect();
  }
}

run().catch(err => {
  console.error('[SyncOwnership] Fatal error:', err);
  process.exit(1);
});
