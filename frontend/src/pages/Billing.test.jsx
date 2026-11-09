import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Billing from "./Billing";
import billingService from "../services/billingService";

vi.mock("../hooks/useAuth", () => ({
  default: () => ({
    user: {
      email: "verified@example.com",
      is_email_verified: true,
      is_verified: false,
    },
  }),
}));

vi.mock("../context/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key) =>
      ({
        verifyEmailOnly: "Verify your email",
        getVerified: "Get verified",
        monthlySubscription: "Monthly subscription",
        sadapayPaymentTitle: "Pay using SadaPay",
        sadapayOnly: "Send the exact amount to this SadaPay account.",
        accountName: "Account name",
        accountNumber: "Account number",
        sadapayUnavailable: "Payment details are unavailable.",
        reviewWindow: "Requests remain pending during review.",
        transferApp: "Transfer app",
        selectTransferApp: "Select the app you used",
        senderName: "Sender name",
        receiptImage: "Payment receipt image",
        receiptRequirements: "JPG, PNG, or WebP; maximum 5 MB.",
        submitReview: "Submit for manual review",
        verified: "Verified account",
      })[key] || key,
  }),
}));

vi.mock("../services/billingService", () => ({
  default: {
    getOptions: vi.fn(),
    getRequests: vi.fn(),
    requestPayment: vi.fn(),
  },
}));

describe("Billing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    billingService.getOptions.mockResolvedValue({
      sadapay: {
        account_name: "RiceHub",
        account_number: "0329-0000000",
        qr_image_url: "",
      },
      transfer_apps: [{ value: "easypaisa", label: "EasyPaisa" }],
      boosts: [],
      methods: [],
    });
    billingService.getRequests.mockResolvedValue([]);
    billingService.requestPayment.mockResolvedValue({
      id: 1,
      kind: "subscription",
      amount_pkr: "249.00",
      status: "pending",
    });
  });

  it("allows manual review submission with an account number and receipt when QR is unavailable", async () => {
    render(
      <MemoryRouter>
        <Billing />
      </MemoryRouter>
    );

    const submit = await screen.findByRole("button", {
      name: "Submit for manual review",
    });
    expect(submit).toBeEnabled();
    expect(
      screen.queryByText("Payment details are unavailable.")
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Transfer app"), {
      target: { value: "easypaisa" },
    });
    fireEvent.change(screen.getByLabelText("Sender name"), {
      target: { value: "Talha Haider" },
    });
    fireEvent.change(screen.getByLabelText(/Payment receipt image/), {
      target: {
        files: [new File(["receipt"], "receipt.png", { type: "image/png" })],
      },
    });
    expect(screen.getByLabelText("Transfer app")).toBeValid();
    expect(screen.getByLabelText("Sender name")).toBeValid();
    fireEvent.submit(submit.closest("form"));

    await waitFor(() => {
      expect(billingService.requestPayment).toHaveBeenCalledTimes(1);
    });
    const payload = billingService.requestPayment.mock.calls[0][0];
    expect(payload.get("sender_name")).toBe("Talha Haider");
    expect(payload.get("transfer_app")).toBe("easypaisa");
    expect(payload.get("receipt").name).toBe("receipt.png");
  });
});
