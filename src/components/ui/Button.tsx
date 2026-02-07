"use client";

import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "solid" | "outline" | "ghost";
type ButtonSize = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const base =
  "inline-flex items-center justify-center font-semibold transition active:translate-y-[1px] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--panel)]";

const variants: Record<ButtonVariant, string> = {
  solid: "bg-[color:var(--accent)] text-[color:var(--accent-contrast)]",
  outline:
    "border border-[color:var(--panel-border)] text-[color:var(--ink)] hover:text-[color:var(--accent)]",
  ghost: "text-[color:var(--ink)] hover:text-[color:var(--accent)]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "rounded-lg px-3 py-2 text-xs",
  md: "rounded-xl px-4 py-2 text-sm",
};

export default function Button({
  variant = "solid",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    />
  );
}
