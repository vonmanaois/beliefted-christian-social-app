"use client";

import Image from "next/image";
import Link from "next/link";

type AvatarProps = {
  src?: string | null;
  alt: string;
  size: number;
  href?: string;
  fallback: string;
  className?: string;
};

export default function Avatar({
  src,
  alt,
  size,
  href,
  fallback,
  className,
}: AvatarProps) {
  const content = src ? (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      sizes={`${size}px`}
      className="h-full w-full object-cover rounded-full"
    />
  ) : (
    fallback
  );

  const baseClass = `rounded-full bg-slate-200 overflow-hidden flex items-center justify-center font-semibold text-slate-500 ${className ?? ""}`;

  if (href) {
    return (
      <Link href={href} className={baseClass}>
        {content}
      </Link>
    );
  }

  return <div className={baseClass}>{content}</div>;
}
