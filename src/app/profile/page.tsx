import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import PrayerModel from "@/models/Prayer";
import UserModel from "@/models/User";
import ProfileSettings from "@/components/profile/ProfileSettings";
import Sidebar from "@/components/layout/Sidebar";
import ProfileTabs from "@/components/profile/ProfileTabs";
import ProfileHeader from "@/components/profile/ProfileHeader";

export const dynamic = "force-dynamic";

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
            <ProfileHeader
              initialName={user?.name ?? session.user.name ?? "Your Name"}
              initialUsername={user?.username ?? "username"}
              initialBio={user?.bio ?? null}
            />
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

          <div className="mt-6 flex flex-wrap gap-6 text-sm text-[color:var(--subtle)]">
            <div className="flex flex-col">
              <span>Prayers lifted</span>
              <span className="text-lg font-semibold text-[color:var(--ink)]">
                {prayedCount}
              </span>
            </div>
            <div className="flex flex-col">
              <span>Followers</span>
              <span className="text-lg font-semibold text-[color:var(--ink)]">
                {user?.followers?.length ?? 0}
              </span>
            </div>
            <div className="flex flex-col">
              <span>Following</span>
              <span className="text-lg font-semibold text-[color:var(--ink)]">
                {user?.following?.length ?? 0}
              </span>
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
                  currentBio={user?.bio ?? null}
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
