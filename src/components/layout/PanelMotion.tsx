"use client";

import { useEffect, useState } from "react";

type PanelMotionProps = {
  className?: string;
  children: React.ReactNode;
  motion?: "up" | "down" | "left" | "right" | "none";
};

export default function PanelMotion({
  className = "",
  children,
  motion = "up",
}: PanelMotionProps) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (motion === "none") return;
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [motion]);

  if (motion === "none") {
    return <div className={className}>{children}</div>;
  }

  const base = motion === "left"
    ? "panel-slide-left"
    : motion === "right"
      ? "panel-slide-right"
      : motion === "down"
        ? "panel-slide-down"
        : "panel-slide-up";
  const panelState = entered ? `${base}-entered` : `${base}-enter`;

  return <div className={`${className} ${panelState}`}>{children}</div>;
}
