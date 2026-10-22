import api from "./api";

const settingsService = {
  async getPrivacy() {
    const response = await api.get("/users/privacy/");
    return response.data;
  },

  async updatePrivacy(settings) {
    const response = await api.patch("/users/privacy/", settings);
    return response.data;
  },

  async getBlockedUsers() {
    const response = await api.get("/users/blocked-users/");
    return response.data;
  },

  async blockUser(username) {
    const response = await api.post("/users/blocked-users/", { username });
    return response.data;
  },

  async unblockUser(userId) {
    return api.delete(`/users/blocked-users/${userId}/`);
  },

  async getSecurity() {
    const response = await api.get("/users/security/two-factor/");
    return response.data;
  },

  async updateTwoFactor(payload) {
    const response = await api.post("/users/security/two-factor/", payload);
    return response.data;
  },

  async signOutOtherSessions() {
    const response = await api.post("/users/security/sessions/logout-all/");
    return response.data;
  },

  async exportAccount() {
    const response = await api.get("/users/account/export/");
    return response.data;
  },

  async deleteAccount(payload) {
    const response = await api.post("/users/account/delete/", payload);
    return response.data;
  },
};

export default settingsService;
