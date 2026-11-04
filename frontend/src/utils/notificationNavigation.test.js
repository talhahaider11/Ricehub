import { describe, expect, it } from "vitest";
import { getNotificationPath } from "./notificationNavigation";

describe("getNotificationPath", () => {
  it("opens a message conversation from a push payload", () => {
    expect(
      getNotificationPath({
        type: "message",
        conversation_id: "42",
      })
    ).toBe("/messages?conversation_id=42");
  });

  it("opens the related post for comment and reaction notifications", () => {
    expect(
      getNotificationPath({
        notification_type: "comment",
        post_id: "23",
      })
    ).toBe("/posts/23");
  });

  it("routes friend requests and falls back to notifications", () => {
    expect(getNotificationPath({ type: "friend_request" })).toBe(
      "/friend-requests"
    );
    expect(getNotificationPath({ type: "unknown" })).toBe("/notifications");
  });
});
