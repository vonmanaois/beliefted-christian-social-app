import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import UserModel from "@/models/User";
import Sidebar from "@/components/layout/Sidebar";
import HomeTabs from "@/components/home/HomeTabs";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (session?.user?.id) {
    await dbConnect();
    const user = await UserModel.findById(session.user.id).lean();
    if (user && !user.onboardingComplete) {
      redirect("/onboarding");
    }
  }

  return (
    <main className="container">
      <div className="page-grid">
        <Sidebar />
        <div>
          <HomeTabs />
        </div>
      </div>
    </main>
  );
}
