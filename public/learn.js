import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";

/*
 * learn.js — Guided Learn Mode
 */

let learnPattern   = null;   
let lessonPlan     = [];     
let lessonIndex    = 0;      
let currentPhase   = "SHED"; 
let threading      = [];
let autoPlay       = false;
let autoPlayTimer  = 0;
const AUTO_PLAY_DELAY = 50;

export async function startLearn(pattern) {
    console.log("[LEARN] Starting learn mode for:", pattern.name);
    learnPattern = pattern;

    buildLessonPlan(pattern);
    await new Promise(r => setTimeout(r, 100));
    initLearnLoom(pattern);
}

function buildLessonPlan(pattern) {
    lessonPlan = [];
    lessonIndex = 0;
    currentPhase = "SHED";

    const shaftCount = pattern.loom === "traditional" ? 2 : 4;
    const totalThreads = pattern.totalThreads || 60;
    const customMap = pattern.threadingMap || [];
    
    threading = []; 
    for (let i = 0; i < totalThreads; i++) {
        threading.push(customMap.length > 0 ? customMap[i % customMap.length] : (i % shaftCount));
    }

    const rows = (pattern.patternRows && pattern.patternRows.length > 0)
        ? pattern.patternRows
        : simulateRowsFromSteps(pattern.steps || [], shaftCount, threading);

    rows.forEach((rowStates, rowIndex) => {
        const pressedShafts = new Set();
        rowStates.forEach((isUp, warpIdx) => {
            if (!isUp) pressedShafts.add(threading[warpIdx % threading.length]);
        });
        lessonPlan.push({
            rowIndex,
            pedals: Array.from(pressedShafts).sort(),
            shuttleDir: rowIndex % 2 === 0 ? "right" : "left",
            rowStates: rowStates.slice()
        });
    });
}

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

function initLearnLoom(pattern) {
    window.learnIsActive = true;
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
    const BEAT_DURATION   = 10; 

    const zPositions = SHAFT_COUNT === 2
        ? [TOWER_Z - 0.25, TOWER_Z + 0.25]
        : [TOWER_Z - 0.45, TOWER_Z - 0.15, TOWER_Z + 0.15, TOWER_Z + 0.45];

    const pedalPivotGroups  = [];
    const heddleFrames      = [];
    const warpGroups        = []; 
    for (let i = 0; i < SHAFT_COUNT; i++) warpGroups.push([]);

    let currentPressedPedals = new Set();
    let beaterGroup, shuttleGroup, clothRoller;
    let weftThreads  = [];
    let activeWeft   = null;
    let rowCounter   = 0;
    let fellZ        = BASE_FRONT - 0.12;
    
    let beaterHeld   = false;
    let beatTimer    = 0;

    let shuttleCurrentSide = -1;
    let shuttleStartSide   = -1;
    let shuttleArmed       = false;
    let shuttleInserted    = false;
    let weftReadyToBeat    = false;
    let shuttleDirectionChanges = 0;
    let shuttleMovingPositive   = null;
    let lastShuttleX            = 0;
    let isTransitioning = false;
    let mistakeStack = [];
    const MAX_MISTAKES = 3;

    const pedalHighlights = []; 
    let   shuttleHighlight = null;
    let   beaterHighlight  = null;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1f);

    const handleBeforeUnload = (e) => {
        if (currentPhase !== "DONE") {
            e.preventDefault();
            e.returnValue = '';
        }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    const canvas    = document.getElementById("bg");
    const container = document.getElementById("weaving-studio");

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.clear();

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
        if (typeof repositionHUD === 'function') repositionHUD();
    }
    resizeRenderer();
    window.addEventListener("resize", resizeRenderer);

    const resizeObs = new ResizeObserver(resizeRenderer);
    resizeObs.observe(container);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(15, 20, 10);
    scene.add(sun);
    scene.add(new THREE.GridHelper(40, 40));

    const woodMat        = new THREE.MeshStandardMaterial({ color: 0xc89b6d, roughness: 0.85, metalness: 0.05 });
    const stringMat      = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.85 });
    const heddleWireMat  = new THREE.LineBasicMaterial({ color: 0xaaaaaa, opacity: 0.5, transparent: true });
    const ropeMat        = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.9 });
    const reedMat        = new THREE.MeshStandardMaterial({ color: 0x888899, roughness: 0.4, metalness: 0.6 });
    const clothThreadMat = new THREE.LineBasicMaterial({ color: 0xf0eadf, opacity: 0.95, transparent: true });
    
    const savedWeftColor = pattern.weftColor || "#c0392b";
    const shuttleThreadMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(savedWeftColor), 
        roughness: 0.7
    });

    const highlightPedalMat   = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 0.6, transparent: true, opacity: 0.55 });
    const highlightShuttleMat = new THREE.MeshStandardMaterial({ color: 0xffdd00, emissive: 0xffdd00, emissiveIntensity: 0.7, transparent: true, opacity: 0.55 });
    const highlightBeaterMat  = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 0.7, transparent: true, opacity: 0.55 });

    function showMistakePopup() {
        const existing = document.getElementById("mistakeModal");
        if (existing) return;

        const modal = document.createElement("div");
        modal.id = "mistakeModal";
        modal.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: #2b0303; color: white; padding: 40px; border-radius: 20px;
            border: 4px solid #d93025; z-index: 1000; text-align: center;
            box-shadow: 0 0 50px rgba(217, 48, 37, 0.6);
            animation: pulse-red 0.5s infinite alternate;
        `;
        modal.innerHTML = `
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 4rem; color: #d93025; margin-bottom: 20px;"></i>
            <h2 style="font-size: 2rem; margin-bottom: 10px;">LOOM TANGLED!</h2>
            <p style="font-size: 1.1rem; opacity: 0.9; margin-bottom: 30px;">Too many errors stacked. You must pull the shuttle back through the highlighted sheds to continue.</p>
            <button onclick="document.getElementById('mistakeModal').remove()" style="background:#d93025; color:white; border:none; padding: 12px 30px; border-radius:10px; font-weight:700; cursor:pointer;">I UNDERSTAND</button>
        `;

        const style = document.createElement("style");
        style.textContent = `@keyframes pulse-red { from { transform: translate(-50%, -50%) scale(1); } to { transform: translate(-50%, -50%) scale(1.05); } }`;
        document.head.appendChild(style);
        document.body.appendChild(modal);
        playErrorSound();
    }

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

    function createBeater() {
            beaterGroup = new THREE.Group();
            beaterGroup.position.set(0, BREAST_BEAM_Y + 0.25, BEATER_REST_Z);
            const bh = FRAME_H * 0.55;
            woodBar(WIDTH - 0.5, 0.2,  0.3, 0,  bh / 2,  0,    beaterGroup);
            woodBar(WIDTH - 0.5, 0.15, 0.6, 0, -bh / 2, -0.1, beaterGroup);
            beaterGroup.add(new THREE.Mesh(new THREE.BoxGeometry(HEDDLE_WIDTH, bh - 0.1, 0.05), reedMat));
            scene.add(beaterGroup);

            beaterHighlight = new THREE.Mesh(
                new THREE.BoxGeometry(WIDTH + 0.2, bh + 0.6, 0.8),
                highlightBeaterMat
            );
            beaterHighlight.position.z = -0.05; 
            beaterHighlight.visible = false;
            beaterGroup.add(beaterHighlight);
        }
    createBeater();

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

        shuttleHighlight = new THREE.Mesh(
            new THREE.BoxGeometry(sw + 0.4, 0.5, 0.6),
            highlightShuttleMat
        );
        shuttleHighlight.visible = false;
        shuttleGroup.add(shuttleHighlight);

        scene.add(shuttleGroup);
    }
    createShuttle();

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

    function createDynamicWarp() {
        const totalThreads = learnPattern.totalThreads || 60;
        const savedWarpColors = (learnPattern.warpColors && learnPattern.warpColors.length > 0) 
            ? learnPattern.warpColors : ["#ffffff", "#ffffff", "#ffffff", "#ffffff"];

        for (let i = 0; i < totalThreads; i++) {
            const x = (i / (totalThreads - 1)) * HEDDLE_WIDTH - HEDDLE_WIDTH / 2;
            const hIdx = threading[i];

            const pts = [
                new THREE.Vector3(x, BREAST_BEAM_Y + 0.05, BASE_FRONT - 0.1),
                new THREE.Vector3(x, BREAST_BEAM_Y + 0.05, BASE_FRONT - 0.1),
                new THREE.Vector3(x, SHED_OPEN_Y, zPositions[hIdx]),
                new THREE.Vector3(x, WARP_BEAM_Y + 0.3, BACK)
            ];

            const threadColor = savedWarpColors[hIdx] || "#ffffff";
            const t = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(pts), 
                new THREE.LineBasicMaterial({ color: new THREE.Color(threadColor), opacity: 0.7, transparent: true })
            );
            scene.add(t);
            warpGroups[hIdx].push(t);
        } 
    }

    function createClothBase() {
        const totalThreads = learnPattern.totalThreads || 60;
        for (let i = 0; i < totalThreads; i++) {
            const x = (i / (totalThreads - 1)) * HEDDLE_WIDTH - HEDDLE_WIDTH / 2;
            const wobble = Math.sin(i * 0.6) * 0.015;
            const points = [
                new THREE.Vector3(x + wobble, BREAST_BEAM_Y + 0.05, BASE_FRONT - 0.1),
                new THREE.Vector3(x, BREAST_BEAM_Y + 0.05, BASE_FRONT + 0.1),
                new THREE.Vector3(x, CLOTH_BEAM_Y, CLOTH_BEAM_Z)
            ];
            scene.add(new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(points),
                clothThreadMat
            ));
        }
    }

    createDynamicWarp();
    createClothBase();

    function createLearnHUD() {
        container.style.containerType = "inline-size";
        container.style.containerName = "learnStudio";

        const style = document.createElement("style");
        style.id = "learnHUD-styles";
        style.textContent = `
            /* Phase tabs */
            .phase-tab {
                flex: 1;
                text-align: center;
                padding: 4px 2px;
                border-radius: 8px;
                font-size: 0.65rem;
                font-weight: 600;
                background: #1a1a22;
                color: #555;
                border: 1px solid #2a2a35;
                transition: all 0.25s;
                white-space: nowrap;
            }
            .phase-tab.active { color: #fff; border-color: currentColor; }
            #phaseTab_SHED.active    { background:#003d44; color:#00e5ff; border-color:#00e5ff; }
            #phaseTab_SHUTTLE.active { background:#433a00; color:#ffdd00; border-color:#ffdd00; }
            #phaseTab_BEAT.active    { background:#003322; color:#00ff88; border-color:#00ff88; }

            /* HUD kbd keys */
            .lhud-kbd {
                background:#222; border:1px solid #555; border-radius:4px;
                padding:2px 6px; font-family:monospace; font-size:0.85em;
            }

            /* Collapsed mini HUD on very small screens */
            #learnHUD.collapsed .lhud-collapsible { display: none !important; }
            #learnHUD .lhud-toggle {
                display: none;
                background: none; border: none; color: #888; cursor: pointer;
                font-size: 0.75rem; padding: 2px 8px; border-radius: 4px;
                border: 1px solid #333;
            }
            
            /* Pattern Panel Collapsed State */
            #learnPatternPanel {
                transition: height 0.3s ease, width 0.3s ease;
            }
            #learnPatternPanel.collapsed {
                height: 38px !important;
                min-height: 38px !important;
            }
            #learnPatternPanel.collapsed #learnPatternBody {
                display: none !important;
            }

            /* ── Responsive layout ── */
            @container learnStudio (max-width: 639px) {
                #learnHUD {
                    top: auto !important;
                    bottom: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    transform: none !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    border-radius: 14px 14px 0 0 !important;
                    max-height: 55vh;
                    overflow-y: hidden;
                }
                #learnHUD .lhud-toggle { display: inline-block; }
                
                #learnPatternPanel { 
                    display: flex !important;
                    top: 12px !important;
                    bottom: auto !important;
                    right: 12px !important;
                    left: auto !important;
                    width: 180px !important;
                    height: 140px !important;
                    padding: 8px !important;
                }
            }

            @container learnStudio (min-width: 640px) and (max-width: 899px) {
                #learnHUD {
                    top: 12px !important;
                    right: 12px !important;
                    left: auto !important;
                    transform: none !important;
                    width: 260px !important;
                    max-height: calc(100% - 180px);
                    overflow-y: hidden;
                }
                #learnPatternPanel {
                    display: flex !important;
                    top: auto !important;
                    bottom: 12px !important;
                    right: 12px !important;
                    left: auto !important;
                    width: 280px !important;
                    height: 200px !important;
                }
            }

            @container learnStudio (min-width: 900px) {
                #learnHUD {
                    top: 16px !important;
                    right: 16px !important;
                    left: auto !important;
                    transform: none !important;
                    width: clamp(260px, 28%, 320px) !important;
                    max-height: calc(100% - 220px);
                    overflow-y: hidden;
                }
                #learnPatternPanel {
                    display: flex !important;
                    top: auto !important;
                    bottom: 16px !important;
                    right: 16px !important;
                    left: auto !important;
                    width: clamp(300px, 35%, 450px) !important;
                    height: 260px !important;
                }
            }
        `;
        document.head.appendChild(style);

        const hud = document.createElement("div");
        hud.id = "learnHUD";
        Object.assign(hud.style, {
            position:      "absolute",
            zIndex:        "200",
            background:    "rgba(10,10,14,0.96)",
            border:        "1px solid #333",
            borderRadius:  "16px",
            padding:       "10px 14px",
            color:         "white",
            fontFamily:    "'Plus Jakarta Sans', sans-serif",
            boxShadow:     "0 12px 40px rgba(0,0,0,0.6)",
            display:       "flex",
            flexDirection: "column",
            gap:           "8px",
            boxSizing:     "border-box",
            top:           "16px",
            right:         "16px",
            left:          "auto",
            transform:     "none",
            width:         "clamp(240px, 27%, 300px)",
            maxHeight:     "calc(100% - 185px)",
            overflowY:     "auto",
        });

        hud.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
                <div style="display:flex; align-items:center; gap:8px; min-width:0;">
                    <button id="learnBackBtn" style="padding:4px 10px; background:none; border:1px solid #555; color:#aaa; border-radius:6px; cursor:pointer; font-size:11px; white-space:nowrap; flex-shrink:0;">← Back</button>
                    <span id="learnPatternName" style="font-weight:700; font-size:clamp(0.8rem,2vw,0.9rem); color:#fff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"></span>
                </div>
                <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                    <span id="learnRowCounter" style="font-size:0.75rem; color:#888; white-space:nowrap;">Row 0 / 0</span>
                    <button class="lhud-toggle" id="learnCollapseBtn" title="Collapse HUD">▲</button>
                </div>
            </div>
            <div class="lhud-collapsible" style="background:#222; border-radius:99px; height:5px; overflow:hidden;">
                <div id="learnProgressBar" style="background:linear-gradient(90deg,#00e5ff,#00ff88); height:100%; width:0%; border-radius:99px; transition:width 0.4s ease;"></div>
            </div>
            <div class="lhud-collapsible" style="display:flex; gap:6px;">
                <div id="phaseTab_SHED"    class="phase-tab" data-phase="SHED">1 · Open Shed</div>
                <div id="phaseTab_SHUTTLE" class="phase-tab" data-phase="SHUTTLE">2 · Throw Shuttle</div>
                <div id="phaseTab_BEAT"    class="phase-tab" data-phase="BEAT">3 · Beat</div>
            </div>
            <div class="lhud-collapsible" id="learnInstruction" style="
                background:#16161e; border-radius:10px; padding:10px 12px;
                font-size:0.82rem; line-height:1.55;
                border-left:3px solid #00e5ff; min-height:50px;
            "></div>
            <div class="lhud-collapsible" id="learnKeyHint" style="
                font-size:clamp(0.72rem,1.5vw,0.78rem); color:#666;
                display:flex; gap:8px; align-items:center; flex-wrap:wrap;
            "></div>
            <div class="lhud-collapsible" style="display:flex; gap:10px; justify-content:space-between; align-items:center; flex-wrap:wrap;">
                <label style="font-size:clamp(0.72rem,1.5vw,0.8rem); color:#888; display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="checkbox" id="autoPlayToggle" style="accent-color:#00e5ff;"> Auto-play
                </label>
                <div style="display:flex; gap:8px;">
                    <button id="learnPrevBtn" style="padding:5px 11px; background:#222; color:#aaa; border:1px solid #333; border-radius:8px; cursor:pointer; font-size:clamp(0.72rem,1.5vw,0.8rem); white-space:nowrap;">← Prev</button>
                    <button id="learnNextBtn" style="padding:5px 14px; background:#00e5ff; color:#000; border:none; border-radius:8px; cursor:pointer; font-weight:700; font-size:clamp(0.72rem,1.5vw,0.8rem); white-space:nowrap;">Skip →</button>
                </div>
            </div>
        `;
        container.appendChild(hud);

        const patPanel = document.createElement("div");
        patPanel.id = "learnPatternPanel";
        Object.assign(patPanel.style, {
            position:      "absolute",
            zIndex:        "200",
            background:    "rgba(0,0,0,0.92)",
            border:        "1px solid #333",
            borderRadius:  "12px",
            padding:       "8px 10px",
            boxSizing:     "border-box",
            display:       "flex",
            flexDirection: "column",
            gap:           "8px",
            bottom:        "16px",
            right:         "16px",
            left:          "auto",
            top:           "auto",
            width:         "clamp(300px, 35%, 450px)",
            height:        "260px",
        });
        patPanel.innerHTML = `
            <div id="learnPatternHeader" style="font-size:0.72rem; font-weight:700; color:#888; text-transform:uppercase; letter-spacing:1px; display:flex; justify-content:space-between; align-items:center; flex-shrink:0; cursor:pointer; user-select:none;">
                <span>Pattern Progress</span>
                <div style="display:flex; gap:8px; align-items:center;">
                    <span id="learnRowBadge" style="color:#00ff88;"></span>
                    <button id="learnPatternCollapseBtn" style="background:none; border:none; color:#888; cursor:pointer; font-size:0.75rem; padding:0;">▼</button>
                </div>
            </div>
            <div id="learnPatternBody" style="flex:1; overflow:hidden; background:#111; border-radius:6px; min-height:0; transition: opacity 0.3s ease;">
                <canvas id="learnPatternCanvas" width="380" height="200"
                    style="width:100%; height:100%; image-rendering:pixelated; display:block;"></canvas>
            </div>
        `;
        
        container.appendChild(patPanel);

        // Enable toggling the pattern panel
        document.getElementById("learnPatternHeader").addEventListener("click", () => {
            const isCollapsed = patPanel.classList.toggle("collapsed");
            document.getElementById("learnPatternCollapseBtn").textContent = isCollapsed ? "▲" : "▼";
            
            // Re-render the canvas briefly after expanding so it fills the space correctly
            if (!isCollapsed) {
                setTimeout(() => {
                    const rowNum = Math.min(lessonIndex, lessonPlan.length - 1);
                    renderLearnPattern(rowNum);
                }, 50);
            }
        });

        document.getElementById("autoPlayToggle").addEventListener("change", (e) => {
            autoPlay = e.target.checked;
            autoPlayTimer = AUTO_PLAY_DELAY;
        });
        document.getElementById("learnBackBtn").addEventListener("click", () => {
            window.removeEventListener('beforeunload', handleBeforeUnload); 
            hud.remove();
            patPanel.remove();
            document.getElementById("modeSelectionOverlay").style.display = "flex";
        });
        document.getElementById("learnNextBtn").addEventListener("click", skipCurrentPhase);
        document.getElementById("learnPrevBtn").addEventListener("click", goToPrevStep);

        document.getElementById("learnCollapseBtn").addEventListener("click", () => {
            const collapsed = hud.classList.toggle("collapsed");
            document.getElementById("learnCollapseBtn").textContent = collapsed ? "▼" : "▲";
        });

        document.getElementById("learnPatternName").textContent = learnPattern.name;
        refreshHUD();
    }
    createLearnHUD();

    /* ── Reposition HUD fallback ── */
    function repositionHUD() {
        const hud   = document.getElementById("learnHUD");
        const panel = document.getElementById("learnPatternPanel");
        if (!hud || !panel) return;

        const { width } = container.getBoundingClientRect();

        if (width < 640) {
            Object.assign(hud.style, {
                top: "auto", bottom: "0", left: "0", right: "0",
                transform: "none", width: "100%", maxWidth: "100%",
                borderRadius: "14px 14px 0 0", maxHeight: "55vh", overflowY: "auto",
            });
            Object.assign(panel.style, {
                display: "flex", top: "12px", bottom: "auto",
                left: "auto", right: "12px",
                width: "180px", height: "140px", padding: "8px"
            });
        } else if (width < 900) {
            const hudW = "260px";
            Object.assign(hud.style, {
                top: "12px", bottom: "auto", left: "auto", right: "12px",
                transform: "none", width: hudW, maxWidth: "",
                borderRadius: "16px", maxHeight: "calc(100% - 180px)", overflowY: "auto",
            });
            Object.assign(panel.style, {
                display: "flex", top: "auto", bottom: "12px",
                left: "auto", right: "12px",
                width: "280px", height: "200px",
            });
        } else {
            const hudW = Math.min(320, Math.max(260, Math.floor(width * 0.28))) + "px";
            Object.assign(hud.style, {
                top: "16px", bottom: "auto", left: "auto", right: "16px",
                transform: "none", width: hudW, maxWidth: "",
                borderRadius: "16px", maxHeight: "calc(100% - 220px)", overflowY: "auto",
            });
            const panelW = Math.min(450, Math.max(300, Math.floor(width * 0.35))) + "px";
            Object.assign(panel.style, {
                display: "flex", top: "auto", bottom: "16px",
                left: "auto", right: "16px",
                width: panelW, height: "260px",
            });
        }
        
        // Re-render canvas on resize so it adapts to new dimensions if not collapsed
        if (!panel.classList.contains("collapsed")) {
            const rowNum = Math.min(lessonIndex, lessonPlan.length - 1);
            renderLearnPattern(rowNum);
        }
    }

    function showWarning(msg) {
        const instr = document.getElementById("learnInstruction");
        if (!instr) return;
        
        instr.style.borderLeftColor = "#d93025"; 
        instr.innerHTML = `<strong style="color:#d93025;">⚠️ Hold on!</strong><br>${msg}`;
        
        const hud = document.getElementById("learnHUD");
        if (hud) {
            hud.animate([
                { transform: 'translateX(calc(-50% - 5px))' },
                { transform: 'translateX(calc(-50% + 5px))' },
                { transform: 'translateX(calc(-50% - 5px))' },
                { transform: 'translateX(calc(-50% + 5px))' },
                { transform: 'translateX(-50%)' }
            ], { duration: 300 });
        }

        setTimeout(() => {
            if (currentPhase !== "DONE") refreshHUD(); 
        }, 3000);
    }

    function refreshHUD() {
        if (lessonPlan.length === 0) return;

        const total    = lessonPlan.length;
        const rowNum   = Math.min(lessonIndex, total - 1);
        const step     = lessonPlan[rowNum];
        
        const currentRowColor = (learnPattern.rowColors && learnPattern.rowColors[rowNum]) 
            ? learnPattern.rowColors[rowNum] 
            : (learnPattern.weftColor || "#f0eadf");

        const prevRowColor = (rowNum > 0 && learnPattern.rowColors && learnPattern.rowColors[rowNum - 1]) 
            ? learnPattern.rowColors[rowNum - 1] 
            : null;
        
        if (shuttleThreadMat) {
            shuttleThreadMat.color.set(new THREE.Color(currentRowColor));
        }
        
        const colorDot = `<span style="display:inline-block; width:12px; height:12px; background-color:${currentRowColor}; border-radius:50%; border:1px solid #777; margin-bottom:-1px; margin-right:4px;"></span>`;
        
        const colorChangeText = (prevRowColor && prevRowColor !== currentRowColor) 
            ? `<strong style="color:#ffdd00;">[CHANGE SHUTTLE COLOR]</strong> Dial to match the ${colorDot} below.<br>` 
            : ``;

        const isDone   = (currentPhase === "DONE");
        const phaseOffset = currentPhase === "SHUTTLE" ? 0.33 : currentPhase === "BEAT" ? 0.66 : 0;
        const pct = isDone ? 100 : ((rowNum + phaseOffset) / total * 100).toFixed(1);
        
        document.getElementById("learnProgressBar").style.width = pct + "%";
        document.getElementById("learnRowCounter").textContent  = `Row ${rowNum + 1} / ${total}`;
        document.getElementById("learnRowBadge").textContent    = `${rowNum + 1} / ${total}`;

        ["SHED", "SHUTTLE", "BEAT"].forEach(p => {
            const el = document.getElementById("phaseTab_" + p);
            if (el) {
                // Keep SHUTTLE tab lit up if we're in the RELEASE_PEDAL intermediate phase
                const matchPhase = (currentPhase === "RELEASE_PEDAL" && p === "SHUTTLE") || 
                                   (currentPhase === p) || 
                                   (currentPhase.includes("ERROR") && p === "SHED");
                el.classList.toggle("active", matchPhase);
            }
        });

        const instr   = document.getElementById("learnInstruction");
        const keyHint = document.getElementById("learnKeyHint");
        const nextBtn = document.getElementById("learnNextBtn");

        if (isDone) {
            instr.style.borderLeftColor = "#00ff88";
            instr.innerHTML = `<strong style="color:#00ff88;">🎉 Pattern complete!</strong><br>You've woven all ${total} rows.`;
            keyHint.innerHTML = "";
            if (nextBtn) { nextBtn.textContent = "Finish!"; nextBtn.style.background = "#00ff88"; nextBtn.style.color = "#000"; }
            clearAllHighlights();
            return;
        } else {
            if (nextBtn) { nextBtn.textContent = "Skip →"; nextBtn.style.background = "#00e5ff"; nextBtn.style.color = "#000"; }
        }

        const dirArrow = step.shuttleDir === "right" ? "→ right" : "← left";
        
        // This takes the pedal array (e.g. [0, 1]) and turns it into "1 + 2"
        const pedalNamesText = step.pedals.map(p => p + 1).join(" + ");

        if (currentPhase === "ERROR_UNDO_SHED") {
            instr.style.borderLeftColor = "#d93025";
            const targetPedals = mistakeStack[mistakeStack.length - 1];
            let stackWarning = `<span style="color:#ffdd00; font-size:0.85em;">(${mistakeStack.length} mistakes stacked!)</span>`;
            
            const wrongNames = Array.from(targetPedals).map(p => `<kbd class="lhud-kbd">${p + 1}</kbd>`).join(" + ");
            
            instr.innerHTML = `<strong style="color:#d93025;">⚠️ Oops! Mistake Detected.</strong> ${stackWarning}<br>To clear the tangle, you must reopen the <b>exact</b> shed used for this mistake: <strong>${wrongNames}</strong>.`;
            keyHint.innerHTML = `Hold key(s) ${wrongNames} then press Space to pull back`;

            if (!targetPedals || targetPedals.size === 0) {
                instr.innerHTML = `<strong style="color:#d93025;">⚠️ Oops!</strong> ${stackWarning}<br>You threw through a closed shed. Just pull the shuttle back to clear it.`;
                keyHint.innerHTML = `Press Space to throw back`;
                currentPhase = "ERROR_UNDO_SHUTTLE"; 
            } else {
                instr.innerHTML = `<strong style="color:#d93025;">⚠️ Oops! Wrong shed.</strong> ${stackWarning}<br>To undo, open the exact same wrong shed by pressing <strong>${wrongNames}</strong>.`;
                keyHint.innerHTML = `Press and HOLD key(s) ${wrongNames}`;
            }
        }
        else if (currentPhase === "ERROR_UNDO_SHUTTLE") {
            instr.style.borderLeftColor = "#ffdd00";
            const undoArrow = shuttleCurrentSide === 1 ? "← left" : "→ right"; 
            const targetPedals = mistakeStack[mistakeStack.length - 1];
            
            if (targetPedals && targetPedals.size > 0) {
                instr.innerHTML = `<strong style="color:#ffdd00;">Physical Undo Step 2</strong><br>Keep the wrong shed open and pull the shuttle back <strong>${undoArrow}</strong>.`;
            } else {
                instr.innerHTML = `<strong style="color:#ffdd00;">Physical Undo</strong><br>You threw the shuttle through a closed shed. Pull it back <strong>${undoArrow}</strong> to clear it.`;
            }
            keyHint.innerHTML = `Press <kbd class="lhud-kbd">Space</kbd> to throw shuttle back`;
        }
        else if (currentPhase === "UNDO_READY") {
            instr.style.borderLeftColor = "#ff00ff";
            const prevNames = lessonPlan[lessonIndex - 1].pedals.map(p => `<kbd class="lhud-kbd">${p + 1}</kbd>`).join(" + ");
            const undoArrow = shuttleCurrentSide === 1 ? "← left" : "→ right"; 
            instr.innerHTML = `<strong style="color:#ff00ff;">[UNDO MODE]</strong><br>Holding previous row pedals (<strong>${prevNames}</strong>). Throw shuttle <strong>${undoArrow}</strong> to rewind.`;
            keyHint.innerHTML = `Press <kbd class="lhud-kbd">Space</kbd> to undo`;
        }
        else if (currentPhase === "SHED") {
            instr.style.borderLeftColor = "#00e5ff";
            instr.innerHTML = step.pedals.length === 0
                ? `<strong>1. Open Shed</strong><br>No pedals needed for this row.`
                : `<strong>1. Press Pedal(s) <strong>${pedalNamesText}</strong></strong><br>Press and hold pedal(s) <strong>${pedalNamesText}</strong> to open the shed.`;
            
            keyHint.innerHTML = step.pedals.length === 0
                ? `<span style="color:#555;">Press <kbd class="lhud-kbd">Space</kbd> to continue</span>`
                : `PC: Hold <kbd class="lhud-kbd">${step.pedals.map(p => p + 1).join("</kbd> + <kbd class='lhud-kbd'>")}</kbd> | ESP32: 1-4`;
        }
        else if (currentPhase === "SHUTTLE") {
            instr.style.borderLeftColor = "#ffdd00";
            instr.innerHTML = `${colorChangeText}<strong>2. Send Shuttle</strong><br>Keep pedals held! Throw shuttle <strong style="color:#ffdd00;">${dirArrow}</strong> through the shed.`;
            keyHint.innerHTML = `PC: Press <kbd class="lhud-kbd">Space</kbd> | ESP32: S1S2 / S2S1`;
        }
        else if (currentPhase === "RELEASE_PEDAL") {
            instr.style.borderLeftColor = "#ffaa00";
            instr.innerHTML = `<strong>2B. Release Pedal(s)</strong><br>Let go of pedal(s) <strong>${pedalNamesText}</strong> before beating.`;
            keyHint.innerHTML = `PC: Release keys | ESP32: 7-0 (auto-triggered on physical release)`;
        }
        else if (currentPhase === "BEAT") {
            instr.style.borderLeftColor = "#00ff88";
            if (!beaterHeld) {
                instr.innerHTML = `<strong>3. Send the Beater Down</strong><br>Pull the beater forward to lock the thread in place.`;
                keyHint.innerHTML = `PC: Press <kbd class="lhud-kbd">B</kbd> | ESP32: B`;
            } else {
                instr.innerHTML = `<strong>3. Put the Beater Back</strong><br>Return the beater to its resting position to complete the row.`;
                keyHint.innerHTML = `PC: Press <kbd class="lhud-kbd">V</kbd> | ESP32: B_1`;
            }
        }

        updateHighlights();
        
        // Don't render if it's collapsed, it throws off the canvas calculations
        const patPanel = document.getElementById("learnPatternPanel");
        if (patPanel && !patPanel.classList.contains("collapsed")) {
            renderLearnPattern(rowNum);
        }
    }

    function updateHighlights() {
        if (lessonIndex >= lessonPlan.length) {
            clearAllHighlights();
            return;
        }
        const step = lessonPlan[lessonIndex];

        pedalHighlights.forEach((hl, i) => {
            if (currentPhase.includes("ERROR_UNDO")) {
                const targetPedals = mistakeStack[mistakeStack.length - 1];
                hl.visible = targetPedals && targetPedals.has(i);
                hl.material.color.setHex(0xd93025); 
                hl.material.emissive.setHex(0xd93025);
            } else {
                hl.material.color.setHex(0x00e5ff); 
                hl.material.emissive.setHex(0x00e5ff);
                // Keep highlights visible during SHED, SHUTTLE, and RELEASE_PEDAL
                hl.visible = (currentPhase === "SHED" || currentPhase === "SHUTTLE" || currentPhase === "RELEASE_PEDAL") && step.pedals.includes(i);
            }
        });

        if (shuttleHighlight) {
            shuttleHighlight.visible = (currentPhase === "SHUTTLE" || currentPhase.includes("ERROR_UNDO"));
            if (currentPhase.includes("ERROR_UNDO")) {
            const flicker = (Math.sin(Date.now() * 0.02) > 0);
            const errorColor = flicker ? 0xff0000 : 0x550000; 
            
            shuttleHighlight.material.color.setHex(errorColor);
            shuttleHighlight.material.emissive.setHex(errorColor);
            shuttleHighlight.material.emissiveIntensity = 2.0;
            } else {
                shuttleHighlight.material.color.setHex(0xffdd00); 
                shuttleHighlight.material.emissive.setHex(0xffdd00);
            }
        }
        if (beaterHighlight) {
            beaterHighlight.visible = (currentPhase === "BEAT");
            beaterHighlight.material.color.setHex(0x00ff88);
            beaterHighlight.material.emissive.setHex(0x00ff88);
        }
    }

    function clearAllHighlights() {
        pedalHighlights.forEach(h => h.visible = false);
        if (shuttleHighlight) shuttleHighlight.visible = false;
        if (beaterHighlight)  beaterHighlight.visible  = false;
    }

    function renderLearnPattern(currentRow) {
        const c = document.getElementById("learnPatternCanvas");
        if (!c) return;
        const ctx = c.getContext("2d");
        const rows = lessonPlan;
        if (!rows.length) return;

        const warpCount = rows[0].rowStates.length;
        const cs = Math.min(
            Math.max(1, Math.floor(c.clientWidth  / warpCount)),
            Math.max(1, Math.floor(c.clientHeight / rows.length)),
            8 // Increased max cell size
        );

        c.width  = warpCount * cs;
        c.height = rows.length * cs;

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, c.width, c.height);

        const safeWarpColors = (learnPattern.warpColors && learnPattern.warpColors.length > 0) 
            ? learnPattern.warpColors 
            : ["#ffffff", "#ffffff", "#ffffff", "#ffffff"];

        rows.forEach(({ rowStates }, ri) => {
            const y = (rows.length - 1 - ri) * cs;
            const rowColor = (learnPattern.rowColors && learnPattern.rowColors[ri]) 
                ? learnPattern.rowColors[ri] : (learnPattern.weftColor || "#c0392b");

            rowStates.forEach((isUp, wi) => {
                const x = wi * cs;
                const hIdx = (learnPattern.threadingMap && learnPattern.threadingMap.length > 0)
                    ? learnPattern.threadingMap[wi % learnPattern.threadingMap.length]
                    : (wi % SHAFT_COUNT);

                ctx.fillStyle = rowColor;
                ctx.globalAlpha = (ri > currentRow) ? 0.2 : 1.0; 
                ctx.fillRect(x, y, cs, cs);

                if (isUp) {
                    const warpC = safeWarpColors[hIdx] || "#ffffff";
                    ctx.fillStyle = warpC;
                    ctx.fillRect(x + (cs * 0.25), y, cs * 0.5, cs);
                }
            });
        });

        if (currentRow < rows.length) {
            const y = (rows.length - 1 - currentRow) * cs;
            ctx.strokeStyle = "#00e5ff"; 
            ctx.lineWidth = Math.max(1, cs * 0.4);
            ctx.strokeRect(0, y, c.width, cs);
        }
    }

    function checkShedCorrect() {
        if (lessonIndex >= lessonPlan.length) return false;
        const required = lessonPlan[lessonIndex].pedals;
        
        if (currentPressedPedals.size !== required.length) return false;
        
        for (let p of required) {
            if (!currentPressedPedals.has(p)) return false;
        }
        return true;
    }

    function checkPrevShedCorrect() {
        if (lessonIndex <= 0) return false;
        const required = lessonPlan[lessonIndex - 1].pedals;
        if (currentPressedPedals.size !== required.length) return false;
        for (let p of required) {
            if (!currentPressedPedals.has(p)) return false;
        }
        return true;
    }

    function checkUndoShedCorrect() {
        if (mistakeStack.length === 0) return false;
        const required = mistakeStack[mistakeStack.length - 1];
        if (currentPressedPedals.size !== required.size) return false;
        for (let p of required) {
            if (!currentPressedPedals.has(p)) return false;
        }
        return true;
    }

    function evaluatePedalPhases() {
        if (currentPhase.includes("ERROR")) {
            if (currentPhase === "ERROR_UNDO_SHED" && checkUndoShedCorrect()) {
                currentPhase = "ERROR_UNDO_SHUTTLE";
            } else if (currentPhase === "ERROR_UNDO_SHUTTLE" && !checkUndoShedCorrect()) {
                currentPhase = "ERROR_UNDO_SHED";
            }
            refreshHUD();
            return;
        }

        // Gate logic for forcing release before going to BEAT
        if (currentPhase === "RELEASE_PEDAL") {
            if (currentPressedPedals.size === 0) {
                currentPhase = "BEAT";
            }
            refreshHUD();
            return; 
        }

        if (currentPhase === "SHED" || currentPhase === "SHUTTLE" || currentPhase === "UNDO_READY") {
            if (checkShedCorrect()) {
                currentPhase = "SHUTTLE";  
            } else if (lessonIndex > 0 && checkPrevShedCorrect()) {
                currentPhase = "UNDO_READY"; 
            } else {
                currentPhase = "SHED"; 
            }
            refreshHUD();
        }
    }

    function skipCurrentPhase() {
        if (isTransitioning) return;

        if (currentPhase === "DONE") {
            window.removeEventListener('beforeunload', handleBeforeUnload); 
            const hud = document.getElementById("learnHUD");
            if (hud) hud.remove();
            const c = document.getElementById("learnPatternCanvas");
            if (c && c.parentElement && c.parentElement.parentElement) c.parentElement.parentElement.remove();
            document.getElementById("modeSelectionOverlay").style.display = "flex";
            return;
        }

        if (currentPhase === "SHED") {
            currentPressedPedals.clear();
            lessonPlan[lessonIndex].pedals.forEach(p => currentPressedPedals.add(p));
            currentPhase = "SHUTTLE";
            refreshHUD();
        }
        else if (currentPhase === "SHUTTLE") {
            triggerShuttleThrow(); 
            if (currentPressedPedals.size > 0) {
                currentPhase = "RELEASE_PEDAL";
            } else {
                currentPhase = "BEAT";
            }
            refreshHUD();
        }
        else if (currentPhase === "RELEASE_PEDAL") {
            currentPressedPedals.clear();
            currentPhase = "BEAT";
            refreshHUD();
        }
        else if (currentPhase === "BEAT") {
            isTransitioning = true;
            beaterHeld = true; 
            setTimeout(() => {
                beaterHeld = false;
                lessonIndex++;
                if (lessonIndex >= lessonPlan.length) currentPhase = "DONE";
                else { 
                    currentPhase = "SHED"; 
                    currentPressedPedals.clear(); 
                }
                isTransitioning = false;
                refreshHUD();
            }, (BEAT_DURATION / 60) * 1000 + 100);
        }
        else if (currentPhase === "ERROR_UNDO_SHED") {
            currentPressedPedals.clear();
            const targetPedals = mistakeStack[mistakeStack.length - 1];
            targetPedals.forEach(p => currentPressedPedals.add(p));
            currentPhase = "ERROR_UNDO_SHUTTLE";
            refreshHUD();
        }
        else if (currentPhase === "ERROR_UNDO_SHUTTLE") {
            triggerShuttleThrow(); 
            removeLastMistakeWeft();
            mistakeStack.pop();
            shuttleInserted = false; 

            if (mistakeStack.length > 0) {
                currentPhase = checkUndoShedCorrect() ? "ERROR_UNDO_SHUTTLE" : "ERROR_UNDO_SHED";
            } else {
                currentPhase = "SHED";
                evaluatePedalPhases();
            }
            refreshHUD();
        }
    }

    function goToPrevStep() {
        if (lessonIndex === 0 && currentPhase === "SHED") return;

        if (currentPhase === "BEAT") {
            if (lessonPlan[lessonIndex].pedals.length > 0) {
                currentPhase = "RELEASE_PEDAL";
                lessonPlan[lessonIndex].pedals.forEach(p => currentPressedPedals.add(p));
            } else {
                currentPhase = "SHUTTLE";
                const step = lessonPlan[lessonIndex];
                shuttleCurrentSide = (step.shuttleDir === "right") ? -1 : 1;
                shuttleGroup.position.x = shuttleCurrentSide * SHUTTLE_LIMIT;
                shuttleInserted = false;
                removeLastMistakeWeft();
            }
            refreshHUD();
            return;
        }

        if (currentPhase === "RELEASE_PEDAL") {
            currentPhase = "SHUTTLE";
            const step = lessonPlan[lessonIndex];
            shuttleCurrentSide = (step.shuttleDir === "right") ? -1 : 1;
            shuttleGroup.position.x = shuttleCurrentSide * SHUTTLE_LIMIT;
            shuttleInserted = false;
            removeLastMistakeWeft();
            refreshHUD();
            return;
        }

        if (currentPhase === "SHUTTLE") {
            currentPhase = "SHED";
            currentPressedPedals.clear();
            refreshHUD();
            return;
        }

        if (currentPhase === "SHED") {
            if (lessonIndex > 0) {
                lessonIndex--;
                removeLastWeftFull(); 
                currentPhase = "BEAT"; 
                currentPressedPedals.clear();
                
                const prevStep = lessonPlan[lessonIndex];
                shuttleCurrentSide = (prevStep.shuttleDir === "right") ? 1 : -1;
                shuttleGroup.position.x = shuttleCurrentSide * SHUTTLE_LIMIT;
            }
            refreshHUD();
            return;
        }
        
        if (currentPhase.includes("ERROR")) {
            currentPhase = "SHED";
            currentPressedPedals.clear();
            removeLastMistakeWeft();
            const step = lessonPlan[lessonIndex];
            shuttleCurrentSide = (step.shuttleDir === "right") ? -1 : 1;
            shuttleGroup.position.x = shuttleCurrentSide * SHUTTLE_LIMIT;
            refreshHUD();
        }
    }

    function removeActiveWeft() {
        if (activeWeft && !activeWeft.isBeaten) {
            scene.remove(activeWeft.line);
            activeWeft.line.geometry.dispose();
            activeWeft.line.material.dispose();
            weftThreads.pop();
            activeWeft = null;
        }
    }

    function playErrorSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
        } catch (e) {}
    }

    function triggerShuttleThrow() {
        shuttleStartSide   = shuttleCurrentSide;
        shuttleCurrentSide = -shuttleCurrentSide;
        shuttleArmed    = true;
        shuttleInserted = false;
        lastShuttleX    = shuttleGroup.position.x;
    }

    function removeLastMistakeWeft() {
        console.log("[HABI-LIN] Surgical removal triggered. Current stack size:", mistakeStack.length);
        
        if (weftThreads.length > 0) {
            const lastIndex = weftThreads.length - 1;
            const threadToRemove = weftThreads[lastIndex];

            if (threadToRemove && !threadToRemove.isBeaten) {
                scene.remove(threadToRemove.line);
                
                if (threadToRemove.line.geometry) threadToRemove.line.geometry.dispose();
                if (threadToRemove.line.material) threadToRemove.line.material.dispose();
                
                weftThreads.splice(lastIndex, 1);
                
                console.log(`[HABI-LIN] Mistake thread at index ${lastIndex} killed.`);
            }
        }
        
        activeWeft = null; 
    }

    function removeLastWeftFull() {
        if (weftThreads.length > 0) {
            const lastWeft = weftThreads.pop();
            scene.remove(lastWeft.line);
            if (lastWeft.line.geometry) lastWeft.line.geometry.dispose();
            if (lastWeft.line.material) lastWeft.line.material.dispose();
            
            rowCounter = Math.max(0, rowCounter - 1);
            fellZ = BEATER_HIT_Z - (rowCounter * ROW_SPACING);
            activeWeft = null;
        }
    }

    function tickAutoPlay() {
        if (!autoPlay || currentPhase === "DONE" || isTransitioning) return;
        
        autoPlayTimer--;
        if (autoPlayTimer <= 0) {
            autoPlayTimer = AUTO_PLAY_DELAY;
            skipCurrentPhase();
        }
    }

    function handleLearnKey(e) {
        // Digits 1-4 HOLD pedals
        if (["Digit1","Digit2","Digit3","Digit4"].includes(e.code)) {
            const idx = parseInt(e.code.replace("Digit","")) - 1;
            if (idx < SHAFT_COUNT) {
                currentPressedPedals.add(idx);
                evaluatePedalPhases();
            }
        }
        
        // ESP32 mapping: 7-0 RELEASES pedals (7 releases 1, 8 releases 2, etc.)
        if (["Digit7","Digit8","Digit9","Digit0"].includes(e.code)) {
            const releaseMap = { "Digit7": 0, "Digit8": 1, "Digit9": 2, "Digit0": 3 };
            currentPressedPedals.delete(releaseMap[e.code]);
            evaluatePedalPhases();
        }

        if (e.code === "Space") {
            e.preventDefault();
            
            if (currentPhase === "SHUTTLE") {
                triggerShuttleThrow();
                // Instead of jumping straight to BEAT, we check if pedals need releasing
                if (currentPressedPedals.size > 0) {
                    currentPhase = "RELEASE_PEDAL";
                } else {
                    currentPhase = "BEAT";
                }
                refreshHUD();
            }
            else if (currentPhase === "UNDO_READY") {
                triggerShuttleThrow();
                removeLastWeftFull();
                lessonIndex--;
                evaluatePedalPhases(); 
            }
            else if (currentPhase === "SHED") {
                if (lessonPlan[lessonIndex]?.pedals.length === 0 && currentPressedPedals.size === 0) {
                    currentPhase = "BEAT";
                    triggerShuttleThrow();
                } else {
                    mistakeStack.push(new Set(currentPressedPedals));
                    triggerShuttleThrow(); 
                    if (mistakeStack.length >= MAX_MISTAKES) {
                        showFloatingWarning("LOOM TANGLED: Undo the highlighted sheds.");
                    }
                    currentPhase = checkUndoShedCorrect() ? "ERROR_UNDO_SHUTTLE" : "ERROR_UNDO_SHED";
                }
                refreshHUD();
            }
            else if (currentPhase === "ERROR_UNDO_SHUTTLE") {
                triggerShuttleThrow(); 
                removeLastMistakeWeft();
                mistakeStack.pop();
                shuttleInserted = false; 

                if (mistakeStack.length > 0) {
                    currentPhase = checkUndoShedCorrect() ? "ERROR_UNDO_SHUTTLE" : "ERROR_UNDO_SHED";
                } else {
                    currentPhase = "SHED";
                    evaluatePedalPhases();
                }
                refreshHUD();
            }
            else if (currentPhase === "ERROR_UNDO_SHED") {
                mistakeStack.push(new Set(currentPressedPedals));
                triggerShuttleThrow();
                showFloatingWarning("Mistake stacked! Tangle is getting worse.");
                currentPhase = checkUndoShedCorrect() ? "ERROR_UNDO_SHUTTLE" : "ERROR_UNDO_SHED";
                refreshHUD();
            }
        }

        // Key B: Sends Beater Down (Hold)
        if (e.code === "KeyB" || e.key === "b" || e.key === "B") {
            if (currentPhase === "BEAT" && !beaterHeld) {
                beaterHeld = true; 
            }
        }
        
        // Key V: Puts Beater Back (Release)
        if (e.code === "KeyV" || e.key === "v" || e.key === "V") {
            if (currentPhase === "BEAT" && beaterHeld) {
                beaterHeld = false;
                lessonIndex++;
                if (lessonIndex >= lessonPlan.length) {
                    currentPhase = "DONE";
                } else {
                    currentPhase = "SHED";
                    currentPressedPedals.clear(); 
                }
                refreshHUD();
            }
        }
    }

    function handleLearnKeyUp(e) {
        // PC keyboard naturally releasing pedals
        if (["Digit1","Digit2","Digit3","Digit4"].includes(e.code)) {
            const idx = parseInt(e.code.replace("Digit","")) - 1;
            currentPressedPedals.delete(idx);
            evaluatePedalPhases();
        }
    }

    window.addEventListener("keydown", handleLearnKey,   true);
    window.addEventListener("keyup",   handleLearnKeyUp, true);

    function updateShafts() {
        for (let i = 0; i < SHAFT_COUNT; i++) {
            const isPressed   = currentPressedPedals.has(i);
            const targetY     = isPressed ? SHED_CLOSED_Y : SHED_OPEN_Y;
            const targetAngle = isPressed ? 3 * (Math.PI / 180) : 13 * (Math.PI / 180);
            
            if (pedalPivotGroups[i]) pedalPivotGroups[i].rotation.x += (targetAngle - pedalPivotGroups[i].rotation.x) * 0.4;
            if (heddleFrames[i])     heddleFrames[i].position.y     += (targetY - heddleFrames[i].position.y) * 0.4;
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
        const warpCount = threading.length; 
        const points    = [];
        const shed      = [];
        for (let i = 0; i < SHAFT_COUNT; i++) shed.push(!currentPressedPedals.has(i));
        
        const rowStates = [];
        for (let i = 0; i < warpCount; i++) {
            const x     = (i / (warpCount - 1)) * HEDDLE_WIDTH - HEDDLE_WIDTH / 2;
            const shaft = threading[i % threading.length];
            const isUp  = shed[shaft];
            rowStates.push(isUp);
            points.push(new THREE.Vector3(x, (BREAST_BEAM_Y + 0.05) + (isUp ? 0.18 : -0.18), shuttleGroup.position.z));
        }

        const rowNum = Math.min(lessonIndex, lessonPlan.length - 1);
        const currentRowColor = (learnPattern.rowColors && learnPattern.rowColors[rowNum]) 
            ? learnPattern.rowColors[rowNum] 
            : (learnPattern.weftColor || "#c0392b");

        const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(points),
            new THREE.LineBasicMaterial({ color: new THREE.Color(currentRowColor) })
        );
        scene.add(line);
        activeWeft = { line, isBeaten: false, live: true, warpPattern: rowStates.slice() };
        weftThreads.push(activeWeft);
        shuttleMovingPositive = null;
        lastShuttleX          = shuttleGroup.position.x;
        shuttleDirectionChanges = 0;
    }

    function updateActiveWeftShape() {
        if (weftThreads.length === 0) return;
        const currentWeft = weftThreads[weftThreads.length - 1];
        if (!currentWeft || !currentWeft.live || currentWeft.isBeaten) return;

        const pos = currentWeft.line.geometry.attributes.position;
        for (let j = 0; j < pos.count; j++) {
            const shaft = threading[j % threading.length];
            if (shuttleGroup.position.z < fellZ + 0.02) {
                const isUp = !currentPressedPedals.has(shaft);
                const targetY = (BREAST_BEAM_Y + 0.05) + (isUp ? 0.18 : -0.18);
                pos.setY(j, THREE.MathUtils.lerp(pos.getY(j), targetY, 0.4));
            } else {
                pos.setY(j, (BREAST_BEAM_Y + 0.05) + (currentWeft.warpPattern[j] ? 0.18 : -0.18));
            }
        }
        pos.needsUpdate = true;
    }

    function checkWeftInsertion() {
        if (!shuttleArmed || shuttleInserted) return;
        
        const fromLeft  = shuttleStartSide === -1 && shuttleGroup.position.x > 0;
        const fromRight = shuttleStartSide ===  1 && shuttleGroup.position.x < 0;
        
        if (fromLeft || fromRight) { 
            if (currentPhase === "BEAT" || currentPhase === "RELEASE_PEDAL") {
                addWeftThread(); 
            }
            shuttleInserted = true; 
        }
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

    function processBeat(currentHitZ) {
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
        shuttleInserted    = false;
        shuttleArmed       = false;
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

    function showFloatingWarning(msg) {
        const existing = document.getElementById("habi-floating-msg");
        if (existing) existing.remove();

        const toast = document.createElement("div");
        toast.id = "habi-floating-msg";
        toast.style.cssText = `
            position: fixed; top: 100px; left: 50%; transform: translateX(-50%);
            background: #2b0303; color: white; padding: 16px 32px; border-radius: 12px;
            font-weight: 600; z-index: 1000; border: 2px solid #d93025;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5); pointer-events: none;
            animation: slideDownIn 0.4s ease-out forwards;
        `;
        toast.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="margin-right:10px; color:#d93025;"></i> ${msg}`;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = "slideUpOut 0.4s ease-in forwards";
            setTimeout(() => toast.remove(), 400);
        }, 3000);

        playErrorSound();
    }

    function animate() {
        requestAnimationFrame(animate);
        updateShafts();
        tickAutoPlay();
        updateActiveWeftShape();

        const targetX = shuttleCurrentSide * SHUTTLE_LIMIT;
        shuttleGroup.position.x += (targetX - shuttleGroup.position.x) * 0.35;

        // Determine if beater is down (held or animating via skip/autoplay)
        const beaterPressed = beaterHeld || beatTimer > 0;
        if (beatTimer > 0) beatTimer--;

        updateClothTakeup();

        const hitZ        = BEATER_HIT_Z - rowCounter * ROW_SPACING;
        const targetBeatZ = beaterPressed ? hitZ : BEATER_REST_Z;
        
        beaterGroup.position.z += (targetBeatZ - beaterGroup.position.z) * (beaterPressed ? 0.6 : 0.35);

        checkWeftInsertion();
        checkWeftReady();

        // If in BEAT phase, the beater is being pressed down, and thread is loose, lock it in!
        if (beaterPressed && currentPhase === "BEAT" && activeWeft && !activeWeft.isBeaten) {
            processBeat(hitZ);
            refreshHUD(); // Update instructions to tell user to put the beater back
        }

        shuttleGroup.position.y = beaterGroup.position.y - 0.35;
        shuttleGroup.position.z = beaterGroup.position.z + 0.18;

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
