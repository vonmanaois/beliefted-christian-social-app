"use client";

import { useEffect } from "react";

export default function PWARegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
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
