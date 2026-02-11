import Sidebar from "@/components/layout/Sidebar";
import PanelMotion from "@/components/layout/PanelMotion";
import WhyBelieftedContent from "@/components/info/WhyBelieftedContent";

export const dynamic = "force-static";

export default function WhyBelieftedPage() {
  return (
    <main className="container">
      <div className="page-grid">
        <Sidebar />
        <PanelMotion className="panel p-8 rounded-none">
          <WhyBelieftedContent />
        </PanelMotion>
      </div>
    </main>
  );
}
