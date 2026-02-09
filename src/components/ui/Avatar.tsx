"use client";

import Image from "next/image";
import Link from "next/link";
import UserIcon from "@/components/ui/UserIcon";
import { cloudinaryTransform } from "@/lib/cloudinary";

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
  const isDataUrl = Boolean(src && src.startsWith("data:image/"));
  const resolvedSrc =
    src && !isDataUrl ? cloudinaryTransform(src, { width: size, height: size }) : src;
  const content = src ? (
    isDataUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover rounded-full"
      />
    ) : (
      <Image
        src={resolvedSrc ?? ""}
        alt={alt}
        width={size}
        height={size}
        sizes={`${size}px`}
        className="h-full w-full object-cover rounded-full"
      />
    )
  ) : fallback ? (
    <span className="text-[11px] font-semibold text-slate-500">{fallback}</span>
  ) : (
    <UserIcon size={Math.round(size * 0.95)} />
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
