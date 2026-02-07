import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import UserModel from "@/models/User";
import OnboardingForm from "@/components/profile/OnboardingForm";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/");
  }

  await dbConnect();
  const user = await UserModel.findById(session.user.id).lean();

  if (user?.username) {
    redirect("/");
  }

  return (
    <main className="container">
      <div className="mx-auto max-w-xl">
        <div className="panel p-6 md:p-8">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--subtle)]">
              Welcome
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-[color:var(--ink)]">
              Hi {user?.name ?? "there"} — let&apos;s finish your profile
            </h1>
            <p className="mt-2 text-sm text-[color:var(--subtle)]">
              Choose a username to continue. You can update your bio later.
            </p>
          </div>
          <OnboardingForm
            name={user?.name ?? null}
            username={user?.username ?? null}
            bio={user?.bio ?? null}
          />
        </div>
      </div>
    </main>
  );
}
