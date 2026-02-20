import PostDetailCached from "@/components/post/PostDetailCached";
import PostDetailOverlay from "@/components/post/PostDetailOverlay";

type PageProps = {
  params: Promise<{ postId: string }>;
};

export default async function PostDetailModal({ params }: PageProps) {
  const { postId } = await params;

  return (
    <PostDetailOverlay>
      <PostDetailCached postId={postId} />
    </PostDetailOverlay>
  );
}
