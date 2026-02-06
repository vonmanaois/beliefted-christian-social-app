import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import WordCommentModel from "@/models/WordComment";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  await dbConnect();

  const comments = await WordCommentModel.find({ wordId: params.id })
    .sort({ createdAt: -1 })
    .populate("userId", "name image")
    .lean();

  return NextResponse.json(comments);
}
