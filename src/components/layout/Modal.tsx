"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
type ModalProps = {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  align?: "center" | "left";
  backdrop?: "dim" | "clear";
  autoFocus?: boolean;
  lockScroll?: boolean;
};

export default function Modal({
  title,
  isOpen,
  onClose,
  children,
  align = "center",
  backdrop = "dim",
  autoFocus = true,
  lockScroll = true,
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const wasOpenRef = useRef(false);
  const mounted = typeof document !== "undefined";

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    if (lockScroll) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previous;
      };
    }
    return;
  }, [isOpen, lockScroll]);

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (!wasOpenRef.current && autoFocus) {
      timer = setTimeout(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusable = dialog.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        (focusable ?? dialog).focus();
      }, 0);
      wasOpenRef.current = true;
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (timer) clearTimeout(timer);
    };
  }, [isOpen, onClose, autoFocus]);

  if (!isOpen || !mounted) return null;

  const modal = (
    <div
      className={`fixed inset-0 z-[100] flex p-4 cursor-pointer ${
        align === "left" ? "items-start justify-start" : "items-center justify-center"
      } ${backdrop === "dim" ? "bg-black/40" : "bg-transparent"}`}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className={`panel w-full max-w-md p-6 relative cursor-pointer ${
          align === "left" ? "mt-16" : ""
        }`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <button
          type="button"
          onClick={onClose}
          onMouseDown={(event) => event.preventDefault()}
          className="absolute right-4 top-4 h-9 w-9 rounded-full text-[color:var(--subtle)] flex items-center justify-center cursor-pointer pb-5 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 shadow-none appearance-none"
          data-no-focus-ring="true"
          aria-label="Close"
        >
          <span className="text-lg">✕</span>
        </button>
        <h3
          id={titleId}
          className="text-lg font-semibold text-[color:var(--ink)]"
        >
          {title}
        </h3>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
