import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import FaithStoryModel from "@/models/FaithStory";
import { Types } from "mongoose";
import { z } from "zod";

const normalizeId = (raw: string) => raw.replace(/^ObjectId\(\"(.+)\"\)$/, "$1");

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const cleanedId = normalizeId(id ?? "");
  if (!Types.ObjectId.isValid(cleanedId)) {
    return NextResponse.json({ error: "Invalid story ID" }, { status: 400 });
  }

  const StorySchema = z.object({
    title: z.string().trim().min(1).max(160),
    content: z.string().trim().min(1).max(10000),
  });

  const body = StorySchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid story data" }, { status: 400 });
  }

  await dbConnect();

  const story = await FaithStoryModel.findById(cleanedId);
  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  if (story.userId.toString() !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  story.title = body.data.title.trim();
  story.content = body.data.content.trim();
  await story.save();

  return NextResponse.json({ ok: true, title: story.title, content: story.content });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const cleanedId = normalizeId(id ?? "");
  if (!Types.ObjectId.isValid(cleanedId)) {
    return NextResponse.json({ error: "Invalid story ID" }, { status: 400 });
  }

  await dbConnect();
  const story = await FaithStoryModel.findById(cleanedId);
  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  if (story.userId.toString() !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await story.deleteOne();
  return NextResponse.json({ ok: true });
}
