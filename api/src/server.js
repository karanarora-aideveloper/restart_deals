import express from 'express';
import cors from 'cors';
import compression from 'compression';
import config from './config.js';
import dealsRouter from './routes/deals.js';
import productsRouter from './routes/products.js';
import adminRouter from './routes/admin.js';
import channelsRouter from './routes/channels.js';
import authRouter from './routes/auth.js';
import masterRouter from './routes/master.js';
import tokensRouter from './routes/tokens.js';
import outputChannelsRouter from './routes/outputChannels.js';
import xAccountsRouter from './routes/xAccounts.js';
import leadsRouter from './routes/leads.js';
import seoRouter from './routes/seo.js';
import notificationsRouter from './routes/notifications.js';
import alertsRouter from './routes/alerts.js';
import xBotRouter from './routes/xBot.js';
import { startXBotScheduler } from './jobs/xBotScheduler.js';
import { startDailyProductRefresher } from './jobs/dailyProductRefresher.js';
import { initScraperWorker } from './services/scraperWorker.js';
import { requireAdminAuth } from './middleware/adminAuth.js';

const app = express();

// Mount SEO routes at root level (handles /sitemap.xml and /deal/:id)
app.use('/', seoRouter);

// Always CORS-enable. Plain Cloudflare proxying does NOT inject
// Access-Control-Allow-Origin on its own (confirmed: proxied responses carry no CORS
// headers), so skipping here for cf-ray/cf-connecting-ip requests — i.e. every request
// that reaches this domain, since it's always proxied — disabled CORS for all browser
// traffic in production. The admin panel's earlier CORS errors were this, not a
// same-origin quirk; pointing it at localhost only avoided hitting the bug.
app.use(cors({ origin: true, credentials: true }));
app.use(compression());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'shoppersdeals-api', time: new Date() });
});

// Bind API routes (Public)
app.use('/api/deals', dealsRouter);
app.use('/deals', dealsRouter);

app.use('/api/products', productsRouter);
app.use('/products', productsRouter);

app.use('/api/alerts', alertsRouter);
app.use('/alerts', alertsRouter);

app.use('/api/channels', channelsRouter);
app.use('/channels', channelsRouter);

app.use('/api/auth', authRouter);
app.use('/auth', authRouter);

app.use('/api/master', masterRouter);
app.use('/master', masterRouter);

app.use('/api/leads', leadsRouter);
app.use('/leads', leadsRouter);

app.use('/api/notifications', notificationsRouter);
app.use('/notifications', notificationsRouter);

// Bind API routes (Admin-Protected)
app.use('/api/admin', requireAdminAuth, adminRouter);
app.use('/admin', requireAdminAuth, adminRouter);

app.use('/api/tokens', requireAdminAuth, tokensRouter);
app.use('/tokens', requireAdminAuth, tokensRouter);

app.use('/api/output-channels', requireAdminAuth, outputChannelsRouter);
app.use('/output-channels', requireAdminAuth, outputChannelsRouter);

app.use('/api/x-accounts', requireAdminAuth, xAccountsRouter);
app.use('/x-accounts', requireAdminAuth, xAccountsRouter);

app.use('/api/x-bot', requireAdminAuth, xBotRouter);
app.use('/x-bot', requireAdminAuth, xBotRouter);

export function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(config.port, () => {
      console.log(`[API Service] Express REST server running on port ${config.port}`);
      initScraperWorker();
      startXBotScheduler();
      startDailyProductRefresher();
      resolve(server);
    });
  });
}

export default app;
