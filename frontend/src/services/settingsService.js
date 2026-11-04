import api from "./api";
import { REFRESH_TOKEN_KEY } from "../utils/constants";

const settingsService = {
  async getPrivacy() {
    const response = await api.get("/users/privacy/");
    return response.data.privacy || response.data;
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

  async muteUser(userId) {
    const response = await api.post(`/users/muted-users/${userId}/`);
    return response.data;
  },

  async unmuteUser(userId) {
    return api.delete(`/users/muted-users/${userId}/`);
  },

  async isMuted(userId) {
    const response = await api.get(`/users/muted-users/${userId}/`);
    return response.data.muted;
  },

  async reportAccount(payload) {
    const response = await api.post("/users/reports/accounts/", payload);
    return response.data;
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
    const response = await api.post("/users/security/sessions/logout-all/", {
      refresh:
        localStorage.getItem(REFRESH_TOKEN_KEY)
        || localStorage.getItem("refresh_token"),
    });
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
