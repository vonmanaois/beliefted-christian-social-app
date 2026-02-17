import PanelMotion from "@/components/layout/PanelMotion";

export default function ProfileLoading() {
  return (
    <PanelMotion className="panel rounded-none p-0 sm:p-8" motion="none">
      <div className="px-4 pt-6 sm:px-0 sm:pt-0">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-5 w-40 rounded-full bg-[color:var(--panel-border)]/60" />
            <div className="h-4 w-24 rounded-full bg-[color:var(--panel-border)]/40" />
            <div className="h-4 w-56 rounded-full bg-[color:var(--panel-border)]/40" />
          </div>
          <div className="h-20 w-20 shrink-0 rounded-full bg-[color:var(--panel-border)]/50" />
        </div>
        <div className="mt-4 h-10 w-full rounded-full bg-[color:var(--panel-border)]/40" />
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="h-10 rounded-xl bg-[color:var(--panel-border)]/40" />
          <div className="h-10 rounded-xl bg-[color:var(--panel-border)]/40" />
          <div className="h-10 rounded-xl bg-[color:var(--panel-border)]/40" />
        </div>
        <div className="my-6 border-t border-[color:var(--panel-border)]" />
      </div>
      <div className="px-4 pb-6 sm:px-0">
        <div className="h-10 w-full rounded-xl bg-[color:var(--panel-border)]/40" />
        <div className="mt-4 space-y-3">
          <div className="h-24 w-full rounded-2xl bg-[color:var(--panel-border)]/30" />
          <div className="h-24 w-full rounded-2xl bg-[color:var(--panel-border)]/30" />
          <div className="h-24 w-full rounded-2xl bg-[color:var(--panel-border)]/30" />
        </div>
      </div>
    </PanelMotion>
  );
}
