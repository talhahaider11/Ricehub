import api from "./api";

const searchService = {
  async global(query) {
    const response = await api.get(
      "/search/",
      {
        params: {
          q: query,
        },
      }
    );

    return response.data;
  },

  async posts(query, page = 1) {
    const response = await api.get("/posts/search/", {
      params: { q: query, page },
    });
    return response.data;
  },

  async suggestions() {
    const response = await api.get("/users/suggestions/");
    return response.data;
  },

  async trendingHashtags() {
    const response = await api.get("/hashtags/trending/");
    return response.data;
  },

  async hashtag(tag, page = 1) {
    const response = await api.get(
      `/hashtags/${encodeURIComponent(tag)}/`,
      { params: { page } }
    );
    return response.data;
  },

  async explore(page = 1) {
    const response = await api.get("/explore/", { params: { page } });
    return response.data;
  },
};

export default searchService;
