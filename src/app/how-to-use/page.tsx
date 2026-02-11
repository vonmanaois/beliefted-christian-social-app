import Sidebar from "@/components/layout/Sidebar";
import PanelMotion from "@/components/layout/PanelMotion";
import HowToDownloadContent from "@/components/info/HowToDownloadContent";

export const metadata = {
  title: "How To Download | Beliefted",
  description: "Add Beliefted to your home screen for quick access.",
};

export const dynamic = "force-static";

export default function HowToUsePage() {
  return (
    <main className="container">
      <div className="page-grid">
        <Sidebar />
        <PanelMotion className="panel p-8 rounded-none panel-scroll-mobile">
          <HowToDownloadContent />
        </PanelMotion>
      </div>
    </main>
  );
}
