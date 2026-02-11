import HowToUseClient from "@/app/how-to-use/HowToUseClient";

export const metadata = {
  title: "How To Download | Beliefted",
  description: "Add Beliefted to your home screen for quick access.",
};

export const dynamic = "force-static";

export default function HowToUsePage() {
  return <HowToUseClient />;
}
