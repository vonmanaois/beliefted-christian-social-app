import Sidebar from "@/components/layout/Sidebar";
import PanelMotion from "@/components/layout/PanelMotion";

export const dynamic = "force-static";

export default function CommunityGuidelinesPage() {
  return (
    <main className="container">
      <div className="page-grid">
        <Sidebar />
        <PanelMotion className="panel p-6 sm:p-8">
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-xl font-semibold text-[color:var(--ink)]">Community Guidelines</h1>
              <p className="mt-2 text-sm text-[color:var(--subtle)]">
                Beliefted is a safe, respectful place for Christians to share prayer and encouragement.
              </p>
            </div>

            <div className="space-y-4 text-sm text-[color:var(--ink)] leading-relaxed">
              <p>
                Please post with love, humility, and truth. We’re here to support one another in faith and keep the
                atmosphere peaceful.
              </p>
              <div>
                <p className="font-semibold text-[color:var(--ink)]">We don’t allow:</p>
                <ul className="mt-2 list-disc pl-5 space-y-1 text-[color:var(--subtle)]">
                  <li>Selling, fundraising, or solicitation</li>
                  <li>Asking for money or donations</li>
                  <li>False teaching, deception, or manipulation</li>
                  <li>Shaming, guilt-tripping, or spiritual pressure</li>
                  <li>Hateful, harmful, or divisive content</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-[color:var(--ink)]">We’re here to:</p>
                <ul className="mt-2 list-disc pl-5 space-y-1 text-[color:var(--subtle)]">
                  <li>Pray for one another</li>
                  <li>Encourage faith and hope</li>
                  <li>Share God’s Word with respect</li>
                </ul>
              </div>
              <p className="text-[color:var(--subtle)]">
                Posts that violate these guidelines may be removed to protect the community.
              </p>
            </div>
          </div>
        </PanelMotion>
      </div>
    </main>
  );
}
