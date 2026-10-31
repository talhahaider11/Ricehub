import api from "./api";
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from "../utils/constants";


const authService = {
  async login(credentials) {
    const response = await api.post(
      "/token/",
      credentials
    );

    if (response.data?.two_factor_required) {
      return response.data;
    }

    if (!response.data?.access || !response.data?.refresh) {
      throw new Error("The server did not return valid authentication tokens.");
    }

    localStorage.setItem(ACCESS_TOKEN_KEY, response.data.access);
    localStorage.setItem(REFRESH_TOKEN_KEY, response.data.refresh);

    return response.data;
  },

  async verifyTwoFactor(data) {
    const response = await api.post("/users/verify-two-factor/", data);
    localStorage.setItem(ACCESS_TOKEN_KEY, response.data.access);
    localStorage.setItem(REFRESH_TOKEN_KEY, response.data.refresh);
    return response.data;
  },

  async register(data) {
    return api.post("/users/register/", data);
  },

  async verifyEmail(data) {
    const response = await api.post("/users/verify-email/", data);
    return response.data;
  },

  async resendVerificationCode(email) {
    const response = await api.post("/users/resend-verification/", { email });
    return response.data;
  },

  async getMe() {
    const response = await api.get("/users/me/");
    return response.data;
  },

  logout() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  },
};

export default authService;
