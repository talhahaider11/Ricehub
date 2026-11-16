import api from "./api";
import { prepareImage } from "./mediaService";
import { ACCESS_TOKEN_KEY, WS_URL } from "../utils/constants";

const messageService = {
  async conversations(params = {}) {
    let response = await api.get(
      "/messages/conversations/",
      { params }
    );
    const data = response.data;
    if (!Array.isArray(data?.results) || !data.next) return data;

    const results = [...data.results];
    let next = data.next;
    const visited = new Set();
    while (next) {
      if (visited.has(next)) {
        throw new Error("Conversation pagination returned a repeated page.");
      }
      visited.add(next);
      response = await api.get(next);
      results.push(...(response.data.results || []));
      next = response.data.next;
    }
    return { ...data, results, next: null };
  },

  async createConversation(username) {
    const response = await api.post(
      "/messages/conversations/",
      {
        username,
      }
    );

    return response.data;
  },

  async createGroup(name, userIds) {
    const response = await api.post(
      "/messages/conversations/group/",
      { name, user_ids: userIds }
    );
    return response.data;
  },

  async addGroupMember(conversationId, userId) {
    const response = await api.post(
      `/messages/conversations/${conversationId}/members/`,
      { user_id: userId }
    );
    return response.data;
  },

  async updateGroupMember(conversationId, userId, role) {
    const response = await api.patch(
      `/messages/conversations/${conversationId}/members/${userId}/`,
      { role }
    );
    return response.data;
  },

  async removeGroupMember(conversationId, userId) {
    const response = await api.delete(
      `/messages/conversations/${conversationId}/members/${userId}/`
    );
    return response.data;
  },

  async updateGroupSettings(conversationId, adminsOnly) {
    const response = await api.patch(
      `/messages/conversations/${conversationId}/settings/`,
      { admins_only: adminsOnly }
    );
    return response.data;
  },

  async muteConversation(conversationId, isMuted) {
    const response = await api.patch(
      `/messages/conversations/${conversationId}/mute/`,
      { is_muted: isMuted }
    );
    return response.data;
  },

  async leaveGroup(conversationId) {
    return api.delete(`/messages/conversations/${conversationId}/leave/`);
  },

  async searchGroupMembers(query = "") {
    const response = await api.get("/messages/group-members/search/", {
      params: query ? { q: query } : undefined,
    });
    return response.data;
  },

  async messages(conversationId, page = 1) {
    const response = await api.get(
      `/messages/conversations/${conversationId}/messages/`,
      {
        params: { page, page_size: 50 },
      }
    );

    return response.data;
  },

  async sendText(conversationId, content, replyToId) {
    const response = await api.post(
      `/messages/conversations/${conversationId}/messages/`,
      {
        content,
        ...(replyToId ? { reply_to_id: replyToId } : {}),
      }
    );
    return response.data;
  },

  async sendAttachment(conversationId, file, replyToId, attachmentType = "audio") {
    const preparedFile = attachmentType === "image"
      ? await prepareImage(file)
      : file;
    const formData = new FormData();
    formData.append("attachment", preparedFile, preparedFile.name || file.name);
    formData.append("attachment_type", attachmentType);
    formData.append("content", "");
    if (replyToId) formData.append("reply_to_id", String(replyToId));
    const response = await api.post(
      `/messages/conversations/${conversationId}/messages/`,
      formData
    );
    return response.data;
  },

  async markRead(conversationId) {
    const response = await api.post(
      `/messages/conversations/${conversationId}/read/`
    );

    return response.data;
  },

  async editMessage(messageId, content) {
    const response = await api.patch(
      `/messages/messages/${messageId}/edit/`,
      { content }
    );
    return response.data;
  },

  async deleteMessage(messageId) {
    const response = await api.delete(
      `/messages/messages/${messageId}/delete/`
    );
    return response.data;
  },

  async archiveConversation(conversationId, isArchived) {
    const response = await api.patch(
      `/messages/conversations/${conversationId}/archive/`,
      { is_archived: isArchived }
    );
    return response.data;
  },

  async deleteConversation(conversationId) {
    const response = await api.delete(
      `/messages/conversations/${conversationId}/delete/`
    );
    return response.data;
  },

  createSocket(conversationId) {
    const token =
      localStorage.getItem(ACCESS_TOKEN_KEY);

    return new WebSocket(
      `${WS_URL}/chat/${conversationId}/?token=${encodeURIComponent(token)}`
    );
  },
};

export default messageService;