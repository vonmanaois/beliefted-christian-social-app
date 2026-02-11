"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { GoogleLogo } from "@phosphor-icons/react";
import ThemeToggle from "@/components/layout/ThemeToggle";

export default function PreferencesPanel() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";

  return (
    <div className="flex flex-col gap-6">
      <ThemeToggle />
      <div className="border-t border-[color:var(--panel-border)] pt-4">
        {isAuthenticated ? (
          <div className="flex flex-col gap-3">
            <div>
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
              className="pill-button border border-slate-200 text-[color:var(--ink)] cursor-pointer"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => signIn("google")}
            className="pill-button bg-slate-900 text-white cursor-pointer inline-flex items-center gap-2"
          >
            <GoogleLogo size={16} weight="regular" />
            Sign in
          </button>
        )}
      </div>
    </div>
  );
}
