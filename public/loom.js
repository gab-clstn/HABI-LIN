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
const BEAT_DURATION = 10; // Sped up from 18

//////////////////////////////////////////////////
// SETUP OVERLAY — Entry point
//////////////////////////////////////////////////
function attachStartButton() {
    const nextBtn = document.getElementById("startSetup");
    const startBtn = document.getElementById("startWeavingFromHeddles");
    const heddlesOverlay = document.getElementById("heddlesOverlay");
    const setupOverlay = document.getElementById("setupOverlay");

    // Wait until elements exist
    if (!nextBtn || !startBtn || !setupOverlay || !heddlesOverlay) {
        requestAnimationFrame(attachStartButton);
        return;
    }

    // 1. NEXT BUTTON: Validate Name, Uniqueness & Configure Heddles
    nextBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        const patternNameInput = document.getElementById("patternName");
        const patternName = patternNameInput ? patternNameInput.value.trim() : "";

        if (!patternName) {
            alert("Please enter a pattern name before proceeding.");
            return; 
        }

        // --- UNIQUE NAME CHECK ---
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

        setupOverlay.style.display = "none";
        heddlesOverlay.style.display = "flex";
    });

    // 2. BACK BUTTON: Return to initial setup screen
    const backBtn = document.getElementById("backToSetup2"); 
    if (backBtn) {
        backBtn.addEventListener("click", (e) => {
            e.preventDefault();
            heddlesOverlay.style.display = "none";
            setupOverlay.style.display = "flex";
        });
    }

    // 3. START WEAVING: Strict Manual Entry (Validation Only)
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

        // --- STRICT MANUAL VALIDATION ---
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

        loomConfig = {
            patternName: document.getElementById("patternName").value,
            loomType: loomType,
            patternType: document.getElementById("patternType").value,
            width: parseFloat(document.getElementById("clothWidth").value),
            patternSize: patternSize,
            totalThreads: totalThreads,
            customThreadingMap: finalThreadingMap
        };

        warpColors = [
            document.getElementById("warp1")?.value || "#ffffff",
            document.getElementById("warp2")?.value || "#ffffff",
            document.getElementById("warp3")?.value || "#ffffff",
            document.getElementById("warp4")?.value || "#ffffff"
        ];

        if (loomType === "traditional") {
            warpColors = [warpColors[0], warpColors[1]];
        }

        heddlesOverlay.style.display = "none";
        initLoom();
    });
}

//////////////////////////////////////////////////
// INJECT LOOM UI STYLES — responsive, class-based
//////////////////////////////////////////////////
function injectLoomStyles() {
    if (document.getElementById("loom-ui-styles")) return;
    const style = document.createElement("style");
    style.id = "loom-ui-styles";
    style.textContent = `
        /* ── CONTROL PANEL (TOP-LEFT) ── */
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

        /* THE COLLAPSED STATE */
        .loom-panel.collapsed {
            max-height: 48px !important; 
            min-height: 48px !important;
            padding-bottom: 0 !important;
            overflow: hidden !important;
        }
        
        /* Hide everything EXCEPT the header when collapsed */
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

        /* Remove the line under the header when collapsed */
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

        /* HARDWARE SIMULATOR CONTAINER (Hidden on phones) */
        .hardware-sim-container {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }

        @media (max-width: 768px) {
            .hardware-sim-container { display: none !important; }
        }

        /* ── DESKTOP (>900px): Side-by-side layout ── */
        @media (min-width: 901px) {
            .loom-panel { width: clamp(200px, 18vw, 250px); max-height: 50vh; }
            .loom-pattern-panel { width: clamp(220px, 30vw, 450px); height: clamp(150px, 25vh, 300px); }
        }

        /* ── TABLET (601–900px) ── */
        @media (min-width: 601px) and (max-width: 900px) {
            .loom-panel { width: clamp(150px, 20vw, 200px); max-height: 45vh; }
            .loom-pattern-panel { width: clamp(180px, 32vw, 300px); height: clamp(120px, 20vh, 200px); }
        }

        /* ── MOBILE (≤600px): Re-arranged for better visibility ── */
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
    console.log("Loom Config:", loomConfig);

    //----------------------------------------------
    // CONSTANTS & LOOM DIMENSIONS
    //----------------------------------------------
    const SHAFT_COUNT = (loomConfig.loomType === "traditional") ? 2 : 4;

    const WIDTH = 6.5;
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

    // Z-positions for heddle frames (front to back)
    let zPositions = [];
    if (SHAFT_COUNT === 2) {
        zPositions = [TOWER_Z - 0.25, TOWER_Z + 0.25];
    } else {
        zPositions = [TOWER_Z - 0.45, TOWER_Z - 0.15, TOWER_Z + 0.15, TOWER_Z + 0.45];
    }

    //----------------------------------------------
    // RUNTIME STATE (HARDWARE / HOLD UPDATES)
    //----------------------------------------------
    const activeKeys = new Set();
    const pedalPivotGroups = [];
    const heddleFrames = [];
    const warpGroups = [];
    for (let i = 0; i < SHAFT_COUNT; i++) warpGroups.push([]);

    // Hardware State Tracking
    let currentPressedPedals = new Set();
    let isBeaterPulled = false;
    let hasProcessedCurrentBeat = false;

    let beaterGroup, shuttleGroup, clothRoller;
    let weftThreads = [];
    let activeWeft = null;
    let patternHistory = loomConfig.resumeHistory || [];
    let rowCounter = 0;
    let weftColorHistory = (loomConfig.rowColors && Array.isArray(loomConfig.rowColors)) ? Array.from(loomConfig.rowColors) : [];
    let fellZ = BASE_FRONT - 0.12;

    // Shuttle pass state
    let shuttleSideToggle = false;
    let shuttleArmed = false;
    let shuttleInserted = false;
    let shuttleStartSide = -1;
    let shuttleCrossed = false;

    // Direction-change void tracking
    let shuttleDirectionChanges = 0;
    let shuttleMovingPositive = null;
    let lastShuttleX = 0;

    // Treadling / auto-pattern state
    let treadlingSequence = [];
    let treadlingIndex = 0;
    let weftReadyToBeat = false;
    let shuttleCurrentSide = -1; // -1 = left, 1 = right


    //----------------------------------------------
    // THREE.JS SCENE SETUP
    //----------------------------------------------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x202025);

    const canvas = document.getElementById("bg");
    const container = document.getElementById("weaving-studio");

    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        preserveDrawingBuffer: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.set(4, 6, 14);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 2, 0);

    function resizeRenderer() {
        const rect = container.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
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
        mesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            p2.clone().sub(p1).normalize()
        );
        parent.add(mesh);
        return mesh;
    }

    //----------------------------------------------
    // TREADLING / PATTERN SEQUENCE
    //----------------------------------------------
    function generateTreadling(patternType) {
        if (SHAFT_COUNT === 2) {
            if (patternType === "plain")   treadlingSequence = [0, 1];
            else if (patternType === "basket") treadlingSequence = [0, 0, 1, 1];
            else if (patternType === "rib")    treadlingSequence = [0, 0, 0, 1, 1, 1];
            else                               treadlingSequence = [0, 1];
        } else {
            if (patternType === "plain")   treadlingSequence = [0, 1];
            else if (patternType === "twill")  treadlingSequence = [0, 1, 2, 3];
            else if (patternType === "basket") treadlingSequence = [0, 0, 1, 1, 2, 2, 3, 3];
            else if (patternType === "rib")    treadlingSequence = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3];
            else                               treadlingSequence = [0, 1, 2, 3];
        }
        console.log("Generated treadling:", treadlingSequence);
    }

    function advanceTreadling() {
        const nextPedal = treadlingSequence[treadlingIndex];
        activeKeys.clear();
        activeKeys.add("Digit" + (nextPedal + 1));
        treadlingIndex++;
        if (treadlingIndex >= treadlingSequence.length) treadlingIndex = 0;
    }

    generateTreadling(loomConfig.patternType);

    //----------------------------------------------
    // LOOM FRAME CONSTRUCTION
    //----------------------------------------------
    function buildFrame() {
        woodBar(0.35, LEG_HEIGHT, 0.35, LEFT,  LEG_HEIGHT / 2, BASE_FRONT);
        woodBar(0.35, LEG_HEIGHT, 0.35, RIGHT, LEG_HEIGHT / 2, BASE_FRONT);
        woodBar(0.35, LEG_HEIGHT, 0.35, LEFT,  LEG_HEIGHT / 2, BACK);
        woodBar(0.35, LEG_HEIGHT, 0.35, RIGHT, LEG_HEIGHT / 2, BACK);

        const SIDE_LEN = Math.abs(BASE_FRONT - BACK);
        const SIDE_CEN = (BASE_FRONT + BACK) / 2;
        woodBar(0.3, 0.3, SIDE_LEN, LEFT,  LEG_HEIGHT, SIDE_CEN);
        woodBar(0.3, 0.3, SIDE_LEN, RIGHT, LEG_HEIGHT, SIDE_CEN);

        const TOWER_H = 3.5;
        woodBar(0.3, TOWER_H, 0.3, LEFT,  LEG_HEIGHT + TOWER_H / 2, TOWER_Z);
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
            woodBar(0.15, 0.15, 0.15, LEFT  + 0.15, ROLLER_Y, zPos, group);
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

            woodBar(FRAME_W, 0.1, 0.1, 0,          FRAME_H / 2,  0, frameGroup);
            woodBar(FRAME_W, 0.1, 0.1, 0,         -FRAME_H / 2,  0, frameGroup);
            woodBar(0.1, FRAME_H, 0.1, -FRAME_W / 2, 0,          0, frameGroup);
            woodBar(0.1, FRAME_H, 0.1,  FRAME_W / 2, 0,          0, frameGroup);

            const hPoints = [];
            for (let h = 0; h <= 110; h++) {
                const hx = (h / 110) * (FRAME_W - 0.14) - (FRAME_W - 0.14) / 2;
                hPoints.push(
                    new THREE.Vector3(hx,  FRAME_H / 2 - 0.05, 0),
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
        woodBar(WIDTH - 0.5, 0.2,  0.3, 0,  bh / 2,  0,    beaterGroup);
        woodBar(WIDTH - 0.5, 0.15, 0.6, 0, -bh / 2, -0.1, beaterGroup);

        const reed = new THREE.Mesh(
            new THREE.BoxGeometry(HEDDLE_WIDTH, bh - 0.1, 0.05),
            reedMaterial
        );
        beaterGroup.add(reed);
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
            const color = warpColors[hIdx];

            const thread = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(points),
                new THREE.LineBasicMaterial({ color })
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
    // HARDWARE COMMAND API (Bluetooth / Strict Protocol)
    //----------------------------------------------
    function triggerShuttleThrow(targetSide) {
        shuttleStartSide = -targetSide; // if moving to right (1), started at left (-1)
        shuttleCurrentSide = targetSide;
        shuttleArmed = true;
        shuttleInserted = false;
        lastShuttleX = shuttleGroup.position.x;
        recordedSteps.push({ action: "shuttle" });
    }

    function handleHardwareInput(data) {
        data = data.trim();
        console.log("Hardware Data Received:", data);

        // 1. Pedal Downs (Press & Hold)
        const pedalMapDown = { "1": 0, "2": 1, "3": 2, "4": 3 };
        if (pedalMapDown[data] !== undefined) {
            currentPressedPedals.add(pedalMapDown[data]);
            recordedSteps.push({ action: "pedal", value: pedalMapDown[data] });
            return;
        }

        // 2. Pedal Ups (Release 7, 8, 9, 0)
        const pedalMapUp = { "7": 0, "8": 1, "9": 2, "0": 3 };
        if (pedalMapUp[data] !== undefined) {
            currentPressedPedals.delete(pedalMapUp[data]);
            return;
        }

        // Multiple concurrent pedals sent via comma (legacy safe fallback)
        if (data.includes(",")) {
            currentPressedPedals.clear();
            data.split(",").forEach(p => {
                const pedalIdx = parseInt(p) - 1;
                if (!isNaN(pedalIdx)) currentPressedPedals.add(pedalIdx);
            });
            recordedSteps.push({ action: "pedals", value: Array.from(currentPressedPedals) });
            return;
        }

        if (data === "R") {
            currentPressedPedals.clear();
            return;
        }

        // 3. Beater PULL (Hold)
        if (data === "B" || data === "RFID_3" || data === "RFID_4") {
            isBeaterPulled = true;
            return;
        }

        // 4. Beater RELEASE 
        if (data === "B_1" || data === "V") { 
            isBeaterPulled = false;
            hasProcessedCurrentBeat = false; // Resets for the next beat
            return;
        }

        // 5. Shuttle (S1S2 = left to right, S2S1 = right to left)
        if (data === "S1S2") { // Left to Right
            triggerShuttleThrow(1);
            return;
        }

        if (data === "S2S1") { // Right to Left
            triggerShuttleThrow(-1);
            return;
        }
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
    // INPUT — KEYBOARD (LAPTOP CONTROLS ONLY)
    //----------------------------------------------
    window.addEventListener('keydown', (e) => {
        if (e.repeat) return; // Prevent hold spamming
        
        // Laptop keys 1-4 perfectly mimic the hardware push & hold behavior 
        // by sending the exact string the hardware sends when pushed.
        if (e.code === 'Digit1') handleHardwareInput("1");
        if (e.code === 'Digit2') handleHardwareInput("2");
        if (e.code === 'Digit3') handleHardwareInput("3");
        if (e.code === 'Digit4') handleHardwareInput("4");

        if (e.code === 'Space') {
            e.preventDefault();
            if (shuttleCurrentSide === -1) handleHardwareInput("S1S2"); // Throw right
            else handleHardwareInput("S2S1"); // Throw left
        }

        if (e.code === 'KeyB') {
            handleHardwareInput("B");
        }
        
        if (e.code === 'KeyV') {
            handleHardwareInput("B_1");
        }
    }, true);

    // Laptop key release perfectly mimics the hardware letting go
    // by sending the exact string the hardware sends when released.
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
        for (let i = 0; i < SHAFT_COUNT; i++) {
            shed.push(!currentPressedPedals.has(i));
        }

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
            warpPattern: rowStates.slice()
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

        console.log("Odd direction changes — weft voided immediately.");

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
    // PATTERN EXPORT
    //----------------------------------------------
    function exportPatternImage() {
        if (patternHistory.length === 0) {
            alert("Weave some rows first!");
            return;
        }

        const cellSize = 15;
        const warpCount = loomConfig.totalThreads; 
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = warpCount * cellSize;
        exportCanvas.height = patternHistory.length * cellSize;
        const ctx = exportCanvas.getContext('2d');

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

        patternHistory.forEach((rowStates, rowIndex) => {
            rowStates.forEach((isWarpUp, warpIndex) => {
                const y = (patternHistory.length - 1 - rowIndex) * cellSize;
                if (!isWarpUp) {
                    const fallbackColor = "#" + shuttleThreadMaterial.color.getHexString();
                    ctx.fillStyle = (weftColorHistory && weftColorHistory[rowIndex]) ? weftColorHistory[rowIndex] : fallbackColor;
                    ctx.fillRect(warpIndex * cellSize, y, cellSize, cellSize);
                } else {
                    const hIdx = threading[warpIndex % threading.length];
                    ctx.fillStyle = warpColors[hIdx];
                    ctx.fillRect(warpIndex * cellSize, y, cellSize, cellSize);
                }
            });
        });

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
        injectLoomStyles(); // Inject the new responsive classes

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

        if (window.innerWidth <= 600) {
            gui.classList.add('collapsed');
        }

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

        // ── Event Listeners ──
        document.getElementById('shuttleColor').addEventListener('input', (e) =>
            shuttleThreadMaterial.color.set(e.target.value)
        );

        if (loomConfig && loomConfig.weftColor) {
            const shuttleInput = document.getElementById('shuttleColor');
            if (shuttleInput) {
                shuttleInput.value = loomConfig.weftColor;
                shuttleThreadMaterial.color.set(loomConfig.weftColor);
            }
        }

        document.getElementById('convertBtn').addEventListener('click', exportPatternImage);
        document.getElementById('bleConnect').addEventListener('click', connectBLE);
        

        // FIXED Back button logic to show overlay and hide panels
        document.getElementById('backToMenuBtn').addEventListener('click', () => {
            window.location.href = 'dashboard.html';
        });
        
        // OG Save Pattern logic
            document.getElementById("savePattern").addEventListener("click", async () => {
            if (patternHistory.length === 0) {
                alert("Weave and beat at least one row before saving!");
                return;
            }

            const shuttleColorEl = document.getElementById("shuttleColor");
            const weftColor = shuttleColorEl ? shuttleColorEl.value : "#" + shuttleThreadMaterial.color.getHexString();
            const currentUser = window.windowCurrentUserObj || { name: "Unknown" };

            const data = {
                name:         loomConfig.patternName || "Untitled",
                type:         loomConfig.patternType,
                loom:         loomConfig.loomType,
                steps:        recordedSteps,
                patternRows:  patternHistory,
                rowColors:    weftColorHistory,
                weftColor:    weftColor,
                created:      loomConfig.created || Date.now(), 
                warpColors:   warpColors,
                totalThreads: loomConfig.totalThreads,
                threadingMap: loomConfig.customThreadingMap,
                creator:      currentUser.name,
                isImported:   false 
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
            patternCanvas.width  = patternCanvas.parentElement.clientWidth  || 200;
            patternCanvas.height = patternCanvas.parentElement.clientHeight || 100;
            ctx.fillStyle = "#111";
            ctx.fillRect(0, 0, patternCanvas.width, patternCanvas.height);
            return;
        }

        const warpCount = loomConfig.totalThreads; 
        const container = patternCanvas.parentElement;
        const containerWidth  = container.clientWidth  - 10;
        const containerHeight = container.clientHeight - 10;

        const cellWidth  = containerWidth  / warpCount;
        const cellHeight = containerHeight / patternHistory.length;
        const cellSize   = Math.max(2, Math.min(cellWidth, cellHeight));

        patternCanvas.width  = warpCount * cellSize;
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
                    ctx.fillStyle = warpColors[shaft] || "#ffffff";
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
            if (heddleFrames[idx] && Math.abs(heddleFrames[idx].position.y - SHED_CLOSED_Y) > 0.3) {
                allLow = false;
            }
        });
        return allLow;
    }

    function updateShafts() {
        for (let i = 0; i < SHAFT_COUNT; i++) {
            const isPressed = currentPressedPedals.has(i);
            const targetHeddleY = isPressed ? SHED_CLOSED_Y : SHED_OPEN_Y;
            const targetAngle   = isPressed ? 3 * (Math.PI / 180) : 13 * (Math.PI / 180);

            // Sped up from 0.15 to 0.4
            if (pedalPivotGroups[i])
                pedalPivotGroups[i].rotation.x += (targetAngle - pedalPivotGroups[i].rotation.x) * 0.4;

            if (heddleFrames[i])
                heddleFrames[i].position.y += (targetHeddleY - heddleFrames[i].position.y) * 0.4;

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

        const shiftAmount = MAX_ROWS_BEFORE_TAKEUP * ROW_SPACING;
        clothRoller.rotation.x += 0.5;

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

        const crossingFromLeft  = shuttleStartSide === -1 && shuttleGroup.position.x > 0;
        const crossingFromRight = shuttleStartSide ===  1 && shuttleGroup.position.x < 0;

        if (crossingFromLeft || crossingFromRight) {
            if (weftThreads.length > 0 && !activeWeft) {
                const lastWeft = weftThreads[weftThreads.length - 1];
                let isUndo = true;
                for (let i = 0; i < SHAFT_COUNT; i++) {
                    const isUp = !currentPressedPedals.has(i);
                    if (lastWeft.capturedShed[i] !== isUp) {
                        isUndo = false;
                        break;
                    }
                }
                
                if (isUndo) {
                    console.log("Hardware Sync: Pedal match detected, undoing row.");
                    scene.remove(lastWeft.line);
                    lastWeft.line.geometry.dispose();
                    lastWeft.line.material.dispose();
                    
                    weftThreads.pop();
                    patternHistory.pop();
                    
                    rowCounter = Math.max(0, rowCounter - 1);
                    fellZ = BEATER_HIT_Z - (rowCounter * ROW_SPACING);
                    
                    shuttleInserted = true;
                    
                    if (window.requestIdleCallback) {
                        requestIdleCallback(render2DPattern);
                    } else {
                        setTimeout(render2DPattern, 0);
                    }
                    
                    return; 
                }
            }

            addWeftThread();
            shuttleInserted = true;
        }
    }

    function checkDirectionChanges() {
        if (!activeWeft || activeWeft.isBeaten || !shuttleInserted) return;

        const reachedRight = shuttleStartSide === -1 && shuttleGroup.position.x >  SHUTTLE_LIMIT * 0.9;
        const reachedLeft  = shuttleStartSide ===  1 && shuttleGroup.position.x < -SHUTTLE_LIMIT * 0.9;

        if (activeWeft && (reachedRight || reachedLeft)) {
            weftReadyToBeat = true;
        }

        const currentX = shuttleGroup.position.x;
        const delta = currentX - lastShuttleX;

        if (Math.abs(delta) > 0.01) {
            const movingPositive = delta > 0;

            if (shuttleMovingPositive === null) {
                shuttleMovingPositive = movingPositive;
            } else if (movingPositive !== shuttleMovingPositive) {
                shuttleDirectionChanges++;
                console.log("Direction change count:", shuttleDirectionChanges);

                if (shuttleDirectionChanges % 2 !== 0) {
                    voidActiveWeft();
                    return;
                }
            }
        }

        lastShuttleX = currentX;
    }

    function processBeat(currentHitZ) {
        if (!activeWeft || !weftReadyToBeat) {
            return;
        }

        const pos = activeWeft.line.geometry.attributes.position;
        for (let j = 0; j < pos.count; j++) {
            pos.setZ(j, currentHitZ);
            pos.setY(j, BREAST_BEAM_Y + 0.05 + (j % 2 === 0 ? 0.04 : -0.04));
        }
        pos.needsUpdate = true;

        activeWeft.isBeaten = true;
        activeWeft.live = false;

        rowCounter++;
        weftColorHistory.push("#" + shuttleThreadMaterial.color.getHexString());
        fellZ = currentHitZ;

        activeWeft = null;
        weftReadyToBeat = false;

        shuttleDirectionChanges = 0;
        shuttleMovingPositive = null;

        recordedSteps.push({ action: "beat" });
        render2DPattern();
    }

    function reconstructSavedWeave() {
        if (!loomConfig.resumeHistory || loomConfig.resumeHistory.length === 0) {
            console.log("No history to reconstruct.");
            return;
        }

        console.log("Reconstructing 3D threads...");

        loomConfig.resumeHistory.forEach((rowStates, index) => {
            const currentHitZ = BEATER_HIT_Z - (rowCounter * ROW_SPACING);
            const points = [];

            for (let j = 0; j < TOTAL_THREADS; j++) {
                const x = (j / (TOTAL_THREADS - 1)) * HEDDLE_WIDTH - HEDDLE_WIDTH / 2;
                const y = BREAST_BEAM_Y + 0.05 + (j % 2 === 0 ? 0.04 : -0.04);
                points.push(new THREE.Vector3(x, y, currentHitZ));
            }

            const rowColor = (weftColorHistory && weftColorHistory[index]) ? weftColorHistory[index] : (loomConfig.weftColor || "#f0eadf");
            const savedMaterial = new THREE.LineBasicMaterial({ color: rowColor });

            const line = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(points),
                savedMaterial
            );
            scene.add(line);

            weftThreads.push({
                line: line,
                isBeaten: true,
                live: false,
                capturedShed: [], 
                warpPattern: rowStates
            });

            rowCounter++;
            fellZ = currentHitZ;

            if (rowCounter >= MAX_ROWS_BEFORE_TAKEUP) {
                updateClothTakeup();
            }
        });
        
        console.log("Finished 3D Reconstruction! Total rows built:", weftThreads.length);
    }
    
    // Auto-run reconstruction if resuming
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

        // SPEED BOOST: 0.35 multiplier
        const targetX = shuttleCurrentSide * SHUTTLE_LIMIT;
        shuttleGroup.position.x += (targetX - shuttleGroup.position.x) * 0.35;

        updateClothTakeup();

        const currentHitZ = BEATER_HIT_Z - (rowCounter * ROW_SPACING);
        const targetBeaterZ = isBeaterPulled ? currentHitZ : BEATER_REST_Z;
        // Beater sped up to 0.6 / 0.35
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
        if (hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
    createUI();
    animate();
}

//////////////////////////////////////////////////
// EXPORT — called by the parent app to boot the loom
//////////////////////////////////////////////////
export async function startLoom() {
    console.log("Initializing Loom Studio...");
    await new Promise(resolve => setTimeout(resolve, 50));
    attachStartButton();
}

//////////////////////////////////////////////////
// RESUME SAVED WEAVE
//////////////////////////////////////////////////
export async function resumeLoom(data) {
    console.log("Resuming saved pattern:", data);
    if (!data) return;

    const isTrad = data.loom === "traditional";
    const shaftCount = isTrad ? 2 : 4;
    const defaultMap = isTrad ? [0, 1] : [0, 1, 2, 3];
    const defaultColors = isTrad ? ["#ffffff", "#ffffff"] : ["#ffffff", "#ffffff", "#ffffff", "#ffffff"];

    // 1. REBUILD MISSING HISTORY FOR OLD SAVES
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

    // 2. PERMANENTLY LOCK IN OLD COLORS
    let rColors = data.rowColors || [];
    if (rColors.length === 0 && history.length > 0) {
        const fallback = data.weftColor || "#f0eadf";
        rColors = new Array(history.length).fill(fallback);
    }

    // 3. LOAD CONFIGURATION
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
        created: data.created        
    };

    warpColors = data.warpColors || defaultColors;
    recordedSteps = data.steps || [];

    initLoom();
}
