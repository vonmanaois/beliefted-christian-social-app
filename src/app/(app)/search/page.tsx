 "use client";

 import { useEffect, useState } from "react";
  import UserSearch from "@/components/layout/UserSearch";

export default function SearchPage() {
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ target?: string }>).detail;
      if (detail?.target === "search") {
        setClosing(true);
      }
    };
    window.addEventListener("panel:close", handler);
    return () => window.removeEventListener("panel:close", handler);
  }, []);

  const panelState = closing
    ? "panel-slide-up-exit"
    : entered
      ? "panel-slide-up-entered"
      : "panel-slide-up-enter";
  return (
    <div className={`panel p-8 rounded-none ${panelState}`}>
          <h1 className="text-xl font-semibold text-[color:var(--ink)]">
            Search
          </h1>
           <p className="mt-1 text-sm text-[color:var(--subtle)]">
             Find people by name or username.
           </p>
           <div className="mt-6">
             <UserSearch />
           </div>
         </div>
  );
}
