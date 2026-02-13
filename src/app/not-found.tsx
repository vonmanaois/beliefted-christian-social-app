import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container">
      <div className="page-grid">
        <div />
        <div className="panel p-6">
          <h1 className="text-lg font-semibold text-[color:var(--ink)]">
            Page not found
          </h1>
          <p className="mt-2 text-sm text-[color:var(--subtle)]">
            The page you’re looking for doesn’t exist or was moved.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center rounded-lg px-3 py-2 text-sm font-semibold text-[color:var(--accent-contrast)] bg-[color:var(--accent)]"
          >
            Go back home
          </Link>
        </div>
      </div>
    </main>
  );
}
