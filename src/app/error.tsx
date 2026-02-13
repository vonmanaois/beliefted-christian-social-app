"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="container">
      <div className="page-grid">
        <div />
        <div className="panel p-6">
          <h1 className="text-lg font-semibold text-[color:var(--ink)]">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-[color:var(--subtle)]">
            We’re working to fix this. Please try again.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-4 inline-flex items-center rounded-lg px-3 py-2 text-sm font-semibold text-[color:var(--accent-contrast)] bg-[color:var(--accent)]"
          >
            Try again
          </button>
        </div>
      </div>
    </main>
  );
}
