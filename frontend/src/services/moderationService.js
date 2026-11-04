import api from "./api";

const moderationService = {
  async reportContent(payload) {
    const response = await api.post("/moderation/content-reports/", payload);
    return response.data;
  },

  async getAdminOverview() {
    const [overview, dashboard] = await Promise.all([
      api.get("/moderation/admin/overview/"),
      api.get("/admin/dashboard/"),
    ]);
    return {
      ...overview.data,
      active_users: dashboard.data.users.active,
      messages: dashboard.data.messages.total,
    };
  },

  async getAdminDashboard() {
    const response = await api.get("/admin/dashboard/");
    return response.data;
  },

  async getAdminUsers(params = {}) {
    const response = await api.get("/admin/users/", { params });
    return response.data;
  },

  async getAdminUser(userId) {
    const response = await api.get(`/admin/users/${userId}/`);
    return response.data;
  },

  async deleteUser(userId, reason) {
    return api.delete(`/admin/users/${userId}/`, {
      data: { reason },
    });
  },

  async suspendUser(userId, reason) {
    const response = await api.post(`/admin/users/${userId}/suspend/`, {
      reason,
    });
    return response.data;
  },

  async unsuspendUser(userId) {
    const response = await api.post(`/admin/users/${userId}/unsuspend/`);
    return response.data;
  },

  async getAccountReports(status = "open") {
    const response = await api.get("/admin/account-reports/", {
      params: { status },
    });
    return response.data;
  },

  async updateAccountReport(reportId, payload) {
    const response = await api.patch(
      `/admin/account-reports/${reportId}/`,
      payload
    );
    return response.data;
  },

  async getContentReports(status = "open") {
    const response = await api.get("/moderation/admin/reports/", {
      params: { status },
    });
    return response.data;
  },

  async getContentReport(reportId) {
    const response = await api.get(`/moderation/admin/reports/${reportId}/`);
    return response.data;
  },

  async updateContentReport(reportId, payload) {
    const response = await api.patch(
      `/moderation/admin/reports/${reportId}/`,
      payload
    );
    return response.data;
  },

  async getUserAnalytics(params = {}) {
    const response = await api.get("/admin/analytics/users/", { params });
    return response.data;
  },

  async getAdminPosts(params = {}) {
    const response = await api.get("/admin/posts/", { params });
    return response.data;
  },

  async deletePost(postId, reason) {
    return api.delete(`/admin/posts/${postId}/`, {
      data: { reason },
    });
  },
};

export default moderationService;
