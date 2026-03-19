import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import DayStoryModel from "@/models/DayStory";
import DayStoryViewModel from "@/models/DayStoryView";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid story id" }, { status: 400 });
  }

  await dbConnect();

  const story = await DayStoryModel.findById(id).select("userId expiresAt").lean();
  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }
  if (story.expiresAt && story.expiresAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "Story expired" }, { status: 410 });
  }

  if (String(story.userId) === String(session.user.id)) {
    return NextResponse.json({ ok: true, counted: false });
  }

  try {
    await DayStoryViewModel.create({ storyId: id, userId: session.user.id });
  } catch {
    // ignore duplicate views
  }

  return NextResponse.json({ ok: true, counted: true });
}
