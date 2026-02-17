import FaithStoryList from "@/components/faith/FaithStoryList";
import PanelMotion from "@/components/layout/PanelMotion";

export const revalidate = 60;
export const metadata = {
  title: "Faith Stories · Beliefted",
  description:
    "Read faith stories from the community and share how God is moving in your life.",
};

export default function FaithStoriesPage() {
  return (
    <PanelMotion className="panel p-6 sm:p-8 rounded-none">
          <FaithStoryList />
        </PanelMotion>
  );
}
