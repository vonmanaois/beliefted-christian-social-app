"use client";

import Sidebar from "@/components/layout/Sidebar";

export default function WhyBelieftedPage() {
  return (
    <main className="container">
      <div className="page-grid">
        <Sidebar />
        <div className="panel p-8 rounded-none">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-semibold text-[color:var(--ink)]">
              Why Beliefted
            </h1>
            <p className="mt-3 text-sm text-[color:var(--subtle)]">
              A calmer, purpose‑driven space to pray for one another and share
              God’s Word.
            </p>

            <div className="mt-6 space-y-4 text-sm text-[color:var(--ink)] leading-relaxed">
              <p>
                Beliefted was created to help people step away from the noise of
                traditional social media and focus on what matters most:
                encouragement, prayer, and Scripture. It’s still a social space,
                but one with a different pace and purpose.
              </p>
              <p>
                Our mission is simple: to pray for others, share the Word of God,
                and build a community that lifts people up—quietly, faithfully,
                and consistently.
              </p>
            </div>

            <div className="mt-10 grid gap-6">
              <section className="rounded-2xl bg-[color:var(--panel)] p-6">
                <h2 className="text-lg font-semibold text-[color:var(--ink)]">
                  Keep Beliefted Free
                </h2>
                <p className="mt-2 text-sm text-[color:var(--subtle)] leading-relaxed">
                  Beliefted is free to use, and donations are never required. If
                  this project blesses you and you want to help keep it running,
                  your support makes a real difference.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <a
                    href="https://buy.stripe.com/test_28E28teaRgXcaIK72TfMA00"
                    target="_blank"
                    rel="noreferrer"
                    className="post-button inline-flex items-center justify-center bg-[color:var(--accent)] text-[color:var(--accent-contrast)]"
                  >
                    Support via Stripe
                  </a>
                  <span className="text-xs text-[color:var(--subtle)]">
                    Donations are optional and not required to use Beliefted.
                  </span>
                </div>
              </section>

              <section className="rounded-2xl bg-[color:var(--panel)] p-6">
                <h2 className="text-lg font-semibold text-[color:var(--ink)]">
                  Partnerships & Sponsorships
                </h2>
                <p className="mt-2 text-sm text-[color:var(--subtle)] leading-relaxed">
                  I’m open to partnerships or sponsorships to keep Beliefted growing
                  and available to more people. If you’d like to connect, please
                  reach out.
                </p>
                <p className="mt-3 text-sm text-[color:var(--subtle)]">
                  Contact:{" "}
                  <span className="text-[color:var(--ink)]">
                    von.manaois@gmail.com
                  </span>
                </p>
              </section>

              <section className="rounded-2xl bg-[color:var(--panel)] p-6">
                <h2 className="text-lg font-semibold text-[color:var(--ink)]">
                  About the Creator
                </h2>
                <p className="mt-2 text-sm text-[color:var(--subtle)] leading-relaxed">
                  Hi, I’m Von—a software developer based in Toronto, originally
                  from the Philippines. I built Beliefted to serve a global
                  community of believers who want a more thoughtful,
                  prayer‑focused space.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
