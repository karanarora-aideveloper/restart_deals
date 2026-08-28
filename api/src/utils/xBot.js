import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';

// Posts to X (Twitter) by driving the real native X app on a physical Android device over ADB —
// simulating a human tapping through the app — instead of X's official API (which costs ~$0.20
// per post-with-link; see api/src/db/models/xAccount.js). This only works while the device stays
// connected via USB or ADB-over-WiFi to whichever machine runs this process; checkDeviceStatus()
// below is what the scheduler (src/jobs/xBotScheduler.js) checks before ever attempting a post.
//
// Ported from the original standalone api/x_bot.js CLI script (now removed) into importable
// functions so the Express routes and cron scheduler can call it directly, and to ES modules to
// match the rest of this codebase (api/'s package.json is "type": "module" — the original script
// used require() and could not actually run here).

const PACKAGE_NAME = 'com.twitter.android';
const DEFAULT_PIN = process.env.X_BOT_UNLOCK_PIN || '051295';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'api.deepseek.com';

function runAdb(cmd) {
  try {
    return execSync(`adb ${cmd}`, { encoding: 'utf-8' }).trim();
  } catch (err) {
    return err.stdout ? err.stdout.trim() : '';
  }
}

/**
 * Runs `adb shell <remoteCmd>` as ONE combined argv element, via spawnSync — which spawns `adb`
 * directly with no local shell involved at all, unlike runAdb() above (execSync always goes
 * through /bin/sh -c "..."). This matters specifically for typing arbitrary text: `adb shell`
 * re-joins any extra argv items it's given into a single space-separated string before handing
 * it to the device's own shell, which silently destroys whatever quoting a *local* shell had
 * already resolved. Passing the fully-formed remote command as one pre-built string sidesteps
 * that — nothing is left to mis-parse or drop a "word" from what actually gets typed.
 *
 * Uses spawnSync (not execFileSync) specifically so stderr is captured even when the command
 * "succeeds" (exit 0) — the Android-side exception this was built to catch prints to stderr
 * without actually failing the adb invocation itself, so execFileSync's return value (stdout
 * only, on the non-throwing path) would silently miss it entirely.
 */
function runAdbShellRaw(remoteCmd) {
  const result = spawnSync('adb', ['shell', remoteCmd], { encoding: 'utf-8' });
  return ((result.stdout || '') + (result.stderr || '')).trim();
}

/** Wraps a string in single quotes, POSIX-shell-safe — the only escaping style that survives
 * being relayed through a second, unquoted shell pass (which is what `adb shell` does once it
 * re-joins its arguments; see runAdbShellRaw). Single quotes suppress ALL special meaning except
 * for an embedded single quote itself, handled via the standard close-escape-reopen trick. */
function shellSingleQuote(str) {
  return `'${str.replace(/'/g, `'\\''`)}'`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomSleep(minMs, maxMs) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return sleep(ms);
}

/** Thrown when a run is stopped via its cancelToken — a distinct type so callers (the scheduler)
 * can log a CANCELLED status instead of lumping a deliberate stop in with a genuine FAILED. */
export class XBotCancelledError extends Error {
  constructor(message = 'Posting was stopped.') {
    super(message);
    this.name = 'XBotCancelledError';
    this.code = 'CANCELLED';
  }
}

/** Creates a fresh cancellation token: { cancelled: false }. Passing the SAME object into
 * postDealToX and later flipping its `cancelled` flag (from the /cancel route, via the
 * scheduler's currently-active token) is what lets a run in progress actually stop — checked at
 * every step boundary in createPost, never mid-way through a single already-issued adb command. */
export function createCancelToken() {
  return { cancelled: false };
}

function throwIfCancelled(cancelToken) {
  if (cancelToken?.cancelled) {
    throw new XBotCancelledError();
  }
}

/**
 * Checks `adb devices` for a connected, authorized device. This is the gate every posting path
 * goes through first — the phone being unplugged, asleep-and-unauthorized, or simply not there
 * is the normal/expected state outside of active use, not an error.
 */
export function checkDeviceStatus() {
  const output = runAdb('devices -l');
  const lines = output.split('\n').slice(1).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return { connected: false, deviceId: null, state: null, raw: output };
  }
  // First real entry wins — this bot is designed for exactly one dedicated posting device.
  const [deviceId, state] = lines[0].split(/\s+/);
  return { connected: state === 'device', deviceId, state: state || null, raw: output };
}

function parseBounds(boundsStr) {
  if (!boundsStr) return null;
  const match = boundsStr.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (!match) return null;
  const [, x1, y1, x2, y2] = match.map(Number);
  return [Math.floor((x1 + x2) / 2), Math.floor((y1 + y2) / 2)];
}

function dumpAndParseUI() {
  runAdb('shell uiautomator dump /sdcard/window_dump.xml');
  const tmpFile = path.join('/tmp', 'x_dump.xml');
  runAdb(`pull /sdcard/window_dump.xml ${tmpFile}`);
  if (!fs.existsSync(tmpFile)) return [];

  const xmlContent = fs.readFileSync(tmpFile, 'utf-8');
  const nodes = [];
  const regex = /<node\s+([^>]+)>/g;
  let match;
  while ((match = regex.exec(xmlContent)) !== null) {
    const attrsStr = match[1];
    const node = {};
    const attrRegex = /([a-z-]+)="([^"]*)"/gi;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrsStr)) !== null) {
      node[attrMatch[1]] = attrMatch[2];
    }
    if (node['content-desc'] || node['text'] || node['resource-id']) {
      node.center = parseBounds(node.bounds);
      nodes.push(node);
    }
  }
  return nodes;
}

async function unlockDevice(pin = DEFAULT_PIN, log = () => {}) {
  const powerState = runAdb('shell dumpsys power | grep mWakefulness');
  if (powerState.includes('Asleep') || powerState.includes('Dozing')) {
    log('Screen was asleep — waking it up.');
    runAdb('shell input keyevent KEYCODE_WAKEUP');
    await sleep(1000);
  } else {
    log('Screen already awake.');
  }

  runAdb('shell input swipe 500 1800 500 400 300');
  await sleep(1000);

  if (pin) {
    log('Entering unlock PIN.');
    runAdb(`shell input text ${pin}`);
    await sleep(500);
    runAdb('shell input keyevent 66'); // KEYCODE_ENTER
    await sleep(1500);
  }

  const focus = runAdb("shell dumpsys window | grep -E 'mCurrentFocus|mFocusedApp'");
  if (focus.includes('Keyguard') || focus.includes('NotificationShade')) {
    log('Still locked after first attempt — retrying PIN entry.');
    runAdb('shell input swipe 500 1800 500 400 300');
    await sleep(500);
    runAdb(`shell input text ${pin}`);
    runAdb('shell input keyevent 66');
    await sleep(1500);
  }
  log('Device unlocked.');
}

/** Force-stops the X app if it's running — always called before relaunching, so every posting
 * attempt starts from the same known-clean state instead of whatever screen a previous run (or
 * the user) left the app on. Force-stopping an app that isn't running is a harmless no-op. */
async function forceStopXApp(log = () => {}) {
  log('Force-stopping X app (if running) for a clean start.');
  runAdb(`shell am force-stop ${PACKAGE_NAME}`);
  await sleep(500);
}

/** Launches the X app's own default/main activity via the LAUNCHER intent category — not a
 * hardcoded activity class name (e.g. ComposerActivity), which can silently break across X app
 * updates. This opens the normal home feed; the compose button is then found and tapped
 * dynamically, same as everything else in this flow. */
async function launchXApp(log = () => {}) {
  log('Launching X app.');
  runAdb(`shell monkey -p ${PACKAGE_NAME} -c android.intent.category.LAUNCHER 1`);
  await sleep(3000);
}

/**
 * Finds a UI node matching `keywords` against content-desc, text, or resource-id. Tries an EXACT
 * (case-insensitive, trimmed) match across every node first, and only falls back to substring
 * matching if nothing matched exactly. This exists because X's real Android UI labels its
 * compose FAB with the bare content-desc "Post" — the same word also appears as a substring
 * inside "Post options" (the three-dot menu on every single tweet in the feed). Naive substring
 * matching could grab whichever "Post options" button happens first in the accessibility tree
 * instead of the actual compose button; exact-match-first resolves that ambiguity since "Post"
 * and "Post options" are different strings once compared exactly.
 */
function findElementByKeywords(nodes, keywords) {
  const lowerKeywords = keywords.map((k) => k.toLowerCase());
  const fieldsOf = (node) => [
    (node['content-desc'] || '').toLowerCase().trim(),
    (node['text'] || '').toLowerCase().trim(),
    (node['resource-id'] || '').toLowerCase().trim(),
  ];

  for (const node of nodes) {
    if (!node.center) continue;
    const fields = fieldsOf(node);
    if (lowerKeywords.some((kw) => fields.includes(kw))) return node;
  }
  for (const node of nodes) {
    if (!node.center) continue;
    const fields = fieldsOf(node);
    if (lowerKeywords.some((kw) => fields.some((f) => f.includes(kw)))) return node;
  }
  return null;
}

/**
 * Re-dumps the UI and searches for `keywords` up to `retries` times — screen transitions
 * (app launch, composer opening) aren't instant, so a single dump right after tapping something
 * often misses elements that render a few hundred ms later. Returns the matched node's center,
 * or null if it never showed up.
 */
async function waitForElement(keywords, { retries = 6, delayMs = 700 } = {}) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const nodes = dumpAndParseUI();
    const match = findElementByKeywords(nodes, keywords);
    if (match) return match.center;
    await sleep(delayMs);
  }
  return null;
}

/** Waits for and taps an element by keywords, logging what happened either way. Throws a
 * descriptive error (rather than silently tapping nothing) if it never appears — that surfaces
 * as a clear FAILED log entry pointing at exactly which step broke, instead of a confusing
 * downstream failure. */
async function tapElement(keywords, label, log = () => {}, cancelToken = null) {
  throwIfCancelled(cancelToken);
  log(`Looking for "${label}"...`);
  const center = await waitForElement(keywords);
  if (!center) {
    throw new Error(`Could not find "${label}" on screen (looked for: ${keywords.join(', ')}) — the X app's UI may have changed, or the screen isn't in the expected state.`);
  }
  log(`Found "${label}" at (${center[0]}, ${center[1]}) — tapping.`);
  runAdb(`shell input tap ${center[0]} ${center[1]}`);
  await sleep(1200);
  return center;
}

function sanitizeTextForAdb(text) {
  if (!text) return '';
  return text
    .replace(/—|–/g, '-')
    .replace(/’|‘|`/g, "'")
    .replace(/“|”/g, '"')
    .replace(/…/g, '...')
    .replace(/[^\x00-\x7F]/g, '')
    .trim();
}

async function typeTextHumanLike(text, log = () => {}, cancelToken = null) {
  const clean = sanitizeTextForAdb(text);
  if (!clean) return;

  let droppedWords = 0;
  const lines = clean.split('\n');
  for (let l = 0; l < lines.length; l++) {
    const line = lines[l].trim();
    if (line.length > 0) {
      const words = line.split(/\s+/).filter((w) => w.length > 0);
      for (let w = 0; w < words.length; w++) {
        const word = words[w];
        throwIfCancelled(cancelToken);
        // Each word is sent as its own `input text` call (for the per-word human-like delay
        // below), but `input text` never inserts anything beyond the exact characters it's given
        // — two separate calls back to back leave the cursor with NO space between them. Confirmed
        // live: typing "Testing" then "deal" as two calls produced "Testingdeal" on-screen, every
        // time. A trailing space is appended to every word except the line's last (the last gets
        // none so a trailing space doesn't sit right before the keyevent-66 newline below) so the
        // word and its following space land in one atomic adb call rather than risking the space
        // getting sent as its own call and landing out of order.
        // Single-quoted and sent via runAdbShellRaw (no local shell, one combined argv item) —
        // see both functions' comments for why the previous manual backslash-escaping approach
        // could silently lose words containing !, &, (, ), or ? once relayed through adb's own
        // argument-rejoining behavior.
        const isLastWordOnLine = w === words.length - 1;
        const textToSend = isLastWordOnLine ? word : `${word} `;
        const result = runAdbShellRaw(`input text ${shellSingleQuote(textToSend)}`);
        if (/Exception|Error/i.test(result)) {
          droppedWords++;
          log(`Warning: "${word}" may not have typed correctly (device reported: ${result.split('\n')[0]}).`);
        }
        await randomSleep(140, 280);
        if (word.includes('.') || word.includes(',') || word.includes('?') || word.includes('!')) {
          await randomSleep(400, 750);
        }
      }
    }
    if (l < lines.length - 1) {
      runAdb('shell input keyevent 66');
      await randomSleep(500, 900);
    }
  }
  if (droppedWords > 0) {
    log(`${droppedWords} word(s) may be missing from the published post — check the live tweet.`);
  }
}

/** DeepSeek call — drafts a post for a specific deal (title, price, discount, link). */
function generateDealPostText(dealInput) {
  return new Promise((resolve, reject) => {
    if (!DEEPSEEK_API_KEY) return reject(new Error('DEEPSEEK_API_KEY is not configured'));

    const payload = JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `You are the social media marketer for "Shoppers Deals America", an X (Twitter) account that posts verified Amazon.com price drop deals.
Formatting Rules:
- Format like an authentic human tech creator on X with short paragraph breaks.
- Highlight product name, price drop (Was vs Now), discount %, and link provided.
- ALWAYS place a double line break (\\n\\n) BEFORE writing hashtags at the bottom.
- Keep total post under 250 characters.
- MUST use plain ASCII text ONLY (no non-ASCII characters).
- Output ONLY the raw post text.`,
        },
        { role: 'user', content: `Draft an Amazon deal post for Shoppers Deals America using these details:\n${dealInput}` },
      ],
      temperature: 0.7,
      max_tokens: 180,
    });

    const req = https.request(
      {
        hostname: DEEPSEEK_API_URL,
        path: '/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            if (json.choices?.length > 0) {
              resolve(json.choices[0].message.content.trim().replace(/^["']|["']$/g, ''));
            } else {
              reject(new Error(json.error ? json.error.message : 'DeepSeek API error'));
            }
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Candidate matches for each step — several fallbacks per step since the exact content-desc/
// text/resource-id X's Android app uses has changed across versions before and will again;
// keeping a short list here is cheaper to update than re-deriving pixel coordinates per phone.
// 'post' is deliberately in BOTH the compose and submit lists — X's real Android app labels
// both buttons with the bare content-desc "Post" (confirmed via a live `uiautomator dump`);
// findElementByKeywords' exact-match-first behavior is what keeps that from colliding with the
// unrelated "Post options" three-dot menu that appears on every tweet in the feed.
const COMPOSE_BUTTON_KEYWORDS = ['post', 'compose', 'tweet button', 'new post', 'create post'];
const TEXT_FIELD_KEYWORDS = ["what's happening", 'what’s happening', 'tweet text', 'post text', 'composer'];
const SUBMIT_BUTTON_KEYWORDS = ['post', 'tweet'];

/**
 * Composes and publishes a new post — every tap is resolved dynamically from the device's own
 * current UI (see tapElement above), so this works unmodified across phones with different
 * screen sizes/resolutions. Always force-stops and relaunches the X app first, so it starts from
 * a known, predictable state regardless of whatever screen a previous run (or manual use) left
 * it on, rather than risking build-up on top of a stale screen. `log` (optional) receives a
 * human-readable line at every step — see postDealToX, which is what actually collects these
 * into the array persisted to XPostLog for the admin history view.
 */
async function createPost(postText, pin = DEFAULT_PIN, log = () => {}, cancelToken = null) {
  let composerMayBeOpen = false;
  try {
    throwIfCancelled(cancelToken);
    await unlockDevice(pin, log);
    await forceStopXApp(log);
    await launchXApp(log);

    await tapElement(COMPOSE_BUTTON_KEYWORDS, 'compose / new post button', log, cancelToken);
    composerMayBeOpen = true;

    // Best-effort: the text field is often already focused the moment the composer opens, so a
    // missed tap here isn't fatal the way a missed compose/submit tap would be — just proceed to
    // typing either way.
    log('Looking for the post text field...');
    const textFieldCenter = await waitForElement(TEXT_FIELD_KEYWORDS);
    if (textFieldCenter) {
      log(`Found text field at (${textFieldCenter[0]}, ${textFieldCenter[1]}) — tapping to focus.`);
      runAdb(`shell input tap ${textFieldCenter[0]} ${textFieldCenter[1]}`);
      await sleep(800);
    } else {
      log('Text field not explicitly found — assuming it\'s already focused after opening the composer.');
    }

    log('Typing post text...');
    await typeTextHumanLike(postText, log, cancelToken);
    await sleep(1000);

    await tapElement(SUBMIT_BUTTON_KEYWORDS, 'submit / post button', log, cancelToken);
    await sleep(2000);
    log('Post submitted.');
  } catch (err) {
    if (err instanceof XBotCancelledError && composerMayBeOpen) {
      // Best-effort cleanup only — leaving a half-typed draft open is worse than a possibly-
      // failed back-out attempt, but this is never allowed to mask the original cancellation.
      log('Stopping — backing out of the compose screen (any draft will be discarded, not posted).');
      runAdb('shell input keyevent 4'); // KEYCODE_BACK
      await sleep(500);
      runAdb('shell input keyevent 4');
    }
    throw err;
  }
}

/**
 * High-level entry point: verify the device is connected, draft the post via DeepSeek, publish
 * it. Throws on any failure (device offline, DeepSeek error, ADB error) — callers (the route and
 * the scheduler) are responsible for catching and logging to XPostLog. Either way (success or
 * thrown error), `err.steps` / the resolved object's `steps` carries the full step-by-step log
 * collected along the way, for the admin history view's expandable log detail.
 */
export async function postDealToX(dealInput, { pin, cancelToken } = {}) {
  const steps = [];
  const log = (msg) => {
    console.log('[X Bot]', msg);
    steps.push(msg);
  };

  const status = checkDeviceStatus();
  if (!status.connected) {
    const err = new Error('X posting device is not connected via ADB.');
    err.code = 'DEVICE_OFFLINE';
    err.steps = steps;
    throw err;
  }

  try {
    throwIfCancelled(cancelToken);
    log('Drafting post text via DeepSeek...');
    const publishedContent = await generateDealPostText(dealInput);
    log('Draft ready.');
    throwIfCancelled(cancelToken);
    await createPost(publishedContent, pin, log, cancelToken);
    return { publishedContent, deviceId: status.deviceId, steps };
  } catch (err) {
    err.steps = steps;
    throw err;
  }
}
