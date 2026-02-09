import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import WordCommentModel from "@/models/WordComment";

const normalizeId = (raw: string) => raw.replace(/^ObjectId\\(\"(.+)\"\\)$/, "$1");

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const { id } = await params;
  const cleanedId = normalizeId(id ?? "");
  if (!Types.ObjectId.isValid(cleanedId)) {
    return NextResponse.json({ error: "Invalid comment ID" }, { status: 400 });
  }

  await dbConnect();

  const comment = await WordCommentModel.findById(cleanedId);
  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  if (!comment.userId || comment.userId.toString() !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  comment.content = content;
  await comment.save();

  return NextResponse.json({ content: comment.content });
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
    return NextResponse.json({ error: "Invalid comment ID" }, { status: 400 });
  }

  await dbConnect();

  const comment = await WordCommentModel.findById(cleanedId);
  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  if (!comment.userId || comment.userId.toString() !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await comment.deleteOne();

  return NextResponse.json({ success: true });
}
