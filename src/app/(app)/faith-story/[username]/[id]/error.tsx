"use client";


export default function FaithStoryError() {
  return (
    <div className="panel p-6 sm:p-8 rounded-none">
          <h1 className="text-xl font-semibold text-[color:var(--ink)]">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-[color:var(--subtle)]">
            Sorry for the inconvenience. We’re working on it.
          </p>
        </div>
  );
}
