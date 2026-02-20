import PanelMotion from "@/components/layout/PanelMotion";
import ProfilePublicClient from "@/components/profile/ProfilePublicClient";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return (
    <PanelMotion className="panel rounded-none p-0 sm:p-8" motion="none">
      <ProfilePublicClient username={username} />
    </PanelMotion>
  );
}
