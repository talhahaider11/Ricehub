import {
  useState,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import useAuth from "../../hooks/useAuth";

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

  const change = (event) => {
    setForm({
      ...form,
      [event.target.name]:
        event.target.value,
    });
  };

  const submit = async (event) => {
    event.preventDefault();

    if (
      form.password !==
      form.password2
    ) {
      setError(
        "Passwords do not match."
      );
      return;
    }

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
          required
        />

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

        <input
          name="password2"
          type="password"
          value={form.password2}
          onChange={change}
          placeholder="Confirm password"
          required
        />

        <button type="submit">
          Register
        </button>

        <Link to="/login">
          Already have an account?
        </Link>
      </form>
    </main>
  );
}
