import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import notificationService from "./notificationService";

const PUSH_TOKEN_KEY = "ricemarket_push_token";
const PUSH_CHANNEL_ID = "ricehub_notifications";
let listenerRegistration;

function logPushError(message, error) {
  console.error(message, error);
}

export async function registerPushListeners() {
  if (!Capacitor.isNativePlatform()) {
    return [];
  }

  if (listenerRegistration) {
    return listenerRegistration;
  }

  const listeners = [
    PushNotifications.addListener("registration", async ({ value }) => {
      try {
        await notificationService.registerDevice(
          value,
          Capacitor.getPlatform()
        );
        localStorage.setItem(PUSH_TOKEN_KEY, value);
      } catch (error) {
        logPushError("Push token could not be registered with RiceHub:", error);
      }
    }),
    PushNotifications.addListener("registrationError", (error) => {
      logPushError("Push registration failed:", error);
    }),
    PushNotifications.addListener("pushNotificationReceived", () => {
      window.dispatchEvent(new Event("ricemarket:notifications-refresh"));
    }),
    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      window.dispatchEvent(
        new CustomEvent("ricemarket:open-notifications", {
          detail: action.notification?.data || {},
        })
      );
    }),
  ];

  listenerRegistration = Promise.all(listeners).catch((error) => {
    listenerRegistration = undefined;
    throw error;
  });
  return listenerRegistration;
}

export async function initializePushNotifications() {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  try {
    await registerPushListeners();

    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === "prompt") {
      permission = await PushNotifications.requestPermissions();
    }

    if (permission.receive !== "granted") {
      return false;
    }

    if (Capacitor.getPlatform() === "android") {
      await PushNotifications.createChannel({
        id: PUSH_CHANNEL_ID,
        name: "RiceHub notifications",
        description: "Messages, friend activity, and post updates",
        importance: 5,
        visibility: 1,
        sound: "default",
      });
    }

    await PushNotifications.register();
    return true;
  } catch (error) {
    logPushError("Push notification initialization failed:", error);
    return false;
  }
}

export async function unregisterPushDevice() {
  const token = localStorage.getItem(PUSH_TOKEN_KEY);
  if (!token) {
    return;
  }

  const accessToken =
    localStorage.getItem("ricemarket_access_token")
    || localStorage.getItem("access_token");

  try {
    await notificationService.unregisterDevice(token, accessToken);
    localStorage.removeItem(PUSH_TOKEN_KEY);
  } catch (error) {
    logPushError("Push device could not be unregistered:", error);
  }
}
