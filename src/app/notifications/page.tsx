 "use client";

 import { useEffect, useState } from "react";
 import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
 import { signIn, useSession } from "next-auth/react";
 import Link from "next/link";
 import Sidebar from "@/components/layout/Sidebar";
 import EmptyState from "@/components/ui/EmptyState";
 import { BellSimple, X } from "@phosphor-icons/react";

 type NotificationActor = { name?: string | null; image?: string | null; username?: string | null };
 type NotificationRecipient = { username?: string | null };
 type NotificationItem = {
   _id: string;
   type:
     | "pray"
     | "comment"
     | "word_like"
     | "word_comment"
     | "follow"
     | "faith_like"
     | "faith_comment";
   createdAt: string;
   actorId?: NotificationActor | null;
   userId?: NotificationRecipient | null;
   prayerId?: { _id?: string; content?: string; authorUsername?: string | null } | null;
   wordId?: { _id?: string; content?: string; authorUsername?: string | null } | null;
   faithStoryId?: { _id?: string; title?: string; authorUsername?: string | null } | null;
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

   const deleteMutation = useMutation({
     mutationFn: async (id: string) => {
       const response = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
       if (!response.ok) {
         throw new Error("Failed to delete notification");
       }
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["notifications"] });
       queryClient.invalidateQueries({ queryKey: ["notifications", "count"] });
     },
   });

   const getNotificationHref = (note: NotificationItem) => {
     const recipient = note.userId?.username;
     const actor = note.actorId?.username;
     if (note.type === "follow") {
       return actor ? `/profile/${actor}` : "/profile";
     }
     if (note.wordId?._id) {
       const author = note.wordId.authorUsername ?? recipient;
       return author ? `/${author}/${note.wordId._id}` : null;
     }
     if (note.prayerId?._id) {
       const author = note.prayerId.authorUsername ?? recipient;
       return author ? `/${author}/${note.prayerId._id}` : null;
     }
     if (note.faithStoryId?._id) {
       const author = note.faithStoryId.authorUsername ?? recipient;
       return author ? `/faith-story/${author}/${note.faithStoryId._id}` : null;
     }
     return null;
   };

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
                   <div className="flex items-start justify-between gap-3">
                     {(() => {
                       const href = getNotificationHref(note);
                       const content = (
                         <>
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
                                    : note.type === "faith_like"
                                      ? "liked your faith story."
                                      : note.type === "faith_comment"
                                        ? "commented on your faith story."
                                     : "followed you."}
                           </p>
                           {note.prayerId?.content && (
                             <p className="mt-2 text-xs text-[color:var(--subtle)] line-clamp-2 whitespace-pre-line">
                               “{note.prayerId.content}”
                             </p>
                           )}
                           {note.wordId?.content && (
                             <p className="mt-2 text-xs text-[color:var(--subtle)] line-clamp-2 whitespace-pre-line">
                               “{note.wordId.content}”
                             </p>
                           )}
                           {note.faithStoryId?.title && (
                             <p className="mt-2 text-xs text-[color:var(--subtle)] line-clamp-2 whitespace-pre-line">
                               “{note.faithStoryId.title}”
                             </p>
                           )}
                           <p className="mt-2 text-xs text-[color:var(--subtle)]">
                             {new Date(note.createdAt).toLocaleString()}
                           </p>
                         </>
                       );
                       return href ? (
                         <Link href={href} className="flex-1 cursor-pointer">
                           {content}
                         </Link>
                       ) : (
                         <div className="flex-1">{content}</div>
                       );
                     })()}
                     <button
                       type="button"
                       onClick={() => deleteMutation.mutate(note._id)}
                       className="h-8 w-8 rounded-full border border-[color:var(--panel-border)] text-[color:var(--subtle)] hover:text-[color:var(--ink)] flex items-center justify-center"
                       aria-label="Dismiss notification"
                     >
                       <X size={14} weight="bold" />
                     </button>
                   </div>
                 </div>
               ))}
             </div>
           )}
         </div>
       </div>
     </main>
   );
 }
