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
import FaithStoryModel from "@/models/FaithStory";
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
  const viewerId = session?.user?.id ?? null;

  const viewerFollows = async (authorId?: string | null) => {
    if (!viewerId || !authorId) return false;
    if (String(authorId) === String(viewerId)) return true;
    const viewer = await UserModel.findById(viewerId).select("following").lean();
    const following = Array.isArray(viewer?.following) ? viewer.following : [];
    return following.some((id) => String(id) === String(authorId));
  };

  const canView = async (
    privacy: string | undefined,
    authorId?: string | null
  ) => {
    if (!privacy || privacy === "public") return true;
    if (!viewerId) return false;
    if (String(authorId) === String(viewerId)) return true;
    if (privacy === "followers") {
      return viewerFollows(authorId ?? null);
    }
    return false;
  };

  const prayer = await PrayerModel.findById(postId).lean();
  if (prayer) {
    const allow = await canView(prayer.privacy, prayer.userId?.toString() ?? null);
    if (!allow) {
      return (
        <main className="container">
          <div className="page-grid">
            <Sidebar />
            <div>
              <PostBackHeader label="Prayer" refreshOnBack />
              <div className="panel p-6 text-sm text-[color:var(--subtle)]">
                <p className="text-[color:var(--ink)] font-semibold">
                  This post is not available anymore.
                </p>
                <p className="mt-1">It may be private or deleted by the author.</p>
              </div>
            </div>
          </div>
        </main>
      );
    }
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
    const isOwner = Boolean(
      session?.user?.id && String(prayer.userId) === String(session.user.id)
    );

    return (
      <main className="container">
        <div className="page-grid">
          <Sidebar />
          <div>
            <PostBackHeader label="Prayer" />
            {isOwner && prayer.privacy && prayer.privacy !== "public" && (
              <div className="mt-3 text-xs text-[color:var(--subtle)]">
                <span className="rounded-full border border-[color:var(--panel-border)] px-2 py-0.5 font-semibold">
                  {prayer.privacy === "private" ? "Only me" : "Followers"}
                </span>
              </div>
            )}
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
                  isOwner,
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
    const allow = await canView(word.privacy, word.userId?.toString() ?? null);
    if (!allow) {
      return (
        <main className="container">
          <div className="page-grid">
            <Sidebar />
            <div>
              <PostBackHeader label="Word" refreshOnBack />
              <div className="panel p-6 text-sm text-[color:var(--subtle)]">
                <p className="text-[color:var(--ink)] font-semibold">
                  This post is not available anymore.
                </p>
                <p className="mt-1">It may be private or deleted by the author.</p>
              </div>
            </div>
          </div>
        </main>
      );
    }
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
    const isOwner = Boolean(
      session?.user?.id && String(word.userId) === String(session.user.id)
    );
    const sharedStoryId = word.sharedFaithStoryId
      ? String(word.sharedFaithStoryId)
      : null;
    let sharedStoryFallback: {
      title?: string | null;
      coverImage?: string | null;
      authorUsername?: string | null;
    } | null = null;
    if (
      sharedStoryId &&
      (!word.sharedFaithStoryTitle ||
        !word.sharedFaithStoryCover ||
        !word.sharedFaithStoryAuthorUsername)
    ) {
      sharedStoryFallback = await FaithStoryModel.findById(sharedStoryId)
        .select("title coverImage authorUsername")
        .lean();
    }
    const sharedFaithStory =
      sharedStoryId &&
      (word.sharedFaithStoryTitle || sharedStoryFallback)
        ? {
            id: sharedStoryId,
            title: word.sharedFaithStoryTitle ?? sharedStoryFallback?.title ?? "",
            coverImage:
              word.sharedFaithStoryCover ?? sharedStoryFallback?.coverImage ?? null,
            authorUsername:
              word.sharedFaithStoryAuthorUsername ??
              sharedStoryFallback?.authorUsername ??
              null,
          }
        : null;

    return (
      <main className="container">
        <div className="page-grid">
          <Sidebar />
          <div>
            <PostBackHeader label="Word" />
            {isOwner && word.privacy && word.privacy !== "public" && (
              <div className="mt-3 text-xs text-[color:var(--subtle)]">
                <span className="rounded-full border border-[color:var(--panel-border)] px-2 py-0.5 font-semibold">
                  {word.privacy === "private" ? "Only me" : "Followers"}
                </span>
              </div>
            )}
            <div className="feed-surface sm:rounded-none sm:overflow-visible">
              <WordCard
                word={{
                  ...word,
                  content: word.content ?? "",
                  _id: word._id.toString(),
                  userId: word.userId?.toString() ?? null,
                  sharedFaithStoryId: word.sharedFaithStoryId
                    ? String(word.sharedFaithStoryId)
                    : null,
                  sharedFaithStory: sharedFaithStory ?? undefined,
                  scriptureRef: word.scriptureRef ?? null,
                  createdAt:
                    word.createdAt instanceof Date
                      ? word.createdAt.toISOString()
                      : (word.createdAt as unknown as string),
                  isOwner,
                  likedBy: (word.likedBy ?? []).map((id) => id.toString()),
                  savedBy: (word.savedBy ?? []).map((id) => id.toString()),
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
