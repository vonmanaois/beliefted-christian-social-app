export type EventHost = {
  name?: string | null;
  username?: string | null;
  image?: string | null;
};

export type EventItem = {
  _id: string;
  title: string;
  description?: string | null;
  startAt: string | Date;
  endAt?: string | Date | null;
  locationText?: string | null;
  posterImage?: string | null;
  visibility: "public" | "followers" | "private";
  capacity?: number | null;
  goingCount?: number;
  interestedCount?: number;
  host?: EventHost | null;
  isHost?: boolean;
  rsvpStatus?: "going" | "interested" | "not_going" | null;
  inviteStatus?: "pending" | "accepted" | "declined" | null;
};
