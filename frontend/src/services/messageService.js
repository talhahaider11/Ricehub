import api from "./api";
import { ACCESS_TOKEN_KEY, WS_URL } from "../utils/constants";

const messageService = {
  async conversations() {
    const response = await api.get(
      "/messages/conversations/"
    );

    return response.data;
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

  async messages(conversationId, page = 1) {
    const response = await api.get(
      `/messages/conversations/${conversationId}/messages/`,
      {
        params: { page },
      }
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

  createSocket(conversationId) {
    const token =
      localStorage.getItem(ACCESS_TOKEN_KEY);

    return new WebSocket(
      `${WS_URL}/${conversationId}/?token=${encodeURIComponent(token)}`
    );
  },
};

export default messageService;