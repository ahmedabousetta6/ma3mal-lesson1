import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MindARThree } from "mindar-image-three";
import { createStudioEnvMap } from "./pbr_engine.js";
import {
  createVirtualLabRoom,
  createStation0PhaseAndFridge,
  createStation1Calorimeter,
  createStation2Crystals,
  createStation3PacksAndSafety,
} from "./lesson1_ar_vr_scenes.js";

import { createLabSound } from "./lab-sound.js";

const EXP_SLUG_MAP = {
  phase: 0,
  calorimeter: 1,
  crystals: 2,
  packs: 3,
};

// UI Elements
const welcomeScreen = document.getElementById("welcome-screen");
const errorModal = document.getElementById("error-modal");
const errorTitle = document.getElementById("error-title");
const errorMessage = document.getElementById("error-message");
const loadingOverlay = document.getElementById("loading-overlay");
const loadingText = document.getElementById("loading-text");

const arViewport = document.getElementById("ar-viewport");
const vrCanvas = document.getElementById("vr-canvas");
const stereoDivider = document.getElementById("stereo-divider");

const hudTop = document.getElementById("hud-top");
const trackingPill = document.getElementById("tracking-pill");
const trackingText = document.getElementById("tracking-text");
const buildStepPill = document.getElementById("build-step-pill");
const btnReplayEmerge = document.getElementById("btn-replay-emerge");
const btnZoomAR = document.getElementById("btn-zoom-ar");
const btnStereo = document.getElementById("btn-stereo");
const btnSwitchMode = document.getElementById("btn-switch-mode");
const btnHome = document.getElementById("btn-home");
const stationTabs = document.getElementById("station-tabs");

const scanGuide = document.getElementById("scan-guide");

const hudBottom = document.getElementById("hud-bottom");
const subExpButtons = Array.from(document.querySelectorAll(".sub-exp-btn"));
const lessonBadge = document.getElementById("lesson-badge");
const stateDescription = document.getElementById("state-description");
const btnHold = document.getElementById("btn-hold-action");
const holdFill = document.getElementById("hold-fill");
const holdLabel = document.getElementById("hold-label");
const btnSecondary = document.getElementById("btn-secondary-action");
const btnTertiary = document.getElementById("btn-tertiary-action");

// Runtime State
let mode = "idle"; // "idle" | "vr" | "ar"
let stereoVR = false;
let mindarThree = null;
let arAnchors = [];
let arSmoothGroups = [];
let arAdapters = [];
let arStations = [];

// Heroic AR Camera Scale Presets (fills the phone screen cleanly with full front-interior visibility!)
const AR_ZOOM_PRESETS = [
  { scale: 0.78, label: "🔍 حجم المجسّم: كبير+" },
  { scale: 0.98, label: "🔍 حجم المجسّم: عملاق" },
  { scale: 0.62, label: "🔍 حجم المجسّم: متوسط" },
];
let arZoomPresetIdx = 0;
let arCustomScale = AR_ZOOM_PRESETS[0].scale;
let arUserYaw = 0;

let vrRenderer = null;
let vrScene = null;
let vrCamera = null;
let vrLeftCam = null;
let vrRightCam = null;
let vrControls = null;
let vrStations = [];
let vrRafId = 0;
let renderScale = 1, frameSample = 0, frameAverage = 0;

let activeARIndex = -1;
let activeVRStation = 0;
let isHoldingPrimary = false;
let lastTs = performance.now();
const sound = createLabSound();
const soundButton = document.getElementById("btn-sound");
const liftSlider = document.getElementById("page-lift");
let lastUI = {};
function paintSoundButton() {
  soundButton.textContent = sound.enabled ? "الصوت شغّال" : "الصوت مكتوم";
  soundButton.setAttribute("aria-pressed", String(sound.enabled));
}
paintSoundButton();
soundButton.addEventListener("click", () => { sound.toggle(); paintSoundButton(); });
document.addEventListener("pointerdown", () => sound.unlock(), {capture: true, passive: true});
document.addEventListener("keydown", () => sound.unlock(), {capture: true});
document.addEventListener("visibilitychange", () => { if (document.hidden) { sound.silence(); endHold(); } });
window.addEventListener("blur", () => { endHold(); });
liftSlider.addEventListener("input", () => {
  endHold();
  const station = getCurrentStation();
  if (!station) return;
  station.setLift(Number(liftSlider.value) / 100);
  updateHud(station.update(0, {heating: false}));
});

const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();

window.__KASHF_L1_DIAG = {
  get mode() { return mode; },
  get stereoVR() { return stereoVR; },
  get stationIndex() { return mode === "ar" ? activeARIndex : activeVRStation; },
  get anchorVisible() { return arAnchors.map((a) => Boolean(a?.group?.visible)); },
  get arScale() { return arCustomScale; },
  get lastStateText() { return stateDescription?.textContent || ""; },
  get buildStepText() { return buildStepPill?.textContent || ""; },
};

function getCurrentStation() {
  if (mode === "ar") return activeARIndex >= 0 ? arStations[activeARIndex] : null;
  if (mode === "vr") return vrStations[activeVRStation] || null;
  return null;
}

function updateHud(ui) {
  if (!ui) return;
  sound.update(ui);
  lastUI = ui;
  const lift = String(Math.round(ui.lift * 100));
  if (liftSlider.value !== lift) liftSlider.value = lift;
  btnHold.disabled = Boolean(ui.emerging);
  btnSecondary.disabled = Boolean(ui.emerging);
  if (lessonBadge.textContent !== ui.badge) lessonBadge.textContent = ui.badge;
  if (stateDescription.textContent !== ui.stateText) stateDescription.textContent = ui.stateText;
  if (holdLabel.textContent !== ui.holdLabel) holdLabel.textContent = ui.holdLabel;
  holdFill.style.width = `${Math.round(ui.progress * 100)}%`;
  if (btnSecondary.textContent !== ui.secondaryLabel) btnSecondary.textContent = ui.secondaryLabel;
  const tertiaryLabel = ui.tertiaryLabel || "↺ إعادة";
  if (btnTertiary.textContent !== tertiaryLabel) btnTertiary.textContent = tertiaryLabel;
  btnTertiary.disabled = Boolean(ui.emerging);
  btnTertiary.hidden = !ui.showTertiary;
  if (buildStepPill) {
    if (ui.buildPill) {
      buildStepPill.hidden = false;
      if (buildStepPill.textContent !== ui.buildPill) buildStepPill.textContent = ui.buildPill;
    } else {
      buildStepPill.hidden = true;
    }
  }
  if (ui.stepChime !== null && ui.stepChime !== undefined) {
    sound.build();
  }
  if (Array.isArray(ui.subTabs)) {
    subExpButtons.forEach((b, idx) => {
      if (b.textContent !== ui.subTabs[idx]) b.textContent = ui.subTabs[idx] || "";
      b.classList.toggle("active", idx === ui.subIndex);
    });
  }
}

function handleTap(clientX, clientY) {
  const st = getCurrentStation();
  if (lastUI.emerging || !st?.interactables?.length) return;
  const cam = mode === "ar" ? mindarThree?.camera : vrCamera;
  if (!cam) return;
  pointerNDC.x = (clientX / window.innerWidth) * 2 - 1;
  pointerNDC.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, cam);
  const hits = raycaster.intersectObjects(st.interactables, false);
  for (const h of hits) {
    if (h.object.parent?.visible !== false && typeof h.object.userData.onTap === "function") {
      h.object.userData.onTap();
      updateHud(st.update(0, {heating: false}));
      break;
    }
  }
}

// Interactive Touch Gestures in AR Camera Mode:
// - 1-finger drag rotates the 3D apparatus 360° right on top of the printed page!
// - 2-finger pinch zooms the 3D apparatus smoothly from 0.85x up to 2.25x!
const activePointers = new Map();
let tapStart = null;
let lastDragX = 0;
let lastPinchDist = 0;

window.addEventListener("pointerdown", (e) => {
  if (e.target.closest("header, footer, section, button, a")) return;
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (activePointers.size === 1) {
    tapStart = { x: e.clientX, y: e.clientY };
    lastDragX = e.clientX;
  } else if (activePointers.size === 2) {
    const pts = Array.from(activePointers.values());
    lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    tapStart = null;
  }
});

window.addEventListener("pointermove", (e) => {
  if (!activePointers.has(e.pointerId)) return;
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (mode !== "ar" || activeARIndex < 0) return;

  if (activePointers.size === 1) {
    const dx = e.clientX - lastDragX;
    lastDragX = e.clientX;
    arUserYaw += dx * 0.009;
  } else if (activePointers.size === 2) {
    const pts = Array.from(activePointers.values());
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    if (lastPinchDist > 8) {
      arCustomScale = THREE.MathUtils.clamp(arCustomScale * (dist / lastPinchDist), 0.45, 1.8);
    }
    lastPinchDist = dist;
  }
});

function clearPointer(e) {
  if (tapStart && activePointers.size <= 1) {
    if (Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) < 12) {
      handleTap(e.clientX, e.clientY);
    }
  }
  activePointers.delete(e.pointerId);
  if (activePointers.size === 0) {
    tapStart = null;
    lastPinchDist = 0;
  }
}
window.addEventListener("pointerup", clearPointer);
window.addEventListener("pointercancel", clearPointer);

async function stopAR() {
  sound.silence();
  endHold();
  if (mindarThree) {
    const tracker = mindarThree;
    try { tracker.renderer.setAnimationLoop(null); await tracker.stop(); } catch (_) {}
    tracker.scene.environment?.userData?.renderTarget?.dispose();
    tracker.renderer.dispose();
    mindarThree = null;
  }
  arAnchors = []; arSmoothGroups = []; arAdapters = []; arStations = [];
  arViewport.innerHTML = "";
  activeARIndex = -1;
}

function stopVR() {
  sound.silence();
  endHold();
  if (vrRafId) { cancelAnimationFrame(vrRafId); vrRafId = 0; }
  vrCanvas.hidden = true;
  stereoDivider.hidden = true;
  document.body.classList.remove("stereo-mode");
}

/**
 * ============================================================================
 * 360° VIRTUAL REALITY SCIENCE LAB ROOM (+ Stereoscopic VR Split-Screen!)
 * ============================================================================
 */
async function startVRMode(stationIdx = 0) {
  await stopAR();
  stopVR();

  welcomeScreen.hidden = true;
  errorModal.hidden = true;
  scanGuide.hidden = true;
  vrCanvas.hidden = false;

  if (!vrRenderer) {
    vrRenderer = new THREE.WebGLRenderer({ canvas: vrCanvas, antialias: true, powerPreference: "high-performance" });
    vrRenderer.outputColorSpace = THREE.SRGBColorSpace;
    vrRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    vrRenderer.toneMappingExposure = 0.97;
    vrRenderer.shadowMap.enabled = true;
    vrRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    vrRenderer.localClippingEnabled = true;

    vrScene = new THREE.Scene();
    vrScene.environment = createStudioEnvMap(vrRenderer);
    vrScene.add(createVirtualLabRoom());

    vrCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 20);
    vrLeftCam = new THREE.PerspectiveCamera(45, 1, 0.05, 20);
    vrRightCam = new THREE.PerspectiveCamera(45, 1, 0.05, 20);

    // Closer, bolder hero camera framing in 360° VR with full headroom below HUD!
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const dScale = aspect < 0.8 ? Math.min(1.75, 0.65 / aspect) : 1.0;
    vrCamera.position.set(0.50 * dScale, 0.79 * dScale, 1.36 * dScale);

    vrControls = new OrbitControls(vrCamera, vrCanvas);
    vrControls.enableDamping = true;
    vrControls.dampingFactor = 0.07;
    vrControls.enablePan = false;
    vrControls.minDistance = 0.42;
    vrControls.maxDistance = 2.2;
    vrControls.minPolarAngle = 0.22;
    vrControls.maxPolarAngle = Math.PI * 0.49;
    vrControls.target.set(0, 0.245, 0);

    vrStations = [
      createStation0PhaseAndFridge,
      createStation1Calorimeter,
      createStation2Crystals,
      createStation3PacksAndSafety,
    ];
    window.addEventListener("deviceorientation", (ev) => {
      if (!stereoVR || ev.gamma === null || ev.beta === null) return;
      const az = THREE.MathUtils.degToRad(ev.gamma) * 0.4;
      vrCamera.position.x = Math.sin(az) * 0.92;
      vrCamera.position.z = Math.cos(az) * 0.92;
      vrCamera.lookAt(0, 0.24, 0);
    });
  }

  resizeVR();
  selectVRStation(stationIdx);

  mode = "vr";
  hudTop.hidden = false;
  stationTabs.hidden = false;
  btnStereo.hidden = false;
  btnZoomAR.hidden = true;
  btnReplayEmerge.hidden = false;
  hudBottom.hidden = false;
  stereoDivider.hidden = !stereoVR;
  frameVR();
  trackingPill.classList.add("tracked");
  trackingText.textContent = stereoVR ? "وضع نظارة الواقع الافتراضي المزدوج (VR)" : "غرفة «مَعْمَل» 360° • اسحب للالتفات أو التقريب";
  btnSwitchMode.textContent = "📷 كاميرا AR";

  lastTs = performance.now();
  function loop(now) {
    vrRafId = requestAnimationFrame(loop);
    const elapsed = Math.max(0, (now - lastTs) / 1000);
    lastTs = now;
    if (document.hidden) return;
    const dt = Math.min(1, elapsed);
    if (elapsed > 0 && elapsed < 2) {
      frameAverage += elapsed;
      if (++frameSample === 16) {
        const mean = frameAverage / frameSample;
        const nextScale = mean > 0.055 ? Math.max(0.65, renderScale - 0.15)
          : mean < 0.02 ? Math.min(1, renderScale + 0.05) : renderScale;
        if (nextScale !== renderScale) { renderScale = nextScale; resizeVR(); }
        frameSample = 0; frameAverage = 0;
      }
    }

    vrControls.update();
    const st = vrStations[activeVRStation];
    if (st) {
      updateHud(st.update(dt, { heating: isHoldingPrimary }));
    }

    const w = window.innerWidth, h = window.innerHeight;
    if (!stereoVR) {
      vrRenderer.setScissorTest(false);
      vrRenderer.setViewport(0, 0, w, h);
      vrRenderer.render(vrScene, vrCamera);
    } else {
      vrCamera.updateMatrixWorld();
      const halfW = Math.floor(w / 2);
      const eyeOffset = new THREE.Vector3(0.028, 0, 0).applyQuaternion(vrCamera.quaternion);

      vrLeftCam.aspect = halfW / h;
      vrLeftCam.fov = 52;
      vrLeftCam.updateProjectionMatrix();
      vrLeftCam.position.copy(vrCamera.position).sub(eyeOffset);
      vrLeftCam.quaternion.copy(vrCamera.quaternion);

      vrRightCam.aspect = halfW / h;
      vrRightCam.fov = 52;
      vrRightCam.updateProjectionMatrix();
      vrRightCam.position.copy(vrCamera.position).add(eyeOffset);
      vrRightCam.quaternion.copy(vrCamera.quaternion);

      vrRenderer.setScissorTest(true);
      vrRenderer.setViewport(0, 0, halfW, h);
      vrRenderer.setScissor(0, 0, halfW, h);
      vrRenderer.render(vrScene, vrLeftCam);

      vrRenderer.setViewport(halfW, 0, w - halfW, h);
      vrRenderer.setScissor(halfW, 0, w - halfW, h);
      vrRenderer.render(vrScene, vrRightCam);
    }
  }
  vrRafId = requestAnimationFrame(loop);
}

function selectVRStation(idx) {
  activeVRStation = idx;
  isHoldingPrimary = false;
  btnHold.classList.remove("pressing");
  sound.silence();
  if (typeof vrStations[idx] === "function") {
    const station = vrStations[idx]({showBooklet: true});
    if (idx === 0) station.setSubMode(1);
    vrStations[idx] = station;
    station.root.scale.setScalar(1.08);
    vrScene.add(station.root);
  }
  vrStations.forEach((st, i) => { if (st.root) st.root.visible = i === idx; });
  document.querySelectorAll(".lesson-tab").forEach((b) => {
    b.classList.toggle("active", Number(b.dataset.station) === idx);
  });
  vrStations[idx].triggerEmergence?.();
  updateHud(vrStations[idx].update(0, { heating: false }));
}

function resizeVR() {
  if (!vrRenderer || !vrCamera) return;
  const w = window.innerWidth, h = window.innerHeight;
  vrRenderer.setPixelRatio(renderScale * Math.min(window.devicePixelRatio || 1, 1.5));
  vrRenderer.setSize(w, h, false);
  vrCamera.aspect = w / h;
  frameVR();
  vrCamera.updateProjectionMatrix();
}

function frameVR() {
  if (!vrCamera) return;
  const w = window.innerWidth, h = window.innerHeight;
  if ((w >= 850 && h >= 540) || hudBottom.hidden || stereoVR) {
    vrCamera.clearViewOffset();
    return;
  }
  const top = hudTop.getBoundingClientRect().bottom, bottom = hudBottom.getBoundingClientRect().top;
  const offset = THREE.MathUtils.clamp((h - top - bottom) / 2, -0.18 * h, 0.18 * h);
  vrCamera.setViewOffset(w, h, 0, offset, w, h);
}
if (window.ResizeObserver) {
  const layoutObserver = new ResizeObserver(frameVR);
  layoutObserver.observe(hudBottom); layoutObserver.observe(hudTop);
}
window.addEventListener("resize", () => { if (mode === "vr") resizeVR(); });

/**
 * ============================================================================
 * SUPER-SIZED IMAGE-TRACKED WebAR CAMERA MODE OVER MAGAZINE PAGES (Pages 3, 5, 8, 11)
 * ============================================================================
 */
async function startARMode() {
  stopVR();
  await stopAR();

  welcomeScreen.hidden = true;
  errorModal.hidden = true;
  loadingText.textContent = "جارٍ تشغيل كاميرا الواقع المعزّز وتحميل المجسّمات فائقة الواقعية...";
  loadingOverlay.hidden = false;

  let capturedErr = null;
  const origGUM = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);

  try {
    if (!navigator.mediaDevices || !origGUM) {
      const e = new Error("No camera API");
      e.name = "NotSupportedError";
      throw e;
    }

    navigator.mediaDevices.getUserMedia = async (constraints) => {
      try {
        const devs = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        const isFake = devs.some((d) => d.kind === "videoinput" && /fake/i.test(d.label || ""));
        if (!isFake && constraints && typeof constraints.video === "object") {
          try {
            return await origGUM({
              ...constraints,
              video: { ...constraints.video, facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
            });
          } catch (_) {}
        }
        return await origGUM(constraints);
      } catch (err) {
        capturedErr = err;
        throw err;
      }
    };

    mindarThree = new MindARThree({
      container: arViewport,
      imageTargetSrc: "./assets/targets.mind",
      maxTrack: 1,
      uiLoading: "no",
      uiScanning: "no",
      uiError: "no",
      filterMinCF: 0.001,
      filterBeta: 0.01,
      warmupTolerance: 2,
      missTolerance: 8,
    });

    const { renderer, scene, camera } = mindarThree;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    scene.environment = createStudioEnvMap(renderer);

    arStations = [
      createStation0PhaseAndFridge({ showBooklet: false }),
      createStation1Calorimeter({ showBooklet: false }),
      createStation2Crystals({ showBooklet: false }),
      createStation3PacksAndSafety({ showBooklet: false }),
    ];
    arStations[0].setSubMode(1);

    const pageTitles = [
      "رسمة ص ٣ (دورة التلاجة وتحوّلات الماء)",
      "رسمة ص ٥ (مسعر البولي إستيرين والترمومتر)",
      "رسمة ص ٨ (البلّورات المائية واللامائية)",
      "رسمة ص ١١ (الكمّادات الفورية وأمان التخفيف)",
    ];

    const tmpP = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3();
    function ancSnapNow(i) {
      const anc = arAnchors[i], sm = arSmoothGroups[i];
      if (!anc || !sm) return;
      anc.group.updateMatrixWorld(true);
      anc.group.matrix.decompose(tmpP, tmpQ, tmpS);
      sm.group.position.copy(tmpP); sm.group.quaternion.copy(tmpQ); sm.group.scale.copy(tmpS);
      sm.group.updateMatrixWorld(true);
      sm.snapped = true;
    }

    arStations.forEach((st, idx) => {
      const anchor = mindarThree.addAnchor(idx);
      anchor.group.visible = false;

      const follower = new THREE.Group();
      follower.visible = false;
      scene.add(follower);

      // MindAR tracks an XY image. The model base is XZ and its up axis is the page normal.
      const adapter = new THREE.Group();
      adapter.rotation.x = Math.PI / 2;
      adapter.position.set(0, 0, 0.002);
      adapter.scale.setScalar(arCustomScale);

      const spinMount = new THREE.Group();
      spinMount.add(st.root);
      adapter.add(spinMount);
      follower.add(adapter);

      anchor.onTargetFound = () => {
        activeARIndex = idx;
        arUserYaw = 0;
        anchor.group.visible = true;
        follower.visible = true;
        arSmoothGroups[idx].snapped = false;
        ancSnapNow(idx);
        st.triggerEmergence?.();
        scanGuide.hidden = true;
        hudBottom.hidden = false;
        btnReplayEmerge.hidden = false;
        btnZoomAR.hidden = false;
        trackingPill.classList.add("tracked");
        trackingText.textContent = `✓ يُبنى من الصفحة: ${pageTitles[idx]}`;
        updateHud(st.update(0, { heating: false }));
      };

      anchor.onTargetLost = () => {
        anchor.group.visible = false;
        follower.visible = false;
        arSmoothGroups[idx].snapped = false;
        if (activeARIndex === idx) {
          sound.silence();
          activeARIndex = -1;
          isHoldingPrimary = false;
          hudBottom.hidden = true;
          btnReplayEmerge.hidden = true;
          btnZoomAR.hidden = true;
          if (buildStepPill) buildStepPill.hidden = true;
          scanGuide.hidden = false;
          trackingPill.classList.remove("tracked");
          trackingText.textContent = "وجّه الكاميرا لرسمة ص ٣ أو ٥ أو ٨ أو ١١ بالمذكرة";
        }
      };

      arAnchors.push(anchor);
      arSmoothGroups.push({ group: follower, snapped: false });
      arAdapters.push({ adapter, spinMount });
    });

    await mindarThree.start();
    if (origGUM) navigator.mediaDevices.getUserMedia = origGUM;

    mode = "ar";
    loadingOverlay.hidden = true;
    hudTop.hidden = false;
    stationTabs.hidden = true;
    btnStereo.hidden = true;
    btnZoomAR.hidden = true;
    btnReplayEmerge.hidden = true;
    scanGuide.hidden = false;
    hudBottom.hidden = true;
    btnSwitchMode.textContent = "🥽 غرفة VR";
    trackingPill.classList.remove("tracked");
    trackingText.textContent = "وجّه الكاميرا لرسمة ص ٣ أو ٥ أو ٨ أو ١١ بالمذكرة";

    lastTs = performance.now();
    renderer.setAnimationLoop(() => {
      const now = performance.now();
      const dt = document.hidden ? 0 : Math.min(1, Math.max(0, (now - lastTs) / 1000));
      lastTs = now;

      if (activeARIndex >= 0) {
        const anc = arAnchors[activeARIndex];
        const sm = arSmoothGroups[activeARIndex];
        const adp = arAdapters[activeARIndex];
        anc.group.matrix.decompose(tmpP, tmpQ, tmpS);
        if (!sm.snapped) {
          sm.group.position.copy(tmpP); sm.group.quaternion.copy(tmpQ); sm.group.scale.copy(tmpS);
          sm.snapped = true;
        } else {
          const a = 1 - Math.exp(-dt * 20);
          sm.group.position.lerp(tmpP, a); sm.group.quaternion.slerp(tmpQ, a); sm.group.scale.lerp(tmpS, a);
        }
        adp.adapter.scale.lerp(new THREE.Vector3(arCustomScale, arCustomScale, arCustomScale), 1 - Math.exp(-dt * 14));
        adp.spinMount.rotation.y = THREE.MathUtils.lerp(adp.spinMount.rotation.y, arUserYaw, 1 - Math.exp(-dt * 14));

        updateHud(arStations[activeARIndex].update(dt, { heating: isHoldingPrimary }));
      }
      renderer.render(scene, camera);
    });
  } catch (err) {
    if (origGUM && navigator.mediaDevices) navigator.mediaDevices.getUserMedia = origGUM;
    const real = capturedErr || err;
    loadingOverlay.hidden = true;
    await stopAR();
    mode = "idle";
    errorTitle.textContent = real?.name === "NotAllowedError" ? "تم رفض إذن الكاميرا" : "تعذّر تشغيل الكاميرا";
    errorMessage.textContent = "يمكنك السماح بالكاميرا من إعدادات المتصفح، أو الدخول فورًا إلى غرفة الواقع الافتراضي ثلاثية الأبعاد بدون كاميرا.";
    errorModal.hidden = false;
  }
}

function showVRError() {
  stopVR();
  mode = "idle";
  hudTop.hidden = hudBottom.hidden = scanGuide.hidden = true;
  errorTitle.textContent = "تعذّر فتح المجسّم على الجهاز ده";
  errorMessage.textContent = "جرّب متصفح بيدعم WebGL، أو افتح صفحات المذكرة عشان تكمّل الدرس.";
  welcomeScreen.hidden = true;
  loadingOverlay.hidden = true;
  errorModal.hidden = false;
}

// Event Listeners
document.getElementById("btn-start-vr").addEventListener("click", () => startVRMode(0).catch(showVRError));
document.getElementById("btn-start-ar").addEventListener("click", () => startARMode());
document.getElementById("btn-error-vr").addEventListener("click", () => startVRMode(0).catch(showVRError));
document.getElementById("btn-error-retry").addEventListener("click", () => startARMode());

btnReplayEmerge.addEventListener("click", () => {
  const st = getCurrentStation();
  if (!st) return;
  isHoldingPrimary = false;
  arUserYaw = 0;
  st.triggerEmergence?.();
  sound.page();
});

btnZoomAR.addEventListener("click", () => {
  arZoomPresetIdx = (arZoomPresetIdx + 1) % AR_ZOOM_PRESETS.length;
  arCustomScale = AR_ZOOM_PRESETS[arZoomPresetIdx].scale;
  btnZoomAR.textContent = AR_ZOOM_PRESETS[arZoomPresetIdx].label;
  sound.page();
});

btnStereo.addEventListener("click", () => {
  stereoVR = !stereoVR;
  btnStereo.classList.toggle("active", stereoVR);
  document.body.classList.toggle("stereo-mode", stereoVR);
  stereoDivider.hidden = !stereoVR;
  trackingText.textContent = stereoVR ? "وضع نظارة الواقع الافتراضي المزدوج (VR)" : "غرفة «مَعْمَل» 360° • اسحب للالتفات أو التقريب";
  if (stereoVR && typeof window.DeviceOrientationEvent?.requestPermission === "function") {
    DeviceOrientationEvent.requestPermission().catch(() => {});
  }
});

btnSwitchMode.addEventListener("click", () => {
  if (mode === "ar") startVRMode(activeARIndex >= 0 ? activeARIndex : 0).catch(showVRError);
  else startARMode();
});

btnHome.addEventListener("click", async () => {
  await stopAR(); stopVR(); mode = "idle";
  hudTop.hidden = true; hudBottom.hidden = true; scanGuide.hidden = true;
  welcomeScreen.hidden = false;
});

document.querySelectorAll(".lesson-tab").forEach((b) => {
  b.addEventListener("click", () => selectVRStation(Number(b.dataset.station)));
});

subExpButtons.forEach((b) => {
  b.addEventListener("click", () => {
    const st = getCurrentStation();
    if (!st) return;
    isHoldingPrimary = false;
    st.setSubMode(Number(b.dataset.subIdx));
    updateHud(st.update(0, {heating:false}));
    sound.page();
  });
});

function endHold() {
  isHoldingPrimary = false;
  btnHold.classList.remove("pressing");
}
function beginHold() {
  if (btnHold.disabled) return;
  getCurrentStation()?.primaryAction?.();
  isHoldingPrimary = true;
  btnHold.classList.add("pressing");
}
btnHold.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  btnHold.setPointerCapture(event.pointerId);
  beginHold();
});
for (const event of ["pointerup", "pointercancel", "lostpointercapture", "blur"]) {
  btnHold.addEventListener(event, endHold);
}
btnHold.addEventListener("keydown", (event) => {
  if ([" ", "Enter"].includes(event.key)) { event.preventDefault(); beginHold(); }
});
btnHold.addEventListener("keyup", (event) => {
  if ([" ", "Enter"].includes(event.key)) { event.preventDefault(); endHold(); }
});
btnHold.addEventListener("contextmenu", (e) => e.preventDefault());
btnSecondary.addEventListener("click", () => {
  const st = getCurrentStation();
  if (st) { st.cycleSecondary(); updateHud(st.update(0, {heating:false})); }
});
btnTertiary.addEventListener("click", () => {
  const st = getCurrentStation();
  if (!st) return;
  if (st.tertiaryAction) st.tertiaryAction(); else st.reset?.();
  updateHud(st.update(0, {heating:false}));
});

// Auto-launch into the exact requested 3D VR Station when opened from a Magazine QR / PDF Link (?exp=...)
const params = new URLSearchParams(location.search);
if (params.has("exp")) {
  const slug = params.get("exp");
  const idx = EXP_SLUG_MAP[slug] ?? 0;
  startVRMode(idx).catch(showVRError);
}
