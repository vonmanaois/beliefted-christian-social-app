import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Types } from "mongoose";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Sidebar from "@/components/layout/Sidebar";
import PostBackHeader from "@/components/ui/PostBackHeader";
import PrayerModel from "@/models/Prayer";
import WordModel from "@/models/Word";
import CommentModel from "@/models/Comment";
import WordCommentModel from "@/models/WordComment";
import UserModel from "@/models/User";
import PrayerCard from "@/components/prayer/PrayerCard";
import WordCard from "@/components/word/WordCard";

type PageProps = {
  params: Promise<{ username: string; postId: string }>;
};

export default async function PostDetailPage({ params }: PageProps) {
  const { username, postId } = await params;
  if (!Types.ObjectId.isValid(postId)) {
    return (
      <main className="container">
        <div className="page-grid">
          <Sidebar />
          <div>
            <PostBackHeader label="Post" refreshOnBack />
            <div className="panel p-6 text-sm text-[color:var(--subtle)]">
              <p className="text-[color:var(--ink)] font-semibold">
                This post is not available anymore.
              </p>
              <p className="mt-1">It may have been deleted by the author.</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  await dbConnect();
  const session = await getServerSession(authOptions);

  const prayer = await PrayerModel.findById(postId).lean();
  if (prayer) {
    if (!prayer.isAnonymous) {
      const currentUser = await UserModel.findById(prayer.userId)
        .select("username name image")
        .lean();
      const canonicalUsername = currentUser?.username ?? prayer.authorUsername ?? null;
      if (canonicalUsername && canonicalUsername !== username) {
        redirect(`/${canonicalUsername}/${postId}`);
      }
    }

    const commentCount = await CommentModel.countDocuments({ prayerId: prayer._id });
    const user =
      prayer.isAnonymous
        ? null
        : await UserModel.findById(prayer.userId)
            .select("name image username")
            .lean();

    return (
      <main className="container">
        <div className="page-grid">
          <Sidebar />
          <div>
            <PostBackHeader label="Prayer" />
            <div className="feed-surface sm:rounded-none sm:overflow-visible">
              <PrayerCard
                prayer={{
                  ...prayer,
                  _id: prayer._id.toString(),
                  userId: prayer.userId?.toString(),
                  heading: prayer.heading ?? undefined,
                  scriptureRef: prayer.scriptureRef ?? null,
                  createdAt:
                    prayer.createdAt instanceof Date
                      ? prayer.createdAt.toISOString()
                      : (prayer.createdAt as unknown as string),
                  isOwner: Boolean(
                    session?.user?.id && String(prayer.userId) === String(session.user.id)
                  ),
                  prayedBy: (prayer.prayedBy ?? []).map((id) => id.toString()),
                  prayerPoints: (prayer.prayerPoints ?? []).map((point) => ({
                    title: point.title ?? "",
                    description: point.description ?? "",
                  })),
                  commentCount,
                  user: prayer.isAnonymous
                    ? null
                    : {
                        name: user?.name ?? prayer.authorName,
                        image: user?.image ?? prayer.authorImage,
                        username: user?.username ?? prayer.authorUsername,
                      },
                }}
                defaultShowComments
              />
            </div>
          </div>
        </div>
      </main>
    );
  }

  const word = await WordModel.findById(postId).lean();
  if (word) {
    const currentUser = await UserModel.findById(word.userId)
      .select("username name image")
      .lean();
    const canonicalUsername = currentUser?.username ?? word.authorUsername ?? null;
    if (canonicalUsername && canonicalUsername !== username) {
      redirect(`/${canonicalUsername}/${postId}`);
    }
    const commentCount = await WordCommentModel.countDocuments({ wordId: word._id });
    const user = await UserModel.findById(word.userId)
      .select("name image username")
      .lean();

    return (
      <main className="container">
        <div className="page-grid">
          <Sidebar />
          <div>
            <PostBackHeader label="Word" />
            <div className="feed-surface sm:rounded-none sm:overflow-visible">
              <WordCard
                word={{
                  ...word,
                  _id: word._id.toString(),
                  userId: word.userId?.toString() ?? null,
                  scriptureRef: word.scriptureRef ?? null,
                  createdAt:
                    word.createdAt instanceof Date
                      ? word.createdAt.toISOString()
                      : (word.createdAt as unknown as string),
                  isOwner: Boolean(
                    session?.user?.id && String(word.userId) === String(session.user.id)
                  ),
                  likedBy: (word.likedBy ?? []).map((id) => id.toString()),
                  commentCount,
                  user: {
                    name: user?.name ?? word.authorName,
                    image: user?.image ?? word.authorImage,
                    username: user?.username ?? word.authorUsername,
                  },
                }}
                defaultShowComments
              />
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="page-grid">
        <Sidebar />
        <div>
          <PostBackHeader label="Post" refreshOnBack />
          <div className="panel p-6 text-sm text-[color:var(--subtle)]">
            <p className="text-[color:var(--ink)] font-semibold">
              This post is not available anymore.
            </p>
            <p className="mt-1">It may have been deleted by the author.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
