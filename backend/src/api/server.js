import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';
import { MEDIA_DIR } from '../utils/telegramMedia.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Serve Telegram photos downloaded as a fallback deal image (see utils/telegramMedia.js).
// Long cache is fine — filenames are content-stable (channelId_messageId.jpg), never overwritten.
app.use('/media/telegram', express.static(MEDIA_DIR, {
  maxAge: '7d',
}));

// Standard middlewares
app.use(express.json());

// Basic CORS header helper (supports Private Network Access from Vercel HTTPS)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'PUT, POST, PATCH, DELETE, GET');
    return res.status(200).json({});
  }
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

/**
 * Start the HTTP Express Server
 */
export function startServer() {
  const port = config.port || 3000;
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`[API Server] Express app running on HTTP port ${port}`);
      resolve(server);
    });
    // Without this, a bind failure (e.g. EADDRINUSE) fires as an unhandled 'error' event —
    // surfaces as an uncaught exception AND leaves this Promise never settling, so main()'s
    // `await startServer()` hangs forever and startTelegramListener() (the next step) never
    // runs. The process looks "alive" but is actually a stuck half-started zombie. Fail fast
    // and loud instead, same convention connectDB() already uses for its own fatal errors.
    server.on('error', (err) => {
      console.error(`[API Server Error] Failed to start on port ${port}:`, err.message);
      process.exit(1);
    });
  });
}

export default app;
