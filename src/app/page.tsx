import Sidebar from "@/components/layout/Sidebar";
import HomeTabs from "@/components/home/HomeTabs";

export default function HomePage() {
  return (
    <main className="container">
      <div className="page-grid">
        <Sidebar />
        <div>
          <header className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--subtle)]">
              Lifted Prayer Wall
            </p>
            <h1 className="mt-3 text-4xl text-[color:var(--ink)]">
              Share, pray, and lift each other up.
            </h1>
            <p className="mt-3 text-sm text-[color:var(--subtle)]">
              A calm, threads-inspired space for short prayers, encouragement,
              and support.
            </p>
          </header>
          <HomeTabs />
        </div>
      </div>
    </main>
  );
}
