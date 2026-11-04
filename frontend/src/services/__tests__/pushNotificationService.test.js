import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  getPlatform: vi.fn(),
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  register: vi.fn(),
  createChannel: vi.fn(),
  addListener: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: mocks.isNativePlatform,
    getPlatform: mocks.getPlatform,
  },
}));

vi.mock("@capacitor/push-notifications", () => ({
  PushNotifications: {
    checkPermissions: mocks.checkPermissions,
    requestPermissions: mocks.requestPermissions,
    register: mocks.register,
    createChannel: mocks.createChannel,
    addListener: mocks.addListener,
  },
}));

vi.mock("../api", () => ({
  default: { post: mocks.apiPost },
}));

describe("pushNotificationService", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
    mocks.isNativePlatform.mockReturnValue(false);
    mocks.getPlatform.mockReturnValue("android");
    mocks.checkPermissions.mockResolvedValue({ receive: "granted" });
    mocks.requestPermissions.mockResolvedValue({ receive: "granted" });
    mocks.register.mockResolvedValue(undefined);
    mocks.createChannel.mockResolvedValue(undefined);
    mocks.addListener.mockImplementation(() => Promise.resolve({ remove: vi.fn() }));
    mocks.apiPost.mockResolvedValue({ data: { id: 1 } });
  });

  it("skips push permissions and registration in a web browser", async () => {
    const {
      initializePushNotifications,
      registerPushListeners,
    } = await import("../pushNotificationService");

    await expect(initializePushNotifications()).resolves.toBe(false);
    await expect(registerPushListeners()).resolves.toEqual([]);

    expect(mocks.checkPermissions).not.toHaveBeenCalled();
    expect(mocks.requestPermissions).not.toHaveBeenCalled();
    expect(mocks.register).not.toHaveBeenCalled();
    expect(mocks.addListener).not.toHaveBeenCalled();
  });

  it("registers listeners and starts native Android push registration", async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    const {
      initializePushNotifications,
      registerPushListeners,
    } = await import("../pushNotificationService");

    await expect(initializePushNotifications()).resolves.toBe(true);
    await registerPushListeners();

    expect(mocks.addListener).toHaveBeenCalledTimes(4);
    expect(mocks.checkPermissions).toHaveBeenCalledOnce();
    expect(mocks.createChannel).toHaveBeenCalledWith({
      id: "ricehub_notifications",
      name: "RiceHub notifications",
      description: "Messages, friend activity, and post updates",
      importance: 5,
      visibility: 1,
      sound: "default",
    });
    expect(mocks.register).toHaveBeenCalledOnce();
  });

  it("syncs a native registration token with the notification API", async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    let registrationListener;
    mocks.addListener.mockImplementation((eventName, listener) => {
      if (eventName === "registration") {
        registrationListener = listener;
      }
      return Promise.resolve({ remove: vi.fn() });
    });
    const { registerPushListeners } = await import("../pushNotificationService");

    await registerPushListeners();
    await registrationListener({ value: "fcm-device-token" });

    expect(mocks.apiPost).toHaveBeenCalledWith("/notifications/devices/", {
      token: "fcm-device-token",
      platform: "android",
    });
    expect(localStorage.getItem("ricemarket_push_token")).toBe(
      "fcm-device-token"
    );
  });

  it("dispatches the notification refresh event for foreground pushes", async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    let receivedListener;
    mocks.addListener.mockImplementation((eventName, listener) => {
      if (eventName === "pushNotificationReceived") {
        receivedListener = listener;
      }
      return Promise.resolve({ remove: vi.fn() });
    });
    const { registerPushListeners } = await import("../pushNotificationService");
    const refreshHandler = vi.fn();
    window.addEventListener("ricemarket:notifications-refresh", refreshHandler);

    try {
      await registerPushListeners();
      receivedListener({ title: "New notification" });

      expect(refreshHandler).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener(
        "ricemarket:notifications-refresh",
        refreshHandler
      );
    }
  });

  it("preserves push payload data when a notification is opened", async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    let actionListener;
    mocks.addListener.mockImplementation((eventName, listener) => {
      if (eventName === "pushNotificationActionPerformed") {
        actionListener = listener;
      }
      return Promise.resolve({ remove: vi.fn() });
    });
    const { registerPushListeners } = await import("../pushNotificationService");
    const openHandler = vi.fn();
    window.addEventListener("ricemarket:open-notifications", openHandler);

    try {
      await registerPushListeners();
      actionListener({
        notification: {
          data: { notification_type: "message", conversation_id: "42" },
        },
      });

      expect(openHandler).toHaveBeenCalledOnce();
      expect(openHandler.mock.calls[0][0].detail).toEqual({
        notification_type: "message",
        conversation_id: "42",
      });
    } finally {
      window.removeEventListener("ricemarket:open-notifications", openHandler);
    }
  });
});
