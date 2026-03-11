/* ============================================================
   db-local.js  —  IndexedDB helper for HABI-LIN offline mode
   Handles local pattern storage and sync queue
   ============================================================ */

const DB_NAME = "habi-lin-offline";
const DB_VERSION = 1;
const STORE_PATTERNS = "offline_patterns";
const STORE_SYNC_QUEUE = "sync_queue";

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e) => {
            const db = e.target.result;

            // Store for locally saved patterns
            if (!db.objectStoreNames.contains(STORE_PATTERNS)) {
                const store = db.createObjectStore(STORE_PATTERNS, { keyPath: "localId" });
                store.createIndex("synced", "synced", { unique: false });
            }

            // Store for patterns waiting to be synced
            if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
                db.createObjectStore(STORE_SYNC_QUEUE, { keyPath: "localId" });
            }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

/* ── Save a pattern locally ───────────────────────────────── */
export async function savePatternLocally(pattern) {
    const db = await openDB();
    const localId = "local_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    const record = { ...pattern, localId, synced: false, created: Date.now() };

    await new Promise((res, rej) => {
        const tx = db.transaction([STORE_PATTERNS, STORE_SYNC_QUEUE], "readwrite");
        tx.objectStore(STORE_PATTERNS).put(record);
        tx.objectStore(STORE_SYNC_QUEUE).put(record);
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
    });

    return record;
}

/* ── Get all locally saved patterns ──────────────────────── */
export async function getLocalPatterns() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PATTERNS, "readonly");
        const req = tx.objectStore(STORE_PATTERNS).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

/* ── Get unsynced patterns from queue ────────────────────── */
export async function getUnsyncedPatterns() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SYNC_QUEUE, "readonly");
        const req = tx.objectStore(STORE_SYNC_QUEUE).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

/* ── Mark a pattern as synced (remove from queue) ────────── */
export async function markAsSynced(localId, serverId) {
    const db = await openDB();
    await new Promise((res, rej) => {
        const tx = db.transaction([STORE_PATTERNS, STORE_SYNC_QUEUE], "readwrite");

        // Update pattern record with server ID and mark synced
        const patternStore = tx.objectStore(STORE_PATTERNS);
        const getReq = patternStore.get(localId);
        getReq.onsuccess = () => {
            const record = getReq.result;
            if (record) {
                record.synced = true;
                record.serverId = serverId;
                patternStore.put(record);
            }
        };

        // Remove from sync queue
        tx.objectStore(STORE_SYNC_QUEUE).delete(localId);
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
    });
}

/* ── Delete a local pattern ──────────────────────────────── */
export async function deleteLocalPattern(localId) {
    const db = await openDB();
    await new Promise((res, rej) => {
        const tx = db.transaction([STORE_PATTERNS, STORE_SYNC_QUEUE], "readwrite");
        tx.objectStore(STORE_PATTERNS).delete(localId);
        tx.objectStore(STORE_SYNC_QUEUE).delete(localId);
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
    });
}

/* ── Sync all queued patterns to the server ──────────────── */
export async function syncToServer() {
    const unsynced = await getUnsyncedPatterns();
    if (unsynced.length === 0) return { synced: 0, failed: 0 };

    let synced = 0, failed = 0;

    for (const pattern of unsynced) {
        try {
            const res = await fetch("/api/patterns/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: pattern.name,
                    type: pattern.type,
                    loom: pattern.loom,
                    steps: pattern.steps,
                    patternRows: pattern.patternRows,
                    weftColor: pattern.weftColor,
                    created: pattern.created
                })
            });

            if (res.ok) {
                const data = await res.json();
                await markAsSynced(pattern.localId, data.pattern._id);
                synced++;
            } else {
                failed++;
            }
        } catch {
            failed++;
        }
    }

    return { synced, failed };
}

/* ── Check if online ─────────────────────────────────────── */
export function isOnline() {
    return navigator.onLine;
}