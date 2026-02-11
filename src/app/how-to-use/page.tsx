import HowToUseClient from "@/app/how-to-use/HowToUseClient";

export const metadata = {
  title: "How To Use | Beliefted",
  description: "Learn how to use Beliefted, from journals to faith stories.",
};

export const dynamic = "force-static";

export default function HowToUsePage() {
  return <HowToUseClient />;
}
