import Sidebar from "@/components/layout/Sidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="container">
      <div className="page-grid">
        <Sidebar />
        <div>{children}</div>
      </div>
    </main>
  );
}
