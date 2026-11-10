import { describe, expect, it } from "vitest";
import { parseUserId } from "./userId";

describe("parseUserId", () => {
  it.each([
    ["123", 123],
    [" 1,234 ", 1234],
    ["۱۲۳۴", 1234],
    ["١٢٣٤", 1234],
    ["１２３４", 1234],
  ])("normalizes %s to a numeric user ID", (input, expected) => {
    expect(parseUserId(input)).toBe(expected);
  });

  it.each(["", "0", "-1", "1,2", "12.5", "user-12", "9007199254740992"])(
    "rejects invalid ID %s",
    (input) => {
      expect(parseUserId(input)).toBeNull();
    }
  );
});
