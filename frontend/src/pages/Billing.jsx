import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import useAuth from "../hooks/useAuth";
import api from "../services/api";
import billingService from "../services/billingService";
import {
  countryOptions,
  defaultCountry,
  getCountryFromPhone,
  toInternationalPhone,
} from "../utils/countryCallingCodes";

export default function Billing() {
  const { user, setUser } = useAuth();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const postId = searchParams.get("postId");
  const [options, setOptions] = useState(null);
  const [requests, setRequests] = useState([]);
  const [country, setCountry] = useState(
    () => user?.phone_number
      ? getCountryFromPhone(user.phone_number)
      : defaultCountry
  );
  const [localNumber, setLocalNumber] = useState(() => {
    const callingCode = countryOptions.find(
      (option) => option.country === getCountryFromPhone(user?.phone_number)
    )?.callingCode;
    return callingCode && user?.phone_number?.startsWith(callingCode)
      ? user.phone_number.slice(callingCode.length)
      : user?.phone_number || "";
  });
  const [code, setCode] = useState("");
  const [phoneNotice, setPhoneNotice] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [kind, setKind] = useState(postId ? "boost_week" : "subscription");
  const [method, setMethod] = useState("sadapay");
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

  const phoneNumber = toInternationalPhone(localNumber, country);
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
  const verifyPhone = async (action) => {
    setPhoneError("");
    setPhoneNotice("");
    setPhoneBusy(true);
    try {
      const response = await api.post("/users/phone/verification/", {
        action,
        phone_number: phoneNumber,
        ...(action === "verify" ? { code } : {}),
      });
      setPhoneNotice(response.data.detail);
      if (action === "verify") {
        setUser((current) => ({
          ...current,
          phone_number: phoneNumber,
          is_phone_verified: true,
        }));
        setCode("");
      }
    } catch (error) {
      const detail = error.response?.data?.detail || error.response?.data?.phone_number;
      setPhoneError(Array.isArray(detail) ? detail.join(" ") : detail || "Phone verification failed.");
    } finally {
      setPhoneBusy(false);
    }
  };

  const submitPayment = async (event) => {
    event.preventDefault();
    setPaymentError("");
    setPaymentNotice("");
    setBusy(true);
    try {
      const payment = await billingService.requestPayment({
        kind,
        method,
        reference,
        ...(isBoost ? { post: Number(postId) } : {}),
      });
      setRequests((current) => [
        payment,
        ...current.filter((item) => item.id !== payment.id),
      ]);
      setPaymentNotice("Your transfer request was submitted for manual review. No automatic charge was made.");
      setReference("");
    } catch (error) {
      const detail = error.response?.data?.detail || error.response?.data?.post;
      setPaymentError(Array.isArray(detail) ? detail.join(" ") : detail || "Payment request could not be submitted.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-container">
      <section className="card settings-card billing-card">
        <h1>{isBoost ? t("boostPost") : t("getVerified")}</h1>
        <p>{t("manualPayments")}</p>

        {!isBoost && (
          <section className="settings-section">
            <h2>{t("verifyEmailPhone")}</h2>
            <p>
              Email: {user?.is_email_verified ? "Verified" : "Not verified"}
              {!user?.is_email_verified && (
                <> · <Link to="/verify-email" state={{ email: user?.email }}>Verify by email OTP</Link></>
              )}
            </p>
            <p>Phone: {user?.is_phone_verified ? "Verified" : "Not verified"}</p>
            {!user?.is_phone_verified && (
              <>
                <div className="billing-phone">
                  <label>
                    Country code
                    <select
                      value={country}
                      onChange={(event) => setCountry(event.target.value)}
                    >
                      {countryOptions.map(({ country: countryCode, callingCode, name }) => (
                        <option key={countryCode} value={countryCode}>
                          {name} ({callingCode})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Phone number
                    <input
                      type="tel"
                      autoComplete="tel-national"
                      value={localNumber}
                      onChange={(event) => setLocalNumber(event.target.value)}
                      placeholder="3001234567"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={phoneBusy || localNumber.replace(/\D/g, "").length < 7}
                  onClick={() => void verifyPhone("send")}
                >
                  {phoneBusy ? "Sending..." : t("sendSmsCode")}
                </button>
                <div className="billing-phone-code">
                  <label>
                    SMS code
                    <input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={code}
                      onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={phoneBusy || code.length !== 6}
                    onClick={() => void verifyPhone("verify")}
                  >
                    {t("verifyPhone")}
                  </button>
                </div>
              </>
            )}
            {phoneNotice && <p className="settings-status" role="status">{phoneNotice}</p>}
            {phoneError && <p className="settings-error" role="alert">{phoneError}</p>}
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
          {options?.instructions && (
            <p className="billing-instructions">{options.instructions}</p>
          )}
          <label>
            Transfer method
            <select value={method} onChange={(event) => setMethod(event.target.value)}>
              {(options?.methods || []).map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
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
          <p className="muted">Never enter your card PIN, password, or one-time banking code here.</p>
          {paymentError && <p className="settings-error" role="alert">{paymentError}</p>}
          {paymentNotice && <p className="settings-status" role="status">{paymentNotice}</p>}
          <button
            className="btn btn-primary"
            type="submit"
            disabled={busy || (!isBoost && (!user?.is_email_verified || !user?.is_phone_verified))}
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
