"use client";

export default function WhyBelieftedContent() {
  return (
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

      <section className="mt-10 border-t border-[color:var(--panel-border)] pt-8">
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

      <section className="mt-10 border-t border-[color:var(--panel-border)] pt-8">
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
                  d="M100 118 C104 104, 116 98, 128 98 C140 98, 152 104, 156 118"
                  fill="none"
                  stroke="url(#hair)"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                <g>
                  <rect x="90" y="116" width="36" height="22" rx="8" fill="url(#lens)" />
                  <rect x="130" y="116" width="36" height="22" rx="8" fill="url(#lens)" />
                  <rect x="124" y="124" width="8" height="4" fill="url(#glassesFrame)" />
                </g>
              </g>
            </svg>
          </div>
        </div>
      </section>
    </div>
  );
}
