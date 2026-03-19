import { NextResponse } from "next/server";
import { Types } from "mongoose";
import dbConnect from "@/lib/db";
import WordCommentModel from "@/models/WordComment";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await dbConnect();

  const { id } = await params;
  const rawId = id ?? "";
  const cleanedId = rawId.replace(/^ObjectId\\(\"(.+)\"\\)$/, "$1");
  const wordObjectId = Types.ObjectId.isValid(cleanedId)
    ? new Types.ObjectId(cleanedId)
    : null;

  if (!wordObjectId) {
    return NextResponse.json([], { status: 200 });
  }

  const comments = await WordCommentModel.find({ wordId: wordObjectId })
    .sort({ createdAt: -1 })
    .populate("userId", "_id name image username")
    .lean();

  const normalized = comments.map((comment) => ({
    ...comment,
    _id: String(comment._id),
    parentId: comment.parentId ? String(comment.parentId) : null,
    likedBy: Array.isArray(comment.likedBy) ? comment.likedBy.map((id) => String(id)) : [],
    userId: comment.userId
      ? {
          _id: String((comment.userId as { _id?: unknown })?._id ?? ""),
          name: (comment.userId as { name?: string | null })?.name ?? null,
          image: (comment.userId as { image?: string | null })?.image ?? null,
          username: (comment.userId as { username?: string | null })?.username ?? null,
        }
      : null,
  }));

  return NextResponse.json(normalized);
}
