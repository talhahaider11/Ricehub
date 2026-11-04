import moderationService from "./moderationService";

const adminService = {
  async getDashboard() {
    return moderationService.getAdminDashboard();
  },
  async getUsers(params = {}) {
    return moderationService.getAdminUsers(params);
  },
  async getUser(userId) {
    return moderationService.getAdminUser(userId);
  },
  async suspendUser(userId, reason) {
    return moderationService.suspendUser(userId, reason);
  },
  async unsuspendUser(userId) {
    return moderationService.unsuspendUser(userId);
  },
  async getReports(params = {}) {
    return moderationService.getContentReports(params.status || "open");
  },
  async getReport(reportId) {
    return moderationService.getContentReport(reportId);
  },
  async updateReport(reportId, payload) {
    return moderationService.updateContentReport(reportId, payload);
  },
  async getPosts(params = {}) {
    return moderationService.getAdminPosts(params);
  },
  async deletePost(postId, reason) {
    return moderationService.deletePost(postId, reason);
  },
  async getAnalytics(params = {}) {
    return moderationService.getUserAnalytics(params);
  },
};

export default adminService;
