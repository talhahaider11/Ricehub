import {
  useEffect,
  useState,
} from "react";
import { Eye, EyeOff } from "lucide-react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import useAuth from "../../hooks/useAuth";
import userService from "../../services/userService";

export default function Register() {
  const {
    register,
  } = useAuth();

  const navigate =
    useNavigate();

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    password2: "",
  });
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] =
    useState("");
  const [loading, setLoading] = useState(false);
  const [usernameAvailability, setUsernameAvailability] = useState({
    checkedUsername: "",
    status: "idle",
    suggestions: [],
    message: "",
  });

  useEffect(() => {
    const username = form.username.trim();
    if (!username) {
      setUsernameAvailability({
        checkedUsername: "",
        status: "idle",
        suggestions: [],
        message: "",
      });
      return undefined;
    }

    let active = true;
    setUsernameAvailability({
      checkedUsername: username,
      status: "checking",
      suggestions: [],
      message: "",
    });

    const timeout = window.setTimeout(async () => {
      try {
        const result = await userService.checkUsername(username);
        if (!active) return;

        setUsernameAvailability({
          checkedUsername: username,
          status: result.available ? "available" : "taken",
          suggestions: Array.isArray(result.suggestions)
            ? result.suggestions
            : [],
          message: result.available
            ? "Username is available."
            : "That username appears to be taken. Try one of these:",
        });
      } catch (checkError) {
        if (!active) return;
        console.error("Username availability could not be checked:", checkError);
        setUsernameAvailability({
          checkedUsername: username,
          status: "error",
          suggestions: [],
          message: checkError.response
            ? "The username check failed. Please try again."
            : "Could not reach the API. Check the backend URL and CORS settings, then try again.",
        });
      }
    }, 450);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [form.username]);

  const change = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]:
        event.target.value,
    }));
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (
      form.password !==
      form.password2
    ) {
      setError(
        "Passwords do not match."
      );
      return;
    }

    setLoading(true);
    try {
      await register(form);
      navigate("/login", {
        state: { notice: "Account created successfully. You can now sign in." },
      });
    } catch (err) {
      const responseData = err.response?.data;
      const messages =
        responseData && typeof responseData === "object"
          ? Object.values(responseData).flatMap((value) =>
              Array.isArray(value)
                ? value
                : typeof value === "string"
                  ? [value]
                  : []
            )
          : [];
      const message = messages
        .filter((value) => typeof value === "string")
        .join(" ");

      setError(
        message ||
          (err.response
            ? `Registration failed (${err.response.status}). Please check your information and try again.`
            : "Could not reach the API. Check the backend URL and CORS settings, then try again.")
      );

      const usernameConflict = Boolean(responseData?.username) ||
        (typeof responseData?.error === "string" &&
          /username/i.test(responseData.error));

      if (usernameConflict) {
        const username = form.username.trim();
        try {
          const result = await userService.checkUsername(username);
          setUsernameAvailability({
            checkedUsername: username,
            status: result.available ? "available" : "taken",
            suggestions: Array.isArray(result.suggestions)
              ? result.suggestions
              : [],
            message: result.available
              ? "Username is available."
              : "That username appears to be taken. Try one of these:",
          });
        } catch (checkError) {
          console.error("Username suggestions could not be loaded:", checkError);
          setUsernameAvailability({
            checkedUsername: username,
            status: "error",
            suggestions: [],
            message: "Username suggestions could not be loaded. Please try again.",
          });
        }
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
        <h1>Create account</h1>

        {error && (
          <div className="error">
            {typeof error ===
            "string"
              ? error
              : "Please check your information."}
          </div>
        )}

        <input
          name="username"
          value={form.username}
          onChange={change}
          placeholder="Username"
          autoComplete="username"
          aria-describedby="username-availability"
          required
        />
        {usernameAvailability.message && (
          <div
            id="username-availability"
            className={`auth-field-hint auth-field-hint-${usernameAvailability.status}`}
            role="status"
          >
            <span>{usernameAvailability.message}</span>
            {usernameAvailability.suggestions.length > 0 && (
              <div className="username-suggestions">
                {usernameAvailability.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="username-suggestion"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        username: suggestion,
                      }))
                    }
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <input
          name="email"
          type="email"
          value={form.email}
          onChange={change}
          placeholder="Email"
          required
        />

        <div className="auth-password-field">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            value={form.password}
            onChange={change}
            placeholder="Password"
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            className="auth-password-toggle"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((visible) => !visible)}
          >
            {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        </div>

        <div className="auth-password-field">
          <input
          name="password2"
          type={showPassword ? "text" : "password"}
          value={form.password2}
          onChange={change}
          placeholder="Confirm password"
          autoComplete="new-password"
          required
          />
          <button
          type="button"
          className="auth-password-toggle"
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          onClick={() => setShowPassword((visible) => !visible)}
          >
          {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Creating account..." : "Register"}
        </button>

        <Link to="/login">
          Already have an account?
        </Link>
      </form>
    </main>
  );
}
