import api from "./api";

const billingService = {
  async getOptions() {
    const response = await api.get("/billing/options/");
    return response.data;
  },

  async getRequests() {
    const response = await api.get("/billing/payment-requests/");
    return response.data;
  },

  async requestPayment(payload) {
    const config = payload instanceof FormData
      ? { headers: { "Content-Type": "multipart/form-data" } }
      : undefined;
    const response = await api.post("/billing/payment-requests/", payload, config);
    return response.data;
  },
};

export default billingService;
