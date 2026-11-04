import api from "./api";

export async function getFeed(params = {}) {
  const response = await api.get("/feed/", { params });
  return response.data;
}

export async function getForYouFeed(params = {}) {
  const response = await api.get("/feed/for-you/", { params });
  return response.data;
}
