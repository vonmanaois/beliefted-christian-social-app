export type PrayerUser = {
  name?: string | null;
  image?: string | null;
  username?: string | null;
};

export type Prayer = {
  _id: string | { $oid?: string };
  content: string;
  heading?: string | null;
  kind?: "prayer" | "request";
  prayerPoints?: { title: string; description: string }[];
  scriptureRef?: string | null;
  createdAt: string | Date;
  isAnonymous: boolean;
  prayedBy: string[];
  commentCount?: number;
  user?: PrayerUser | null;
  userId?: string;
  isOwner?: boolean;
  privacy?: "public" | "followers" | "private";
};

export type CommentUser = {
  _id?: string | null;
  name?: string | null;
  image?: string | null;
  username?: string | null;
};

export type PrayerComment = {
  _id: string;
  content: string;
  createdAt: string;
  userId?: CommentUser | null;
};
