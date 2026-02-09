"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";

export default function WhyBelieftedPage() {
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ target?: string }>).detail;
      if (detail?.target === "why") {
        setClosing(true);
      }
    };
    window.addEventListener("panel:close", handler);
    return () => window.removeEventListener("panel:close", handler);
  }, []);

  const panelState = closing
    ? "panel-slide-left-exit"
    : entered
      ? "panel-slide-left-entered"
      : "panel-slide-left-enter";

  return (
    <main className="container">
      <div className="page-grid">
        <Sidebar />
        <div className={`panel p-8 rounded-none ${panelState}`}>
          <div className="max-w-3xl">
            <h1 className="text-2xl font-semibold text-[color:var(--ink)]">
              Why Beliefted
            </h1>
            <p className="mt-3 text-sm text-[color:var(--subtle)]">
              A calm, purpose‑driven space to pray for one another and share
              God’s Word.
            </p>

            <div className="mt-6 space-y-4 text-sm text-[color:var(--ink)] leading-relaxed">
              <p>
                Beliefted exists to help believers step away from the noise and
                focus on what matters: prayer, encouragement, and Scripture.
              </p>
              <p className="text-[color:var(--subtle)]">
                The name blends “Belief” and “Lifted” — faith that lifts others
                through prayer.
              </p>
              <div className="mt-2 flex flex-col gap-2 text-[color:var(--subtle)]">
                <p className="font-semibold text-[color:var(--ink)]">
                  What you’ll find here:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Short, focused prayers and requests</li>
                  <li>Encouraging words and daily faith reminders</li>
                  <li>A quieter feed designed for support, not noise</li>
                </ul>
              </div>
              <p>
                Our mission is simple: pray for others, share the Word, and lift
                people up—quietly, faithfully, consistently.
              </p>
            </div>

            <section className="mt-10">
              <h2 className="text-lg font-semibold text-[color:var(--ink)]">
                Keep Beliefted Free
              </h2>
              <p className="mt-3 text-sm text-[color:var(--subtle)] leading-relaxed">
                Beliefted is free to use, and donations are never required. If
                this project blesses you and you want to help keep it running,
                your support makes a real difference.
              </p>
              <a
                href="https://buy.stripe.com/test_28E28teaRgXcaIK72TfMA00"
                target="_blank"
                rel="noreferrer"
                className="mt-4 post-button inline-flex items-center justify-center bg-[color:var(--accent)] text-[color:var(--accent-contrast)]"
              >
                Support via Stripe
              </a>
              <p className="mt-3 text-xs text-[color:var(--subtle)]">
                Donations are optional and not required to use Beliefted.
              </p>
            </section>

            <section className="mt-10">
              <h2 className="text-lg font-semibold text-[color:var(--ink)]">
                Partnerships & Sponsorships
              </h2>
              <p className="mt-3 text-sm text-[color:var(--subtle)] leading-relaxed">
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

            <section className="mt-10">
              <h2 className="text-lg font-semibold text-[color:var(--ink)]">
                About the Creator
              </h2>
              <div className="mt-4 flex flex-col items-center gap-4">
                <div className="h-20 w-20 rounded-full overflow-hidden border border-[color:var(--panel-border)]">
                  <svg
                    width="80"
                    height="80"
                    viewBox="0 0 256 256"
                    role="img"
                    aria-label="Default profile avatar"
                  >
                    <defs>
                      <radialGradient id="bg" cx="35%" cy="30%" r="80%">
                        <stop offset="0%" stopColor="#2a2d33" />
                        <stop offset="60%" stopColor="#181a1f" />
                        <stop offset="100%" stopColor="#101217" />
                      </radialGradient>
                      <filter id="softShadow" x="-40%" y="-40%" width="180%" height="180%">
                        <feDropShadow
                          dx="0"
                          dy="6"
                          stdDeviation="8"
                          floodColor="#000"
                          floodOpacity="0.35"
                        />
                      </filter>
                      <linearGradient id="hoodie" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1b1d23" />
                        <stop offset="100%" stopColor="#0f1116" />
                      </linearGradient>
                      <linearGradient id="skin" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#d19a7a" />
                        <stop offset="100%" stopColor="#b77d60" />
                      </linearGradient>
                      <linearGradient id="hair" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#161616" />
                        <stop offset="100%" stopColor="#0b0b0b" />
                      </linearGradient>
                      <linearGradient id="glassesFrame" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#d6b875" />
                        <stop offset="100%" stopColor="#b8944f" />
                      </linearGradient>
                      <linearGradient id="lens" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2b2f36" stopOpacity="0.75" />
                        <stop offset="100%" stopColor="#12151a" stopOpacity="0.95" />
                      </linearGradient>
                      <clipPath id="clipCircle">
                        <circle cx="128" cy="128" r="120" />
                      </clipPath>
                    </defs>
                    <circle cx="128" cy="128" r="124" fill="#0b0c10" />
                    <g clipPath="url(#clipCircle)">
                      <rect x="0" y="0" width="256" height="256" fill="url(#bg)" />
                      <path
                        d="M0 120 C55 95, 95 105, 140 115 C185 126, 215 120, 256 105 L256 256 L0 256 Z"
                        fill="#0c0f14"
                        opacity="0.35"
                      />
                      <g filter="url(#softShadow)">
                        <path
                          d="M58 258
                           C60 205, 74 178, 92 162
                           C104 151, 114 146, 128 146
                           C142 146, 152 151, 164 162
                           C182 178, 196 205, 198 258
                           Z"
                          fill="url(#hoodie)"
                        />
                        <path
                          d="M78 178
                           C76 142, 98 112, 128 106
                           C158 112, 180 142, 178 178
                           C168 160, 150 150, 128 150
                           C106 150, 88 160, 78 178 Z"
                          fill="#11131a"
                        />
                        <path
                          d="M92 174
                           C92 146, 108 126, 128 122
                           C148 126, 164 146, 164 174
                           C154 162, 142 156, 128 156
                           C114 156, 102 162, 92 174 Z"
                          fill="#0a0c11"
                          opacity="0.8"
                        />
                        <path
                          d="M108 164 C112 184, 112 210, 108 236"
                          stroke="#20232b"
                          strokeWidth="5"
                          strokeLinecap="round"
                          opacity="0.9"
                        />
                        <path
                          d="M148 164 C144 184, 144 210, 148 236"
                          stroke="#20232b"
                          strokeWidth="5"
                          strokeLinecap="round"
                          opacity="0.9"
                        />
                        <circle cx="108" cy="242" r="5" fill="#20232b" opacity="0.9" />
                        <circle cx="148" cy="242" r="5" fill="#20232b" opacity="0.9" />
                      </g>
                      <path
                        d="M116 158 C118 172, 138 172, 140 158 L140 182 C138 194, 118 194, 116 182 Z"
                        fill="url(#skin)"
                      />
                      <path
                        d="M92 128
                         C92 101, 109 82, 128 82
                         C147 82, 164 101, 164 128
                         C164 151, 150 167, 128 167
                         C106 167, 92 151, 92 128 Z"
                        fill="url(#skin)"
                      />
                      <path
                        d="M86 124
                         C90 92, 112 72, 138 74
                         C160 76, 172 92, 172 112
                         C160 104, 150 102, 136 106
                         C118 111, 106 120, 86 124 Z"
                        fill="url(#hair)"
                      />
                      <path
                        d="M166 132
                         C173 132, 176 140, 172 146
                         C168 152, 160 152, 160 146
                         C160 139, 162 132, 166 132 Z"
                        fill="#b77d60"
                      />
                      <g>
                        <circle
                          cx="113"
                          cy="128"
                          r="16"
                          fill="none"
                          stroke="url(#glassesFrame)"
                          strokeWidth="4"
                        />
                        <circle
                          cx="147"
                          cy="128"
                          r="16"
                          fill="none"
                          stroke="url(#glassesFrame)"
                          strokeWidth="4"
                        />
                        <path
                          d="M129 128 L131 128"
                          stroke="url(#glassesFrame)"
                          strokeWidth="4"
                          strokeLinecap="round"
                        />
                        <circle cx="113" cy="128" r="13" fill="url(#lens)" />
                        <circle cx="147" cy="128" r="13" fill="url(#lens)" />
                        <path
                          d="M106 122 C110 118, 116 118, 120 122"
                          stroke="#ffffff"
                          strokeOpacity="0.18"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                        <path
                          d="M140 122 C144 118, 150 118, 154 122"
                          stroke="#ffffff"
                          strokeOpacity="0.18"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                      </g>
                      <path
                        d="M128 132 C126 140, 126 144, 130 146"
                        stroke="#8b5f4a"
                        strokeOpacity="0.35"
                        strokeWidth="3"
                        strokeLinecap="round"
                        fill="none"
                      />
                      <path
                        d="M116 150 C122 154, 134 154, 140 150"
                        stroke="#6b3f34"
                        strokeOpacity="0.35"
                        strokeWidth="3"
                        strokeLinecap="round"
                        fill="none"
                      />
                      <circle
                        cx="128"
                        cy="128"
                        r="122"
                        fill="none"
                        stroke="#000"
                        strokeOpacity="0.35"
                        strokeWidth="18"
                      />
                    </g>
                  </svg>
                </div>
                <p className="text-sm text-[color:var(--subtle)] leading-relaxed text-center">
                  Hi, I’m Von—a software developer based in Toronto, originally
                  from the Philippines. I built Beliefted to serve a global
                  community of believers who want a more thoughtful,
                  prayer‑focused space.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
