import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import NotificationModel from "@/models/Notification";
import PrayerModel from "@/models/Prayer";
import WordModel from "@/models/Word";
import { Types } from "mongoose";

type StreamPayload = {
  wordsChanged?: boolean;
  prayersChanged?: boolean;
  notificationsCount?: number;
};

const EVENT_BUFFER_SIZE = 50;
const cachedEvents: { id: number; data: StreamPayload }[] = [];
let lastEventId = 0;

let latestSnapshot:
  | {
      wordId: string | null;
      wordCreatedAt: number | null;
      prayerId: string | null;
      prayerCreatedAt: number | null;
      notificationsCount: number | null;
    }
  | null = null;
let lastSnapshotAt = 0;
const SNAPSHOT_TTL_MS = 5000;

const pushEvent = (payload: StreamPayload) => {
  lastEventId += 1;
  cachedEvents.push({ id: lastEventId, data: payload });
  if (cachedEvents.length > EVENT_BUFFER_SIZE) {
    cachedEvents.shift();
  }
  return lastEventId;
};

const getCachedEventsAfter = (id: number) =>
  cachedEvents.filter((event) => event.id > id);

const fetchLatestSnapshot = async (excludedUserId: Types.ObjectId | null, userId: string | null) => {
  const now = Date.now();
  if (latestSnapshot && now - lastSnapshotAt < SNAPSHOT_TTL_MS) {
    return latestSnapshot;
  }

  const [latestWord, latestPrayer, notificationsCount] = await Promise.all([
    WordModel.findOne(excludedUserId ? { userId: { $ne: excludedUserId } } : {})
      .sort({ createdAt: -1 })
      .select("_id createdAt")
      .lean(),
    PrayerModel.findOne(excludedUserId ? { userId: { $ne: excludedUserId } } : {})
      .sort({ createdAt: -1 })
      .select("_id createdAt")
      .lean(),
    userId ? NotificationModel.countDocuments({ userId }) : Promise.resolve(null),
  ]);

  latestSnapshot = {
    wordId: latestWord?._id?.toString?.() ?? null,
    wordCreatedAt: latestWord?.createdAt
      ? new Date(latestWord.createdAt).getTime()
      : null,
    prayerId: latestPrayer?._id?.toString?.() ?? null,
    prayerCreatedAt: latestPrayer?.createdAt
      ? new Date(latestPrayer.createdAt).getTime()
      : null,
    notificationsCount:
      typeof notificationsCount === "number" ? notificationsCount : null,
  };
  lastSnapshotAt = now;
  return latestSnapshot;
};

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
  const startEventId = Number.isNaN(Number(startId)) ? 0 : Number(startId);

  const stream = new ReadableStream({
    start(controller) {
      const replay = () => {
        if (!startEventId) return;
        const events = getCachedEventsAfter(startEventId);
        events.forEach((event) => {
          controller.enqueue(
            encoder.encode(`id: ${event.id}\n` + `data: ${JSON.stringify(event.data)}\n\n`)
          );
        });
      };

      const send = async () => {
        try {
          const snapshot = await fetchLatestSnapshot(excludedUserId, userId);
          const nextWordId = snapshot.wordId;
          const nextPrayerId = snapshot.prayerId;
          const nextWordCreatedAt = snapshot.wordCreatedAt;
          const nextPrayerCreatedAt = snapshot.prayerCreatedAt;
          const notificationsCount = snapshot.notificationsCount;

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
            const payload: StreamPayload = {
              wordsChanged,
              prayersChanged,
              notificationsCount:
                typeof notificationsCount === "number"
                  ? notificationsCount
                  : undefined,
            };
            const id = pushEvent(payload);
            controller.enqueue(
              encoder.encode(
                `id: ${id}\n` + `data: ${JSON.stringify(payload)}\n\n`
              )
            );
          }
        } catch {
          // ignore transient errors
        }
      };

      replay();
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
