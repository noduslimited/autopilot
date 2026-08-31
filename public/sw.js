// Autopilot service worker. Source: TRD section 11.2 (caching strategy).
//
// This app has no separate REST API for reads (server components fetch
// directly from Supabase at render time), so "today's visits" and "client
// names/addresses" don't exist as independently-cacheable URLs — they're
// embedded in each carer page's own navigation response. The strategies
// below apply at the request-type level, which is the closest honest
// mapping of TRD 11.2's four rules onto this architecture:
//
//  - Shell (static build assets):        cache-first, revalidate in background
//  - Carer page navigations (My Day etc): network-first, cache fallback
//  - AI routes (/api/ai/*):               network-only, never cached
//  - Everything else:                     network-first, cache fallback
//
// Offline mutation queueing (TRD 11.3 — IndexedDB queue + replay on
// reconnect) is not implemented in this session — see CLAUDE.md Session 9
// log for why it was scoped out.

const CACHE_NAME = "autopilot-shell-v1";
const PAGE_CACHE = "autopilot-pages-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME && key !== PAGE_CACHE).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/manifest.json";
}

function isAiRoute(url) {
  return url.pathname.startsWith("/api/ai/");
}

function isCarerNavigation(request, url) {
  return (
    request.mode === "navigate" &&
    (url.pathname === "/my-day" || url.pathname.startsWith("/visit/") || url.pathname === "/schedule" || url.pathname === "/report-incident")
  );
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // AI features: network only — no offline AI (TRD 11.2).
  if (isAiRoute(url)) return;

  // Shell: cache first, always load from cache, update in background.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        const networkFetch = fetch(event.request)
          .then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached ?? networkFetch;
      }),
    );
    return;
  }

  // Carer page navigations (embed "today's visits" / client data): network
  // first, cache fallback — TRD 11.2's "today's visits" and "client names
  // and addresses" rules, applied at the page level since that's where
  // this data actually lives in this app's architecture.
  if (isCarerNavigation(event.request, url)) {
    event.respondWith(
      caches.open(PAGE_CACHE).then(async (cache) => {
        try {
          const response = await fetch(event.request);
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        } catch {
          const cached = await cache.match(event.request);
          return cached ?? Response.error();
        }
      }),
    );
    return;
  }

  // Everything else: network first, cache fallback if available.
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then((cached) => cached ?? Response.error())),
  );
});

// Carer shift notifications (CLAUDE.md section 16a) — the Edge Function
// sends a Web Push message with a JSON payload {title, body, url}; this
// just has to show it as a native notification.
self.addEventListener("push", (event) => {
  let data = { title: "Autopilot", body: "You have a shift update.", url: "/schedule" };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-96.png",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/schedule";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }),
  );
});
