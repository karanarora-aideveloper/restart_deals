import { defaultRedis } from '../utils/redis.js';

const SESSION_PREFIX = 'session:tg:';
const SESSION_TTL_SECONDS = 1800; // 30 minutes
const memorySessionFallback = new Map();

/**
 * Multi-Turn Conversational Session Manager for Telegram Shopping Assistant.
 * Uses Redis with an automatic in-memory fallback.
 */
export async function getSession(chatId) {
  if (!chatId) return createEmptySession(chatId);
  const key = `${SESSION_PREFIX}${chatId}`;

  try {
    const raw = await defaultRedis.get(key);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    // If Redis fails, check in-memory fallback
    if (memorySessionFallback.has(chatId)) {
      const mem = memorySessionFallback.get(chatId);
      if (Date.now() - mem.updatedAt < SESSION_TTL_SECONDS * 1000) {
        return mem;
      }
      memorySessionFallback.delete(chatId);
    }
  }

  return createEmptySession(chatId);
}

export async function saveSession(chatId, session) {
  if (!chatId || !session) return;
  const key = `${SESSION_PREFIX}${chatId}`;
  session.updatedAt = Date.now();

  try {
    await defaultRedis.set(key, JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
  } catch (err) {
    // Save to in-memory fallback
    memorySessionFallback.set(chatId, session);
  }
}

export async function updateSession(chatId, partial) {
  const session = await getSession(chatId);
  const updated = { ...session, ...partial };
  await saveSession(chatId, updated);
  return updated;
}

export async function clearSession(chatId) {
  const key = `${SESSION_PREFIX}${chatId}`;
  try {
    await defaultRedis.del(key);
  } catch (e) {}
  memorySessionFallback.delete(chatId);
}

function createEmptySession(chatId) {
  return {
    chatId: String(chatId),
    history: [],
    lastQuery: null,
    candidateProductIds: [],
    currentIndex: 0,
    linkedEmail: null,
    pendingAlert: null,
    updatedAt: Date.now(),
  };
}
