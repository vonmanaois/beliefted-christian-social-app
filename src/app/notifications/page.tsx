 "use client";

 import { useEffect, useState } from "react";
 import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
 import { signIn, useSession } from "next-auth/react";
 import Sidebar from "@/components/layout/Sidebar";
 import EmptyState from "@/components/ui/EmptyState";
 import { BellSimple } from "@phosphor-icons/react";

 type NotificationActor = { name?: string | null; image?: string | null };
 type NotificationItem = {
   _id: string;
   type: "pray" | "comment" | "word_like" | "word_comment" | "follow";
   createdAt: string;
   actorId?: NotificationActor | null;
   prayerId?: { content?: string } | null;
   wordId?: { content?: string } | null;
 };

export default function NotificationsPage() {
   const [entered, setEntered] = useState(false);
   const [closing, setClosing] = useState(false);
   const { status } = useSession();
   const isAuthenticated = status === "authenticated";
   const queryClient = useQueryClient();

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
     ? "panel-slide-up-exit"
     : entered
       ? "panel-slide-up-entered"
       : "panel-slide-up-enter";

   const { data: notifications = [], isLoading } = useQuery({
     queryKey: ["notifications"],
     queryFn: async () => {
       const response = await fetch("/api/notifications", { cache: "no-store" });
       if (!response.ok) {
         throw new Error("Failed to load notifications");
       }
       return (await response.json()) as NotificationItem[];
     },
     enabled: isAuthenticated,
   });

   const clearMutation = useMutation({
     mutationFn: async () => {
       const response = await fetch("/api/notifications", { method: "DELETE" });
       if (!response.ok) {
         throw new Error("Failed to clear notifications");
       }
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["notifications"] });
       queryClient.invalidateQueries({ queryKey: ["notifications", "count"] });
     },
   });

   return (
     <main className="container">
       <div className="page-grid">
         <Sidebar />
         <div className={`panel p-8 rounded-none ${panelState}`}>
           <div className="flex flex-wrap items-center justify-between gap-3">
             <div>
               <h1 className="text-xl font-semibold text-[color:var(--ink)]">
                 Notifications
               </h1>
               <p className="mt-1 text-sm text-[color:var(--subtle)]">
                 Stay updated when someone interacts with your prayers or words.
               </p>
             </div>
             {isAuthenticated && notifications.length > 0 && (
               <button
                 type="button"
                 onClick={() => clearMutation.mutate()}
                 className="post-button bg-transparent border border-[color:var(--panel-border)] text-[color:var(--ink)]"
               >
                 Clear all
               </button>
             )}
           </div>

           {!isAuthenticated ? (
             <div className="mt-6 panel p-4 text-sm text-[color:var(--subtle)]">
               <p className="text-[color:var(--ink)] font-semibold">
                 Sign in to see notifications.
               </p>
               <button
                 type="button"
                 onClick={() => signIn("google")}
                 className="mt-4 pill-button bg-slate-900 text-white cursor-pointer inline-flex items-center gap-2"
               >
                 Continue with Google
               </button>
             </div>
           ) : isLoading ? (
             <div className="mt-6 flex flex-col gap-3">
               {Array.from({ length: 3 }).map((_, index) => (
                 <div key={index} className="panel p-3">
                   <div className="h-3 w-40 bg-slate-200 rounded-full animate-pulse" />
                   <div className="mt-2 h-3 w-32 bg-slate-200 rounded-full animate-pulse" />
                 </div>
               ))}
             </div>
           ) : notifications.length === 0 ? (
             <div className="mt-6">
               <EmptyState
                 title="All caught up."
                 description="When someone interacts, you’ll see it here."
                 icon={<BellSimple size={18} weight="regular" />}
               />
             </div>
           ) : (
             <div className="mt-6 flex flex-col gap-3">
               {notifications.map((note) => (
                 <div key={note._id} className="panel p-3">
                   <p className="text-sm text-[color:var(--ink)]">
                     <span className="font-semibold">
                       {note.actorId?.name ?? "Someone"}
                     </span>{" "}
                     {note.type === "pray"
                       ? "prayed for your prayer."
                       : note.type === "comment"
                         ? "commented on your prayer."
                         : note.type === "word_like"
                           ? "liked your word."
                           : note.type === "word_comment"
                             ? "commented on your word."
                             : "followed you."}
                   </p>
                   {note.prayerId?.content && (
                     <p className="mt-2 text-xs text-[color:var(--subtle)] line-clamp-2">
                       “{note.prayerId.content}”
                     </p>
                   )}
                   {note.wordId?.content && (
                     <p className="mt-2 text-xs text-[color:var(--subtle)] line-clamp-2">
                       “{note.wordId.content}”
                     </p>
                   )}
                   <p className="mt-2 text-xs text-[color:var(--subtle)]">
                     {new Date(note.createdAt).toLocaleString()}
                   </p>
                 </div>
               ))}
             </div>
           )}
         </div>
       </div>
     </main>
   );
 }
