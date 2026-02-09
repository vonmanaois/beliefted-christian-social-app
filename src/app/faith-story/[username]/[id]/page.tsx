import { notFound } from "next/navigation";
import { Types } from "mongoose";
import dbConnect from "@/lib/db";
import FaithStoryModel from "@/models/FaithStory";
import UserModel from "@/models/User";
import Sidebar from "@/components/layout/Sidebar";
import FaithStoryDetail from "@/components/faith/FaithStoryDetail";

type PageProps = {
  params: Promise<{ username: string; id: string }>;
};

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
    notFound();
  }

  return (
    <main className="container">
      <div className="page-grid">
        <Sidebar />
        <div>
          <FaithStoryDetail
            story={{
              _id: story._id.toString(),
              title: story.title,
              content: story.content,
              createdAt: story.createdAt.toISOString(),
              likedBy: (story.likedBy ?? []).map((id) => id.toString()),
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
