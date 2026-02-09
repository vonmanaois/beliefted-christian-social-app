import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import NotificationModel from "@/models/Notification";
import { Types } from "mongoose";

const normalizeId = (raw: string) => raw.replace(/^ObjectId\(\"(.+)\"\)$/, "$1");

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
    return NextResponse.json({ error: "Invalid notification ID" }, { status: 400 });
  }

  await dbConnect();
  await NotificationModel.deleteOne({ _id: cleanedId, userId: session.user.id });

  return NextResponse.json({ ok: true });
}
