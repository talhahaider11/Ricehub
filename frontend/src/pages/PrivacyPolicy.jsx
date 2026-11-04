import { Link } from "react-router-dom";

export default function PrivacyPolicy() {
  return (
    <main className="legal-document">
      <header className="legal-document-header">
        <p className="legal-eyebrow">RICEHUB</p>
        <h1>Privacy Policy</h1>
        <p>Last updated: November 2, 2026</p>
      </header>

      <p>
        This policy explains how RiceHub handles information when you use the
        RiceHub website or app. RiceHub provides social profiles, posts,
        stories, messaging, discovery, notifications, and related community
        features.
      </p>

      <section>
        <h2>Information handled by RiceHub</h2>
        <ul>
          <li>
            <strong>Account and profile information:</strong> username, email
            address, password credentials, name, biography, profile and cover
            images, and optional profile details you provide.
          </li>
          <li>
            <strong>Content and interactions:</strong> posts, comments,
            reactions, stories, messages and attachments, friend and community
            activity, and information you submit in reports or support requests.
          </li>
          <li>
            <strong>Settings and device information:</strong> privacy and
            notification preferences, push-notification device tokens when
            enabled, and security-event details such as sign-in events, IP
            address, and browser or device user-agent information.
          </li>
          <li>
            <strong>Technical information:</strong> information needed to
            operate, protect, troubleshoot, and maintain the service, which may
            include request and diagnostic data handled by the hosting and
            infrastructure providers configured for a deployment.
          </li>
        </ul>
      </section>

      <section>
        <h2>How information is used</h2>
        <p>
          RiceHub uses this information to create and secure accounts, provide
          social and messaging features, apply your privacy settings, deliver
          notifications you enable, respond to reports and support requests,
          prevent abuse, and maintain the service.
        </p>
      </section>

      <section>
        <h2>Who can see information</h2>
        <p>
          Other users may see profile information and content according to the
          visibility settings you choose and the feature you use. Messages are
          intended for the participants in their conversation. Consider your
          audience before sharing; recipients may save or share content.
        </p>
        <p>
          RiceHub relies on service providers configured by the operator to host
          the app, database, cache, uploaded media, email, and push
          notifications. Those providers process information to provide their
          services. The exact providers and settings can vary by deployment.
          Information may also be disclosed when required by law or when
          reasonably necessary to protect users and the service.
        </p>
      </section>

      <section>
        <h2>Your choices and account deletion</h2>
        <p>
          You can manage profile visibility, messaging, discovery, activity,
          read receipts, and notification preferences in{" "}
          <Link to="/settings">Settings</Link>. An account-data export is also
          available there; the current export includes your username, email,
          and account creation date.
        </p>
        <p>
          You can request deletion through the public{" "}
          <Link to="/delete-account">Delete Account</Link> page. You must sign
          in, provide your password, and confirm the request. Account deletion
          removes the account and related records from the active application
          database. Copies in backups, provider systems, or records that must be
          retained for security or legal reasons may remain for a limited time.
          Uploaded media stored separately may not be removed at the same time
          as database records.
        </p>
      </section>

      <section>
        <h2>Retention</h2>
        <p>
          Account information is kept while the account is active and as needed
          to provide the service. Security-event records are configured for
          deletion after 90 days. Stories are intended to expire after 24 hours;
          cleanup timing and separate media storage can affect when all copies
          disappear. Other retention periods depend on the deployment and its
          backup and provider settings.
        </p>
      </section>

      <section>
        <h2>Security and changes</h2>
        <p>
          RiceHub uses access controls and other safeguards intended to protect
          information, but no online service can guarantee absolute security.
          This policy may be updated as the service changes. The date above
          identifies the latest revision.
        </p>
      </section>

      <section>
        <h2>Privacy questions</h2>
        <p>
          If you can sign in, contact RiceHub through{" "}
          <Link to="/help-support">Help &amp; Support</Link>. For account
          deletion, use the public deletion page linked above.
        </p>
        <p className="legal-notice">
          Before public launch, the service operator should add its legal
          identity and a direct privacy contact method here. The project
          configuration does not provide those details.
        </p>
      </section>
    </main>
  );
}
