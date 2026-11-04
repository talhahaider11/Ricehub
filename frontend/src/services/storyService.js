import api from "./api";

const storyService = {
  async list(authorId) {
    const response = await api.get("/stories/", {
      params: authorId ? { author: authorId } : undefined,
    });
    return response.data;
  },

  async createStory(mediaId, visibility = "friends", caption = "") {
    const response = await api.post("/stories/create/", {
      ...(mediaId ? { media_id: mediaId } : {}),
      visibility,
      caption,
    });
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

  async remove(storyId) {
    return api.delete(`/stories/${storyId}/delete/`);
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
  remove: deleteStory,
} = storyService;

export default storyService;
