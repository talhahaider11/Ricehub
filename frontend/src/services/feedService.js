import api from "./api";
import { cachedRequest, clearCachedRequests } from "./requestCache";

export function getFeed(params = {}) {
  const key = `feed:following:${JSON.stringify(params)}`;
  return cachedRequest(key, async () => {
    const response = await api.get("/feed/", { params });
    return response.data;
  });
}

export function getForYouFeed(params = {}, { refresh = false } = {}) {
  if (refresh) clearCachedRequests("feed:for-you:");
  const key = `feed:for-you:${JSON.stringify(params)}`;
  return cachedRequest(key, async () => {
    const response = await api.get("/feed/for-you/", { params });
    return response.data;
  });
}
