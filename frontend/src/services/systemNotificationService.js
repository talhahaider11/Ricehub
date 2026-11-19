import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

export const NOTIFICATIONS_ENABLED_KEY = "ricehub_notifications_enabled";

let nativePermissionGranted = false;
let nativeActionListener;
let notificationId = Date.now() % 2_000_000_000;
const browserNotifications = new Set();
const recentlyShown = new Map();
const nativeNotificationIds = new Map();

export function getNotificationsEnabled() {
  return localStorage.getItem(NOTIFICATIONS_ENABLED_KEY) !== "false";
}

export function setNotificationsEnabled(enabled) {
  localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, String(Boolean(enabled)));
  window.dispatchEvent(new Event("ricehub:notification-setting-changed"));
}

function openNotification(data) {
  window.dispatchEvent(
    new CustomEvent("ricemarket:open-notifications", { detail: data || {} })
  );
}

export async function initializeSystemNotifications() {
  if (!getNotificationsEnabled()) return false;

  if (Capacitor.isNativePlatform()) {
    let permission = await LocalNotifications.checkPermissions();
    if (["prompt", "prompt-with-rationale"].includes(permission.display)) {
      permission = await LocalNotifications.requestPermissions();
    }
    nativePermissionGranted = permission.display === "granted";
    if (!nativePermissionGranted) return false;

    if (Capacitor.getPlatform() === "android") {
      await LocalNotifications.createChannel({
        id: "ricehub_system_default_v2",
        name: "RiceHub notifications",
        description: "Messages, calls, and account activity",
        importance: 5,
        visibility: 1,
      });
    }
    if (!nativeActionListener) {
      nativeActionListener = await LocalNotifications.addListener(
        "localNotificationActionPerformed",
        ({ notification }) => openNotification(notification.extra)
      );
    }
    return true;
  }

  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch (error) {
      console.warn("Browser notification permission was not granted:", error);
    }
  }
  return Notification.permission === "granted";
}

export async function showSystemNotification({
  id,
  title,
  body,
  data = {},
  requireInteraction = false,
}) {
  if (!getNotificationsEnabled()) return false;

  const dedupeKey = id || `${title}:${body}`;
  const now = Date.now();
  if (recentlyShown.has(dedupeKey) && now - recentlyShown.get(dedupeKey) < 10_000) {
    return false;
  }
  recentlyShown.set(dedupeKey, now);
  for (const [key, shownAt] of recentlyShown) {
    if (now - shownAt >= 10_000) recentlyShown.delete(key);
  }

  if (Capacitor.isNativePlatform()) {
    if (!nativePermissionGranted) return false;
    try {
      notificationId = (notificationId + 1) % 2_000_000_000;
      nativeNotificationIds.set(dedupeKey, notificationId);
      await LocalNotifications.schedule({
        notifications: [{
          id: notificationId,
          title,
          body,
          ...(Capacitor.getPlatform() === "android"
            ? { channelId: "ricehub_system_default_v2" }
            : {}),
          extra: data,
        }],
      });
      return true;
    } catch (error) {
      console.error("Native notification could not be displayed:", error);
      return false;
    }
  }

  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return false;
  }
  try {
    const notification = new Notification(title, {
      body,
      tag: dedupeKey,
      requireInteraction,
      data,
    });
    browserNotifications.add(notification);
    notification.onclose = () => browserNotifications.delete(notification);
    notification.onclick = () => {
      window.focus();
      openNotification(data);
      notification.close();
    };
    return true;
  } catch (error) {
    console.error("Browser notification could not be displayed:", error);
    return false;
  }
}

export async function dismissSystemNotification(id) {
  const notificationKey = String(id);
  const browserNotification = [...browserNotifications].find(
    (notification) => notification.tag === notificationKey
  );
  browserNotification?.close();
  const nativeId = nativeNotificationIds.get(notificationKey);
  if (!nativeId || !Capacitor.isNativePlatform()) return;

  nativeNotificationIds.delete(notificationKey);
  try {
    await LocalNotifications.cancel({
      notifications: [{ id: nativeId }],
    });
    const delivered = await LocalNotifications.getDeliveredNotifications();
    const matchingNotifications = delivered.notifications.filter(
      (notification) => notification.id === nativeId
    );
    if (matchingNotifications.length) {
      await LocalNotifications.removeDeliveredNotifications({
        notifications: matchingNotifications,
      });
    }
  } catch (error) {
    console.error("System notification could not be dismissed:", error);
  }
}

export async function suppressSystemNotifications() {
  browserNotifications.forEach((notification) => notification.close());
  browserNotifications.clear();
  if (!Capacitor.isNativePlatform()) return;

  try {
    const [pending, delivered] = await Promise.all([
      LocalNotifications.getPending(),
      LocalNotifications.getDeliveredNotifications(),
    ]);
    if (pending.notifications.length) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map(({ id: pendingId }) => ({
          id: pendingId,
        })),
      });
    }
    if (delivered.notifications.length) {
      await LocalNotifications.removeDeliveredNotifications({
        notifications: delivered.notifications,
      });
    }
  } catch (error) {
    console.error("Active native notifications could not be cleared:", error);
  }
}
