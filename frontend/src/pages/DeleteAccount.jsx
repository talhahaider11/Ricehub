import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Loader from "../components/common/Loader";
import useAuth from "../hooks/useAuth";
import settingsService from "../services/settingsService";

export default function DeleteAccount() {
  const { isAuthenticated, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const submitDeletion = async (event) => {
    event.preventDefault();
    setError("");

    if (confirmation !== "DELETE") {
      setError('Type "DELETE" exactly to confirm account deletion.');
      return;
    }

    setDeleting(true);
    try {
      await settingsService.deleteAccount({ password, confirmation });
      logout();
      navigate("/register", { replace: true });
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail
          || "The deletion request could not be completed. Please try again."
      );
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <main className="legal-document legal-delete-page">
      <header className="legal-document-header">
        <p className="legal-eyebrow">ACCOUNT CONTROL</p>
        <h1>Delete your RiceHub account</h1>
        <p>This public page is available on the web and in the app.</p>
      </header>

      {!isAuthenticated ? (
        <section>
          <h2>Sign in to verify and delete your account</h2>
          <p>
            For your security, deletion requires your current password. Sign in
            to RiceHub, then return to this page to submit the deletion request.
          </p>
          <Link className="legal-primary-link" to="/login">
            Sign in to continue
          </Link>
          <p>
            If you cannot access your account, use{" "}
            <Link to="/forgot-password">password recovery</Link> first.
          </p>
        </section>
      ) : (
        <>
          <section className="legal-warning">
            <h2>What happens when you delete your account</h2>
            <p>
              This action permanently deletes your account and its related
              records from the active application database. You will be signed
              out and cannot undo the deletion. Copies in backups or separately
              stored media may take longer to be removed.
            </p>
          </section>

          <form className="legal-delete-form" onSubmit={submitDeletion}>
            <label>
              Current password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label>
              Type DELETE to confirm
              <input
                type="text"
                autoComplete="off"
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
            {error && <p className="legal-error" role="alert">{error}</p>}
            <button
              className="legal-danger-button"
              type="submit"
              disabled={deleting || confirmation !== "DELETE" || !password}
            >
              {deleting ? "Deleting account..." : "Permanently delete account"}
            </button>
          </form>
        </>
      )}
    </main>
  );
}
