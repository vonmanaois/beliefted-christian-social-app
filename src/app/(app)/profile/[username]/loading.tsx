export default function ProfileLoading() {
  return (
    <div className="panel rounded-none p-4 sm:p-8 animate-pulse">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-6 w-40 rounded-lg bg-[color:var(--surface-strong)]" />
          <div className="h-4 w-28 rounded-lg bg-[color:var(--surface-strong)]" />
        </div>
        <div className="h-20 w-20 rounded-full bg-[color:var(--surface-strong)]" />
      </div>
      <div className="mt-4 h-10 w-full rounded-xl bg-[color:var(--surface-strong)]" />
      <div className="mt-4 h-20 w-full rounded-xl bg-[color:var(--surface-strong)]" />
      <div className="my-6 h-px w-full bg-[color:var(--panel-border)]" />
      <div className="space-y-3">
        <div className="h-6 w-48 rounded-lg bg-[color:var(--surface-strong)]" />
        <div className="h-6 w-40 rounded-lg bg-[color:var(--surface-strong)]" />
      </div>
    </div>
  );
}
