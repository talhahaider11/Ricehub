import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import authService from "../../services/authService";

export default function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
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
      navigate("/login", { state: { notice: result.detail } });
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
      setNotice(result.detail);
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

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={verify}>
        <h1>Verify your email</h1>
        <p>Enter the 6-digit code sent to your email address.</p>
        {notice && <p className="success" role="status">{notice}</p>}
        {error && <div className="error" role="alert">{error}</div>}
        <label htmlFor="verification-email">Email address</label>
        <input
          id="verification-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <label htmlFor="verification-code">Verification code</label>
        <input
          id="verification-code"
          className="verification-code-input"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Verifying..." : "Verify email"}
        </button>
        <button
          type="button"
          className="auth-secondary-button"
          onClick={resend}
          disabled={resending || !email}
        >
          {resending ? "Sending..." : "Send a new code"}
        </button>
        <Link to="/login">Back to login</Link>
      </form>
    </main>
  );
}
