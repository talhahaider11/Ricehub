const CONVERSATION_CACHE_PREFIX = "ricehub:conversation-cache:v1:";
const MESSAGE_CACHE_PREFIX = "ricehub:message-cache:v1:";
const CONVERSATION_CACHE_TTL_MS = 2 * 60 * 1000;
const MAX_MEMORY_CACHE_ENTRIES = 24;
const MAX_PERSISTED_MESSAGE_CACHE_ENTRIES = 12;
const MAX_PERSISTED_MESSAGE_CACHE_CHARS = 1_500_000;
const MAX_MEMOIZED_MEDIA_URLS = 300;

const conversationMemoryCache = new Map();
const messageMemoryCache = new Map();
const mediaUrlCache = new Map();

function getUserScope(userId) {
  return userId == null ? null : String(userId);
}

function remember(cache, key, value, maxEntries = MAX_MEMORY_CACHE_ENTRIES) {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > maxEntries) {
    cache.delete(cache.keys().next().value);
  }
  return value;
}

function readCache(key, memoryCache) {
  if (memoryCache.has(key)) {
    return remember(memoryCache, key, memoryCache.get(key));
  }

  let raw;
  try {
    raw = localStorage.getItem(key);
  } catch (error) {
    console.warn("Chat cache could not be read:", error);
    return null;
  }
  if (!raw) return null;
  try {
    return remember(memoryCache, key, JSON.parse(raw));
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    try {
      localStorage.removeItem(key);
    } catch (removeError) {
      console.warn("Invalid chat cache could not be removed:", removeError);
    }
    return null;
  }
}

function writeCache(key, value, memoryCache) {
  remember(memoryCache, key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Chat cache could not be saved:", error);
  }
}

function prunePersistedMessageCaches() {
  try {
    const entries = [];
    let totalChars = 0;
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(MESSAGE_CACHE_PREFIX)) continue;
      const value = localStorage.getItem(key);
      if (!value) continue;
      totalChars += value.length;
      let updatedAt = 0;
      try {
        updatedAt = JSON.parse(value).lastAccessedAt || 0;
      } catch {
        updatedAt = 0;
      }
      entries.push({ key, value, updatedAt });
    }

    entries.sort((left, right) => left.updatedAt - right.updatedAt);
    while (
      entries.length > MAX_PERSISTED_MESSAGE_CACHE_ENTRIES
      || totalChars > MAX_PERSISTED_MESSAGE_CACHE_CHARS
    ) {
      const oldest = entries.shift();
      if (!oldest) break;
      localStorage.removeItem(oldest.key);
      totalChars -= oldest.value.length;
      messageMemoryCache.delete(oldest.key);
    }
  } catch (error) {
    console.warn("Old chat caches could not be evicted:", error);
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
  const cached = readCache(
    conversationCacheKey(archived, userId),
    conversationMemoryCache
  );
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
  }, conversationMemoryCache);
}

export function getCachedMessages(conversationId, userId) {
  if (conversationId == null || userId == null) return null;
  const key = messageCacheKey(conversationId, userId);
  const cached = readCache(key, messageMemoryCache);
  if (cached) {
    cached.lastAccessedAt = Date.now();
  }
  return cached && Array.isArray(cached.messages) ? cached : null;
}

export function cacheMessages(
  conversationId,
  userId,
  messages,
  { hasOlderMessages = messages.length >= 30, nextPage = 2 } = {}
) {
  if (conversationId == null || userId == null) return;
  const key = messageCacheKey(conversationId, userId);
  const value = {
    updatedAt: Date.now(),
    lastAccessedAt: Date.now(),
    messages,
    mediaMetadata: messages
      .filter((message) => message.attachment)
      .map(({ id, attachment, attachment_type }) => ({
        id,
        attachment,
        attachment_type,
      })),
    hasOlderMessages,
    nextPage,
  };
  writeCache(key, value, messageMemoryCache);
  prunePersistedMessageCaches();
}

export function getMemoizedChatMediaUrl(
  conversationId,
  userId,
  messageId,
  mediaUrl
) {
  if (
    conversationId == null
    || userId == null
    || messageId == null
    || !mediaUrl
  ) return mediaUrl || "";

  const key = `${getUserScope(userId)}:${conversationId}:${messageId}`;
  const cachedUrl = mediaUrlCache.get(key);
  if (cachedUrl === mediaUrl) {
    return remember(mediaUrlCache, key, cachedUrl, MAX_MEMOIZED_MEDIA_URLS);
  }
  return remember(mediaUrlCache, key, mediaUrl, MAX_MEMOIZED_MEDIA_URLS);
}

export function clearMessageCache(conversationId, userId) {
  if (conversationId == null) return;
  const suffix = `:${conversationId}`;
  const matchingMessageKeys = [...messageMemoryCache.keys()].filter((key) => (
    key.endsWith(suffix)
    && (userId == null || key.startsWith(`${MESSAGE_CACHE_PREFIX}${getUserScope(userId)}:`))
  ));
  matchingMessageKeys.forEach((key) => messageMemoryCache.delete(key));
  for (const mediaKey of mediaUrlCache.keys()) {
    if (
      userId == null
        ? mediaKey.includes(`:${conversationId}:`)
        : mediaKey.startsWith(`${getUserScope(userId)}:${conversationId}:`)
    ) {
      mediaUrlCache.delete(mediaKey);
    }
  }
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (
        key?.startsWith(MESSAGE_CACHE_PREFIX)
        && key.endsWith(suffix)
        && (userId == null || key.startsWith(
          `${MESSAGE_CACHE_PREFIX}${getUserScope(userId)}:`
        ))
      ) {
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.warn("Conversation message cache could not be cleared:", error);
  }
}

export function clearConversationCaches() {
  for (const key of conversationMemoryCache.keys()) {
    conversationMemoryCache.delete(key);
  }
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(CONVERSATION_CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.warn("Conversation caches could not be cleared:", error);
  }
}

export function clearAllChatCaches() {
  conversationMemoryCache.clear();
  messageMemoryCache.clear();
  mediaUrlCache.clear();
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (
        key?.startsWith(CONVERSATION_CACHE_PREFIX)
        || key?.startsWith(MESSAGE_CACHE_PREFIX)
      ) {
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.warn("Chat caches could not be cleared:", error);
  }
}
