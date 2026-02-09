import { NextResponse } from "next/server";
import { Types } from "mongoose";
import dbConnect from "@/lib/db";
import FaithStoryCommentModel from "@/models/FaithStoryComment";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await dbConnect();

  const { id } = await params;
  const cleanedId = (id ?? "").replace(/^ObjectId\(\"(.+)\"\)$/, "$1");
  const storyObjectId = Types.ObjectId.isValid(cleanedId)
    ? new Types.ObjectId(cleanedId)
    : null;

  if (!storyObjectId) {
    return NextResponse.json([], { status: 200 });
  }

  const comments = await FaithStoryCommentModel.find({ storyId: storyObjectId })
    .sort({ createdAt: -1 })
    .populate("userId", "_id name image username")
    .lean();

  return NextResponse.json(comments);
}
