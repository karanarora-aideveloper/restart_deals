import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'api/.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/deals_db';

async function checkEngineLogs() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB successfully.');

  // Check CrawlerConfig stats
  const CrawlerConfig = mongoose.connection.collection('crawler_configs');
  const config = await CrawlerConfig.findOne({});
  console.log('\n======================================================');
  console.log('       SHOPPERS DEALS ENGINE (ENGINE 2) STATUS');
  console.log('======================================================');
  console.log('Enabled:       ', config?.isEnabled);
  console.log('Is Running:    ', config?.isRunning);
  console.log('Cadence:       ', config?.intervalHours ? `Every ${config.intervalHours} hours` : 'N/A');
  console.log('Last Run At:   ', config?.lastRunAt ? config.lastRunAt.toISOString() : 'Never');
  console.log('Next Run At:   ', config?.nextRunAt ? config.nextRunAt.toISOString() : 'Not scheduled');
  console.log('Last Run Stats:', JSON.stringify(config?.lastRunStats, null, 2));

  // Check recent ScrapingLog for bestseller_crawler / shoppers deals engine
  const ScrapingLog = mongoose.connection.collection('scraping_logs');
  const crawlerLogs = await ScrapingLog.find({
    $or: [
      { source: 'bestseller_crawler' },
      { source: 'shoppers_deals_engine' }
    ]
  })
    .sort({ createdAt: -1 })
    .limit(15)
    .toArray();

  console.log(`\n======================================================`);
  console.log(`   SCRAPING LOGS FOR SHOPPERS DEALS ENGINE (${crawlerLogs.length} found)`);
  console.log(`======================================================`);
  if (crawlerLogs.length === 0) {
    console.log('No direct "bestseller_crawler" logs recorded in scraping_logs yet.');
    console.log('(Note: listing page scrapes may be recorded under other/queue sources or are queued via scraper-queue.)');
  } else {
    crawlerLogs.forEach((l, idx) => {
      console.log(`\n#${idx + 1} [${l.createdAt?.toISOString()}] Merchant: ${l.merchant} | Status: ${l.status} (${l.durationMs}ms)`);
      console.log(`    URL:   ${l.url}`);
      console.log(`    Token: ${l.tokenUsed || 'N/A'}`);
      if (l.errorMessage) console.log(`    Error: ${l.errorMessage}`);
      if (l.extractedData && Object.keys(l.extractedData).length > 0) {
        console.log(`    Data:  ${JSON.stringify(l.extractedData)}`);
      }
    });
  }

  // Check general recent scraping logs to see overall fleet activity
  const latestAny = await ScrapingLog.find({})
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();
  console.log(`\n======================================================`);
  console.log(`   LATEST 10 SCRAPING LOGS ACROSS ALL ENGINES`);
  console.log(`======================================================`);
  latestAny.forEach((l, idx) => {
    console.log(`${idx + 1}. [${l.source || 'unknown'}] ${l.merchant} | ${l.status} (${l.durationMs}ms) | ${l.createdAt?.toISOString()}`);
    console.log(`   ${l.url?.slice(0, 85)}...`);
    if (l.errorMessage) console.log(`   ⚠️ ${l.errorMessage}`);
  });

  // Check seeds in crawler_seeds that have executed
  const CrawlerSeed = mongoose.connection.collection('crawler_seeds');
  const totalSeeds = await CrawlerSeed.countDocuments({});
  const seedsWithRuns = await CrawlerSeed.find({ lastRunAt: { $ne: null } })
    .sort({ lastRunAt: -1 })
    .limit(15)
    .toArray();

  console.log(`\n======================================================`);
  console.log(`   SEEDS AUDIT (${totalSeeds} total seeds configured)`);
  console.log(`   Executed Seeds with Results: ${seedsWithRuns.length}`);
  console.log(`======================================================`);
  if (seedsWithRuns.length === 0) {
    console.log('No seeds have completed a run yet. Seeds are waiting for their scheduled frequency or a manual run.');
  } else {
    seedsWithRuns.forEach(s => {
      console.log(`• [${s.store?.toUpperCase()}] ${s.category}/${s.subcategory} ("${s.keywords}")`);
      console.log(`  Last Run: ${s.lastRunAt?.toISOString()} | Found: ${s.lastResult?.found || 0} | Enrolled: ${s.lastResult?.enrolled || 0} | Updated: ${s.lastResult?.updated || 0}`);
      if (s.lastResult?.error) console.log(`  Error: ${s.lastResult.error}`);
    });
  }

  // Check system_logs if collection exists
  const collections = await mongoose.connection.db.listCollections().toArray();
  const hasSystemLogs = collections.some(c => c.name === 'system_logs');
  if (hasSystemLogs) {
    const SystemLog = mongoose.connection.collection('system_logs');
    const recentSysLogs = await SystemLog.find({
      $or: [
        { message: { $regex: /crawler|bestseller|shoppers/i } },
        { tag: { $regex: /crawler|bestseller|shoppers/i } }
      ]
    })
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();
    console.log(`\n======================================================`);
    console.log(`   SYSTEM LOGS MATCHING SHOPPERS DEALS ENGINE (${recentSysLogs.length} found)`);
    console.log(`======================================================`);
    recentSysLogs.forEach(sl => {
      console.log(`[${sl.level || 'info'}] ${sl.timestamp?.toISOString()} - ${sl.message}`);
    });
  }

  await mongoose.disconnect();
}

checkEngineLogs().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
