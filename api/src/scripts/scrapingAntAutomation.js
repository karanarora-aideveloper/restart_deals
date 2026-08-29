/**
 * ScrapingAnt Token Automation — Node.js / Playwright rewrite
 *
 * Pipeline:
 *   0. Launch stealth headless browser (no extensions needed)
 *   1. Login to Smail Pro (sonjj.com) + generate temp email
 *   2. Open ScrapingAnt signup, fill form
 *   3. Solve reCAPTCHA via 2Captcha API
 *   4. Submit signup
 *   5. Poll Smail inbox for verification email
 *   6. Open verification link, extract API token
 *   7. Return { email, token, createdAt }
 *
 * Designed to run headless on Mac or EC2 Linux. No browser extensions.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  extractRecaptchaSitekey, solveRecaptchaV2, injectRecaptchaResponse,
  extractTurnstileSitekey, isTurnstileAlreadySolved, solveTurnstile, injectTurnstileResponse,
} from './captchaSolver.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Config ──────────────────────────────────────────────────────────────────

const SMAIL_EMAIL_URL = 'https://smailpro.com/temporary-email';
const SCRAPINGANT_SIGNUP_URL = 'https://app.scrapingant.com/signup';

// Sonjj account — passwordless (email + one-time code / SSO session cookie)
const SMAIL_USERNAME = process.env.SMAIL_USERNAME || 'arorakaran6992@gmail.com';

// 2Captcha API key
const TWOCAPTCHA_API_KEY = process.env.TWOCAPTCHA_API_KEY || '00f69cd4eefad8d5ccfe712289733973';

// Session persistence file (cookies + localStorage)
const SESSION_FILE = path.join(__dirname, '..', '..', 'smail_session.json');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomDelay(minMs = 800, maxMs = 2500) {
  return new Promise(r => setTimeout(r, minMs + Math.random() * (maxMs - minMs)));
}

/**
 * Correctly WAIT for a locator to become visible, up to `timeout`ms.
 *
 * `locator.isVisible({ timeout })` is commonly mistaken for a polling wait —
 * it isn't. Per Playwright's own semantics, isVisible() checks the DOM at
 * that instant and returns immediately; the `timeout` option does not make
 * it retry. Confirmed empirically (see _test_isvisible.mjs repro, run
 * 2026-08-19): an element that appeared 2000ms after page load was reported
 * "not visible" by isVisible({timeout:5000}) in 16ms.
 *
 * Use this wherever the real question is "wait for this optional/dynamic
 * element to render, then tell me if it did" — e.g. deciding whether a login
 * step is still required. Bugs from the old isVisible({timeout}) pattern:
 * a slow-rendering page reads as "element absent" before it's actually had
 * a chance to appear, which flips control flow onto the wrong branch (e.g.
 * `stillNeedsEmail` in loginToSmail() wrongly concluding "already logged in").
 */
function waitVisible(locator, timeout = 5000) {
  return locator.waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false);
}

/**
 * Sonjj's email+code sign-in form does not live on the top-level page —
 * it's Ghost's member-portal popup, rendered inside an anonymous `srcdoc`
 * iframe with no id/class to select by (a sibling Stripe fraud-detection
 * iframe sits alongside it, and the top-level page has its own unrelated
 * hidden email input). Confirmed via a live Playwright frame-tree dump,
 * 2026-08-19: `page.frames()` showed the real email input + Continue button
 * together in one `about:srcdoc` frame, while the top-level frame matched
 * only the email input (0 Continue buttons) — that mismatch is exactly why
 * `page.locator("button:has-text('Continue')").click()` used to hang for
 * the full 30s and time out on every run.
 *
 * Poll every frame on the page for one where `selector` actually resolves,
 * and return that Frame (use its own .locator()/.evaluate()/etc. from here
 * on instead of `page`'s) — robust to the iframe being anonymous and to
 * exactly how many wrapper frames Stripe/Ghost insert around it.
 */
async function findFrameWithLocator(page, selector, { timeout = 15_000, pollInterval = 300 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      if (frame.isDetached()) continue;
      try {
        const count = await frame.locator(selector).count();
        if (count > 0) return frame;
      } catch { /* frame navigating mid-check — try the next one */ }
    }
    await new Promise(r => setTimeout(r, pollInterval));
  }
  return null;
}

const STEALTH_UA = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
];

function pickUA() { return STEALTH_UA[Math.floor(Math.random() * STEALTH_UA.length)]; }

// ─── Stealth init script ────────────────────────────────────────────────────

const STEALTH_JS = `
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  window.chrome = { runtime: {} };
  const origQuery = window.navigator.permissions.query;
  window.navigator.permissions.query = (params) =>
    params.name === 'notifications'
      ? Promise.resolve({ state: Notification.permission })
      : origQuery(params);
  Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
`;

// ─── Session Management ─────────────────────────────────────────────────────

async function saveSession(context, page) {
  try {
    const cookies = await context.cookies();
    const localStorage = await page.evaluate(() => {
      const s = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        s[k] = window.localStorage.getItem(k);
      }
      return s;
    });
    fs.writeFileSync(SESSION_FILE, JSON.stringify({ cookies, localStorage, savedAt: new Date().toISOString() }, null, 2));
    console.log(`[Smail] Session saved (${cookies.length} cookies)`);
  } catch (e) {
    console.warn(`[Smail] Could not save session: ${e.message}`);
  }
}

async function loadSession(context) {
  try {
    if (!fs.existsSync(SESSION_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    if (data.cookies?.length) {
      await context.addCookies(data.cookies);
      console.log(`[Smail] Restored ${data.cookies.length} cookies from session file`);
    }
    return data;
  } catch (e) {
    console.warn(`[Smail] Could not load session: ${e.message}`);
    return null;
  }
}

async function restoreLocalStorage(page, sessionData) {
  if (!sessionData?.localStorage) return;
  await page.evaluate((data) => {
    Object.entries(data).forEach(([k, v]) => window.localStorage.setItem(k, v));
  }, sessionData.localStorage);
}

// ─── Step 1a: Login to Smail Pro ────────────────────────────────────────────

/**
 * Check for + solve whatever CAPTCHA is present on the current page.
 * Sonjj's login form uses Cloudflare Turnstile (auto-solves silently in a
 * real browser most of the time, since it's an invisible JS challenge —
 * we still fall back to 2Captcha if it hasn't self-cleared after a beat).
 * ScrapingAnt's signup uses classic reCAPTCHA v2, so we check for both.
 */
async function solveAnyCaptchaOnPage(page, captchaApiKey, label) {
  const apiKey = captchaApiKey || TWOCAPTCHA_API_KEY;

  // Turnstile — give it a moment to self-solve invisibly first (free)
  const turnstile = await extractTurnstileSitekey(page);
  if (turnstile) {
    await randomDelay(1500, 2500);
    const alreadySolved = await isTurnstileAlreadySolved(page);
    if (alreadySolved) {
      console.log(`[Smail] ✓ Turnstile auto-solved silently on ${label}`);
      return true;
    }

    console.log(`[Smail] Turnstile detected on ${label} (sitekey: ${turnstile.sitekey.substring(0, 12)}...), solving via 2Captcha...`);
    if (!apiKey) throw new Error(`Turnstile on ${label} but no 2Captcha API key available`);
    const token = await solveTurnstile({
      apiKey,
      sitekey: turnstile.sitekey,
      pageUrl: page.url(),
      action: turnstile.action,
      timeout: 180_000,
    });
    await injectTurnstileResponse(page, token);
    await randomDelay(500, 1000);
    console.log(`[Smail] ✓ Turnstile solved on ${label}`);
    return true;
  }

  // reCAPTCHA v2 fallback (not currently present on sonjj, kept defensively)
  const sitekey = await extractRecaptchaSitekey(page);
  if (sitekey) {
    console.log(`[Smail] reCAPTCHA detected on ${label} (sitekey: ${sitekey.substring(0, 12)}...)`);
    if (!apiKey) throw new Error(`reCAPTCHA on ${label} but no 2Captcha API key available`);
    const solution = await solveRecaptchaV2({ apiKey, sitekey, pageUrl: page.url(), timeout: 180_000 });
    await injectRecaptchaResponse(page, solution);
    await randomDelay(1000, 2000);
    console.log(`[Smail] ✓ reCAPTCHA solved on ${label}`);
    return true;
  }

  return false;
}

/**
 * Log in to Smail Pro via its own "Sign in" flow (NOT by navigating to
 * my.sonjj.com/login directly — that authenticates my.sonjj.com in
 * isolation but never redirects back, so smailpro.com is left logged out).
 *
 * sonjj.com and smailpro.com are different top-level domains — cookies set
 * on one are never sent to the other. smailpro.com's own "Sign in" link
 * carries a `?back=https://smailpro.com/...` param through my.sonjj.com's
 * login, so a successful SSO there redirects all the way back here with
 * smailpro.com's own session established. Confirmed empirically: going to
 * my.sonjj.com/login directly leaves smailpro.com in guest state even after
 * my.sonjj.com itself shows fully authenticated.
 *
 * This account has no password — it's passwordless (email + one-time code,
 * or SSO off an existing sonjj.com session cookie that lasts for days).
 *
 * Flow:
 *   1. Go directly to my.sonjj.com/login?back=<smailpro.com URL, encoded> —
 *      this is exactly the URL smailpro.com's own "Sign in" link would send
 *      us to, so it's safe to skip that click chain (open user menu, find
 *      "Sign in" text) entirely; it was just two extra fragile UI-hunting
 *      steps on smailpro.com for no behavioral difference. Confirmed
 *      directly in a real browser 2026-08-19 — same login form, same SSO
 *      button, same eventual redirect back. (The `back=` param is still
 *      required for this to work; going to /login with no back= at all is
 *      what the old comment below warns against, not this.)
 *   2a. If my.sonjj.com's session cookie is already valid, it bounces
 *       straight back to smailpro.com, already logged in. Done.
 *   2b. Otherwise click "Sign in with Sonjj.com" for SSO:
 *       - Case A: sonjj.com's own session cookie is still valid → instant,
 *         redirects back through to smailpro.com.
 *       - Case B: needs a fresh email+code login. We fill the email, then
 *         RACE two outcomes: (i) the magic link in that email gets
 *         auto-completed in the background — Gmail's own link-scanning
 *         security feature frequently does this within seconds, before a
 *         human ever reads the email — or (ii) the admin panel submits the
 *         code. Whichever happens first wins; the other is cancelled.
 */
async function loginToSmail(context, captchaApiKey) {
  const backUrl = `https://my.sonjj.com/login?back=${encodeURIComponent(SMAIL_EMAIL_URL)}`;
  console.log(`[Smail] Going straight to Sonjj login (${backUrl})...`);
  const page = await context.newPage();

  try {
    await page.goto(backUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    console.log('[Smail] Landed on my.sonjj.com/login...');
    await randomDelay(1000, 2000);

    // BUG (fixed): this used to be `page.url().includes('smailpro.com')`, which
    // false-positives immediately — my.sonjj.com/login?back=https%3A%2F%2Fsmailpro.com%2F...
    // contains the literal substring "smailpro.com" in its own `back=` query
    // param while we're still sitting ON my.sonjj.com, never having redirected
    // anywhere. That made this branch fire unconditionally, every run, skipping
    // the "Sign in with Sonjj.com" click entirely — confirmed live 2026-08-19
    // (log always showed the "already valid" line with zero SSO interaction,
    // then failed final verification 100% of the time). Check the actual host
    // we landed on instead of substring-matching the whole URL.
    if (new URL(page.url()).hostname.endsWith('smailpro.com')) {
      console.log('[Smail] ✓ my.sonjj.com session was already valid — bounced straight back, logged in');
    } else {
      // On my.sonjj.com/login?back=... — need to establish that session via SSO
      const ssoBtn = page.locator("button:has-text('Sign in with Sonjj.com')").first();
      await ssoBtn.waitFor({ state: 'visible', timeout: 15_000 });
      await ssoBtn.click();
      console.log('[Sonjj] Clicked "Sign in with Sonjj.com", waiting for redirect...');
      await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
      await randomDelay(1000, 2000);

      const stillNeedsEmail = await waitVisible(
        page.locator("input[type='email'], input[placeholder*='example.com']").first(),
        5000
      );

      if (!stillNeedsEmail) {
        console.log('[Sonjj] ✓ SSO auto-login succeeded via existing sonjj.com session cookie — no code needed');
      } else {
        // Case B: sonjj.com wants a fresh email+code login.
        console.log('[Sonjj] No active sonjj.com session — starting email+code login...');

        // The real form lives inside an anonymous srcdoc iframe (Ghost's
        // portal popup) — find the frame that actually has it rather than
        // assuming top-level `page`. See findFrameWithLocator() docs above.
        const formFrame = await findFrameWithLocator(page, "button:has-text('Continue')", { timeout: 15_000 });
        if (!formFrame) {
          throw new Error('Could not locate the Sonjj sign-in form (email + Continue button) in any frame — page structure may have changed');
        }
        console.log('[Sonjj] Found sign-in form in frame:', formFrame.url() || '(srcdoc)');

        const emailInput = formFrame.locator("input[type='email'], input[placeholder*='example.com']").first();
        await emailInput.fill(SMAIL_USERNAME);
        await randomDelay(400, 900);

        const continueBtn = formFrame.locator("button:has-text('Continue')").first();
        await continueBtn.click();
        await randomDelay(1000, 2000);

        // Defensive: solve a Turnstile/reCAPTCHA if sonjj.com shows one here
        // (same frame — Frame exposes the same locator()/evaluate()/content()
        // API solveAnyCaptchaOnPage() needs, so this works unchanged)
        await solveAnyCaptchaOnPage(formFrame, captchaApiKey, 'sonjj email step');

        // Confirm the "check your email" screen appeared (same frame).
        // BUG (fixed): a comma-joined `"text=A, text=B"` selector-list times
        // out on waitFor() even when each half matches fine on its own via
        // .count() — confirmed directly 2026-08-19 (both halves matched
        // count=1 individually; the combined string hung the full 10s every
        // time). Use Locator.or() instead of string-splicing two `text=`
        // selectors together.
        const checkEmailVisible = await waitVisible(
          formFrame.locator("text=check your email").first().or(formFrame.locator("text=Now check your email").first()),
          10_000
        );
        if (!checkEmailVisible) {
          throw new Error('Expected "check your email" screen did not appear after submitting email');
        }

        // RACE: admin-submitted code vs. the magic link auto-completing in
        // the background (Gmail's link scanner often wins this race).
        let stopPolling = false;
        const autoCompletePromise = (async () => {
          const deadline = Date.now() + 5 * 60 * 1000;
          while (Date.now() < deadline && !stopPolling) {
            await new Promise(r => setTimeout(r, 2000));
            const stillWaiting = await formFrame
              .locator("text=Now check your email")
              .first()
              .isVisible()
              .catch(() => false);
            if (!stillWaiting) return { type: 'auto' };
          }
          return null;
        })();

        const codePromise = waitForOtpCode(SMAIL_USERNAME, 5 * 60 * 1000)
          .then(code => ({ type: 'code', code }))
          .catch(err => ({ type: 'error', err }));

        const result = await Promise.race([
          codePromise,
          autoCompletePromise.then(r => r || new Promise(() => {})), // null → never resolve; let codePromise/timeout decide
        ]);
        stopPolling = true;

        if (result.type === 'auto') {
          console.log('[Sonjj] ✓ Magic link auto-completed in the background — no code needed');
          cancelOtpWait('auto-completed via magic link before a code was submitted');
        } else if (result.type === 'error') {
          throw result.err;
        } else {
          console.log('[Sonjj] Code received from admin panel, submitting...');
          const codeInput = formFrame.locator("input[type='text'], input:not([type])").first();
          await codeInput.waitFor({ state: 'visible', timeout: 10_000 });
          await codeInput.fill(result.code);
          await randomDelay(500, 1000);

          const submitBtnSelectors = ["button:has-text('Verify')", "button:has-text('Confirm')", "button:has-text('Submit')", "button:has-text('Continue')"];
          for (const sel of submitBtnSelectors) {
            const btn = formFrame.locator(sel).first();
            if (await waitVisible(btn, 1500)) {
              await btn.click();
              console.log(`[Sonjj] Clicked "${sel}" to submit code`);
              break;
            }
          }
          await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
          console.log('[Sonjj] ✓ Email+code login succeeded');
        }

        await randomDelay(1000, 2000);
      }

    }

    // Final verification: always navigate fresh to smailpro.com (whichever
    // sub-path we took above may have left us on my.sonjj.com's own
    // dashboard, an intermediate redirect, or smailpro.com already — don't
    // guess from the current URL, just go there) and confirm the menu no
    // longer says Guest. Retries a few times since the SPA needs a beat to
    // hydrate after `domcontentloaded` (vs. the stricter `networkidle` this
    // used to wait for, which this site never actually reaches).
    await page.goto(SMAIL_EMAIL_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await randomDelay(1500, 2500);

    let nameText = '';
    for (let attempt = 1; attempt <= 3; attempt++) {
      const verifyMenuBtn = page.locator("button[aria-label='btn user']").first();
      const btnVisible = await waitVisible(verifyMenuBtn, 8000);
      if (btnVisible) {
        await verifyMenuBtn.click().catch(() => {});
        await randomDelay(600, 1200);
        nameText = (await page.locator('span.text-sm.text-gray-900').first().textContent().catch(() => '')).trim();
        await page.mouse.click(0, 0);
        if (nameText && !/guest/i.test(nameText)) break;
      }
      console.log(`[Smail] Verification attempt ${attempt}/3: menu shows "${nameText || '(empty)'}", retrying...`);
      await randomDelay(1500, 2000);
    }
    if (!nameText || /guest/i.test(nameText)) {
      throw new Error(`Login flow completed but smailpro.com still shows guest state (menu: "${nameText || '(empty)'}")`);
    }
    console.log(`[Smail] ✓ Confirmed logged in on smailpro.com as: ${nameText}`);

    await saveSession(context, page);
    await page.close();
    return true;
  } catch (e) {
    console.error(`[Smail] Login failed: ${e.message}`);
    await page.close().catch(() => {});
    // Preserve the real error detail — the caller previously collapsed any
    // failure here into a generic "Smail login failed" with no way to tell
    // a Turnstile timeout from a missing button from a network error.
    const wrapped = new Error(`Smail login failed: ${e.message}`);
    wrapped.cause = e;
    throw wrapped;
  }
}

// ─── Step 1b: Get authenticated Smail page ──────────────────────────────────

export async function getAuthenticatedSmailPage(context, captchaApiKey) {
  const sessionData = await loadSession(context);
  const page = await context.newPage();

  try {
    await page.goto(SMAIL_EMAIL_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    if (sessionData) await restoreLocalStorage(page, sessionData);

    // Check if logged in by opening the user menu ("btn user") and reading
    // the "Hi! <name>" text. Logged-out state shows "Hi! Guest" — that same
    // span is used in both states, so we must check its CONTENT, not just
    // whether it's non-empty (a "Hi! Guest" match previously looked like a
    // valid session because the text was non-empty).
    await randomDelay(1000, 2000);
    const menuBtn = page.locator("button[aria-label='btn user']").first();
    if (await waitVisible(menuBtn, 5000)) {
      await menuBtn.click();
      await randomDelay(500, 1000);
      const nameEl = page.locator("span.text-sm.text-gray-900").first();
      const nameText = (await nameEl.textContent().catch(() => '')).trim();
      await page.mouse.click(0, 0); // close menu

      const isGuest = !nameText || /guest/i.test(nameText);
      if (!isGuest) {
        console.log(`[Smail] ✓ Session valid, logged in as: ${nameText}`);
        return page;
      }
      console.log(`[Smail] Not logged in (menu shows "${nameText || '(empty)'}")`);
    }

    // Session invalid — login fresh
    console.log('[Smail] Session expired or invalid, performing fresh login...');
    await page.close();
    await loginToSmail(context, captchaApiKey); // throws with detail on failure

    // Re-open page with new session
    const freshPage = await context.newPage();
    const freshSession = await loadSession(context);
    await freshPage.goto(SMAIL_EMAIL_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    if (freshSession) await restoreLocalStorage(freshPage, freshSession);
    await randomDelay(1000, 2000);
    return freshPage;
  } catch (e) {
    console.error(`[Smail] Auth check failed: ${e.message}`);
    await page.close().catch(() => {});
    throw e;
  }
}

// ─── Step 1c: Generate temp email ───────────────────────────────────────────

async function generateTempEmail(page) {
  console.log('[Smail] Generating new temporary email...');

  // Count existing emails before generation
  const countBefore = await page.locator("ul.max-h-\\[38rem\\] li:visible").count().catch(() => 0);

  // Delete any already-active email(s) FIRST.
  //
  // BUG (fixed 2026-08-29): the real behavior of the "Create" button
  // (`@click="openCreate()"`) is STATE-DEPENDENT, not renamed/relocated as
  // two earlier fixes here wrongly guessed:
  //   - With ZERO active emails, "Create" opens the full "Create temporary
  //     email" config modal (provider choice, Real Account, premium server —
  //     everything this automation needs). Confirmed live 2026-08-29.
  //   - With ONE OR MORE active emails already present — which is the
  //     NORMAL state, since simply loading /temporary-email while logged in
  //     auto-restores/creates one — "Create" does something else entirely
  //     (instant-generate with last-used settings, or a limit-reached
  //     prompt), skipping the modal outright. That's why every previous
  //     selector fix here failed: there was no modal to search inside.
  //   - The gear icon (`title="Settings"`) is an unrelated, newer feature
  //     (an "auto-delete oldest email" toggle) — not a path to this modal
  //     at all. An earlier fix mistook one coincidental render for the other.
  // The reliable fix: clear every active email first so "Create" always
  // starts from the zero-active state that opens the real config modal.
  //
  // BUG (fixed 2026-08-29, x2): two single-shot timing guesses here both
  // failed live — a bare instant isVisible() check, then a fixed 8s wait —
  // because the auto-restored active email doesn't render on any
  // predictable schedule, AND clicking "Create" from zero-active isn't
  // 100% guaranteed to open the modal either (confirmed live: it still
  // sometimes just instant-generates, leaving a fresh active email behind
  // and no modal). Rather than bet on exact timing/state semantics this
  // app doesn't document, retry the whole clear-then-create cycle a few
  // times until the modal genuinely appears.
  async function clearActiveEmails() {
    let cleared = 0;
    while (cleared < 10) {
      const itemDeleteBtn = page.locator("li button:has-text('Delete')").first();
      const hasActiveEmail = cleared === 0
        ? await waitVisible(itemDeleteBtn, 8_000)
        : await itemDeleteBtn.isVisible().catch(() => false);
      if (!hasActiveEmail) break;
      await itemDeleteBtn.click();
      await randomDelay(300, 600);
      const confirmDeleteBtn = page.locator('[role="dialog"] button:has-text("Delete")').first();
      if (await waitVisible(confirmDeleteBtn, 3_000)) {
        await confirmDeleteBtn.click();
        await randomDelay(500, 900);
      }
      cleared++;
    }
    return cleared;
  }

  let modalOpened = false;
  for (let attempt = 1; attempt <= 3 && !modalOpened; attempt++) {
    const cleared = await clearActiveEmails();
    if (cleared > 0) {
      console.log(`[Smail] Cleared ${cleared} existing active email(s) before creating a fresh one (attempt ${attempt})`);
    }

    // BUG (fixed 2026-08-29 — the ACTUAL root cause of every attempt at this
    // file since): "button:has-text('Create')" is not unique. It ALSO
    // matches a hidden `confirmLimitPrompt()` button whose label is "Remove
    // & create" (part of the "Active email limit reached" dialog's markup,
    // present in the DOM — just hidden — once that dialog has ever been
    // instantiated). `.first()` was resolving to THAT hidden button, so
    // waitVisible() correctly timed out waiting for an element that could
    // never become visible, while the real, visible "Create" button sat
    // right there unused. Confirmed live via Playwright's own timeout log:
    // "24 × locator resolved to hidden <button ... @click=\"confirmLimitPrompt()\">".
    // getByRole with exact:true matches only the literal "Create" accessible
    // name, sidestepping the substring collision entirely.
    const createBtn = page.getByRole('button', { name: 'Create', exact: true }).first();
    if (await waitVisible(createBtn, 10_000)) {
      await createBtn.click();
      console.log(`[Smail] Create button clicked (attempt ${attempt})`);
    }

    await randomDelay(1000, 2000);

    modalOpened = await waitVisible(page.locator("h3:has-text('Create temporary email')"), 6_000);
    if (!modalOpened) {
      console.log(`[Smail] Create-email modal did not open on attempt ${attempt} — retrying`);
    }
  }
  if (!modalOpened) {
    throw new Error('Create-email config modal never opened after 3 clear-and-click attempts');
  }

  // Select the Microsoft provider. The Account Type / Server sections below
  // only render once a provider (Google/Microsoft) is actually active —
  // flaky clicks here (confirmed live: intermittent, 2 of ~8 real runs)
  // surface downstream as "Real Account button not found," which is
  // misleading. Verify the active state, retrying the click a couple of
  // times, instead of a single click + fixed delay.
  //
  // NOTE 2026-08-29: an earlier fix here wrongly guessed the button had been
  // renamed "Outlook" (based on smailpro.com's marketing copy) — confirmed
  // live against the real modal that it's still literally "Microsoft".
  // The real bug was the Create-button click above never opening this modal
  // at all, so there was nothing for either text to match. Reverted to
  // "Microsoft" only.
  const providerBtn = page.locator("button:has-text('Microsoft')").first();
  if (!(await waitVisible(providerBtn, 10_000))) {
    // TEMPORARY diagnostic (added 2026-08-29, remove once this is diagnosed):
    // the Settings-button fix opens *something* (confirmed via its own log
    // line above) but "Microsoft" still isn't found in production's headless
    // stealth browser, despite working reliably in a visible/headed Chrome
    // session against the same account. Log the page URL, every currently-
    // OPEN dialog's heading, and a short excerpt of body text so the next
    // real run shows what's actually rendered (a slow-loading modal, a bot
    // check, a different dialog like "Active email limit reached", etc.)
    // instead of another blind guess.
    try {
      const url = page.url();
      const dialogHeadings = await page.locator('dialog:visible, [role="dialog"]:visible').locator('h3, h2').allInnerTexts().catch(() => []);
      const bodyExcerpt = (await page.locator('body').innerText().catch(() => '')).slice(0, 800);
      console.log('[Smail Diagnostic] url:', url);
      console.log('[Smail Diagnostic] visible dialog headings:', JSON.stringify(dialogHeadings));
      console.log('[Smail Diagnostic] body text excerpt:', JSON.stringify(bodyExcerpt));
    } catch (diagErr) {
      console.log('[Smail Diagnostic] Failed to dump page state:', diagErr.message);
    }
    throw new Error('Could not find the "Microsoft" provider button in the Create-email modal — page structure may have changed');
  }
  let providerActive = false;
  for (let attempt = 0; attempt < 3 && !providerActive; attempt++) {
    await providerBtn.click();
    await randomDelay(700, 1200);
    providerActive = await providerBtn.evaluate(el => el.className.includes('border-blue')).catch(() => false);
  }
  console.log(`[Smail] Microsoft provider clicked (active state detected: ${providerActive})`);
  if (!providerActive) {
    throw new Error('Microsoft provider selection did not stick after 3 attempts');
  }
  await randomDelay(500, 900);

  // Select Real Account (this account has Premium — required, not optional).
  // Verify the click actually stuck by re-reading the button's selected
  // state afterward, instead of just trusting "the click didn't throw."
  const realBtn = page.locator("button:has-text('Real Account')").first();
  if (!(await waitVisible(realBtn, 10_000))) {
    throw new Error('Could not find the "Real Account" button in the Create-email modal — page structure may have changed');
  }
  await realBtn.click();
  await randomDelay(500, 900);
  const realAccountActive = await realBtn.evaluate(el =>
    el.className.includes('border-blue') || el.getAttribute('aria-pressed') === 'true' || el.className.includes('selected')
  ).catch(() => false);
  console.log(`[Smail] Real Account clicked (active state detected: ${realAccountActive})`);
  await randomDelay(800, 1500);

  // Select a premium server (server-2: 1000 pcs, Premium — matches server-3's
  // pool size and beats server-4's 521; server-1 is the free default).
  // Verify the select's value actually changed, not just that selectOption()
  // didn't throw.
  const serverSelect = page.locator("select[x-model='query.server']").first();
  if (!(await waitVisible(serverSelect, 10_000))) {
    throw new Error('Could not find the server <select> in the Create-email modal — page structure may have changed');
  }
  await serverSelect.selectOption({ value: '2' });
  await randomDelay(300, 600);
  const serverValue = await serverSelect.inputValue();
  if (serverValue !== '2') {
    throw new Error(`Server selection didn't stick — expected value "2" (premium), got "${serverValue}"`);
  }
  console.log('[Smail] ✓ Premium server-2 selected and confirmed');
  await randomDelay(800, 1500);

  // Click Generate
  const genSelectors = ["button:has-text('Generate')", "button[type='submit']:has-text('Generate')"];
  let generateClicked = false;
  for (const sel of genSelectors) {
    const btn = page.locator(sel).first();
    if (await waitVisible(btn, 10_000)) {
      const disabled = await btn.getAttribute('disabled');
      if (!disabled) {
        await btn.click();
        console.log('[Smail] Generate clicked');
        generateClicked = true;
        break;
      }
    }
  }
  if (!generateClicked) {
    throw new Error('Could not click the "Generate" button in the Create-email modal');
  }

  // Wait for email to appear
  console.log('[Smail] Waiting for email generation...');
  await randomDelay(3000, 5000);

  // Verify a new email appeared
  for (let attempt = 0; attempt < 5; attempt++) {
    const countAfter = await page.locator("ul.max-h-\\[38rem\\] li:visible").count().catch(() => 0);
    if (countAfter > countBefore) {
      console.log(`[Smail] ✓ New email detected (list: ${countBefore} → ${countAfter})`);
      break;
    }
    await randomDelay(2000, 3000);
  }

  // Click first email in list to select it
  try {
    const firstLi = page.locator("ul.max-h-\\[38rem\\] li:visible").first();
    if (await firstLi.isVisible()) {
      await firstLi.click();
      await randomDelay(1000, 2000);
    }
  } catch { /* ok */ }

  // Extract the generated email address.
  //
  // BUG (fixed 2026-08-29): the last selector here, `span.font-semibold:has-
  // text('@')`, is too broad — it can match the modal's rename-field example
  // text (e.g. "random[real]@outlook.com-2", the placeholder hint shown for
  // a Microsoft+Real-Account combo) instead of the actual generated address.
  // Confirmed live: that exact malformed string got passed to ScrapingAnt's
  // signup, which correctly rejected it with HTTP 422 "value is not a valid
  // email address" — wasting a full cycle (email create + signup + captcha
  // solve) on a value that could never have worked. A strict format check
  // now guards every candidate regardless of which selector produced it, so
  // a placeholder/hint string can never be mistaken for a real address.
  const emailSelectors = [
    "[x-text='selectedEmail.address']",
    "ul.max-h-\\[38rem\\] li:visible:first-child span.font-semibold.text-gray-800",
    "span.font-semibold:has-text('@')",
  ];
  const isPlausibleEmail = (s) =>
    /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(s);

  for (const sel of emailSelectors) {
    try {
      const el = page.locator(sel).first();
      const text = await el.textContent();
      const email = text?.trim();
      if (email && isPlausibleEmail(email)) {
        console.log(`[Smail] ✓ Generated email: ${email}`);
        return email;
      }
      if (email) {
        console.log(`[Smail] Selector "${sel}" matched non-email text, skipping: "${email}"`);
      }
    } catch { /* try next */ }
  }

  throw new Error('Could not extract generated email address from Smail');
}

// ─── Step 2: ScrapingAnt Signup ─────────────────────────────────────────────

async function signupScrapingAnt(context, email, captchaApiKey) {
  console.log(`[ScrapingAnt] Opening signup page...`);
  const page = await context.newPage();

  // Capture the actual register API response — this is what tells us WHY a
  // submission failed (e.g. "Email provider is invalid", rate limiting),
  // confirmed live 2026-08-19 via network inspection: the real endpoint is
  // POST /external/register?bare_token=..., and its JSON body has the exact
  // server-side rejection reason. Scraping visible page text for an error
  // banner (the old approach) found nothing because ScrapingAnt doesn't
  // necessarily render this as a visible UI message.
  let registerResponse = null;
  page.on('response', async (res) => {
    if (res.url().includes('/external/register')) {
      let body = '';
      try { body = await res.text(); } catch { /* ignore */ }
      registerResponse = { status: res.status(), body };
    }
  });

  try {
    await page.goto(SCRAPINGANT_SIGNUP_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    console.log('[ScrapingAnt] Signup page loaded');

    // Fill email — wait for the field to actually render before filling.
    // BUG (fixed): the old bare isVisible() checks here ran instantly right
    // after goto(), before ScrapingAnt's Vuetify SPA had hydrated any form
    // fields (domcontentloaded fires well before that). Every fill silently
    // no-op'd as a result — confirmed live 2026-08-19: no "Email filled" /
    // "Password filled" / "Terms checkbox clicked" log line ever printed,
    // the form stayed empty, the Sign Up button stayed disabled so it was
    // never actually clicked either, and the 2Captcha solve that ran anyway
    // (unconditionally, before this loop's silent failure had any chance to
    // surface) was pure waste against a form that could never have
    // submitted. Now waits properly and throws instead of continuing silently.
    // BUG (fixed): `input#input-23` and `input[name='email']` never match —
    // confirmed by querying the real DOM 2026-08-19: the email field is
    // type="text", name="" (empty), and its id is Vuetify's auto-incrementing
    // per-page-load counter (observed as "input-24" one run) — NOT the
    // hardcoded "input-23". That counter shifts based on whatever else
    // renders before the form (Intercom widget, etc.), so a hardcoded id is
    // never reliable. `input[type='email']` also doesn't match since the
    // field is really type="text". Match on type='text' instead — exactly
    // one such field exists on this form, and type is stable (same pattern
    // already relied on for the password fields via input[type='password']).
    const emailSelectors = ["input[type='text']", "input[type='email']", "input[name='email']"];
    let emailFilled = false;
    for (const sel of emailSelectors) {
      const input = page.locator(sel).first();
      if (await waitVisible(input, 15_000)) {
        await input.fill(email);
        console.log('[ScrapingAnt] Email filled');
        emailFilled = true;
        break;
      }
    }
    if (!emailFilled) {
      throw new Error('Could not find the email input on the ScrapingAnt signup page — page structure may have changed');
    }
    await randomDelay(800, 1500);

    // Fill password fields (password = email, same as Python script)
    const passwordFields = page.locator("input[type='password']");
    await waitVisible(passwordFields.first(), 10_000);
    const pwCount = await passwordFields.count();
    if (pwCount < 1) {
      throw new Error('Could not find any password input on the ScrapingAnt signup page');
    }
    await passwordFields.nth(0).fill(email);
    console.log('[ScrapingAnt] Password filled');
    await randomDelay(500, 1000);
    if (pwCount >= 2) {
      await passwordFields.nth(1).fill(email);
      console.log('[ScrapingAnt] Confirm password filled');
    }
    await randomDelay(500, 1000);

    // Click terms checkbox
    const checkboxSelectors = [
      "input#input-34",
      "label[for='input-34']",
      ".v-input--selection-controls__input",
      "input[type='checkbox']",
    ];
    let checkboxClicked = false;
    for (const sel of checkboxSelectors) {
      const cb = page.locator(sel).first();
      if (await waitVisible(cb, 5000)) {
        await cb.click({ force: true });
        console.log('[ScrapingAnt] Terms checkbox clicked');
        checkboxClicked = true;
        break;
      }
    }
    if (!checkboxClicked) {
      throw new Error('Could not find the terms checkbox on the ScrapingAnt signup page');
    }
    await randomDelay(1000, 2000);

    // ─── Solve reCAPTCHA via 2Captcha ───
    console.log('[ScrapingAnt] Looking for reCAPTCHA...');
    const sitekey = await extractRecaptchaSitekey(page);

    if (sitekey) {
      console.log(`[ScrapingAnt] reCAPTCHA found (sitekey: ${sitekey.substring(0, 12)}...)`);

      if (!captchaApiKey) {
        throw new Error('reCAPTCHA detected but TWOCAPTCHA_API_KEY is not set');
      }

      const solution = await solveRecaptchaV2({
        apiKey: captchaApiKey,
        sitekey,
        pageUrl: SCRAPINGANT_SIGNUP_URL,
        timeout: 180_000, // 3 min max
      });

      await injectRecaptchaResponse(page, solution);
      await randomDelay(1000, 2000);
    } else {
      console.log('[ScrapingAnt] No reCAPTCHA detected, proceeding...');
    }

    // Submit signup form.
    // BUG (fixed): this selector required text "Sign up" — the real button
    // says "Create free account" (confirmed via direct DOM query 2026-08-19,
    // twice). Zero overlap; this NEVER matched, in any run, regardless of
    // disabled state — the true final blocker underneath every other bug
    // fixed today. That's why "✓ Sign up button clicked" never once printed
    // even after the email/checkbox/recaptcha fixes landed.
    console.log('[ScrapingAnt] Submitting signup form...');
    let submitClicked = false;
    for (let attempt = 0; attempt < 10 && !submitClicked; attempt++) {
      const submitBtn = page.locator("button.v-btn:has-text('Create free account'):not([disabled])").first();
      if (await waitVisible(submitBtn, 2000)) {
        await submitBtn.click();
        console.log('[ScrapingAnt] ✓ Sign up button clicked');
        submitClicked = true;
        break;
      }
      await randomDelay(1500, 2500);
    }
    if (!submitClicked) {
      throw new Error('Sign up button never became enabled/clickable after 10 attempts — form may have failed client-side validation');
    }

    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await randomDelay(3000, 5000);
    const postSignupUrl = page.url();
    console.log(`[ScrapingAnt] Post-signup URL: ${postSignupUrl}`);
    console.log(`[ScrapingAnt] /external/register response:`, registerResponse ? JSON.stringify(registerResponse) : '(no request captured)');

    // BUG (fixed): this used to just log the URL and return regardless (and
    // its later fix only checked the URL) — confirmed live 2026-08-19 via
    // network inspection that the URL staying on /signup is a red herring:
    // ScrapingAnt's SPA doesn't navigate away on failure OR necessarily on
    // success. The real signal is POST /external/register's response body,
    // e.g. {"error":{"msg":"Email provider is invalid, please try another
    // email"}} (422) for a bad address, vs a 2xx for genuine success. Use
    // that instead of guessing from the URL.
    if (registerResponse && registerResponse.status >= 200 && registerResponse.status < 300) {
      console.log('[ScrapingAnt] ✓ Register API returned success status');
      return page;
    }
    if (registerResponse) {
      throw new Error(`Signup rejected by server (HTTP ${registerResponse.status}): ${registerResponse.body}`);
    }
    // No /external/register call was ever observed — the click plausibly
    // didn't actually trigger a submission at all. Fall back to the old
    // URL heuristic as a last resort, but this path shouldn't normally hit.
    if (postSignupUrl.includes('/signup')) {
      throw new Error(`Signup form submitted but no /external/register API call was observed, and still on the signup page (${postSignupUrl})`);
    }
    return page;
  } catch (e) {
    console.error(`[ScrapingAnt] Signup failed: ${e.message}`);
    await page.close();
    throw e;
  }
}

// ─── Step 3: Poll Smail inbox for verification email ────────────────────────

async function waitForVerificationEmail(smailPage, maxChecks = 30, intervalMs = 10_000) {
  console.log(`[Verify] Polling Smail inbox for ScrapingAnt verification email (up to ${maxChecks} checks)...`);

  for (let check = 1; check <= maxChecks; check++) {
    // BUG (fixed): every check below was wrapped in a catch-all that treated
    // "selector didn't match" and "browser is dead" identically — so an
    // abort (which force-closes the browser) never actually stopped this
    // loop; it silently kept polling a closed page for up to 5 more minutes
    // before finally erroring out. Confirmed live 2026-08-19: "Check 3/30",
    // "Check 4/30", "Check 5/30" kept printing well after the force-close
    // log line. Check both conditions explicitly and bail out immediately.
    if (automationState.abortRequested) {
      throw new Error('Aborted by user request');
    }
    if (smailPage.isClosed()) {
      throw new Error('Smail page was closed (browser likely force-closed) — cannot continue polling for the verification email');
    }

    console.log(`[Verify] Check ${check}/${maxChecks}...`);

    // Look for an email from ScrapingAnt
    const scrapingAntSelectors = [
      "div:has-text('ScrapingAnt')",
      "li:has-text('ScrapingAnt')",
      "span:has-text('ScrapingAnt')",
    ];

    for (const sel of scrapingAntSelectors) {
      try {
        const el = smailPage.locator(sel).first();
        if (await el.isVisible({ timeout: 2000 })) {
          const text = await el.textContent();
          if (text && text.toLowerCase().includes('scrapingant')) {
            console.log('[Verify] ✓ ScrapingAnt email found in inbox');

            // Click it to open
            await el.click();
            await randomDelay(2000, 3000);

            // Extract verification URL from email content
            return await extractVerificationUrl(smailPage);
          }
        }
      } catch { /* try next selector */ }
    }

    if (check < maxChecks) {
      // Refresh inbox — try clicking on a refresh/reload element or just wait
      try {
        // Some Smail UIs auto-refresh; if not, click the inbox area to trigger
        const refreshBtn = smailPage.locator("button:has-text('Refresh'), [title*='refresh']").first();
        if (await refreshBtn.isVisible({ timeout: 1000 })) {
          await refreshBtn.click();
        }
      } catch { /* auto-refresh hopefully handles it */ }

      await new Promise(r => setTimeout(r, intervalMs));
    }
  }

  throw new Error(`No ScrapingAnt verification email found after ${maxChecks} checks`);
}

async function extractVerificationUrl(smailPage) {
  // Try extracting from iframe srcdoc first (most Smail UIs render email in an iframe)
  const iframeSelectors = ["iframe[srcdoc]", "iframe[class*='w-full']", "iframe"];

  for (const iframeSel of iframeSelectors) {
    try {
      const iframe = smailPage.locator(iframeSel).first();
      if (await iframe.count() > 0) {
        // Try srcdoc attribute (contains full HTML of email)
        const srcdoc = await iframe.getAttribute('srcdoc');
        if (srcdoc) {
          const url = findVerificationUrlInText(srcdoc);
          if (url) return url;
        }

        // Try accessing iframe content
        const frame = await iframe.contentFrame();
        if (frame) {
          const bodyHtml = await frame.evaluate(() => document.body.innerHTML).catch(() => '');
          const url = findVerificationUrlInText(bodyHtml);
          if (url) return url;

          // Also check href attributes inside iframe
          const links = await frame.locator("a[href*='scrapingant'], a[href*='email_confirmed']").all();
          for (const link of links) {
            const href = await link.getAttribute('href');
            if (href && href.includes('email_confirmed')) return href;
          }
        }
      }
    } catch { /* try next */ }
  }

  // Fallback: check page text and links directly
  const pageHtml = await smailPage.content();
  const url = findVerificationUrlInText(pageHtml);
  if (url) return url;

  // Check direct links on page
  const links = await smailPage.locator("a[href*='scrapingant'], a[href*='email_confirmed']").all();
  for (const link of links) {
    const href = await link.getAttribute('href');
    if (href && href.includes('email_confirmed')) return href;
  }

  throw new Error('Could not extract verification URL from email content');
}

function findVerificationUrlInText(text) {
  const patterns = [
    /https?:\/\/app\.scrapingant\.com\/email_confirmed\/[^\s<>"']+/i,
    /https?:\/\/[^\s<>"']*scrapingant[^\s<>"']*email_confirmed[^\s<>"']*/i,
    /https?:\/\/[^\s<>"']*sendgrid[^\s<>"']*email_confirmed[^\s<>"']*/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Clean trailing punctuation
      return match[0].replace(/[.,;!?)\]}>]+$/, '').trim();
    }
  }
  return null;
}

// ─── Step 4: Verify email & extract token ───────────────────────────────────

async function verifyAndExtractToken(context, verificationUrl) {
  console.log(`[Token] Opening verification URL: ${verificationUrl}`);
  const page = await context.newPage();

  try {
    await page.goto(verificationUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(async () => {
      // Fallback to domcontentloaded
      await page.waitForLoadState('domcontentloaded', { timeout: 15_000 });
      await randomDelay(3000, 5000);
    });

    // BUG (fixed): confirming an email is very likely async on this page —
    // it loads, THEN fires an API call to actually verify the token and
    // establish a logged-in session, THEN (presumably) redirects. Checking
    // immediately after domcontentloaded and jumping straight to /dashboard
    // if nothing's found yet meant we sometimes hit /dashboard before that
    // session was ever established — confirmed live 2026-08-19: it bounced
    // all the way to a GitHub login page (unauthenticated dashboard access),
    // not ScrapingAnt's dashboard at all. Give it real time to finish.
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await randomDelay(3000, 5000);
    console.log(`[Token] Verification page settled at: ${page.url()}`);

    const pageText = await page.textContent('body');

    // Look for 32-char hex token (ScrapingAnt's format)
    const hexMatch = pageText.match(/\b[a-f0-9]{32}\b/);
    if (hexMatch) {
      console.log(`[Token] ✓ Extracted 32-char hex token: ${hexMatch[0]}`);
      await page.close();
      return hexMatch[0];
    }

    // Look for sk-* token pattern
    const skMatch = pageText.match(/sk-[a-zA-Z0-9_-]+/);
    if (skMatch) {
      console.log(`[Token] ✓ Extracted sk- token: ${skMatch[0].substring(0, 15)}...`);
      await page.close();
      return skMatch[0];
    }

    // Try finding token via DOM selectors
    const tokenSelectors = [
      "p:has-text('API token') b",
      "input[value*='sk-']",
      "code",
      "b",
    ];

    for (const sel of tokenSelectors) {
      try {
        const elements = await page.locator(sel).all();
        for (const el of elements) {
          const text = await el.textContent().catch(() => '');
          const value = await el.getAttribute('value').catch(() => '');
          const content = text || value || '';

          const hex = content.match(/\b[a-f0-9]{32}\b/);
          if (hex) {
            console.log(`[Token] ✓ Token found via selector "${sel}": ${hex[0]}`);
            await page.close();
            return hex[0];
          }

          const sk = content.match(/sk-[a-zA-Z0-9_-]+/);
          if (sk) {
            console.log(`[Token] ✓ Token found via selector "${sel}": ${sk[0].substring(0, 15)}...`);
            await page.close();
            return sk[0];
          }
        }
      } catch { /* try next */ }
    }

    // Fallback: try dashboard.
    // BUG (fixed): the dashboard's API token field is masked (••••••••) until
    // a reveal toggle is clicked, and it's NOT a real <input> — confirmed
    // live 2026-08-19: document.querySelectorAll('input') found zero
    // elements on this page. Scanning body text before revealing it can
    // never find the token. Find whatever clickable control sits nearest
    // the "API token" label and click it (via DOM structure, not pixel
    // coordinates — a coordinate-based click here landed on the wrong
    // element and logged out an unrelated session during testing), then
    // re-scan.
    console.log('[Token] Token not found on verification page, trying dashboard...');
    await page.goto('https://app.scrapingant.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await randomDelay(3000, 5000);

    // Try label-proximity first (works on an established account — confirmed
    // live). A brand-new, zero-usage account may render the dashboard
    // differently (e.g. an onboarding/"generate your key" state instead of
    // an existing masked token) — confirmed live 2026-08-19 this path can
    // return false there. Fall back to clicking every eye/reveal-looking
    // icon on the page and rescanning after each, rather than giving up.
    const revealAttempt = await page.evaluate(() => {
      const tryLabelProximity = () => {
        const labelTexts = ['API token', 'API Key', 'Your API key', 'API key'];
        const label = Array.from(document.querySelectorAll('*')).find(el =>
          el.children.length === 0 && labelTexts.includes(el.textContent.trim())
        );
        if (!label) return false;
        let container = label.parentElement;
        for (let i = 0; i < 4 && container; i++) {
          const clickable = container.querySelector('button, [role="button"], svg');
          if (clickable) { clickable.click(); return true; }
          container = container.parentElement;
        }
        return false;
      };
      if (tryLabelProximity()) return { method: 'label-proximity' };

      // Fallback: click every svg/button that looks like a reveal toggle
      // (icon-only buttons are usually small — under ~40px — and eye-icon
      // classes commonly mention "eye"; try those first, then all icon
      // buttons as a last resort).
      const candidates = Array.from(document.querySelectorAll('button svg, [role="button"] svg, button i, svg'))
        .map(el => el.closest('button, [role="button"]') || el)
        .filter(Boolean);
      const eyeish = candidates.filter(el => /eye/i.test(el.outerHTML));
      const tried = (eyeish.length ? eyeish : candidates).slice(0, 15);
      for (const el of tried) {
        try { el.click(); } catch { /* ignore */ }
      }
      return { method: 'broad-click', attempted: tried.length };
    }).catch(() => ({ method: 'error' }));
    console.log(`[Token] Dashboard reveal attempt:`, JSON.stringify(revealAttempt));
    await randomDelay(1000, 2000);

    // Targeted extraction first: read the value directly from the field
    // nearest the "API token" label (same DOM traversal as the reveal
    // click) rather than a blind whole-page regex. Confirmed live
    // 2026-08-19: the token WAS visible in the page ("API token | 722fa11...")
    // after the reveal click, but a body-wide /\b[a-f0-9]{32}\b/ scan still
    // didn't extract it — something about surrounding text/formatting broke
    // the match. Going straight to the known field is more reliable than
    // guessing why.
    const nearFieldText = await page.evaluate(() => {
      const labelTexts = ['API token', 'API Key', 'Your API key', 'API key'];
      const label = Array.from(document.querySelectorAll('*')).find(el =>
        el.children.length === 0 && labelTexts.includes(el.textContent.trim())
      );
      if (!label) return null;
      let container = label.parentElement;
      for (let i = 0; i < 4 && container; i++) {
        const text = container.textContent.replace(labelTexts.find(t => container.textContent.includes(t)) || '', '').trim();
        if (text && text.length > 10) return text;
        container = container.parentElement;
      }
      return null;
    }).catch(() => null);
    if (nearFieldText) {
      console.log(`[Token] Text near "API token" label: "${nearFieldText.slice(0, 60)}..."`);
      const nearHex = nearFieldText.match(/[a-f0-9]{32}/);
      if (nearHex) {
        console.log(`[Token] ✓ Token from label-proximity field: ${nearHex[0]}`);
        await page.close();
        return nearHex[0];
      }
      const nearSk = nearFieldText.match(/sk-[a-zA-Z0-9_-]+/);
      if (nearSk) {
        console.log(`[Token] ✓ Token from label-proximity field: ${nearSk[0].substring(0, 15)}...`);
        await page.close();
        return nearSk[0];
      }
    }

    const dashText = await page.textContent('body').catch(() => '');
    const dashHex = dashText.match(/[a-f0-9]{32}/);
    if (dashHex) {
      console.log(`[Token] ✓ Token from dashboard: ${dashHex[0]}`);
      await page.close();
      return dashHex[0];
    }
    const dashSk = dashText.match(/sk-[a-zA-Z0-9_-]+/);
    if (dashSk) {
      console.log(`[Token] ✓ Token from dashboard: ${dashSk[0].substring(0, 15)}...`);
      await page.close();
      return dashSk[0];
    }

    // Diagnostic dump on total failure — tells us what the page actually
    // looks like instead of requiring another live-debugging round trip.
    const diag = await page.evaluate(() => ({
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(Boolean).slice(0, 25),
      bodySnippet: document.body.innerText.slice(0, 800),
    })).catch(() => ({ buttons: [], bodySnippet: '(unreadable)' }));
    console.log('[Token] Diagnostic — dashboard buttons:', JSON.stringify(diag.buttons));
    console.log('[Token] Diagnostic — dashboard body snippet:', diag.bodySnippet.replace(/\n+/g, ' | '));

    await page.close();
    throw new Error('API token not found on verification page or dashboard');
  } catch (e) {
    await page.close().catch(() => {});
    throw e;
  }
}

// ─── Browser launch (shared by full runs + standalone step tests) ──────────

/**
 * Launch a stealth Chromium browser + context, identical setup to what
 * runSingleCycle uses. Exported so standalone test scripts (e.g.
 * testSonjjLogin.js) can exercise individual steps without duplicating the
 * anti-detection config.
 *
 * @param {object} opts
 * @param {boolean} [opts.headless] - default true
 */
export async function launchStealthBrowser({ headless = true } = {}) {
  const browser = await chromium.launch({
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  const context = await browser.newContext({
    userAgent: pickUA(),
    locale: 'en-US',
    timezoneId: 'America/New_York',
    viewport: { width: 1366, height: 768 },
    permissions: ['geolocation'],
    geolocation: {
      latitude: 40.7128 + (Math.random() * 0.02 - 0.01),
      longitude: -74.006 + (Math.random() * 0.02 - 0.01),
    },
  });

  await context.addInitScript(STEALTH_JS);

  await context.setExtraHTTPHeaders({
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'DNT': '1',
    'Upgrade-Insecure-Requests': '1',
  });

  return { browser, context };
}

// ─── Main: Single Cycle ─────────────────────────────────────────────────────

/**
 * Run one complete automation cycle: generate email → signup → verify → extract token.
 *
 * @param {object} opts
 * @param {string} opts.captchaApiKey  - 2Captcha API key
 * @param {boolean} [opts.headless]    - run headless (default true)
 * @param {number} [opts.cycleNumber]  - for logging
 * @returns {Promise<{ email: string, token: string, createdAt: string }>}
 */
export async function runSingleCycle({ captchaApiKey, headless = true, cycleNumber = 1, timeoutMs = 10 * 60 * 1000 } = {}) {
  const apiKey = captchaApiKey || TWOCAPTCHA_API_KEY;
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🚀 SCRAPINGANT AUTOMATION — CYCLE #${cycleNumber}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`⏰ ${new Date().toISOString()}`);
  console.log(`🖥️  Mode: ${headless ? 'headless' : 'visible'}`);

  const { browser, context } = await launchStealthBrowser({ headless });

  // Hard ceiling + live abort support — mirrors runLoginTest's watchdog so a
  // stuck Playwright wait (or a mid-cycle Stop click) can't hang forever.
  let settled = false;
  const watchdog = setInterval(() => {
    if (!settled && automationState.abortRequested) {
      console.warn(`[Cycle #${cycleNumber}] Abort requested — force-closing browser...`);
      settled = true;
      clearInterval(watchdog);
      browser.close().catch(() => {});
    }
  }, 1000);
  const timeoutTimer = setTimeout(() => {
    if (!settled) {
      console.warn(`[Cycle #${cycleNumber}] Hit ${timeoutMs / 1000}s hard timeout — force-closing browser...`);
      settled = true;
      browser.close().catch(() => {});
    }
  }, timeoutMs);

  try {
    // Step 1: Get authenticated Smail page + generate email
    const smailPage = await getAuthenticatedSmailPage(context, apiKey);
    const email = await generateTempEmail(smailPage);

    // Step 2: ScrapingAnt signup (opens in separate tab)
    const signupPage = await signupScrapingAnt(context, email, apiKey);
    // We don't need the signup page anymore after submission
    await signupPage.close().catch(() => {});

    // Step 3: Wait for verification email in Smail inbox
    const verificationUrl = await waitForVerificationEmail(smailPage, 30, 10_000);
    console.log(`[Verify] ✓ Verification URL: ${verificationUrl}`);

    // Step 4: Open verification URL and extract token
    const token = await verifyAndExtractToken(context, verificationUrl);
    const createdAt = new Date().toISOString();

    console.log(`\n${'='.repeat(70)}`);
    console.log(`🎉 CYCLE #${cycleNumber} COMPLETE`);
    console.log(`📧 Email:   ${email}`);
    console.log(`🔑 Token:   ${token}`);
    console.log(`📅 Created: ${createdAt}`);
    console.log(`${'='.repeat(70)}\n`);

    return { email, token, createdAt };
  } finally {
    settled = true;
    clearInterval(watchdog);
    clearTimeout(timeoutTimer);
    cancelOtpWait(`cycle #${cycleNumber} ended`);
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

// ─── Batch Runner (called from API route) ───────────────────────────────────

/**
 * In-memory state for the current automation run.
 * Only one run at a time is allowed.
 */
const automationState = {
  running: false,
  mode: null, // 'batch' | 'test-login' | null
  requestedCount: 0,
  completedCount: 0,
  successCount: 0,
  failedCount: 0,
  startedAt: null,
  results: [],   // { email, token, createdAt, error? }
  errors: [],    // last few error messages
  abortRequested: false,
  // Sonjj SSO login sometimes needs a fresh one-time email code (only when
  // the saved session cookie has expired — normally it's silent/instant).
  awaitingCode: false,
  awaitingCodeEmail: null,
  awaitingCodeSince: null,
  // Result of the last "Test Login" run (Steps 0-2 only). Persists across
  // runs until a new test starts, independent of `running`.
  testResult: null, // { success, loggedInAs, pageUrl, error, finishedAt }
};

export function getAutomationStatus() {
  return { ...automationState };
}

// ─── OTP code hand-off ──────────────────────────────────────────────────────
// When Sonjj's SSO needs a fresh email code, the automation pauses here and
// waits for the admin panel to POST the code it read from Gmail.

let pendingCode = null; // { email, resolve, reject }

export function submitOtpCode(code) {
  if (!pendingCode || !code || !code.trim()) return false;
  const { resolve } = pendingCode;
  pendingCode = null;
  automationState.awaitingCode = false;
  automationState.awaitingCodeEmail = null;
  automationState.awaitingCodeSince = null;
  resolve(code.trim());
  return true;
}

function waitForOtpCode(email, timeoutMs = 5 * 60 * 1000) {
  console.log(`[Sonjj] ⏳ Waiting for verification code sent to ${email} (submit via admin panel, ${timeoutMs / 1000}s timeout)...`);
  automationState.awaitingCode = true;
  automationState.awaitingCodeEmail = email;
  automationState.awaitingCodeSince = new Date().toISOString();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (pendingCode?.reject === reject) {
        pendingCode = null;
        automationState.awaitingCode = false;
        automationState.awaitingCodeEmail = null;
        automationState.awaitingCodeSince = null;
        reject(new Error(`Timed out after ${timeoutMs / 1000}s waiting for verification code`));
      }
    }, timeoutMs);

    pendingCode = {
      email,
      resolve: (code) => { clearTimeout(timer); resolve(code); },
      reject: (err) => { clearTimeout(timer); reject(err); },
    };
  });
}

/**
 * Cancel an in-flight waitForOtpCode() — used when the magic link in the
 * email auto-completes login in the background before any code is typed
 * (Gmail's own link-scanning security feature frequently does this within
 * seconds of the email arriving, beating a human to it).
 */
function cancelOtpWait(reason) {
  if (!pendingCode) return;
  const { reject } = pendingCode;
  pendingCode = null;
  automationState.awaitingCode = false;
  automationState.awaitingCodeEmail = null;
  automationState.awaitingCodeSince = null;
  reject(new Error(reason));
}

export function requestAbort() {
  if (automationState.running) {
    automationState.abortRequested = true;
    console.log('[Automation] Abort requested — will stop after current cycle.');
    return true;
  }
  return false;
}

/**
 * Run a batch of N automation cycles, saving each token to MongoDB.
 * Runs in the background — returns immediately. Poll getAutomationStatus() for progress.
 *
 * @param {object} opts
 * @param {number} opts.count           - Number of tokens to generate
 * @param {string} opts.captchaApiKey   - 2Captcha API key
 * @param {boolean} [opts.headless]     - default true
 * @param {number} [opts.delayBetween]  - ms between cycles (default 30_000)
 * @param {Function} opts.saveToken     - async (email, token, createdAt) => void
 */
export async function runBatchAutomation({ count, captchaApiKey, headless = true, delayBetween = 30_000, saveToken }) {
  if (automationState.running) {
    throw new Error('An automation run is already in progress');
  }

  // Reset state
  automationState.running = true;
  automationState.mode = 'batch';
  automationState.requestedCount = count;
  automationState.completedCount = 0;
  automationState.successCount = 0;
  automationState.failedCount = 0;
  automationState.startedAt = new Date().toISOString();
  automationState.results = [];
  automationState.errors = [];
  automationState.abortRequested = false;

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`🤖 SCRAPINGANT BATCH AUTOMATION — ${count} TOKENS`);
  console.log(`${'═'.repeat(70)}`);

  try {
    for (let i = 1; i <= count; i++) {
      if (automationState.abortRequested) {
        console.log(`[Automation] Abort requested — stopping at cycle ${i}/${count}`);
        break;
      }

      try {
        const result = await runSingleCycle({
          captchaApiKey,
          headless,
          cycleNumber: i,
        });

        // Save to MongoDB
        if (saveToken) {
          await saveToken(result.email, result.token, result.createdAt);
        }

        automationState.successCount++;
        automationState.results.push(result);
      } catch (err) {
        console.error(`[Automation] Cycle ${i} failed: ${err.message}`);
        automationState.failedCount++;
        automationState.errors.push({
          cycle: i,
          error: err.message,
          time: new Date().toISOString(),
        });
        // Keep only last 10 errors
        if (automationState.errors.length > 10) {
          automationState.errors = automationState.errors.slice(-10);
        }
      }

      automationState.completedCount = i;

      // Delay between cycles (skip after last one)
      if (i < count && !automationState.abortRequested) {
        console.log(`[Automation] Waiting ${delayBetween / 1000}s before next cycle...`);
        await new Promise(r => setTimeout(r, delayBetween));
      }
    }
  } finally {
    automationState.running = false;
    automationState.mode = null;
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`📊 BATCH COMPLETE: ${automationState.successCount}/${automationState.requestedCount} tokens generated`);
    console.log(`${'═'.repeat(70)}\n`);
  }
}

// ─── Test Login (Steps 0-2 only, no email/signup/token spend) ──────────────

/**
 * Run ONLY through login (Steps 0-2: launch browser → check login status →
 * Sonjj SSO login if needed) and stop there. No temp email generation, no
 * ScrapingAnt signup, no 2Captcha spend beyond a possible Turnstile solve.
 * Meant for the admin panel's "Test Login" button — confirms the login
 * mechanics work before committing to a full (paid) batch run.
 *
 * Shares `automationState` with runBatchAutomation, so only one of a test
 * run or a real batch run can be in flight at a time.
 *
 * @param {object} opts
 * @param {string} [opts.captchaApiKey]
 * @param {boolean} [opts.headless] - default false (headed, so it's visible)
 */
export async function runLoginTest({ captchaApiKey, headless = false, timeoutMs = 6 * 60 * 1000 } = {}) {
  if (automationState.running) {
    throw new Error('An automation run is already in progress');
  }

  automationState.running = true;
  automationState.mode = 'test-login';
  automationState.startedAt = new Date().toISOString();
  automationState.errors = [];
  automationState.abortRequested = false;
  automationState.testResult = null;

  const apiKey = captchaApiKey || TWOCAPTCHA_API_KEY;
  console.log(`\n${'='.repeat(70)}`);
  console.log('🧪 TEST LOGIN — Steps 0-2 only (browser launch → login check → login)');
  console.log(`🖥️  Mode: ${headless ? 'headless' : 'visible'}`);
  console.log(`${'='.repeat(70)}`);

  // Launching the browser is NOT inside the main try/finally below — if this
  // throws (e.g. Playwright's Chromium was never downloaded on this
  // machine), automationState.running must still get reset here, or it's
  // stuck at `running: true` forever with no error surfaced anywhere.
  let browser, context;
  try {
    ({ browser, context } = await launchStealthBrowser({ headless }));
  } catch (e) {
    automationState.testResult = {
      success: false,
      loggedInAs: null,
      pageUrl: null,
      error: `Browser launch failed: ${e.message}`,
      finishedAt: new Date().toISOString(),
    };
    automationState.errors.push({ cycle: 0, error: e.message, time: new Date().toISOString() });
    automationState.running = false;
    automationState.mode = null;
    console.error(`\n❌ TEST FAILED — browser launch failed: ${e.message}`);
    return;
  }

  // Hard ceiling so a stuck Playwright wait (or an ignored Stop click) can
  // never leave `running: true` forever — Stop and the timeout both resolve
  // by force-closing the browser, which makes any in-flight page.* call
  // reject immediately.
  let settled = false;
  const watchdog = setInterval(() => {
    if (!settled && automationState.abortRequested) {
      console.warn('[TestLogin] Abort requested — force-closing browser...');
      settled = true;
      clearInterval(watchdog);
      browser.close().catch(() => {});
    }
  }, 1000);
  const timeoutTimer = setTimeout(() => {
    if (!settled) {
      console.warn(`[TestLogin] Hit ${timeoutMs / 1000}s hard timeout — force-closing browser...`);
      settled = true;
      browser.close().catch(() => {});
    }
  }, timeoutMs);

  try {
    const smailPage = await getAuthenticatedSmailPage(context, apiKey);

    // Read the confirmed name for the result (getAuthenticatedSmailPage
    // already verified it's not "Guest" before returning).
    const menuBtn = smailPage.locator("button[aria-label='btn user']").first();
    await menuBtn.click({ timeout: 5000 }).catch(() => {});
    await randomDelay(500, 1000);
    const nameText = (await smailPage.locator('span.text-sm.text-gray-900').first().textContent().catch(() => '')).trim();
    await smailPage.mouse.click(0, 0).catch(() => {});

    automationState.testResult = {
      success: true,
      loggedInAs: nameText || null,
      pageUrl: smailPage.url(),
      error: null,
      finishedAt: new Date().toISOString(),
    };
    console.log(`\n✅ TEST PASSED — logged in as: ${nameText || '(name not read)'}`);
  } catch (e) {
    automationState.testResult = {
      success: false,
      loggedInAs: null,
      pageUrl: null,
      error: automationState.abortRequested ? 'Stopped by user' : e.message,
      finishedAt: new Date().toISOString(),
    };
    automationState.errors.push({ cycle: 0, error: e.message, time: new Date().toISOString() });
    console.error(`\n❌ TEST FAILED — ${e.message}`);
  } finally {
    settled = true;
    clearInterval(watchdog);
    clearTimeout(timeoutTimer);
    cancelOtpWait('login test ended');
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    automationState.running = false;
    automationState.mode = null;
    automationState.abortRequested = false;
  }
}

// ─── Legacy export for backward compat ──────────────────────────────────────

export async function runScrapingAntAutomation() {
  const result = await runSingleCycle({
    captchaApiKey: TWOCAPTCHA_API_KEY,
    headless: true,
  });
  return result.token;
}
