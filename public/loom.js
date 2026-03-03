import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";

//////////////////////////////////////////////////
// TOP-LEVEL STATE
//////////////////////////////////////////////////
let recordedSteps = [];
let loomConfig = null;
let threading = [];
let beatTimer = 0;

const BEAT_DURATION = 18; // frames (~0.3 sec at 60fps)

//////////////////////////////////////////////////
// SETUP OVERLAY — Entry point
//////////////////////////////////////////////////
function attachStartButton() {
    const startBtn = document.getElementById("startWeaving");

    if (!startBtn) {
        requestAnimationFrame(attachStartButton);
        return;
    }

    startBtn.onclick = () => {
        loomConfig = {
            patternName: document.getElementById("patternName").value,
            loomType: document.getElementById("loomType").value,
            patternType: document.getElementById("patternType").value,
            width: parseFloat(document.getElementById("clothWidth").value),
            height: parseFloat(document.getElementById("clothHeight").value)
        };

        if (!loomConfig.patternName) {
            alert("Please enter a pattern name.");
            return;
        }

        document.getElementById("setupOverlay").style.display = "none";
        initLoom();
    };
}

//////////////////////////////////////////////////
// MAIN LOOM INITIALIZER
//////////////////////////////////////////////////
function initLoom() {
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

    // Z-positions for heddle frames (front to back)
    let zPositions = [];
    if (SHAFT_COUNT === 2) {
        zPositions = [TOWER_Z - 0.25, TOWER_Z + 0.25];
    } else {
        zPositions = [TOWER_Z - 0.45, TOWER_Z - 0.15, TOWER_Z + 0.15, TOWER_Z + 0.45];
    }

    //----------------------------------------------
    // RUNTIME STATE
    //----------------------------------------------
    const activeKeys = new Set();
    const pedalPivotGroups = [];
    const heddleFrames = [];
    const warpGroups = [];
    for (let i = 0; i < SHAFT_COUNT; i++) warpGroups.push([]);

    // Multi-pedal support (from main.js)
    let currentPressedPedals = new Set();

    let beaterGroup, shuttleGroup, clothRoller;
    let weftThreads = [];
    let activeWeft = null;
    let patternHistory = [];
    let rowCounter = 0;
    let fellZ = BASE_FRONT - 0.12;

    // Shuttle pass state (from main.js)
    let shuttleSideToggle = false;
    let shuttleArmed = false;
    let shuttleInserted = false;
    let shuttleStartSide = -1;
    let shuttleCrossed = false;

    // Direction-change void tracking (from main.js)
    // Odd number of direction changes after insertion = invalid pass → void immediately.
    // Even changes (0, 2, 4...) = shuttle ended up on the correct side = valid.
    let shuttleDirectionChanges = 0;
    let shuttleMovingPositive = null;
    let lastShuttleX = 0;

    // Treadling / auto-pattern state
    let treadlingSequence = [];
    let treadlingIndex = 0;
    let weftReadyToBeat = false;
    let shuttleCurrentSide = -1; // -1 = left, 1 = right

    // Auto-shuttle for traditional loom
    let pedalHoldTimer = 0;
    let pedalHoldActive = false;
    const PEDAL_AUTO_SHUTTLE_DELAY = 30; // ~0.5 sec at 60fps
    let lastPedalState = false;

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
        for (let i = 0; i < 120; i++) {
            const x = (i / 120) * HEDDLE_WIDTH - HEDDLE_WIDTH / 2;
            const hIdx = i % SHAFT_COUNT;
            threading[i] = hIdx;

            const points = [
                new THREE.Vector3(x, BREAST_BEAM_Y + 0.05, BASE_FRONT - 0.1),
                new THREE.Vector3(x, BREAST_BEAM_Y + 0.05, BASE_FRONT - 0.1),
                new THREE.Vector3(x, SHED_OPEN_Y, zPositions[hIdx]),
                new THREE.Vector3(x, WARP_BEAM_Y + 0.3, BACK)
            ];
            const thread = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(points),
                threadMaterial
            );
            scene.add(thread);
            warpGroups[hIdx].push(thread);
        }
    }

    function createClothBase() {
        for (let i = 0; i <= 120; i++) {
            const x = (i / 120) * HEDDLE_WIDTH - HEDDLE_WIDTH / 2;
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
    // AUTO-SHUTTLE (traditional loom — from main.js)
    //----------------------------------------------
    function handleAutoShuttle() {
        if (loomConfig.loomType !== "traditional") return;

        const pedalPressed = currentPressedPedals.size > 0;

        if (pedalPressed && !lastPedalState) {
            pedalHoldActive = true;
            pedalHoldTimer = PEDAL_AUTO_SHUTTLE_DELAY;
        }

        if (pedalHoldActive && pedalPressed) {
            pedalHoldTimer--;
            if (pedalHoldTimer <= 0) {
                if (isShedOpenEnough()) {
                    handleHardwareInput("S");
                }
                pedalHoldActive = false;
            }
        }

        if (!pedalPressed) {
            pedalHoldActive = false;
        }

        lastPedalState = pedalPressed;
    }

    //----------------------------------------------
    // WEFT / WEAVING LOGIC
    //----------------------------------------------
    function addWeftThread() {
        if (activeWeft) return;

        const warpCount = 60;
        const points = [];

        const shed = [];
        for (let i = 0; i < SHAFT_COUNT; i++) {
            shed.push(!currentPressedPedals.has(i));
        }

        const rowStates = [];
        for (let i = 0; i <= warpCount; i++) {
            const x = (i / warpCount) * HEDDLE_WIDTH - HEDDLE_WIDTH / 2;
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

        // Reset direction tracking from the exact moment the weft is inserted
        shuttleMovingPositive = null;
        lastShuttleX = shuttleGroup.position.x;
        shuttleDirectionChanges = 0;
    }

    function undoLastWeft() {
        if (weftThreads.length === 0) return;
        const lastThread = weftThreads[weftThreads.length - 1];
        if (lastThread.isBeaten) return;

        scene.remove(lastThread.line);
        weftThreads.pop();
        patternHistory.pop();
        activeWeft = null;
    }

    // Immediately void and remove the active weft from the scene.
    // Called as soon as an odd-numbered direction change is detected.
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
        beatTimer = 0;

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
        const warpCount = 60;
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
                    ctx.fillStyle = document.getElementById('shuttleColor').value;
                    ctx.fillRect(warpIndex * cellSize, y, cellSize, cellSize);
                } else {
                    ctx.fillStyle = "#000000";
                    ctx.fillRect(warpIndex * cellSize + (cellSize * 0.8), y, cellSize * 0.2, cellSize);
                }
            });
        });

        const link = document.createElement('a');
        link.download = 'woven-pattern-done.png';
        link.href = exportCanvas.toDataURL('image/png');
        link.click();
    }

    //----------------------------------------------
    // HARDWARE (BLE / ESP32)
    //----------------------------------------------
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

    function handleHardwareInput(data) {
        data = data.trim();
        console.log("Hardware Data Received:", data);

        // Multi-pedal (comma-separated)
        if (data.includes(",")) {
            currentPressedPedals.clear();
            data.split(",").forEach(p => {
                const pedalIdx = parseInt(p) - 1;
                if (!isNaN(pedalIdx)) currentPressedPedals.add(pedalIdx);
            });
            recordedSteps.push({ action: "pedals", value: Array.from(currentPressedPedals) });
            return;
        }

        // Single pedal press
        if (["1", "2", "3", "4", "5"].includes(data)) {
            const pedalIdx = parseInt(data) - 1;
            currentPressedPedals.add(pedalIdx);
            recordedSteps.push({ action: "pedal", value: pedalIdx });
            return;
        }

        // Release all pedals
        if (data === "0" || data === "R") {
            currentPressedPedals.clear();
            return;
        }

        // Beat
        if (data === "B") {
            beatTimer = BEAT_DURATION;
            recordedSteps.push({ action: "beat" });
            return;
        }

        // Shuttle throw
        if (data === "S") {

            // CASE 1: Unbeaten weft exists → remove it and return shuttle
            if (activeWeft && !activeWeft.isBeaten) {
                console.log("Second press — pulling weft back.");

                scene.remove(activeWeft.line);
                activeWeft.line.geometry.dispose();
                activeWeft.line.material.dispose();

                weftThreads.pop();
                patternHistory.pop();

                activeWeft = null;
                weftReadyToBeat = false;

                shuttleCurrentSide = shuttleStartSide;
                shuttleGroup.position.x = shuttleStartSide * SHUTTLE_LIMIT;

                shuttleInserted = false;
                shuttleArmed = false;

                return;
            }

            // CASE 2: Normal shuttle throw
            shuttleStartSide = shuttleCurrentSide;
            shuttleCurrentSide = -shuttleCurrentSide;

            shuttleInserted = false;
            shuttleArmed = true;

            lastShuttleX = shuttleGroup.position.x;

            recordedSteps.push({ action: "shuttle" });
            return;
        }
    }

    //----------------------------------------------
    // INPUT — KEYBOARD
    //----------------------------------------------
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Digit1') handleHardwareInput("1");
        if (e.code === 'Digit2') handleHardwareInput("2");
        if (e.code === 'Digit3') handleHardwareInput("3");
        if (e.code === 'Digit4') handleHardwareInput("4");

        if (e.code === 'Space') {
            e.preventDefault();
            handleHardwareInput("S");
        }

        if (e.code === 'Digit0' || e.code === 'Numpad0') {
            beatTimer = BEAT_DURATION;
            handleHardwareInput("B");
        }

        if (e.code === 'KeyZ') undoLastWeft();
    }, true);

    window.addEventListener('keyup', (e) => {
        if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) {
            const pedalIdx = parseInt(e.code.replace('Digit', '')) - 1;
            currentPressedPedals.delete(pedalIdx);
        }
    });

    //----------------------------------------------
    // UI PANEL
    //----------------------------------------------
    function createUI() {
        // Control panel (bottom-left style, inside weaving-studio)
        const gui = document.createElement('div');
        gui.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            padding: 12px;
            background: rgba(15, 15, 20, 0.95);
            color: white;
            font-family: sans-serif;
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            z-index: 100;
            border: 1px solid #444;
            width: 240px;
            max-height: calc(100% - 40px);
            overflow-y: auto;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        `;

        gui.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom: 8px; border-bottom: 1px solid #333;">
                <span style="font-weight:bold; font-size:16px;">Loom Controls</span>
                <button id="backToMenuBtn" style="padding:4px 10px; background:none; border:1px solid #555; color:#aaa; border-radius:6px; cursor:pointer; font-size:11px;">← Back</button>
            </div>

            <button id="bleConnect" style="padding:10px; background:#007bff; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:12px; width:100%;">
                Connect ESP32
            </button>

            <div style="font-size: 11px; color: #888; line-height: 1.4; background: #222; padding: 8px; border-radius: 4px;">
                1-4: Shed &nbsp;|&nbsp; Space: Shuttle<br>0: Beat &nbsp;|&nbsp; Z: Undo
            </div>

            <hr style="border:0; border-top:1px solid #333; margin: 2px 0;">

            <div style="display: flex; flex-direction: column; gap: 8px;">
                <label style="font-size:12px; display:flex; justify-content:space-between; align-items:center;">
                    Warp <input type="color" id="warpColor" value="#ffffff" style="border:none; width:30px; height:20px; background:none; cursor:pointer;">
                </label>
                <label style="font-size:12px; display:flex; justify-content:space-between; align-items:center;">
                    Cloth <input type="color" id="clothColor" value="#f0eadf" style="border:none; width:30px; height:20px; background:none; cursor:pointer;">
                </label>
                <label style="font-size:12px; display:flex; justify-content:space-between; align-items:center;">
                    Shuttle <input type="color" id="shuttleColor" value="#f0eadf" style="border:none; width:30px; height:20px; background:none; cursor:pointer;">
                </label>
            </div>

            <hr style="border:0; border-top:1px solid #333; margin: 2px 0;">

            <button id="convertBtn" style="padding:10px; background:#28a745; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:12px; width:100%;">
                Export Pattern
            </button>

            <button id="savePattern" style="padding:10px; background:#fd7e14; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:12px; width:100%;">
                Save to Learning Library
            </button>
        `;

        document.getElementById("weaving-studio").appendChild(gui);

        // 2D Pattern Panel
        const patternPanel = document.createElement("div");
        patternPanel.style.cssText = `
            position: absolute;
            bottom: 20px;
            right: 20px;
            width: 420px;
            height: 260px;
            background: rgba(0,0,0,0.9);
            color: white;
            border-radius: 10px;
            border: 1px solid #444;
            padding: 15px;
            box-sizing: border-box;
            z-index: 101;
            display: flex;
            flex-direction: column;
        `;
        patternPanel.innerHTML = `
            <div style="font-weight:bold; margin-bottom:10px;">Live 2D Pattern</div>
            <div id="patternContainer" style="flex:1; overflow:auto; background:#111; padding:5px; border-radius:6px;">
                <canvas id="patternCanvas" style="background:white; border-radius:4px;"></canvas>
            </div>
        `;
        document.getElementById("weaving-studio").appendChild(patternPanel);

        render2DPattern();

        // Event listeners
        document.getElementById('warpColor').addEventListener('input', (e) =>
            threadMaterial.color.set(e.target.value)
        );
        document.getElementById('clothColor').addEventListener('input', (e) =>
            clothThreadMaterial.color.set(e.target.value)
        );
        document.getElementById('shuttleColor').addEventListener('input', (e) =>
            shuttleThreadMaterial.color.set(e.target.value)
        );

        document.getElementById('convertBtn').addEventListener('click', exportPatternImage);
        document.getElementById('bleConnect').addEventListener('click', connectBLE);
        document.getElementById('backToMenuBtn').addEventListener('click', () => {
            document.getElementById('modeSelectionOverlay').style.display = 'flex';
        });
        
        // MongoDB save via REST API
        document.getElementById("savePattern").addEventListener("click", async () => {
            if (patternHistory.length === 0) {
                alert("Weave and beat at least one row before saving!");
                return;
            }

            // Read weft colour from picker; fall back to material colour
            const shuttleColorEl = document.getElementById("shuttleColor");
            const weftColor = shuttleColorEl
                ? shuttleColorEl.value
                : "#" + shuttleThreadMaterial.color.getHexString();

            const data = {
                name:        loomConfig.patternName || "Untitled Weave",
                type:        loomConfig.patternType,
                loom:        loomConfig.loomType,
                steps:       recordedSteps,
                patternRows: patternHistory,   // full weave draft for canvas preview
                weftColor:   weftColor,
                created:     Date.now()
            };

            console.log("[SAVE] name:", data.name, "| rows:", data.patternRows.length, "| loom:", data.loom);

            try {
                const res = await fetch("/api/patterns/save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data)
                });
                if (res.ok) {
                    alert("✨ Pattern saved to your Library successfully!");
                } else {
                    const errBody = await res.json().catch(() => ({}));
                    console.error("Save failed:", res.status, errBody);
                    alert("Save failed (" + res.status + ") — " + (errBody.error || errBody.message || "check server logs"));
                }
            } catch (err) {
                console.error("Save fetch error:", err);
                alert("Could not connect to the server.");
            }
        });
    }
    createUI();

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

        const warpCount = 60;
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
            rowStates.forEach((isWarpUp, warpIndex) => {
                const y = (patternHistory.length - 1 - rowIndex) * cellSize;
                if (!isWarpUp) {
                    ctx.fillStyle = shuttleThreadMaterial.color.getStyle();
                    ctx.fillRect(warpIndex * cellSize, y, cellSize, cellSize);
                } else {
                    ctx.fillStyle = "#000000";
                    ctx.fillRect(
                        warpIndex * cellSize + cellSize * 0.8,
                        y,
                        cellSize * 0.2,
                        cellSize
                    );
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

    // Animate shafts, pedals, and warp threads toward their targets
    function updateShafts() {
        for (let i = 0; i < SHAFT_COUNT; i++) {
            const isPressed = currentPressedPedals.has(i);
            const targetHeddleY = isPressed ? SHED_CLOSED_Y : SHED_OPEN_Y;
            const targetAngle   = isPressed ? 3 * (Math.PI / 180) : 13 * (Math.PI / 180);

            if (pedalPivotGroups[i])
                pedalPivotGroups[i].rotation.x += (targetAngle - pedalPivotGroups[i].rotation.x) * 0.15;

            if (heddleFrames[i])
                heddleFrames[i].position.y += (targetHeddleY - heddleFrames[i].position.y) * 0.15;

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

    // Keep the active weft thread shaped to the live shed while the shuttle is moving
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

    // Roll finished cloth onto the cloth beam when enough rows have accumulated
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

    // Insert the weft thread when the shuttle crosses the center through an open shed
    function checkWeftInsertion() {
        if (!shuttleArmed || shuttleInserted || !isShedOpenEnough()) return;

        const crossingFromLeft  = shuttleStartSide === -1 && shuttleGroup.position.x > 0;
        const crossingFromRight = shuttleStartSide ===  1 && shuttleGroup.position.x < 0;

        if (crossingFromLeft || crossingFromRight) {
            addWeftThread();
            shuttleInserted = true;
        }
    }

    // Track direction changes every frame after weft insertion.
    // ODD count  → shuttle went back the wrong way → void immediately.
    // EVEN count → shuttle wiggled but ended up correct side → still valid.
    function checkDirectionChanges() {
        if (!activeWeft || activeWeft.isBeaten || !shuttleInserted) return;

        const reachedRight = shuttleStartSide === -1 && shuttleGroup.position.x >  SHUTTLE_LIMIT * 0.9;
        const reachedLeft  = shuttleStartSide ===  1 && shuttleGroup.position.x < -SHUTTLE_LIMIT * 0.9;

        if (activeWeft && (reachedRight || reachedLeft)) {
            if (reachedRight) shuttleCurrentSide =  1;
            if (reachedLeft)  shuttleCurrentSide = -1;
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
                shuttleMovingPositive = movingPositive;
                console.log("Direction change count:", shuttleDirectionChanges);

                if (shuttleDirectionChanges % 2 !== 0) {
                    voidActiveWeft();
                    return;
                }
            }
        }

        lastShuttleX = currentX;
    }

    // Compress the active weft to the fell line on beat.
    function processBeat(beaterPressed, currentHitZ) {
        if (!beaterPressed || beatTimer !== BEAT_DURATION - 1) return;

        if (!activeWeft || !weftReadyToBeat) {
            beatTimer = 0;
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
        fellZ = currentHitZ;

        activeWeft = null;
        weftReadyToBeat = false;

        shuttleDirectionChanges = 0;
        shuttleMovingPositive = null;

        render2DPattern();
    }

    //----------------------------------------------
    // MAIN ANIMATION LOOP
    //----------------------------------------------
    function animate() {
        requestAnimationFrame(animate);

        // 1. Shafts, pedals, warp threads
        updateShafts();

        // 2. Auto-shuttle for traditional loom
        handleAutoShuttle();

        // 3. Active weft thread shape (follows live shed while shuttle is mid-pass)
        updateActiveWeftShape();

        // 4. Move shuttle toward its target side (lerp)
        const targetX = shuttleCurrentSide * SHUTTLE_LIMIT;
        shuttleGroup.position.x += (targetX - shuttleGroup.position.x) * 0.12;

        // 5. Tick beat timer
        const beaterPressed = beatTimer > 0;
        if (beatTimer > 0) beatTimer--;

        // 6. Cloth take-up
        updateClothTakeup();

        // 7. Move beater toward hit or rest position
        const currentHitZ = BEATER_HIT_Z - (rowCounter * ROW_SPACING);
        const targetBeaterZ = beaterPressed ? currentHitZ : BEATER_REST_Z;
        const lerpSpeed = beaterPressed ? 0.4 : 0.12;
        beaterGroup.position.z += (targetBeaterZ - beaterGroup.position.z) * lerpSpeed;

        // 8. Insert weft when shuttle crosses center through an open shed
        checkWeftInsertion();

        // 9. Track direction changes — voids and removes thread immediately if odd count
        checkDirectionChanges();

        // 10. Compress weft on beat (only valid threads reach this point)
        processBeat(beaterPressed, currentHitZ);

        // 11. Keep shuttle attached to beater position
        shuttleGroup.position.y = beaterGroup.position.y - 0.35;
        shuttleGroup.position.z = beaterGroup.position.z + 0.18;

        controls.update();
        renderer.render(scene, camera);
    }

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