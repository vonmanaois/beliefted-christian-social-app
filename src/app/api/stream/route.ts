import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import NotificationModel from "@/models/Notification";
import PrayerModel from "@/models/Prayer";
import WordModel from "@/models/Word";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  await dbConnect();

  const encoder = new TextEncoder();
  let lastWordId: string | null = null;
  let lastPrayerId: string | null = null;
  let lastNotificationsCount: number | null = null;
  let lastEmitAt = 0;
  const minEmitIntervalMs = 10000;
  const startId = request.headers.get("last-event-id");
  let eventId = Number.isNaN(Number(startId)) ? 0 : Number(startId);

  const stream = new ReadableStream({
    start(controller) {
      const send = async () => {
        try {
          const [latestWord, latestPrayer, notificationsCount] = await Promise.all([
            WordModel.findOne({})
              .sort({ createdAt: -1 })
              .select("_id createdAt")
              .lean(),
            PrayerModel.findOne({})
              .sort({ createdAt: -1 })
              .select("_id createdAt")
              .lean(),
            userId
              ? NotificationModel.countDocuments({ userId })
              : Promise.resolve(null),
          ]);

          const nextWordId = latestWord?._id?.toString?.() ?? null;
          const nextPrayerId = latestPrayer?._id?.toString?.() ?? null;

          const wordsChanged = nextWordId && nextWordId !== lastWordId;
          const prayersChanged = nextPrayerId && nextPrayerId !== lastPrayerId;
          const notificationsChanged =
            typeof notificationsCount === "number" &&
            notificationsCount !== lastNotificationsCount;

          if (wordsChanged || prayersChanged || notificationsChanged) {
            const now = Date.now();
            if (now - lastEmitAt < minEmitIntervalMs) {
              return;
            }
            lastEmitAt = now;
            if (wordsChanged) {
              lastWordId = nextWordId;
            }
            if (prayersChanged) {
              lastPrayerId = nextPrayerId;
            }
            if (notificationsChanged) {
              lastNotificationsCount = notificationsCount;
            }
            eventId += 1;
            controller.enqueue(
              encoder.encode(
                `id: ${eventId}\n` +
                  `data: ${JSON.stringify({
                    wordsChanged,
                    prayersChanged,
                    notificationsCount:
                      typeof notificationsCount === "number"
                        ? notificationsCount
                        : undefined,
                  })}\n\n`
              )
            );
          }
        } catch {
          // ignore transient errors
        }
      };

      send();

      const interval = setInterval(send, 10000);

      const close = () => {
        clearInterval(interval);
        controller.close();
      };

      request.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
