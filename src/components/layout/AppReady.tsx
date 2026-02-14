"use client";

import { useEffect } from "react";

export default function AppReady() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("app-ready");
    return () => {
      root.classList.remove("app-ready");
    };
  }, []);

  return null;
}
