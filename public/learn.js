import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";

/*
 * learn.js — Guided Learn Mode
 *
 * Flow:
 *   1. startLearn() is called from index.html with a pattern object
 *      (fetched from MongoDB, same shape as what loom.js saves).
 *   2. The 3D loom is built identically to loom.js.
 *   3. A "lesson plan" is derived from the pattern's patternRows
 *      (or reconstructed from steps if patternRows is absent).
 *   4. Each row becomes one "lesson step" with sub-phases:
 *        PHASE 1 — SHED  : highlight which pedal(s) to press;
 *                           loom waits until user presses correct key(s).
 *        PHASE 2 — SHUTTLE: highlight shuttle direction;
 *                           loom waits until user presses Space.
 *        PHASE 3 — BEAT  : highlight beater;
 *                           loom waits until user presses 0.
 *   5. After each correct action the 3D loom animates the motion,
 *      and a HUD panel shows live progress + next instruction.
 *   6. Auto-play mode (toggle) plays the whole pattern automatically.
 */

/* ══════════════════════════════════════════════════════════════
   TOP-LEVEL STATE
══════════════════════════════════════════════════════════════ */
let learnPattern   = null;   // the loaded pattern object
let lessonPlan     = [];     // array of { pedals, shuttleDir, rowStates }
let lessonIndex    = 0;      // which row we are teaching
let currentPhase   = "SHED"; // SHED | SHUTTLE | BEAT | DONE
let autoPlay       = false;
let autoPlayTimer  = 0;
const AUTO_PLAY_DELAY = 90;  // frames between auto-steps (~1.5 sec at 60fps)

/* ══════════════════════════════════════════════════════════════
   PUBLIC ENTRY POINT
   Called from index.html: startLearn(patternObject)
══════════════════════════════════════════════════════════════ */
export async function startLearn(pattern) {
    console.log("[LEARN] Starting learn mode for:", pattern.name);
    learnPattern = pattern;

    // Short delay so the weaving-studio div is visible before we size the renderer
    await new Promise(r => setTimeout(r, 60));

    buildLessonPlan(pattern);
    initLearnLoom(pattern);
}

/* ══════════════════════════════════════════════════════════════
   BUILD LESSON PLAN
   Converts patternRows (bool[][]) into structured lesson steps.
   Each step tells us:
     - which shaft indices must be pressed (pedals)
     - which direction the shuttle travels this row
     - the expected warp-up/down pattern for visual feedback
══════════════════════════════════════════════════════════════ */
function buildLessonPlan(pattern) {
    lessonPlan  = [];
    lessonIndex = 0;
    currentPhase = "SHED";

    const shaftCount  = pattern.loom === "traditional" ? 2 : 4;
    const warpCount   = 61; // 0..60 inclusive, matching loom.js
    const threading   = [];
    for (let i = 0; i < warpCount; i++) threading.push(i % shaftCount);

    // Prefer the saved patternRows; fall back to simulating from steps
    const rows = (pattern.patternRows && pattern.patternRows.length > 0)
        ? pattern.patternRows
        : simulateRowsFromSteps(pattern.steps || [], shaftCount, threading);

    rows.forEach((rowStates, rowIndex) => {
        // Determine which shafts are DOWN (pressed) this row.
        // isWarpUp[i] = true  → shaft is UP   → NOT pressed
        // isWarpUp[i] = false → shaft is DOWN  → pressed
        const pressedShafts = new Set();
        rowStates.forEach((isUp, warpIdx) => {
            if (!isUp) pressedShafts.add(threading[warpIdx % threading.length]);
        });

        // Shuttle direction alternates each row: even rows → left→right, odd → right→left
        const shuttleDir = rowIndex % 2 === 0 ? "right" : "left";

        lessonPlan.push({
            rowIndex,
            pedals:     Array.from(pressedShafts).sort(),
            shuttleDir,
            rowStates:  rowStates.slice()
        });
    });

    console.log("[LEARN] Lesson plan:", lessonPlan.length, "rows");
}

/* Reconstruct row states from recorded steps (fallback) */
function simulateRowsFromSteps(steps, shaftCount, threading) {
    const rows = [];
    const warpCount = 61;
    let pressedPedals = new Set();

    for (const step of steps) {
        if (step.action === "pedal")  { pressedPedals.add(step.value); }
        if (step.action === "pedals") { pressedPedals = new Set(step.value); }
        if (step.action === "beat") {
            const shed = [];
            for (let i = 0; i < shaftCount; i++) shed.push(!pressedPedals.has(i));
            const rowStates = [];
            for (let i = 0; i < warpCount; i++) rowStates.push(shed[threading[i % threading.length]]);
            rows.push(rowStates);
        }
    }
    return rows;
}

/* ══════════════════════════════════════════════════════════════
   3D LOOM INITIALIZER  (mirrors loom.js exactly)
══════════════════════════════════════════════════════════════ */
function initLearnLoom(pattern) {

    /* ── Constants ─────────────────────────────────────────── */
    const SHAFT_COUNT     = pattern.loom === "traditional" ? 2 : 4;
    const WIDTH           = 6.5;
    const DEPTH           = 4.2;
    const FRONT           = 0;
    const BACK            = -DEPTH;
    const FOOT_EXTENSION  = 2.2;
    const BASE_FRONT      = FRONT + FOOT_EXTENSION;
    const TOWER_Z         = FRONT - DEPTH * 0.38;
    const BEATER_REST_Z   = TOWER_Z + 1.2;
    const LEG_HEIGHT      = 3.2;
    const BREAST_BEAM_Y   = LEG_HEIGHT + 0.15;
    const WARP_BEAM_Y     = LEG_HEIGHT;
    const CLOTH_BEAM_Y    = 2.4;
    const CLOTH_BEAM_Z    = BEATER_REST_Z + 0.5;
    const LEFT            = -WIDTH / 2;
    const RIGHT           =  WIDTH / 2;
    const HEDDLE_WIDTH    = WIDTH - 0.85;
    const FRAME_H         = 1.2;
    const BASE_Y          = 0.45;
    const SHED_OPEN_Y     = BREAST_BEAM_Y + 0.6;
    const SHED_CLOSED_Y   = BREAST_BEAM_Y - 0.4;
    const SHUTTLE_LIMIT   = HEDDLE_WIDTH / 2 + 0.6;
    const ROW_SPACING     = 0.02;
    const BEATER_HIT_Z    = BASE_FRONT - 0.2;
    const MAX_ROWS_BEFORE_TAKEUP = 100;
    const BEAT_DURATION   = 18;

    const zPositions = SHAFT_COUNT === 2
        ? [TOWER_Z - 0.25, TOWER_Z + 0.25]
        : [TOWER_Z - 0.45, TOWER_Z - 0.15, TOWER_Z + 0.15, TOWER_Z + 0.45];

    const threading = [];
    for (let i = 0; i < 120; i++) threading.push(i % SHAFT_COUNT);

    /* ── Runtime state ─────────────────────────────────────── */
    const pedalPivotGroups  = [];
    const heddleFrames      = [];
    const warpGroups        = [];
    for (let i = 0; i < SHAFT_COUNT; i++) warpGroups.push([]);

    // Pedals the learner is currently holding
    let currentPressedPedals = new Set();

    let beaterGroup, shuttleGroup, clothRoller;
    let weftThreads  = [];
    let activeWeft   = null;
    let rowCounter   = 0;
    let fellZ        = BASE_FRONT - 0.12;
    let beatTimer    = 0;

    // Shuttle state (same as loom.js)
    let shuttleCurrentSide = -1;
    let shuttleStartSide   = -1;
    let shuttleArmed       = false;
    let shuttleInserted    = false;
    let weftReadyToBeat    = false;
    let shuttleDirectionChanges = 0;
    let shuttleMovingPositive   = null;
    let lastShuttleX            = 0;

    // Highlight meshes for visual cues
    const pedalHighlights = [];  // coloured overlays on pedals
    let   shuttleHighlight = null;
    let   beaterHighlight  = null;

    /* ── Three.js scene ────────────────────────────────────── */
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1f);

    const canvas    = document.getElementById("bg");
    const container = document.getElementById("weaving-studio");

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(window.devicePixelRatio);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.set(4, 6, 14);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 2, 0);

    function resizeRenderer() {
        const { width, height } = container.getBoundingClientRect();
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }
    resizeRenderer();
    window.addEventListener("resize", resizeRenderer);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(15, 20, 10);
    scene.add(sun);
    scene.add(new THREE.GridHelper(40, 40));

    /* ── Materials ─────────────────────────────────────────── */
    const woodMat        = new THREE.MeshStandardMaterial({ color: 0xc89b6d, roughness: 0.85, metalness: 0.05 });
    const threadMat      = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.6, transparent: true });
    const stringMat      = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.85 });
    const heddleWireMat  = new THREE.LineBasicMaterial({ color: 0xaaaaaa, opacity: 0.5, transparent: true });
    const ropeMat        = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.9 });
    const reedMat        = new THREE.MeshStandardMaterial({ color: 0x888899, roughness: 0.4, metalness: 0.6 });
    const clothThreadMat = new THREE.LineBasicMaterial({ color: 0xf0eadf, opacity: 0.95, transparent: true });
    const weftColor      = pattern.weftColor || "#c0392b";
    const shuttleThreadMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(weftColor), roughness: 0.7
    });

    // Highlight materials
    const highlightPedalMat   = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 0.6, transparent: true, opacity: 0.55 });
    const highlightShuttleMat = new THREE.MeshStandardMaterial({ color: 0xffdd00, emissive: 0xffdd00, emissiveIntensity: 0.7, transparent: true, opacity: 0.55 });
    const highlightBeaterMat  = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 0.7, transparent: true, opacity: 0.55 });
    const correctFlashMat     = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 1.0, transparent: true, opacity: 0.7 });

    /* ── Helpers ───────────────────────────────────────────── */
    function woodBar(w, h, d, x, y, z, parent = scene) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), woodMat);
        m.position.set(x, y, z);
        parent.add(m);
        return m;
    }
    function woodCylinder(radius, length, x, y, z, rotZ = true, parent = scene) {
        const g = new THREE.CylinderGeometry(radius, radius, length, 32);
        const m = new THREE.Mesh(g, woodMat);
        if (rotZ) m.rotation.z = Math.PI / 2;
        m.position.set(x, y, z);
        parent.add(m);
        return m;
    }
    function createRopeConnection(p1, p2, parent = scene) {
        const dist = p1.distanceTo(p2);
        const g    = new THREE.CylinderGeometry(0.02, 0.02, dist, 8);
        const m    = new THREE.Mesh(g, ropeMat);
        m.position.copy(new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5));
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p2.clone().sub(p1).normalize());
        parent.add(m);
        return m;
    }

    /* ── Frame ─────────────────────────────────────────────── */
    function buildFrame() {
        woodBar(0.35, LEG_HEIGHT, 0.35, LEFT,  LEG_HEIGHT / 2, BASE_FRONT);
        woodBar(0.35, LEG_HEIGHT, 0.35, RIGHT, LEG_HEIGHT / 2, BASE_FRONT);
        woodBar(0.35, LEG_HEIGHT, 0.35, LEFT,  LEG_HEIGHT / 2, BACK);
        woodBar(0.35, LEG_HEIGHT, 0.35, RIGHT, LEG_HEIGHT / 2, BACK);
        const SL = Math.abs(BASE_FRONT - BACK), SC = (BASE_FRONT + BACK) / 2;
        woodBar(0.3, 0.3, SL, LEFT,  LEG_HEIGHT, SC);
        woodBar(0.3, 0.3, SL, RIGHT, LEG_HEIGHT, SC);
        const TH = 3.5;
        woodBar(0.3, TH, 0.3, LEFT,  LEG_HEIGHT + TH / 2, TOWER_Z);
        woodBar(0.3, TH, 0.3, RIGHT, LEG_HEIGHT + TH / 2, TOWER_Z);
        const TOP_Y = LEG_HEIGHT + TH;
        woodBar(WIDTH + 0.6, 0.4, 0.4, 0, TOP_Y, TOWER_Z);
        woodBar(WIDTH + 0.2, 0.3, 0.4, 0, BREAST_BEAM_Y, BASE_FRONT);
        woodCylinder(0.3, WIDTH, 0, WARP_BEAM_Y, BACK);
        clothRoller = woodCylinder(0.28, WIDTH, 0, CLOTH_BEAM_Y, CLOTH_BEAM_Z);
        woodBar(WIDTH - 0.45, 0.25, 0.25, 0, BASE_Y, BASE_FRONT);
        woodBar(WIDTH - 0.45, 0.25, 0.25, 0, BASE_Y, BACK);
        return TOP_Y;
    }
    const TOP_BEAM_Y = buildFrame();

    /* ── Heddles ───────────────────────────────────────────── */
    function createHeddleSystem() {
        const group = new THREE.Group();
        const SUPPORT_BAR_Y = TOP_BEAM_Y - 0.65;
        const ROLLER_Y      = SUPPORT_BAR_Y - 0.5;
        woodCylinder(0.18, WIDTH, 0, SUPPORT_BAR_Y, TOWER_Z, true, group);
        function addRoller(zPos) {
            woodCylinder(0.06, WIDTH - 0.3, 0, ROLLER_Y, zPos, true, group);
            woodBar(0.15, 0.15, 0.15, LEFT  + 0.15, ROLLER_Y, zPos, group);
            woodBar(0.15, 0.15, 0.15, RIGHT - 0.15, ROLLER_Y, zPos, group);
        }
        addRoller((zPositions[0] + zPositions[1]) / 2);
        if (SHAFT_COUNT === 4) addRoller((zPositions[2] + zPositions[3]) / 2);

        for (let i = 0; i < SHAFT_COUNT; i++) {
            const fg = new THREE.Group();
            fg.position.set(0, SHED_OPEN_Y, zPositions[i]);
            [-1, 1].forEach(side => {
                const xp     = side * (HEDDLE_WIDTH / 2 - 0.50);
                const rz     = i < 2 ? (zPositions[0] + zPositions[1]) / 2 : (zPositions[2] + zPositions[3]) / 2;
                const cordG  = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(xp, ROLLER_Y, rz),
                    new THREE.Vector3(xp, SHED_OPEN_Y + FRAME_H / 2, zPositions[i])
                ]);
                scene.add(new THREE.Line(cordG, stringMat));
            });
            woodBar(HEDDLE_WIDTH, 0.1, 0.1, 0,  FRAME_H / 2, 0, fg);
            woodBar(HEDDLE_WIDTH, 0.1, 0.1, 0, -FRAME_H / 2, 0, fg);
            woodBar(0.1, FRAME_H, 0.1, -HEDDLE_WIDTH / 2, 0, 0, fg);
            woodBar(0.1, FRAME_H, 0.1,  HEDDLE_WIDTH / 2, 0, 0, fg);
            const hPts = [];
            for (let h = 0; h <= 110; h++) {
                const hx = (h / 110) * (HEDDLE_WIDTH - 0.14) - (HEDDLE_WIDTH - 0.14) / 2;
                hPts.push(new THREE.Vector3(hx,  FRAME_H / 2 - 0.05, 0),
                           new THREE.Vector3(hx, -FRAME_H / 2 + 0.05, 0));
            }
            fg.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(hPts), heddleWireMat));
            scene.add(fg);
            heddleFrames.push(fg);
        }
        scene.add(group);
    }
    createHeddleSystem();

    /* ── Beater ─────────────────────────────────────────────── */
    function createBeater() {
        beaterGroup = new THREE.Group();
        beaterGroup.position.set(0, BREAST_BEAM_Y + 0.25, BEATER_REST_Z);
        const bh = FRAME_H * 0.55;
        woodBar(WIDTH - 0.5, 0.2,  0.3, 0,  bh / 2,  0,    beaterGroup);
        woodBar(WIDTH - 0.5, 0.15, 0.6, 0, -bh / 2, -0.1, beaterGroup);
        beaterGroup.add(new THREE.Mesh(new THREE.BoxGeometry(HEDDLE_WIDTH, bh - 0.1, 0.05), reedMat));
        scene.add(beaterGroup);

        // Beater highlight overlay (hidden until BEAT phase)
        beaterHighlight = new THREE.Mesh(
            new THREE.BoxGeometry(WIDTH - 0.3, bh + 0.3, 0.4),
            highlightBeaterMat
        );
        beaterHighlight.visible = false;
        beaterGroup.add(beaterHighlight);
    }
    createBeater();

    /* ── Shuttle ────────────────────────────────────────────── */
    function createShuttle() {
        shuttleGroup = new THREE.Group();
        const sw   = 1.2;
        const bodyG = new THREE.BoxGeometry(sw, 0.22, 0.35);
        const pos   = bodyG.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            if (Math.abs(pos.getX(i)) > sw * 0.3) {
                pos.setZ(i, pos.getZ(i) * 0.25);
                pos.setY(i, pos.getY(i) * 0.8);
            }
        }
        shuttleGroup.add(new THREE.Mesh(bodyG, woodMat));
        const cav = new THREE.Mesh(new THREE.BoxGeometry(sw * 0.6, 0.12, 0.22), new THREE.MeshStandardMaterial({ color: 0x332211 }));
        cav.position.y = 0.05; shuttleGroup.add(cav);
        const quill = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, sw * 0.5, 12), new THREE.MeshStandardMaterial({ color: 0xeeddcc }));
        quill.rotation.z = Math.PI / 2; quill.position.y = 0.05; shuttleGroup.add(quill);
        const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, sw * 0.45, 12), shuttleThreadMat);
        wrap.rotation.z = Math.PI / 2; wrap.position.y = 0.05; shuttleGroup.add(wrap);

        // Shuttle highlight (arrow-like glow)
        shuttleHighlight = new THREE.Mesh(
            new THREE.BoxGeometry(sw + 0.4, 0.5, 0.6),
            highlightShuttleMat
        );
        shuttleHighlight.visible = false;
        shuttleGroup.add(shuttleHighlight);

        scene.add(shuttleGroup);
    }
    createShuttle();

    /* ── Pedals ─────────────────────────────────────────────── */
    function createPedals() {
        const restAngle = 13 * (Math.PI / 180);
        for (let i = 0; i < SHAFT_COUNT; i++) {
            const xPos  = (i - (SHAFT_COUNT - 1) / 2) * 0.8;
            const pivot = new THREE.Group();
            pivot.position.set(xPos, BASE_Y + 0.05, BASE_FRONT);
            pivot.rotation.x = restAngle;
            const lever = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 4.6), woodMat);
            lever.position.set(0, 0, -2.3);
            pivot.add(lever);
            scene.add(pivot);
            pedalPivotGroups.push(pivot);
            woodBar(0.45, 0.4, 0.5, xPos, BASE_Y + 0.05, BASE_FRONT);

            const vo = Math.abs(TOWER_Z - BASE_FRONT) * Math.tan(restAngle);
            createRopeConnection(
                new THREE.Vector3(xPos, BASE_Y + 0.05 + vo, TOWER_Z),
                new THREE.Vector3(xPos, BREAST_BEAM_Y - FRAME_H / 2, TOWER_Z)
            );

            // Pedal highlight box (rendered at pedal foot position)
            const hl = new THREE.Mesh(
                new THREE.BoxGeometry(0.5, 0.15, 4.8),
                highlightPedalMat.clone()
            );
            hl.position.set(xPos, BASE_Y + 0.05, BASE_FRONT - 2.3);
            hl.visible = false;
            scene.add(hl);
            pedalHighlights.push(hl);
        }
    }
    createPedals();

    /* ── Warp threads ───────────────────────────────────────── */
    function createDynamicWarp() {
        for (let i = 0; i < 120; i++) {
            const x    = (i / 120) * HEDDLE_WIDTH - HEDDLE_WIDTH / 2;
            const hIdx = i % SHAFT_COUNT;
            threading[i] = hIdx;
            const pts = [
                new THREE.Vector3(x, BREAST_BEAM_Y + 0.05, BASE_FRONT - 0.1),
                new THREE.Vector3(x, BREAST_BEAM_Y + 0.05, BASE_FRONT - 0.1),
                new THREE.Vector3(x, SHED_OPEN_Y, zPositions[hIdx]),
                new THREE.Vector3(x, WARP_BEAM_Y + 0.3, BACK)
            ];
            const t = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), threadMat);
            scene.add(t);
            warpGroups[hIdx].push(t);
        }
    }
    function createClothBase() {
        for (let i = 0; i <= 120; i++) {
            const x = (i / 120) * HEDDLE_WIDTH - HEDDLE_WIDTH / 2;
            const w = Math.sin(i * 0.6) * 0.015;
            const pts = [
                new THREE.Vector3(x + w, BREAST_BEAM_Y + 0.05, BASE_FRONT - 0.1),
                new THREE.Vector3(x,     BREAST_BEAM_Y + 0.05, BASE_FRONT + 0.1),
                new THREE.Vector3(x,     CLOTH_BEAM_Y,         CLOTH_BEAM_Z)
            ];
            scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), clothThreadMat));
        }
    }
    createDynamicWarp();
    createClothBase();

    /* ══════════════════════════════════════════════════════════
       LEARN HUD
    ══════════════════════════════════════════════════════════ */
    function createLearnHUD() {

        // ── Main instruction panel ──
        const hud = document.createElement("div");
        hud.id = "learnHUD";
        hud.style.cssText = `
            position: absolute;
            top: 20px;
            left: 300px;
            transform: translateX(-50%);
            width: 560px;
            background: rgba(10,10,14,0.96);
            border: 1px solid #333;
            border-radius: 16px;
            padding: 20px 28px;
            color: white;
            font-family: 'Plus Jakarta Sans', sans-serif;
            z-index: 200;
            box-shadow: 0 12px 40px rgba(0,0,0,0.6);
            display: flex;
            flex-direction: column;
            gap: 14px;
        `;

        hud.innerHTML = `
            <!-- Row progress bar -->
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:#888;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <button id="learnBackBtn" style="padding:4px 10px; background:none; border:1px solid #555; color:#aaa; border-radius:6px; cursor:pointer; font-size:11px;">← Back</button>
                    <span id="learnPatternName" style="font-weight:700; font-size:0.9rem; color:#fff;"></span>
                </div>
                <span id="learnRowCounter">Row 0 / 0</span>
            </div>
            <div style="background:#222; border-radius:99px; height:6px; overflow:hidden;">
                <div id="learnProgressBar" style="background: linear-gradient(90deg,#00e5ff,#00ff88); height:100%; width:0%; border-radius:99px; transition:width 0.4s ease;"></div>
            </div>

            <!-- Phase indicator tabs -->
            <div style="display:flex; gap:8px;">
                <div id="phaseTab_SHED"    class="phase-tab" data-phase="SHED">1 · Open Shed</div>
                <div id="phaseTab_SHUTTLE" class="phase-tab" data-phase="SHUTTLE">2 · Throw Shuttle</div>
                <div id="phaseTab_BEAT"    class="phase-tab" data-phase="BEAT">3 · Beat</div>
            </div>

            <!-- Main instruction -->
            <div id="learnInstruction" style="
                background: #16161e;
                border-radius: 10px;
                padding: 16px 18px;
                font-size: 1rem;
                line-height: 1.55;
                border-left: 3px solid #00e5ff;
                min-height: 56px;
            "></div>

            <!-- Key hint -->
            <div id="learnKeyHint" style="
                font-size: 0.78rem;
                color: #666;
                display: flex;
                gap: 8px;
                align-items: center;
            "></div>

            <!-- Controls row -->
            <div style="display:flex; gap:10px; justify-content:space-between; align-items:center;">
                <label style="font-size:0.8rem; color:#888; display:flex; align-items:center; gap:8px; cursor:pointer;">
                    <input type="checkbox" id="autoPlayToggle" style="accent-color:#00e5ff;"> Auto-play
                </label>
                <div style="display:flex; gap:8px;">
                    <button id="learnPrevBtn" style="padding:7px 16px; background:#222; color:#aaa; border:1px solid #333; border-radius:8px; cursor:pointer; font-size:0.8rem;">← Prev</button>
                    <button id="learnNextBtn" style="padding:7px 20px; background:#00e5ff; color:#000; border:none; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.8rem;">Skip →</button>
                </div>
            </div>
        `;

        // Phase tab styles
        const style = document.createElement("style");
        style.textContent = `
            .phase-tab {
                flex: 1; text-align: center; padding: 7px 4px;
                border-radius: 8px; font-size: 0.72rem; font-weight: 600;
                background: #1a1a22; color: #555; border: 1px solid #2a2a35;
                transition: all 0.25s;
            }
            .phase-tab.active {
                color: #fff; border-color: currentColor;
            }
            #phaseTab_SHED.active    { background:#003d44; color:#00e5ff; border-color:#00e5ff; }
            #phaseTab_SHUTTLE.active { background:#433a00; color:#ffdd00; border-color:#ffdd00; }
            #phaseTab_BEAT.active    { background:#003322; color:#00ff88; border-color:#00ff88; }
        `;
        document.head.appendChild(style);

        container.appendChild(hud);

        // ── Mini 2D pattern panel (bottom-right) ──
        const patPanel = document.createElement("div");
        patPanel.style.cssText = `
            position:absolute; bottom:20px; right:20px;
            width:360px; height:220px;
            background:rgba(0,0,0,0.92); border:1px solid #333;
            border-radius:12px; padding:14px; box-sizing:border-box;
            z-index:200; display:flex; flex-direction:column; gap:8px;
        `;
        patPanel.innerHTML = `
            <div style="font-size:0.75rem; font-weight:700; color:#888; text-transform:uppercase; letter-spacing:1px; display:flex; justify-content:space-between;">
                <span>Pattern Progress</span>
                <span id="learnRowBadge" style="color:#00ff88;"></span>
            </div>
            <div style="flex:1; overflow:hidden; background:#111; border-radius:6px;">
                <canvas id="learnPatternCanvas" width="330" height="160" style="width:100%; height:100%; image-rendering:pixelated;"></canvas>
            </div>
        `;
        container.appendChild(patPanel);

        // Event listeners
        document.getElementById("autoPlayToggle").addEventListener("change", (e) => {
            autoPlay = e.target.checked;
            autoPlayTimer = AUTO_PLAY_DELAY;
        });
        document.getElementById("learnBackBtn").addEventListener("click", () => {
            document.getElementById("learnHUD").remove();
            document.getElementById("modeSelectionOverlay").style.display = "flex";
        });
        document.getElementById("learnNextBtn").addEventListener("click", skipCurrentPhase);
        document.getElementById("learnPrevBtn").addEventListener("click", goToPrevStep);

        // Init display
        document.getElementById("learnPatternName").textContent = learnPattern.name;
        refreshHUD();
    }
    createLearnHUD();

    /* ══════════════════════════════════════════════════════════
       HUD UPDATE
    ══════════════════════════════════════════════════════════ */
    function refreshHUD() {
        if (lessonPlan.length === 0) return;

        const total    = lessonPlan.length;
        const rowNum   = Math.min(lessonIndex, total - 1);
        const step     = lessonPlan[rowNum];
        const isDone   = (currentPhase === "DONE");

        // Progress
        const pct = isDone ? 100 : ((rowNum + (currentPhase === "SHUTTLE" ? 0.33 : currentPhase === "BEAT" ? 0.66 : 0)) / total * 100).toFixed(1);
        document.getElementById("learnProgressBar").style.width = pct + "%";
        document.getElementById("learnRowCounter").textContent  = `Row ${rowNum + 1} / ${total}`;
        document.getElementById("learnRowBadge").textContent    = `${rowNum + 1} / ${total}`;

        // Phase tabs
        ["SHED", "SHUTTLE", "BEAT"].forEach(p => {
            const el = document.getElementById("phaseTab_" + p);
            el.classList.toggle("active", p === currentPhase);
        });

        // Instructions & key hints
        const instr   = document.getElementById("learnInstruction");
        const keyHint = document.getElementById("learnKeyHint");

        if (isDone) {
            instr.style.borderLeftColor = "#00ff88";
            instr.innerHTML = `<strong style="color:#00ff88;">🎉 Pattern complete!</strong><br>You've woven all ${total} rows.`;
            keyHint.innerHTML = "";
            return;
        }

        const pedalNames = step.pedals.map(p => `<kbd style="background:#222;border:1px solid #555;border-radius:4px;padding:2px 6px;font-family:monospace;">${p + 1}</kbd>`).join(" + ");
        const dirArrow   = step.shuttleDir === "right" ? "→ right" : "← left";

        if (currentPhase === "SHED") {
            instr.style.borderLeftColor = "#00e5ff";
            instr.innerHTML = step.pedals.length === 0
                ? `No pedal needed — all shafts stay up for this row.`
                : `Press pedal${step.pedals.length > 1 ? "s" : ""} <strong>${pedalNames}</strong> to lower shaft${step.pedals.length > 1 ? "s" : ""} <strong>${step.pedals.map(p => p + 1).join(" & ")}</strong> and open the shed.`;
            keyHint.innerHTML = step.pedals.length === 0
                ? `<span style="color:#555;">No key needed — press <kbd style="background:#222;border:1px solid #555;border-radius:4px;padding:2px 6px;font-family:monospace;">Space</kbd> to continue</span>`
                : `Press key${step.pedals.length > 1 ? "s" : ""} ${pedalNames} on your keyboard`;
        }
        else if (currentPhase === "SHUTTLE") {
            instr.style.borderLeftColor = "#ffdd00";
            instr.innerHTML = `Throw the shuttle <strong style="color:#ffdd00;">${dirArrow}</strong> through the open shed.`;
            keyHint.innerHTML = `Press <kbd style="background:#222;border:1px solid #555;border-radius:4px;padding:2px 6px;font-family:monospace;">Space</kbd> to throw the shuttle`;
        }
        else if (currentPhase === "BEAT") {
            instr.style.borderLeftColor = "#00ff88";
            instr.innerHTML = `Beat the weft thread into place by swinging the beater forward.`;
            keyHint.innerHTML = `Press <kbd style="background:#222;border:1px solid #555;border-radius:4px;padding:2px 6px;font-family:monospace;">0</kbd> to beat`;
        }

        updateHighlights();
        renderLearnPattern(rowNum);
    }

    /* ── 3D Highlights ─────────────────────────────────────── */
    function updateHighlights() {
        if (lessonIndex >= lessonPlan.length) {
            clearAllHighlights();
            return;
        }
        const step = lessonPlan[lessonIndex];

        // Pedal highlights
        pedalHighlights.forEach((hl, i) => {
            hl.visible = (currentPhase === "SHED") && step.pedals.includes(i);
        });

        // Shuttle highlight
        if (shuttleHighlight) shuttleHighlight.visible = (currentPhase === "SHUTTLE");

        // Beater highlight
        if (beaterHighlight) beaterHighlight.visible = (currentPhase === "BEAT");
    }

    function clearAllHighlights() {
        pedalHighlights.forEach(h => h.visible = false);
        if (shuttleHighlight) shuttleHighlight.visible = false;
        if (beaterHighlight)  beaterHighlight.visible  = false;
    }

    /* ── Mini pattern canvas ───────────────────────────────── */
    function renderLearnPattern(currentRow) {
        const c   = document.getElementById("learnPatternCanvas");
        if (!c) return;
        const ctx = c.getContext("2d");
        const rows = lessonPlan;
        if (!rows.length) return;

        const warpCount = rows[0].rowStates.length;
        const cellW     = Math.max(1, Math.floor(c.width  / warpCount));
        const cellH     = Math.max(1, Math.floor(c.height / rows.length));
        const cs        = Math.min(cellW, cellH, 6);

        c.width  = warpCount * cs;
        c.height = rows.length * cs;

        ctx.fillStyle = "#f5f0eb";
        ctx.fillRect(0, 0, c.width, c.height);

        rows.forEach(({ rowStates }, ri) => {
            const y = (rows.length - 1 - ri) * cs;
            rowStates.forEach((isUp, wi) => {
                const x = wi * cs;
                if (!isUp) {
                    // Shade completed rows normally; future rows lighter
                    ctx.fillStyle = ri < currentRow ? weftColor
                                  : ri === currentRow ? "#ffffff"
                                  : "rgba(180,100,100,0.25)";
                    ctx.fillRect(x, y, cs, cs);
                } else {
                    ctx.fillStyle = ri < currentRow ? "#111"
                                  : ri === currentRow ? "#555"
                                  : "#ccc";
                    ctx.fillRect(x + cs * 0.75, y, cs * 0.25, cs);
                }
            });
        });

        // Current-row highlight overlay
        if (currentRow < rows.length) {
            const y = (rows.length - 1 - currentRow) * cs;
            ctx.strokeStyle = "#00e5ff";
            ctx.lineWidth   = Math.max(1, cs * 0.4);
            ctx.strokeRect(0, y, c.width, cs);
        }
    }

    /* ══════════════════════════════════════════════════════════
       STEP LOGIC
    ══════════════════════════════════════════════════════════ */

    // Check whether the user has pressed the correct pedals for this row
    function checkShedCorrect() {
        if (lessonIndex >= lessonPlan.length) return false;
        const required = lessonPlan[lessonIndex].pedals;
        if (required.length === 0) return true; // no pedal needed
        return required.every(p => currentPressedPedals.has(p));
    }

    function advancePhase() {
        if (currentPhase === "SHED") {
            currentPhase = "SHUTTLE";
            // Arm the shuttle in the correct direction
            shuttleStartSide   = shuttleCurrentSide;
            shuttleCurrentSide = -shuttleCurrentSide;
            shuttleArmed    = true;
            shuttleInserted = false;
            lastShuttleX    = shuttleGroup.position.x;
        }
        else if (currentPhase === "SHUTTLE") {
            currentPhase = "BEAT";
        }
        else if (currentPhase === "BEAT") {
            // Beat was pressed — fire the beater animation
            beatTimer = BEAT_DURATION;
            // Advance to next row after beat animation completes
            setTimeout(() => {
                lessonIndex++;
                if (lessonIndex >= lessonPlan.length) {
                    currentPhase = "DONE";
                } else {
                    currentPhase = "SHED";
                    // Release all pedals so the loom resets
                    currentPressedPedals.clear();
                }
                refreshHUD();
            }, (BEAT_DURATION / 60) * 1000 + 200);
        }
        refreshHUD();
    }

    // Skip (Next button) — execute the action automatically and advance
    function skipCurrentPhase() {
        if (currentPhase === "SHED") {
            // Force-press required pedals
            if (lessonIndex < lessonPlan.length) {
                currentPressedPedals.clear();
                lessonPlan[lessonIndex].pedals.forEach(p => currentPressedPedals.add(p));
            }
            advancePhase();
        }
        else if (currentPhase === "SHUTTLE") {
            advancePhase();
        }
        else if (currentPhase === "BEAT") {
            advancePhase();
        }
    }

    function goToPrevStep() {
        if (lessonIndex === 0 && currentPhase === "SHED") return;
        if (currentPhase !== "SHED") {
            currentPhase = "SHED";
            currentPressedPedals.clear();
            shuttleArmed = false;
            beatTimer    = 0;
        } else {
            if (lessonIndex > 0) {
                lessonIndex--;
                currentPhase = "SHED";
                currentPressedPedals.clear();
            }
        }
        refreshHUD();
    }

    /* ── Auto-play tick ─────────────────────────────────────── */
    function tickAutoPlay() {
        if (!autoPlay || currentPhase === "DONE") return;
        autoPlayTimer--;
        if (autoPlayTimer > 0) return;
        autoPlayTimer = AUTO_PLAY_DELAY;
        skipCurrentPhase();
    }

    /* ══════════════════════════════════════════════════════════
       KEYBOARD INPUT
    ══════════════════════════════════════════════════════════ */
    function handleLearnKey(e) {
        // Pedal keys (1-4)
        if (["Digit1","Digit2","Digit3","Digit4"].includes(e.code)) {
            const idx = parseInt(e.code.replace("Digit","")) - 1;
            if (idx < SHAFT_COUNT) {
                currentPressedPedals.add(idx);
                // Check if this satisfies the current shed requirement
                if (currentPhase === "SHED" && checkShedCorrect()) {
                    advancePhase();
                }
            }
        }

        // Space — shuttle throw
        if (e.code === "Space") {
            e.preventDefault();
            if (currentPhase === "SHED" && lessonPlan[lessonIndex]?.pedals.length === 0) {
                // Row needs no pedal — space skips straight to shuttle
                advancePhase();
            } else if (currentPhase === "SHUTTLE") {
                advancePhase();
            }
        }

        // 0 — beat
        if (e.code === "Digit0" || e.code === "Numpad0") {
            if (currentPhase === "BEAT") {
                advancePhase();
            }
        }
    }

    function handleLearnKeyUp(e) {
        if (["Digit1","Digit2","Digit3","Digit4"].includes(e.code)) {
            // Only release pedal if the shed phase is done; otherwise keep it held
            if (currentPhase !== "SHED") {
                const idx = parseInt(e.code.replace("Digit","")) - 1;
                currentPressedPedals.delete(idx);
            }
        }
    }

    window.addEventListener("keydown", handleLearnKey,   true);
    window.addEventListener("keyup",   handleLearnKeyUp, true);

    /* ══════════════════════════════════════════════════════════
       WEAVING ENGINE  (same as loom.js — runs passively)
    ══════════════════════════════════════════════════════════ */

    function updateShafts() {
        for (let i = 0; i < SHAFT_COUNT; i++) {
            const isPressed   = currentPressedPedals.has(i);
            const targetY     = isPressed ? SHED_CLOSED_Y : SHED_OPEN_Y;
            const targetAngle = isPressed ? 3 * (Math.PI / 180) : 13 * (Math.PI / 180);
            if (pedalPivotGroups[i]) pedalPivotGroups[i].rotation.x += (targetAngle - pedalPivotGroups[i].rotation.x) * 0.15;
            if (heddleFrames[i])     heddleFrames[i].position.y     += (targetY - heddleFrames[i].position.y) * 0.15;
            if (warpGroups[i]) {
                warpGroups[i].forEach(t => {
                    const p = t.geometry.attributes.position;
                    p.setY(2, heddleFrames[i].position.y);
                    if (p.getZ(1) >= fellZ) p.setY(1, BREAST_BEAM_Y + 0.05);
                    p.needsUpdate = true;
                });
            }
        }
    }

    function isShedOpenEnough() {
        if (currentPressedPedals.size === 0) return false;
        let ok = true;
        currentPressedPedals.forEach(idx => {
            if (heddleFrames[idx] && Math.abs(heddleFrames[idx].position.y - SHED_CLOSED_Y) > 0.3) ok = false;
        });
        return ok;
    }

    function addWeftThread() {
        if (activeWeft) return;
        const warpCount = 60;
        const points    = [];
        const shed      = [];
        for (let i = 0; i < SHAFT_COUNT; i++) shed.push(!currentPressedPedals.has(i));
        const rowStates = [];
        for (let i = 0; i <= warpCount; i++) {
            const x     = (i / warpCount) * HEDDLE_WIDTH - HEDDLE_WIDTH / 2;
            const shaft = threading[i % threading.length];
            const isUp  = shed[shaft];
            rowStates.push(isUp);
            points.push(new THREE.Vector3(x, (BREAST_BEAM_Y + 0.05) + (isUp ? 0.18 : -0.18), shuttleGroup.position.z));
        }
        const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(points),
            new THREE.LineBasicMaterial({ color: new THREE.Color(weftColor) })
        );
        scene.add(line);
        activeWeft = { line, isBeaten: false, live: true, warpPattern: rowStates.slice() };
        weftThreads.push(activeWeft);
        shuttleMovingPositive = null;
        lastShuttleX          = shuttleGroup.position.x;
        shuttleDirectionChanges = 0;
    }

    function updateActiveWeftShape() {
        if (!activeWeft || !activeWeft.live) return;
        const pos = activeWeft.line.geometry.attributes.position;
        for (let j = 0; j < pos.count; j++) {
            const shaft = threading[j % threading.length];
            if (shuttleGroup.position.z < fellZ + 0.02) {
                const isUp    = !currentPressedPedals.has(shaft);
                const targetY = (BREAST_BEAM_Y + 0.05) + (isUp ? 0.18 : -0.18);
                pos.setY(j, THREE.MathUtils.lerp(pos.getY(j), targetY, 0.4));
            } else {
                pos.setY(j, (BREAST_BEAM_Y + 0.05) + (activeWeft.warpPattern[j] ? 0.18 : -0.18));
            }
        }
        pos.needsUpdate = true;
    }

    function checkWeftInsertion() {
        if (!shuttleArmed || shuttleInserted) return;
        // In learn mode we insert weft whenever shuttle crosses center (even without shed check,
        // since the lesson already ensured the shed is open before arming)
        const fromLeft  = shuttleStartSide === -1 && shuttleGroup.position.x > 0;
        const fromRight = shuttleStartSide ===  1 && shuttleGroup.position.x < 0;
        if (fromLeft || fromRight) { addWeftThread(); shuttleInserted = true; }
    }

    function checkWeftReady() {
        if (!activeWeft || activeWeft.isBeaten || !shuttleInserted) return;
        const reachedRight = shuttleStartSide === -1 && shuttleGroup.position.x >  SHUTTLE_LIMIT * 0.9;
        const reachedLeft  = shuttleStartSide ===  1 && shuttleGroup.position.x < -SHUTTLE_LIMIT * 0.9;
        if (reachedRight || reachedLeft) {
            if (reachedRight) shuttleCurrentSide =  1;
            if (reachedLeft)  shuttleCurrentSide = -1;
            weftReadyToBeat = true;
        }
    }

    function processBeat(beaterPressed, currentHitZ) {
        if (!beaterPressed || beatTimer !== BEAT_DURATION - 1) return;
        if (!activeWeft) return;
        const pos = activeWeft.line.geometry.attributes.position;
        for (let j = 0; j < pos.count; j++) {
            pos.setZ(j, currentHitZ);
            pos.setY(j, BREAST_BEAM_Y + 0.05 + (j % 2 === 0 ? 0.04 : -0.04));
        }
        pos.needsUpdate = true;
        activeWeft.isBeaten = true;
        activeWeft.live     = false;
        rowCounter++;
        fellZ        = currentHitZ;
        activeWeft   = null;
        weftReadyToBeat    = false;
        shuttleInserted     = false;
        shuttleArmed        = false;
    }

    function updateClothTakeup() {
        if (rowCounter < MAX_ROWS_BEFORE_TAKEUP) return;
        const shift = MAX_ROWS_BEFORE_TAKEUP * ROW_SPACING;
        clothRoller.rotation.x += 0.5;
        weftThreads.forEach(t => {
            const p = t.line.geometry.attributes.position;
            for (let j = 0; j < p.count; j++) {
                const nz = p.getZ(j) + shift;
                if (nz > BASE_FRONT) {
                    p.setY(j, THREE.MathUtils.lerp(BREAST_BEAM_Y, CLOTH_BEAM_Y, (nz - BASE_FRONT) / 1.5));
                    p.setZ(j, THREE.MathUtils.lerp(BASE_FRONT, CLOTH_BEAM_Z, (nz - BASE_FRONT) / 1.5));
                } else { p.setZ(j, nz); }
            }
            p.needsUpdate = true;
        });
        rowCounter = 0;
    }

    /* ══════════════════════════════════════════════════════════
       MAIN ANIMATION LOOP
    ══════════════════════════════════════════════════════════ */
    function animate() {
        requestAnimationFrame(animate);

        // Shaft + pedal animation
        updateShafts();

        // Auto-play ticker
        tickAutoPlay();

        // Active weft follows shed
        updateActiveWeftShape();

        // Shuttle lerp
        const targetX = shuttleCurrentSide * SHUTTLE_LIMIT;
        shuttleGroup.position.x += (targetX - shuttleGroup.position.x) * 0.12;

        // Beat timer
        const beaterPressed = beatTimer > 0;
        if (beatTimer > 0) beatTimer--;

        // Cloth takeup
        updateClothTakeup();

        // Beater movement
        const hitZ        = BEATER_HIT_Z - rowCounter * ROW_SPACING;
        const targetBeatZ = beaterPressed ? hitZ : BEATER_REST_Z;
        beaterGroup.position.z += (targetBeatZ - beaterGroup.position.z) * (beaterPressed ? 0.4 : 0.12);

        // Weft insertion & readiness
        checkWeftInsertion();
        checkWeftReady();

        // Beat processing
        processBeat(beaterPressed, hitZ);

        // Shuttle tracks beater
        shuttleGroup.position.y = beaterGroup.position.y - 0.35;
        shuttleGroup.position.z = beaterGroup.position.z + 0.18;

        // Highlight pulse animation
        const pulse = 0.45 + 0.25 * Math.sin(Date.now() / 200);
        pedalHighlights.forEach(h => { if (h.visible) h.material.opacity = pulse; });
        if (shuttleHighlight?.visible) shuttleHighlight.material.opacity = pulse;
        if (beaterHighlight?.visible)  beaterHighlight.material.opacity  = pulse;

        controls.update();
        renderer.render(scene, camera);
    }

    animate();
    refreshHUD();
}