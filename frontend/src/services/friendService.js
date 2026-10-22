import api from "./api";

const friendService = {
  async list() {
    const response = await api.get(
      "/friends/"
    );

    return response.data;
  },

  async requests() {
    const response = await api.get(
      "/friends/requests/"
    );

    return response.data;
  },

  async send(userId) {
    const response = await api.post(
      "/friends/requests/",
      {
        user_id: userId,
      }
    );

    return response.data;
  },

  async accept(requestId) {
    const response = await api.post(
      `/friends/requests/${requestId}/respond/`,
      { action: "accept" }
    );

    return response.data;
  },

  async reject(requestId) {
    const response = await api.post(
      `/friends/requests/${requestId}/respond/`,
      { action: "reject" }
    );

    return response.data;
  },
};

export default friendService;
