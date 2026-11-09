import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import useAuth from "../hooks/useAuth";
import billingService from "../services/billingService";

export default function Billing() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const postId = searchParams.get("postId");
  const [options, setOptions] = useState(null);
  const [requests, setRequests] = useState([]);
  const [kind, setKind] = useState(postId ? "boost_week" : "subscription");
  const [method, setMethod] = useState("sadapay");
  const [senderName, setSenderName] = useState("");
  const [transferApp, setTransferApp] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [reference, setReference] = useState("");
  const [paymentNotice, setPaymentNotice] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [busy, setBusy] = useState(false);
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
  const graceHoursRemaining = graceEndsAt !== null
    && now >= expiryTime
    && now < graceEndsAt
    ? Math.ceil((graceEndsAt - now) / (60 * 60 * 1000))
    : 0;
  const submitPayment = async (event) => {
    event.preventDefault();
    setPaymentError("");
    setPaymentNotice("");
    setBusy(true);
    try {
      const payload = isBoost
        ? {
          kind,
          method,
          reference,
          post: Number(postId),
        }
        : new FormData();
      if (!isBoost) {
        payload.append("kind", kind);
        payload.append("method", "sadapay");
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
            <h2>{t("verifyEmailOnly")}</h2>
            <p>
              Email: {user?.is_email_verified ? "Verified" : "Not verified"}
              {!user?.is_email_verified && (
                <> · <Link to="/verify-email" state={{ email: user?.email }}>Verify by email OTP</Link></>
              )}
            </p>
          </section>
        )}

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
          {!isBoost && (
            <section className="billing-sadapay-details" aria-label="SadaPay payment details">
              <h3>{t("sadapayPaymentTitle")}</h3>
              <p>{t("sadapayOnly")}</p>
              {options?.sadapay?.account_name && (
                <p><strong>{t("accountName")}:</strong> {options.sadapay.account_name}</p>
              )}
              {options?.sadapay?.account_number && (
                <p><strong>{t("accountNumber")}:</strong> {options.sadapay.account_number}</p>
              )}
              {options?.sadapay?.qr_image_url && (
                <img
                  className="billing-sadapay-qr"
                  src={options.sadapay.qr_image_url}
                  alt="SadaPay payment QR code"
                />
              )}
              {!options?.sadapay?.account_number && (
                <p className="muted billing-details-unavailable">
                  {t("sadapayUnavailable")}
                </p>
              )}
              <p className="muted">{t("reviewWindow")}</p>
            </section>
          )}
          {isBoost && options?.instructions && (
            <p className="billing-instructions">{options.instructions}</p>
          )}
          {isBoost && (
            <label>
              Transfer method
              <select value={method} onChange={(event) => setMethod(event.target.value)}>
                {(options?.methods || []).map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
          )}
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
            disabled={busy || (!isBoost && (
              !user?.is_email_verified
              || !options?.sadapay?.account_number
            ))}
          >
            {busy ? "Submitting..." : t("submitReview")}
          </button>
        </form>

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
        {!isBoost && user?.is_verified && (
          <p className="settings-status">
            Your account is verified{user.subscription_expires_at ? ` through ${new Date(user.subscription_expires_at).toLocaleDateString()}` : ""}.
          </p>
        )}
        {!isBoost && user?.is_verified && graceHoursRemaining > 0 && (
          <p className="settings-status" role="timer">
            {t("graceRemaining")}: {Math.floor(graceHoursRemaining / 24)} {t("days")}, {graceHoursRemaining % 24} {t("hours")}.
          </p>
        )}
        <p className="muted">{t("verified")} status is activated only after a staff member confirms the transfer.</p>
      </section>
    </div>
  );
}
