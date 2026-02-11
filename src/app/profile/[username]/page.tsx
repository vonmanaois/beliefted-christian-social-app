import { redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import Image from "next/image";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import clientPromise from "@/lib/mongodb";
import Sidebar from "@/components/layout/Sidebar";
import ProfileTabs from "@/components/profile/ProfileTabs";
import FollowButton from "@/components/profile/FollowButton";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfileUpdateModal from "@/components/profile/ProfileUpdateModal";
import ProfileStats from "@/components/profile/ProfileStats";
import UserIcon from "@/components/ui/UserIcon";
import { cloudinaryTransform } from "@/lib/cloudinary";
import ProfilePhotoUploader from "@/components/profile/ProfilePhotoUploader";
import PanelMotion from "@/components/layout/PanelMotion";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const session = await getServerSession(authOptions);

  const client = await clientPromise;
  const db = client.db();
  const user = await db.collection("users").findOne({ username });

  if (!user) {
    redirect("/profile");
  }

  await dbConnect();
  const prayedCount = user?.prayersLiftedCount ?? 0;

  const isSelf = session?.user?.id === user._id.toString();
  const isFollowing = Boolean(
    session?.user?.id &&
      Array.isArray(user.followers) &&
      user.followers.some((id: { toString: () => string }) => id.toString() === session.user.id)
  );

  return (
    <main className="container">
      <div className="page-grid">
        <Sidebar />
        <PanelMotion className="panel rounded-none p-0 sm:p-8" motion="none">
          <div className="px-4 pt-6 sm:px-0 sm:pt-0">
            <div className="flex items-center justify-between gap-4">
              <ProfileHeader
                initialName={user?.name ?? "User"}
                initialUsername={user?.username ?? "username"}
                initialBio={user?.bio ?? null}
                usernameParam={user?.username ?? null}
              />
              {isSelf ? (
                <ProfilePhotoUploader
                  currentImage={user?.image ?? null}
                  currentName={user?.name ?? ""}
                  currentUsername={user?.username ?? ""}
                  currentBio={user?.bio ?? ""}
                  size={80}
                />
              ) : (
                <div className="h-20 w-20 rounded-full overflow-hidden border border-slate-200 bg-slate-200">
                  {user?.image ? (
                    <Image
                      src={cloudinaryTransform(user.image, { width: 160, height: 160 })}
                      alt="Profile"
                      width={160}
                      height={160}
                      sizes="80px"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[color:var(--subtle)]">
                      <UserIcon size={44} />
                    </div>
                  )}
                </div>
              )}
            </div>
            {!isSelf && (
              <div className="mt-4 w-full">
                <FollowButton
                  targetUserId={user._id.toString()}
                  initialFollowing={isFollowing}
                />
              </div>
            )}
            {isSelf && (
              <div className="mt-4">
                <ProfileUpdateModal
                  currentUsername={user?.username ?? null}
                  currentName={user?.name ?? null}
                  currentBio={user?.bio ?? null}
                />
              </div>
            )}

            <ProfileStats
              initialPrayedCount={prayedCount}
              initialFollowersCount={user?.followers?.length ?? 0}
              initialFollowingCount={user?.following?.length ?? 0}
              usernameParam={user?.username ?? null}
            />

            <div className="my-6 border-t border-[color:var(--panel-border)]" />
          </div>

          <ProfileTabs
            userId={user._id.toString()}
            showComposer={isSelf}
            initialTab="Faith Share"
            basePath={`/profile/${user.username}`}
          />
        </PanelMotion>
      </div>
    </main>
  );
}
