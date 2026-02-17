import PostDetail from "@/components/post/PostDetail";

type PageProps = {
  params: Promise<{ username: string; postId: string }>;
};

export default async function PostDetailPage({ params }: PageProps) {
  const { username, postId } = await params;
  return (
    <PostDetail username={username} postId={postId} />
  );
}
