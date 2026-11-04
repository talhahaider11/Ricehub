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
    const response = await api.post("/billing/payment-requests/", payload);
    return response.data;
  },
};

export default billingService;
