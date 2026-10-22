import api from "./api";

const userService = {
  async getMe() {
    const response = await api.get("/users/me/");
    return response.data;
  },

  async getUser(id) {
    const response = await api.get(
      `/users/${id}/`
    );

    return response.data;
  },

  async updateMe(data) {
    const response = await api.patch(
      "/users/me/update/",
      data,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return response.data;
  },

  async search(query) {
    const response = await api.get(
      "/users/search/",
      {
        params: { q: query },
      }
    );

    return response.data;
  },
};

export default userService;
