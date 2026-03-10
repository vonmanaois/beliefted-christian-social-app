import type { Metadata } from "next";
import EventDetail from "@/components/events/EventDetail";
import dbConnect from "@/lib/db";
import EventModel from "@/models/Event";
import UserModel from "@/models/User";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  await dbConnect();
  const event = await EventModel.findById(id).lean();
  if (!event) {
    return {
      title: "Event",
      description: "Beliefted events",
    };
  }
  const host = event.hostId
    ? await UserModel.findById(event.hostId).select("username").lean()
    : null;
  const title = event.title ?? "Event";
  const description = event.description ?? "Beliefted event";
  const poster = event.posterImage ?? null;
  const url = host?.username ? `/events/${event._id}` : `/events/${event._id}`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      images: poster ? [{ url: poster }] : [],
    },
    twitter: {
      card: poster ? "summary_large_image" : "summary",
      title,
      description,
      images: poster ? [poster] : [],
    },
  };
}

export default function EventDetailPage() {
  return (
    <div className="px-4 sm:px-6 py-6">
      <EventDetail />
    </div>
  );
}
