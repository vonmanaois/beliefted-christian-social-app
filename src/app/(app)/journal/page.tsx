import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import JournalBoard from "@/components/journal/JournalBoard";
import PanelMotion from "@/components/layout/PanelMotion";

export default async function JournalPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/");
  }
  return (
    <PanelMotion className="panel p-6 sm:p-8 rounded-none">
          <JournalBoard />
        </PanelMotion>
  );
}
