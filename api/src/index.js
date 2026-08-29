import { connectDB } from './db/connection.js';
import { startServer } from './server.js';
import { startAlgoliaSync } from './algolia/sync.js';
import fs from 'fs';
import os from 'os';

// TEMPORARY diagnostic — the Auto-Scrape Tokens automation (scrapingAntAutomation.js) fails at
// runtime with "Executable doesn't exist at /opt/render/.cache/ms-playwright/..." despite the
// postinstall script (api/package.json) reporting no errors and completing in under a second
// with zero download output. Print exactly what Playwright resolves and what's actually on disk
// at RUNTIME (not build time) to find out whether this is a build/runtime environment mismatch
// or something else — remove once this is diagnosed and fixed.
function logPlaywrightDiagnostics() {
  try {
    console.log('[Playwright Diagnostic] HOME =', os.homedir(), '| process.env.HOME =', process.env.HOME);
    const cacheDir = `${os.homedir()}/.cache/ms-playwright`;
    console.log('[Playwright Diagnostic] Checking', cacheDir);
    if (fs.existsSync(cacheDir)) {
      console.log('[Playwright Diagnostic] Contents:', fs.readdirSync(cacheDir).join(', ') || '(empty)');
    } else {
      console.log('[Playwright Diagnostic] Directory does not exist.');
    }
    import('playwright').then(({ chromium }) => {
      console.log('[Playwright Diagnostic] chromium.executablePath() =', chromium.executablePath());
    }).catch(e => console.log('[Playwright Diagnostic] Failed to resolve executablePath:', e.message));
  } catch (e) {
    console.log('[Playwright Diagnostic] Error:', e.message);
  }
}

async function main() {
  console.log('==================================================');
  console.log('            SHOPPERSDEALS API SERVICE             ');
  console.log('==================================================');

  logPlaywrightDiagnostics();

  await connectDB();
  await startServer();
  startAlgoliaSync();
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('[API Unhandled Rejection] at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[API Uncaught Exception] occurred:', err);
});

main();

