"use client";

export default function CommunityGuidelinesContent() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-[color:var(--ink)]">Community Guidelines</h1>
        <p className="mt-2 text-sm text-[color:var(--subtle)]">
          Beliefted is a safe, respectful place for Christians to share prayer and encouragement.
        </p>
      </div>

      <div className="space-y-4 text-sm text-[color:var(--ink)] leading-relaxed">
        <p>
          Please post with love, humility, and truth. We’re here to support one another in faith and keep the
          atmosphere peaceful.
        </p>
        <div>
          <p className="font-semibold text-[color:var(--ink)]">We don’t allow:</p>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-[color:var(--subtle)]">
            <li>Selling, fundraising, or solicitation</li>
            <li>Asking for money or donations</li>
            <li>False teaching, deception, or manipulation</li>
            <li>Shaming, guilt-tripping, or spiritual pressure</li>
            <li>Hateful, harmful, or divisive content</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-[color:var(--ink)]">We’re here to:</p>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-[color:var(--subtle)]">
            <li>Pray for one another</li>
            <li>Encourage faith and hope</li>
            <li>Share God’s Word with respect</li>
          </ul>
        </div>
        <p className="text-[color:var(--subtle)]">
          Posts that violate these guidelines may be removed to protect the community.
        </p>
      </div>

      <div className="space-y-6 text-sm text-[color:var(--ink)] leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-semibold">Getting Started</h2>
          <p>
            Sign in with Google, complete your profile, and start exploring the Home feed.
            You can switch between prayers and words from the tabs on the Home page.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">Faith Story</h2>
          <p>
            Faith Stories are public, shareable posts. Add a title and your story, then share the link with
            others. You can also toggle anonymous posting if you want to keep your name private.
          </p>
          <p>Stories can be searched by title or name from the Faith Stories page.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">Journal</h2>
          <p>
            The Journal is private and only visible to you. It works like a personal journal where you can
            write a title and reflection. Entries are grouped by month and year, with a Today section when you
            have a current entry.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">Prayer & Word</h2>
          <p>
            Share a prayer or a word of encouragement, and respond to others through comments and reactions.
            This is where the community comes together and lifts each other in faith.
          </p>
        </section>
      </div>
    </div>
  );
}
