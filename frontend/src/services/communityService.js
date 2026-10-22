import api from "./api";

const communityService = {
  async stories() {
    return (await api.get("/community/stories/")).data;
  },
  async createStory(data) {
    return (await api.post("/community/stories/", data, {
      headers: { "Content-Type": "multipart/form-data" },
    })).data;
  },
  async communities() {
    return (await api.get("/community/communities/")).data;
  },
  async createCommunity(data) {
    return (await api.post("/community/communities/", data)).data;
  },
  async communityPosts(id) {
    return (await api.get(`/community/communities/${id}/posts/`)).data;
  },
  async createCommunityPost(id, content) {
    return (await api.post(`/community/communities/${id}/posts/`, { content })).data;
  },
  async removeCommunityPost(id) {
    return api.delete(`/community/community-posts/${id}/`);
  },
  async joinCommunity(id) {
    return (await api.post(`/community/communities/${id}/membership/`)).data;
  },
  async leaveCommunity(id) {
    return api.delete(`/community/communities/${id}/membership/`);
  },
  async events() {
    return (await api.get("/community/events/")).data;
  },
  async createEvent(data) {
    return (await api.post("/community/events/", data)).data;
  },
  async updateEvent(id, data) {
    return (await api.patch(`/community/events/${id}/`, data)).data;
  },
  async deleteEvent(id) {
    return api.delete(`/community/events/${id}/`);
  },
  async respondToEvent(id, response) {
    return (await api.post(`/community/events/${id}/attendance/`, { response })).data;
  },
  async inviteFriendToEvent(eventId, userId) {
    return (await api.post(`/community/events/${eventId}/invitations/`, {
      user_id: userId,
    })).data;
  },
  async invitations() {
    return (await api.get("/community/event-invitations/")).data;
  },
  async respondToInvitation(id, response) {
    return (await api.post(`/community/event-invitations/${id}/respond/`, {
      response,
    })).data;
  },
  async createOrder(listingId) {
    return (await api.post("/community/marketplace/orders/", {
      listing: listingId,
    })).data;
  },
  async orders() {
    return (await api.get("/community/marketplace/orders/")).data;
  },
  async updateOrder(id, status) {
    return (await api.patch(`/community/marketplace/orders/${id}/`, { status })).data;
  },
  async cancelEventResponse(id) {
    return api.delete(`/community/events/${id}/attendance/`);
  },
  async listings(query = "") {
    return (await api.get("/community/marketplace/", {
      params: { q: query },
    })).data;
  },
  async createListing(data) {
    return (await api.post("/community/marketplace/", data, {
      headers: { "Content-Type": "multipart/form-data" },
    })).data;
  },
  async updateListing(id, data) {
    return (await api.patch(`/community/marketplace/${id}/`, data)).data;
  },
  async viewStory(id) {
    return (await api.post(`/community/stories/${id}/views/`)).data;
  },
  async deleteStory(id) {
    return api.delete(`/community/stories/${id}/`);
  },
  async storyViewers(id) {
    return (await api.get(`/community/stories/${id}/views/`)).data;
  },
};

export default communityService;
