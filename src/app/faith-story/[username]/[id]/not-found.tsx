import Sidebar from "@/components/layout/Sidebar";

export default function FaithStoryNotFound() {
  return (
    <main className="container">
      <div className="page-grid">
        <Sidebar />
        <div className="panel p-6 sm:p-8 rounded-none">
          <h1 className="text-xl font-semibold text-[color:var(--ink)]">
            Story not available
          </h1>
          <p className="mt-2 text-sm text-[color:var(--subtle)]">
            Sorry for the inconvenience. This faith story may have been removed or
            the link might be outdated.
          </p>
          <p className="mt-4 text-sm text-[color:var(--subtle)]">
            Please try again later or return to the Faith Stories feed.
          </p>
        </div>
      </div>
    </main>
  );
}
