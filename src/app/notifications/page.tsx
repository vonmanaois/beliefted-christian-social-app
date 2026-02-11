 "use client";

 import { useEffect, useState } from "react";
 import Sidebar from "@/components/layout/Sidebar";
 import NotificationsContent from "@/components/notifications/NotificationsContent";

export default function NotificationsPage() {
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);


   useEffect(() => {
     const handler = (event: Event) => {
       const detail = (event as CustomEvent<{ target?: string }>).detail;
       if (detail?.target === "notifications") {
         setClosing(true);
       }
     };
     window.addEventListener("panel:close", handler);
     return () => window.removeEventListener("panel:close", handler);
   }, []);

  const panelState = closing
    ? "panel-slide-right-exit"
    : entered
      ? "panel-slide-right-entered"
      : "panel-slide-right-enter";

  useEffect(() => {
    document.documentElement.classList.add("notifications-open");
    return () => {
      document.documentElement.classList.remove("notifications-open");
    };
  }, []);

  return (
    <main className="container notifications-page">
      <div className="page-grid">
        <Sidebar />
        <div className={`panel p-8 rounded-none ${panelState} panel-scroll-mobile`}>
          <NotificationsContent />
        </div>
      </div>
    </main>
  );
}
