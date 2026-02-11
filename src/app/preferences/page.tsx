import Sidebar from "@/components/layout/Sidebar";
import PanelMotion from "@/components/layout/PanelMotion";
import PreferencesPanel from "@/components/preferences/PreferencesPanel";

export default function PreferencesPage() {
  return (
    <main className="container">
      <div className="page-grid">
        <Sidebar />
        <PanelMotion className="panel p-6 sm:p-8">
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-xl font-semibold text-[color:var(--ink)]">Preferences</h1>
              <p className="mt-2 text-sm text-[color:var(--subtle)]">
                Manage your theme and account settings.
              </p>
            </div>
            <PreferencesPanel />
          </div>
        </PanelMotion>
      </div>
    </main>
  );
}
