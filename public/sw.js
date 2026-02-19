const CACHE_NAME = "beliefted-shell-v1";
const PRECACHE_URLS = [
  "/",
  "/manifest.webmanifest",
  "/sheep-home-192.png",
  "/sheep-home-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api")) return;
  if (url.pathname.startsWith("/api/auth")) return;
  if (url.pathname.startsWith("/auth")) return;
  if (url.pathname.startsWith("/signin")) return;
  if (url.pathname.startsWith("/callback")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(() => caches.match("/"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});

self.addEventListener("push", (event) => {
  const payload = (() => {
    try {
      return event.data ? event.data.json() : {};
    } catch {
      return {};
    }
  })();
  const dataPayload = payload.data || payload;
  const title = dataPayload.title || "Beliefted";
  const options = {
    body: dataPayload.body || "You have a new notification.",
    icon: "/sheep-home-192.png",
    badge: "/sheep-home-192.png",
    data: {
      url: dataPayload.url || "/?open=notifications",
    },
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) =>
          client.postMessage({ type: "push-notification" })
        );
      }),
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.includes(targetUrl));
      if (existing) {
        existing.focus();
        return;
      }
      self.clients.openWindow(targetUrl);
    })
  );
});
