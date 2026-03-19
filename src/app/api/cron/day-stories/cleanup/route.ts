import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredDayStories } from "@/lib/dayStoriesCleanup";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await cleanupExpiredDayStories();
  return NextResponse.json({ ok: true, ...result });
}
