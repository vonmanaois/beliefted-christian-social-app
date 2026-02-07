import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import { z } from "zod";

const EventSchema = z.object({
  event: z.enum(["prayer_posted", "word_posted", "prayed", "word_liked", "followed"]),
  entityId: z.string().trim().optional(),
});

export async function POST(req: Request) {
  const body = EventSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  await dbConnect();

  try {
    const payload = {
      event: body.data.event,
      entityId: body.data.entityId ?? null,
      userId: session?.user?.id ?? null,
      createdAt: new Date(),
    };
    const { default: clientPromise } = await import("@/lib/mongodb");
    const client = await clientPromise;
    const db = client.db();
    await db.collection("analytics_events").insertOne(payload);
  } catch {
    // fail silently to avoid blocking UX
  }

  return NextResponse.json({ ok: true });
}
