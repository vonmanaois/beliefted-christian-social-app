import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import JournalModel from "@/models/Journal";
import { Types } from "mongoose";
import { z } from "zod";

const normalizeId = (raw: string) => raw.replace(/^ObjectId\(\"(.+)\"\)$/, "$1");

export async function PATCH(
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
    return NextResponse.json({ error: "Invalid journal ID" }, { status: 400 });
  }

  const JournalSchema = z.object({
    title: z.string().trim().min(1).max(160),
    content: z.string().trim().min(1).max(5000),
  });

  const body = JournalSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid journal data" }, { status: 400 });
  }

  await dbConnect();

  const journal = await JournalModel.findById(cleanedId);
  if (!journal) {
    return NextResponse.json({ error: "Journal not found" }, { status: 404 });
  }

  if (journal.userId.toString() !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  journal.title = body.data.title.trim();
  journal.content = body.data.content.trim();
  await journal.save();

  return NextResponse.json({ ok: true, title: journal.title, content: journal.content });
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
    return NextResponse.json({ error: "Invalid journal ID" }, { status: 400 });
  }

  await dbConnect();

  const journal = await JournalModel.findById(cleanedId);
  if (!journal) {
    return NextResponse.json({ error: "Journal not found" }, { status: 404 });
  }

  if (journal.userId.toString() !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await journal.deleteOne();
  return NextResponse.json({ ok: true });
}
