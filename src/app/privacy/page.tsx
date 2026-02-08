export const metadata = {
  title: "Privacy Policy | Beliefted",
};

export default function PrivacyPage() {
  return (
    <main className="container">
      <div className="panel p-6 md:p-10 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-[color:var(--ink)]">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-[color:var(--subtle)]">
          Last updated: {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </p>

        <div className="mt-6 space-y-4 text-sm text-[color:var(--ink)]">
          <p>
            This Privacy Policy explains how Beliefted collects, uses, and protects
            your information.
          </p>

          <h2 className="text-base font-semibold">1. Information We Collect</h2>
          <p>
            We collect information you provide during sign-in and profile setup,
            such as your name, email, username, bio, and profile image. We also
            store content you post (prayers, words, and comments).
          </p>

          <h2 className="text-base font-semibold">2. How We Use Your Information</h2>
          <p>
            We use your information to create your account, display your content,
            personalize your experience, and keep the community safe.
          </p>

          <h2 className="text-base font-semibold">3. Data Sharing</h2>
          <p>
            We do not sell your personal data. We only share data when required
            by law or to protect the safety of our users.
          </p>

          <h2 className="text-base font-semibold">4. Data Retention</h2>
          <p>
            You may delete your account at any time. Account deletion is
            permanent after the grace period, and associated content will be
            removed.
          </p>

          <h2 className="text-base font-semibold">5. Security</h2>
          <p>
            We use industry-standard security measures to protect your data.
            However, no system can be guaranteed 100% secure.
          </p>

          <h2 className="text-base font-semibold">6. Contact</h2>
          <p>
            For privacy questions, contact us at:
            <span className="ml-1 font-semibold">support@beliefted.app</span>
          </p>
        </div>
      </div>
    </main>
  );
}
