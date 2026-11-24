const CONVERSATION_CACHE_PREFIX = "ricehub:conversation-cache:v1:";
const MESSAGE_CACHE_PREFIX = "ricehub:message-cache:v1:";
const CONVERSATION_CACHE_TTL_MS = 2 * 60 * 1000;

function getUserScope(userId) {
  return userId == null ? null : String(userId);
}

function readCache(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    localStorage.removeItem(key);
    return null;
  }
}

function writeCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Chat cache could not be saved:", error);
  }
}

function conversationCacheKey(archived, userId) {
  return `${CONVERSATION_CACHE_PREFIX}${getUserScope(userId)}:${archived ? "archived" : "inbox"}`;
}

function messageCacheKey(conversationId, userId) {
  return `${MESSAGE_CACHE_PREFIX}${getUserScope(userId)}:${conversationId}`;
}

export function getCachedConversations(archived = false, userId) {
  if (userId == null) return null;
  const cached = readCache(conversationCacheKey(archived, userId));
  return cached && Array.isArray(cached.data?.results) ? cached : null;
}

export function isConversationCacheFresh(cached) {
  return Boolean(
    cached
    && Number.isFinite(cached.updatedAt)
    && Date.now() - cached.updatedAt < CONVERSATION_CACHE_TTL_MS
  );
}

export function cacheConversations(data, archived = false, userId) {
  if (userId == null) return;
  writeCache(conversationCacheKey(archived, userId), {
    updatedAt: Date.now(),
    data,
  });
}

export function getCachedMessages(conversationId, userId) {
  if (conversationId == null || userId == null) return null;
  const cached = readCache(messageCacheKey(conversationId, userId));
  return cached && Array.isArray(cached.messages) ? cached : null;
}

export function cacheMessages(
  conversationId,
  userId,
  messages,
  { hasOlderMessages = messages.length >= 30, nextPage = 2 } = {}
) {
  if (conversationId == null || userId == null) return;
  writeCache(messageCacheKey(conversationId, userId), {
    updatedAt: Date.now(),
    messages,
    hasOlderMessages,
    nextPage,
  });
}

export function clearConversationCaches() {
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(CONVERSATION_CACHE_PREFIX)) {
      localStorage.removeItem(key);
    }
  }
}
