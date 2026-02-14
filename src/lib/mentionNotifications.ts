import NotificationModel from "@/models/Notification";
import UserModel from "@/models/User";
import { extractMentions } from "@/lib/mentions";

type MentionPayload = {
  text: string;
  actorId: string;
  wordId?: string;
  prayerId?: string;
  faithStoryId?: string;
};

export const notifyMentions = async ({
  text,
  actorId,
  wordId,
  prayerId,
  faithStoryId,
}: MentionPayload) => {
  const mentions = extractMentions(text);
  if (!mentions.length) return;

  const users = await UserModel.find({ username: { $in: mentions } })
    .select("_id username")
    .lean();
  if (!users.length) return;

  const notifications = users
    .filter((user) => String(user._id) !== String(actorId))
    .map((user) => ({
      userId: user._id,
      actorId,
      type: "mention",
      wordId: wordId ?? undefined,
      prayerId: prayerId ?? undefined,
      faithStoryId: faithStoryId ?? undefined,
    }));

  if (!notifications.length) return;

  await NotificationModel.insertMany(notifications, { ordered: false });
};
