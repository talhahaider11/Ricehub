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
};

export default searchService;
