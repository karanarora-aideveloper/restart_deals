import mongoose from 'mongoose';
import ScrapingLog from '../db/models/scrapingLog.js';

async function analyzeLogs() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('==================================================');
  console.log('         SCRAPING LOGS COMPREHENSIVE AUDIT        ');
  console.log('==================================================');

  const total = await ScrapingLog.countDocuments();
  console.log(`\nTotal Scraping Logs Recorded: ${total.toLocaleString()}`);

  const statusAgg = await ScrapingLog.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  console.log('\nStatus Breakdown (All-time):');
  statusAgg.forEach(s => console.log(` - ${s._id || 'unknown'}: ${s.count.toLocaleString()}`));

  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent24hAgg = await ScrapingLog.aggregate([
    { $match: { createdAt: { $gte: last24h } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  console.log('\nStatus Breakdown (Last 24 Hours):');
  recent24hAgg.forEach(s => console.log(` - ${s._id || 'unknown'}: ${s.count.toLocaleString()}`));

  const last1h = new Date(Date.now() - 60 * 60 * 1000);
  const recent1hAgg = await ScrapingLog.aggregate([
    { $match: { createdAt: { $gte: last1h } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  console.log('\nStatus Breakdown (Last 1 Hour):');
  recent1hAgg.forEach(s => console.log(` - ${s._id || 'unknown'}: ${s.count.toLocaleString()}`));

  const merchantAgg = await ScrapingLog.aggregate([
    { $match: { createdAt: { $gte: last24h } } },
    { $group: { _id: '$merchant', total: { $sum: 1 }, success: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } } } },
    { $sort: { total: -1 } }
  ]);
  console.log('\nStore Distribution & Success Rate (Last 24h):');
  merchantAgg.forEach(m => {
    const pct = ((m.success / m.total) * 100).toFixed(1);
    console.log(` - ${m._id}: ${m.success}/${m.total} succeeded (${pct}%)`);
  });

  const recentErrors = await ScrapingLog.find({ status: { $ne: 'success' } })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
  console.log('\nTop 10 Recent Non-Success Logs:');
  recentErrors.forEach(l => {
    console.log(` - [${l.createdAt?.toISOString()}] [${l.status}] [HTTP ${l.statusCode}] ${l.url?.substring(0, 45)}... error: ${l.errorMessage}`);
  });

  const recentSuccess = await ScrapingLog.find({ status: 'success' })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();
  console.log('\nTop 5 Recent Successful Logs:');
  recentSuccess.forEach(l => {
    console.log(` - [${l.createdAt?.toISOString()}] [${l.merchant}] ${l.extractedData?.title?.substring(0, 45)}... Price: ₹${l.extractedData?.price} Duration: ${l.durationMs}ms`);
  });

  console.log('==================================================\n');
  await mongoose.disconnect();
}

analyzeLogs().catch(console.error);
