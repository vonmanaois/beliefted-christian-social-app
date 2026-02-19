"use client";

import { useEffect } from "react";

export default function PWARegistration() {
  useEffect(() => {
    const allowInDev = process.env.NEXT_PUBLIC_ENABLE_SW === "1";
    if (process.env.NODE_ENV !== "production" && !allowInDev) return;
    if (!("serviceWorker" in navigator)) return;
    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js");
      } catch {
        // ignore registration errors
      }
    };
    register();
  }, []);

  return null;
}
