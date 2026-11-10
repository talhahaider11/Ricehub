import useAuth from "../hooks/useAuth";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import userService from "../services/userService";
import notificationService from "../services/notificationService";
import settingsService from "../services/settingsService";
import { getArrayResults } from "../utils/arrayResults";
import { useLanguage } from "../context/LanguageContext";

const preferenceLabelKeys = {
  friend_requests: "friendRequests",
  friend_accepted: "acceptedFriendRequests",
  comments: "commentsOnPosts",
  reactions: "reactionsToPosts",
  messages: "newMessages",
  event_invitations: "eventInvitations",
  all_notifications: "allowInAppNotifications",
};

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
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
  const [blockedUsersExpanded, setBlockedUsersExpanded] = useState(false);
  const [security, setSecurity] = useState(null);
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
      .catch(() => setPreferencesError(t("notificationPreferencesLoadFailed")));
    settingsService.getPrivacy()
      .then(setPrivacy)
      .catch(() => setActionError(t("privacySettingsLoadFailed")));
    settingsService.getBlockedUsers()
      .then((data) => setBlockedUsers(getArrayResults(data, "Blocked accounts")))
      .catch((error) => {
        console.error("Blocked accounts could not be loaded:", error);
        setActionError(t("blockedAccountsLoadFailed"));
      });
    settingsService.getSecurity()
      .then(setSecurity)
      .catch(() => setActionError(t("securitySettingsLoadFailed")));
  }, [t]);

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
      setMessage(t("privacySettingsSaved"));
    } catch (error) {
      setActionError(
        (visibilitySaved
          ? t("profileVisibilitySavedOtherFailed")
          : error.response?.data?.profile_visibility?.[0]) ||
          t("privacySettingsSaveFailed")
      );
    } finally {
      setSaving(false);
    }
  };

  const saveLanguage = async (nextLanguage) => {
    const previousLanguage = language;
    setLanguage(nextLanguage);
    setActionError("");
    try {
      const formData = new FormData();
      formData.append("preferred_language", nextLanguage);
      const updatedUser = await userService.updateMe(formData);
      setUser(updatedUser);
      setActionMessage(t("languagePreferenceSaved"));
    } catch (error) {
      setLanguage(previousLanguage);
      setActionError(
        error.response?.data?.preferred_language?.[0]
          || t("languagePreferenceSaveFailed")
      );
    }
  };

  const savePreferences = async () => {
    setPreferencesSaving(true);
    setPreferencesMessage("");
    setPreferencesError("");
    try {
      const updated = await notificationService.updatePreferences(preferences);
      setPreferences(updated);
      setPreferencesMessage(t("notificationPreferencesSaved"));
    } catch (error) {
      setPreferencesError(
        error.response?.data?.detail || t("notificationPreferencesSaveFailed")
      );
    } finally {
      setPreferencesSaving(false);
    }
  };

  const updatePrivacy = (name, value) =>
    setPrivacy((current) => ({ ...current, [name]: value }));

  const unblockUser = async (blocked) => {
    setActionError("");
    try {
      await settingsService.unblockUser(blocked.id);
      setBlockedUsers((items) => items.filter((item) => item.id !== blocked.id));
    } catch (error) {
      setActionError(error.response?.data?.detail || t("accountUnblockFailed"));
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
            ? t("twoStepEnabled")
            : t("twoStepDisabled")
        );
      }
    } catch (error) {
      setActionError(error.response?.data?.detail || t("twoStepUpdateFailed"));
    }
  };

  const signOutOtherSessions = async () => {
    setActionError("");
    try {
      const response = await settingsService.signOutOtherSessions();
      setActionMessage(response.detail);
    } catch (error) {
      setActionError(error.response?.data?.detail || t("otherSessionsSignOutFailed"));
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
      setActionMessage(t("accountExportDownloaded"));
    } catch (error) {
      setActionError(error.response?.data?.detail || t("accountExportFailed"));
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
      setActionError(error.response?.data?.detail || t("accountDeleteFailed"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page-container">

      <div className="settings-layout">
        <aside className="settings-sidebar card">
          <p className="settings-eyebrow">{t("settingsEyebrow")}</p>
          <a href="#account">{t("accountTitle")}</a>
          <a href="#privacy">{t("privacyAudience")}</a>
          <a href="#blocking">{t("blockedAccounts")}</a>
          <a href="#notifications">{t("notifications")}</a>
          <a href="#security">{t("securityLogin")}</a>
          <Link to="/help-support">{t("helpSupport")}</Link>
          <a href="#appearance">{t("appearanceTitle")}</a>
          <a href="#account-data">{t("yourInformation")}</a>
        </aside>

        <div className="card settings-card">
          <header className="settings-header">
            <div>
              <p className="settings-eyebrow">RiceHub</p>
              <h1>{t("settingsTitle")}</h1>
              <p>{t("settingsDescription")}</p>
            </div>
          </header>
          {actionError && <p className="settings-error" role="alert">{actionError}</p>}
          {actionMessage && <p className="settings-status" role="status">{actionMessage}</p>}

          <section className="settings-section" id="account">
            <h2>{t("accountTitle")}</h2>
            <div className="settings-row">
              <div><strong>{t("username")}</strong><p>@{user?.username}</p></div>
            </div>
            <div className="settings-row">
              <div>
                <strong>{t("emailAddress")}</strong>
                <p>{user?.email}</p>
              </div>
              <span className={`settings-badge ${user?.is_email_verified ? "settings-badge-verified" : "settings-badge-unverified"}`}>
                {user?.is_email_verified ? t("verified") : t("notVerified")}
              </span>
            </div>
            {!user?.is_email_verified && (
              <Link
                className="btn btn-secondary"
                to="/verify-email"
                state={{ email: user?.email }}
              >
                {t("verifyEmail")}
              </Link>
            )}
            <div className="settings-row">
              <div>
                <strong>{t("verificationSubscription")}</strong>
                <p>
                  {user?.is_verified
                    ? t("verifiedAccountPrice")
                    : t("unverifiedAccountPosts")}
                </p>
              </div>
              <span className={`settings-badge ${user?.is_verified ? "settings-badge-verified" : "settings-badge-unverified"}`}>
                {user?.is_verified ? t("verified") : t("notVerified")}
              </span>
              <Link className="btn btn-secondary" to="/billing">
                {user?.is_verified ? t("manageVerification") : t("getVerified")}
              </Link>
            </div>
          </section>

          <section className="settings-section" id="language">
            <h2>{t("languageTitle")}</h2>
            <p className="settings-description">
              {t("languageDescription")}
            </p>
            <label className="settings-row">
              <span><strong>{t("appLanguage")}</strong></span>
              <select
                value={language}
                onChange={(event) => void saveLanguage(event.target.value)}
              >
                <option value="en">English</option>
                <option value="ur">اردو</option>
              </select>
            </label>
          </section>

          <section className="settings-section" id="privacy">
            <h2>{t("privacyAudience")}</h2>
            <div className="settings-row">
              <div>
                <strong>{t("whoSeeProfile")}</strong>
                <p>{t("postVisibilitySeparate")}</p>
              </div>
              <select
                value={visibility}
                onChange={(event) => setVisibility(event.target.value)}
              >
                <option value="public">{t("everyone")}</option>
                <option value="friends">{t("friends")}</option>
                <option value="private">{t("onlyMe")}</option>
              </select>
            </div>
            {privacy && (
              <>
                <label className="settings-row">
                  <span>
                    <strong>{t("whoSendFriendRequests")}</strong>
                    <small>{t("limitFriendRequests")}</small>
                  </span>
                  <select
                    value={privacy.friend_requests_from}
                    onChange={(event) => updatePrivacy("friend_requests_from", event.target.value)}
                  >
                    <option value="everyone">{t("everyone")}</option>
                    <option value="friends_of_friends">{t("friendsOfFriends")}</option>
                    <option value="nobody">{t("noOne")}</option>
                  </select>
                </label>
                <label className="settings-row">
                  <span>
                    <strong>{t("whoStartChat")}</strong>
                    <small>{t("chooseWhoCanMessage")}</small>
                  </span>
                  <select
                    value={privacy.messages_from}
                    onChange={(event) => updatePrivacy("messages_from", event.target.value)}
                  >
                    <option value="everyone">{t("everyone")}</option>
                    <option value="friends">{t("friends")}</option>
                    <option value="nobody">{t("noOne")}</option>
                  </select>
                </label>
                {[
                  ["discoverable_by_email", t("allowFindByEmail")],
                  ["show_activity_status", t("showActive")],
                  ["show_last_seen", t("showLastActive")],
                  ["read_receipts", t("sendReadReceipts")],
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
              {saving ? t("saving") : t("savePrivacySettings")}
            </button>
            {message && <p className="settings-status" role="status">{message}</p>}
          </section>

          <section className="settings-section" id="blocking">
            <button
              type="button"
              className="settings-section-toggle"
              aria-expanded={blockedUsersExpanded}
              aria-controls="blocked-users-list"
              onClick={() => setBlockedUsersExpanded((expanded) => !expanded)}
            >
              <span>{t("blockedUsersCount", {
                count: new Intl.NumberFormat(language === "ur" ? "ur-PK" : "en").format(blockedUsers.length),
              })}</span>
              <span aria-hidden="true">{blockedUsersExpanded ? "−" : "+"}</span>
            </button>
            {blockedUsersExpanded && (
              <div id="blocked-users-list">
                <p className="settings-description">
                  {t("blockedUsersHelp")}
                </p>
                {blockedUsers.length === 0 ? (
                  <p className="settings-description">{t("noBlockedUsers")}</p>
                ) : blockedUsers.map((blocked) => (
                  <div className="settings-row" key={blocked.id}>
                    <div>
                      <strong>{blocked.first_name || blocked.username}</strong>
                      <p>@{blocked.username}</p>
                    </div>
                    <button className="btn btn-secondary" onClick={() => unblockUser(blocked)}>
                      {t("unblock")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="settings-section" id="notifications">
            <h2>{t("notifications")}</h2>
            <p className="settings-description">
              {t("notificationsDescription")}
            </p>
            {preferences && Object.entries(preferenceLabelKeys).map(([key, labelKey]) => (
              <label className="settings-option" key={key}>
                <span>{t(labelKey)}</span>
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
              {preferencesSaving ? t("saving") : t("saveNotificationSettings")}
            </button>
            {preferencesMessage && (
              <p className="settings-status" role="status">{preferencesMessage}</p>
            )}
          </section>

          <section className="settings-section" id="security">
            <h2>{t("securityLogin")}</h2>
            <div className="settings-row">
              <div>
                <strong>{t("twoStepEmail")}</strong>
                <p>{t("twoStepDescription")}</p>
              </div>
              <span className="settings-badge">
                {security?.two_factor_enabled ? t("on") : t("off")}
              </span>
            </div>
            {!security?.two_factor_enabled && !confirmingTwoFactor && (
              <div className="settings-security-form">
                <input
                  type="password"
                  autoComplete="current-password"
                  value={twoFactorPassword}
                  onChange={(event) => setTwoFactorPassword(event.target.value)}
                  placeholder={t("currentPassword")}
                  aria-label={t("currentPasswordEnable")}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => updateTwoFactor("start_enable")}
                  disabled={!twoFactorPassword}
                >
                  {t("turnOn")}
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
                  placeholder={t("emailCode")}
                  aria-label={t("twoStepCode")}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => updateTwoFactor("confirm_enable")}
                  disabled={twoFactorCode.length !== 6}
                >
                  {t("confirmTurnOn")}
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
                  placeholder={t("currentPassword")}
                  aria-label={t("currentPasswordDisable")}
                />
                <button
                  className="btn btn-secondary"
                  onClick={() => updateTwoFactor("disable")}
                  disabled={!twoFactorPassword}
                >
                  {t("turnOff")}
                </button>
              </div>
            )}
            <div className="settings-row">
              <div>
                <strong>{t("password")}</strong>
                <p>{t("resetPasswordDescription")}</p>
              </div>
              <Link className="btn btn-secondary" to="/forgot-password">{t("resetPassword")}</Link>
            </div>
            <button className="btn btn-secondary" onClick={signOutOtherSessions}>
              {t("signOutOtherSessions")}
            </button>
          </section>

          <section className="settings-section" id="appearance">
            <h2>{t("appearanceTitle")}</h2>
            <div className="settings-row">
              <div>
                <strong>{t("darkMode")}</strong>
                <p>{t("useColorTheme", {
                  mode: t(theme === "dark" ? "dark" : "light"),
                })}</p>
              </div>
              <button className="toggle" onClick={toggleTheme}>
                {theme === "dark" ? t("turnThemeOff") : t("turnThemeOn")}
              </button>
            </div>
          </section>

          <section className="settings-section" id="account-data">
            <h2>{t("yourInformation")}</h2>
            <div className="settings-row">
              <div>
                <strong>{t("downloadYourInformation")}</strong>
                <p>{t("exportInformationDescription")}</p>
              </div>
              <button className="btn btn-secondary" onClick={downloadAccountData}>
                {t("downloadData")}
              </button>
            </div>
            <form className="settings-delete-form" onSubmit={deleteAccount}>
              <h3>{t("deleteAccount")}</h3>
              <p>
                {t("deleteAccountDescription")}
              </p>
              <input
                type="password"
                autoComplete="current-password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
                placeholder={t("currentPassword")}
                required
              />
              <input
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                placeholder={t("typeDeleteConfirm")}
                aria-label={t("deleteAccountConfirmLabel")}
                required
              />
              <button
                className="btn btn-danger"
                type="submit"
                disabled={deleting || deleteConfirmation !== "DELETE"}
              >
                {deleting ? t("deletingAccount") : t("deleteAccountPermanently")}
              </button>
            </form>
          </section>
        </div>
      </div>

    </div>
  );
}