"use client";

type SpinnerProps = {
  size?: number;
  className?: string;
};

export default function Spinner({ size = 16, className }: SpinnerProps) {
  return (
    <span
      className={`inline-flex items-center justify-center ${className ?? ""}`}
      aria-label="Loading"
    >
      <span
        className="block rounded-full border-2 border-[color:var(--panel-border)] border-t-[color:var(--accent)] animate-spin"
        style={{ width: size, height: size }}
      />
    </span>
  );
}
