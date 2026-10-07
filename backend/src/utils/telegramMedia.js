import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// backend/public/telegram-media — served statically by api/server.js at /media/telegram
export const MEDIA_DIR = path.join(__dirname, '../../public/telegram-media');

fs.mkdirSync(MEDIA_DIR, { recursive: true });

/**
 * Downloads the photo attached to a Telegram message (if any) and returns a
 * publicly-reachable URL for it. Used as a last-resort fallback image when a
 * deal's landing page can't be scraped and nothing is cached yet — the deal
 * itself was posted with a photo, so there's no reason to discard it just
 * because ScrapingAnt failed.
 *
 * Safe to call on any message: resolves to null (never throws) if there's no
 * photo, the client isn't ready, or the download fails for any reason.
 *
 * @param {import('telegram').TelegramClient} client
 * @param {import('telegram').Api.Message} message
 * @returns {Promise<string|null>}
 */
export async function downloadMessagePhoto(client, message) {
  try {
    if (!client || !message || !message.photo) return null;

    const chatPart = (message.chatId ?? message.peerId?.channelId ?? 'chat').toString().replace(/[^\w-]/g, '');
    const filename = `${chatPart}_${message.id}.jpg`;
    const filePath = path.join(MEDIA_DIR, filename);
    const publicUrl = `${config.publicBaseUrl}/media/telegram/${filename}`;

    // Already downloaded (e.g. a re-run through the queue) — reuse it, no re-fetch.
    if (fs.existsSync(filePath)) {
      return publicUrl;
    }

    const buffer = await client.downloadMedia(message, {});
    if (!buffer || buffer.length === 0) return null;

    try {
      await fs.promises.writeFile(filePath, buffer);
      console.log(`[TelegramMedia] Saved message photo as fallback image: ${filename}`);
    } catch (writeErr) {
      console.warn('[TelegramMedia] File write failed, continuing with data URI:', writeErr.message);
    }

    // If thumbnail/photo is under 90KB, use base64 data URI directly to guarantee zero 404s
    // across isolated Railway containers or cold ephemeral restarts.
    if (buffer.length <= 90 * 1024) {
      return `data:image/jpeg;base64,${buffer.toString('base64')}`;
    }

    return publicUrl;
  } catch (err) {
    console.warn('[TelegramMedia Warning] Failed to download message photo:', err.message);
    return null;
  }
}
