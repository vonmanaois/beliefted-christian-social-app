import dbConnect from "@/lib/db";
import PrayerModel from "@/models/Prayer";
import WordModel from "@/models/Word";

export async function GET(request: Request) {
  await dbConnect();

  const encoder = new TextEncoder();
  let lastWordId: string | null = null;
  let lastPrayerId: string | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = async () => {
        try {
          const [latestWord, latestPrayer] = await Promise.all([
            WordModel.findOne({})
              .sort({ createdAt: -1 })
              .select("_id createdAt")
              .lean(),
            PrayerModel.findOne({})
              .sort({ createdAt: -1 })
              .select("_id createdAt")
              .lean(),
          ]);

          const nextWordId = latestWord?._id?.toString?.() ?? null;
          const nextPrayerId = latestPrayer?._id?.toString?.() ?? null;

          const wordsChanged = nextWordId && nextWordId !== lastWordId;
          const prayersChanged = nextPrayerId && nextPrayerId !== lastPrayerId;

          if (wordsChanged || prayersChanged) {
            lastWordId = nextWordId;
            lastPrayerId = nextPrayerId;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  wordsChanged,
                  prayersChanged,
                })}\n\n`
              )
            );
          }
        } catch {
          // ignore transient errors
        }
      };

      send();

      const interval = setInterval(send, 30000);

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
