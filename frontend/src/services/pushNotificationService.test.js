import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    getPlatform: vi.fn(),
    isNativePlatform: vi.fn(),
  },
}));

vi.mock("@capacitor/push-notifications", () => ({
  PushNotifications: {
    addListener: vi.fn(),
    checkPermissions: vi.fn(),
    register: vi.fn(),
    requestPermissions: vi.fn(),
  },
}));

vi.mock("./notificationService", () => ({
  default: {
    registerDevice: vi.fn(),
    unregisterDevice: vi.fn(),
  },
}));

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import notificationService from "./notificationService";
import {
  initializePushNotifications,
  registerPushListeners,
} from "./pushNotificationService";

describe("pushNotificationService", () => {
  const listeners = {};

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    Object.keys(listeners).forEach((key) => delete listeners[key]);
    Capacitor.isNativePlatform.mockReturnValue(true);
    Capacitor.getPlatform.mockReturnValue("android");
    PushNotifications.addListener.mockImplementation((event, listener) => {
      listeners[event] = listener;
      return Promise.resolve({ remove: vi.fn() });
    });
    PushNotifications.checkPermissions.mockResolvedValue({ receive: "granted" });
  });

  it("registers the device token and installs native listeners only once", async () => {
    const refreshHandler = vi.fn();
    const openHandler = vi.fn();
    window.addEventListener("ricehub:notifications-refresh", refreshHandler);
    window.addEventListener("ricehub:open-notifications", openHandler);

    await registerPushListeners();
    await initializePushNotifications();
    await listeners.registration({ value: "native-device-token" });
    listeners.pushNotificationReceived({});
    listeners.pushNotificationActionPerformed({});

    expect(PushNotifications.addListener).toHaveBeenCalledTimes(4);
    expect(notificationService.registerDevice).toHaveBeenCalledWith(
      "native-device-token",
      "android"
    );
    expect(localStorage.getItem("ricehub_push_token")).toBe("native-device-token");
    expect(PushNotifications.register).toHaveBeenCalledOnce();
    expect(refreshHandler).toHaveBeenCalledOnce();
    expect(openHandler).toHaveBeenCalledOnce();
    window.removeEventListener("ricehub:notifications-refresh", refreshHandler);
    window.removeEventListener("ricehub:open-notifications", openHandler);
  });

  it("does not request native permissions on the web", async () => {
    Capacitor.isNativePlatform.mockReturnValue(false);

    await expect(initializePushNotifications()).resolves.toBe(false);
    expect(PushNotifications.checkPermissions).not.toHaveBeenCalled();
    expect(PushNotifications.register).not.toHaveBeenCalled();
  });
});
