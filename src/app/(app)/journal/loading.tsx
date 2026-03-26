export default function JournalLoading() {
  return (
    <div className="panel p-6 sm:p-8 rounded-none">
      <div className="animate-pulse space-y-4">
        <div className="h-7 w-36 rounded-lg bg-[color:var(--surface-strong)]" />
        <div className="h-4 w-48 rounded-lg bg-[color:var(--surface-strong)]" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="h-[180px] rounded-2xl bg-[color:var(--surface-strong)]" />
          <div className="h-[180px] rounded-2xl bg-[color:var(--surface-strong)]" />
          <div className="h-[180px] rounded-2xl bg-[color:var(--surface-strong)]" />
          <div className="h-[180px] rounded-2xl bg-[color:var(--surface-strong)]" />
        </div>
      </div>
    </div>
  );
}
