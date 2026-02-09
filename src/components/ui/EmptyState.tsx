"use client";

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: React.ReactNode;
  className?: string;
};

export default function EmptyState({ title, description, icon, className }: EmptyStateProps) {
  return (
    <div className={`panel p-6 text-sm text-[color:var(--subtle)] ${className ?? ""}`}>
      <div className="flex items-start gap-3">
        {icon ? (
          <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--panel-border)] text-[color:var(--subtle)]">
            {icon}
          </span>
        ) : null}
        <div>
          <p className="text-[color:var(--ink)] font-semibold">{title}</p>
          <p className="mt-1">{description}</p>
        </div>
      </div>
    </div>
  );
}
