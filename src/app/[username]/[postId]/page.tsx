import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
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
    notFound();
  }

  await dbConnect();
  const session = await getServerSession(authOptions);

  const prayer = await PrayerModel.findById(postId).lean();
  if (prayer) {
    if (!prayer.isAnonymous && prayer.authorUsername && prayer.authorUsername !== username) {
      notFound();
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
    if (word.authorUsername && word.authorUsername !== username) {
      notFound();
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

  notFound();
}
