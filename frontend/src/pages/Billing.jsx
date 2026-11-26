import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import useAuth from "../hooks/useAuth";
import billingService from "../services/billingService";
import {
  downloadPaymentQr,
  PAYMENT_QR_IMAGE,
} from "../services/paymentQrService";

export default function Billing() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const postId = searchParams.get("postId");
  const [options, setOptions] = useState(null);
  const [requests, setRequests] = useState([]);
  const [kind, setKind] = useState(postId ? "boost_week" : "subscription");
  const [senderName, setSenderName] = useState("");
  const [transferApp, setTransferApp] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [reference, setReference] = useState("");
  const [paymentNotice, setPaymentNotice] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [busy, setBusy] = useState(false);
  const [qrDownloadBusy, setQrDownloadBusy] = useState(false);
  const [qrDownloadNotice, setQrDownloadNotice] = useState("");
  const [qrDownloadError, setQrDownloadError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    Promise.all([billingService.getOptions(), billingService.getRequests()])
      .then(([billingOptions, paymentRequests]) => {
        setOptions(billingOptions);
        setRequests(paymentRequests);
      })
      .catch((error) => {
        console.error("Billing details could not be loaded:", error);
        setPaymentError("Billing details could not be loaded. Please try again.");
      });
  }, []);

  const isBoost = Boolean(postId);
  const boostPlans = options?.boosts || [];
  const expiryTime = user?.subscription_expires_at
    ? new Date(user.subscription_expires_at).getTime()
    : null;
  const graceEndsAt = expiryTime === null
    ? null
    : expiryTime + 5 * 24 * 60 * 60 * 1000;
  const isVerified = typeof user?.is_subscription_verified === "boolean"
    ? user.is_subscription_verified
    : user?.is_verified;
  const subscriptionActive = !isBoost
    && isVerified
    && (expiryTime === null || now < graceEndsAt);
  const showVerifiedStatus = !isBoost
    && subscriptionActive;
  const handleQrDownload = async () => {
    setQrDownloadBusy(true);
    setQrDownloadNotice("");
    setQrDownloadError("");
    try {
      const result = await downloadPaymentQr();
      setQrDownloadNotice(
        result === "saved" ? t("qrSavedToGallery") : t("qrDownloadStarted")
      );
    } catch (error) {
      console.error("Payment QR could not be downloaded:", error);
      setQrDownloadError(t("qrDownloadFailed"));
    } finally {
      setQrDownloadBusy(false);
    }
  };

  const submitPayment = async (event) => {
    event.preventDefault();
    setPaymentError("");
    setPaymentNotice("");
    setBusy(true);
    try {
      const payload = isBoost
        ? {
          kind,
          method: "qr_payment",
          reference,
          post: Number(postId),
        }
        : new FormData();
      if (!isBoost) {
        payload.append("kind", kind);
        payload.append("method", "qr_payment");
        payload.append("reference", reference);
        payload.append("sender_name", senderName);
        payload.append("transfer_app", transferApp);
        payload.append("receipt", receipt);
      }
      const payment = await billingService.requestPayment(payload);
      setRequests((current) => [
        payment,
        ...current.filter((item) => item.id !== payment.id),
      ]);
      setPaymentNotice("Your transfer request was submitted for manual review. No automatic charge was made.");
      setReference("");
      setSenderName("");
      setTransferApp("");
      setReceipt(null);
      event.target.reset();
    } catch (error) {
      const responseData = error.response?.data;
      const detail = responseData?.detail
        || Object.entries(responseData || {})
          .map(([field, messages]) => {
            const text = Array.isArray(messages) ? messages.join(" ") : String(messages);
            return `${field}: ${text}`;
          })
          .join(" ");
      setPaymentError(detail || "Payment request could not be submitted.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-container">
      <section className="card settings-card billing-card">
        <h1>{isBoost ? t("boostPost") : t("getVerified")}</h1>

        {!isBoost && (
          <section className="settings-section">
            <div className="settings-row">
              <h2>{t("verifyEmailOnly")}</h2>
              {user?.is_email_verified ? (
                <span className="settings-badge settings-badge-verified">{t("verified")}</span>
              ) : (
                <Link
                  className="btn btn-secondary"
                  to="/verify-email"
                  state={{ email: user?.email }}
                >
                  Verify
                </Link>
              )}
            </div>
          </section>
        )}

        {showVerifiedStatus && (
          <section className="settings-section" role="status">
            <div className="settings-row">
              <h2>{t("monthlySubscription")}</h2>
              <span className="settings-badge settings-badge-verified">{t("verified")}</span>
            </div>
            <p>
              {expiryTime === null
                ? t("verifiedIndefinitely")
                : now < expiryTime
                  ? `${t("verifiedThrough")} ${new Date(expiryTime).toLocaleDateString()}.`
                  : `${t("verifiedDuringGrace")} ${new Date(expiryTime).toLocaleDateString()}.`}
            </p>
          </section>
        )}

        {(isBoost || !subscriptionActive) && (
        <form className="settings-section" onSubmit={submitPayment}>
          <h2>{isBoost ? t("boostPost") : t("monthlySubscription")}</h2>
          {isBoost ? (
            <div className="billing-plans">
              {boostPlans.map((plan) => (
                <label className={`billing-plan ${kind === plan.kind ? "selected" : ""}`} key={plan.kind}>
                  <input
                    type="radio"
                    name="boost-plan"
                    value={plan.kind}
                    checked={kind === plan.kind}
                    onChange={() => setKind(plan.kind)}
                  />
                  <span>
                    <strong>{plan.period_days === 7 ? t("oneWeek") : t("oneMonth")}</strong>
                    {plan.discounted && <b className="discount-badge">{t("discountedOffer")}</b>}
                    <span>PKR {plan.amount_pkr} · ${plan.amount_usd} USD</span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p><strong>PKR 249 / month</strong> · 5-day grace period after expiry</p>
          )}
          <section className="billing-payment-details" aria-label={t("qrPaymentTitle")}>
            <div className="billing-payment-warning" role="alert">
              <strong>{t("paymentWarning")}</strong>
            </div>
            <div className="billing-qr-payment">
              <h3>{t("qrPaymentTitle")}</h3>
              <div className="billing-qr-code-frame">
                <img
                  src={PAYMENT_QR_IMAGE}
                  alt="Talha Shop official payment QR code"
                />
              </div>
              <p className="billing-qr-merchant">
                {t("merchantTitle")}: <strong>Talha Shop</strong>
              </p>
              <p className="billing-qr-instructions">{t("qrInstructions")}</p>
              <button
                className="btn btn-secondary billing-qr-download"
                type="button"
                onClick={() => void handleQrDownload()}
                disabled={qrDownloadBusy}
              >
                <Download size={17} aria-hidden="true" />
                {qrDownloadBusy ? t("loading") : t("downloadQrCode")}
              </button>
              {qrDownloadNotice && (
                <p className="settings-status" role="status">{qrDownloadNotice}</p>
              )}
              {qrDownloadError && (
                <p className="settings-error" role="alert">{qrDownloadError}</p>
              )}
            </div>
            <p className="muted">{t("reviewWindow")}</p>
          </section>
          {!isBoost && (
            <>
              <label>
                {t("transferApp")}
                <select
                  value={transferApp}
                  onChange={(event) => setTransferApp(event.target.value)}
                  required
                >
                  <option value="">{t("selectTransferApp")}</option>
                  {(options?.transfer_apps || []).map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label>
                {t("senderName")}
                <input
                  value={senderName}
                  onChange={(event) => setSenderName(event.target.value)}
                  maxLength={120}
                  autoComplete="name"
                  required
                />
              </label>
              <label>
                {t("receiptImage")}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    const selected = event.target.files?.[0] || null;
                    if (selected && selected.size > 5 * 1024 * 1024) {
                      setPaymentError("Receipt images must be 5 MB or smaller.");
                      event.target.value = "";
                      setReceipt(null);
                      return;
                    }
                    setPaymentError("");
                    setReceipt(selected);
                  }}
                  required
                />
                <small className="muted">{t("receiptRequirements")}</small>
              </label>
            </>
          )}
          {isBoost && (
            <label>
              Transfer reference
              <input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                maxLength={120}
                required
                placeholder="Enter your transfer reference"
              />
            </label>
          )}
          <p className="muted">Never enter your card PIN, password, or one-time banking code here.</p>
          {paymentError && <p className="settings-error" role="alert">{paymentError}</p>}
          {paymentNotice && <p className="settings-status" role="status">{paymentNotice}</p>}
          <button
            className="btn btn-primary"
            type="submit"
            disabled={busy || (!isBoost && !user?.is_email_verified)}
          >
            {busy ? "Submitting..." : t("submitReview")}
          </button>
        </form>
        )}

        {requests.length > 0 && (
          <section className="settings-section">
            <h2>Payment requests</h2>
            {requests.map((payment) => (
              <p key={payment.id}>
                {payment.kind.replaceAll("_", " ")} · PKR {payment.amount_pkr} · {payment.status}
              </p>
            ))}
          </section>
        )}
        {!subscriptionActive && (
          <p className="muted">{t("verified")} status is activated only after a staff member confirms the transfer.</p>
        )}
      </section>
    </div>
  );
}
