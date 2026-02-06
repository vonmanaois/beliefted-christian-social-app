"use client";

type ModalProps = {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  align?: "center" | "left";
};

export default function Modal({
  title,
  isOpen,
  onClose,
  children,
  align = "center",
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex bg-black/40 p-4 cursor-pointer ${
        align === "left" ? "items-start justify-start" : "items-center justify-center"
      }`}
      onClick={onClose}
    >
      <div
        className={`panel w-full max-w-md p-6 relative cursor-pointer ${
          align === "left" ? "mt-16" : ""
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 h-9 w-9 rounded-full border border-slate-200 text-[color:var(--subtle)] flex items-center justify-center cursor-pointer"
          aria-label="Close"
        >
          <span className="text-lg">✕</span>
        </button>
        <h3 className="text-lg font-semibold text-[color:var(--ink)]">
          {title}
        </h3>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
