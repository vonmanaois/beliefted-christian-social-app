import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import WordModel from "@/models/Word";
import WordCommentModel from "@/models/WordComment";

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();

  const word = await WordModel.findById(id);
  if (!word) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (word.userId.toString() !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await WordCommentModel.deleteMany({ wordId: word._id });
  await WordModel.deleteOne({ _id: word._id });

  return NextResponse.json({ ok: true });
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!content) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  await dbConnect();

  const word = await WordModel.findById(id);
  if (!word) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (word.userId.toString() !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  word.content = content;
  await word.save();

  return NextResponse.json({ ok: true, content: word.content });
}
