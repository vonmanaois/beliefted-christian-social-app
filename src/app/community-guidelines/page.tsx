import Sidebar from "@/components/layout/Sidebar";
import PanelMotion from "@/components/layout/PanelMotion";
import CommunityGuidelinesContent from "@/components/info/CommunityGuidelinesContent";

export const dynamic = "force-static";

export default function CommunityGuidelinesPage() {
  return (
    <main className="container">
      <div className="page-grid">
        <Sidebar />
        <PanelMotion className="panel p-6 sm:p-8">
          <CommunityGuidelinesContent />
        </PanelMotion>
      </div>
    </main>
  );
}
