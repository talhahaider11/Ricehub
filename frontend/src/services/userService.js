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

  async checkUsername(username) {
    const response = await api.get("/users/username-availability/", {
      params: { username },
    });

    if (
      typeof response.data?.available !== "boolean" ||
      !Array.isArray(response.data?.suggestions)
    ) {
      throw new Error("The server returned an invalid username availability response.");
    }

    return response.data;
  },
};

export default userService;
