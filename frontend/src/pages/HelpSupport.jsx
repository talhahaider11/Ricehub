import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import authService from "../services/authService";

const helpTopics = [
  {
    category: "Account",
    question: "I forgot my password. How can I get back into my account?",
    answer: (
      <>Use the <Link to="/forgot-password">password reset page</Link> and enter the
      email address on your account. For privacy, the page shows the same confirmation
      whether or not an account matches.</>
    ),
  },
  {
    category: "Account",
    question: "How do I change my password?",
    answer: "Use the secure change-password form below. You’ll need your current password.",
  },
  {
    category: "Account",
    question: "Why can’t I sign in with my email?",
    answer: "Sign in with your RiceHub username and password. Make sure Caps Lock is off.",
  },
  {
    category: "Privacy",
    question: "Who can see my profile and activity?",
    answer: <>Visit <Link to="/settings">Settings &amp; privacy</Link> to control profile
      visibility, activity status, read receipts and who can contact you.</>,
  },
  {
    category: "Privacy",
    question: "How do I block or unblock someone?",
    answer: <>Open the person’s profile and choose Block from the options menu. You can
      review or unblock accounts in <Link to="/settings">Settings</Link>.</>,
  },
  {
    category: "Community",
    question: "How long do stories stay visible?",
    answer: "Stories are temporary and expire after 24 hours.",
  },
  {
    category: "Community",
    question: "Where can I manage friend requests and notifications?",
    answer: <>Open <Link to="/friend-requests">Friend requests</Link> to respond to requests,
      or <Link to="/settings">Settings</Link> to choose which in-app notifications you receive.</>,
  },
  {
    category: "Troubleshooting",
    question: "A page or feature isn’t loading. What should I try?",
    answer: "Check your connection, refresh RiceHub and sign in again if needed. If the issue continues, include the page name and what happened when contacting support.",
  },
];

const categories = ["All topics", ...new Set(helpTopics.map((topic) => topic.category))];

function getErrorMessage(error) {
  const data = error.response?.data;
  const fieldError = data?.current_password || data?.new_password || data?.detail;
  const message = Array.isArray(fieldError) ? fieldError.join(" ") : fieldError;
  if (typeof message === "string") return message;
  return error.response
    ? "Your password couldn’t be changed. Check the form and try again."
    : "Unable to reach the server. Please try again.";
}

export default function HelpSupport() {
  const [category, setCategory] = useState(categories[0]);
  const [search, setSearch] = useState("");
  const [openQuestion, setOpenQuestion] = useState(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [issueSubject, setIssueSubject] = useState("");
  const [issueDetails, setIssueDetails] = useState("");
  const [issueNotice, setIssueNotice] = useState("");
  const [issueError, setIssueError] = useState("");
  const [sendingIssue, setSendingIssue] = useState(false);

  const visibleTopics = useMemo(() => {
    const term = search.trim().toLowerCase();
    return helpTopics.filter((topic) => (
      (category === "All topics" || topic.category === category) &&
      (!term || `${topic.question} ${topic.category}`.toLowerCase().includes(term))
    ));
  }, [category, search]);

  const changePassword = async (event) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordNotice("");
    if (newPassword !== confirmPassword) {
      setPasswordError("The new passwords don’t match.");
      return;
    }

    setSavingPassword(true);
    try {
      await authService.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordNotice("Password changed. Other active sessions have been signed out.");
    } catch (error) {
      setPasswordError(getErrorMessage(error));
    } finally {
      setSavingPassword(false);
    }
  };

  const reportIssue = async (event) => {
    event.preventDefault();
    setIssueError("");
    setIssueNotice("");
    setSendingIssue(true);
    try {
      const response = await authService.submitSupportRequest({
        subject: issueSubject.trim(),
        details: issueDetails.trim(),
      });
      setIssueNotice(response.detail);
      setIssueSubject("");
      setIssueDetails("");
    } catch (error) {
      const field = error.response?.data?.subject || error.response?.data?.details;
      setIssueError(Array.isArray(field) ? field.join(" ") : field || "Your report could not be sent.");
    } finally {
      setSendingIssue(false);
    }
  };

  return (
    <div className="settings-layout">
      <aside className="settings-sidebar card" aria-label="Help topics">
        <p className="settings-eyebrow">HELP CENTER</p>
        {categories.map((item) => (
          <button
            key={item}
            type="button"
            className={`btn ${category === item ? "btn-primary" : "btn-secondary"}`}
            aria-pressed={category === item}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </aside>

      <main className="card settings-card">
        <header className="settings-header">
          <div>
            <p className="settings-eyebrow">RICEHUB</p>
            <h1>Help &amp; Support</h1>
            <p>Find answers, manage account security and get back to your community.</p>
          </div>
        </header>

        <section className="settings-section" aria-labelledby="faq-title">
          <h2 id="faq-title">Frequently asked questions</h2>
          <label className="settings-section">
            Search help articles
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search account, privacy, community…"
            />
          </label>
          {visibleTopics.length ? visibleTopics.map((topic) => (
            <details
              className="settings-section"
              key={topic.question}
              open={openQuestion === topic.question}
              onToggle={(event) => {
                if (event.currentTarget.open) setOpenQuestion(topic.question);
                else if (openQuestion === topic.question) setOpenQuestion(null);
              }}
            >
              <summary>{topic.question}</summary>
              <p className="settings-description">{topic.answer}</p>
            </details>
          )) : (
            <p className="settings-description">No help articles match your search.</p>
          )}
        </section>

        <section className="settings-section" aria-labelledby="tips-title">
          <h2 id="tips-title">Quick troubleshooting tips</h2>
          <ul>
            <li>Check your internet connection, then refresh the page.</li>
            <li>Sign out and back in if your account information looks out of date.</li>
            <li>For upload failures, check the file type and size before retrying.</li>
            <li>Never share your password or email verification codes with anyone.</li>
          </ul>
        </section>

        <section className="settings-section" aria-labelledby="change-password-title">
          <h2 id="change-password-title">Change your password</h2>
          <p className="settings-description">
            Confirm your current password first. A successful change signs out your other
            active sessions.
          </p>
          <form onSubmit={changePassword}>
            <label>
              Current password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </label>
            <label>
              New password
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
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
              At least 8 characters, with an uppercase letter, a lowercase letter and a number.
            </p>
            {passwordError && <p className="settings-error" role="alert">{passwordError}</p>}
            {passwordNotice && <p className="settings-status" role="status">{passwordNotice}</p>}
            <button className="btn btn-primary" type="submit" disabled={savingPassword}>
              {savingPassword ? "Changing password…" : "Change password"}
            </button>
          </form>
          <p className="settings-description">
            Forgot your current password? <Link to="/forgot-password">Reset it by email</Link>.
          </p>
        </section>

        <section className="settings-section" aria-labelledby="contact-title">
          <h2 id="contact-title">Still need help?</h2>
          <p className="settings-description">
            Report a problem to the RiceHub support team. Never include your password or
            sign-in codes.
          </p>
          <form onSubmit={reportIssue}>
            <label>
              Subject
              <input
                value={issueSubject}
                onChange={(event) => setIssueSubject(event.target.value)}
                maxLength={200}
                required
              />
            </label>
            <label>
              What happened?
              <textarea
                value={issueDetails}
                onChange={(event) => setIssueDetails(event.target.value)}
                maxLength={5000}
                minLength={1}
                required
              />
            </label>
            {issueError && <p className="settings-error" role="alert">{issueError}</p>}
            {issueNotice && <p className="settings-status" role="status">{issueNotice}</p>}
            <button className="btn btn-primary" type="submit" disabled={sendingIssue}>
              {sendingIssue ? "Sending…" : "Submit issue"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
