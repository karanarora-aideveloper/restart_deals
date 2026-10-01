import mongoose from 'mongoose';

async function analyze6Hours() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const now = new Date();
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

  console.log(`\n========================================================================`);
  console.log(` 6-HOUR SYSTEM LOG & PERFORMANCE ANALYSIS`);
  console.log(` UTC Window:   ${sixHoursAgo.toISOString()} to ${now.toISOString()}`);
  console.log(` Local Window: ${sixHoursAgo.toLocaleTimeString()} to ${now.toLocaleTimeString()}`);
  console.log(`========================================================================\n`);

  const scrapingLogsColl = db.collection('scraping_logs');
  const dealsColl = db.collection('deals');
  const productsColl = db.collection('products');

  // 1. Scraping Stats
  const totalScrapes = await scrapingLogsColl.countDocuments({ createdAt: { $gte: sixHoursAgo } });
  const successScrapes = await scrapingLogsColl.countDocuments({ createdAt: { $gte: sixHoursAgo }, status: 'success' });
  const failedScrapes = await scrapingLogsColl.countDocuments({ createdAt: { $gte: sixHoursAgo }, status: { $ne: 'success' } });

  const uniqueUrls = await scrapingLogsColl.distinct('url', { createdAt: { $gte: sixHoursAgo } });
  const uniqueSuccessUrls = await scrapingLogsColl.distinct('url', { createdAt: { $gte: sixHoursAgo }, status: 'success' });

  // Failure reasons breakdown
  const failureBreakdown = await scrapingLogsColl.aggregate([
    { $match: { createdAt: { $gte: sixHoursAgo }, status: { $ne: 'success' } } },
    { $group: { _id: { status: '$status', statusCode: '$statusCode' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();

  // Scrapes timeline by 15-minute intervals to assess system up/down continuity
  const intervals = await scrapingLogsColl.aggregate([
    { $match: { createdAt: { $gte: sixHoursAgo } } },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%H:%M',
            date: {
              $toDate: {
                $subtract: [
                  { $toLong: '$createdAt' },
                  { $mod: [{ $toLong: '$createdAt' }, 15 * 60 * 1000] }
                ]
              }
            },
            timezone: '+05:30'
          }
        },
        total: { $sum: 1 },
        success: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $ne: ['$status', 'success'] }, 1, 0] } }
      }
    },
    { $sort: { _id: 1 } }
  ]).toArray();

  // 2. Products in last 6h
  const productsUpdated = await productsColl.countDocuments({ updatedAt: { $gte: sixHoursAgo } });
  const productsScraped = await productsColl.countDocuments({ lastStoreSyncAt: { $gte: sixHoursAgo } });

  // 3. Deals in last 6h
  const dealsCreated = await dealsColl.countDocuments({ createdAt: { $gte: sixHoursAgo } });
  const dealsUpdated = await dealsColl.countDocuments({ updatedAt: { $gte: sixHoursAgo } });

  const dealsByStore = await dealsColl.aggregate([
    { $match: { createdAt: { $gte: sixHoursAgo } } },
    { $group: { _id: '$merchant', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();

  const dealsByCategory = await dealsColl.aggregate([
    { $match: { createdAt: { $gte: sixHoursAgo } } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();

  // Detailed recent deals
  const detailedDeals = await dealsColl.find({ createdAt: { $gte: sixHoursAgo } })
    .sort({ createdAt: -1 })
    .limit(20)
    .toArray();

  console.log(`[1. SYSTEM SCRAPE METRICS (Last 6 Hours)]`);
  console.log(` • Total Scrape Attempts:       ${totalScrapes.toLocaleString()}`);
  console.log(` • Successful Scrapes:          ${successScrapes.toLocaleString()} (${((successScrapes / (totalScrapes || 1)) * 100).toFixed(1)}%)`);
  console.log(` • Failed Scrapes:              ${failedScrapes.toLocaleString()} (${((failedScrapes / (totalScrapes || 1)) * 100).toFixed(1)}%)`);
  console.log(` • Distinct URLs Attempted:     ${uniqueUrls.length.toLocaleString()}`);
  console.log(` • Distinct Products Fetched:   ${uniqueSuccessUrls.length.toLocaleString()}`);
  console.log(` • Products with DB Price Sync: ${productsScraped.toLocaleString()}`);

  console.log(`\n[2. FAILURE REASON BREAKDOWN]`);
  failureBreakdown.forEach(f => {
    console.log(` • Status: ${f._id.status || 'unknown'}, HTTP Code: ${f._id.statusCode || 'N/A'} -> ${f.count.toLocaleString()} occurrences`);
  });

  console.log(`\n[3. UPTIME & SCRAPE CONTINUITY (15-Min Buckets)]`);
  intervals.forEach(i => {
    console.log(` • [${i._id}]: ${i.total} scrapes (${i.success} succeeded, ${i.failed} failed)`);
  });

  console.log(`\n[4. DEALS SUMMARY (Last 6 Hours)]`);
  console.log(` • Fresh Deals Created:         ${dealsCreated.toLocaleString()}`);
  console.log(` • Deals Verified / Updated:    ${dealsUpdated.toLocaleString()}`);

  console.log(`\n[5. DEALS BY STORE]`);
  dealsByStore.forEach(s => {
    console.log(` • ${s._id || 'unknown'}: ${s.count} deals`);
  });

  console.log(`\n[6. DEALS BY CATEGORY]`);
  dealsByCategory.forEach(c => {
    console.log(` • ${c._id || 'unknown'}: ${c.count} deals`);
  });

  console.log(`\n[7. SAMPLE DEALS DATA (Most Recent 20 Deals)]`);
  detailedDeals.forEach((d, idx) => {
    console.log(`\n#${idx + 1} [${d.merchant?.toUpperCase() || 'STORE'}] ${d.title?.substring(0, 80)}...`);
    console.log(`   Price: ₹${d.dealPrice?.toLocaleString() || 'N/A'} | MRP: ₹${d.originalPrice?.toLocaleString() || 'N/A'} | Discount: ${d.discountPercentage || 0}% OFF`);
    console.log(`   Category: ${d.category || 'N/A'} | Created At: ${d.createdAt ? new Date(d.createdAt).toLocaleTimeString() : 'N/A'}`);
    console.log(`   Product URL: ${d.dealUrl || 'N/A'}`);
  });

  console.log(`\n========================================================================\n`);
  await mongoose.disconnect();
}

analyze6Hours().catch(err => {
  console.error('[Error analyzing 6 hours]:', err);
  process.exit(1);
});
