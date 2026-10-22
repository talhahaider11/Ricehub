import {
  useState,
} from "react";

import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import useAuth from "../../hooks/useAuth";

export default function Login() {
  const {
    login,
    verifyTwoFactor,
  } = useAuth();

  const navigate =
    useNavigate();
  const location = useLocation();

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [error, setError] =
    useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorEmail, setTwoFactorEmail] = useState("");

  const [loading, setLoading] =
    useState(false);

  const submit = async (event) => {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      if (twoFactorRequired) {
        await verifyTwoFactor({
          username,
          code: twoFactorCode,
        });
      } else {
        const result = await login({
          username,
          password,
        });
        if (result.two_factor_required) {
          setTwoFactorRequired(true);
          setTwoFactorEmail(result.email);
          setError("");
          return;
        }
      }

      navigate("/");
    } catch (err) {
      const response = err.response?.data;
      if (response?.code === "email_not_verified") {
        setVerificationEmail(response.email || "");
        setError("Please verify your email before signing in.");
      } else {
        setError(
          response?.detail ||
            (twoFactorRequired
              ? "The verification code is invalid or expired."
              : "Invalid username or password.")
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <form
        className="auth-card"
        onSubmit={submit}
      >
        <h1>{twoFactorRequired ? "Verify it’s you" : "Welcome back"}</h1>

        {twoFactorRequired && (
          <p className="settings-description">
            Enter the 6-digit code sent to {twoFactorEmail}.
          </p>
        )}

        {location.state?.notice && (
          <p className="success" role="status">{location.state.notice}</p>
        )}

        {error && (
          <div className="error">
            {error}
            {verificationEmail && (
              <button
                type="button"
                className="auth-inline-link"
                onClick={() =>
                  navigate("/verify-email", {
                    state: { email: verificationEmail },
                  })
                }
              >
                Verify your email
              </button>
            )}
          </div>
        )}

        {!twoFactorRequired ? (
          <>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoComplete="username"
              required
            />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              required
            />
          </>
        ) : (
          <input
            value={twoFactorCode}
            onChange={(event) =>
              setTwoFactorCode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            required
          />
        )}

        <button
          type="submit"
          disabled={loading}
        >
          {loading
            ? twoFactorRequired ? "Verifying..." : "Signing in..."
            : twoFactorRequired ? "Verify and sign in" : "Login"}
        </button>

        {twoFactorRequired ? (
          <button
            type="button"
            className="auth-secondary-button"
            onClick={() => {
              setTwoFactorRequired(false);
              setTwoFactorCode("");
              setError("");
            }}
          >
            Back to password
          </button>
        ) : (
          <Link to="/forgot-password">Forgot password?</Link>
        )}

        {!twoFactorRequired && <Link to="/register">Create account</Link>}
      </form>
    </main>
  );
}
