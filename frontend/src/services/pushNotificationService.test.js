import { PushNotifications } from "@capacitor/push-notifications";
import api from "./api";

/**
 * 1. Backend Helper API:
 * FCM Device Token ko Django backend (`/notifications/devices/`) par register karne ke liye function.
 */
export async function registerDevice(token) {
  try {
    const response = await api.post("/notifications/devices/", {
      token: token,
      platform: "android",
    });
    console.log("Device token registered with backend successfully:", response.data);
    return response.data;
  } catch (error) {
    console.error("Failed to register device token on backend:", error);
    throw error;
  }
}

/**
 * 2. Push Notifications Core Initialization Function:
 * Permissions handle karta hai aur Firebase FCM Registration start karta hai.
 */
export const initializePushNotifications = async () => {
  try {
    // Check Notification Permissions
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === "prompt") {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== "granted") {
      console.warn("User denied push notification permissions");
      return;
    }

    // Register with FCM/APNs
    await PushNotifications.register();
  } catch (error) {
    console.error("Error during push notification initialization:", error);
  }
};

/**
 * 3. Push Notifications Event Listeners Function:
 * Device token registration aur incoming notification payload handlers.
 */
export const registerPushListeners = () => {
  // Purane event listeners clear karein taake duplicate notifications trigger na hon
  PushNotifications.removeAllListeners();

  // FCM Token receive hone par auto-register handler (Backend sync)
  PushNotifications.addListener("registration", async (token) => {
    console.log("FCM Registration Token received:", token.value);
    try {
      await registerDevice(token.value);
    } catch (error) {
      console.error("Failed to register device:", error);
    }
  });

  // Token registration error handler
  PushNotifications.addListener("registrationError", (error) => {
    console.error("Push Notification registration error:", error);
  });

  // App open (Foreground) rehte hue notification receive hone par handler
  PushNotifications.addListener("pushNotificationReceived", (notification) => {
    console.log("Push Notification received in foreground:", notification);
  });

  // User ke notification click/tap karne par handler
  PushNotifications.addListener("pushNotificationActionPerformed", (notification) => {
    console.log("Push Notification tapped by user:", notification);
  });
};