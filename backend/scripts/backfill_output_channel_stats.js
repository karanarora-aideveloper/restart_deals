/**
 * Backfills OutputChannel.stats.dealsPublished / lastPublishedAt with real historical counts.
 *
 * Why this is needed: before any row existed in `output_channels`, publisher.js used a
 * hardcoded .env fallback (`fallbackDoc._id: null`) to send every deal to Telegram. The
 * stats-increment call after a successful send was `OutputChannel.findByIdAndUpdate(channelDoc._id, ...)`
 * — with `_id: null` that matches nothing, so every deal sent via the fallback path was a
 * silent no-op for stats. Net effect: newly-created channels show "Deals Sent: 0" in the
 * admin even though hundreds of deals have actually already gone out to that same Telegram
 * channel username.
 *
 * This script re-derives the true historical count per Telegram channel from Deal.publishedStatus.telegram,
 * replicating the exact routing the old fallback used (dealCategory === 'fitness' -> fitness channel,
 * everything else -> the 'all'-category channel), and writes it into stats.dealsPublished so the
 * admin's Output Destinations table reflects reality. Safe to re-run: it's idempotent, always
 * recomputes fresh counts rather than incrementing.
 *
 * Usage:
 *   node scripts/backfill_output_channel_stats.js            # dry run — report only
 *   node scripts/backfill_output_channel_stats.js --execute   # actually writes
 */
import mongoose from 'mongoose';
import config from '../src/config.js';
import Deal from '../src/db/models/deal.js';
import OutputChannel from '../src/db/models/outputChannel.js';

const EXECUTE = process.argv.includes('--execute');

async function run() {
  await mongoose.connect(config.mongodbUri);
  console.log(`[BackfillStats] Connected. Mode: ${EXECUTE ? 'EXECUTE (will write)' : 'DRY RUN (report only)'}\n`);

  try {
    const channels = await OutputChannel.find({ platform: 'telegram' });
    if (channels.length === 0) {
      console.log('No Telegram output channels found. Nothing to do.');
      return;
    }

    for (const ch of channels) {
      // Replicate the old .env fallback's routing rule exactly:
      // category === 'fitness' -> fitness channel, everything else -> the catch-all channel.
      const matchQuery = ch.category === 'fitness'
        ? { 'publishedStatus.telegram': true, category: 'fitness' }
        : { 'publishedStatus.telegram': true, category: { $ne: 'fitness' } };

      const count = await Deal.countDocuments(matchQuery);
      const latest = await Deal.findOne(matchQuery).sort({ updatedAt: -1 }).select('updatedAt').lean();

      console.log(`=== ${ch.name} (@${ch.credentials?.channelUsername || '?'}, category="${ch.category}") ===`);
      console.log(`  Current stats.dealsPublished: ${ch.stats?.dealsPublished || 0}`);
      console.log(`  Real historical count:        ${count}`);
      console.log(`  Latest matching send:         ${latest?.updatedAt?.toISOString() || 'n/a'}\n`);

      if (EXECUTE) {
        await OutputChannel.findByIdAndUpdate(ch._id, {
          $set: {
            'stats.dealsPublished': count,
            ...(latest?.updatedAt ? { 'stats.lastPublishedAt': latest.updatedAt } : {})
          }
        });
      }
    }

    if (!EXECUTE) {
      console.log('Dry run only — no writes made. Re-run with --execute to apply.');
    } else {
      console.log('Done — stats updated.');
    }
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(err => {
  console.error('[BackfillStats] Fatal error:', err);
  process.exit(1);
});
