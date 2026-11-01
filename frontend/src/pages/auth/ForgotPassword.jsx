import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Button from "../../components/common/Button";
import authService from "../../services/authService";

function getErrorMessage(error) {
  const data = error.response?.data;
  const detail = data?.detail || data?.password || data?.new_password;
  if (Array.isArray(detail)) return detail.join(" ");
  if (typeof detail === "string") return detail;
  return error.response
    ? "We couldn’t complete that request. Check the information and try again."
    : "Unable to reach the server. Please try again.";
}

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const uid = searchParams.get("uid");
  const token = searchParams.get("token");
  const isResetting = Boolean(uid && token);
  const [email, setEmail] =
    useState("");
  const [sent, setSent] =
    useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await authService.requestPasswordReset(email.trim());
      setSent(true);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  const reset = async (event) => {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("The passwords don’t match.");
      return;
    }

    setLoading(true);
    try {
      await authService.confirmPasswordReset({ uid, token, password });
      navigate("/login", {
        replace: true,
        state: { notice: "Your password was reset. Sign in with your new password." },
      });
    } catch (resetError) {
      setError(getErrorMessage(resetError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card" aria-labelledby="password-page-title">
      <h1 id="password-page-title">
        {isResetting ? "Choose a new password" : "Reset your password"}
      </h1>

      {error && <p className="error" role="alert">{error}</p>}

      {isResetting ? (
        <form onSubmit={reset}>
          <label>
            New password
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
          <p className="settings-description">
            Use at least 8 characters, including an uppercase letter, a lowercase
            letter and a number.
          </p>
          <Button type="submit" disabled={loading}>
            {loading ? "Updating password…" : "Update password"}
          </Button>
        </form>
      ) : sent ? (
        <p role="status">
          If an account exists for that email, password reset instructions will be sent.
        </p>
      ) : (
        <form onSubmit={submit}>
          <p className="settings-description">
            Enter your account email and we’ll send you a secure password reset link.
          </p>
          <label>
            Email address
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <Button type="submit" disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
      <Link to="/login">Back to login</Link>
    </div>
  );
}