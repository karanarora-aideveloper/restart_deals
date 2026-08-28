/**
 * Standalone test: run the automation ONLY through Step 2 (Sonjj login),
 * then stop — no email generation, no ScrapingAnt signup, no token spend.
 *
 * Usage (from api/):
 *   node src/scripts/testSonjjLogin.js
 *   node src/scripts/testSonjjLogin.js --headless   (to run invisibly)
 *
 * What it does:
 *   Step 0: Launch stealth browser (headed by default so you can watch)
 *   Step 1: Check login status on smailpro.com (btn user → "Hi! Guest" or a real name)
 *   Step 2: If not logged in, run Sonjj SSO login.
 *           - If the saved session cookie is still valid: instant, no code needed.
 *           - If not: fills your email, then this script itself prompts you
 *             right here in the terminal for the code (check Gmail) — no
 *             admin panel needed for this standalone test.
 *   Then stops, prints the result, and closes the browser.
 */

import readline from 'readline';
import {
  launchStealthBrowser,
  getAuthenticatedSmailPage,
  submitOtpCode,
  getAutomationStatus,
} from './scrapingAntAutomation.js';

const TWOCAPTCHA_API_KEY = process.env.TWOCAPTCHA_API_KEY || '00f69cd4eefad8d5ccfe712289733973';

function promptForCode(email) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`\n📧 Enter the verification code sent to ${email}: `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const headless = process.argv.includes('--headless');

  console.log('='.repeat(70));
  console.log('🧪 TEST RUN — Steps 0-2 only (browser launch → login check → login)');
  console.log(`🖥️  Mode: ${headless ? 'headless' : 'visible'}`);
  console.log('='.repeat(70));

  // Step 0: Launch stealth browser
  const { browser, context } = await launchStealthBrowser({ headless });
  console.log('[Step 0] ✓ Browser launched');

  // Watch for the login step pausing on a code request, and prompt for it
  // right here in the terminal (this standalone script has no admin UI).
  let watching = true;
  let alreadyPrompted = false;
  (async () => {
    while (watching) {
      const status = getAutomationStatus();
      if (status.awaitingCode && !alreadyPrompted) {
        alreadyPrompted = true;
        const code = await promptForCode(status.awaitingCodeEmail);
        submitOtpCode(code);
        alreadyPrompted = false; // allow a retry prompt if the first code was rejected
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  })();

  try {
    // Steps 1 + 2: login status check, then SSO login if needed
    const smailPage = await getAuthenticatedSmailPage(context, TWOCAPTCHA_API_KEY);

    console.log('\n' + '='.repeat(70));
    console.log('✅ STEP 1-2 COMPLETE — logged in successfully');
    console.log(`   Current page: ${smailPage.url()}`);
    console.log('='.repeat(70));
    console.log('\nStopping here as requested. Leaving the browser open for 20s so you can look, then closing...');

    await new Promise(r => setTimeout(r, 20_000));
  } catch (e) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ STEP 1-2 FAILED');
    console.error(`   ${e.message}`);
    console.error('='.repeat(70));
    process.exitCode = 1;
  } finally {
    watching = false;
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    console.log('\n[Done] Browser closed.');
  }
}

main();
