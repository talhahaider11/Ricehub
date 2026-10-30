import {
  useEffect,
  useState,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import useAuth from "../../hooks/useAuth";
import userService from "../../services/userService";
import { createPasswordSuggestion } from "../../utils/passwordSuggestion";

export default function Register() {
  const {
    register,
  } = useAuth();

  const navigate =
    useNavigate();

  const [form, setForm] =
    useState({
      username: "",
      email: "",
      password: "",
      password2: "",
    });

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
            : "That username is already taken. Try one of these:",
        });
      } catch (checkError) {
        if (!active) return;
        console.error("Username availability could not be checked:", checkError);
        setUsernameAvailability({
          checkedUsername: username,
          status: "error",
          suggestions: [],
          message: "Username availability could not be checked. You can still submit the form.",
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

    if (
      usernameAvailability.status === "taken" &&
      usernameAvailability.checkedUsername === form.username.trim()
    ) {
      setError("Please choose an available username.");
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
              Array.isArray(value) ? value : [value]
            )
          : [];
      const message = messages
        .filter((value) => typeof value === "string")
        .join(" ");

      setError(message || "Registration failed. Please try again.");
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

        <input
          name="password"
          type="password"
          value={form.password}
          onChange={change}
          placeholder="Password"
          required
        />
        <p className="auth-field-hint">
          Use at least 8 characters with uppercase, lowercase, and a number.
          A strong password suggestion is optional.
        </p>
        <button
          type="button"
          className="auth-password-suggest"
          onClick={() => {
            try {
              const suggestion = createPasswordSuggestion();
              setForm((current) => ({
                ...current,
                password: suggestion,
                password2: suggestion,
              }));
              setError("");
            } catch (suggestionError) {
              console.error("Could not create a secure password suggestion:", suggestionError);
              setError("A password suggestion could not be created in this browser.");
            }
          }}
        >
          Use a strong password suggestion
        </button>

        <input
          name="password2"
          type="password"
          value={form.password2}
          onChange={change}
          placeholder="Confirm password"
          required
        />

        <button type="submit" disabled={loading || usernameAvailability.status === "checking"}>
          {loading ? "Creating account..." : "Register"}
        </button>

        <Link to="/login">
          Already have an account?
        </Link>
      </form>
    </main>
  );
}
