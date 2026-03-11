const CACHE_NAME = "habi-lin-v2";

// Pages and assets to cache immediately on install
const STATIC_ASSETS = [
    "/dashboard.html",
    "/collection.html",
    "/login.html",
    "/about.html",
    "/settings.html",
    "/user-settings.html",
    "/offline.html",
    "/manifest.json"
];

// ── INSTALL: cache all static assets ──────────────────────────
self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// ── ACTIVATE: clean up old caches ─────────────────────────────
self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// ── FETCH: serve from cache when offline ──────────────────────
self.addEventListener("fetch", event => {
    const { request } = event;
    const url = new URL(request.url);

    // Let API calls and auth routes pass through (don't cache)
    if (url.pathname.startsWith("/api/") ||
        url.pathname.startsWith("/auth/")) {
        event.respondWith(
            fetch(request).catch(() => {
                // If API call fails offline, return a JSON error
                return new Response(
                    JSON.stringify({ error: "You are offline. Please reconnect to access this feature." }),
                    { status: 503, headers: { "Content-Type": "application/json" } }
                );
            })
        );
        return;
    }

    // For HTML pages: try network first, fall back to cache, then offline page
    if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    // Cache the fresh page
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                    return response;
                })
                .catch(() =>
                    caches.match(request).then(cached => cached || caches.match("/offline.html"))
                )
        );
        return;
    }

    // For everything else (CSS, JS, images): cache first, then network
    event.respondWith(
        caches.match(request).then(cached => {
            if (cached) return cached;
            return fetch(request).then(response => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                return response;
            });
        })
    );
});

// ── BACKGROUND SYNC: retry failed pattern saves ───────────────
self.addEventListener("sync", event => {
    if (event.tag === "sync-patterns") {
        event.waitUntil(syncOfflinePatterns());
    }
});

async function syncOfflinePatterns() {
    // This will be triggered when internet is restored
    // The main app handles the actual sync via IndexedDB
    const clients = await self.clients.matchAll();
    clients.forEach(client => client.postMessage({ type: "SYNC_PATTERNS" }));
}
