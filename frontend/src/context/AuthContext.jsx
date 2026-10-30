import {
  createContext,
  useEffect,
  useState,
} from "react";

import authService from "../services/authService";
import {
  initializePushNotifications,
  unregisterPushDevice,
} from "../services/pushNotificationService";

import { ACCESS_TOKEN_KEY } from "../utils/constants";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Helper function: Jab user authenticated ho tab Push Notifications setup honge
  const setupNotifications = async () => {
    try {
      await initializePushNotifications();
    } catch (error) {
      console.error("Push notification setup error:", error);
    }
  };

  const loadUser = async () => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem("access_token");

    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const currentUser = await authService.getMe();
      setUser(currentUser);
      
      // Page reload hone par agar user logged-in mile toh push notifications initialize karein
      setupNotifications();
    } catch {
      authService.logout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const login = async (credentials) => {
    const result = await authService.login(credentials);
    if (result && result.two_factor_required) return result;

    const currentUser = await authService.getMe();

    setUser(currentUser);

    // Login successful hone par push notifications initialize karein
    setupNotifications();

    return currentUser;
  };

  const verifyTwoFactor = async (credentials) => {
    await authService.verifyTwoFactor(credentials);
    const currentUser = await authService.getMe();
    setUser(currentUser);
    setupNotifications();
    return currentUser;
  };

  const register = async (data) => {
    return authService.register(data);
  };

  const logout = () => {
    void unregisterPushDevice().catch((error) => {
      console.warn("Push device could not be unregistered:", error);
    });
    authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        verifyTwoFactor,
        register,
        logout,
        setUser,
        isAuthenticated: Boolean(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}