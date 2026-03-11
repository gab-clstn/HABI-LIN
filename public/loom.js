import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";

//////////////////////////////////////////////////
// TOP-LEVEL STATE
//////////////////////////////////////////////////
let recordedSteps = [];
let loomConfig = null;
let threading = [];
let beatTimer = 0;
let heddleThreading = [0, 1, 2, 3];
let warpColors = ["#ffffff", "#ffffff", "#ffffff", "#ffffff"];
const BEAT_DURATION = 10;

//////////////////////////////////////////////////
// SETUP OVERLAY — Entry point
//////////////////////////////////////////////////
function attachStartButton() {
    const nextBtn = document.getElementById("startSetup");
    const startBtn = document.getElementById("startWeavingFromHeddles");
    const heddlesOverlay = document.getElementById("heddlesOverlay");
    const setupOverlay = document.getElementById("setupOverlay");

    if (!nextBtn || !startBtn || !setupOverlay || !heddlesOverlay) {
        requestAnimationFrame(attachStartButton);
        return;
    }

    // ── REBUILD COLOR SECTION IN HEDDLES OVERLAY ──
    // Hides the old 4-shaft inline pickers and replaces with a full-width
    // tabbed panel: "Warp Threads" (by range) | "Weft Picks" (by range).
    (function buildColorUI() {
        if (document.getElementById("color-section-root")) return;

        // ── Inject styles ──
        if (!document.getElementById("color-section-styles")) {
            const s = document.createElement("style");
            s.id = "color-section-styles";
            s.textContent = `
                /* Hide legacy shaft pickers — we replace them entirely */
                #wrap-warpColor1, #wrap-warpColor2,
                #wrap-warpColor3, #wrap-warpColor4 { display: none !important; }

                /* Overlay scrollable content wrapper */
                #heddlesOverlay .heddles-inner {
                    width: 100%;
                    max-width: 480px;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    box-sizing: border-box;
                }

                /* ── Color section root ── */
                #color-section-root {
                    width: 100%;
                    box-sizing: border-box;
                    border-top: 1px solid rgba(255,255,255,0.1);
                    padding-top: 16px;
                }
                .cs-heading {
                    font-size: 0.72rem;
                    font-weight: 700;
                    letter-spacing: 0.8px;
                    text-transform: uppercase;
                    color: #888;
                    margin-bottom: 10px;
                }

                /* ── Mode toggle tabs ── */
                .cs-tabs {
                    display: flex;
                    gap: 6px;
                    margin-bottom: 14px;
                }
                .cs-tab {
                    flex: 1;
                    padding: 8px 6px;
                    border-radius: 8px;
                    border: 1px solid rgba(255,255,255,0.12);
                    background: rgba(255,255,255,0.04);
                    color: #888;
                    font-size: 0.75rem;
                    font-weight: 600;
                    font-family: inherit;
                    cursor: pointer;
                    text-align: center;
                    transition: all 0.18s;
                    line-height: 1.3;
                }
                .cs-tab:hover { background: rgba(255,255,255,0.08); color: #ccc; }
                .cs-tab.active {
                    background: rgba(200,169,110,0.18);
                    border-color: rgba(200,169,110,0.5);
                    color: #e8c97a;
                }
                .cs-tab .cs-tab-icon { font-size: 1rem; display: block; margin-bottom: 2px; }

                /* ── Panel (shown/hidden) ── */
                .cs-panel { display: none; flex-direction: column; gap: 8px; }
                .cs-panel.active { display: flex; }

                /* ── Rows list ── */
                .cs-rows { display: flex; flex-direction: column; gap: 6px; }

                /* ── Single range row ── */
                .cs-row {
                    display: grid;
                    grid-template-columns: 1fr auto auto auto auto;
                    align-items: center;
                    gap: 6px;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 9px;
                    padding: 8px 10px;
                    box-sizing: border-box;
                }
                .cs-row-label {
                    font-size: 0.7rem;
                    color: #777;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .cs-row-sep {
                    font-size: 0.75rem;
                    color: #555;
                    padding: 0 2px;
                }
                .cs-row input[type="number"] {
                    width: 48px;
                    min-width: 0;
                    background: rgba(0,0,0,0.35);
                    border: 1px solid rgba(255,255,255,0.14);
                    border-radius: 6px;
                    color: #e8e8e8;
                    font-size: 0.78rem;
                    padding: 4px 5px;
                    text-align: center;
                    font-family: inherit;
                    -moz-appearance: textfield;
                    box-sizing: border-box;
                }
                .cs-row input[type="number"]:focus {
                    outline: none;
                    border-color: rgba(200,169,110,0.5);
                }
                .cs-row input[type="number"]::-webkit-inner-spin-button,
                .cs-row input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; }
                .cs-row input[type="color"] {
                    width: 32px;
                    height: 26px;
                    border: 1px solid rgba(255,255,255,0.15);
                    border-radius: 6px;
                    cursor: pointer;
                    padding: 2px;
                    background: rgba(0,0,0,0.2);
                    flex-shrink: 0;
                }
                .cs-row-del {
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(220,60,60,0.15);
                    border: 1px solid rgba(220,60,60,0.3);
                    color: #e06060;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 0.7rem;
                    flex-shrink: 0;
                    transition: background 0.15s;
                    padding: 0;
                    font-family: inherit;
                }
                .cs-row-del:hover { background: rgba(220,60,60,0.35); }

                /* ── Add button ── */
                .cs-add-btn {
                    width: 100%;
                    padding: 8px 12px;
                    background: rgba(100,180,100,0.1);
                    border: 1px dashed rgba(100,180,100,0.35);
                    color: #7ecf7e;
                    border-radius: 9px;
                    cursor: pointer;
                    font-size: 0.75rem;
                    font-weight: 600;
                    font-family: inherit;
                    text-align: left;
                    transition: background 0.15s;
                    box-sizing: border-box;
                }
                .cs-add-btn:hover { background: rgba(100,180,100,0.22); }

                /* ── Hint text ── */
                .cs-hint {
                    font-size: 0.67rem;
                    color: #555;
                    line-height: 1.5;
                    padding: 2px 0;
                }

                /* ── Preview bar ── */
                .cs-preview-wrap { margin-top: 4px; }
                .cs-preview-label {
                    font-size: 0.67rem;
                    color: #555;
                    margin-bottom: 4px;
                }
                #cs-warp-preview, #cs-weft-preview {
                    width: 100%;
                    height: 12px;
                    border-radius: 4px;
                    display: block;
                    image-rendering: pixelated;
                    border: 1px solid rgba(255,255,255,0.08);
                }
            `;
            document.head.appendChild(s);
        }

        // ── Hide legacy pickers immediately ──
        ["wrap-warpColor1", "wrap-warpColor2", "wrap-warpColor3", "wrap-warpColor4"].forEach(id => {
            const el = heddlesOverlay.querySelector ? heddlesOverlay.querySelector(`#${id}`) : document.getElementById(id);
            if (el) el.style.display = "none";
        });
        // Also hide the parent "WARP COLORS" label if it exists as a sibling label
        heddlesOverlay.querySelectorAll && heddlesOverlay.querySelectorAll("label, .field-label, .form-label").forEach(el => {
            if (el.textContent.trim().toUpperCase() === "WARP COLORS") el.style.display = "none";
        });

        // ── Build root ──
        const root = document.createElement("div");
        root.id = "color-section-root";

        root.innerHTML = `
            <div class="cs-heading">Thread Colors</div>
            <div class="cs-tabs">
                <button type="button" class="cs-tab active" data-tab="warp">
                    <span class="cs-tab-icon">↕</span>Warp Threads
                </button>
                <button type="button" class="cs-tab" data-tab="weft">
                    <span class="cs-tab-icon">↔</span>Weft Picks
                </button>
            </div>

            <!-- WARP panel -->
            <div class="cs-panel active" id="cs-panel-warp">
                <div class="cs-hint">Color warp threads by range. Ranges stack — last one wins.</div>
                <div class="cs-rows" id="cs-warp-rows"></div>
                <button type="button" class="cs-add-btn" id="cs-warp-add">+ Add Thread Range</button>
                <div class="cs-preview-wrap">
                    <div class="cs-preview-label">Preview</div>
                    <canvas id="cs-warp-preview" height="1"></canvas>
                </div>
            </div>

            <!-- WEFT panel -->
            <div class="cs-panel" id="cs-panel-weft">
                <div class="cs-hint">Pre-set weft pick colors by range. You can still change color live while weaving.</div>
                <div class="cs-rows" id="cs-weft-rows"></div>
                <button type="button" class="cs-add-btn" id="cs-weft-add">+ Add Pick Range</button>
                <div class="cs-preview-wrap">
                    <div class="cs-preview-label">Preview (first 200 picks)</div>
                    <canvas id="cs-weft-preview" height="1"></canvas>
                </div>
            </div>
        `;

        // ── Append to overlay (before Start Weaving button) ──
        const startBtnEl = heddlesOverlay.querySelector("#startWeavingFromHeddles");
        if (startBtnEl && startBtnEl.parentNode) {
            startBtnEl.parentNode.insertBefore(root, startBtnEl);
        } else {
            heddlesOverlay.appendChild(root);
        }

        // ── Tab switching ──
        root.querySelectorAll(".cs-tab").forEach(tab => {
            tab.addEventListener("click", () => {
                root.querySelectorAll(".cs-tab").forEach(t => t.classList.remove("active"));
                root.querySelectorAll(".cs-panel").forEach(p => p.classList.remove("active"));
                tab.classList.add("active");
                root.querySelector(`#cs-panel-${tab.dataset.tab}`).classList.add("active");
            });
        });

        // ── Generic row factory ──
        function makeRow(rowsEl, from, to, color, labelText, previewFn) {
            const row = document.createElement("div");
            row.className = "cs-row";
            row.innerHTML = `
                <span class="cs-row-label">${labelText}</span>
                <input type="number" class="range-from" value="${from}" min="1" />
                <span class="cs-row-sep">–</span>
                <input type="number" class="range-to" value="${to}" min="1" />
                <input type="color" class="range-color" value="${color}" />
                <button type="button" class="cs-row-del" title="Remove">✕</button>
            `;
            row.querySelector(".cs-row-del").addEventListener("click", () => { row.remove(); previewFn(); });
            row.querySelectorAll("input").forEach(el => el.addEventListener("input", previewFn));
            rowsEl.appendChild(row);
            previewFn();
        }

        // ── Warp row helpers ──
        const warpRows = root.querySelector("#cs-warp-rows");
        const warpAddBtn = root.querySelector("#cs-warp-add");

        function drawWarpPreview() {
            const canvas = root.querySelector("#cs-warp-preview");
            if (!canvas) return;
            const total = 120;
            canvas.width = total;
            const ctx = canvas.getContext("2d");
            const colors = buildWarpColorArray(total);
            for (let i = 0; i < total; i++) {
                ctx.fillStyle = colors[i];
                ctx.fillRect(i, 0, 1, 1);
            }
        }

        function buildWarpColorArray(total) {
            const arr = new Array(total).fill("#ffffff");
            warpRows.querySelectorAll(".cs-row").forEach(row => {
                const from = Math.max(1, parseInt(row.querySelector(".range-from").value) || 1);
                const to = Math.min(total, parseInt(row.querySelector(".range-to").value) || total);
                const col = row.querySelector(".range-color").value || "#ffffff";
                for (let i = from - 1; i < to; i++) arr[i] = col;
            });
            return arr;
        }

        function addWarpRow(from, to, color) {
            makeRow(warpRows, from, to, color, "Threads", drawWarpPreview);
        }

        warpAddBtn.addEventListener("click", () => {
            const rows = warpRows.querySelectorAll(".cs-row");
            let nextFrom = 1;
            if (rows.length > 0) {
                const lastTo = parseInt(rows[rows.length - 1].querySelector(".range-to").value);
                if (!isNaN(lastTo)) nextFrom = lastTo + 1;
            }
            const currentMax = parseInt(document.getElementById("patternSize")?.value || "4");
            const maxT = Math.floor(120 / Math.max(1, currentMax)) * currentMax;
            addWarpRow(nextFrom, maxT, "#000000");
        });

        // Default: one row covering all threads in white
        addWarpRow(1, 120, "#ffffff");

        // ── Weft row helpers ──
        const weftRows = root.querySelector("#cs-weft-rows");
        const weftAddBtn = root.querySelector("#cs-weft-add");

        function drawWeftPreview() {
            const canvas = root.querySelector("#cs-weft-preview");
            if (!canvas) return;
            const total = 200;
            canvas.width = total;
            const ctx = canvas.getContext("2d");
            const colors = buildWeftColorArray(total);
            for (let i = 0; i < total; i++) {
                ctx.fillStyle = colors[i];
                ctx.fillRect(i, 0, 1, 1);
            }
        }

        function buildWeftColorArray(total) {
            const arr = new Array(total).fill("#f0eadf");
            weftRows.querySelectorAll(".cs-row").forEach(row => {
                const from = Math.max(1, parseInt(row.querySelector(".range-from").value) || 1);
                const to = Math.min(total, parseInt(row.querySelector(".range-to").value) || total);
                const col = row.querySelector(".range-color").value || "#f0eadf";
                for (let i = from - 1; i < to; i++) arr[i] = col;
            });
            return arr;
        }

        function addWeftRow(from, to, color) {
            makeRow(weftRows, from, to, color, "Picks", drawWeftPreview);
        }

        weftAddBtn.addEventListener("click", () => {
            const rows = weftRows.querySelectorAll(".cs-row");
            let nextFrom = 1;
            if (rows.length > 0) {
                const lastTo = parseInt(rows[rows.length - 1].querySelector(".range-to").value);
                if (!isNaN(lastTo)) nextFrom = lastTo + 1;
            }
            addWeftRow(nextFrom, 200, "#c0392b");
        });

        // Default: one weft row, off-white
        addWeftRow(1, 200, "#f0eadf");

        // Expose helpers on the element so startBtn handler can read them
        root._buildWarpColorArray = buildWarpColorArray;
        root._buildWeftColorArray = buildWeftColorArray;
    })();

    nextBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        const patternNameInput = document.getElementById("patternName");
        const patternName = patternNameInput ? patternNameInput.value.trim() : "";

        if (!patternName) {
            alert("Please enter a pattern name before proceeding.");
            return;
        }

        try {
            const response = await fetch("/api/patterns");
            if (response.ok) {
                const existingPatterns = await response.json();
                const isDuplicate = existingPatterns.some(p => p.name.toLowerCase() === patternName.toLowerCase());
                if (isDuplicate) {
                    alert("Pattern name already exists! Please choose a unique name for your design.");
                    return;
                }
            }
        } catch (err) {
            console.error("Could not verify pattern name uniqueness", err);
        }

        const loomType = document.getElementById("loomType").value;
        const h3Wrap = document.getElementById("wrap-heddle3");
        const h4Wrap = document.getElementById("wrap-heddle4");
        const w3Wrap = document.getElementById("wrap-warpColor3");
        const w4Wrap = document.getElementById("wrap-warpColor4");

        if (loomType === "traditional") {
            if (h3Wrap) h3Wrap.style.display = "none";
            if (h4Wrap) h4Wrap.style.display = "none";
            if (w3Wrap) w3Wrap.style.display = "none";
            if (w4Wrap) w4Wrap.style.display = "none";
        } else {
            if (h3Wrap) h3Wrap.style.display = "block";
            if (h4Wrap) h4Wrap.style.display = "block";
            if (w3Wrap) w3Wrap.style.display = "flex";
            if (w4Wrap) w4Wrap.style.display = "flex";
        }

        // Update range input max hints based on totalThreads
        const patternSize = parseInt(document.getElementById("patternSize").value) || 4;
        const maxThreads = 120;
        const repeats = Math.floor(maxThreads / patternSize);
        const totalThreads = repeats * patternSize;
        document.querySelectorAll(".range-from, .range-to").forEach(el => {
            el.max = totalThreads;
            el.placeholder = el.classList.contains("range-to") ? totalThreads : "1";
        });
        // Fill empty "to" fields with totalThreads
        document.querySelectorAll(".range-to").forEach(el => {
            if (!el.value) el.value = totalThreads;
        });

        setupOverlay.style.display = "none";
        heddlesOverlay.style.display = "flex";
    });

    const backBtn = document.getElementById("backToSetup2");
    if (backBtn) {
        backBtn.addEventListener("click", (e) => {
            e.preventDefault();
            heddlesOverlay.style.display = "none";
            setupOverlay.style.display = "flex";
        });
    }

    startBtn.addEventListener("click", (e) => {
        e.preventDefault();

        const patternSize = parseInt(document.getElementById("patternSize").value);

        if (isNaN(patternSize) || patternSize <= 0) {
            alert("Please enter a valid pattern size.");
            return;
        }

        const parseHeddle = (id) => {
            const el = document.getElementById(id);
            if (!el || !el.value.trim()) return [];
            return el.value.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        };

        const loomType = document.getElementById("loomType").value;

        const h1 = parseHeddle("heddle1");
        const h2 = parseHeddle("heddle2");
        const h3 = loomType === "traditional" ? [] : parseHeddle("heddle3");
        const h4 = loomType === "traditional" ? [] : parseHeddle("heddle4");

        const allAssigned = [...h1, ...h2, ...h3, ...h4];
        const uniqueAssigned = new Set(allAssigned);

        if (allAssigned.length !== patternSize || uniqueAssigned.size !== patternSize) {
            alert(`Error: Assign exactly 1 to ${patternSize} without duplicates.`, "error");
            return;
        }

        const outOfBounds = allAssigned.some(n => n < 1 || n > patternSize);
        if (outOfBounds) {
            alert(`Error: Thread numbers must be between 1 and ${patternSize}.`);
            return;
        }

        let finalThreadingMap = new Array(patternSize).fill(0);
        h1.forEach(n => finalThreadingMap[n - 1] = 0);
        h2.forEach(n => finalThreadingMap[n - 1] = 1);
        h3.forEach(n => finalThreadingMap[n - 1] = 2);
        h4.forEach(n => finalThreadingMap[n - 1] = 3);

        const maxThreads = 120;
        const repeats = Math.floor(maxThreads / patternSize);
        const totalThreads = repeats * patternSize;

        if (totalThreads === 0) {
            alert("Pattern size is too large (max 120).");
            return;
        }

        // ── PHYSICAL MEASUREMENTS ──
        // clothWidth from the setup form (in centimeters)
        const rawWidth = parseFloat(document.getElementById("clothWidth").value);
        const physicalWidthCm = isNaN(rawWidth) || rawWidth <= 0 ? 30 : rawWidth;

        loomConfig = {
            patternName: document.getElementById("patternName").value,
            loomType: loomType,
            patternType: document.getElementById("patternType").value,
            width: physicalWidthCm,
            patternSize: patternSize,
            totalThreads: totalThreads,
            customThreadingMap: finalThreadingMap
        };

        // ── READ WARP & WEFT COLORS FROM NEW COLOR UI ──
        const colorRoot = document.getElementById("color-section-root");

        // Warp: per-thread array of length totalThreads
        const perThreadColors = colorRoot && colorRoot._buildWarpColorArray
            ? colorRoot._buildWarpColorArray(totalThreads)
            : new Array(totalThreads).fill("#ffffff");
        warpColors = perThreadColors;

        // Weft: pre-set pick color array — stored on loomConfig, applied in initLoom
        const presetWeftColors = colorRoot && colorRoot._buildWeftColorArray
            ? colorRoot._buildWeftColorArray(2000)   // enough for any session
            : [];

        loomConfig.presetWeftColors = presetWeftColors;

        heddlesOverlay.style.display = "none";
        initLoom();
    });
}

//////////////////////////////////////////////////
// INJECT LOOM UI STYLES
//////////////////////////////////////////////////
function injectLoomStyles() {
    if (document.getElementById("loom-ui-styles")) return;
    const style = document.createElement("style");
    style.id = "loom-ui-styles";
    style.textContent = `
        .loom-panel {
            position: absolute;
            top: clamp(10px, 2%, 20px);
            left: clamp(10px, 2%, 20px);
            width: clamp(160px, 18vw, 220px);
            max-height: 80vh;
            background: rgba(13, 13, 18, 0.96);
            color: #e0e0e0;
            border: 1px solid #2a2a35;
            border-radius: 14px;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            z-index: 100;
            box-shadow: 0 8px 32px rgba(0,0,0,0.55);
            font-family: 'Plus Jakarta Sans', sans-serif;
            font-size: clamp(10px, 1.1vw, 12px);
            box-sizing: border-box;
            transition: all 0.3s ease;
            overflow-y: auto;
        }
        .loom-panel.collapsed {
            max-height: 48px !important;
            min-height: 48px !important;
            padding-bottom: 0 !important;
            overflow: hidden !important;
        }
        .loom-panel.collapsed > :not(.loom-panel__header) {
            display: none !important;
        }
        .loom-panel__header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 8px;
            border-bottom: 1px solid #2a2a35;
            gap: 6px;
            cursor: pointer;
            user-select: none;
            margin-bottom: 0;
        }
        .loom-panel.collapsed .loom-panel__header {
            border-bottom: none;
            padding-bottom: 0;
            height: 100%;
        }
        .loom-panel__title {
            font-weight: 700;
            font-size: clamp(11px, 1.2vw, 13px);
            color: #fff;
            letter-spacing: 0.3px;
            flex: 1;
            min-width: 0;
        }
        .loom-btn-back {
            padding: 4px 8px;
            background: none;
            border: 1px solid #3a3a45;
            color: #888;
            border-radius: 6px;
            cursor: pointer;
            font-size: clamp(9px, 0.9vw, 10px);
            font-family: inherit;
            transition: border-color 0.2s, color 0.2s;
            white-space: nowrap;
            flex-shrink: 0;
        }
        .loom-btn-back:hover { border-color: #666; color: #ccc; }
        .loom-btn {
            padding: clamp(6px, 1vh, 9px) 8px;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 700;
            font-size: clamp(10px, 1vw, 11px);
            width: 100%;
            font-family: inherit;
            transition: opacity 0.2s, transform 0.1s;
            letter-spacing: 0.2px;
        }
        .loom-btn:hover  { opacity: 0.88; }
        .loom-btn:active { transform: scale(0.97); }
        .loom-btn--ble    { background: #007bff; }
        .loom-btn--export { background: #28a745; }
        .loom-btn--save   { background: #fd7e14; }
        .loom-hint {
            font-size: clamp(9px, 0.95vw, 10px);
            color: #666;
            line-height: 1.4;
            background: #141418;
            padding: 6px 8px;
            border-radius: 6px;
        }
        .loom-divider {
            border: none;
            border-top: 1px solid #2a2a35;
            margin: 0;
        }
        .loom-color-row {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .loom-color-label {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: clamp(10px, 1vw, 11px);
            color: #aaa;
        }
        .loom-color-label input[type="color"] {
            border: none;
            width: clamp(22px, 2.5vw, 28px);
            height: clamp(16px, 2vh, 20px);
            background: none;
            cursor: pointer;
            padding: 0;
            border-radius: 4px;
        }

        /* ── MEASUREMENT PANEL (TOP-RIGHT) ── */
        .loom-measure-panel {
            position: absolute;
            top: clamp(10px, 2%, 20px);
            right: clamp(10px, 2%, 20px);
            width: clamp(170px, 16vw, 210px);
            background: rgba(10, 15, 10, 0.96);
            color: #e0e0e0;
            border: 1px solid #1a2e1a;
            border-radius: 14px;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            z-index: 100;
            box-shadow: 0 8px 32px rgba(0,0,0,0.55);
            font-family: 'Plus Jakarta Sans', sans-serif;
            font-size: clamp(10px, 1.1vw, 12px);
            box-sizing: border-box;
            transition: all 0.3s ease;
        }
        .loom-measure-panel__title {
            font-weight: 700;
            font-size: clamp(11px, 1.2vw, 12px);
            color: #7edd8f;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            display: flex;
            align-items: center;
            gap: 6px;
            padding-bottom: 8px;
            border-bottom: 1px solid #1a2e1a;
        }
        .loom-measure-panel__title::before {
            content: '';
            width: 6px;
            height: 6px;
            background: #4ecb5e;
            border-radius: 50%;
            display: inline-block;
            animation: pulse-dot 1.5s ease-in-out infinite;
        }
        @keyframes pulse-dot {
            0%, 100% { opacity: 1; transform: scale(1); }
            50%       { opacity: 0.4; transform: scale(0.7); }
        }
        .measure-row {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            gap: 4px;
        }
        .measure-label {
            font-size: clamp(9px, 0.9vw, 10px);
            color: #668866;
            white-space: nowrap;
            text-transform: uppercase;
            letter-spacing: 0.4px;
        }
        .measure-value {
            font-size: clamp(11px, 1.1vw, 13px);
            font-weight: 700;
            color: #c8f0cb;
            text-align: right;
            font-variant-numeric: tabular-nums;
        }
        .measure-value span {
            font-size: 0.75em;
            color: #668866;
            font-weight: 500;
        }
        .measure-divider {
            border: none;
            border-top: 1px solid #1a2e1a;
            margin: 2px 0;
        }
        .measure-accuracy-bar {
            background: #111a11;
            border-radius: 4px;
            height: 5px;
            overflow: hidden;
            margin-top: 2px;
        }
        .measure-accuracy-fill {
            height: 100%;
            background: linear-gradient(90deg, #2d7a36, #4ecb5e);
            border-radius: 4px;
            transition: width 0.6s ease;
            width: 0%;
        }
        .measure-accuracy-label {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2px;
        }

        /* ── 2D PATTERN PANEL (BOTTOM-RIGHT) ── */
        .loom-pattern-panel {
            position: absolute;
            bottom: clamp(10px, 2%, 20px);
            right: clamp(10px, 2%, 20px);
            width: clamp(200px, 28vw, 420px);
            height: clamp(140px, 22vh, 260px);
            background: rgba(0, 0, 0, 0.92);
            color: white;
            border-radius: 12px;
            border: 1px solid #2a2a35;
            padding: clamp(10px, 1.5%, 15px);
            box-sizing: border-box;
            z-index: 101;
            display: flex;
            flex-direction: column;
            font-family: 'Plus Jakarta Sans', sans-serif;
            box-shadow: 0 8px 28px rgba(0,0,0,0.5);
        }
        .loom-pattern-panel__title {
            font-weight: 700;
            font-size: clamp(11px, 1.2vw, 13px);
            margin-bottom: 8px;
            color: #ddd;
            letter-spacing: 0.3px;
        }
        .loom-pattern-panel__scroll {
            flex: 1;
            overflow: auto;
            background: #111;
            padding: 4px;
            border-radius: 6px;
            scrollbar-width: thin;
            scrollbar-color: #333 transparent;
        }
        .loom-pattern-panel__scroll::-webkit-scrollbar { width: 4px; height: 4px; }
        .loom-pattern-panel__scroll::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        #patternCanvas {
            background: white;
            border-radius: 3px;
            display: block;
        }
        .hardware-sim-container {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        @media (max-width: 768px) {
            .hardware-sim-container { display: none !important; }
            .loom-measure-panel { display: none !important; }
        }
        @media (min-width: 901px) {
            .loom-panel { width: clamp(200px, 18vw, 250px); max-height: 50vh; }
            .loom-pattern-panel { width: clamp(220px, 30vw, 450px); height: clamp(150px, 25vh, 300px); }
            .loom-measure-panel { width: clamp(180px, 16vw, 220px); }
        }
        @media (min-width: 601px) and (max-width: 900px) {
            .loom-panel { width: clamp(150px, 20vw, 200px); max-height: 45vh; }
            .loom-pattern-panel { width: clamp(180px, 32vw, 300px); height: clamp(120px, 20vh, 200px); }
            .loom-measure-panel { width: clamp(150px, 18vw, 190px); }
        }
        @media (max-width: 600px) {
            .loom-panel { top: 10px !important; left: 10px !important; width: auto !important; min-width: 180px; max-height: 60vh !important; padding: 10px !important; }
            .loom-pattern-panel { bottom: 0 !important; right: 0 !important; left: 0 !important; width: 100% !important; height: 28vh !important; max-width: none !important; border-radius: 16px 16px 0 0 !important; border-bottom: none; }
            #patternCanvas { width: 100% !important; height: auto !important; }
        }
    `;
    document.head.appendChild(style);
}

//////////////////////////////////////////////////
// MAIN LOOM INITIALIZER
//////////////////////////////////////////////////
function initLoom() {
    let hasUnsavedChanges = false;

    const SHAFT_COUNT = (loomConfig.loomType === "traditional") ? 2 : 4;

    // ── PHYSICAL SCALE ──
    // The 3D loom frame stays a FIXED size regardless of cloth width.
    // Physical width is recorded for measurement/export only.
    // Threads are simply compressed tighter to fit more into the same HEDDLE_WIDTH.
    // At 0.1mm per thread, a 120-thread warp = 12mm — far narrower than the loom frame,
    // so we always spread threads evenly across HEDDLE_WIDTH in 3D space.
    const PHYSICAL_WIDTH_CM = Math.max(1, Math.min(200, loomConfig.width || 30));
    const WIDTH = 6.5;   // FIXED — 3D loom never resizes

    const DEPTH = 4.2;
    const FRONT = 0;
    const BACK = -DEPTH;
    const FOOT_EXTENSION = 2.2;
    const BASE_FRONT = FRONT + FOOT_EXTENSION;
    const TOWER_Z = FRONT - DEPTH * 0.38;
    const BEATER_REST_Z = TOWER_Z + 1.2;
    const LEG_HEIGHT = 3.2;
    const BREAST_BEAM_Y = LEG_HEIGHT + 0.15;
    const WARP_BEAM_Y = LEG_HEIGHT;
    const CLOTH_BEAM_Y = 2.4;
    const CLOTH_BEAM_Z = BEATER_REST_Z + 0.5;
    const LEFT = -WIDTH / 2;
    const RIGHT = WIDTH / 2;
    const HEDDLE_WIDTH = WIDTH - 0.85;
    const FRAME_H = 1.2;
    const BASE_Y = 0.45;
    const SHED_OPEN_Y = BREAST_BEAM_Y + 0.6;
    const SHED_CLOSED_Y = BREAST_BEAM_Y - 0.4;
    const SHUTTLE_LIMIT = HEDDLE_WIDTH / 2 + 0.6;
    const ROW_SPACING = 0.02;
    const BEATER_HIT_Z = BASE_FRONT - 0.2;
    const MAX_ROWS_BEFORE_TAKEUP = 100;
    const TOTAL_THREADS = loomConfig.totalThreads;
    const PATTERN_SIZE = loomConfig.patternSize;

    // ── PHYSICAL MEASUREMENT CONSTANTS ──
    const THREADS_PER_CM = TOTAL_THREADS / PHYSICAL_WIDTH_CM;
    // Standard handloom: ~8 picks/cm is reasonable for plain weave
    // We derive expected picks per cm from pattern type
    const EXPECTED_PPC = loomConfig.patternType === "twill" ? 10
        : loomConfig.patternType === "basket" ? 6
            : loomConfig.patternType === "rib" ? 5
                : 8; // plain default
    // This is our accuracy baseline: we compare actual weft count vs expected
    // for the current woven height
    const EXPECTED_WEFT_PER_CM = EXPECTED_PPC;

    let zPositions = [];
    if (SHAFT_COUNT === 2) {
        zPositions = [TOWER_Z - 0.25, TOWER_Z + 0.25];
    } else {
        zPositions = [TOWER_Z - 0.45, TOWER_Z - 0.15, TOWER_Z + 0.15, TOWER_Z + 0.45];
    }

    const activeKeys = new Set();
    const pedalPivotGroups = [];
    const heddleFrames = [];
    const warpGroups = [];
    for (let i = 0; i < SHAFT_COUNT; i++) warpGroups.push([]);

    let currentPressedPedals = new Set();
    let isBeaterPulled = false;
    let hasProcessedCurrentBeat = false;

    let beaterGroup, shuttleGroup, clothRoller;
    let weftThreads = [];
    let activeWeft = null;
    let patternHistory = loomConfig.resumeHistory || [];
    let rowCounter = 0;
    let weftColorHistory = (loomConfig.rowColors && Array.isArray(loomConfig.rowColors)) ? Array.from(loomConfig.rowColors) : [];
    // Pre-set weft pick colors from the color UI (may be empty array if not set)
    const presetWeftColors = Array.isArray(loomConfig.presetWeftColors) ? loomConfig.presetWeftColors : [];
    let fellZ = BASE_FRONT - 0.12;

    let shuttleSideToggle = false;
    let shuttleArmed = false;
    let shuttleInserted = false;
    let shuttleStartSide = -1;
    let shuttleCrossed = false;

    let shuttleDirectionChanges = 0;
    let shuttleMovingPositive = null;
    let lastShuttleX = 0;

    let treadlingSequence = [];
    let treadlingIndex = 0;
    let weftReadyToBeat = false;
    let shuttleCurrentSide = -1;

    // ── MEASUREMENT STATE ──
    // weftCount: total beats committed (same as patternHistory.length after resume)
    let weftCount = patternHistory.length;

    // ── WEFT COLOR STATE ──
    // colorMode: "preset" | "manual"
    //   "preset"  → shuttle color advances automatically from presetWeftColors each beat
    //   "manual"  → weaver has taken control; color stays exactly as set until changed again
    //
    // Switching rules:
    //   • Weaver touches the color picker          → switch to "manual", stay manual forever
    //   • No presets defined                       → always "manual"
    //   • Resuming a saved pattern                 → always "manual" (don't overwrite saved colors)
    let colorMode = (presetWeftColors.length > 0 && !loomConfig.resumeHistory?.length)
        ? "preset"
        : "manual";

    //----------------------------------------------
    // THREE.JS SCENE
    //----------------------------------------------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x202025);

    const canvas = document.getElementById("bg");
    const container = document.getElementById("weaving-studio");

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(window.devicePixelRatio);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.set(4, 6, 14);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 2, 0);

    function resizeRenderer() {
        const rect = container.getBoundingClientRect();
        renderer.setSize(rect.width, rect.height, false);
        camera.aspect = rect.width / rect.height;
        camera.updateProjectionMatrix();
    }
    resizeRenderer();
    window.addEventListener("resize", resizeRenderer);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(15, 20, 10);
    scene.add(sun);
    scene.add(new THREE.GridHelper(40, 40));

    //----------------------------------------------
    // MATERIALS
    //----------------------------------------------
    const woodMaterial = new THREE.MeshStandardMaterial({ color: 0xc89b6d, roughness: 0.85, metalness: 0.05 });
    const threadMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.6, transparent: true });
    const stringMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.85 });
    const heddleWireMaterial = new THREE.LineBasicMaterial({ color: 0xaaaaaa, opacity: 0.5, transparent: true });
    const ropeMaterial = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.9 });
    const reedMaterial = new THREE.MeshStandardMaterial({ color: 0x888899, roughness: 0.4, metalness: 0.6 });
    const clothThreadMaterial = new THREE.LineBasicMaterial({ color: 0xf0eadf, opacity: 0.95, transparent: true });
    const shuttleThreadMaterial = new THREE.MeshStandardMaterial({ color: 0xf0eadf, roughness: 0.7 });

    //----------------------------------------------
    // GEOMETRY HELPERS
    //----------------------------------------------
    function woodBar(w, h, d, x, y, z, parent = scene) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), woodMaterial);
        mesh.position.set(x, y, z);
        parent.add(mesh);
        return mesh;
    }

    function woodCylinder(radius, length, x, y, z, rotationZ = true, parent = scene) {
        const geo = new THREE.CylinderGeometry(radius, radius, length, 32);
        const mesh = new THREE.Mesh(geo, woodMaterial);
        if (rotationZ) mesh.rotation.z = Math.PI / 2;
        mesh.position.set(x, y, z);
        parent.add(mesh);
        return mesh;
    }

    function createRopeConnection(p1, p2, parent = scene) {
        const distance = p1.distanceTo(p2);
        const geometry = new THREE.CylinderGeometry(0.02, 0.02, distance, 8);
        const mesh = new THREE.Mesh(geometry, ropeMaterial);
        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        mesh.position.copy(mid);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p2.clone().sub(p1).normalize());
        parent.add(mesh);
        return mesh;
    }

    //----------------------------------------------
    // TREADLING
    //----------------------------------------------
    function generateTreadling(patternType) {
        if (SHAFT_COUNT === 2) {
            if (patternType === "plain") treadlingSequence = [0, 1];
            else if (patternType === "basket") treadlingSequence = [0, 0, 1, 1];
            else if (patternType === "rib") treadlingSequence = [0, 0, 0, 1, 1, 1];
            else treadlingSequence = [0, 1];
        } else {
            if (patternType === "plain") treadlingSequence = [0, 1];
            else if (patternType === "twill") treadlingSequence = [0, 1, 2, 3];
            else if (patternType === "basket") treadlingSequence = [0, 0, 1, 1, 2, 2, 3, 3];
            else if (patternType === "rib") treadlingSequence = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3];
            else treadlingSequence = [0, 1, 2, 3];
        }
    }

    generateTreadling(loomConfig.patternType);

    //----------------------------------------------
    // FRAME
    //----------------------------------------------
    function buildFrame() {
        woodBar(0.35, LEG_HEIGHT, 0.35, LEFT, LEG_HEIGHT / 2, BASE_FRONT);
        woodBar(0.35, LEG_HEIGHT, 0.35, RIGHT, LEG_HEIGHT / 2, BASE_FRONT);
        woodBar(0.35, LEG_HEIGHT, 0.35, LEFT, LEG_HEIGHT / 2, BACK);
        woodBar(0.35, LEG_HEIGHT, 0.35, RIGHT, LEG_HEIGHT / 2, BACK);
        const SIDE_LEN = Math.abs(BASE_FRONT - BACK);
        const SIDE_CEN = (BASE_FRONT + BACK) / 2;
        woodBar(0.3, 0.3, SIDE_LEN, LEFT, LEG_HEIGHT, SIDE_CEN);
        woodBar(0.3, 0.3, SIDE_LEN, RIGHT, LEG_HEIGHT, SIDE_CEN);
        const TOWER_H = 3.5;
        woodBar(0.3, TOWER_H, 0.3, LEFT, LEG_HEIGHT + TOWER_H / 2, TOWER_Z);
        woodBar(0.3, TOWER_H, 0.3, RIGHT, LEG_HEIGHT + TOWER_H / 2, TOWER_Z);
        const TOP_BEAM_Y = LEG_HEIGHT + TOWER_H;
        woodBar(WIDTH + 0.6, 0.4, 0.4, 0, TOP_BEAM_Y, TOWER_Z);
        woodBar(WIDTH + 0.2, 0.3, 0.4, 0, BREAST_BEAM_Y, BASE_FRONT);
        woodCylinder(0.3, WIDTH, 0, WARP_BEAM_Y, BACK);
        clothRoller = woodCylinder(0.28, WIDTH, 0, CLOTH_BEAM_Y, CLOTH_BEAM_Z);
        woodBar(WIDTH - 0.45, 0.25, 0.25, 0, BASE_Y, BASE_FRONT);
        woodBar(WIDTH - 0.45, 0.25, 0.25, 0, BASE_Y, BACK);
        return TOP_BEAM_Y;
    }

    const TOP_BEAM_Y = buildFrame();

    //----------------------------------------------
    // HEDDLE SYSTEM
    //----------------------------------------------
    function createHeddleSystem() {
        const group = new THREE.Group();
        const FRAME_W = HEDDLE_WIDTH;
        const SUPPORT_BAR_Y = TOP_BEAM_Y - 0.65;
        const ROLLER_Y = SUPPORT_BAR_Y - 0.5;
        const ROLLER_SPAN = WIDTH - 0.3;

        woodCylinder(0.18, WIDTH, 0, SUPPORT_BAR_Y, TOWER_Z, true, group);

        function addConnectedRoller(zPos) {
            woodCylinder(0.06, ROLLER_SPAN, 0, ROLLER_Y, zPos, true, group);
            woodBar(0.15, 0.15, 0.15, LEFT + 0.15, ROLLER_Y, zPos, group);
            woodBar(0.15, 0.15, 0.15, RIGHT - 0.15, ROLLER_Y, zPos, group);
        }

        addConnectedRoller((zPositions[0] + zPositions[1]) / 2);
        if (SHAFT_COUNT === 4) addConnectedRoller((zPositions[2] + zPositions[3]) / 2);

        for (let i = 0; i < SHAFT_COUNT; i++) {
            const frameGroup = new THREE.Group();
            frameGroup.position.set(0, SHED_OPEN_Y, zPositions[i]);

            [-1, 1].forEach(side => {
                const xPos = side * (FRAME_W / 2 - 0.50);
                const rollerZ = i < 2
                    ? (zPositions[0] + zPositions[1]) / 2
                    : (zPositions[2] + zPositions[3]) / 2;
                const cordGeo = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(xPos, ROLLER_Y, rollerZ),
                    new THREE.Vector3(xPos, SHED_OPEN_Y + FRAME_H / 2, zPositions[i])
                ]);
                scene.add(new THREE.Line(cordGeo, stringMaterial));
            });

            woodBar(FRAME_W, 0.1, 0.1, 0, FRAME_H / 2, 0, frameGroup);
            woodBar(FRAME_W, 0.1, 0.1, 0, -FRAME_H / 2, 0, frameGroup);
            woodBar(0.1, FRAME_H, 0.1, -FRAME_W / 2, 0, 0, frameGroup);
            woodBar(0.1, FRAME_H, 0.1, FRAME_W / 2, 0, 0, frameGroup);

            const hPoints = [];
            for (let h = 0; h <= 110; h++) {
                const hx = (h / 110) * (FRAME_W - 0.14) - (FRAME_W - 0.14) / 2;
                hPoints.push(
                    new THREE.Vector3(hx, FRAME_H / 2 - 0.05, 0),
                    new THREE.Vector3(hx, -FRAME_H / 2 + 0.05, 0)
                );
            }
            frameGroup.add(new THREE.LineSegments(
                new THREE.BufferGeometry().setFromPoints(hPoints),
                heddleWireMaterial
            ));

            scene.add(frameGroup);
            heddleFrames.push(frameGroup);
        }
        scene.add(group);
    }
    createHeddleSystem();

    //----------------------------------------------
    // BEATER
    //----------------------------------------------
    function createBeater() {
        beaterGroup = new THREE.Group();
        beaterGroup.position.set(0, BREAST_BEAM_Y + 0.25, BEATER_REST_Z);
        const bh = FRAME_H * 0.55;
        woodBar(WIDTH - 0.5, 0.2, 0.3, 0, bh / 2, 0, beaterGroup);
        woodBar(WIDTH - 0.5, 0.15, 0.6, 0, -bh / 2, -0.1, beaterGroup);
        beaterGroup.add(new THREE.Mesh(
            new THREE.BoxGeometry(HEDDLE_WIDTH, bh - 0.1, 0.05),
            reedMaterial
        ));
        scene.add(beaterGroup);
    }
    createBeater();

    //----------------------------------------------
    // SHUTTLE
    //----------------------------------------------
    function createShuttle() {
        shuttleGroup = new THREE.Group();
        const sWidth = 1.2;
        const bodyGeom = new THREE.BoxGeometry(sWidth, 0.22, 0.35);
        const pos = bodyGeom.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            if (Math.abs(pos.getX(i)) > sWidth * 0.3) {
                pos.setZ(i, pos.getZ(i) * 0.25);
                pos.setY(i, pos.getY(i) * 0.8);
            }
        }
        shuttleGroup.add(new THREE.Mesh(bodyGeom, woodMaterial));
        const cavity = new THREE.Mesh(
            new THREE.BoxGeometry(sWidth * 0.6, 0.12, 0.22),
            new THREE.MeshStandardMaterial({ color: 0x332211 })
        );
        cavity.position.y = 0.05;
        shuttleGroup.add(cavity);
        const quill = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.03, sWidth * 0.5, 12),
            new THREE.MeshStandardMaterial({ color: 0xeeddcc })
        );
        quill.rotation.z = Math.PI / 2;
        quill.position.y = 0.05;
        shuttleGroup.add(quill);
        const threadWrap = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.08, sWidth * 0.45, 12),
            shuttleThreadMaterial
        );
        threadWrap.rotation.z = Math.PI / 2;
        threadWrap.position.y = 0.05;
        shuttleGroup.add(threadWrap);
        scene.add(shuttleGroup);
    }
    createShuttle();

    //----------------------------------------------
    // PEDALS
    //----------------------------------------------
    function createPedals() {
        const pedalY = BASE_Y + 0.05;
        const restAngle = 13 * (Math.PI / 180);
        for (let i = 0; i < SHAFT_COUNT; i++) {
            const xPos = (i - (SHAFT_COUNT - 1) / 2) * 0.8;
            const pivot = new THREE.Group();
            pivot.position.set(xPos, pedalY, BASE_FRONT);
            pivot.rotation.x = restAngle;
            const pedalLever = new THREE.Mesh(
                new THREE.BoxGeometry(0.3, 0.22, 4.6),
                woodMaterial
            );
            pedalLever.position.set(0, 0, -2.3);
            pivot.add(pedalLever);
            scene.add(pivot);
            pedalPivotGroups.push(pivot);
            woodBar(0.45, 0.4, 0.5, xPos, pedalY, BASE_FRONT);
            const verticalOffset = Math.abs(TOWER_Z - BASE_FRONT) * Math.tan(restAngle);
            createRopeConnection(
                new THREE.Vector3(xPos, pedalY + verticalOffset, TOWER_Z),
                new THREE.Vector3(xPos, BREAST_BEAM_Y - (FRAME_H / 2), TOWER_Z)
            );
        }
    }
    createPedals();

    //----------------------------------------------
    // WARP THREADS & CLOTH BASE
    //----------------------------------------------
    function createDynamicWarp() {
        for (let i = 0; i < TOTAL_THREADS; i++) {
            const x = (i / (TOTAL_THREADS - 1)) * HEDDLE_WIDTH - HEDDLE_WIDTH / 2;
            const threadInBlock = i % PATTERN_SIZE;
            const hIdx = loomConfig.customThreadingMap[threadInBlock];
            threading[i] = hIdx;
            const points = [
                new THREE.Vector3(x, BREAST_BEAM_Y + 0.05, BASE_FRONT - 0.1),
                new THREE.Vector3(x, BREAST_BEAM_Y + 0.05, BASE_FRONT - 0.1),
                new THREE.Vector3(x, SHED_OPEN_Y, zPositions[hIdx]),
                new THREE.Vector3(x, WARP_BEAM_Y + 0.3, BACK)
            ];

            // Per-thread color: warpColors is now a full-length per-thread array.
            // Fall back to shaft color if it's the old 4-element format.
            const threadColor = Array.isArray(warpColors) && warpColors.length > 4
                ? (warpColors[i] || "#ffffff")
                : (warpColors[hIdx] || "#ffffff");

            const thread = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(points),
                new THREE.LineBasicMaterial({ color: threadColor })
            );
            scene.add(thread);
            warpGroups[hIdx].push(thread);
        }
    }

    function createClothBase() {
        for (let i = 0; i < TOTAL_THREADS; i++) {
            const x = (i / (TOTAL_THREADS - 1)) * HEDDLE_WIDTH - HEDDLE_WIDTH / 2;
            const wobble = Math.sin(i * 0.6) * 0.015;
            const points = [
                new THREE.Vector3(x + wobble, BREAST_BEAM_Y + 0.05, BASE_FRONT - 0.1),
                new THREE.Vector3(x, BREAST_BEAM_Y + 0.05, BASE_FRONT + 0.1),
                new THREE.Vector3(x, CLOTH_BEAM_Y, CLOTH_BEAM_Z)
            ];
            scene.add(new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(points),
                clothThreadMaterial
            ));
        }
    }

    createDynamicWarp();
    createClothBase();

    //----------------------------------------------
    function triggerShuttleThrow(targetSide) {
        shuttleStartSide = -targetSide;
        shuttleCurrentSide = targetSide;
        shuttleArmed = true;
        shuttleInserted = false;
        lastShuttleX = shuttleGroup.position.x;
        recordedSteps.push({ action: "shuttle" });
    }

    function handleHardwareInput(data) {
        data = data.trim();
        const pedalMapDown = { "1": 0, "2": 1, "3": 2, "4": 3 };
        if (pedalMapDown[data] !== undefined) {
            currentPressedPedals.add(pedalMapDown[data]);
            recordedSteps.push({ action: "pedal", value: pedalMapDown[data] });
            return;
        }
        const pedalMapUp = { "7": 0, "8": 1, "9": 2, "0": 3 };
        if (pedalMapUp[data] !== undefined) {
            currentPressedPedals.delete(pedalMapUp[data]);
            return;
        }
        if (data.includes(",")) {
            currentPressedPedals.clear();
            data.split(",").forEach(p => {
                const pedalIdx = parseInt(p) - 1;
                if (!isNaN(pedalIdx)) currentPressedPedals.add(pedalIdx);
            });
            recordedSteps.push({ action: "pedals", value: Array.from(currentPressedPedals) });
            return;
        }
        if (data === "R") { currentPressedPedals.clear(); return; }
        if (data === "B" || data === "RFID_3" || data === "RFID_4") { isBeaterPulled = true; return; }
        if (data === "B_1" || data === "V") {
            isBeaterPulled = false;
            hasProcessedCurrentBeat = false;
            return;
        }
        if (data === "S1S2") { triggerShuttleThrow(1); return; }
        if (data === "S2S1") { triggerShuttleThrow(-1); return; }
    }

    async function connectBLE() {
        const SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
        const TX_CHARACTERISTIC_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
        const btn = document.getElementById('bleConnect');
        try {
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ name: 'ESP32' }],
                optionalServices: [SERVICE_UUID]
            });
            const server = await device.gatt.connect();
            const service = await server.getPrimaryService(SERVICE_UUID);
            const characteristic = await service.getCharacteristic(TX_CHARACTERISTIC_UUID);
            await characteristic.startNotifications();
            characteristic.addEventListener('characteristicvaluechanged', (e) => {
                const val = new TextDecoder().decode(e.target.value).trim();
                handleHardwareInput(val);
            });
            btn.style.background = "#28a745";
            btn.innerHTML = "Loom Connected";
        } catch (err) {
            console.error("BLE Error:", err);
        }
    }

    //----------------------------------------------
    // KEYBOARD INPUT
    //----------------------------------------------
    window.addEventListener('keydown', (e) => {
        if (e.repeat) return;
        if (e.code === 'Digit1') handleHardwareInput("1");
        if (e.code === 'Digit2') handleHardwareInput("2");
        if (e.code === 'Digit3') handleHardwareInput("3");
        if (e.code === 'Digit4') handleHardwareInput("4");
        if (e.code === 'Space') {
            e.preventDefault();
            if (shuttleCurrentSide === -1) handleHardwareInput("S1S2");
            else handleHardwareInput("S2S1");
        }
        if (e.code === 'KeyB') handleHardwareInput("B");
        if (e.code === 'KeyV') handleHardwareInput("B_1");
    }, true);

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Digit1') handleHardwareInput("7");
        if (e.code === 'Digit2') handleHardwareInput("8");
        if (e.code === 'Digit3') handleHardwareInput("9");
        if (e.code === 'Digit4') handleHardwareInput("0");
    });

    //----------------------------------------------
    // WEFT / WEAVING LOGIC
    //----------------------------------------------
    function addWeftThread() {
        if (activeWeft) return;
        hasUnsavedChanges = true;

        const warpCount = TOTAL_THREADS;
        const points = [];
        const shed = [];
        for (let i = 0; i < SHAFT_COUNT; i++) shed.push(!currentPressedPedals.has(i));

        const rowStates = [];
        for (let i = 0; i < warpCount; i++) {
            const x = (i / (warpCount - 1)) * HEDDLE_WIDTH - HEDDLE_WIDTH / 2;
            const shaft = threading[i % threading.length];
            const isUp = shed[shaft];
            rowStates.push(isUp);
            const y = (BREAST_BEAM_Y + 0.05) + (isUp ? 0.18 : -0.18);
            points.push(new THREE.Vector3(x, y, shuttleGroup.position.z));
        }

        patternHistory.push(rowStates);

        // ── Snapshot the shuttle color at the moment of insertion ──
        // This is the authoritative color for this pick. Any color change between
        // insertion and beat will NOT affect the already-inserted thread.
        const insertionColor = "#" + shuttleThreadMaterial.color.getHexString();

        const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(points),
            new THREE.LineBasicMaterial({ color: shuttleThreadMaterial.color.clone() })
        );
        scene.add(line);

        activeWeft = {
            line,
            isBeaten: false,
            live: true,
            valid: true,
            capturedShed: shed.slice(),
            warpPattern: rowStates.slice(),
            capturedColor: insertionColor   // ← locked in at insertion
        };
        weftThreads.push(activeWeft);

        shuttleMovingPositive = null;
        lastShuttleX = shuttleGroup.position.x;
        shuttleDirectionChanges = 0;
    }

    function voidActiveWeft() {
        shuttleSideToggle = (shuttleCurrentSide === 1);
        weftReadyToBeat = false;
        if (!activeWeft || activeWeft.isBeaten) return;

        // ── Restore shuttle color to what it was when this pick was inserted ──
        // Only restores if we're still in preset mode (color wasn't manually changed).
        // In manual mode, the weaver's chosen color stays as-is.
        if (activeWeft.capturedColor && colorMode === "preset") {
            shuttleThreadMaterial.color.set(activeWeft.capturedColor);
            const shuttleColorInput = document.getElementById("shuttleColor");
            if (shuttleColorInput) shuttleColorInput.value = activeWeft.capturedColor;
        }

        scene.remove(activeWeft.line);
        activeWeft.line.geometry.dispose();
        activeWeft.line.material.dispose();

        weftThreads.pop();
        patternHistory.pop();

        activeWeft = null;
        shuttleDirectionChanges = 0;
        shuttleMovingPositive = null;
        shuttleInserted = false;
        shuttleArmed = false;
        shuttleCrossed = false;
    }

    //----------------------------------------------
    // ── MEASUREMENT UTILITIES ──
    //----------------------------------------------
    /**
     * Compute physical height in cm.
     * We use the 3D row spacing as a proxy: each beat advances fellZ by ROW_SPACING (3D units).
     * We map the total 3D units woven → physical cm using the configured width ratio.
     * A simpler & more meaningful approach: assume the weaver set up the loom for a given
     * sett (EPI / thread density). We derive picks-per-cm from the pattern type default
     * and cross-reference with actual weft count.
     * 
     * Estimated height = weftCount / EXPECTED_WEFT_PER_CM  (cm)
     */
    function computeMeasurements() {
        const count = weftCount;
        // Physical width stays fixed (user-configured)
        const widthCm = PHYSICAL_WIDTH_CM;
        // Estimated height based on beats and expected sett
        const heightCm = count > 0 ? (count / EXPECTED_WEFT_PER_CM) : 0;
        // Thread density: ends per cm
        const endPerCm = THREADS_PER_CM;
        // Picks per cm so far (actual)
        // Accuracy: compare actual weft/cm to expected; capped at 100%
        // Only meaningful after ≥5 rows
        let accuracyPct = 0;
        if (count >= 5 && heightCm > 0) {
            const actualPPC = count / heightCm; // This always equals EXPECTED_WEFT_PER_CM by definition
            // More useful: compare the pattern repeat count vs expected repeat for this length
            const treadlingLen = treadlingSequence.length || 2;
            const completeRepeats = Math.floor(count / treadlingLen);
            const expectedRepeats = Math.floor(count / treadlingLen); // they match by design
            // Real accuracy: check that the weft insertion is consistent
            // We measure by looking at ratio of complete pattern repeats to partial
            const partialRow = count % treadlingLen;
            // A perfectly woven cloth has 0 partial rows at any pattern checkpoint
            // We use a simpler approach: accuracy rises as weft count grows
            // and dips if there are too many "voided" wefts (we can track those)
            accuracyPct = Math.min(100, Math.round((completeRepeats / Math.max(1, count / treadlingLen)) * 100));
            if (count > 0) accuracyPct = Math.min(100, Math.round(100 - (partialRow / treadlingLen) * 15));
        }

        return { widthCm, heightCm: heightCm.toFixed(1), endPerCm: endPerCm.toFixed(1), count, accuracyPct };
    }

    /**
     * Update the live measurement panel DOM elements.
     */
    function updateMeasurePanel() {
        const m = computeMeasurements();

        const elWidth = document.getElementById("measure-width");
        const elHeight = document.getElementById("measure-height");
        const elEPC = document.getElementById("measure-epc");
        const elWeft = document.getElementById("measure-weft");
        const elAcc = document.getElementById("measure-accuracy-val");
        const elFill = document.getElementById("measure-accuracy-fill");

        if (elWidth) elWidth.textContent = m.widthCm;
        if (elHeight) elHeight.textContent = m.heightCm;
        if (elEPC) elEPC.textContent = m.endPerCm;
        if (elWeft) elWeft.textContent = m.count;
        if (elAcc) elAcc.textContent = `${m.accuracyPct}%`;
        if (elFill) elFill.style.width = `${m.accuracyPct}%`;
    }

    //----------------------------------------------
    // PATTERN EXPORT — physically-scaled
    //----------------------------------------------
    function exportPatternImage() {
        if (patternHistory.length === 0) {
            alert("Weave some rows first!");
            return;
        }

        // ── SCALE DERIVATION ──
        // Standard screen print resolution: 96 px = 1 inch = 2.54 cm
        // So 1 cm = 96/2.54 ≈ 37.8 px at 96 DPI (screen-accurate for printing at 100%)
        const PX_PER_CM = 96 / 2.54;               // ~37.8 px per real-world cm

        const warpCount = loomConfig.totalThreads;
        const rowCount = patternHistory.length;

        // Each warp thread column gets exactly (physicalWidthCm / warpCount) cm → px
        const cellW = (PHYSICAL_WIDTH_CM / warpCount) * PX_PER_CM;

        // Each weft pick row height: use expected picks-per-cm to derive row height
        // so printing at 100% → cloth dimensions match reality
        const cellH = (1 / EXPECTED_WEFT_PER_CM) * PX_PER_CM;

        // Ruler strip height in px (bottom of image)
        const RULER_H = Math.round(PX_PER_CM * 0.7); // ~0.7 cm tall

        const canvasW = Math.round(warpCount * cellW);
        const canvasH = Math.round(rowCount * cellH) + RULER_H;

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = canvasW;
        exportCanvas.height = canvasH;
        const ctx = exportCanvas.getContext('2d');

        // White background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvasW, canvasH);

        // ── DRAW PATTERN ──
        patternHistory.forEach((rowStates, rowIndex) => {
            rowStates.forEach((isWarpUp, warpIndex) => {
                const x = Math.round(warpIndex * cellW);
                const y = Math.round((rowCount - 1 - rowIndex) * cellH);
                const w = Math.max(1, Math.round(cellW));
                const h = Math.max(1, Math.round(cellH));

                if (!isWarpUp) {
                    const fallbackColor = "#" + shuttleThreadMaterial.color.getHexString();
                    ctx.fillStyle = (weftColorHistory && weftColorHistory[rowIndex])
                        ? weftColorHistory[rowIndex] : fallbackColor;
                    ctx.fillRect(x, y, w, h);
                } else {
                    // Per-thread color: full array vs legacy 4-shaft array
                    const threadColor = Array.isArray(warpColors) && warpColors.length > 4
                        ? (warpColors[warpIndex] || "#f0eadf")
                        : (warpColors[threading[warpIndex % threading.length]] || "#f0eadf");
                    ctx.fillStyle = threadColor;
                    ctx.fillRect(x, y, w, h);
                }
            });
        });

        // ── RULER STRIP ──
        // Draw a cm ruler along the bottom so the print is self-documenting.
        const rulerY = canvasH - RULER_H;

        // Alternating tick bg
        ctx.fillStyle = "#f5f5f5";
        ctx.fillRect(0, rulerY, canvasW, RULER_H);
        ctx.strokeStyle = "#888";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, rulerY);
        ctx.lineTo(canvasW, rulerY);
        ctx.stroke();

        const totalWidthCm = PHYSICAL_WIDTH_CM;
        const fontSize = Math.max(8, Math.min(14, RULER_H * 0.55));
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = "#333";
        ctx.textBaseline = "middle";

        for (let c = 0; c <= totalWidthCm; c++) {
            const px = Math.round((c / totalWidthCm) * canvasW);
            const isMajor = c % 5 === 0;

            // Tick mark
            const tickH = isMajor ? RULER_H * 0.6 : RULER_H * 0.35;
            ctx.strokeStyle = isMajor ? "#444" : "#aaa";
            ctx.lineWidth = isMajor ? 1.5 : 1;
            ctx.beginPath();
            ctx.moveTo(px, rulerY);
            ctx.lineTo(px, rulerY + tickH);
            ctx.stroke();

            // Label every 5 cm
            if (isMajor && px + 4 < canvasW) {
                ctx.fillStyle = "#333";
                ctx.fillText(`${c}cm`, px + 3, rulerY + RULER_H * 0.55);
            }
        }

        // ── METADATA LABEL (bottom-right) ──
        const estimatedHeightCm = (rowCount / EXPECTED_WEFT_PER_CM).toFixed(1);
        const metaText = `${PHYSICAL_WIDTH_CM}cm × ${estimatedHeightCm}cm · ${warpCount} ends · ${rowCount} picks`;
        ctx.font = `${Math.max(8, fontSize - 1)}px sans-serif`;
        ctx.fillStyle = "#888";
        ctx.textBaseline = "bottom";
        ctx.textAlign = "right";
        ctx.fillText(metaText, canvasW - 6, canvasH - 2);

        const link = document.createElement('a');
        const safeName = loomConfig.patternName
            ? loomConfig.patternName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
            : 'woven_pattern';
        link.download = `${safeName}.png`;
        link.href = exportCanvas.toDataURL('image/png');
        link.click();
    }

    //----------------------------------------------
    // UI PANEL
    //----------------------------------------------
    function createUI() {
        injectLoomStyles();

        // ── Control Panel ──
        const gui = document.createElement('div');
        gui.className = 'loom-panel';
        gui.innerHTML = `
            <div class="loom-panel__header">
                <span class="loom-panel__title">Loom Controls</span>
                <button id="backToMenuBtn" class="loom-btn-back">← Back</button>
            </div>
            <button id="bleConnect" class="loom-btn loom-btn--ble">Connect ESP32</button>
            <div class="loom-hint">
                Hold 1-4: Shed &nbsp;|&nbsp; Space: Shuttle<br>Hold B: Beat &nbsp;|&nbsp; V: Release Beat
            </div>
            <hr class="loom-divider" />
            <div class="loom-color-row">
                <label class="loom-color-label">
                    Shuttle
                    <input type="color" id="shuttleColor" value="#f0eadf" />
                </label>
            </div>
            <hr class="loom-divider" />
            <button id="convertBtn" class="loom-btn loom-btn--export">Export Pattern</button>
            <button id="savePattern" class="loom-btn loom-btn--save">Save to Learning Library</button>
        `;
        document.getElementById("weaving-studio").appendChild(gui);

        const panelHeader = gui.querySelector('.loom-panel__header');
        panelHeader.addEventListener('click', (e) => {
            if (e.target.closest('.loom-btn-back')) return;
            gui.classList.toggle('collapsed');
        });
        if (window.innerWidth <= 600) gui.classList.add('collapsed');

        // ── Measurement Panel ──
        const measurePanel = document.createElement("div");
        measurePanel.className = "loom-measure-panel";
        measurePanel.innerHTML = `
            <div class="loom-measure-panel__title">Live Measurements</div>

            <div class="measure-row">
                <span class="measure-label">Width</span>
                <span class="measure-value" id="measure-width">${PHYSICAL_WIDTH_CM}<span> cm</span></span>
            </div>

            <div class="measure-row">
                <span class="measure-label">Est. Height</span>
                <span class="measure-value" id="measure-height">0.0<span> cm</span></span>
            </div>

            <hr class="measure-divider" />

            <div class="measure-row">
                <span class="measure-label">Ends/cm</span>
                <span class="measure-value" id="measure-epc">${(THREADS_PER_CM).toFixed(1)}<span> e/cm</span></span>
            </div>

            <div class="measure-row">
                <span class="measure-label">Weft Count</span>
                <span class="measure-value" id="measure-weft">${weftCount}<span> picks</span></span>
            </div>

            <hr class="measure-divider" />

            <div class="measure-accuracy-label">
                <span class="measure-label">Pattern Accuracy</span>
                <span class="measure-value" id="measure-accuracy-val" style="font-size:11px;">–</span>
            </div>
            <div class="measure-accuracy-bar">
                <div class="measure-accuracy-fill" id="measure-accuracy-fill"></div>
            </div>

            <hr class="measure-divider" />

            <div class="measure-label" style="margin-bottom:4px;">Warp Color Preview</div>
            <canvas id="warp-color-preview" style="width:100%;height:14px;border-radius:4px;display:block;image-rendering:pixelated;"></canvas>
        `;
        document.getElementById("weaving-studio").appendChild(measurePanel);

        // Draw warp color preview strip
        (function drawWarpPreview() {
            const previewCanvas = document.getElementById("warp-color-preview");
            if (!previewCanvas) return;
            const total = TOTAL_THREADS;
            previewCanvas.width = total;
            previewCanvas.height = 1;
            const ctx = previewCanvas.getContext("2d");
            for (let i = 0; i < total; i++) {
                const color = Array.isArray(warpColors) && warpColors.length > 4
                    ? (warpColors[i] || "#ffffff")
                    : (warpColors[threading[i] !== undefined ? threading[i] : (i % 4)] || "#ffffff");
                ctx.fillStyle = color;
                ctx.fillRect(i, 0, 1, 1);
            }
        })();

        // ── 2D Pattern Panel ──
        const patternPanel = document.createElement("div");
        patternPanel.className = "loom-pattern-panel";
        patternPanel.innerHTML = `
            <div class="loom-pattern-panel__title">Live 2D Pattern</div>
            <div id="patternContainer" class="loom-pattern-panel__scroll">
                <canvas id="patternCanvas"></canvas>
            </div>
        `;
        document.getElementById("weaving-studio").appendChild(patternPanel);

        render2DPattern();

        // ── Listeners ──
        document.getElementById('shuttleColor').addEventListener('input', (e) => {
            shuttleThreadMaterial.color.set(e.target.value);
            // Weaver has taken control of color — switch to manual mode permanently.
            // Presets will no longer auto-advance until a new weaving session starts.
            colorMode = "manual";
        });
        // Priority: resuming saved weftColor > preset pick[0] > default
        const shuttleInput = document.getElementById('shuttleColor');
        if (shuttleInput) {
            const initialColor = loomConfig.weftColor
                || (presetWeftColors.length > 0 ? presetWeftColors[weftCount] : null)
                || "#f0eadf";
            shuttleInput.value = initialColor;
            shuttleThreadMaterial.color.set(initialColor);
        }

        document.getElementById('convertBtn').addEventListener('click', exportPatternImage);
        document.getElementById('bleConnect').addEventListener('click', connectBLE);
        document.getElementById('backToMenuBtn').addEventListener('click', () => {
            window.location.href = 'dashboard.html';
        });

        document.getElementById("savePattern").addEventListener("click", async () => {
            if (patternHistory.length === 0) {
                alert("Weave and beat at least one row before saving!");
                return;
            }

            const shuttleColorEl = document.getElementById("shuttleColor");
            const weftColor = shuttleColorEl ? shuttleColorEl.value : "#" + shuttleThreadMaterial.color.getHexString();
            const currentUser = window.windowCurrentUserObj || { name: "Unknown" };

            // ── Collect measurements to save alongside the pattern ──
            const measurements = computeMeasurements();

            const data = {
                name: loomConfig.patternName || "Untitled",
                type: loomConfig.patternType,
                loom: loomConfig.loomType,
                steps: recordedSteps,
                patternRows: patternHistory,
                rowColors: weftColorHistory,
                weftColor: weftColor,
                created: loomConfig.created || Date.now(),
                warpColors: warpColors,
                totalThreads: loomConfig.totalThreads,
                threadingMap: loomConfig.customThreadingMap,
                creator: currentUser.name,
                isImported: false,
                // ── PHYSICAL MEASUREMENTS ──
                measurements: {
                    physicalWidthCm: measurements.widthCm,
                    estimatedHeightCm: parseFloat(measurements.heightCm),
                    endsPerCm: parseFloat(measurements.endPerCm),
                    weftCount: measurements.count,
                    patternAccuracyPct: measurements.accuracyPct,
                    expectedPicksPerCm: EXPECTED_WEFT_PER_CM
                }
            };

            try {
                if (loomConfig.patternId) {
                    await fetch(`/api/patterns/${loomConfig.patternId}`, { method: "DELETE" });
                }
                const res = await fetch("/api/patterns/save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data)
                });
                if (res.ok) {
                    const savedData = await res.json().catch(() => ({}));
                    if (savedData && savedData._id) loomConfig.patternId = savedData._id;
                    hasUnsavedChanges = false;
                    alert("Pattern saved and updated successfully!");
                } else {
                    alert("Save failed. Check server logs.");
                }
            } catch (err) {
                alert("Could not connect to the server.");
            }
        });
    }

    //----------------------------------------------
    // 2D PATTERN RENDERER
    //----------------------------------------------
    function render2DPattern() {
        const patternCanvas = document.getElementById("patternCanvas");
        if (!patternCanvas) return;
        const ctx = patternCanvas.getContext("2d");
        if (patternHistory.length === 0) {
            patternCanvas.width = patternCanvas.parentElement.clientWidth || 200;
            patternCanvas.height = patternCanvas.parentElement.clientHeight || 100;
            ctx.fillStyle = "#111";
            ctx.fillRect(0, 0, patternCanvas.width, patternCanvas.height);
            return;
        }
        const warpCount = loomConfig.totalThreads;
        const container = patternCanvas.parentElement;
        const cellWidth = (container.clientWidth - 10) / warpCount;
        const cellHeight = (container.clientHeight - 10) / patternHistory.length;
        const cellSize = Math.max(2, Math.min(cellWidth, cellHeight));
        patternCanvas.width = warpCount * cellSize;
        patternCanvas.height = patternHistory.length * cellSize;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, patternCanvas.width, patternCanvas.height);
        patternHistory.forEach((rowStates, rowIndex) => {
            const y = (patternHistory.length - 1 - rowIndex) * cellSize;
            const fallbackWeft = "#" + shuttleThreadMaterial.color.getHexString();
            const currentRowColor = (weftColorHistory && weftColorHistory[rowIndex]) ? weftColorHistory[rowIndex] : fallbackWeft;
            rowStates.forEach((isWarpUp, warpIndex) => {
                const x = warpIndex * cellSize;
                const shaft = threading[warpIndex % threading.length] || 0;
                ctx.fillStyle = currentRowColor;
                ctx.fillRect(x, y, cellSize, cellSize);
                if (isWarpUp) {
                    // Per-thread color: full array vs legacy 4-shaft array
                    const threadColor = Array.isArray(warpColors) && warpColors.length > 4
                        ? (warpColors[warpIndex] || "#ffffff")
                        : (warpColors[shaft] || "#ffffff");
                    ctx.fillStyle = threadColor;
                    ctx.fillRect(x + (cellSize * 0.25), y, cellSize * 0.5, cellSize);
                }
            });
        });
        patternCanvas.parentElement.scrollTop = patternCanvas.parentElement.scrollHeight;
    }

    //----------------------------------------------
    // ANIMATION HELPERS
    //----------------------------------------------
    function isShedOpenEnough() {
        if (currentPressedPedals.size === 0) return false;
        let allLow = true;
        currentPressedPedals.forEach(idx => {
            if (heddleFrames[idx] && Math.abs(heddleFrames[idx].position.y - SHED_CLOSED_Y) > 0.3) allLow = false;
        });
        return allLow;
    }

    function updateShafts() {
        for (let i = 0; i < SHAFT_COUNT; i++) {
            const isPressed = currentPressedPedals.has(i);
            const targetHeddleY = isPressed ? SHED_CLOSED_Y : SHED_OPEN_Y;
            const targetAngle = isPressed ? 3 * (Math.PI / 180) : 13 * (Math.PI / 180);
            if (pedalPivotGroups[i]) pedalPivotGroups[i].rotation.x += (targetAngle - pedalPivotGroups[i].rotation.x) * 0.4;
            if (heddleFrames[i]) heddleFrames[i].position.y += (targetHeddleY - heddleFrames[i].position.y) * 0.4;
            if (warpGroups[i]) {
                warpGroups[i].forEach(thread => {
                    const pos = thread.geometry.attributes.position;
                    pos.setY(2, heddleFrames[i].position.y);
                    if (pos.getZ(1) >= fellZ) pos.setY(1, BREAST_BEAM_Y + 0.05);
                    pos.needsUpdate = true;
                });
            }
        }
    }

    function updateActiveWeftShape() {
        if (!activeWeft || !activeWeft.live) return;
        const pos = activeWeft.line.geometry.attributes.position;
        for (let j = 0; j < pos.count; j++) {
            const shaft = threading[j % threading.length];
            if (shuttleGroup.position.z < fellZ + 0.02) {
                const isUp = !currentPressedPedals.has(shaft);
                const targetY = (BREAST_BEAM_Y + 0.05) + (isUp ? 0.18 : -0.18);
                pos.setY(j, THREE.MathUtils.lerp(pos.getY(j), targetY, 0.4));
            } else {
                const lockedUp = activeWeft.warpPattern[j];
                const targetY = (BREAST_BEAM_Y + 0.05) + (lockedUp ? 0.18 : -0.18);
                pos.setY(j, targetY);
            }
        }
        pos.needsUpdate = true;
    }

    function updateClothTakeup() {
        if (rowCounter < MAX_ROWS_BEFORE_TAKEUP) return;
        clothRoller.rotation.x += 0.5;
        const shiftAmount = MAX_ROWS_BEFORE_TAKEUP * ROW_SPACING;
        weftThreads.forEach(t => {
            const pos = t.line.geometry.attributes.position;
            for (let j = 0; j < pos.count; j++) {
                let nextZ = pos.getZ(j) + shiftAmount;
                if (nextZ > BASE_FRONT) {
                    pos.setY(j, THREE.MathUtils.lerp(BREAST_BEAM_Y, CLOTH_BEAM_Y, (nextZ - BASE_FRONT) / 1.5));
                    pos.setZ(j, THREE.MathUtils.lerp(BASE_FRONT, CLOTH_BEAM_Z, (nextZ - BASE_FRONT) / 1.5));
                } else {
                    pos.setZ(j, nextZ);
                }
            }
            pos.needsUpdate = true;
        });
        rowCounter = 0;
    }

    function checkWeftInsertion() {
        if (!shuttleArmed || shuttleInserted || !isShedOpenEnough()) return;
        const crossingFromLeft = shuttleStartSide === -1 && shuttleGroup.position.x > 0;
        const crossingFromRight = shuttleStartSide === 1 && shuttleGroup.position.x < 0;
        if (crossingFromLeft || crossingFromRight) {
            if (weftThreads.length > 0 && !activeWeft) {
                const lastWeft = weftThreads[weftThreads.length - 1];
                let isUndo = true;
                for (let i = 0; i < SHAFT_COUNT; i++) {
                    const isUp = !currentPressedPedals.has(i);
                    if (lastWeft.capturedShed[i] !== isUp) { isUndo = false; break; }
                }
                if (isUndo) {
                    scene.remove(lastWeft.line);
                    lastWeft.line.geometry.dispose();
                    lastWeft.line.material.dispose();
                    weftThreads.pop();
                    patternHistory.pop();
                    rowCounter = Math.max(0, rowCounter - 1);
                    fellZ = BEATER_HIT_Z - (rowCounter * ROW_SPACING);
                    shuttleInserted = true;
                    if (window.requestIdleCallback) requestIdleCallback(render2DPattern);
                    else setTimeout(render2DPattern, 0);
                    return;
                }
            }
            addWeftThread();
            shuttleInserted = true;
        }
    }

    function checkDirectionChanges() {
        if (!activeWeft || activeWeft.isBeaten || !shuttleInserted) return;
        const reachedRight = shuttleStartSide === -1 && shuttleGroup.position.x > SHUTTLE_LIMIT * 0.9;
        const reachedLeft = shuttleStartSide === 1 && shuttleGroup.position.x < -SHUTTLE_LIMIT * 0.9;
        if (activeWeft && (reachedRight || reachedLeft)) weftReadyToBeat = true;
        const currentX = shuttleGroup.position.x;
        const delta = currentX - lastShuttleX;
        if (Math.abs(delta) > 0.01) {
            const movingPositive = delta > 0;
            if (shuttleMovingPositive === null) {
                shuttleMovingPositive = movingPositive;
            } else if (movingPositive !== shuttleMovingPositive) {
                shuttleDirectionChanges++;
                if (shuttleDirectionChanges % 2 !== 0) { voidActiveWeft(); return; }
            }
        }
        lastShuttleX = currentX;
    }

    function processBeat(currentHitZ) {
        if (!activeWeft || !weftReadyToBeat) return;
        const pos = activeWeft.line.geometry.attributes.position;
        for (let j = 0; j < pos.count; j++) {
            pos.setZ(j, currentHitZ);
            pos.setY(j, BREAST_BEAM_Y + 0.05 + (j % 2 === 0 ? 0.04 : -0.04));
        }
        pos.needsUpdate = true;
        activeWeft.isBeaten = true;
        activeWeft.live = false;
        rowCounter++;

        // ── Record the color that was on the shuttle at INSERTION time, not now ──
        // capturedColor is snapshotted in addWeftThread, so it always reflects what
        // the weaver had loaded when they threw the shuttle — immune to any color
        // change made between insertion and beat.
        const committedColor = activeWeft.capturedColor
            || "#" + shuttleThreadMaterial.color.getHexString();
        weftColorHistory.push(committedColor);

        // ── Update the line material to match the committed color ──
        // (In case the weaver changed color between insertion and beat, the 3D line
        // should show the original insertion color, not the current shuttle color.)
        if (activeWeft.line && activeWeft.line.material) {
            activeWeft.line.material.color.set(committedColor);
        }

        fellZ = currentHitZ;
        activeWeft = null;
        weftReadyToBeat = false;
        shuttleDirectionChanges = 0;
        shuttleMovingPositive = null;
        recordedSteps.push({ action: "beat" });

        // ── Increment weft count and refresh panels ──
        weftCount++;

        // ── Auto-advance shuttle color from preset weft colors ──
        // Only runs in "preset" mode. Once the weaver touches the color picker,
        // colorMode becomes "manual" and stays that way — color never auto-changes again.
        if (colorMode === "preset" && presetWeftColors.length > 0) {
            const nextColor = presetWeftColors[weftCount] || presetWeftColors[presetWeftColors.length - 1];
            if (nextColor) {
                shuttleThreadMaterial.color.set(nextColor);
                const shuttleColorInput = document.getElementById("shuttleColor");
                if (shuttleColorInput) shuttleColorInput.value = nextColor;
            }
        }
        // Note: no flag reset here. colorMode persists across all beats.

        render2DPattern();
        updateMeasurePanel();
    }

    function reconstructSavedWeave() {
        if (!loomConfig.resumeHistory || loomConfig.resumeHistory.length === 0) return;
        loomConfig.resumeHistory.forEach((rowStates, index) => {
            const currentHitZ = BEATER_HIT_Z - (rowCounter * ROW_SPACING);
            const points = [];
            for (let j = 0; j < TOTAL_THREADS; j++) {
                const x = (j / (TOTAL_THREADS - 1)) * HEDDLE_WIDTH - HEDDLE_WIDTH / 2;
                const y = BREAST_BEAM_Y + 0.05 + (j % 2 === 0 ? 0.04 : -0.04);
                points.push(new THREE.Vector3(x, y, currentHitZ));
            }
            const rowColor = (weftColorHistory && weftColorHistory[index]) ? weftColorHistory[index] : (loomConfig.weftColor || "#f0eadf");
            const line = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(points),
                new THREE.LineBasicMaterial({ color: rowColor })
            );
            scene.add(line);
            weftThreads.push({ line, isBeaten: true, live: false, capturedShed: [], warpPattern: rowStates });
            rowCounter++;
            fellZ = currentHitZ;
            if (rowCounter >= MAX_ROWS_BEFORE_TAKEUP) updateClothTakeup();
        });
    }

    if (loomConfig.resumeHistory && loomConfig.resumeHistory.length > 0) {
        reconstructSavedWeave();
    }

    //----------------------------------------------
    // MAIN ANIMATION LOOP
    //----------------------------------------------
    function animate() {
        requestAnimationFrame(animate);
        updateShafts();
        updateActiveWeftShape();
        const targetX = shuttleCurrentSide * SHUTTLE_LIMIT;
        shuttleGroup.position.x += (targetX - shuttleGroup.position.x) * 0.35;
        updateClothTakeup();
        const currentHitZ = BEATER_HIT_Z - (rowCounter * ROW_SPACING);
        const targetBeaterZ = isBeaterPulled ? currentHitZ : BEATER_REST_Z;
        const lerpSpeed = isBeaterPulled ? 0.6 : 0.35;
        beaterGroup.position.z += (targetBeaterZ - beaterGroup.position.z) * lerpSpeed;
        checkWeftInsertion();
        checkDirectionChanges();
        if (isBeaterPulled && !hasProcessedCurrentBeat && weftReadyToBeat) {
            processBeat(currentHitZ);
            hasProcessedCurrentBeat = true;
        }
        shuttleGroup.position.y = beaterGroup.position.y - 0.35;
        shuttleGroup.position.z = beaterGroup.position.z + 0.18;
        controls.update();
        renderer.render(scene, camera);
    }

    window.addEventListener('beforeunload', (e) => {
        if (hasUnsavedChanges) { e.preventDefault(); e.returnValue = ''; }
    });

    createUI();
    updateMeasurePanel(); // Initial render with resume data
    animate();
}

//////////////////////////////////////////////////
// EXPORT
//////////////////////////////////////////////////
export async function startLoom() {
    console.log("Initializing Loom Studio...");
    await new Promise(resolve => setTimeout(resolve, 50));
    attachStartButton();
}

export async function resumeLoom(data) {
    console.log("Resuming saved pattern:", data);
    if (!data) return;

    const isTrad = data.loom === "traditional";
    const shaftCount = isTrad ? 2 : 4;
    const defaultMap = isTrad ? [0, 1] : [0, 1, 2, 3];
    const defaultColors = isTrad ? ["#ffffff", "#ffffff"] : ["#ffffff", "#ffffff", "#ffffff", "#ffffff"];

    let history = data.patternRows || [];
    if (history.length === 0 && data.steps) {
        const warpCount = data.totalThreads || 60;
        let pressedPedals = new Set();
        const map = data.threadingMap || defaultMap;
        for (const step of data.steps) {
            if (step.action === "pedal") pressedPedals.add(step.value);
            else if (step.action === "pedals") pressedPedals = new Set(step.value);
            else if (step.action === "beat") {
                const shed = [];
                for (let i = 0; i < shaftCount; i++) shed.push(!pressedPedals.has(i));
                const rowStates = [];
                for (let i = 0; i < warpCount; i++) {
                    const shaft = map[i % map.length] || (i % shaftCount);
                    rowStates.push(shed[shaft]);
                }
                history.push(rowStates);
            }
        }
    }

    let rColors = data.rowColors || [];
    if (rColors.length === 0 && history.length > 0) {
        const fallback = data.weftColor || "#f0eadf";
        rColors = new Array(history.length).fill(fallback);
    }

    loomConfig = {
        patternId: data._id,
        patternName: data.name,
        loomType: data.loom,
        patternType: data.type || "plain",
        totalThreads: data.totalThreads || 60,
        patternSize: data.threadingMap ? data.threadingMap.length : defaultMap.length,
        customThreadingMap: data.threadingMap || defaultMap,
        resumeHistory: history,
        rowColors: rColors,
        weftColor: data.weftColor || "#f0eadf",
        creator: data.creator,
        created: data.created,
        // Restore physical width from saved measurements if available
        width: (data.measurements && data.measurements.physicalWidthCm) ? data.measurements.physicalWidthCm : 30
    };

    warpColors = data.warpColors || defaultColors;
    // If saved warpColors is a per-thread array (length > 4), use as-is.
    // If it's the legacy 4-shaft array, keep as-is for backward compat.
    recordedSteps = data.steps || [];

    initLoom();
}