import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const DEFAULT_ADMIN_EMAIL = "von.manaois@gmail.com";

export async function GET() {
  const session = await getServerSession(authOptions);
  const adminEmail = process.env.ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL;

  if (!session?.user?.email || session.user.email !== adminEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { default: clientPromise } = await import("@/lib/mongodb");
  const client = await clientPromise;
  const db = client.db();

  const start = new Date();
  start.setDate(start.getDate() - 13);
  start.setHours(0, 0, 0, 0);

  const pipeline = [
    { $match: { createdAt: { $gte: start } } },
    {
      $group: {
        _id: {
          day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          event: "$event",
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.day": 1 } },
  ];

  const results = await db.collection("analytics_events").aggregate(pipeline).toArray();

  return NextResponse.json({ start: start.toISOString(), results });
}
