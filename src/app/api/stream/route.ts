import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import NotificationModel from "@/models/Notification";
import PrayerModel from "@/models/Prayer";
import WordModel from "@/models/Word";
import { Types } from "mongoose";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  const excludedUserId =
    userId && Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : null;

  await dbConnect();

  const encoder = new TextEncoder();
  let lastWordId: string | null = null;
  let lastPrayerId: string | null = null;
  let lastWordCreatedAt: number | null = null;
  let lastPrayerCreatedAt: number | null = null;
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
            WordModel.findOne(excludedUserId ? { userId: { $ne: excludedUserId } } : {})
              .sort({ createdAt: -1 })
              .select("_id createdAt")
              .lean(),
            PrayerModel.findOne(excludedUserId ? { userId: { $ne: excludedUserId } } : {})
              .sort({ createdAt: -1 })
              .select("_id createdAt")
              .lean(),
            userId
              ? NotificationModel.countDocuments({ userId })
              : Promise.resolve(null),
          ]);

          const nextWordId = latestWord?._id?.toString?.() ?? null;
          const nextPrayerId = latestPrayer?._id?.toString?.() ?? null;
          const nextWordCreatedAt = latestWord?.createdAt
            ? new Date(latestWord.createdAt).getTime()
            : null;
          const nextPrayerCreatedAt = latestPrayer?.createdAt
            ? new Date(latestPrayer.createdAt).getTime()
            : null;

          let wordsChanged =
            nextWordId &&
            nextWordCreatedAt !== null &&
            lastWordCreatedAt !== null &&
            (nextWordCreatedAt > lastWordCreatedAt ||
              (nextWordCreatedAt === lastWordCreatedAt && nextWordId !== lastWordId));
          let prayersChanged =
            nextPrayerId &&
            nextPrayerCreatedAt !== null &&
            lastPrayerCreatedAt !== null &&
            (nextPrayerCreatedAt > lastPrayerCreatedAt ||
              (nextPrayerCreatedAt === lastPrayerCreatedAt && nextPrayerId !== lastPrayerId));
          let notificationsChanged =
            typeof notificationsCount === "number" &&
            notificationsCount !== lastNotificationsCount;

          if (lastWordId === null && nextWordId) {
            lastWordId = nextWordId;
            lastWordCreatedAt = nextWordCreatedAt;
            wordsChanged = false;
          }
          if (lastPrayerId === null && nextPrayerId) {
            lastPrayerId = nextPrayerId;
            lastPrayerCreatedAt = nextPrayerCreatedAt;
            prayersChanged = false;
          }
          if (lastNotificationsCount === null && typeof notificationsCount === "number") {
            lastNotificationsCount = notificationsCount;
            notificationsChanged = false;
          }

          if (wordsChanged || prayersChanged || notificationsChanged) {
            const now = Date.now();
            if (now - lastEmitAt < minEmitIntervalMs) {
              return;
            }
            lastEmitAt = now;
            if (wordsChanged) {
              lastWordId = nextWordId;
              lastWordCreatedAt = nextWordCreatedAt;
            }
            if (prayersChanged) {
              lastPrayerId = nextPrayerId;
              lastPrayerCreatedAt = nextPrayerCreatedAt;
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
