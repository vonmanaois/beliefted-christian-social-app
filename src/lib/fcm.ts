import FcmTokenModel from "@/models/FcmToken";
import { getAdminMessaging } from "@/lib/firebaseAdmin";

type FcmPayload = {
  title: string;
  body: string;
  url?: string;
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
