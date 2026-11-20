import api from "./api";
import { cachedRequest, clearCachedRequests } from "./requestCache";

const storyService = {
  async list(authorId) {
    const key = `stories:${authorId == null ? "all" : authorId}`;
    return cachedRequest(key, async () => {
      const response = await api.get("/stories/", {
        params: authorId ? { author: authorId } : undefined,
      });
      return response.data;
    });
  },

  async createStory(mediaId, visibility = "friends", caption = "") {
    const response = await api.post("/stories/create/", {
      ...(mediaId ? { media_id: mediaId } : {}),
      visibility,
      caption,
    });
    clearCachedRequests("stories:");
    return response.data;
  },

  async get(storyId) {
    const response = await api.get(`/stories/${storyId}/`);
    return response.data;
  },

  async markViewed(storyId) {
    const response = await api.post(`/stories/${storyId}/view/`);
    return response.data;
  },

  async toggleLike(storyId) {
    const response = await api.post(`/stories/${storyId}/like/`);
    return response.data;
  },

  async remove(storyId) {
    const response = await api.delete(`/stories/${storyId}/delete/`);
    clearCachedRequests("stories:");
    return response;
  },

  async viewers(storyId) {
    const response = await api.get(`/stories/${storyId}/viewers/`);
    return response.data;
  },
};

export const {
  list: getStories,
  createStory,
  get: getStory,
  markViewed: markStoryViewed,
  toggleLike: toggleStoryLike,
  remove: deleteStory,
} = storyService;

export default storyService;
