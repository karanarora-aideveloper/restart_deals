import cron from 'node-cron';
import Deal from '../db/models/deal.js';
import XPostLog from '../db/models/xPostLog.js';
import { postDealToX, createCancelToken, XBotCancelledError } from '../utils/xBot.js';

// Single-process, in-memory — this app only ever runs one X-bot posting attempt at a time (the
// cron job and the admin's manual trigger both funnel through runXBotPostCycle below), so a
// module-level reference to whichever one is currently in flight is enough for the /cancel route
// to reach it. Cleared back to null as soon as a run finishes, however it finishes.
let activeCancelToken = null;

/** Called by POST /api/x-bot/cancel. Returns false (no-op) if nothing is actually running. */
export function cancelActiveRun() {
  if (!activeCancelToken) return false;
  activeCancelToken.cancelled = true;
  return true;
}

export function isRunActive() {
  return activeCancelToken !== null;
}

// "Hot" here matches the same >=40% discount bar the native app's Hot tab uses (App.js) — the
// bar for "good enough to actively push," not just "on sale." MAX guards against the inverse
// problem: a deal that "went out" with a stored discountPercentage of 600% (dealPrice/
// originalPrice swapped upstream, or a bad scrape) — no genuine sale is a 600% discount, and
// nothing was rejecting values like that before this got caught in production. See the note on
// computedDiscountPercent below for why the *stored* field isn't trusted at all for filtering.
const MIN_DISCOUNT_PERCENT = 40;
const MAX_SANE_DISCOUNT_PERCENT = 90;

function formatDealInput(deal) {
  const lines = [`Product: ${deal.title}`];
  if (deal.originalPrice && deal.dealPrice) {
    lines.push(`Was $${deal.originalPrice}, Now $${deal.dealPrice}`);
  } else if (deal.dealPrice) {
    lines.push(`Price: $${deal.dealPrice}`);
  }
  if (deal.computedDiscountPercent != null) lines.push(`Discount: ${deal.computedDiscountPercent}% OFF`);
  if (deal.dealUrl) lines.push(`Link: ${deal.dealUrl}`);
  return lines.join('\n');
}

/**
 * Picks the highest-discount US deal that doesn't already have a SUCCESS entry in XPostLog.
 * $nin against the log rather than a flag on Deal itself — keeps Deal's schema untouched and
 * "already posted" fully derivable from XPostLog, which is also what the admin history reads.
 *
 * Deliberately does NOT trust the stored `discountPercentage` field for filtering — two real
 * posts went out with nonsense discounts (a "600% OFF" price *increase*, and a mislabeled
 * "100% off") because that field can drift from what dealPrice/originalPrice actually say.
 * Instead this recomputes the discount from the prices directly and only considers a deal
 * "qualifying" if dealPrice is a real, positive amount genuinely lower than originalPrice, with
 * the recomputed percentage landing in a sane range — not just whatever the stored field claims.
 */
async function selectBestUnpostedUSDeal() {
  const alreadyPosted = await XPostLog.find({ status: 'SUCCESS', deal: { $ne: null } }).distinct('deal');
  const candidates = await Deal.find({
    country: 'US',
    dealUrl: { $exists: true, $ne: null },
    dealPrice: { $gt: 0 },
    originalPrice: { $gt: 0 },
    _id: { $nin: alreadyPosted },
  })
    .sort({ createdAt: -1 })
    .limit(500); // recent-first pool is plenty; avoids scanning the whole US deals collection every cycle

  let best = null;
  for (const deal of candidates) {
    if (deal.dealPrice >= deal.originalPrice) continue; // not actually a discount
    const pct = Math.round(((deal.originalPrice - deal.dealPrice) / deal.originalPrice) * 100);
    if (pct < MIN_DISCOUNT_PERCENT || pct > MAX_SANE_DISCOUNT_PERCENT) continue;
    if (!best || pct > best.computedDiscountPercent) {
      deal.computedDiscountPercent = pct;
      best = deal;
    }
  }
  return best;
}

/**
 * Runs one full post attempt: pick (or use the given) deal, try to post it via the phone, log
 * the outcome either way. Shared by the cron schedule and the admin's manual "Post Now" trigger
 * so both paths log identically and can't double-post the same deal (selectBestUnpostedUSDeal
 * excludes anything already logged SUCCESS).
 */
export async function runXBotPostCycle({ trigger = 'scheduled', dealId = null } = {}) {
  const deal = dealId ? await Deal.findById(dealId) : await selectBestUnpostedUSDeal();

  if (!deal) {
    const log = await XPostLog.create({ status: 'SKIPPED_NO_DEAL', trigger });
    console.log('[X Bot] No qualifying unposted US deal found — skipping this cycle.');
    return log;
  }

  const dealInput = formatDealInput(deal);
  const cancelToken = createCancelToken();
  activeCancelToken = cancelToken;
  try {
    const { publishedContent, steps } = await postDealToX(dealInput, { cancelToken });
    const log = await XPostLog.create({
      deal: deal._id,
      dealTitle: deal.title,
      dealUrl: deal.dealUrl,
      publishedContent,
      status: 'SUCCESS',
      steps: steps || [],
      trigger,
    });
    console.log(`[X Bot] Posted "${deal.title}" to X successfully.`);
    return log;
  } catch (err) {
    const status =
      err instanceof XBotCancelledError ? 'CANCELLED' : err.code === 'DEVICE_OFFLINE' ? 'SKIPPED_DEVICE_OFFLINE' : 'FAILED';
    const log = await XPostLog.create({
      deal: deal._id,
      dealTitle: deal.title,
      dealUrl: deal.dealUrl,
      status,
      errorMessage: status === 'CANCELLED' ? null : err.message,
      steps: err.steps || [],
      trigger,
    });
    console.error(`[X Bot] ${status} for "${deal.title}":`, err.message);
    return log;
  } finally {
    if (activeCancelToken === cancelToken) activeCancelToken = null;
  }
}

/**
 * Starts the 3x/day auto-posting schedule (9am, 2pm, 7pm US Eastern — the target account,
 * "Shoppers Deals America," is US-audience-facing; adjust TZ below if a different region reads
 * better for your posting hours). Call once from server startup.
 */
export function startXBotScheduler() {
  cron.schedule(
    '0 9,14,19 * * *',
    () => {
      console.log('[X Bot] Scheduled posting cycle starting...');
      runXBotPostCycle({ trigger: 'scheduled' }).catch((err) => {
        console.error('[X Bot] Unexpected scheduler error:', err.message);
      });
    },
    { timezone: 'America/New_York' }
  );
  console.log('[X Bot] Scheduler started — posting attempts at 9am/2pm/7pm America/New_York.');
}
