import {
  createContext,
  useEffect,
  useCallback,
  useRef,
  useState,
} from "react";

import authService from "../services/authService";
import {
  initializePushNotifications,
  registerPushListeners,
  unregisterPushDevice,
} from "../services/pushNotificationService";
import {
  getNotificationsEnabled,
  initializeSystemNotifications,
  setNotificationsEnabled,
  suppressSystemNotifications,
} from "../services/systemNotificationService";
import notificationService from "../services/notificationService";

import { ACCESS_TOKEN_KEY } from "../utils/constants";

export const AuthContext = createContext(null);

function getCachedAuthState() {
  try {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem("access_token");
    if (!token) return { user: null, loading: false };
    const user = JSON.parse(localStorage.getItem("ricehub:auth-user") || "null");
    return { user: user?.id ? user : null, loading: !user?.id };
  } catch (error) {
    console.warn("Cached login profile could not be read:", error);
    return { user: null, loading: true };
  }
}

export function AuthProvider({ children }) {
  const [initialAuthState] = useState(getCachedAuthState);
  const [user, setUserState] = useState(initialAuthState.user);
  const [loading, setLoading] = useState(initialAuthState.loading);
  const loadingUser = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;

  const setUser = setUserState;

  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem("ricehub:auth-user", JSON.stringify(user));
      } else {
        localStorage.removeItem("ricehub:auth-user");
      }
    } catch (error) {
      console.warn("Login profile could not be cached:", error);
    }
  }, [user]);

  // Helper function: Jab user authenticated ho tab Push Notifications setup honge
  const setupNotifications = async () => {
    try {
      let enabled = getNotificationsEnabled();
      try {
        const preferences = await notificationService.getPreferences();
        if (typeof preferences.all_notifications === "boolean") {
          enabled = preferences.all_notifications;
          setNotificationsEnabled(enabled);
        }
      } catch (preferenceError) {
        console.warn(
          "Notification preferences could not be synchronized:",
          preferenceError
        );
      }
      if (!enabled) {
        await suppressSystemNotifications();
        await unregisterPushDevice();
        return;
      }
      await initializeSystemNotifications();
      await registerPushListeners();
      await initializePushNotifications();
    } catch (error) {
      console.error("Push notification setup error:", error);
    }
  };

  const loadUser = useCallback(async () => {
    if (loadingUser.current) return;
    const token = localStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem("access_token");

    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    loadingUser.current = true;
    try {
      const currentUser = await authService.getMe();
      setUser(currentUser);
      void setupNotifications();
    } catch (error) {
      console.error("Could not restore the saved login session:", error);
      if ([401, 403].includes(error.response?.status) || !userRef.current) {
        setUser(null);
      }
    } finally {
      setLoading(false);
      loadingUser.current = false;
    }
  }, [setUser]);

  useEffect(() => {
    void loadUser();
    window.addEventListener("online", loadUser);
    window.addEventListener("focus", loadUser);

    return () => {
      window.removeEventListener("online", loadUser);
      window.removeEventListener("focus", loadUser);
    };
  }, [loadUser]);

  const login = async (credentials) => {
    authService.logout();
    setUser(null);

    const result = await authService.login(credentials);
    if (result && result.two_factor_required) return result;

    let currentUser;
    try {
      currentUser = await authService.getMe();
    } catch (error) {
      throw new Error(
        "Your credentials were accepted, but your profile could not be loaded.",
        { cause: error }
      );
    }

    setUser(currentUser);
    void setupNotifications();

    return currentUser;
  };

  const verifyTwoFactor = async (credentials) => {
    await authService.verifyTwoFactor(credentials);
    const currentUser = await authService.getMe();
    setUser(currentUser);
    void setupNotifications();
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