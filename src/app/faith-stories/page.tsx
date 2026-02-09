import Sidebar from "@/components/layout/Sidebar";
import FaithStoryList from "@/components/faith/FaithStoryList";

export default function FaithStoriesPage() {
  return (
    <main className="container">
      <div className="page-grid">
        <Sidebar />
        <div className="panel p-6 sm:p-8 rounded-none">
          <FaithStoryList />
        </div>
      </div>
    </main>
  );
}
