/* ============================================================
   sync-manager.js  —  Auto-sync + online/offline UI for HABI-LIN
   Include this in every page that needs offline awareness
   ============================================================ */

import { syncToServer, getUnsyncedPatterns } from "./db-local.js";

/* ── Inject the status banner into the page ──────────────── */
function injectBanner() {
    if (document.getElementById("offline-banner")) return;

    const banner = document.createElement("div");
    banner.id = "offline-banner";
    banner.innerHTML = `
    <span id="offline-banner-icon">📡</span>
    <span id="offline-banner-text">You're offline — patterns will sync when reconnected</span>
    <span id="offline-banner-count" style="margin-left:8px;font-weight:700;"></span>
    `;

    Object.assign(banner.style, {
        display: "none",
        position: "fixed",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "#2b0303",
        color: "white",
        padding: "12px 22px",
        borderRadius: "50px",
        fontSize: "0.85rem",
        fontWeight: "500",
        zIndex: "9999",
        boxShadow: "0 4px 20px rgba(0,0,0,.25)",
        alignItems: "center",
        gap: "8px",
        whiteSpace: "nowrap",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        transition: "opacity 0.3s"
    });

    document.body.appendChild(banner);
}

/* ── Show / hide the banner ──────────────────────────────── */
async function updateBanner() {
    const banner = document.getElementById("offline-banner");
    const textEl = document.getElementById("offline-banner-text");
    const countEl = document.getElementById("offline-banner-count");
    const iconEl = document.getElementById("offline-banner-icon");
    if (!banner) return;

    if (!navigator.onLine) {
        const unsynced = await getUnsyncedPatterns();
        banner.style.display = "flex";
        iconEl.textContent = "📡";
        textEl.textContent = "You're offline — patterns will sync when reconnected";
        countEl.textContent = unsynced.length > 0 ? `(${unsynced.length} pending)` : "";
    } else {
        // Check for pending syncs
        const unsynced = await getUnsyncedPatterns();
        if (unsynced.length > 0) {
            banner.style.display = "flex";
            iconEl.textContent = "🔄";
            textEl.textContent = "Syncing your offline patterns…";
            countEl.textContent = `(${unsynced.length})`;

            const result = await syncToServer();

            if (result.synced > 0) {
                iconEl.textContent = "✅";
                textEl.textContent = `${result.synced} pattern${result.synced > 1 ? "s" : ""} synced successfully!`;
                countEl.textContent = "";

                // Reload patterns grid if on collection page
                if (typeof loadPatterns === "function") loadPatterns();

                setTimeout(() => {
                    banner.style.opacity = "0";
                    setTimeout(() => { banner.style.display = "none"; banner.style.opacity = "1"; }, 300);
                }, 3000);
            } else {
                banner.style.display = "none";
            }
        } else {
            banner.style.display = "none";
        }
    }
}

/* ── Listen for online/offline events ───────────────────── */
export function initSyncManager() {
    injectBanner();
    updateBanner();

    window.addEventListener("online", () => updateBanner());
    window.addEventListener("offline", () => updateBanner());

    // Listen for sync message from service worker
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.addEventListener("message", (event) => {
            if (event.data?.type === "SYNC_PATTERNS") updateBanner();
        });
    }

    // Check every 30 seconds for pending syncs
    setInterval(updateBanner, 30000);
}

/* ── Register service worker ─────────────────────────────── */
export function registerSW() {
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/service-worker.js")
            .then(reg => {
                console.log("✅ Service Worker registered");

                // Request background sync permission
                if ("sync" in reg) {
                    window.addEventListener("online", () => {
                        reg.sync.register("sync-patterns").catch(() => { });
                    });
                }
            })
            .catch(err => console.warn("SW registration failed:", err));
    }
}