import { Capacitor } from "@capacitor/core";
import {
  PushNotifications,
} from "@capacitor/push-notifications";
import notificationService from "./notificationService";

const PUSH_TOKEN_KEY = "ricehub_push_token";
let listenersPromise;

function reportPushError(message, error) {
  console.error(message, error);
}

export async function initializePushNotifications() {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  try {
    await registerPushListeners();
    let permission =
      await PushNotifications.checkPermissions();

    if (permission.receive === "prompt") {
      permission =
        await PushNotifications.requestPermissions();
    }

    if (permission.receive !== "granted") {
      return false;
    }

    await PushNotifications.register();

    return true;
  } catch (error) {
    console.error(
      "Push notification initialization failed:",
      error
    );

    return false;
  }
}

export function registerPushListeners() {
  if (!Capacitor.isNativePlatform()) {
    return Promise.resolve([]);
  }

  if (listenersPromise) {
    return listenersPromise;
  }

  listenersPromise = Promise.all([
    PushNotifications.addListener(
      "registration",
      async ({ value }) => {
        try {
          await notificationService.registerDevice(
            value,
            Capacitor.getPlatform()
          );
          localStorage.setItem(PUSH_TOKEN_KEY, value);
        } catch (error) {
          reportPushError("Push token could not be registered with RiceHub:", error);
        }
      }
    ),

    PushNotifications.addListener(
      "registrationError",
      (error) => {
        reportPushError("Push registration failed:", error);
      }
    ),

    PushNotifications.addListener(
      "pushNotificationReceived",
      () => {
        window.dispatchEvent(new Event("ricehub:notifications-refresh"));
      }
    ),

    PushNotifications.addListener(
      "pushNotificationActionPerformed",
      () => {
        window.dispatchEvent(new Event("ricehub:open-notifications"));
      }
    ),
  ]).catch((error) => {
    listenersPromise = undefined;
    throw error;
  });

  return listenersPromise;
}

export async function unregisterPushDevice() {
  const token = localStorage.getItem(PUSH_TOKEN_KEY);
  if (!token) return;

  const accessToken = localStorage.getItem("access_token");
  try {
    await notificationService.unregisterDevice(token, accessToken);
    localStorage.removeItem(PUSH_TOKEN_KEY);
  } catch (error) {
    reportPushError("Push device could not be unregistered:", error);
  }
}