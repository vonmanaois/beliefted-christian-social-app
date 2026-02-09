"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function Navbar() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";

  return (
    <nav className="panel px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img
          src="/images/beliefted-logo.svg"
          alt="Beliefted"
          className="h-9 w-9 rounded-full"
        />
        <div>
          <p className="text-sm font-semibold text-[color:var(--ink)]">Beliefted</p>
          <p className="text-xs text-[color:var(--subtle)]">Prayer Wall</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {isAuthenticated ? (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-[color:var(--ink)]">
                {session.user?.name ?? "Signed in"}
              </p>
              <p className="text-xs text-[color:var(--subtle)]">
                {session.user?.email}
              </p>
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              className="pill-button border border-slate-200 text-[color:var(--ink)]"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => signIn("google")}
            className="pill-button bg-slate-900 text-white"
          >
            Sign in
          </button>
        )}
      </div>
    </nav>
  );
}
