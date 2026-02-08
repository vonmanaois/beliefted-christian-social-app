export const metadata = {
  title: "Terms of Service | Beliefted",
};

export default function TermsPage() {
  return (
    <main className="container">
      <div className="panel p-6 md:p-10 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-[color:var(--ink)]">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-[color:var(--subtle)]">
          Last updated: {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </p>

        <div className="mt-6 space-y-4 text-sm text-[color:var(--ink)]">
          <p>
            Beliefted is a community-first prayer wall and social journal. By using
            the app, you agree to follow these terms.
          </p>

          <h2 className="text-base font-semibold">1. Eligibility</h2>
          <p>
            You must be at least 13 years old to use Beliefted. If you are using
            Beliefted on behalf of a group or organization, you confirm you have
            the authority to do so.
          </p>

          <h2 className="text-base font-semibold">2. Community Guidelines</h2>
          <p>
            Be respectful and encouraging. Do not post content that is
            abusive, hateful, harassing, or illegal. We may remove content that
            violates these guidelines.
          </p>

          <h2 className="text-base font-semibold">3. Your Content</h2>
          <p>
            You retain ownership of your content. By posting on Beliefted, you
            grant us permission to display and share your content inside the app.
          </p>

          <h2 className="text-base font-semibold">4. Account Security</h2>
          <p>
            You are responsible for maintaining the security of your account.
            If you believe your account has been compromised, contact us
            immediately.
          </p>

          <h2 className="text-base font-semibold">5. Termination</h2>
          <p>
            We may suspend or terminate accounts that violate these terms. You
            may delete your account at any time from your profile settings.
          </p>

          <h2 className="text-base font-semibold">6. Changes</h2>
          <p>
            We may update these terms periodically. Continued use of the app
            means you accept the updated terms.
          </p>

          <h2 className="text-base font-semibold">7. Contact</h2>
          <p>
            For questions about these terms, contact us at:
            <span className="ml-1 font-semibold">support@beliefted.app</span>
          </p>
        </div>
      </div>
    </main>
  );
}
