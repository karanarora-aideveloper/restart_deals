import mongoose from 'mongoose';
import ScrapingAntToken from '../db/models/scrapingAntToken.js';

async function checkScrapingAntUsage(token) {
  try {
    const url = `https://api.scrapingant.com/v2/usage?x-api-key=${encodeURIComponent(token)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000)
    });
    const data = await response.json();
    if (!response.ok || data.detail) {
      return {
        valid: false,
        statusCode: response.status,
        error: data.detail || `HTTP ${response.status}`
      };
    }
    return {
      valid: true,
      statusCode: response.status,
      planName: data.plan_name || 'Free',
      planTotalCredits: data.plan_total_credits || 10000,
      remainedCredits: typeof data.remained_credits === 'number' ? data.remained_credits : 0,
      renewalDate: data.end_date ? new Date(data.end_date) : null
    };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

async function cleanAndParkTokens() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');
  await mongoose.connect(uri);

  console.log('[Token Maintenance] Connected to MongoDB Atlas. Fetching all tokens...');
  const allTokens = await ScrapingAntToken.find({});
  console.log(`[Token Maintenance] Total tokens found: ${allTokens.length}`);

  let deadCount = 0;
  let parkedCount = 0;
  let activeCount = 0;

  for (const tokenRecord of allTokens) {
    const usage = await checkScrapingAntUsage(tokenRecord.token);
    tokenRecord.lastCheckedAt = new Date();

    if (!usage.valid) {
      console.log(`[Dead Token] Deleting invalid/dead token: ${tokenRecord.token.substring(0, 10)}... (Reason: ${usage.error})`);
      await ScrapingAntToken.deleteOne({ _id: tokenRecord._id });
      deadCount++;
      continue;
    }

    tokenRecord.planName = usage.planName;
    tokenRecord.planTotalCredits = usage.planTotalCredits;
    tokenRecord.remainedCredits = usage.remainedCredits;
    if (usage.renewalDate) {
      tokenRecord.renewalDate = usage.renewalDate;
    }

    if (usage.remainedCredits > 0) {
      tokenRecord.status = 'active';
      tokenRecord.exhaustedAt = null;
      activeCount++;
      console.log(`[Active Token] Token ${tokenRecord.token.substring(0, 10)}... has ${usage.remainedCredits} credits left.`);
    } else {
      // Credits exhausted: park token until renewalDate
      tokenRecord.status = 'parked';
      if (!tokenRecord.exhaustedAt) tokenRecord.exhaustedAt = new Date();
      parkedCount++;
      console.log(`[Parked Token] Token ${tokenRecord.token.substring(0, 10)}... parked until renewal (${usage.renewalDate?.toISOString() || 'unknown'}).`);
    }

    await tokenRecord.save();
  }

  console.log('\n--- Maintenance Summary ---');
  console.log(`Deleted Dead Tokens: ${deadCount}`);
  console.log(`Parked Exhausted Tokens: ${parkedCount}`);
  console.log(`Active Tokens: ${activeCount}`);
  console.log(`Total Retained Tokens: ${parkedCount + activeCount}`);

  await mongoose.disconnect();
}

cleanAndParkTokens().catch(err => {
  console.error('[Token Maintenance Error]', err);
  process.exit(1);
});
