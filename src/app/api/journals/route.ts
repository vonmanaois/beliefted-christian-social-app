import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import JournalModel from "@/models/Journal";
import { z } from "zod";
import { rateLimit } from "@/lib/rateLimit";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();

  const journals = await JournalModel.find({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json(journals);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`journal-post:${session.user.id}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
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

  const journal = await JournalModel.create({
    title: body.data.title.trim(),
    content: body.data.content.trim(),
    userId: session.user.id,
  });

  return NextResponse.json(journal, { status: 201 });
}
