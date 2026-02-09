import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import JournalModel from "@/models/Journal";
import Sidebar from "@/components/layout/Sidebar";
import JournalDetail from "@/components/journal/JournalDetail";
import { Types } from "mongoose";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function JournalDetailPage({ params }: PageProps) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/");
  }

  await dbConnect();
  const journal = await JournalModel.findById(id).lean();
  if (!journal) {
    notFound();
  }

  if (journal.userId.toString() !== session.user.id) {
    redirect("/journal");
  }

  return (
    <main className="container">
      <div className="page-grid">
        <Sidebar />
        <div>
          <JournalDetail
            journal={{
              _id: journal._id.toString(),
              title: journal.title,
              content: journal.content,
              createdAt: journal.createdAt.toISOString(),
            }}
          />
        </div>
      </div>
    </main>
  );
}
