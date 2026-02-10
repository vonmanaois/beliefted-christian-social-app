"use client";

import { useEffect, useState } from "react";

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[60] bg-[color:var(--danger)] text-white text-xs sm:text-sm px-4 py-2 text-center">
      You’re offline. Some actions may not work until you reconnect.
    </div>
  );
}
