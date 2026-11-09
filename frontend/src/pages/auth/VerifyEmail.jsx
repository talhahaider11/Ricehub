import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import authService from "../../services/authService";
import useAuth from "../../hooks/useAuth";
import "./VerifyEmail.css";

export default function VerifyEmail() {
  const { user, setUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const [email, setEmail] = useState(location.state?.email || "");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState(location.state?.notice || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const verify = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await authService.verifyEmail({ email, code });
      if (user) {
        setUser({ ...user, is_email_verified: true });
        navigate("/settings");
        return;
      }
      navigate("/login", {
        state: { notice: result.detail || result.message },
      });
    } catch (err) {
      const data = err.response?.data;
      const message =
        data?.code?.[0] ||
        data?.detail ||
        "Verification failed. Please check the email and code.";
      setError(Array.isArray(message) ? message.join(" ") : message);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError("");
    setNotice("");
    setResending(true);
    try {
      const result = await authService.resendVerificationCode(email);
      setNotice(result.detail || result.message);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.response?.data?.email?.[0] ||
          "Could not send a new code. Please try again."
      );
    } finally {
      setResending(false);
    }
  };

  const entryTransition = {
    duration: prefersReducedMotion ? 0.01 : 0.35,
    ease: "easeOut",
  };
  const feedbackTransition = {
    duration: prefersReducedMotion ? 0.01 : 0.2,
    ease: "easeOut",
  };
  const buttonMotion = prefersReducedMotion
    ? {}
    : {
        whileHover: { scale: 1.02, y: -2 },
        whileTap: { scale: 0.98 },
      };

  return (
    <main className="auth-page verify-email-page">
      <motion.form
        className="verify-email-card"
        onSubmit={verify}
        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={entryTransition}
      >
        <motion.div
          className="verify-email-heading"
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...entryTransition, delay: prefersReducedMotion ? 0 : 0.06 }}
        >
          <div className="verify-email-icon" aria-hidden="true">
            <MailCheck size={25} strokeWidth={1.8} />
          </div>
          <span className="verify-email-eyebrow">
            <ShieldCheck size={14} aria-hidden="true" />
            Account security
          </span>
          <h1>Verify your email</h1>
          <p>One quick step to keep your RiceHub account secure.</p>
        </motion.div>

        <AnimatePresence initial={false} mode="wait">
          {notice && (
            <motion.div
              key="notice"
              className="verify-email-feedback verify-email-feedback-success"
              role="status"
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={feedbackTransition}
            >
              <ShieldCheck size={18} aria-hidden="true" />
              <span>{notice}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false} mode="wait">
          {error && (
            <motion.div
              key="error"
              className="verify-email-feedback verify-email-feedback-error"
              role="alert"
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={feedbackTransition}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="verify-email-fields">
          <div className="verify-email-field">
            <label htmlFor="verification-email">Email address</label>
            <input
              id="verification-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="verify-email-field">
            <label htmlFor="verification-code">Verification code</label>
            <input
              id="verification-code"
              className="verify-email-code-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              aria-describedby="verification-code-hint"
              required
            />
            <span id="verification-code-hint" className="verify-email-hint">
              Enter the 6-digit code sent to your email.
            </span>
          </div>
        </div>

        <div className="verify-email-actions">
          <motion.button
            className="verify-email-primary"
            type="submit"
            disabled={loading}
            aria-busy={loading}
            {...buttonMotion}
          >
            {loading ? (
              <>
                <Loader2 className="verify-email-spinner" size={18} aria-hidden="true" />
                Verifying...
              </>
            ) : (
              <>
                Verify email
                <ShieldCheck size={18} aria-hidden="true" />
              </>
            )}
          </motion.button>
          <motion.button
            className="verify-email-secondary"
            type="button"
            onClick={resend}
            disabled={resending || !email}
            aria-busy={resending}
            {...buttonMotion}
          >
            {resending && (
              <Loader2 className="verify-email-spinner" size={16} aria-hidden="true" />
            )}
            {resending ? "Sending..." : "Send a new code"}
          </motion.button>
        </div>

        <motion.div
          className="verify-email-back"
          whileHover={prefersReducedMotion ? undefined : { x: -2 }}
        >
          <ArrowLeft size={15} aria-hidden="true" />
          <Link to="/login">Back to login</Link>
        </motion.div>
      </motion.form>
    </main>
  );
}
