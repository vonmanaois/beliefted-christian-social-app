import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import FaithStoryCommentModel from "@/models/FaithStoryComment";
import { z } from "zod";
import { rateLimit } from "@/lib/rateLimit";
import { Types } from "mongoose";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`faith-story-comment:${session.user.id}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const CommentSchema = z.object({
    content: z.string().trim().min(1).max(1000),
    storyId: z.string().min(1),
  });

  const body = CommentSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Story ID and content are required" }, { status: 400 });
  }

  const content = body.data.content.trim();
  const cleanedStoryId = body.data.storyId.replace(/^ObjectId\(\"(.+)\"\)$/, "$1");
  const storyObjectId = Types.ObjectId.isValid(cleanedStoryId)
    ? new Types.ObjectId(cleanedStoryId)
    : null;

  if (!content || !storyObjectId) {
    return NextResponse.json({ error: "Story ID and content are required" }, { status: 400 });
  }

  await dbConnect();

  const comment = await FaithStoryCommentModel.create({
    content,
    userId: session.user.id,
    storyId: storyObjectId,
  });

  return NextResponse.json(comment, { status: 201 });
}
