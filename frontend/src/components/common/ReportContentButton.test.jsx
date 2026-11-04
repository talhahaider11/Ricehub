import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReportContentButton from "./ReportContentButton";
import moderationService from "../../services/moderationService";

vi.mock("../../services/moderationService", () => ({
  default: {
    reportContent: vi.fn(),
  },
}));

describe("ReportContentButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits a report for the selected content", async () => {
    moderationService.reportContent.mockResolvedValue({
      detail: "Your report was submitted.",
    });

    render(<ReportContentButton targetType="post" targetId={42} />);
    fireEvent.click(screen.getByRole("button", { name: "Report" }));
    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "harassment" },
    });
    fireEvent.change(screen.getByLabelText("Details (optional)"), {
      target: { value: "Please review this post." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));

    await waitFor(() => {
      expect(moderationService.reportContent).toHaveBeenCalledWith({
        target_type: "post",
        target_id: 42,
        reason: "harassment",
        details: "Please review this post.",
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Your report was submitted."
    );
  });
});
