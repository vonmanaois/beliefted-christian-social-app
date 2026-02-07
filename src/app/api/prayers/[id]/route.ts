import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import PrayerModel from "@/models/Prayer";
import CommentModel from "@/models/Comment";
import { revalidateTag } from "next/cache";

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

  const prayer = await PrayerModel.findById(id);
  if (!prayer) {
    return NextResponse.json({ error: "Prayer not found" }, { status: 404 });
  }

  if (prayer.userId.toString() !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await CommentModel.deleteMany({ prayerId: prayer._id });
  await PrayerModel.deleteOne({ _id: prayer._id });

  revalidateTag("prayers-feed");
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

  await dbConnect();

  const prayer = await PrayerModel.findById(id);
  if (!prayer) {
    return NextResponse.json({ error: "Prayer not found" }, { status: 404 });
  }

  if (prayer.userId.toString() !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (prayer.kind === "request") {
    const rawPoints = Array.isArray(body.prayerPoints) ? body.prayerPoints : [];
    const cleanedPoints = rawPoints
      .map((point) => ({
        title: typeof point?.title === "string" ? point.title.trim() : "",
        description:
          typeof point?.description === "string" ? point.description.trim() : "",
      }))
      .filter((point) => point.title && point.description)
      .slice(0, 8);

    if (cleanedPoints.length === 0) {
      return NextResponse.json(
        { error: "Add at least one prayer point (title + description)" },
        { status: 400 }
      );
    }

    prayer.prayerPoints = cleanedPoints;
    prayer.content = "";
    await prayer.save();

    revalidateTag("prayers-feed");
    return NextResponse.json({ ok: true, prayerPoints: prayer.prayerPoints });
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  prayer.content = content;
  await prayer.save();

  revalidateTag("prayers-feed");
  return NextResponse.json({ ok: true, content: prayer.content });
}
