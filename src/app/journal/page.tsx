import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";
import JournalBoard from "@/components/journal/JournalBoard";

export default async function JournalPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/");
  }

  return (
    <main className="container">
      <div className="page-grid">
        <Sidebar />
        <div className="panel p-6 sm:p-8 rounded-none">
          <JournalBoard />
        </div>
      </div>
    </main>
  );
}
