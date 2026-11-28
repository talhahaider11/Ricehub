import api from "./api";
import { prepareImage } from "./mediaService";
import { ACCESS_TOKEN_KEY, WS_URL } from "../utils/constants";
import {
  cacheConversations,
  clearConversationCaches,
  clearMessageCache,
  getCachedConversations,
  isConversationCacheFresh,
} from "./messageCache";

const MAX_PARALLEL_CONVERSATION_PAGES = 4;

const messageService = {
  async conversations(params = {}, { userId, refresh = false } = {}) {
    const archived = Boolean(params.archived);
    const cached = getCachedConversations(archived, userId);
    if (!refresh && isConversationCacheFresh(cached)) {
      return cached.data;
    }

    const response = await api.get(
      "/messages/conversations/",
      { params }
    );
    const data = response.data;
    if (!Array.isArray(data?.results) || !data.next) {
      cacheConversations(data, archived, userId);
      return data;
    }

    const results = [...data.results];
    const pageSize = Number(params.page_size) || data.results.length;
    const count = Number(data.count);
    let nextUrl;
    try {
      nextUrl = new URL(data.next, api.defaults?.baseURL || window.location.origin);
    } catch {
      nextUrl = null;
    }

    const nextPageValue = nextUrl?.searchParams.get("page");
    const nextPage = Number(nextPageValue);
    const totalPages = Math.ceil(count / pageSize);
    if (
      !nextUrl
      || !Number.isFinite(count)
      || pageSize <= 0
      || !nextPageValue
      || !Number.isFinite(nextPage)
      || !Number.isInteger(nextPage)
      || nextPage < 2
      || totalPages < nextPage
    ) {
      let next = data.next;
      const visited = new Set();
      while (next) {
        if (visited.has(next)) {
          throw new Error("Conversation pagination returned a repeated page.");
        }
        visited.add(next);
        const pageResponse = await api.get(next);
        results.push(...(pageResponse.data.results || []));
        next = pageResponse.data.next;
      }
      const combined = { ...data, results, next: null };
      cacheConversations(combined, archived, userId);
      return combined;
    }

    const pageUrls = [];
    for (let page = nextPage; page <= totalPages; page += 1) {
      const pageUrl = new URL(nextUrl);
      pageUrl.searchParams.set("page", String(page));
      pageUrls.push(pageUrl.toString());
    }

    for (
      let index = 0;
      index < pageUrls.length;
      index += MAX_PARALLEL_CONVERSATION_PAGES
    ) {
      const pageResponses = await Promise.all(
        pageUrls
          .slice(index, index + MAX_PARALLEL_CONVERSATION_PAGES)
          .map((url) => api.get(url))
      );
      pageResponses.forEach((pageResponse) => {
        results.push(...(pageResponse.data.results || []));
      });
    }

    const combined = { ...data, results, next: null };
    cacheConversations(combined, archived, userId);
    return combined;
  },

  async createConversation(username) {
    const response = await api.post(
      "/messages/conversations/",
      {
        username,
      }
    );

    clearConversationCaches();
    return response.data;
  },

  async createGroup(name, userIds) {
    const response = await api.post(
      "/messages/conversations/group/",
      { name, user_ids: userIds }
    );
    clearConversationCaches();
    return response.data;
  },

  async addGroupMember(conversationId, userId) {
    const response = await api.post(
      `/messages/conversations/${conversationId}/members/`,
      { user_id: userId }
    );
    clearConversationCaches();
    return response.data;
  },

  async updateGroupMember(conversationId, userId, role) {
    const response = await api.patch(
      `/messages/conversations/${conversationId}/members/${userId}/`,
      { role }
    );
    clearConversationCaches();
    return response.data;
  },

  async removeGroupMember(conversationId, userId) {
    const response = await api.delete(
      `/messages/conversations/${conversationId}/members/${userId}/`
    );
    clearConversationCaches();
    return response.data;
  },

  async updateGroupSettings(conversationId, adminsOnly) {
    const response = await api.patch(
      `/messages/conversations/${conversationId}/settings/`,
      { admins_only: adminsOnly }
    );
    clearConversationCaches();
    return response.data;
  },

  async muteConversation(conversationId, isMuted) {
    const response = await api.patch(
      `/messages/conversations/${conversationId}/mute/`,
      { is_muted: isMuted }
    );
    clearConversationCaches();
    return response.data;
  },

  async leaveGroup(conversationId) {
    const response = await api.delete(`/messages/conversations/${conversationId}/leave/`);
    clearConversationCaches();
    clearMessageCache(conversationId);
    return response;
  },

  async searchGroupMembers(query = "") {
    const response = await api.get("/messages/group-members/search/", {
      params: query ? { q: query } : undefined,
    });
    return response.data;
  },

  async messages(conversationId, page = 1, afterId = null) {
    const response = await api.get(
      `/messages/conversations/${conversationId}/messages/`,
      {
        params: {
          page,
          page_size: 30,
          ...(afterId != null ? { after_id: afterId } : {}),
        },
      }
    );

    return response.data;
  },

  async messagesSince(conversationId, afterId) {
    let page = 1;
    let responseData;
    const results = [];

    do {
      responseData = await this.messages(conversationId, page, afterId);
      results.push(...(responseData.results || []));
      page += 1;
    } while (responseData.next);

    return { ...responseData, results, next: null };
  },

  async sendText(conversationId, content, replyToId) {
    const response = await api.post(
      `/messages/conversations/${conversationId}/messages/`,
      {
        content,
        ...(replyToId ? { reply_to_id: replyToId } : {}),
      }
    );
    clearConversationCaches();
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
      formData,
      {
        headers: { "Content-Type": undefined },
        ...(attachmentType === "video" ? { timeout: 0 } : {}),
      }
    );
    clearConversationCaches();
    return response.data;
  },

  async markRead(conversationId) {
    const response = await api.post(
      `/messages/conversations/${conversationId}/read/`
    );

    clearConversationCaches();
    return response.data;
  },

  async sendCallSignal(signal) {
    const response = await api.post("/messages/calls/signal/", signal);
    return response.data;
  },

  async initiateCall(signal) {
    const response = await api.post("/calls/initiate/", signal);
    return response.data;
  },

  async incomingCalls() {
    const response = await api.get("/calls/incoming/");
    return response.data;
  },

  async editMessage(messageId, content) {
    const response = await api.patch(
      `/messages/messages/${messageId}/edit/`,
      { content }
    );
    clearConversationCaches();
    return response.data;
  },

  async deleteMessage(messageId) {
    const response = await api.delete(
      `/messages/messages/${messageId}/delete/`
    );
    clearConversationCaches();
    return response.data;
  },

  async archiveConversation(conversationId, isArchived) {
    const response = await api.patch(
      `/messages/conversations/${conversationId}/archive/`,
      { is_archived: isArchived }
    );
    clearConversationCaches();
    return response.data;
  },

  async deleteConversation(conversationId) {
    const response = await api.delete(
      `/messages/conversations/${conversationId}/delete/`
    );
    clearConversationCaches();
    clearMessageCache(conversationId);
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