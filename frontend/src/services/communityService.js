import api from "./api";
import storyService from "./storyService";
import { collectPaginatedResults } from "../utils/paginatedResults";

function multipartForFile(data, fieldName) {
  const file = data?.[fieldName];
  if (!file || typeof File === "undefined" || !(file instanceof File)) {
    return data;
  }

  const payload = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value !== null && value !== undefined) payload.append(key, value);
  });
  return payload;
}

const communityService = {
  async stories(authorId) {
    return storyService.list(authorId);
  },
  async createStory(mediaId, visibility, caption) {
    return storyService.createStory(mediaId, visibility, caption);
  },
  async communities() {
    return (await api.get("/community/communities/")).data;
  },
  async createCommunity(data) {
    return (await api.post("/community/communities/", data)).data;
  },
  async updateCommunity(id, data) {
    return (await api.patch(`/community/communities/${id}/`, data)).data;
  },
  async communityPosts(id) {
    return (await api.get(`/community/communities/${id}/posts/`)).data;
  },
  async createCommunityPost(id, content) {
    return (await api.post(`/community/communities/${id}/posts/`, { content })).data;
  },
  async toggleCommunityPostLike(id) {
    return (await api.post(`/community/community-posts/${id}/like/`)).data;
  },
  async communityPostComments(id) {
    const response = await api.get(
      `/community/community-posts/${id}/comments/`
    );
    return collectPaginatedResults(
      response,
      (next) => api.get(next),
      "Comments"
    );
  },
  async createCommunityPostComment(id, content) {
    return (await api.post(`/community/community-posts/${id}/comments/`, {
      content,
    })).data;
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
  async communityMembers(id) {
    return (await api.get(`/community/communities/${id}/members/`)).data;
  },
  async removeCommunityMember(communityId, userId) {
    return api.delete(
      `/community/communities/${communityId}/members/${userId}/`
    );
  },
  async events() {
    return (await api.get("/community/events/")).data;
  },
  async createEvent(data) {
    const payload = data.banner ? new FormData() : data;
    if (data.banner) {
      Object.entries(data).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          payload.append(key, value);
        }
      });
    }
    return (await api.post(
      "/community/events/",
      payload,
      data.banner
        ? { headers: { "Content-Type": "multipart/form-data" } }
        : undefined
    )).data;
  },
  async updateEvent(id, data) {
    const payload = multipartForFile(data, "banner");
    return (await api.patch(
      `/community/events/${id}/`,
      payload,
      payload === data ? undefined : {
        headers: { "Content-Type": "multipart/form-data" },
      }
    )).data;
  },
  async eventInterestedUsers(id) {
    return (await api.get(`/community/events/${id}/interested-users/`)).data;
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
    const payload = multipartForFile(data, "image");
    return (await api.patch(
      `/community/marketplace/${id}/`,
      payload,
      payload === data ? undefined : {
        headers: { "Content-Type": "multipart/form-data" },
      }
    )).data;
  },
  async viewStory(id) {
    return storyService.markViewed(id);
  },
  async deleteStory(id) {
    return storyService.remove(id);
  },
  async storyViewers(id) {
    return storyService.viewers(id);
  },
};

export default communityService;
