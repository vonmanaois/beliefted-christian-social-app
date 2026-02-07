import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import Sidebar from "@/components/layout/Sidebar";
import clientPromise from "@/lib/mongodb";

const DEFAULT_ADMIN_EMAIL = "von.manaois@gmail.com";

type SummaryRow = {
  _id: { day: string; event: string };
  count: number;
};

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions);
  const adminEmail = process.env.ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL;

  if (!session?.user?.email || session.user.email !== adminEmail) {
    redirect("/");
  }

  const client = await clientPromise;
  const db = client.db();

  const headerList = await headers();
  const requestUrl = headerList.get("x-url");
  const daysParam = requestUrl
    ? new URL(requestUrl).searchParams.get("days")
    : null;
  const rangeDays = daysParam === "30" ? 30 : 7;
  const start = new Date();
  start.setDate(start.getDate() - (rangeDays - 1));
  start.setHours(0, 0, 0, 0);

  const pipeline = [
    { $match: { createdAt: { $gte: start } } },
    {
      $group: {
        _id: {
          day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          event: "$event",
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.day": 1 } },
  ];

  const rows = (await db
    .collection("analytics_events")
    .aggregate(pipeline)
    .toArray()) as SummaryRow[];

  const events = [
    "prayer_posted",
    "word_posted",
    "prayed",
    "word_liked",
    "followed",
  ];

  const byDay: Record<string, Record<string, number>> = {};
  rows.forEach((row) => {
    const day = row._id.day;
    if (!byDay[day]) byDay[day] = {};
    byDay[day][row._id.event] = row.count;
  });

  const days: string[] = [];
  const cursor = new Date(start);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  while (cursor <= today) {
    const label = cursor.toISOString().slice(0, 10);
    days.push(label);
    cursor.setDate(cursor.getDate() + 1);
  }

  const getSeries = (event: string) =>
    days.map((day) => byDay[day]?.[event] ?? 0);

  const formatDay = (day: string) => {
    const [, month, date] = day.split("-");
    return `${month}/${date}`;
  };

  const sparkline = (values: number[]) => {
    const width = 140;
    const height = 36;
    const max = Math.max(1, ...values);
    const points = values
      .map((value, index) => {
        const x = (index / Math.max(1, values.length - 1)) * width;
        const y = height - (value / max) * height;
        return `${x},${y}`;
      })
      .join(" ");
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-9 w-full text-[color:var(--accent)]"
        aria-hidden="true"
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          points={points}
        />
      </svg>
    );
  };

  return (
    <main className="container">
      <div className="page-grid">
        <Sidebar />
        <div className="panel p-8 rounded-none">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-[color:var(--ink)]">
                Analytics
              </h1>
              <p className="mt-1 text-sm text-[color:var(--subtle)]">
                Last {rangeDays} days activity.
              </p>
            </div>
            <div className="inline-flex rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] p-1 text-xs font-semibold">
              <Link
                href="/analytics?days=7"
                className={`rounded-lg px-3 py-1.5 ${
                  rangeDays === 7
                    ? "bg-[color:var(--accent)] text-[color:var(--accent-contrast)]"
                    : "text-[color:var(--ink)] hover:text-[color:var(--accent)]"
                }`}
              >
                7 days
              </Link>
              <Link
                href="/analytics?days=30"
                className={`rounded-lg px-3 py-1.5 ${
                  rangeDays === 30
                    ? "bg-[color:var(--accent)] text-[color:var(--accent-contrast)]"
                    : "text-[color:var(--ink)] hover:text-[color:var(--accent)]"
                }`}
              >
                30 days
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {events.map((event) => {
              const series = getSeries(event);
              const total = series.reduce((sum, value) => sum + value, 0);
              return (
                <div
                  key={event}
                  className="panel p-4 rounded-none border border-[color:var(--panel-border)]"
                >
                  <div className="flex items-center justify-between text-xs text-[color:var(--subtle)]">
                    <span className="uppercase tracking-[0.12em]">
                      {event.replace("_", " ")}
                    </span>
                    <span className="text-[color:var(--ink)] font-semibold">
                      {total}
                    </span>
                  </div>
                  <div className="mt-3">{sparkline(series)}</div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[color:var(--subtle)]">
                  <th className="py-2">Day</th>
                  {events.map((event) => (
                    <th key={event} className="py-2 capitalize">
                      {event.replace("_", " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((day) => (
                  <tr key={day} className="border-t border-[color:var(--panel-border)]">
                    <td className="py-2 font-semibold text-[color:var(--ink)]">
                      {formatDay(day)}
                    </td>
                    {events.map((event) => (
                      <td key={event} className="py-2 text-[color:var(--ink)]">
                        {byDay[day]?.[event] ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
                {days.length === 0 && (
                  <tr>
                    <td
                      colSpan={events.length + 1}
                      className="py-6 text-[color:var(--subtle)]"
                    >
                      No analytics yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
