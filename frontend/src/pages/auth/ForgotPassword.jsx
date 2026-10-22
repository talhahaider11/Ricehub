import { useState } from "react";
import api from "../../services/api";
import Button from "../../components/common/Button";

export default function ForgotPassword() {
  const [email, setEmail] =
    useState("");

  const [sent, setSent] =
    useState(false);

  const submit = async (event) => {
    event.preventDefault();

    await api.post(
      "/password-reset/",
      { email }
    );

    setSent(true);
  };

  return (
    <div className="auth-card">

      <h1>
        Reset Password
      </h1>

      {sent ? (
        <p>
          If that email exists, a
          password reset link has
          been sent.
        </p>
      ) : (
        <form onSubmit={submit}>

          <input
            type="email"
            required
            placeholder="Email address"
            value={email}
            onChange={(event) =>
              setEmail(
                event.target.value
              )
            }
          />

          <Button type="submit">
            Send Reset Link
          </Button>

        </form>
      )}

    </div>
  );
}