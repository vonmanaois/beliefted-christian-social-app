import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import UserModel from "@/models/User";
import ProfileSettings from "@/components/profile/ProfileSettings";
import Sidebar from "@/components/layout/Sidebar";
import ProfileTabs from "@/components/profile/ProfileTabs";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfileUpdateModal from "@/components/profile/ProfileUpdateModal";
import ProfileStats from "@/components/profile/ProfileStats";
import UserIcon from "@/components/ui/UserIcon";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/");
  }

  await dbConnect();

  const user = await UserModel.findById(session.user.id).lean();

  if (user?.onboardingComplete) {
    redirect(`/profile/${user.username}`);
  } else {
    redirect("/onboarding");
  }
  const prayedCount = user?.prayersLiftedCount ?? 0;

  return (
    <main className="container">
      <div className="page-grid">
        <Sidebar />
        <div className="panel rounded-none p-0 sm:p-8">
          <div className="px-4 pt-6 sm:px-0 sm:pt-0">
            {!user?.username && (
              <div className="mb-6">
                <ProfileSettings required currentName={user?.name ?? null} />
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <ProfileHeader
                initialName={user?.name ?? session.user.name ?? "Your Name"}
                initialUsername={user?.username ?? "username"}
                initialBio={user?.bio ?? null}
              />
              <div className="h-16 w-16 self-end sm:self-auto rounded-full overflow-hidden border border-slate-200 bg-slate-200">
                {user?.image || session.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user?.image ?? session.user.image ?? ""}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-[color:var(--subtle)]">
                    <UserIcon size={36} />
                  </div>
                )}
              </div>
            </div>

            <ProfileStats
              initialPrayedCount={prayedCount}
              initialFollowersCount={user?.followers?.length ?? 0}
              initialFollowingCount={user?.following?.length ?? 0}
            />

            <div className="my-6 border-t border-[color:var(--panel-border)]" />

            <div className="mt-6">
              <ProfileUpdateModal
                currentUsername={user?.username ?? null}
                currentName={user?.name ?? null}
                currentBio={user?.bio ?? null}
                currentImage={user?.image ?? null}
                onUpdated={() => {}}
              />
            </div>
          </div>

          <ProfileTabs userId={session.user.id} />
        </div>
      </div>
    </main>
  );
}
