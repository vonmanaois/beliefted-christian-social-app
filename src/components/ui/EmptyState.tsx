"use client";

type EmptyStateProps = {
  title: string;
  description: string;
  className?: string;
};

export default function EmptyState({ title, description, className }: EmptyStateProps) {
  return (
    <div className={`panel p-6 text-sm text-[color:var(--subtle)] ${className ?? ""}`}>
      <p className="text-[color:var(--ink)] font-semibold">{title}</p>
      <p className="mt-1">{description}</p>
    </div>
  );
}
