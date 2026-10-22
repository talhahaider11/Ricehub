import api from "./api";

const postService = {
  async list(page = 1, sort = "recent") {
    const response = await api.get("/posts/", {
      params: {
        page,
        page_size: 10,
        sort,
      },
    });

    return response.data;
  },

  async get(id) {
    const response = await api.get(
      `/posts/${id}/`
    );

    return response.data;
  },

  async create(data) {
    const response = await api.post(
      "/posts/",
      data,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return response.data;
  },

  async update(id, data) {
    const response = await api.patch(
      `/posts/${id}/`,
      data
    );

    return response.data;
  },

  async remove(id) {
    return api.delete(`/posts/${id}/`);
  },

  async comments(postId) {
    const response = await api.get(
      `/posts/${postId}/comments/`
    );

    return response.data;
  },

  async createComment(postId, content) {
    const response = await api.post(
      `/posts/${postId}/comments/`,
      { content }
    );

    return response.data;
  },

  async replies(postId, commentId) {
    const response = await api.get(
      `/posts/${postId}/comments/${commentId}/replies/`
    );

    return response.data;
  },

  async createReply(
    postId,
    commentId,
    content
  ) {
    const response = await api.post(
      `/posts/${postId}/comments/${commentId}/replies/`,
      { content }
    );

    return response.data;
  },

  async react(postId, reactionType = "like") {
    const response = await api.post(
      `/posts/${postId}/reactions/`,
      {
        reaction_type: reactionType,
      }
    );

    return response.data;
  },

  async unreact(postId) {
    return api.delete(
      `/posts/${postId}/reactions/`
    );
  },
};

export default postService;
