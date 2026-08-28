/**
 * 2Captcha reCAPTCHA v2 Solver
 *
 * Flow:
 *   1. Extract reCAPTCHA sitekey from the page
 *   2. POST to 2captcha.com/in.php with sitekey + pageurl
 *   3. Poll 2captcha.com/res.php until the solution is ready
 *   4. Inject the g-recaptcha-response token into the page
 *
 * Requires: TWOCAPTCHA_API_KEY in environment or passed explicitly.
 * Pricing: ~$2.99 / 1000 normal reCAPTCHAs.
 */

const TWOCAPTCHA_IN  = 'https://2captcha.com/in.php';
const TWOCAPTCHA_RES = 'https://2captcha.com/res.php';

/**
 * Extract the reCAPTCHA v2 sitekey from a page that has a visible reCAPTCHA widget.
 * @param {import('playwright').Page} page
 * @returns {Promise<string|null>}
 */
export async function extractRecaptchaSitekey(page) {
  // Method 1: from the iframe src (most reliable)
  const iframeSrc = await page
    .locator("iframe[src*='recaptcha/api2/anchor']")
    .first()
    .getAttribute('src')
    .catch(() => null);

  if (iframeSrc) {
    const match = iframeSrc.match(/[?&]k=([A-Za-z0-9_-]+)/);
    if (match) return match[1];
  }

  // Method 2: from the div.g-recaptcha data-sitekey attribute
  const sitekey = await page
    .locator('.g-recaptcha[data-sitekey]')
    .first()
    .getAttribute('data-sitekey')
    .catch(() => null);

  if (sitekey) return sitekey;

  // Method 3: grep page HTML
  const html = await page.content();
  const htmlMatch = html.match(/data-sitekey=["']([A-Za-z0-9_-]+)["']/);
  if (htmlMatch) return htmlMatch[1];

  return null;
}

/**
 * Submit a reCAPTCHA v2 task to 2Captcha and wait for the solution.
 *
 * @param {object} opts
 * @param {string} opts.apiKey       - 2Captcha API key
 * @param {string} opts.sitekey      - reCAPTCHA site key
 * @param {string} opts.pageUrl      - URL of the page with the CAPTCHA
 * @param {number} [opts.timeout]    - Max wait in ms (default 120 000)
 * @param {number} [opts.pollInterval] - Poll interval in ms (default 5 000)
 * @returns {Promise<string>}        - g-recaptcha-response token
 */
export async function solveRecaptchaV2({ apiKey, sitekey, pageUrl, timeout = 120_000, pollInterval = 5_000 }) {
  if (!apiKey) throw new Error('[2Captcha] API key is required. Set TWOCAPTCHA_API_KEY env var.');

  console.log(`[2Captcha] Submitting reCAPTCHA task (sitekey: ${sitekey.substring(0, 12)}..., page: ${pageUrl})`);

  // 1. Submit task
  const submitUrl = new URL(TWOCAPTCHA_IN);
  submitUrl.searchParams.set('key', apiKey);
  submitUrl.searchParams.set('method', 'userrecaptcha');
  submitUrl.searchParams.set('googlekey', sitekey);
  submitUrl.searchParams.set('pageurl', pageUrl);
  submitUrl.searchParams.set('json', '1');

  const submitRes = await fetch(submitUrl.toString());
  const submitData = await submitRes.json();

  if (submitData.status !== 1) {
    throw new Error(`[2Captcha] Submit failed: ${submitData.request}`);
  }

  const requestId = submitData.request;
  console.log(`[2Captcha] Task submitted, request ID: ${requestId}. Polling for solution...`);

  // 2. Poll for result
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    await new Promise(r => setTimeout(r, pollInterval));

    const resultUrl = new URL(TWOCAPTCHA_RES);
    resultUrl.searchParams.set('key', apiKey);
    resultUrl.searchParams.set('action', 'get');
    resultUrl.searchParams.set('id', requestId);
    resultUrl.searchParams.set('json', '1');

    const resultRes = await fetch(resultUrl.toString());
    const resultData = await resultRes.json();

    if (resultData.status === 1) {
      console.log(`[2Captcha] ✓ Solution received (${((Date.now() - startedAt) / 1000).toFixed(1)}s)`);
      return resultData.request; // This is the g-recaptcha-response token
    }

    if (resultData.request !== 'CAPCHA_NOT_READY') {
      throw new Error(`[2Captcha] Solve failed: ${resultData.request}`);
    }

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
    console.log(`[2Captcha] Not ready yet... (${elapsed}s elapsed)`);
  }

  throw new Error(`[2Captcha] Timed out after ${timeout / 1000}s waiting for solution`);
}

/**
 * Inject a solved reCAPTCHA response into the page so the form accepts it.
 *
 * @param {import('playwright').Page} page
 * @param {string} recaptchaResponse - The g-recaptcha-response token from 2Captcha
 */
export async function injectRecaptchaResponse(page, recaptchaResponse) {
  await page.evaluate((token) => {
    // Set the hidden textarea that reCAPTCHA uses
    const textarea = document.querySelector('#g-recaptcha-response') ||
                     document.querySelector('[name="g-recaptcha-response"]');
    if (textarea) {
      textarea.style.display = 'block';
      textarea.value = token;
      textarea.style.display = 'none';
    }

    // Also try setting in any iframe-based response fields
    document.querySelectorAll('textarea[name="g-recaptcha-response"]').forEach(el => {
      el.value = token;
    });

    // Trigger the reCAPTCHA callback if available
    // ScrapingAnt uses standard reCAPTCHA so the callback should be on the window
    if (typeof window.___grecaptcha_cfg !== 'undefined') {
      const clients = window.___grecaptcha_cfg.clients;
      if (clients) {
        for (const clientKey of Object.keys(clients)) {
          const client = clients[clientKey];
          // Walk the client object tree looking for a property literally
          // named "callback" — that's the one grecaptcha.render({callback})
          // actually registers, and it's the one wired to the form's Vue
          // reactive state (calling it runs the site's own `i("verify", e)`
          // handler, not just a generic internal grecaptcha method).
          //
          // BUG (fixed): the old version returned the FIRST function found
          // with any key longer than 1 char — in a Closure-Compiler-mangled
          // client object full of internal methods (dozens of them, single-
          // or double-letter names), that's essentially never the real
          // callback. It "succeeded" silently (no error) while invoking the
          // wrong function, so the textarea got a valid token but the site's
          // own verify handler — the thing that actually flips its form
          // state — never ran. Confirmed live 2026-08-19: the real path is
          // client.G.G.callback (2 levels of Closure-mangled wrapper); a
          // depth-5 exact-key search finds it directly.
          let namedCallback = null;
          const findNamedCallback = (obj, depth = 0) => {
            if (depth > 5 || !obj || typeof obj !== 'object' || namedCallback) return;
            if (typeof obj.callback === 'function') {
              namedCallback = obj.callback;
              return;
            }
            for (const key of Object.keys(obj)) {
              findNamedCallback(obj[key], depth + 1);
              if (namedCallback) return;
            }
          };
          findNamedCallback(client);

          if (namedCallback) {
            try { namedCallback(token); } catch (e) { /* swallow */ }
          } else {
            // Fallback to the old loose heuristic if no exact "callback" key
            // exists on this site's client object at all.
            const findAnyFunction = (obj, depth = 0) => {
              if (depth > 5 || !obj || typeof obj !== 'object') return null;
              for (const key of Object.keys(obj)) {
                if (typeof obj[key] === 'function' && key.length > 1) return obj[key];
                const found = findAnyFunction(obj[key], depth + 1);
                if (found) return found;
              }
              return null;
            };
            const fallback = findAnyFunction(client);
            if (fallback) {
              try { fallback(token); } catch (e) { /* swallow */ }
            }
          }
        }
      }
    }
  }, recaptchaResponse);

  console.log('[2Captcha] ✓ reCAPTCHA response injected into page');
}

/**
 * ─── Cloudflare Turnstile ────────────────────────────────────────────────
 * Sonjj's login (my.sonjj.com) uses Cloudflare Turnstile, NOT reCAPTCHA.
 * It renders as a `div.cf-turnstile[data-sitekey]` and Cloudflare's own
 * script (challenges.cloudflare.com/turnstile/v0/api.js) fills a hidden
 * `input[name="cf-turnstile-response"]` once solved. In a real browser
 * profile it often auto-passes silently; under Playwright automation it
 * frequently doesn't, so we fall back to 2Captcha's turnstile method.
 */

/**
 * Extract the Turnstile sitekey (and optional data-action) from a page.
 * @param {import('playwright').Page} page
 * @returns {Promise<{sitekey: string, action: string|null}|null>}
 */
export async function extractTurnstileSitekey(page) {
  const widget = page.locator('.cf-turnstile[data-sitekey], [data-sitekey][class*="turnstile"]').first();

  const sitekey = await widget.getAttribute('data-sitekey').catch(() => null);
  if (sitekey) {
    const action = await widget.getAttribute('data-action').catch(() => null);
    return { sitekey, action };
  }

  // Fallback: grep page HTML
  const html = await page.content();
  const match = html.match(/class="[^"]*cf-turnstile[^"]*"[^>]*data-sitekey="([^"]+)"/) ||
                html.match(/data-sitekey="([^"]+)"[^>]*class="[^"]*cf-turnstile[^"]*"/);
  if (match) {
    const actionMatch = html.match(/data-action="([^"]+)"/);
    return { sitekey: match[1], action: actionMatch ? actionMatch[1] : null };
  }

  return null;
}

/**
 * Detect whether a Turnstile widget is present and already solved
 * (the hidden response input already has a non-empty value).
 * @param {import('playwright').Page} page
 */
export async function isTurnstileAlreadySolved(page) {
  return page.evaluate(() => {
    const input = document.querySelector('input[name="cf-turnstile-response"]');
    return !!(input && input.value && input.value.length > 0);
  }).catch(() => false);
}

/**
 * Submit a Turnstile task to 2Captcha and wait for the solution.
 *
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {string} opts.sitekey
 * @param {string} opts.pageUrl
 * @param {string} [opts.action]
 * @param {number} [opts.timeout]
 * @param {number} [opts.pollInterval]
 * @returns {Promise<string>} the cf-turnstile-response token
 */
export async function solveTurnstile({ apiKey, sitekey, pageUrl, action, timeout = 120_000, pollInterval = 5_000 }) {
  if (!apiKey) throw new Error('[2Captcha] API key is required. Set TWOCAPTCHA_API_KEY env var.');

  console.log(`[2Captcha] Submitting Turnstile task (sitekey: ${sitekey.substring(0, 12)}..., page: ${pageUrl})`);

  const submitUrl = new URL(TWOCAPTCHA_IN);
  submitUrl.searchParams.set('key', apiKey);
  submitUrl.searchParams.set('method', 'turnstile');
  submitUrl.searchParams.set('sitekey', sitekey);
  submitUrl.searchParams.set('pageurl', pageUrl);
  if (action) submitUrl.searchParams.set('action', action);
  submitUrl.searchParams.set('json', '1');

  const submitRes = await fetch(submitUrl.toString());
  const submitData = await submitRes.json();

  if (submitData.status !== 1) {
    throw new Error(`[2Captcha] Turnstile submit failed: ${submitData.request}`);
  }

  const requestId = submitData.request;
  console.log(`[2Captcha] Turnstile task submitted, request ID: ${requestId}. Polling for solution...`);

  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    await new Promise(r => setTimeout(r, pollInterval));

    const resultUrl = new URL(TWOCAPTCHA_RES);
    resultUrl.searchParams.set('key', apiKey);
    resultUrl.searchParams.set('action', 'get');
    resultUrl.searchParams.set('id', requestId);
    resultUrl.searchParams.set('json', '1');

    const resultRes = await fetch(resultUrl.toString());
    const resultData = await resultRes.json();

    if (resultData.status === 1) {
      console.log(`[2Captcha] ✓ Turnstile solution received (${((Date.now() - startedAt) / 1000).toFixed(1)}s)`);
      return resultData.request;
    }

    if (resultData.request !== 'CAPCHA_NOT_READY') {
      throw new Error(`[2Captcha] Turnstile solve failed: ${resultData.request}`);
    }

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
    console.log(`[2Captcha] Turnstile not ready yet... (${elapsed}s elapsed)`);
  }

  throw new Error(`[2Captcha] Turnstile timed out after ${timeout / 1000}s waiting for solution`);
}

/**
 * Inject a solved Turnstile token into the page's hidden response input.
 * Turnstile embeds used purely for form-submit validation (no data-callback)
 * just need the hidden input populated before the form posts.
 *
 * @param {import('playwright').Page} page
 * @param {string} token - the cf-turnstile-response token from 2Captcha
 */
export async function injectTurnstileResponse(page, token) {
  await page.evaluate((tok) => {
    const inputs = document.querySelectorAll('input[name="cf-turnstile-response"]');
    inputs.forEach(el => { el.value = tok; });

    // If the widget was rendered with an explicit data-callback, invoke it too.
    const widget = document.querySelector('.cf-turnstile[data-callback]');
    const cbName = widget && widget.getAttribute('data-callback');
    if (cbName && typeof window[cbName] === 'function') {
      try { window[cbName](tok); } catch (e) { /* swallow */ }
    }
  }, token);

  console.log('[2Captcha] ✓ Turnstile response injected into page');
}
