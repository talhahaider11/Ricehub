import { ACCESS_TOKEN_KEY } from "../utils/constants";

const CACHE_TTL_MS = 90 * 1000;
const cache = new Map();
const inFlight = new Map();

function getScopedKey(key) {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY)
    || localStorage.getItem("access_token")
    || "";
  return `${token}:${key}`;
}

export function cachedRequest(key, request, ttl = CACHE_TTL_MS) {
  const now = Date.now();
  for (const [cachedKey, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(cachedKey);
  }

  const scopedKey = getScopedKey(key);
  const cached = cache.get(scopedKey);
  if (cached && cached.expiresAt > now) {
    return Promise.resolve(cached.value);
  }
  if (inFlight.has(scopedKey)) return inFlight.get(scopedKey);

  const pending = Promise.resolve()
    .then(request)
    .then((value) => {
      cache.set(scopedKey, { value, expiresAt: Date.now() + ttl });
      return value;
    })
    .finally(() => {
      inFlight.delete(scopedKey);
    });

  inFlight.set(scopedKey, pending);
  return pending;
}

export function clearCachedRequests(prefix = "") {
  for (const key of cache.keys()) {
    if (!prefix || key.includes(`:${prefix}`)) {
      cache.delete(key);
    }
  }
}
