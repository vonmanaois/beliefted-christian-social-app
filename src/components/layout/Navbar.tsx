"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Image from "next/image";

export default function Navbar() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";

  return (
    <nav className="panel px-6 py-4 flex items-center justify-center lg:justify-between relative">
      <div className="flex items-center gap-3 absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0">
        <Image
          src="/images/beliefted-logo.svg"
          alt="Beliefted"
          width={36}
          height={36}
          className="h-9 w-9 rounded-full"
        />
        <div className="text-center sm:text-left">
          <p className="text-sm font-semibold text-[color:var(--ink)]">Beliefted</p>
          <p className="text-xs text-[color:var(--subtle)]">Prayer Wall</p>
        </div>
      </div>
      <div className="flex items-center gap-3 absolute right-6 lg:static">
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
