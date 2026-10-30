import useAuth from "../hooks/useAuth";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import authService from "../services/authService";
import userService from "../services/userService";
import notificationService from "../services/notificationService";
import settingsService from "../services/settingsService";
import { getArrayResults } from "../utils/arrayResults";

const preferenceLabels = {
  friend_requests: "Friend requests",
  friend_accepted: "Accepted friend requests",
  comments: "Comments on your posts",
  reactions: "Reactions to your posts",
  messages: "New messages",
  event_invitations: "Event invitations",
  all_notifications: "Allow in-app notifications",
};

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const {
    theme,
    toggleTheme,
  } = useTheme();

  const [visibility, setVisibility] = useState(user?.profile_visibility || "public");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [preferences, setPreferences] = useState(null);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferencesMessage, setPreferencesMessage] = useState("");
  const [preferencesError, setPreferencesError] = useState("");
  const [privacy, setPrivacy] = useState(null);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [security, setSecurity] = useState(null);
  const [blockedUsername, setBlockedUsername] = useState("");
  const [twoFactorPassword, setTwoFactorPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [confirmingTwoFactor, setConfirmingTwoFactor] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    notificationService.getPreferences()
      .then(setPreferences)
      .catch(() => setPreferencesError("Notification preferences could not be loaded."));
    settingsService.getPrivacy()
      .then(setPrivacy)
      .catch(() => setActionError("Privacy settings could not be loaded."));
    settingsService.getBlockedUsers()
      .then((data) => setBlockedUsers(getArrayResults(data, "Blocked accounts")))
      .catch((error) => {
        console.error("Blocked accounts could not be loaded:", error);
        setActionError("Blocked accounts could not be loaded.");
      });
    settingsService.getSecurity()
      .then(setSecurity)
      .catch(() => setActionError("Security settings could not be loaded."));
  }, []);

  const saveVisibility = async () => {
    setSaving(true);
    setMessage("");
    setActionError("");
    let visibilitySaved = false;
    try {
      const formData = new FormData();
      formData.append("profile_visibility", visibility);
      const updatedUser = await userService.updateMe(formData);
      visibilitySaved = true;
      setUser(updatedUser);
      const updatedPrivacy = await settingsService.updatePrivacy(privacy);
      setPrivacy(updatedPrivacy);
      setMessage("Privacy settings saved.");
    } catch (error) {
      setActionError(
        (visibilitySaved
          ? "Profile visibility was saved, but the other privacy settings could not be saved."
          : error.response?.data?.profile_visibility?.[0]) ||
          "Privacy settings could not be saved."
      );
    } finally {
      setSaving(false);
    }
  };

  const savePreferences = async () => {
    setPreferencesSaving(true);
    setPreferencesMessage("");
    setPreferencesError("");
    try {
      const updated = await notificationService.updatePreferences(preferences);
      setPreferences(updated);
      setPreferencesMessage("Notification preferences saved.");
    } catch (error) {
      setPreferencesError(
        error.response?.data?.detail || "Notification preferences could not be saved."
      );
    } finally {
      setPreferencesSaving(false);
    }
  };

  const updatePrivacy = (name, value) =>
    setPrivacy((current) => ({ ...current, [name]: value }));

  const blockUser = async (event) => {
    event.preventDefault();
    setActionError("");
    setActionMessage("");
    try {
      const blocked = await settingsService.blockUser(blockedUsername.trim());
      setBlockedUsers((items) =>
        items.some((item) => item.id === blocked.id) ? items : [blocked, ...items]
      );
      setBlockedUsername("");
      setActionMessage(`@${blocked.username} has been blocked.`);
    } catch (error) {
      setActionError(error.response?.data?.detail || "This account could not be blocked.");
    }
  };

  const unblockUser = async (blocked) => {
    setActionError("");
    try {
      await settingsService.unblockUser(blocked.id);
      setBlockedUsers((items) => items.filter((item) => item.id !== blocked.id));
    } catch (error) {
      setActionError(error.response?.data?.detail || "This account could not be unblocked.");
    }
  };

  const updateTwoFactor = async (action) => {
    setActionError("");
    setActionMessage("");
    try {
      const response = await settingsService.updateTwoFactor({
        action,
        password: twoFactorPassword,
        ...(action === "confirm_enable" ? { code: twoFactorCode } : {}),
      });
      if (action === "start_enable") {
        setConfirmingTwoFactor(true);
        setActionMessage(response.detail);
      } else {
        setSecurity(response);
        setConfirmingTwoFactor(false);
        setTwoFactorCode("");
        setTwoFactorPassword("");
        setActionMessage(
          response.two_factor_enabled
            ? "Two-step verification is enabled."
            : "Two-step verification is disabled."
        );
      }
    } catch (error) {
      setActionError(error.response?.data?.detail || "Two-step verification could not be updated.");
    }
  };

  const signOutOtherSessions = async () => {
    setActionError("");
    try {
      const response = await settingsService.signOutOtherSessions();
      setActionMessage(response.detail);
    } catch (error) {
      setActionError(error.response?.data?.detail || "Other sessions could not be signed out.");
    }
  };

  const downloadAccountData = async () => {
    setActionError("");
    try {
      const data = await settingsService.exportAccount();
      const file = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = "ricehub-account-data.json";
      link.click();
      URL.revokeObjectURL(url);
      setActionMessage("Your account data export has been downloaded.");
    } catch (error) {
      setActionError(error.response?.data?.detail || "Account data could not be exported.");
    }
  };

  const deleteAccount = async (event) => {
    event.preventDefault();
    setDeleting(true);
    setActionError("");
    try {
      await settingsService.deleteAccount({
        password: deletePassword,
        confirmation: deleteConfirmation,
      });
      logout();
      navigate("/register", { replace: true });
    } catch (error) {
      setActionError(error.response?.data?.detail || "Account could not be deleted.");
    } finally {
      setDeleting(false);
    }
  };

  const resendVerification = async () => {
    setActionError("");
    try {
      const response = await authService.resendVerificationCode(user.email);
      setActionMessage(response.detail);
    } catch (error) {
      setActionError(
        error.response?.data?.detail || "Verification email could not be sent. Check email settings."
      );
    }
  };

  return (
    <div className="page-container">

      <div className="settings-layout">
        <aside className="settings-sidebar card">
          <p className="settings-eyebrow">SETTINGS</p>
          <a href="#account">Account</a>
          <a href="#privacy">Privacy &amp; audience</a>
          <a href="#blocking">Blocking</a>
          <a href="#notifications">Notifications</a>
          <a href="#security">Security &amp; login</a>
          <a href="#appearance">Appearance</a>
          <a href="#account-data">Your information</a>
        </aside>

        <div className="card settings-card">
          <header className="settings-header">
            <div>
              <p className="settings-eyebrow">RICEHUB</p>
              <h1>Settings &amp; privacy</h1>
              <p>Control your audience, messages, notifications and security.</p>
            </div>
          </header>
          {actionError && <p className="settings-error" role="alert">{actionError}</p>}
          {actionMessage && <p className="settings-status" role="status">{actionMessage}</p>}

          <section className="settings-section" id="account">
            <h2>Account</h2>
            <div className="settings-row">
              <div><strong>Username</strong><p>@{user?.username}</p></div>
            </div>
            <div className="settings-row">
              <div>
                <strong>Email address</strong>
                <p>{user?.email}</p>
              </div>
              <span className="settings-badge">
                {user?.is_email_verified ? "Verified" : "Not verified"}
              </span>
            </div>
            {!user?.is_email_verified && (
              <button className="btn btn-secondary" onClick={resendVerification}>
                Send verification code
              </button>
            )}
          </section>

          <section className="settings-section" id="privacy">
            <h2>Privacy &amp; audience</h2>
            <div className="settings-row">
              <div>
                <strong>Who can see your profile?</strong>
                <p>Post visibility is set separately when you share each post.</p>
              </div>
              <select
                value={visibility}
                onChange={(event) => setVisibility(event.target.value)}
              >
                <option value="public">Everyone</option>
                <option value="friends">Friends</option>
                <option value="private">Only me</option>
              </select>
            </div>
            {privacy && (
              <>
                <label className="settings-row">
                  <span>
                    <strong>Who can send friend requests?</strong>
                    <small>Limit who can start a friendship with you.</small>
                  </span>
                  <select
                    value={privacy.friend_requests_from}
                    onChange={(event) => updatePrivacy("friend_requests_from", event.target.value)}
                  >
                    <option value="everyone">Everyone</option>
                    <option value="friends_of_friends">Friends of friends</option>
                    <option value="nobody">No one</option>
                  </select>
                </label>
                <label className="settings-row">
                  <span>
                    <strong>Who can start a chat?</strong>
                    <small>Choose who is allowed to message you.</small>
                  </span>
                  <select
                    value={privacy.messages_from}
                    onChange={(event) => updatePrivacy("messages_from", event.target.value)}
                  >
                    <option value="everyone">Everyone</option>
                    <option value="friends">Friends</option>
                    <option value="nobody">No one</option>
                  </select>
                </label>
                {[
                  ["discoverable_by_email", "Allow people to find me by email"],
                  ["show_activity_status", "Show when I’m active"],
                  ["show_last_seen", "Show my last active time"],
                  ["read_receipts", "Send read receipts in chats"],
                ].map(([name, label]) => (
                  <label className="settings-option" key={name}>
                    <span>{label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(privacy[name])}
                      onChange={(event) => updatePrivacy(name, event.target.checked)}
                    />
                  </label>
                ))}
              </>
            )}
            <button
              className="btn btn-primary"
              onClick={saveVisibility}
              disabled={saving || !privacy}
            >
              {saving ? "Saving..." : "Save privacy settings"}
            </button>
            {message && <p className="settings-status" role="status">{message}</p>}
          </section>

          <section className="settings-section" id="blocking">
            <h2>Blocking</h2>
            <p className="settings-description">
              Blocked accounts can’t find your profile, send friend requests or start a chat.
            </p>
            <form className="settings-inline-form" onSubmit={blockUser}>
              <input
                value={blockedUsername}
                onChange={(event) => setBlockedUsername(event.target.value)}
                placeholder="Username to block"
                aria-label="Username to block"
                required
              />
              <button className="btn btn-secondary" type="submit">Block</button>
            </form>
            {blockedUsers.length === 0 ? (
              <p className="settings-description">You haven’t blocked anyone.</p>
            ) : blockedUsers.map((blocked) => (
              <div className="settings-row" key={blocked.id}>
                <div>
                  <strong>{blocked.first_name || blocked.username}</strong>
                  <p>@{blocked.username}</p>
                </div>
                <button className="btn btn-secondary" onClick={() => unblockUser(blocked)}>
                  Unblock
                </button>
              </div>
            ))}
          </section>

          <section className="settings-section" id="notifications">
            <h2>Notifications</h2>
            <p className="settings-description">
              Choose which in-app activity appears in your notifications.
            </p>
            {preferences && Object.entries(preferenceLabels).map(([key, label]) => (
              <label className="settings-option" key={key}>
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={preferences[key]}
                  onChange={(event) =>
                    setPreferences({ ...preferences, [key]: event.target.checked })
                  }
                />
              </label>
            ))}
            {preferencesError && <p className="settings-error" role="alert">{preferencesError}</p>}
            <button
              className="btn btn-primary"
              onClick={savePreferences}
              disabled={!preferences || preferencesSaving}
            >
              {preferencesSaving ? "Saving..." : "Save notification settings"}
            </button>
            {preferencesMessage && (
              <p className="settings-status" role="status">{preferencesMessage}</p>
            )}
          </section>

          <section className="settings-section" id="security">
            <h2>Security &amp; login</h2>
            <div className="settings-row">
              <div>
                <strong>Two-step verification by email</strong>
                <p>Require a one-time code sent to your verified email when you sign in.</p>
              </div>
              <span className="settings-badge">
                {security?.two_factor_enabled ? "On" : "Off"}
              </span>
            </div>
            {!security?.two_factor_enabled && !confirmingTwoFactor && (
              <div className="settings-security-form">
                <input
                  type="password"
                  autoComplete="current-password"
                  value={twoFactorPassword}
                  onChange={(event) => setTwoFactorPassword(event.target.value)}
                  placeholder="Current password"
                  aria-label="Current password to enable two-step verification"
                />
                <button
                  className="btn btn-primary"
                  onClick={() => updateTwoFactor("start_enable")}
                  disabled={!twoFactorPassword}
                >
                  Turn on
                </button>
              </div>
            )}
            {confirmingTwoFactor && (
              <div className="settings-security-form">
                <input
                  value={twoFactorCode}
                  onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit email code"
                  aria-label="Two-step verification code"
                />
                <button
                  className="btn btn-primary"
                  onClick={() => updateTwoFactor("confirm_enable")}
                  disabled={twoFactorCode.length !== 6}
                >
                  Confirm and turn on
                </button>
              </div>
            )}
            {security?.two_factor_enabled && (
              <div className="settings-security-form">
                <input
                  type="password"
                  autoComplete="current-password"
                  value={twoFactorPassword}
                  onChange={(event) => setTwoFactorPassword(event.target.value)}
                  placeholder="Current password"
                  aria-label="Current password to disable two-step verification"
                />
                <button
                  className="btn btn-secondary"
                  onClick={() => updateTwoFactor("disable")}
                  disabled={!twoFactorPassword}
                >
                  Turn off
                </button>
              </div>
            )}
            <div className="settings-row">
              <div>
                <strong>Password</strong>
                <p>Reset your password if you think it may be compromised.</p>
              </div>
              <Link className="btn btn-secondary" to="/forgot-password">Reset password</Link>
            </div>
            <button className="btn btn-secondary" onClick={signOutOtherSessions}>
              Sign out all other sessions
            </button>
          </section>

          <section className="settings-section" id="appearance">
            <h2>Appearance</h2>
            <div className="settings-row">
              <div>
                <strong>Dark mode</strong>
                <p>Use the {theme === "dark" ? "dark" : "light"} color theme.</p>
              </div>
              <button className="toggle" onClick={toggleTheme}>
                {theme === "dark" ? "Turn off" : "Turn on"}
              </button>
            </div>
          </section>

          <section className="settings-section" id="account-data">
            <h2>Your information</h2>
            <div className="settings-row">
              <div>
                <strong>Download your information</strong>
                <p>Export a JSON copy of your profile, posts, friendships and activity.</p>
              </div>
              <button className="btn btn-secondary" onClick={downloadAccountData}>
                Download data
              </button>
            </div>
            <form className="settings-delete-form" onSubmit={deleteAccount}>
              <h3>Delete account</h3>
              <p>
                This permanently deletes your account and associated data. This cannot be undone.
                Download your information first if you need a copy.
              </p>
              <input
                type="password"
                autoComplete="current-password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
                placeholder="Current password"
                required
              />
              <input
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                placeholder="Type DELETE to confirm"
                aria-label="Type DELETE to confirm permanent account deletion"
                required
              />
              <button
                className="btn btn-danger"
                type="submit"
                disabled={deleting || deleteConfirmation !== "DELETE"}
              >
                {deleting ? "Deleting account..." : "Permanently delete account"}
              </button>
            </form>
          </section>
        </div>
      </div>

    </div>
  );
}