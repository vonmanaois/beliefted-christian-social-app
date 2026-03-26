import FcmTokenModel from "@/models/FcmToken";
import { getAdminMessaging } from "@/lib/firebaseAdmin";

type FcmPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
};

export const sendFcmToUser = async (userId: string, payload: FcmPayload) => {
  const tokens = await FcmTokenModel.find({ userId }).lean();
  if (!tokens.length) return;

  const messaging = getAdminMessaging();
  if (!messaging) return;
  await Promise.all(
    tokens.map(async (tokenDoc) => {
      try {
        await messaging.send({
          token: tokenDoc.token,
          data: {
            title: payload.title,
            body: payload.body,
            url: payload.url ?? "/",
            tag: payload.tag ?? "beliefted-activity",
            icon: payload.icon ?? "/sheep-home-512.png",
            badge: payload.badge ?? "/notification-badge.svg",
          },
          webpush: {
            headers: {
              Urgency: "high",
            },
            fcmOptions: {
              link: payload.url ?? "/",
            },
            notification: {
              title: payload.title,
              body: payload.body,
              icon: payload.icon ?? "/sheep-home-512.png",
              badge: payload.badge ?? "/notification-badge.svg",
              tag: payload.tag ?? "beliefted-activity",
              renotify: true,
              requireInteraction: false,
              timestamp: Date.now(),
              vibrate: [120, 60, 120],
            },
          },
        });
      } catch (error) {
        const maybeError = error as { code?: string } | null;
        const code = maybeError?.code;
        if (code === "messaging/registration-token-not-registered") {
          await FcmTokenModel.deleteOne({ token: tokenDoc.token });
        }
      }
    })
  );
};

export type { FcmPayload };
