export type WordUser = {
  name?: string | null;
  image?: string | null;
  username?: string | null;
};

export type Word = {
  _id: string | { $oid?: string };
  content: string;
  createdAt: string | Date;
  likedBy?: string[];
  savedBy?: string[];
  commentCount?: number;
  user?: WordUser | null;
  userId?: string | null;
  isOwner?: boolean;
  scriptureRef?: string | null;
  images?: string[];
  imageOrientations?: ("portrait" | "landscape")[];
  privacy?: "public" | "followers" | "private";
  sharedFaithStoryId?: string | null;
  sharedFaithStory?: {
    id: string;
    title: string;
    coverImage?: string | null;
    authorUsername?: string | null;
  } | null;
};

export type CommentUser = {
  _id?: string | null;
  name?: string | null;
  image?: string | null;
  username?: string | null;
};

export type WordCommentData = {
  _id: string;
  content: string;
  createdAt: string;
  userId?: CommentUser | null;
};
