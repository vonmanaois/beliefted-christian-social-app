import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import PrayerModel from "@/models/Prayer";
import UserModel from "@/models/User";
import Sidebar from "@/components/layout/Sidebar";
import ProfileTabs from "@/components/profile/ProfileTabs";
import FollowButton from "@/components/profile/FollowButton";
import ProfileHeader from "@/components/profile/ProfileHeader";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({
  params,
}: {
  params: { username: string };
}) {
  const session = await getServerSession(authOptions);

  await dbConnect();

  const user = await UserModel.findOne({ username: params.username }).lean();

  if (!user) {
    redirect("/profile");
  }

  const prayedCount = await PrayerModel.countDocuments({
    prayedBy: user._id,
  });

  const isSelf = session?.user?.id === user._id.toString();
  const isFollowing = Boolean(
    session?.user?.id &&
      user.followers?.some((id) => id.toString() === session.user.id)
  );

  return (
    <main className="container">
      <div className="page-grid">
        <Sidebar />
        <div className="panel p-8">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <ProfileHeader
              initialName={user?.name ?? "User"}
              initialUsername={user?.username ?? "username"}
              initialBio={user?.bio ?? null}
              usernameParam={user?.username ?? null}
            />
            <div className="flex items-center gap-4">
              {!isSelf && (
                <FollowButton
                  targetUserId={user._id.toString()}
                  initialFollowing={isFollowing}
                  initialFollowersCount={user.followers?.length ?? 0}
                />
              )}
              <div className="h-24 w-24 rounded-full overflow-hidden border border-slate-200 bg-slate-200">
                {user?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.image}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
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

          <ProfileTabs userId={user._id.toString()} />
        </div>
      </div>
    </main>
  );
}
