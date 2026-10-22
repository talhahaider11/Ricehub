import api from "./api";

const notificationService = {
  async list() {
    const response = await api.get(
      "/notifications/"
    );

    return response.data;
  },

  async markRead(id) {
    return api.post(
      `/notifications/${id}/read/`
    );
  },

  async markAllRead() {
    return api.post(
      "/notifications/read-all/"
    );
  },

  async getPreferences() {
    const response = await api.get("/notifications/preferences/");
    return response.data;
  },

  async updatePreferences(preferences) {
    const response = await api.patch(
      "/notifications/preferences/",
      preferences
    );
    return response.data;
  },

  async registerDevice(token, platform) {
    const response = await api.post("/notifications/devices/", {
      token,
      platform,
    });
    return response.data;
  },

  async unregisterDevice(token, accessToken) {
    return api.delete("/notifications/devices/", {
      data: { token },
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
    });
  },
};

export default notificationService;
