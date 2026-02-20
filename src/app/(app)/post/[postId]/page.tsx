import PostDetail from "@/components/post/PostDetail";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ postId: string }>;
};

export default async function PostDetailPage({ params }: PageProps) {
  const { postId } = await params;

  return <PostDetail username="post" postId={postId} />;
}
