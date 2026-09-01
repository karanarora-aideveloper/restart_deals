import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// GET /api/monitoring/meesho-status
// Real-time dashboard of Meesho deal processing
router.get('/meesho-status', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const products = db.collection('products');
    const deals = db.collection('deals');
    const logs = db.collection('scraping_logs');

    // Last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Meesho products: total and by price source
    const meeshoProducts = await products.countDocuments({ merchant: 'meesho' });
    const meeshoProductsNew24h = await products.countDocuments({
      merchant: 'meesho',
      createdAt: { $gte: oneDayAgo },
    });

    // Meesho deals: total and by price source
    const meeshoDeals = await deals.countDocuments({ merchant: 'meesho' });
    const meeshoDealsPriceHistory = await deals.countDocuments({
      merchant: 'meesho',
      priceSource: 'price_history',
    });
    const meeshoDealsLive = await deals.countDocuments({
      merchant: 'meesho',
      priceSource: 'scraped',
    });
    const meeshoDealsNew24h = await deals.countDocuments({
      merchant: 'meesho',
      createdAt: { $gte: oneDayAgo },
    });

    // Meesho scraping logs: success vs error
    const meeshoScrapeLogs = await logs.countDocuments({ merchant: 'meesho' });
    const meeshoScrapeSuccess = await logs.countDocuments({
      merchant: 'meesho',
      status: 'success',
    });
    const meeshoScrapeError = await logs.countDocuments({
      merchant: 'meesho',
      status: 'error',
    });

    // Average discount for Meesho deals
    const avgDiscountPipeline = [
      { $match: { merchant: 'meesho', discountPercentage: { $gt: 0 } } },
      { $group: { _id: null, avgDiscount: { $avg: '$discountPercentage' } } },
    ];
    const avgDiscountResult = await deals.aggregate(avgDiscountPipeline).toArray();
    const avgDiscount = avgDiscountResult[0]?.avgDiscount || 0;

    // Recent errors
    const recentErrors = await logs
      .find({ merchant: 'meesho', status: 'error' })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    // Recent successful products
    const recentProducts = await products
      .find({ merchant: 'meesho' })
      .sort({ createdAt: -1 })
      .limit(3)
      .project({ title: 1, price: 1, priceSource: 1, createdAt: 1 })
      .toArray();

    // Recent deals
    const recentDeals = await deals
      .find({ merchant: 'meesho' })
      .sort({ createdAt: -1 })
      .limit(5)
      .project({
        title: 1,
        dealPrice: 1,
        previousPrice: 1,
        discountPercentage: 1,
        priceSource: 1,
        createdAt: 1,
      })
      .toArray();

    res.json({
      timestamp: new Date().toISOString(),
      summary: {
        totalProducts: meeshoProducts,
        newProductsLast24h: meeshoProductsNew24h,
        totalDeals: meeshoDeals,
        dealsViaPriceHistory: meeshoDealsPriceHistory,
        dealsViaLiveScrape: meeshoDealsLive,
        newDealsLast24h: meeshoDealsNew24h,
        scrapeSuccessRate:
          meeshoScrapeLogs > 0 ? ((meeshoScrapeSuccess / meeshoScrapeLogs) * 100).toFixed(1) + '%' : 'N/A',
        avgDiscountPercentage: avgDiscount.toFixed(1) + '%',
      },
      scrapingStats: {
        totalAttempts: meeshoScrapeLogs,
        successes: meeshoScrapeSuccess,
        failures: meeshoScrapeError,
      },
      recentErrors: recentErrors.map(e => ({
        url: e.url?.slice(0, 60) + '...' || 'N/A',
        error: e.errorMessage,
        statusCode: e.statusCode,
        timestamp: e.createdAt,
      })),
      recentProducts,
      recentDeals: recentDeals.map(d => ({
        title: d.title?.slice(0, 50) + '...' || 'N/A',
        dealPrice: d.dealPrice,
        previousPrice: d.previousPrice,
        discount: d.discountPercentage + '%',
        source: d.priceSource,
        created: d.createdAt,
      })),
      healthCheck: {
        fallbackWorking: meeshoDealsPriceHistory > 0 ? '✓ Yes' : '⏳ Waiting for deals',
        liveScrapeWorking: meeshoDealsLive > 0 ? '✓ Yes (unexpected)' : '✗ No (expected: 423 blocks)',
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch Meesho monitoring data',
      message: error.message,
    });
  }
});

// GET /api/monitoring/all-merchants
// Compare all merchants' performance
router.get('/all-merchants', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const deals = db.collection('deals');

    const merchants = ['amazon', 'flipkart', 'myntra', 'nykaa', 'ajio', 'shopsy', 'meesho'];
    const stats = {};

    for (const m of merchants) {
      const total = await deals.countDocuments({ merchant: m });
      const priceHistory = await deals.countDocuments({
        merchant: m,
        priceSource: 'price_history',
      });
      const live = await deals.countDocuments({
        merchant: m,
        priceSource: 'scraped',
      });

      stats[m] = {
        totalDeals: total,
        viaPriceHistory: priceHistory,
        viaLiveScrape: live,
        fallbackPercentage: total > 0 ? ((priceHistory / total) * 100).toFixed(1) + '%' : '0%',
      };
    }

    res.json({
      timestamp: new Date().toISOString(),
      merchants: stats,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch merchant stats',
      message: error.message,
    });
  }
});

export default router;
