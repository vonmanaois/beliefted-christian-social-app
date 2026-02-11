import { notFound, redirect } from "next/navigation";
import { Types } from "mongoose";
import dbConnect from "@/lib/db";
import FaithStoryModel from "@/models/FaithStory";
import UserModel from "@/models/User";
import Sidebar from "@/components/layout/Sidebar";
import FaithStoryDetail from "@/components/faith/FaithStoryDetail";

type PageProps = {
  params: Promise<{ username: string; id: string }>;
};

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXTAUTH_URL ||
  "http://localhost:3000";

const toSnippet = (text: string, max = 160) => {
  if (!text) return "";
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
};

export async function generateMetadata({ params }: PageProps) {
  const { username, id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return {};
  }

  await dbConnect();
  const story = await FaithStoryModel.findById(id).lean();
  if (!story) {
    return {};
  }

  const author =
    story.userId
      ? await UserModel.findById(story.userId).select("name image username").lean()
      : null;
  const authorUsername = author?.username ?? story.authorUsername ?? username ?? null;
  const authorName = author?.name ?? story.authorName ?? "User";

  const canonical = `${siteUrl}/faith-story/${authorUsername ?? username}/${id}`;
  const description = toSnippet(story.content ?? "");

  return {
    title: `${story.title} · ${authorName} @${authorUsername ?? "user"}`,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      url: canonical,
      title: story.title,
      description,
      siteName: "Beliefted",
      authors: [authorName],
      images: author?.image ? [{ url: author.image }] : undefined,
    },
    twitter: {
      card: "summary",
      title: story.title,
      description,
      images: author?.image ? [author.image] : undefined,
    },
  };
}

export default async function FaithStoryDetailPage({ params }: PageProps) {
  const { username, id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    notFound();
  }

  await dbConnect();
  const story = await FaithStoryModel.findById(id).lean();
  if (!story) {
    notFound();
  }

  const author =
    story.userId ? await UserModel.findById(story.userId).select("name image username").lean() : null;
  const authorUsername = author?.username ?? story.authorUsername ?? null;

  if (authorUsername && authorUsername !== username) {
    redirect(`/faith-story/${authorUsername}/${id}`);
  }

  const canonical = `${siteUrl}/faith-story/${authorUsername ?? username}/${id}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: story.title,
    datePublished: story.createdAt?.toISOString?.() ?? undefined,
    author: {
      "@type": "Person",
      name: author?.name ?? story.authorName ?? "User",
      url: authorUsername ? `${siteUrl}/profile/${authorUsername}` : undefined,
    },
    mainEntityOfPage: canonical,
  };

  return (
    <main className="container">
      <div className="page-grid">
        <Sidebar />
        <div>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
          <FaithStoryDetail
            story={{
              _id: story._id.toString(),
              title: story.title,
              content: story.content,
              createdAt: story.createdAt.toISOString(),
              likedBy: (story.likedBy ?? []).map((id) => id.toString()),
              isAnonymous: story.isAnonymous ?? false,
              userId: story.userId?.toString() ?? null,
              user: {
                name: author?.name ?? story.authorName ?? "User",
                username: authorUsername,
                image: author?.image ?? story.authorImage ?? null,
              },
            }}
          />
        </div>
      </div>
    </main>
  );
}
