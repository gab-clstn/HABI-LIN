const CACHE_NAME = "habi-lin-v3"; // Bumped version

const STATIC_ASSETS = [
    "/dashboard.html",
    "/collection.html",
    "/login.html",
    "/about.html",
    "/settings.html",
    "/user-settings.html",
    "/offline.html",
    "/manifest.json",
    "/global.js" // Added global.js since your pages depend on it
];

// ── INSTALL: Cache assets one by one for better reliability ──
self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log("SW: Pre-caching offline assets...");
            for (const asset of STATIC_ASSETS) {
                try {
                    await cache.add(asset);
                } catch (err) {
                    console.warn(`SW: Failed to cache ${asset}. Check if the filename matches exactly.`);
                }
            }
            return self.skipWaiting();
        })
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

    // Skip non-GET requests and external CDNs if needed, but let's keep it simple:
    if (request.method !== 'GET') return;

    // API/Auth bypass
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) {
        return; 
    }

    event.respondWith(
        fetch(request)
            .then(response => {
                // If network works, put a copy in cache
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                }
                return response;
            })
            .catch(() => {
                // If network fails, try cache, then offline.html
                return caches.match(request).then(cached => {
                    return cached || caches.match("/offline.html");
                });
            })
    );
});
