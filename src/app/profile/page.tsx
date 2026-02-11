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
import ProfilePhotoUploader from "@/components/profile/ProfilePhotoUploader";
import PanelMotion from "@/components/layout/PanelMotion";

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
        <PanelMotion className="panel rounded-none p-0 sm:p-8" motion="none">
          <div className="px-4 pt-6 sm:px-0 sm:pt-0">
            {!user?.username && (
              <div className="mb-6">
                <ProfileSettings required currentName={user?.name ?? null} />
              </div>
            )}
            <div className="flex items-center justify-between gap-4">
              <ProfileHeader
                initialName={user?.name ?? session?.user?.name ?? "Your Name"}
                initialUsername={user?.username ?? "username"}
                initialBio={user?.bio ?? null}
              />
              <ProfilePhotoUploader
                currentImage={user?.image ?? session?.user?.image ?? null}
                currentName={user?.name ?? session?.user?.name ?? ""}
                currentUsername={user?.username ?? ""}
                currentBio={user?.bio ?? ""}
                size={80}
              />
            </div>

            <div className="mt-4">
              <ProfileUpdateModal
                currentUsername={user?.username ?? null}
                currentName={user?.name ?? null}
                currentBio={user?.bio ?? null}
                currentImage={user?.image ?? null}
                onUpdated={() => {}}
              />
            </div>

            <ProfileStats
              initialPrayedCount={prayedCount}
              initialFollowersCount={user?.followers?.length ?? 0}
              initialFollowingCount={user?.following?.length ?? 0}
            />

            <div className="my-6 border-t border-[color:var(--panel-border)]" />
          </div>

          <ProfileTabs userId={session?.user?.id ?? ""} />
        </PanelMotion>
      </div>
    </main>
  );
}
