import { Link } from "react-router-dom";

export default function TermsOfService() {
  return (
    <main className="legal-document">
      <header className="legal-document-header">
        <p className="legal-eyebrow">RICEHUB</p>
        <h1>Terms of Service</h1>
        <p>Last updated: November 2, 2026</p>
      </header>

      <p>
        These terms describe the basic rules for using the RiceHub website and
        app. By creating an account or using RiceHub, you agree to follow these
        terms and applicable law.
      </p>

      <section>
        <h2>Your account</h2>
        <p>
          Provide accurate account information, keep your sign-in credentials
          private, and promptly secure your account if you believe someone else
          has access. You are responsible for activity carried out through your
          account, subject to applicable law.
        </p>
      </section>

      <section>
        <h2>Content and conduct</h2>
        <p>
          You are responsible for the content you share and must have the rights
          and permissions needed to share it. Do not use RiceHub to violate the
          law, infringe another person’s rights, harass or threaten people,
          distribute malicious content, mislead or spam users, or interfere
          with the security or operation of the service.
        </p>
        <p>
          Use profile and post visibility controls to choose an audience.
          Content shared with other people may be copied or shared by its
          recipients. RiceHub may review reports and take proportionate action,
          including removing content or restricting accounts, to protect the
          community and enforce these terms.
        </p>
      </section>

      <section>
        <h2>Using and changing RiceHub</h2>
        <p>
          RiceHub provides social networking, messaging, media, and community
          features. Features may change, be unavailable, or be limited to
          protect users, maintain the service, or comply with law. Do not
          attempt unauthorized access or disrupt the service.
        </p>
      </section>

      <section>
        <h2>Account closure</h2>
        <p>
          You may delete your account from Settings or through the public{" "}
          <Link to="/delete-account">Delete Account</Link> page. Deletion is
          permanent for the active account and its related application
          records. Some copies may remain temporarily in backups or systems
          operated by service providers.
        </p>
      </section>

      <section>
        <h2>Questions and updates</h2>
        <p>
          For help, contact RiceHub through{" "}
          <Link to="/help-support">Help &amp; Support</Link> after signing in.
          These terms may be updated when the service or its requirements
          change; the revision date above will be updated when that happens.
        </p>
        <p className="legal-notice">
          These terms are a product-level draft, not legal advice. Before
          public launch, the service operator should add its legal identity,
          jurisdiction, and direct contact details, and have the terms reviewed
          for the markets where RiceHub will be offered.
        </p>
      </section>
    </main>
  );
}
