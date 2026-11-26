import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Billing from "./Billing";
import billingService from "../services/billingService";
import { downloadPaymentQr } from "../services/paymentQrService";

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
        boostPost: "Boost post",
        monthlySubscription: "Monthly subscription",
        oneWeek: "1 Week",
        oneMonth: "1 Month",
        qrPaymentTitle: "Pay using the official QR code or manually Till ID 985048620",
        merchantTitle: "Account / Merchant title",
        qrInstructions: "Scan this QR code using any banking app, JazzCash, Easypaisa, NayaPay, or Raast-enabled app.",
        paymentWarning: "Important: Payments are ONLY accepted via this official QR Code (Talha Shop) . Payments sent to any  other account will NOT be accepted or refunded, and your verification/boost request will be rejected.",
        downloadQrCode: "Download QR Code",
        qrDownloadStarted: "The QR code image download has started.",
        qrShareReady: "The QR image is ready. Save it to your device from the Android share sheet.",
        qrDownloadFailed: "The QR code could not be downloaded. Please try again.",
        loading: "Loading...",
        reviewWindow: "Requests remain pending during review.",
        transferApp: "Transfer app",
        selectTransferApp: "Select the app you used",
        senderName: "Sender name",
        receiptImage: "Payment receipt image",
        receiptRequirements: "JPG, PNG, or WebP; maximum 5 MB.",
        transferReference: "Transfer reference",
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

vi.mock("../services/paymentQrService", () => ({
  PAYMENT_QR_IMAGE: "/images/talha-shop-qr.png",
  downloadPaymentQr: vi.fn(),
}));

const paymentWarning = "Important: Payments are ONLY accepted via this official QR Code (Talha Shop) . Payments sent to any  other account will NOT be accepted or refunded, and your verification/boost request will be rejected.";

describe("Billing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    billingService.getOptions.mockResolvedValue({
      subscription: { amount_pkr: "249.00", period_days: 30 },
      methods: [{ value: "qr_payment", label: "QR Payment (Talha Shop)" }],
      transfer_apps: [
        { value: "easypaisa", label: "EasyPaisa" },
        { value: "nayapay", label: "NayaPay" },
        { value: "raast", label: "Raast" },
      ],
      boosts: [
        { kind: "boost_week", amount_pkr: "149.00", amount_usd: "0.55", period_days: 7 },
        { kind: "boost_month", amount_pkr: "350.00", amount_usd: "1.25", period_days: 30 },
      ],
    });
    billingService.getRequests.mockResolvedValue([]);
    billingService.requestPayment.mockResolvedValue({
      id: 1,
      kind: "subscription",
      amount_pkr: "249.00",
      status: "pending",
    });
  });

  it("shows the official QR, instructions, and rejection warning", async () => {
    render(
      <MemoryRouter>
        <Billing />
      </MemoryRouter>
    );

    expect(await screen.findByAltText("Talha Shop official payment QR code"))
      .toHaveAttribute("src", "/images/talha-shop-qr.png");
    expect(screen.getByRole("heading", {
      name: "Pay using the official QR code or manually Till ID 985048620",
    })).toBeInTheDocument();
    expect(screen.getByText(/Account \/ Merchant title:/).parentElement)
      .toHaveTextContent("Talha Shop");
    expect(screen.getByText(
      "Scan this QR code using any banking app, JazzCash, Easypaisa, NayaPay, or Raast-enabled app."
    )).toBeInTheDocument();
    expect(screen.getByRole("alert").textContent).toBe(paymentWarning);
  });

  it("keeps the subscription receipt workflow and submits the QR method", async () => {
    render(
      <MemoryRouter>
        <Billing />
      </MemoryRouter>
    );

    const submit = await screen.findByRole("button", {
      name: "Submit for manual review",
    });
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
    fireEvent.submit(submit.closest("form"));

    await waitFor(() => {
      expect(billingService.requestPayment).toHaveBeenCalledTimes(1);
    });
    const payload = billingService.requestPayment.mock.calls[0][0];
    expect(payload.get("method")).toBe("qr_payment");
    expect(payload.get("sender_name")).toBe("Talha Haider");
    expect(payload.get("transfer_app")).toBe("easypaisa");
    expect(payload.get("receipt").name).toBe("receipt.png");
  });

  it("keeps both boost prices and submits boosts through the official QR method", async () => {
    render(
      <MemoryRouter initialEntries={["/?postId=77"]}>
        <Billing />
      </MemoryRouter>
    );

    expect(await screen.findByText("PKR 149.00 · $0.55 USD")).toBeInTheDocument();
    expect(screen.getByText("PKR 350.00 · $1.25 USD")).toBeInTheDocument();
    expect(screen.getByRole("alert").textContent).toBe(paymentWarning);
    fireEvent.change(screen.getByLabelText("Transfer reference"), {
      target: { value: "boost-reference" },
    });
    fireEvent.submit(screen.getByRole("button", {
      name: "Submit for manual review",
    }).closest("form"));

    await waitFor(() => {
      expect(billingService.requestPayment).toHaveBeenCalledWith({
        kind: "boost_week",
        method: "qr_payment",
        reference: "boost-reference",
        post: 77,
      });
    });
  });

  it("reports download failures instead of failing silently", async () => {
    downloadPaymentQr.mockRejectedValue(new Error("Native share unavailable."));
    render(
      <MemoryRouter>
        <Billing />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Download QR Code" }));

    expect(await screen.findByText(
      "The QR code could not be downloaded. Please try again."
    )).toBeInTheDocument();
  });
});
