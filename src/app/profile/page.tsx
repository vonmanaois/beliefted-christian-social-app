import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import PrayerModel from "@/models/Prayer";
import UserModel from "@/models/User";
import ProfileSettings from "@/components/profile/ProfileSettings";
import Sidebar from "@/components/layout/Sidebar";
import ProfileTabs from "@/components/profile/ProfileTabs";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/");
  }

  await dbConnect();

  const user = await UserModel.findById(session.user.id).lean();
  const prayedCount = await PrayerModel.countDocuments({
    prayedBy: session.user.id,
  });

  return (
    <main className="container">
      <div className="page-grid">
        <Sidebar />
        <div className="panel p-8">
          {!user?.username && (
            <div className="mb-6">
              <ProfileSettings required currentName={user?.name ?? null} />
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--subtle)]">
                Profile
              </p>
              <h1 className="mt-3 text-3xl text-[color:var(--ink)]">
                {user?.name ?? session.user.name ?? "Your Name"}
              </h1>
              <p className="mt-2 text-sm text-[color:var(--subtle)]">
                @{user?.username ?? "username"}
              </p>
            </div>
            <div className="h-24 w-24 rounded-full overflow-hidden border border-slate-200 bg-slate-200">
              {user?.image || session.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user?.image ?? session.user.image ?? ""}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="panel p-4">
              <p className="text-xs text-[color:var(--subtle)]">Prayers lifted</p>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--ink)]">
                {prayedCount}
              </p>
            </div>
            <div className="panel p-4">
              <p className="text-xs text-[color:var(--subtle)]">Username</p>
              <p className="mt-2 text-lg font-semibold text-[color:var(--ink)]">
                @{user?.username ?? "username"}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <details className="panel p-4">
              <summary className="cursor-pointer text-sm font-semibold text-[color:var(--ink)]">
                Update profile
              </summary>
              <div className="mt-4">
                <ProfileSettings
                  currentUsername={user?.username ?? null}
                  currentName={user?.name ?? null}
                />
              </div>
            </details>
          </div>

          <ProfileTabs userId={session.user.id} />
        </div>
      </div>
    </main>
  );
}
