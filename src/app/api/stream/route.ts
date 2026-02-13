import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import NotificationModel from "@/models/Notification";
import PrayerModel from "@/models/Prayer";
import WordModel from "@/models/Word";
import UserModel from "@/models/User";
import { Types } from "mongoose";

type StreamPayload = {
  wordsChanged?: boolean;
  prayersChanged?: boolean;
  wordAuthorId?: string | null;
  prayerAuthorId?: string | null;
  wordAuthorIds?: string[];
  prayerAuthorIds?: string[];
  notificationsCount?: number;
  viewerId?: string | null;
};

const EVENT_BUFFER_SIZE = 50;
const cachedEvents: { id: number; data: StreamPayload }[] = [];
let lastEventId = 0;

let latestSnapshot:
  | {
      wordIds: string[];
      wordAuthorId: string | null;
      wordAuthorIds: string[];
      wordLatestAt: number | null;
      prayerIds: string[];
      prayerAuthorId: string | null;
      prayerAuthorIds: string[];
      prayerLatestAt: number | null;
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

const pushReplayableEvent = (payload: StreamPayload) => {
  const { notificationsCount, viewerId, ...replayable } = payload;
  void notificationsCount;
  void viewerId;
  return pushEvent(replayable);
};

const getCachedEventsAfter = (id: number) =>
  cachedEvents.filter((event) => event.id > id);

const fetchLatestSnapshot = async (excludedUserId: Types.ObjectId | null, userId: string | null) => {
  const now = Date.now();
  if (latestSnapshot && now - lastSnapshotAt < SNAPSHOT_TTL_MS) {
    return latestSnapshot;
  }

  let followingIds: Types.ObjectId[] = [];
  if (userId && Types.ObjectId.isValid(userId)) {
    const viewer = await UserModel.findById(userId).select("following").lean();
    const rawFollowing = Array.isArray(viewer?.following) ? viewer.following : [];
    followingIds = rawFollowing
      .map((id) => (typeof id === "string" ? new Types.ObjectId(id) : id))
      .filter(Boolean);
  }
  const visibilityFilter = {
    $or: [
      { privacy: "public" },
      { privacy: { $exists: false } },
      ...(followingIds.length
        ? [{ privacy: "followers", userId: { $in: followingIds } }]
        : []),
    ],
  };
  const exclusionFilter = excludedUserId ? { userId: { $ne: excludedUserId } } : {};
  const combinedFilter = { $and: [visibilityFilter, exclusionFilter] };

  const [latestWords, latestPrayers, notificationsCount] = await Promise.all([
    WordModel.find(combinedFilter)
      .sort({ createdAt: -1, _id: -1 })
      .select("_id userId createdAt")
      .limit(3)
      .lean(),
    PrayerModel.find(combinedFilter)
      .sort({ createdAt: -1, _id: -1 })
      .select("_id userId createdAt")
      .limit(3)
      .lean(),
    userId ? NotificationModel.countDocuments({ userId }) : Promise.resolve(null),
  ]);

  const wordIds = Array.isArray(latestWords)
    ? latestWords.map((item) => item._id.toString())
    : [];
  const prayerIds = Array.isArray(latestPrayers)
    ? latestPrayers.map((item) => item._id.toString())
    : [];
  const wordAuthorIds = Array.isArray(latestWords)
    ? latestWords
        .map((item) => item.userId?.toString?.() ?? null)
        .filter((id): id is string => Boolean(id))
    : [];
  const prayerAuthorIds = Array.isArray(latestPrayers)
    ? latestPrayers
        .map((item) => item.userId?.toString?.() ?? null)
        .filter((id): id is string => Boolean(id))
    : [];
  const topWord = Array.isArray(latestWords) ? latestWords[0] : null;
  const topPrayer = Array.isArray(latestPrayers) ? latestPrayers[0] : null;
  const wordLatestAt = topWord?.createdAt
    ? new Date(topWord.createdAt).getTime()
    : null;
  const prayerLatestAt = topPrayer?.createdAt
    ? new Date(topPrayer.createdAt).getTime()
    : null;

  latestSnapshot = {
    wordIds,
    wordAuthorId: topWord?.userId?.toString?.() ?? null,
    wordAuthorIds,
    wordLatestAt,
    prayerIds,
    prayerAuthorId: topPrayer?.userId?.toString?.() ?? null,
    prayerAuthorIds,
    prayerLatestAt,
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
  let lastWordIds: string[] | null = null;
  let lastPrayerIds: string[] | null = null;
  let lastWordLatestAt: number | null = null;
  let lastPrayerLatestAt: number | null = null;
  let lastNotificationsCount: number | null = null;
  let lastEmitAt = 0;
  const minEmitIntervalMs = 5000;
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
          const nextWordIds = snapshot.wordIds;
          const nextPrayerIds = snapshot.prayerIds;
          const nextWordAuthorId = snapshot.wordAuthorId;
          const nextPrayerAuthorId = snapshot.prayerAuthorId;
          const nextWordAuthorIds = snapshot.wordAuthorIds ?? [];
          const nextPrayerAuthorIds = snapshot.prayerAuthorIds ?? [];
          const nextWordLatestAt = snapshot.wordLatestAt ?? null;
          const nextPrayerLatestAt = snapshot.prayerLatestAt ?? null;
          const notificationsCount = snapshot.notificationsCount;

          let wordsChanged =
            typeof nextWordLatestAt === "number" &&
            typeof lastWordLatestAt === "number" &&
            nextWordLatestAt > lastWordLatestAt;
          let prayersChanged =
            typeof nextPrayerLatestAt === "number" &&
            typeof lastPrayerLatestAt === "number" &&
            nextPrayerLatestAt > lastPrayerLatestAt;
          let notificationsChanged = Boolean(
            typeof notificationsCount === "number" &&
              notificationsCount !== lastNotificationsCount
          );

          if (lastWordIds === null && nextWordIds.length) {
            lastWordIds = nextWordIds;
            wordsChanged = false;
          }
          if (lastWordLatestAt === null && typeof nextWordLatestAt === "number") {
            lastWordLatestAt = nextWordLatestAt;
            wordsChanged = false;
          }
          if (lastPrayerIds === null && nextPrayerIds.length) {
            lastPrayerIds = nextPrayerIds;
            prayersChanged = false;
          }
          if (
            lastPrayerLatestAt === null &&
            typeof nextPrayerLatestAt === "number"
          ) {
            lastPrayerLatestAt = nextPrayerLatestAt;
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
              lastWordIds = nextWordIds;
              lastWordLatestAt = nextWordLatestAt;
            }
            if (prayersChanged) {
              lastPrayerIds = nextPrayerIds;
              lastPrayerLatestAt = nextPrayerLatestAt;
            }
            if (notificationsChanged) {
              lastNotificationsCount = notificationsCount;
            }
            const payload: StreamPayload = {};
            if (wordsChanged) {
              payload.wordsChanged = true;
              payload.wordAuthorId = nextWordAuthorId ?? null;
              payload.wordAuthorIds = nextWordAuthorIds;
            }
            if (prayersChanged) {
              payload.prayersChanged = true;
              payload.prayerAuthorId = nextPrayerAuthorId ?? null;
              payload.prayerAuthorIds = nextPrayerAuthorIds;
            }
            if (notificationsChanged && typeof notificationsCount === "number") {
              payload.notificationsCount = notificationsCount;
            }
            payload.viewerId = userId ?? null;
            if (Object.keys(payload).length === 0) {
              return;
            }
            const id = pushReplayableEvent(payload);
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

      const heartbeat = () => {
        controller.enqueue(encoder.encode(`event: ping\ndata: ${Date.now()}\n\n`));
      };

      replay();
      send();

      const interval = setInterval(send, 5000);
      const heartbeatInterval = setInterval(heartbeat, 25000);

      const close = () => {
        clearInterval(interval);
        clearInterval(heartbeatInterval);
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
      "X-Accel-Buffering": "no",
    },
  });
}
