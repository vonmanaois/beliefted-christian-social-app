"use client";

import { useEffect, useState } from "react";

type PanelMotionProps = {
  className?: string;
  children: React.ReactNode;
};

export default function PanelMotion({ className = "", children }: PanelMotionProps) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const panelState = entered ? "panel-slide-up-entered" : "panel-slide-up-enter";

  return <div className={`${className} ${panelState}`}>{children}</div>;
}
