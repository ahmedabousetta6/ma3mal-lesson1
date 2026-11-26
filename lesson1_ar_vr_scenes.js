import * as THREE from "three";
import {
  attachLabLighting,
  createContactShadow,
  getSoftPuffTexture,
  createBrushedMetalMaterial,
  createStyrofoamMaterial,
  createOakWoodMaterial,
  createWireGauzeMaterial,
  createDetailedBunsenBurner,
  createLathedBeaker,
  createCushionedPackGeometry,
  createArabicBadge,
  createTouchHotspot,
} from "./pbr_engine.js";

import { createOpenWorkbook, createWaterSurface } from "./workbook-scene.js";

function easeOutCubic(x) {
  const t = THREE.MathUtils.clamp(x, 0, 1);
  return 1 - Math.pow(1 - t, 3);
}

function easeOutBack(x) {
  const t = THREE.MathUtils.clamp(x, 0, 1);
  const c1 = 1.52;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function toArDigits(n) {
  return String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
}

/**
 * Builds the 360° Virtual Reality Science Classroom / Lab Room around the workbench.
 */
export function createVirtualLabRoom() {
  const room = new THREE.Group();

  const floorCanvas = document.createElement("canvas");
  floorCanvas.width = 256; floorCanvas.height = 256;
  const fg = floorCanvas.getContext("2d");
  fg.fillStyle = "#384844"; fg.fillRect(0, 0, 256, 256);
  fg.strokeStyle = "#495853"; fg.lineWidth = 3;
  fg.strokeRect(0, 0, 256, 256);
  const floorTex = new THREE.CanvasTexture(floorCanvas);
  floorTex.colorSpace = THREE.SRGBColorSpace;
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(14, 14);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.72, metalness: 0.12 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.52;
  room.add(floor);

  const woodMat = createOakWoodMaterial();
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.055, 1.70), woodMat);
  tableTop.position.set(0, -0.034, 0);
  tableTop.receiveShadow = true;
  room.add(tableTop);

  const legGeo = new THREE.CylinderGeometry(0.034, 0.03, 0.48, 16);
  const legMat = createBrushedMetalMaterial(0x3a3259, 0.35, 0.8);
  [[-0.8, -0.48], [0.8, -0.48], [-0.8, 0.48], [0.8, 0.48]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(lx, -0.285, lz);
    room.add(leg);
  });

  // Frosted windows and a recessed shelf give the worktop depth without covering the apparatus.
  const plaster = new THREE.MeshStandardMaterial({color: 0x506a68, roughness: 1});
  const wall = new THREE.Mesh(new THREE.BoxGeometry(7, 2.8, 0.08), plaster);
  wall.position.set(0, 0.75, -1.95);
  room.add(wall);
  const frame = new THREE.MeshStandardMaterial({color: 0x263e41, roughness: 0.67});
  const glass = new THREE.MeshStandardMaterial({color: 0xa9cbc8, emissive: 0x9dcfda,
    emissiveIntensity: 0.48, roughness: 0.25});
  const pane = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.95, 0.025), glass);
  pane.position.set(-1.35, 0.94, -1.88);
  room.add(pane);
  for (let i = 0; i < 5; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.035, 1, 0.036), frame);
    bar.position.set(-2.41 + i * 0.53, 0.94, -1.85); room.add(bar);
  }
  for (const y of [0.46, 0.94, 1.42]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.032, 0.04), frame);
    rail.position.set(-1.35, y, -1.85); room.add(rail);
  }
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.035, 0.23), frame);
  shelf.position.set(0.74, 0.62, -1.79); room.add(shelf);
  const bottleProfile = [[0.001,0],[0.048,0],[0.05,0.022],[0.05,0.11],[0.024,0.14],[0.019,0.15],[0.019,0.18]];
  const bottleGeo = new THREE.LatheGeometry(bottleProfile.map(([r,y]) => new THREE.Vector2(r,y)),18);
  const bottleColors = [0x925b34,0x53847b,0xb8a87c];
  for (let i=0; i<7; i++) {
    const bottle = new THREE.Mesh(bottleGeo, new THREE.MeshStandardMaterial({
      color:bottleColors[i%3], metalness:0.12, roughness:0.27}));
    bottle.position.set(0.18 + i*0.158,0.64,-1.76);
    bottle.scale.setScalar(0.83 + i%3*0.15); room.add(bottle);
  }

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(5.5, 32, 20),
    new THREE.MeshBasicMaterial({ color: 0x405655, side: THREE.BackSide })
  );
  room.add(dome);

  return room;
}

/**
 * ============================================================================
 * PART-BY-PART 3D SELF-CONSTRUCTION CONTROLLER ("بتتبني من الصفحة جزء جزء")
 * - Locks a glowing Blueprint Grid + 4 Corner Brackets onto the page (both VR & AR!)
 * - Sweeps a 3D Laser Curtain across the diagram
 * - Rises a dynamic 3D-Printer Laser Halo Ring (`laserBuildRing`) tracking the
 *   exact Y-height of whichever part is currently constructing!
 * - Flashes a cyan/gold blueprint emissive sheen on each part as it extrudes out
 *   of the paper `clipPlane` and snaps into solid photorealistic PBR matter!
 * ============================================================================
 */
function createBookletEmergenceController(root, plateUrl, { showBooklet = true } = {}) {
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const tmpPt = new THREE.Vector3();
  const tmpNorm = new THREE.Vector3();

  if (showBooklet) root.add(createOpenWorkbook(plateUrl));

  const contactShadow = createContactShadow(0.76);
  contactShadow.position.y = 0.0076;
  contactShadow.material.opacity = 0;
  root.add(contactShadow);

  // Holographic Page Lock Frame + 3D-Printer Laser Ring + Sparks (Visible in BOTH AR Camera & VR!)
  const fxGroup = new THREE.Group();
  fxGroup.position.y = 0.009;
  root.add(fxGroup);

  // Glowing AR/VR Page Corner Brackets hugging the diagram!
  const bracketMat = new THREE.MeshBasicMaterial({
    color: 0xffcb44,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const bracketGroup = new THREE.Group();
  const bw = showBooklet ? 0.50 : 0.38;
  const bz = showBooklet ? 0.28 : 0.22;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const armX = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.012), bracketMat);
    armX.rotation.x = -Math.PI / 2;
    armX.position.set(sx * (bw - 0.038), 0.001, sz * bz);
    const armZ = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.085), bracketMat);
    armZ.rotation.x = -Math.PI / 2;
    armZ.position.set(sx * bw, 0.001, sz * (bz - 0.038));
    bracketGroup.add(armX, armZ);
  });
  fxGroup.add(bracketGroup);

  // Blueprint Grid Pad on the page during construction
  const gridCanvas = document.createElement("canvas");
  gridCanvas.width = 256; gridCanvas.height = 256;
  const gg = gridCanvas.getContext("2d");
  gg.strokeStyle = "rgba(92, 232, 255, 0.52)";
  gg.lineWidth = 2;
  for (let i = 0; i <= 256; i += 32) {
    gg.beginPath(); gg.moveTo(i, 0); gg.lineTo(i, 256); gg.stroke();
    gg.beginPath(); gg.moveTo(0, i); gg.lineTo(256, i); gg.stroke();
  }
  const gridTex = new THREE.CanvasTexture(gridCanvas);
  const blueprintMat = new THREE.MeshBasicMaterial({
    map: gridTex,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const blueprintPad = new THREE.Mesh(new THREE.PlaneGeometry(bw * 1.9, bz * 1.9), blueprintMat);
  blueprintPad.rotation.x = -Math.PI / 2;
  fxGroup.add(blueprintPad);

  // Sweeping Laser Scan Bar + Vertical Curtain
  const scanBarMat = new THREE.MeshBasicMaterial({
    color: 0x64f2e1,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const scanBar = new THREE.Mesh(new THREE.PlaneGeometry(bw * 1.95, 0.06), scanBarMat);
  scanBar.rotation.x = -Math.PI / 2;
  const scanCurtain = new THREE.Mesh(new THREE.PlaneGeometry(bw * 1.95, 0.16), scanBarMat);
  scanCurtain.position.y = 0.08;
  const scanAssembly = new THREE.Group();
  scanAssembly.add(scanBar, scanCurtain);
  fxGroup.add(scanAssembly);

  // Base Portal Ring + Rising 3D-Print Laser Ring (tracks the exact part height!)
  const portalRingMat = new THREE.MeshBasicMaterial({
    color: 0xffcb44,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const portalRing = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.268, 56), portalRingMat);
  portalRing.rotation.x = -Math.PI / 2;
  fxGroup.add(portalRing);

  const laserBuildMat = new THREE.MeshBasicMaterial({
    color: 0x5ce8ff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const laserBuildRing = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.235, 56), laserBuildMat);
  laserBuildRing.rotation.x = -Math.PI / 2;
  fxGroup.add(laserBuildRing);

  // Rising Construction Sparks
  const sparkMat = new THREE.MeshBasicMaterial({
    color: 0xffe07d,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sparks = Array.from({ length: 22 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), sparkMat);
    fxGroup.add(m);
    return { mesh: m, angle: (i / 22) * Math.PI * 2, radius: 0.11 + (i % 4) * 0.048, offset: (i * 0.13) % 1 };
  });

  let setsMap = new Map();
  let activeSetKey = "default";
  let timer = 0;
  let manual = false;
  let settled = false;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let lastAnnouncedStep = -1;

  function ensureSet(key) {
    if (!setsMap.has(key)) setsMap.set(key, { stages: [], popups: [], maxTime: 2.8 });
    return setsMap.get(key);
  }

  function preparePartSubtree(obj3d) {
    const flashMats = [];
    obj3d.traverse((node) => {
      if (!node.isMesh || !node.material) return;
      if (node.material.isShaderMaterial || node.material.depthTest === false) return;
      if (!node.userData.__clippedForStation) {
        // Station-owned materials must stay shared with their simulation controllers.
        node.material.clippingPlanes = [clipPlane];
        node.material.clipShadows = true;
        node.userData.__clippedForStation = true;
        if (node.material.emissive) {
          node.userData.__baseEmissive = node.material.emissive.clone();
          node.userData.__baseEmissiveInt = node.material.emissiveIntensity ?? 1.0;
          flashMats.push(node);
        }
      } else if (node.userData.__baseEmissive) {
        flashMats.push(node);
      }
    });
    return flashMats;
  }

  function addStage(setKey, targetGroup, { startSec, durSec = 0.48, sinkDepth = 0.34, buildY = 0.2, spinRad = 0.22, caption = "" }) {
    const flashNodes = preparePartSubtree(targetGroup);
    const setObj = ensureSet(setKey);
    const entry = {
      group: targetGroup,
      baseY: targetGroup.position.y,
      baseRotY: targetGroup.rotation.y,
      startSec,
      durSec,
      sinkDepth,
      buildY,
      spinRad,
      caption,
      flashNodes,
    };
    setObj.stages.push(entry);
    setObj.maxTime = Math.max(setObj.maxTime, startSec + durSec + 0.16);
  }

  function addPopup(setKey, obj3d, { startSec, durSec = 0.34 }) {
    const setObj = ensureSet(setKey);
    setObj.popups.push({
      obj: obj3d,
      baseScale: obj3d.scale.clone(),
      startSec,
      durSec,
    });
    setObj.maxTime = Math.max(setObj.maxTime, startSec + durSec + 0.1);
  }

  function trigger(setKey = activeSetKey) {
    activeSetKey = setKey;
    manual = false;
    settled = false;
    timer = reducedMotion.matches ? ensureSet(setKey).maxTime : 0;
    lastAnnouncedStep = -1;
    update(0);
  }

  function updateClipPlaneWorld() {
    root.updateWorldMatrix(true, false);
    tmpPt.set(0, 0.007, 0);
    root.localToWorld(tmpPt);
    tmpNorm.set(0, 1, 0).transformDirection(root.matrixWorld).normalize();
    clipPlane.setFromNormalAndCoplanarPoint(tmpNorm, tmpPt);
  }

  const holoCyan = new THREE.Color(0x38f2ff);

  function update(dt) {
    const curSet = ensureSet(activeSetKey);
    const totalDuration = curSet.maxTime;
    if (!manual) timer = Math.min(totalDuration + 0.6, timer + dt);
    updateClipPlaneWorld();

    const overall = THREE.MathUtils.clamp(timer / totalDuration, 0, 1);
    const emerging = timer < totalDuration;
    if (settled && !emerging) return {emerging: false, overall: 1, buildPill: "", stepChime: null};
    settled = !emerging;

    // 1) Initial Laser Curtain Sweep across the Printed Diagram (0.00s -> 0.48s)
    if (timer < 0.50) {
      const sp = timer / 0.50;
      scanAssembly.visible = true;
      scanAssembly.position.z = THREE.MathUtils.lerp(bz, -bz, easeOutCubic(sp));
      scanBarMat.opacity = Math.sin(sp * Math.PI) * 0.95;
    } else {
      scanAssembly.visible = false;
      scanBarMat.opacity = 0;
    }

    // 2) Part-by-Part Self-Assembly with Blueprint Emissive Solidification!
    let activeStepIdx = -1;
    let activeCaption = "";
    let currentLaserY = 0.04;

    curSet.stages.forEach((st, idx) => {
      const raw = (timer - st.startSec) / st.durSec;
      if (raw <= 0) {
        st.group.visible = false;
        st.group.position.y = st.baseY - st.sinkDepth;
        st.group.rotation.y = st.baseRotY - st.spinRad;
        st.group.scale.set(0.76, 0.25, 0.76);
      } else if (raw < 1) {
        st.group.visible = true;
        const ey = easeOutBack(raw);
        const es = easeOutCubic(raw);
        st.group.position.y = st.baseY - st.sinkDepth * (1 - ey);
        st.group.rotation.y = st.baseRotY - st.spinRad * (1 - es);
        const xz = THREE.MathUtils.lerp(0.82, 1.0, es);
        const sy = THREE.MathUtils.lerp(0.32, 1.0, es);
        st.group.scale.set(xz, sy, xz);

        // Holographic cyan blueprint pulse that solidifies into real PBR material!
        const flashAmt = Math.sin(raw * Math.PI) * 0.21;
        st.flashNodes.forEach((n) => {
          n.material.emissive.copy(n.userData.__baseEmissive).lerp(holoCyan, flashAmt);
        });

        activeStepIdx = idx;
        activeCaption = st.caption;
        currentLaserY = THREE.MathUtils.lerp(0.02, st.buildY, es);
      } else {
        st.group.visible = true;
        st.group.position.y = st.baseY;
        st.group.rotation.y = st.baseRotY;
        st.group.scale.set(1, 1, 1);
        st.flashNodes.forEach((n) => {
          n.material.emissive.copy(n.userData.__baseEmissive);
        });
      }
    });

    // 3) Laser Build Ring & Sparks tracking the active part height
    if (emerging) {
      fxGroup.visible = true;
      const pulse = 0.6 + 0.35 * Math.sin(timer * 11.0);
      portalRingMat.opacity = pulse * (1 - 0.45 * Math.pow(overall, 3));
      portalRing.rotation.z = timer * 1.4;
      blueprintMat.opacity = 0.38 * (1 - Math.pow(overall, 2));
      bracketMat.opacity = 0.92;

      laserBuildRing.visible = true;
      laserBuildRing.position.y = currentLaserY;
      laserBuildRing.scale.setScalar(0.88 + 0.14 * Math.sin(timer * 14));
      laserBuildMat.opacity = 0.82 * (1 - Math.pow(overall, 4));

      sparkMat.opacity = 0.9 * Math.sin(overall * Math.PI);
      sparks.forEach((s) => {
        const u = (timer * 1.1 + s.offset) % 1;
        s.mesh.visible = true;
        s.mesh.position.set(
          Math.cos(s.angle + timer * 1.8) * s.radius,
          u * (currentLaserY + 0.16),
          Math.sin(s.angle + timer * 1.8) * s.radius
        );
        s.mesh.scale.setScalar(1.1 - u * 0.7);
      });
    } else {
      fxGroup.visible = false;
      portalRingMat.opacity = 0;
      blueprintMat.opacity = 0;
      bracketMat.opacity = showBooklet ? 0.25 : 0.62;
      laserBuildRing.visible = false;
      sparks.forEach((s) => { s.mesh.visible = false; });
    }

    contactShadow.material.opacity = THREE.MathUtils.smoothstep(overall, 0.12, 0.85) * 0.72;

    curSet.popups.forEach((pp) => {
      const raw = (timer - pp.startSec) / pp.durSec;
      if (raw <= 0) {
        pp.obj.scale.setScalar(0.0001);
      } else if (raw < 1) {
        pp.obj.scale.copy(pp.baseScale).multiplyScalar(Math.max(0.001, easeOutBack(raw)));
      } else {
        pp.obj.scale.copy(pp.baseScale);
      }
    });

    let stepChime = null;
    if (activeStepIdx >= 0 && activeStepIdx !== lastAnnouncedStep) {
      lastAnnouncedStep = activeStepIdx;
      stepChime = activeStepIdx;
    }

    const stepNumAr = activeStepIdx >= 0 ? toArDigits(activeStepIdx + 1) : "١";
    const totalAr = toArDigits(curSet.stages.length);
    const buildPill = emerging
      ? (activeStepIdx >= 0 ? `⚙️ بناء الجزء ${stepNumAr} من ${totalAr}: ${activeCaption}` : "📡 مسح الرسمة المطبوعة وتثبيت المخطط ثلاثي الأبعاد...")
      : "";

    return {
      emerging,
      overall,
      stepIndex: activeStepIdx,
      totalSteps: curSet.stages.length,
      caption: buildPill,
      buildPill,
      stepChime,
    };
  }

  function setLift(fraction) {
    manual = true;
    settled = false;
    timer = THREE.MathUtils.clamp(fraction, 0, 1) * ensureSet(activeSetKey).maxTime;
    update(0);
  }
  return { clipPlane, addStage, addPopup, trigger, update, setLift };
}

/**
 * ============================================================================
 * STATION 0 (Pages 2-3): تحوّلات الحالة الستة (٨ أجزاء) + دورة التبريد بالثلاجة (٩ أجزاء)
 * ============================================================================
 */
export function createStation0PhaseAndFridge({ showBooklet = true } = {}) {
  const root = new THREE.Group();
  attachLabLighting(root);
  const emerge = createBookletEmergenceController(root, "./targets/ar-plate-fridge.png", { showBooklet });

  const interactables = [];
  const hotspots = [];
  const chromeMat = createBrushedMetalMaterial(0xdce4f2, 0.16, 0.94);
  const castBaseMat = createBrushedMetalMaterial(0x281c45, 0.36, 0.72);
  const copperMat = createBrushedMetalMaterial(0xe07a3c, 0.2, 0.92);

  // ================= SUB A: Phase Transitions Lab (8 Self-Building Parts!) =================
  const subA = new THREE.Group();
  root.add(subA);

  // Part 1: Cast-iron thermal lab base plate & rim
  const partA1Base = new THREE.Group();
  const basePlateA = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.25, 0.016, 48), castBaseMat);
  basePlateA.position.y = 0.015;
  const goldTrimA = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.006, 12, 48), createBrushedMetalMaterial(0xffcb44, 0.22, 0.9));
  goldTrimA.rotation.x = Math.PI / 2; goldTrimA.position.y = 0.023;
  partA1Base.add(basePlateA, goldTrimA);
  subA.add(partA1Base);

  // Part 2: 3 Brushed Chrome Tripod Legs + Ring Collar
  const partA2Legs = new THREE.Group();
  const standH = 0.185;
  const topCollar = new THREE.Mesh(new THREE.TorusGeometry(0.182, 0.009, 14, 42), chromeMat);
  topCollar.rotation.x = Math.PI / 2; topCollar.position.y = standH;
  partA2Legs.add(topCollar);
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3 + 0.42;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.009, standH - 0.01, 14), chromeMat);
    leg.position.set(Math.cos(a) * 0.182, standH / 2 + 0.015, Math.sin(a) * 0.182);
    leg.rotation.z = Math.cos(a) * -0.07;
    leg.rotation.x = Math.sin(a) * 0.07;
    partA2Legs.add(leg);
  }
  subA.add(partA2Legs);

  // Part 3: Ceramic-Center Wire Gauze Mat
  const partA3Gauze = new THREE.Group();
  const gauzeMat = createWireGauzeMaterial();
  const gauze = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.007, 0.35), gauzeMat);
  gauze.position.y = standH + 0.006;
  partA3Gauze.add(gauze);
  subA.add(partA3Gauze);

  // Part 4: Detailed Brass Bunsen Burner with Gas Valve & Volumetric Flame
  const partA4Burner = createDetailedBunsenBurner(0.66);
  partA4Burner.position.y = 0.018;
  const flameA = partA4Burner.userData.flame;
  subA.add(partA4Burner);

  // Part 5: Double-Walled Graduated Borosilicate Beaker
  const partA5Beaker = new THREE.Group();
  const beakerY = standH + 0.011, beakerH = 0.38;
  const beaker = createLathedBeaker(0.172, beakerH, 0.008);
  beaker.position.y = beakerY;
  partA5Beaker.add(beaker);
  subA.add(partA5Beaker);

  // Part 6: Sculpted Crystalline Ice Block & Refractive Water Pool
  const partA6IceWater = new THREE.Group();
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x1ea8f0, roughness: 0.05, clearcoat: 1.0, ior: 1.33, transparent: true, opacity: 0.52, depthWrite: false,
  });
  const waterCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.156, 0.21, 36), waterMat);
  const surface = createWaterSurface(0.157);
  partA6IceWater.add(waterCyl, surface.mesh);

  const iceMat = new THREE.MeshPhysicalMaterial({
    color: 0xc8f7ff, roughness: 0.09, clearcoat: 1.0, ior: 1.31, reflectivity: 1.0, transparent: true, opacity: 0.56,
  });
  const iceBlock = new THREE.Mesh(new THREE.BoxGeometry(0.175, 0.155, 0.175), iceMat);
  iceBlock.position.y = beakerY + 0.09;
  partA6IceWater.add(iceBlock);
  subA.add(partA6IceWater);

  // Part 7: 27 Ball-and-Stick H2O Molecules WITH Visible Covalent Bond Rods!
  const partA7Mols = new THREE.Group();
  const mols = [];
  const oxyGeo = new THREE.SphereGeometry(0.016, 14, 12);
  const hydGeo = new THREE.SphereGeometry(0.010, 12, 10);
  const bondGeo = new THREE.CylinderGeometry(0.0036, 0.0036, 0.018, 8);
  const oxyMat = new THREE.MeshPhysicalMaterial({ color: 0xf72549, roughness: 0.12, clearcoat: 1.0 });
  const hydMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.16, clearcoat: 0.95 });
  const bondMat = new THREE.MeshStandardMaterial({ color: 0xdbe4f0, roughness: 0.3, metalness: 0.5 });

  for (let ix = 0; ix < 3; ix++) {
    for (let iy = 0; iy < 3; iy++) {
      for (let iz = 0; iz < 3; iz++) {
        const g = new THREE.Group();
        const ox = new THREE.Mesh(oxyGeo, oxyMat);
        const h1 = new THREE.Mesh(hydGeo, hydMat); h1.position.set(0.015, 0.011, 0);
        const h2 = new THREE.Mesh(hydGeo, hydMat); h2.position.set(-0.015, 0.011, 0);
        const b1 = new THREE.Mesh(bondGeo, bondMat); b1.position.set(0.0075, 0.0055, 0); b1.rotation.z = -0.92;
        const b2 = new THREE.Mesh(bondGeo, bondMat); b2.position.set(-0.0075, 0.0055, 0); b2.rotation.z = 0.92;
        g.add(ox, h1, h2, b1, b2);
        const home = new THREE.Vector3((ix - 1) * 0.052, beakerY + 0.044 + iy * 0.052, (iz - 1) * 0.052);
        g.position.copy(home);
        partA7Mols.add(g);
        mols.push({ mesh: g, home, phase: mols.length * 1.3 });
      }
    }
  }
  subA.add(partA7Mols);

  // Part 8: Concave Watch-Glass Lid + Forming Condensation Droplets!
  const partA8Lid = new THREE.Group();
  const watchGlass = new THREE.Mesh(
    new THREE.SphereGeometry(0.205, 36, 16, 0, Math.PI * 2, 0, 0.54),
    new THREE.MeshPhysicalMaterial({ color: 0xe2f8ff, transparent: true, opacity: 0.48, roughness: 0.04, clearcoat: 1.0, side: THREE.DoubleSide, depthWrite: false })
  );
  watchGlass.rotation.x = Math.PI;
  watchGlass.position.y = beakerY + beakerH + 0.178;
  partA8Lid.add(watchGlass);

  const condDrops = Array.from({ length: 10 }, (_, k) => {
    const ang = (k / 10) * Math.PI * 2;
    const rad = 0.035 + (k % 3) * 0.032;
    const dm = new THREE.Mesh(
      new THREE.SphereGeometry(0.0085, 10, 10),
      new THREE.MeshPhysicalMaterial({ color: 0x64d8ff, roughness: 0.05, clearcoat: 1.0 })
    );
    dm.position.set(Math.cos(ang) * rad, beakerY + beakerH - 0.012, Math.sin(ang) * rad);
    dm.scale.setScalar(0.01);
    partA8Lid.add(dm);
    return dm;
  });
  subA.add(partA8Lid);

  const puffTex = getSoftPuffTexture();
  const puffs = Array.from({ length: 12 }, (_, s) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, opacity: 0, depthWrite: false }));
    subA.add(sp);
    return { sp, phase: s / 12, ang: s * 1.8 };
  });

  const badgeA = createArabicBadge("الروابط التساهمية داخل H₂O ثابتة لا تنكسر!", "#7de2d1", 0.42);
  badgeA.position.set(0, beakerY + beakerH + 0.115, 0);
  subA.add(badgeA);

  emerge.addStage("sub0", partA1Base,     { startSec: 0.25, durSec: 0.36, sinkDepth: 0.08, buildY: 0.04, spinRad: 0.15, caption: "قاعدة الارتكاز المعدنية" });
  emerge.addStage("sub0", partA2Legs,     { startSec: 0.56, durSec: 0.44, sinkDepth: 0.22, buildY: 0.18, spinRad: 0.35, caption: "أرجل الحامل الثلاثي الفولاذي" });
  emerge.addStage("sub0", partA3Gauze,    { startSec: 0.94, durSec: 0.38, sinkDepth: 0.22, buildY: 0.20, spinRad: 0.20, caption: "شبكة التسخين الخزفية" });
  emerge.addStage("sub0", partA4Burner,   { startSec: 1.26, durSec: 0.42, sinkDepth: 0.16, buildY: 0.13, spinRad: 0.25, caption: "موقد بنزن النحاسي وصمام الغاز" });
  emerge.addStage("sub0", partA5Beaker,   { startSec: 1.62, durSec: 0.48, sinkDepth: 0.56, buildY: 0.42, spinRad: 0.18, caption: "الكأس الزجاجي المدرّج (البوروسيليكات)" });
  emerge.addStage("sub0", partA6IceWater, { startSec: 2.02, durSec: 0.44, sinkDepth: 0.38, buildY: 0.30, spinRad: 0.12, caption: "مكعّب الجليد البلّوري" });
  emerge.addStage("sub0", partA7Mols,     { startSec: 2.38, durSec: 0.46, sinkDepth: 0.42, buildY: 0.34, spinRad: 0.28, caption: "جزيئات الماء H₂O وروابطها التساهمية" });
  emerge.addStage("sub0", partA8Lid,      { startSec: 2.76, durSec: 0.42, sinkDepth: 0.58, buildY: 0.56, spinRad: 0.15, caption: "غطاء التكثّف الزجاجي العلوي" });
  emerge.addPopup("sub0", badgeA,         { startSec: 3.10, durSec: 0.34 });

  // ================= SUB B: Realistic 3D Cutaway Refrigerator (9 Self-Building Parts!) =================
  const subB = new THREE.Group();
  subB.visible = false;
  root.add(subB);

  // Part 1: Heavy Steel Base Chassis & Rubber Leveling Feet
  const partB1Chassis = new THREE.Group();
  const baseSlab = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.026, 0.27), castBaseMat);
  baseSlab.position.set(0, 0.025, -0.01);
  baseSlab.castShadow = true;
  partB1Chassis.add(baseSlab);
  [[-0.16, -0.11], [0.16, -0.11], [-0.16, 0.09], [0.16, 0.09]].forEach(([fx, fz]) => {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.016, 14), new THREE.MeshStandardMaterial({ color: 0x141122, roughness: 0.8 }));
    foot.position.set(fx, 0.008, fz);
    partB1Chassis.add(foot);
  });
  subB.add(partB1Chassis);

  // Part 2: Double-Walled Insulated Fridge Cabinet + Warm Interior LED Light
  const partB2Cabinet = new THREE.Group();
  const outerEnamel = new THREE.MeshPhysicalMaterial({ color: 0x528079, roughness: 0.32, metalness: 0.32, clearcoat: 0.62 });
  const innerLiner = new THREE.MeshPhysicalMaterial({ color: 0xe4f5ff, roughness: 0.22, clearcoat: 0.6 });

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.54, 0.028), outerEnamel);
  backWall.position.set(0, 0.305, -0.105); backWall.castShadow = true;
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.54, 0.23), outerEnamel);
  leftWall.position.set(-0.167, 0.305, -0.005); leftWall.castShadow = true;
  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.54, 0.23), outerEnamel);
  rightWall.position.set(0.167, 0.305, -0.005); rightWall.castShadow = true;
  const topWall = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.026, 0.23), outerEnamel);
  topWall.position.set(0, 0.565, -0.005);
  const botFloor = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.02, 0.22), innerLiner);
  botFloor.position.set(0, 0.046, -0.005);

  const ledStrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.008, 0.025),
    new THREE.MeshBasicMaterial({ color: 0xe6fbff })
  );
  ledStrip.position.set(0, 0.548, 0.04);
  const fridgeInteriorLight = new THREE.PointLight(0xdaf6ff, 0.017, 0.65);
  fridgeInteriorLight.position.set(0, 0.34, 0.04);

  partB2Cabinet.add(backWall, leftWall, rightWall, topWall, botFloor, ledStrip, fridgeInteriorLight);
  subB.add(partB2Cabinet);

  // Part 3: Tempered Glass Shelves + Realistic 3D Food Props (Milk Carton, Glossy Apple, Water Bottle, Bowl)
  const partB3ShelvesFood = new THREE.Group();
  const shelfGlassMat = new THREE.MeshPhysicalMaterial({ color: 0xcaf0ff, transparent: true, opacity: 0.55, roughness: 0.05, clearcoat: 1.0 });
  [0.19, 0.34].forEach((sy) => {
    const sh = new THREE.Mesh(new THREE.BoxGeometry(0.305, 0.008, 0.19), shelfGlassMat);
    sh.position.set(0, sy, -0.005);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.306, 0.011, 0.01), chromeMat);
    trim.position.set(0, sy, 0.09);
    partB3ShelvesFood.add(sh, trim);
  });

  // Milk Carton on lower shelf
  const milkBody = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.105, 0.058), new THREE.MeshStandardMaterial({ color: 0xfff8e7, roughness: 0.35 }));
  milkBody.position.set(-0.085, 0.108, 0.0);
  const milkStripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.032, 0.06), new THREE.MeshStandardMaterial({ color: 0x2aa8ec, roughness: 0.3 }));
  milkStripe.position.set(-0.085, 0.11, 0.0);
  const milkCap = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 12), new THREE.MeshStandardMaterial({ color: 0x0d74e8 }));
  milkCap.position.set(-0.085, 0.166, 0.0);

  // Glossy Red Apple + Stem + Leaf
  const apple = new THREE.Mesh(
    new THREE.SphereGeometry(0.034, 18, 16),
    new THREE.MeshPhysicalMaterial({ color: 0xe62e3d, roughness: 0.14, clearcoat: 1.0 })
  );
  apple.scale.set(1.05, 0.92, 1.05);
  apple.position.set(0.01, 0.086, 0.02);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.018, 8), new THREE.MeshStandardMaterial({ color: 0x5c3a21 }));
  stem.position.set(0.01, 0.12, 0.02);

  // Chilled Water Bottle + Fruit Bowl on middle shelf
  const bottle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.026, 0.11, 18),
    new THREE.MeshPhysicalMaterial({ color: 0x72ddff, transparent: true, opacity: 0.75, roughness: 0.06, clearcoat: 1.0 })
  );
  bottle.position.set(0.085, 0.25, 0.0);
  const bCap = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.014, 12), new THREE.MeshStandardMaterial({ color: 0xffcb44 }));
  bCap.position.set(0.085, 0.312, 0.0);

  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.032, 0.042, 20),
    new THREE.MeshPhysicalMaterial({ color: 0x2ec4b6, roughness: 0.2, clearcoat: 0.8 })
  );
  bowl.position.set(-0.055, 0.216, 0.01);
  const orangeFruit = new THREE.Mesh(new THREE.SphereGeometry(0.024, 14, 12), new THREE.MeshPhysicalMaterial({ color: 0xff8c1a, roughness: 0.28, clearcoat: 0.6 }));
  orangeFruit.position.set(-0.055, 0.244, 0.01);

  partB3ShelvesFood.add(milkBody, milkStripe, milkCap, apple, stem, bottle, bCap, bowl, orangeFruit);
  subB.add(partB3ShelvesFood);

  // Part 4: Upper Frosted Freezer Compartment Housing
  const partB4FreezerBox = new THREE.Group();
  const frostPanelMat = new THREE.MeshPhysicalMaterial({ color: 0xcff2ff, roughness: 0.25, metalness: 0.35, clearcoat: 0.9 });
  const freezerFloor = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.012, 0.20), frostPanelMat);
  freezerFloor.position.set(0, 0.405, -0.005);
  const freezerBack = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.125, 0.01), frostPanelMat);
  freezerBack.position.set(0, 0.475, -0.082);
  partB4FreezerBox.add(freezerFloor, freezerBack);
  subB.add(partB4FreezerBox);

  // Part 5 (Stage 1): Serpentine Blue Freezer Evaporator Coils + Brass Expansion Valve!
  const partB5EvapCoils = new THREE.Group();
  const evapCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.12, 0.52, -0.068),
    new THREE.Vector3(0.12, 0.52, -0.068),
    new THREE.Vector3(0.12, 0.49, -0.068),
    new THREE.Vector3(-0.12, 0.49, -0.068),
    new THREE.Vector3(-0.12, 0.46, -0.068),
    new THREE.Vector3(0.12, 0.46, -0.068),
    new THREE.Vector3(0.12, 0.43, -0.068),
    new THREE.Vector3(-0.12, 0.43, -0.068),
  ]);
  const evapMat = new THREE.MeshPhysicalMaterial({ color: 0x18b8ff, emissive: 0x06466e, roughness: 0.18, metalness: 0.78, clearcoat: 0.9 });
  const evapTube = new THREE.Mesh(new THREE.TubeGeometry(evapCurve, 72, 0.0085, 12, false), evapMat);
  // Brass Expansion Valve (صمام التمدد الضيق) on left wall!
  const expValve = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.038, 16), createBrushedMetalMaterial(0xffcb44, 0.2, 0.92));
  expValve.position.set(-0.135, 0.51, -0.105);
  partB5EvapCoils.add(evapTube, expValve);
  subB.add(partB5EvapCoils);

  // Part 6 (Stage 2): Heavy Black Hermetic Compressor Motor + Copper Suction Pipe!
  const partB6Compressor = new THREE.Group();
  const compMat = createBrushedMetalMaterial(0x1f1938, 0.28, 0.85);
  const compBody = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.068, 0.095, 24), compMat);
  compBody.position.set(0, 0.075, -0.165);
  const compCap = new THREE.Mesh(new THREE.SphereGeometry(0.064, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), compMat);
  compCap.position.set(0, 0.122, -0.165);
  const suctionCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.12, 0.43, -0.075),
    new THREE.Vector3(0.145, 0.40, -0.135),
    new THREE.Vector3(0.145, 0.10, -0.155),
    new THREE.Vector3(0.055, 0.085, -0.165),
  ]);
  const suctionPipe = new THREE.Mesh(new THREE.TubeGeometry(suctionCurve, 32, 0.0075, 10, false), copperMat);
  partB6Compressor.add(compBody, compCap, suctionPipe);
  subB.add(partB6Compressor);

  // Part 7 (Stage 3): Rear Hot Serpentine Condenser Grid + Cooling Fins!
  const partB7Condenser = new THREE.Group();
  const condCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.05, 0.11, -0.165),
    new THREE.Vector3(-0.135, 0.16, -0.142),
    new THREE.Vector3(0.135, 0.21, -0.142),
    new THREE.Vector3(-0.135, 0.27, -0.142),
    new THREE.Vector3(0.135, 0.33, -0.142),
    new THREE.Vector3(-0.135, 0.39, -0.142),
    new THREE.Vector3(0.135, 0.45, -0.142),
    new THREE.Vector3(-0.135, 0.50, -0.135),
  ]);
  const condMat = new THREE.MeshPhysicalMaterial({ color: 0xff5e2b, emissive: 0x7d1e00, roughness: 0.22, metalness: 0.8, clearcoat: 0.7 });
  const condTube = new THREE.Mesh(new THREE.TubeGeometry(condCurve, 84, 0.008, 12, false), condMat);
  partB7Condenser.add(condTube);
  for (let w = -0.1; w <= 0.101; w += 0.05) {
    const finWire = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.34, 6), chromeMat);
    finWire.position.set(w, 0.32, -0.142);
    partB7Condenser.add(finWire);
  }
  subB.add(partB7Condenser);

  // Part 8: Hinged Double-Glazed Fridge Door with Magnetic Gasket & Brushed Chrome Handle!
  const partB8Door = new THREE.Group();
  const doorPivot = new THREE.Group();
  doorPivot.position.set(0.172, 0.305, 0.11);

  const doorFrameMat = new THREE.MeshPhysicalMaterial({ color: 0xeef5fc, roughness: 0.18, metalness: 0.25, clearcoat: 0.9 });
  const dTop = new THREE.Mesh(new THREE.BoxGeometry(0.345, 0.026, 0.022), doorFrameMat); dTop.position.set(-0.172, 0.252, 0);
  const dBot = new THREE.Mesh(new THREE.BoxGeometry(0.345, 0.026, 0.022), doorFrameMat); dBot.position.set(-0.172, -0.252, 0);
  const dLeft = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.53, 0.022), doorFrameMat); dLeft.position.set(-0.332, 0, 0);
  const dRight = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.53, 0.022), doorFrameMat); dRight.position.set(-0.012, 0, 0);
  const dGlass = new THREE.Mesh(
    new THREE.BoxGeometry(0.295, 0.48, 0.01),
    new THREE.MeshPhysicalMaterial({ color: 0xd8f3ff, transparent: true, opacity: 0.34, roughness: 0.04, clearcoat: 1.0, depthWrite: false })
  );
  dGlass.position.set(-0.172, 0, 0);
  const dHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.22, 14), chromeMat);
  dHandle.position.set(-0.315, 0.02, 0.024);

  const gasket = new THREE.MeshStandardMaterial({color: 0x304747, roughness: 0.86});
  for (const x of [-0.318, -0.028]) {
    const seal = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.475, 0.012), gasket);
    seal.position.set(x, 0, -0.011); doorPivot.add(seal);
  }
  const ventMat = new THREE.MeshStandardMaterial({color: 0x344b49, roughness: 0.65});
  const vent = new THREE.InstancedMesh(new THREE.BoxGeometry(0.004,0.014,0.003), ventMat, 28);
  for (let i = 0; i < 28; i++) vent.setMatrixAt(i,
    new THREE.Matrix4().makeTranslation(-0.14 + i * 0.0105,0.032,0.127));
  partB1Chassis.add(vent);
  doorPivot.add(dTop, dBot, dLeft, dRight, dGlass, dHandle);
  doorPivot.rotation.y = 1.85;
  partB8Door.add(doorPivot);
  subB.add(partB8Door);

  // Part 9: Glowing 3D Circulating Freon Stream + Heat Chevrons!
  const partB9Flow = new THREE.Group();
  const fullCycleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.12, 0.51, -0.068),
    new THREE.Vector3(0.12, 0.48, -0.068),
    new THREE.Vector3(-0.10, 0.44, -0.068),
    new THREE.Vector3(0.13, 0.41, -0.12),
    new THREE.Vector3(0.13, 0.11, -0.155),
    new THREE.Vector3(0.0, 0.085, -0.168),
    new THREE.Vector3(-0.13, 0.19, -0.142),
    new THREE.Vector3(0.13, 0.29, -0.142),
    new THREE.Vector3(-0.13, 0.39, -0.142),
    new THREE.Vector3(0.11, 0.46, -0.142),
    new THREE.Vector3(-0.13, 0.51, -0.115),
  ], true);

  const freonBeads = Array.from({ length: 18 }, (_, i) => {
    const bm = new THREE.Mesh(
      new THREE.SphereGeometry(0.014, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x64f2e1 })
    );
    partB9Flow.add(bm);
    return { mesh: bm, offset: i / 18 };
  });
  subB.add(partB9Flow);

  let doorWideOpen = true, showEnergy = false, cyclePosition = 0;
  const energyPaths = [
    [[0.012,0.23,0.09],[0.006,0.35,0.12],[-0.08,0.45,-0.04]],
    [[0.10,0.38,-0.15],[0.23,0.40,-0.14],[0.33,0.48,-0.055]]
  ].map(points => new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))));
  const up = new THREE.Vector3(0, 1, 0), tangent = new THREE.Vector3();
  const heatRoutes = new THREE.Group();
  const indicators = [];
  energyPaths.forEach((curve, path) => {
    const mat = new THREE.MeshBasicMaterial({color:path === 0 ? 0x14799a : 0xdd572c});
    heatRoutes.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.0018, 5, false),mat));
    for (let i = 0; i < 3; i++) {
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.012,0.027,12),mat);
      heatRoutes.add(arrow); indicators.push({arrow,curve,offset:i/3});
    }
  });
  heatRoutes.visible = false;
  subB.add(heatRoutes);
  function toggleEnergy() {
    if (subMode !== 1) return;
    showEnergy = !showEnergy;
    outerEnamel.transparent = showEnergy;
    outerEnamel.opacity = showEnergy ? 0.23 : 1;
    outerEnamel.depthWrite = !showEnergy;
    outerEnamel.needsUpdate = true;
  }
  const hsDoor = createTouchHotspot(new THREE.Vector3(0.24, 0.30, 0.16), () => {
    doorWideOpen = !doorWideOpen;
  }, 0.12, 0xffcb44);
  subB.add(hsDoor);
  hotspots.push(hsDoor);
  interactables.push(hsDoor.userData.hitMesh);

  const badgeB = createArabicBadge("١. تمدّد وتبخّر (ماص) ← ٢. ضغط ← ٣. تكثّف (طارد)", "#ffcb44", 0.37);
  badgeB.position.set(0, 0.62, 0);
  subB.add(badgeB);

  emerge.addStage("sub1", partB1Chassis,     { startSec: 0.24, durSec: 0.36, sinkDepth: 0.08, buildY: 0.04, spinRad: 0.12, caption: "الشاسيه الفولاذي وأرجل التثبيت" });
  emerge.addStage("sub1", partB2Cabinet,     { startSec: 0.55, durSec: 0.48, sinkDepth: 0.58, buildY: 0.38, spinRad: 0.22, caption: "جسم الثلاجة المعزول والإضاءة الداخلية" });
  emerge.addStage("sub1", partB3ShelvesFood, { startSec: 0.96, durSec: 0.44, sinkDepth: 0.38, buildY: 0.28, spinRad: 0.18, caption: "الأرفف الزجاجية والأطعمة داخل الثلاجة" });
  emerge.addStage("sub1", partB4FreezerBox,  { startSec: 1.34, durSec: 0.38, sinkDepth: 0.52, buildY: 0.48, spinRad: 0.14, caption: "حجرة الفريزر العلوية المبرّدة" });
  emerge.addStage("sub1", partB5EvapCoils,   { startSec: 1.68, durSec: 0.44, sinkDepth: 0.54, buildY: 0.50, spinRad: 0.20, caption: "١) مواسير التبخّر وصمام التمدّد (ماص)" });
  emerge.addStage("sub1", partB6Compressor,  { startSec: 2.06, durSec: 0.42, sinkDepth: 0.22, buildY: 0.14, spinRad: 0.24, caption: "٢) موتور الضاغط الخلفي وأنابيب السحب" });
  emerge.addStage("sub1", partB7Condenser,   { startSec: 2.42, durSec: 0.46, sinkDepth: 0.52, buildY: 0.36, spinRad: 0.18, caption: "٣) شبكة التكثّف النحاسية الخلفية (طارد)" });
  emerge.addStage("sub1", partB8Door,        { startSec: 2.80, durSec: 0.44, sinkDepth: 0.56, buildY: 0.34, spinRad: 0.32, caption: "الباب الزجاجي المفصلي والمقبض المعدني" });
  emerge.addStage("sub1", partB9Flow,        { startSec: 3.16, durSec: 0.38, sinkDepth: 0.48, buildY: 0.42, spinRad: 0.10, caption: "تشغيل دورة سريان سائل الفريون!" });
  emerge.addPopup("sub1", hsDoor,            { startSec: 3.46, durSec: 0.32 });
  emerge.addPopup("sub1", badgeB,            { startSec: 3.50, durSec: 0.32 });

  let subMode = 0, heat = 0, clock = 0;
  emerge.trigger("sub0");

  function setSubMode(idx) {
    subMode = idx;
    subA.visible = idx === 0;
    subB.visible = idx === 1;
    hsDoor.visible = idx === 1;
    emerge.trigger(idx === 0 ? "sub0" : "sub1");
  }

  function triggerEmergence() {
    emerge.trigger(subMode === 0 ? "sub0" : "sub1");
  }

  function cycleSecondary() {
    if (subMode === 0) heat = 0;
    else doorWideOpen = !doorWideOpen;
  }

  function update(dt, { heating = false } = {}) {
    clock += dt;
    const em = emerge.update(dt);
    const ready = !em.emerging;
    hotspots.forEach((h) => { if (h.visible && ready) h.userData.pulse(clock); });

    if (subMode === 0) {
      const canHeat = heating && ready;
      heat = canHeat ? Math.min(1, heat + dt * 0.28) : Math.max(0, heat - dt * 0.11);
      flameA.userData.update(clock, canHeat ? 1 : 0, 0.82);
      gauzeMat.emissive.setRGB(0.55 * heat, 0.16 * heat, 0);

      const melt = THREE.MathUtils.smoothstep(heat, 0.12, 0.5);
      const boil = THREE.MathUtils.smoothstep(heat, 0.55, 0.94);
      iceBlock.visible = 1 - melt > 0.04;
      iceBlock.scale.setScalar(Math.max(0.05, 1 - melt));

      const wFill = melt * (1 - 0.28 * boil);
      waterCyl.visible = wFill > 0.03;
      surface.mesh.visible = waterCyl.visible;
      if (waterCyl.visible) {
        surface.mesh.position.y = beakerY + 0.013 + 0.21 * wFill;
        surface.animate(clock, 0.12 + 0.75 * boil);
        waterCyl.scale.set(1, Math.max(0.05, wFill), 1);
        waterCyl.position.y = beakerY + 0.105 * wFill + 0.012;
      }

      condDrops.forEach((dm, k) => {
        const s = boil * (0.65 + 0.35 * Math.sin(clock * 2.5 + k));
        dm.scale.setScalar(Math.max(0.01, s));
      });

      mols.forEach((m, i) => {
        const vib = 0.002 + 0.006 * heat;
        const sx = m.home.x + Math.sin(clock * 17 + m.phase) * vib;
        const sy = m.home.y + Math.cos(clock * 19 + m.phase) * vib;
        const sz = m.home.z + Math.sin(clock * 15 + m.phase) * vib;

        const lA = clock * 1.4 + m.phase;
        const lx = Math.cos(lA) * 0.085, lz = Math.sin(lA * 1.2) * 0.085, ly = beakerY + 0.038 + (i % 9) * 0.015;

        const gx = Math.cos(lA * 1.8) * 0.105, gz = Math.sin(lA * 2.1) * 0.105;
        const gy = beakerY + 0.13 + Math.abs(Math.sin(clock * 2.2 + m.phase)) * 0.24;

        m.mesh.position.set(
          THREE.MathUtils.lerp(THREE.MathUtils.lerp(sx, lx, melt), gx, boil),
          THREE.MathUtils.lerp(THREE.MathUtils.lerp(sy, ly, melt), gy, boil),
          THREE.MathUtils.lerp(THREE.MathUtils.lerp(sz, lz, melt), gz, boil)
        );
      });

      puffs.forEach((p) => {
        p.sp.visible = ready && boil > 0.08;
        if (p.sp.visible) {
          const u = (clock * 0.55 + p.phase) % 1;
          p.sp.position.set(Math.cos(p.ang) * 0.055, beakerY + 0.18 + u * 0.22, Math.sin(p.ang) * 0.055);
          p.sp.scale.setScalar(0.075 + u * 0.095);
          p.sp.material.opacity = Math.sin(u * Math.PI) * 0.45 * boil;
        }
      });

      return {
        progress: em.emerging ? em.overall : heat,
        sound: canHeat ? (boil > 0.15 ? "boil" : "burner") : "",
        soundLevel: heat,
        badge: "ص ٢ • تحوّلات الحالة",
        subTabs: ["١. تحوّلات الماء الستة", "٢. دورة التبريد بالثلاجة"],
        subIndex: 0,
        buildPill: em.buildPill,
        stateText: em.emerging
          ? em.caption
          : heat < 0.2
            ? "في التلج، جزيئات الميّه بتهتز حوالين أماكن شبه ثابتة. دوس وسخّن وشوف ترتيبها بيتغيّر إزاي."
            : heat < 0.58
              ? "التلج بيمتص حرارة وبينصهر. الجزيئات بدأت تتحرك جنب بعض، وكل جزيء لسه H₂O."
              : "الميّه بتمتص حرارة وهي بتتحوّل لبخار. عند الغطا البارد البخار بيفقد حرارة وبيتكثّف لقطرات.",
        holdLabel: canHeat ? "🔥 جارٍ التسخين..." : "🔥 اضغط مطوّلًا للتسخين",
        secondaryLabel: "❄️ تجميد سريع",
        lift: em.overall,
      stepChime: em.stepChime,
        emerging: em.emerging,
      };
    }

    const speed = heating && ready ? 0.46 : doorWideOpen ? 0.24 : 0.16;
    cyclePosition = (cyclePosition + dt * speed) % 1;
    heatRoutes.visible = ready && showEnergy;
    if (heatRoutes.visible) for (const {arrow, curve, offset} of indicators) {
      const t = (cyclePosition + offset) % 1;
      curve.getPointAt(t, arrow.position);
      arrow.quaternion.setFromUnitVectors(up, curve.getTangentAt(t, tangent));
    }
    fridgeInteriorLight.intensity = doorWideOpen ? 0.017 : 0.002;
    doorPivot.rotation.y = THREE.MathUtils.lerp(doorPivot.rotation.y, doorWideOpen ? 1.88 : 0.18, 1 - Math.exp(-dt * 8));
    freonBeads.forEach((fb) => {
      const u = (cyclePosition + fb.offset) % 1;
      fb.mesh.position.copy(fullCycleCurve.getPointAt(u));
      fb.mesh.material.color.setHex(u < 0.32 ? 0x5ce8ff : u < 0.54 ? 0xffcb44 : 0xff5e2b);
    });

    badgeB.userData.setText(
      showEnergy ? "المبخّر يمتصّ حرارة • المكثّف يطردها" : doorWideOpen ? "الباب مفتوح" : "الباب مقفول",
      "#ffcb44"
    );

    return {
      progress: em.emerging ? em.overall : (doorWideOpen ? 1 : 0.65),
      sound: ready ? "motor" : "", soundLevel: heating || doorWideOpen ? 0.85 : 0.32,
      event: doorWideOpen ? "door-open" : "door-closed",
      badge: "ص ٣ • دورة التلاجة",
      subTabs: ["١. تحوّلات الماء الستة", "٢. دورة التبريد بالثلاجة"],
      subIndex: 1,
      buildPill: em.buildPill,
      stateText: em.emerging
        ? em.caption
        : showEnergy ? "اتبع الأسهم. جوّه التلاجة الحرارة بتنتقل من الأكل للمبخّر، وبرّه التلاجة المكثّف بيسلّمها لهوا المطبخ." : "١) التمدّد والتبخّر بالفريزر (أزرق — يمتص حرارة الأكل) ← ٢) الضغط بالموتور ← ٣) التكثّف بالشبكة الخلفية (أحمر — يطرد الحرارة للمطبخ).",
      holdLabel: "⚡ تسريع دورة الفريون",
      showTertiary: true, tertiaryLabel: showEnergy ? "اخفِ مسار الحرارة" : "تتبّع انتقال الحرارة",
      secondaryLabel: doorWideOpen ? "🚪 أغلق باب التلاجة" : "🚪 افتح الباب بالكامل",
      lift: em.overall,
      stepChime: em.stepChime,
      emerging: em.emerging,
    };
  }

  return { root, interactables, update, setLift: emerge.setLift, setSubMode, triggerEmergence, cycleSecondary, tertiaryAction: toggleEnergy, reset: () => { heat = 0; triggerEmergence(); } };
}

/**
 * ============================================================================
 * STATION 1 (Pages 4-7): مسعر الكوبين العازلين (٨ أجزاء واقعية) + T1, T2, ΔT
 * ============================================================================
 */
export function createStation1Calorimeter({ showBooklet = true } = {}) {
  const root = new THREE.Group();
  attachLabLighting(root);
  const emerge = createBookletEmergenceController(root, "./targets/ar-plate-calorimeter.png", { showBooklet });

  const interactables = [];
  const hotspots = [];
  const chromeMat = createBrushedMetalMaterial(0xdce4f2, 0.16, 0.94);
  const castBaseMat = createBrushedMetalMaterial(0x281c45, 0.36, 0.72);
  const outerFoamMat = createStyrofoamMaterial(0xfff9ee);
  const innerFoamMat = createStyrofoamMaterial(0xffffff);

  // Part 1: Lab Stand Base + Vertical Thermometer Clamp Rod
  const part1BaseStand = new THREE.Group();
  const baseDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.25, 0.018, 48), castBaseMat);
  baseDisc.position.y = 0.016;
  const standPost = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.46, 14), chromeMat);
  standPost.position.set(0.205, 0.245, 0);
  const clampArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.014, 0.018), chromeMat);
  clampArm.position.set(0.14, 0.43, 0);
  part1BaseStand.add(baseDisc, standPost, clampArm);
  root.add(part1BaseStand);

  // Part 2: Outer Cellular-Foam Polystyrene Cup
  const part2OuterCup = new THREE.Group();
  const outerCup = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.132, 0.255, 42, 1, false), outerFoamMat);
  outerCup.position.y = 0.152; outerCup.castShadow = true;
  const rimOuter = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.011, 14, 44), outerFoamMat);
  rimOuter.rotation.x = Math.PI / 2; rimOuter.position.y = 0.28;
  part2OuterCup.add(outerCup, rimOuter);
  root.add(part2OuterCup);

  // Part 3: Air-Gap Insulating Ring + Nested Inner Polystyrene Cup
  const part3InnerCup = new THREE.Group();
  const innerCup = new THREE.Mesh(new THREE.CylinderGeometry(0.154, 0.118, 0.245, 42, 1, true), innerFoamMat);
  innerCup.position.y = 0.172;
  const rimInner = new THREE.Mesh(new THREE.TorusGeometry(0.154, 0.0095, 14, 44), innerFoamMat);
  rimInner.rotation.x = Math.PI / 2; rimInner.position.y = 0.295;
  part3InnerCup.add(innerCup, rimInner);
  root.add(part3InnerCup);

  // Part 4: Refractive Water Solution (The System!) + Dissolved Ion Spheres
  const part4Solution = new THREE.Group();
  const solMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8, roughness: 0.05, clearcoat: 1.0, ior: 1.33, transparent: true, opacity: 0.78,
  });
  const solCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.144, 0.115, 0.19, 36), solMat);
  solCyl.position.y = 0.145;
  const surface = createWaterSurface(0.143);
  surface.mesh.position.y = 0.241;
  part4Solution.add(solCyl, surface.mesh);

  const ions = Array.from({ length: 14 }, (_, k) => {
    const im = new THREE.Mesh(
      new THREE.SphereGeometry(0.011, 12, 10),
      new THREE.MeshPhysicalMaterial({ color: k % 2 === 0 ? 0xffcb44 : 0xffffff, clearcoat: 1.0 })
    );
    im.position.set(Math.cos(k) * 0.06, 0.09 + (k % 5) * 0.025, Math.sin(k * 1.4) * 0.06);
    part4Solution.add(im);
    return { mesh: im, phase: k * 0.9 };
  });
  root.add(part4Solution);

  // Part 5: Cutaway Slotted Thermal Lid (so student sees both insulation & liquid inside!)
  const part5Lid = new THREE.Group();
  const lidMat = new THREE.MeshPhysicalMaterial({ color: 0xffcb44, roughness: 0.28, clearcoat: 0.55, transparent: true, opacity: 0.72 });
  const lidMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.184, 0.184, 0.018, 42, 1, false, 0, Math.PI * 1.45), lidMat);
  lidMesh.position.y = 0.306;
  part5Lid.add(lidMesh);
  root.add(part5Lid);

  // Part 6: Glass Loop Stirring Rod
  const part6Stirrer = new THREE.Group();
  const rodGroup = new THREE.Group();
  const rodShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.36, 14), chromeMat);
  rodShaft.position.y = 0.26;
  const rodLoop = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 10, 24), chromeMat);
  rodLoop.position.y = 0.085;
  rodGroup.add(rodShaft, rodLoop);
  rodGroup.position.set(-0.03, 0, 0.02);
  part6Stirrer.add(rodGroup);
  root.add(part6Stirrer);

  // Part 7: Detailed Graduated Lab Thermometer (0–35 °C Scale + Glass Tube + T1 Clamp + Live T2 Column!)
  const part7Thermo = new THREE.Group();
  const thermoGroup = new THREE.Group();
  thermoGroup.position.set(0.085, 0.11, 0);

  const scaleCanvas = document.createElement("canvas");
  scaleCanvas.width = 128; scaleCanvas.height = 512;
  const sg = scaleCanvas.getContext("2d");
  sg.fillStyle = "#ffffff"; sg.fillRect(0, 0, 128, 512);
  sg.strokeStyle = "#1b1336"; sg.fillStyle = "#1b1336";
  sg.font = "bold 24px sans-serif";
  for (let deg = 0; deg <= 35; deg++) {
    const py = 468 - deg * 12;
    sg.lineWidth = deg % 5 === 0 ? 4 : 2;
    sg.beginPath(); sg.moveTo(68, py); sg.lineTo(deg % 5 === 0 ? 114 : 94, py); sg.stroke();
    if (deg % 10 === 0 || deg === 25) sg.fillText(String(deg), 12, py + 8);
  }
  const scaleTex = new THREE.CanvasTexture(scaleCanvas);
  scaleTex.colorSpace = THREE.SRGBColorSpace;

  const tBoard = new THREE.Mesh(
    new THREE.BoxGeometry(0.056, 0.37, 0.012),
    new THREE.MeshStandardMaterial({ map: scaleTex, roughness: 0.35 })
  );
  tBoard.position.y = 0.195;

  const glassStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.011, 0.35, 16),
    new THREE.MeshPhysicalMaterial({ color: 0xeaf9ff, transparent: true, opacity: 0.42, roughness: 0.04, clearcoat: 1.0, depthWrite: false })
  );
  glassStem.position.set(0.004, 0.19, 0.011);

  const tBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.024, 18, 16),
    new THREE.MeshPhysicalMaterial({ color: 0xe63946, roughness: 0.1, clearcoat: 1.0 })
  );
  tBulb.position.set(0.004, 0.015, 0.011);

  const tColMat = new THREE.MeshStandardMaterial({ color: 0xe63946, emissive: 0x77101b });
  const tCol = new THREE.Mesh(new THREE.CylinderGeometry(0.0068, 0.0068, 0.30, 12), tColMat);
  tCol.position.set(0.004, 0.03, 0.011);

  const t1Mark = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.008, 0.018), new THREE.MeshBasicMaterial({ color: 0x1b1336 }));
  t1Mark.position.set(0, 0.175, 0.012);

  thermoGroup.add(tBoard, glassStem, tBulb, tCol, t1Mark);
  part7Thermo.add(thermoGroup);
  root.add(part7Thermo);

  // Part 8: Brushed Stainless Spatula Spoon + Falling Salt Grains!
  const part8Spoon = new THREE.Group();
  const spoon = new THREE.Group();
  spoon.position.set(-0.155, 0.395, 0.03);
  const sBar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.006, 0.018), chromeMat);
  sBar.position.x = -0.065;
  const sBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.022, 0.01, 18), chromeMat);
  sBowl.position.set(0.022, 0.002, 0);
  const sHeap = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.032, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 }));
  sHeap.position.set(0.022, 0.02, 0);
  spoon.add(sBar, sBowl, sHeap);
  part8Spoon.add(spoon);

  const fallingGrains = Array.from({ length: 12 }, (_, gIdx) => {
    const gm = new THREE.Mesh(new THREE.OctahedronGeometry(0.0065, 0), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    gm.visible = false;
    part8Spoon.add(gm);
    return { mesh: gm, off: gIdx / 12 };
  });
  root.add(part8Spoon);

  const salts = [
    { name: "نترات أمونيوم NH₄NO₃", dir: -1, deltaScale: -0.34, waterCol: 0x1d9bf0, label: "ΔT سالبة (T₂ < T₁) • ذوبان ماص للحرارة" },
    { name: "هيدروكسيد صوديوم NaOH", dir: +1, deltaScale: +0.42, waterCol: 0xff7b54, label: "ΔT موجبة (T₂ > T₁) • ذوبان طارد للحرارة" },
    { name: "كلوريد ليثيوم لا مائي LiCl", dir: +1, deltaScale: +0.36, waterCol: 0xff9248, label: "الصورة اللامائية LiCl ← ذوبان طارد (+ΔT)" },
    { name: "كلوريد ليثيوم مائي LiCl·H₂O", dir: -1, deltaScale: -0.26, waterCol: 0x38bdf8, label: "الصورة المائية LiCl·H₂O ← ذوبان ماص (−ΔT)" },
  ];

  let saltIdx = 0, prog = 0, active = false, clock = 0;

  const hsSpoon = createTouchHotspot(new THREE.Vector3(-0.13, 0.41, 0.04), () => { active = true; }, 0.11, 0xffcb44);
  root.add(hsSpoon);
  hotspots.push(hsSpoon);
  interactables.push(hsSpoon.userData.hitMesh);

  const badge = createArabicBadge("علامة البداية T₁ بالمنتصف • المس الملعقة لصبّ الملح!", "#ffcb44", 0.45);
  badge.position.set(0, 0.53, 0);
  root.add(badge);

  emerge.addStage("default", part1BaseStand, { startSec: 0.24, durSec: 0.36, sinkDepth: 0.14, buildY: 0.24, spinRad: 0.14, caption: "قاعدة الجهاز وحامل الترمومتر الفولاذي" });
  emerge.addStage("default", part2OuterCup,  { startSec: 0.56, durSec: 0.44, sinkDepth: 0.32, buildY: 0.26, spinRad: 0.22, caption: "كوب البولي إستيرين العازل الخارجي" });
  emerge.addStage("default", part3InnerCup,  { startSec: 0.94, durSec: 0.44, sinkDepth: 0.34, buildY: 0.28, spinRad: 0.22, caption: "الكوب الداخلي المتداخل والفراغ الهوائي" });
  emerge.addStage("default", part4Solution,  { startSec: 1.32, durSec: 0.42, sinkDepth: 0.26, buildY: 0.22, spinRad: 0.16, caption: "المحلول المائي (النظام System)" });
  emerge.addStage("default", part5Lid,       { startSec: 1.68, durSec: 0.38, sinkDepth: 0.36, buildY: 0.31, spinRad: 0.25, caption: "الغطاء العلوي العازل للحرارة" });
  emerge.addStage("default", part6Stirrer,   { startSec: 2.02, durSec: 0.40, sinkDepth: 0.44, buildY: 0.36, spinRad: 0.20, caption: "ساق التقليب المعدنية" });
  emerge.addStage("default", part7Thermo,    { startSec: 2.36, durSec: 0.46, sinkDepth: 0.50, buildY: 0.44, spinRad: 0.16, caption: "الترمومتر المعملي المدرّج وعلامة T₁" });
  emerge.addStage("default", part8Spoon,     { startSec: 2.76, durSec: 0.42, sinkDepth: 0.46, buildY: 0.41, spinRad: 0.24, caption: "ملعقة الملح الجاهزة للإذابة!" });
  emerge.addPopup("default", hsSpoon,        { startSec: 3.12, durSec: 0.32 });
  emerge.addPopup("default", badge,          { startSec: 3.16, durSec: 0.32 });
  emerge.trigger("default");

  function triggerEmergence() { emerge.trigger("default"); }

  function setSubMode(idx) {
    saltIdx = idx === 0 ? 0 : 2;
    prog = 0; active = false;
    emerge.trigger("default");
  }

  function cycleSecondary() {
    saltIdx = (saltIdx + 1) % salts.length;
    prog = 0; active = false;
  }

  function update(dt, { heating = false } = {}) {
    clock += dt;
    const em = emerge.update(dt);
    const ready = !em.emerging;
    hotspots.forEach((h) => { if (ready) h.userData.pulse(clock); });

    if ((heating || active) && ready) {
      active = true;
      prog = Math.min(1, prog + dt * 0.38);
    }
    spoon.rotation.z = active ? -Math.min(0.68, prog * 1.9) : 0;
    sHeap.visible = prog < 0.42;

    fallingGrains.forEach((fg) => {
      const pouring = active && prog > 0.04 && prog < 0.52;
      fg.mesh.visible = pouring;
      if (pouring) {
        const u = (clock * 2.4 + fg.off) % 1;
        fg.mesh.position.set(-0.11 + u * 0.04, 0.38 - u * 0.22, 0.02 * Math.sin(u * 9));
      }
    });

    rodGroup.position.x = -0.02 + Math.cos(clock * (active ? 6.0 : 1.2)) * 0.038;
    rodGroup.position.z = Math.sin(clock * (active ? 6.0 : 1.2)) * 0.038;

    ions.forEach((ion, idx) => {
      const r = 0.04 + (idx % 3) * 0.025;
      const a = clock * (active ? 3.2 : 0.7) + ion.phase;
      ion.mesh.position.set(Math.cos(a) * r, 0.08 + (idx % 5) * 0.026, Math.sin(a) * r);
    });

    surface.animate(clock, active && prog < 1 ? 1 : 0.09);
    const s = salts[saltIdx];
    solMat.color.lerp(new THREE.Color(prog > 0.2 ? s.waterCol : 0x38bdf8), 0.08);
    const level = 0.52 + prog * s.deltaScale;
    tCol.scale.set(1, level, 1);
    tCol.position.y = 0.02 + 0.15 * level;
    badge.userData.setText(prog > 0.15 ? s.label : `المادة: ${s.name} • المس الملعقة للصبّ`, s.dir < 0 ? "#62e8ff" : "#ff9f1c");

    return {
      progress: em.emerging ? em.overall : prog,
      sound: ready && active && prog < 1 ? "stir" : "", soundLevel: Math.sin(prog * Math.PI),
      badge: "ص ٥–٧ • المسعر والأملاح",
      subTabs: ["١. أملاح شائعة: NH₄NO₃ و NaOH", "٢. نفس الملح في صورتين: LiCl"],
      subIndex: saltIdx >= 2 ? 1 : 0,
      buildPill: em.buildPill,
      stateText: em.emerging
        ? em.caption
        : `المادة المختارة: ${s.name}. قارن مستوى النهاية T₂ بعلامة البداية السوداء T₁ على التدريج (ΔT = T₂ − T₁).`,
      holdLabel: prog >= 0.98 ? "✓ اكتمل الذوبان" : "🥄 صبّ الملح وقلّب",
      secondaryLabel: "⇄ بدّل الملح",
      showTertiary: prog > 0.05,
      lift: em.overall,
      stepChime: em.stepChime,
      emerging: em.emerging,
    };
  }

  return { root, interactables, update, setLift: emerge.setLift, setSubMode, triggerEmergence, cycleSecondary, primaryAction: () => { active = true; }, reset: () => { prog = 0; active = false; triggerEmergence(); } };
}

/**
 * ============================================================================
 * STATION 2 (Page 8): البلّورات المائية واللامائية (٧ أجزاء تبنى من الصفحة!)
 * ============================================================================
 */
export function createStation2Crystals({ showBooklet = true } = {}) {
  const root = new THREE.Group();
  attachLabLighting(root);
  const emerge = createBookletEmergenceController(root, "./targets/ar-plate-crystals.png", { showBooklet });

  const interactables = [];
  const hotspots = [];
  const chromeMat = createBrushedMetalMaterial(0xdce4f2, 0.16, 0.94);
  const castBaseMat = createBrushedMetalMaterial(0x281c45, 0.36, 0.72);

  // Part 1: Heavy Lab Base + Dropper Stand Post
  const part1Base = new THREE.Group();
  const basePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.018, 48), castBaseMat);
  basePlate.position.y = 0.016;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.49, 14), chromeMat);
  post.position.set(0.185, 0.26, 0);
  part1Base.add(basePlate, post);
  root.add(part1Base);

  // Part 2: 3 Chrome Tripod Legs + Ring Collar
  const part2Tripod = new THREE.Group();
  const standH = 0.205;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.01, 14, 40), chromeMat);
  ring.rotation.x = Math.PI / 2; ring.position.y = standH;
  part2Tripod.add(ring);
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3 + 0.2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.009, standH, 12), chromeMat);
    leg.position.set(Math.cos(a) * 0.155, standH / 2 + 0.012, Math.sin(a) * 0.155);
    part2Tripod.add(leg);
  }
  root.add(part2Tripod);

  // Part 3: Detailed Brass Bunsen Burner
  const part3Burner = createDetailedBunsenBurner(0.68);
  part3Burner.position.y = 0.018;
  const flame = part3Burner.userData.flame;
  root.add(part3Burner);

  // Part 4: Clay Pipe-Stem Heating Triangle on the Ring
  const part4Triangle = new THREE.Group();
  const clayMat = new THREE.MeshStandardMaterial({ color: 0xede6d8, roughness: 0.75 });
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3;
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.19, 12), clayMat);
    pipe.rotation.z = Math.PI / 2;
    pipe.rotation.y = a;
    pipe.position.set(Math.cos(a + Math.PI / 2) * 0.055, standH + 0.008, Math.sin(a + Math.PI / 2) * 0.055);
    part4Triangle.add(pipe);
  }
  root.add(part4Triangle);

  // Part 5: Glazed Porcelain Evaporating Dish
  const part5Dish = new THREE.Group();
  const dishMat = new THREE.MeshPhysicalMaterial({ color: 0xfcfbf8, roughness: 0.14, clearcoat: 0.9, side: THREE.DoubleSide });
  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(0.172, 40, 20, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45),
    dishMat
  );
  dish.position.y = standH + 0.148;
  part5Dish.add(dish);
  root.add(part5Dish);

  // Part 6: 34 Multi-Faceted Specular Hydrated Salt Crystals!
  const part6Crystals = new THREE.Group();
  const crystalMat = new THREE.MeshPhysicalMaterial({
    color: 0x0d74e8, roughness: 0.12, metalness: 0.08, clearcoat: 1.0, reflectivity: 1.0, ior: 1.54,
  });
  const crystalGroup = new THREE.Group();
  crystalGroup.position.y = standH + 0.016;
  for (let c = 0; c < 34; c++) {
    const r = (c % 6) * 0.02;
    const a = c * 1.65;
    const geo = c % 2 === 0 ? new THREE.OctahedronGeometry(0.022 + (c % 3) * 0.005, 0) : new THREE.DodecahedronGeometry(0.019 + (c % 3) * 0.004, 0);
    const shard = new THREE.Mesh(geo, crystalMat);
    shard.position.set(Math.cos(a) * r, (1 - r * 3.8) * 0.02, Math.sin(a) * r);
    shard.rotation.set(c * 0.5, a, 0.35);
    crystalGroup.add(shard);
  }
  part6Crystals.add(crystalGroup);
  root.add(part6Crystals);

  // Part 7: Clamp Arm + Glass Pasteur Water Dropper Pipette!
  const part7Dropper = new THREE.Group();
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.012, 0.016), chromeMat);
  arm.position.set(0.115, 0.46, 0);
  const dropperGroup = new THREE.Group();
  dropperGroup.position.set(0.045, 0.455, 0);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 16, 14),
    new THREE.MeshPhysicalMaterial({ color: 0xfd6585, roughness: 0.38, clearcoat: 0.4 })
  );
  bulb.scale.set(0.85, 1.38, 0.85); bulb.position.y = 0.055;
  const pipette = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.004, 0.105, 16),
    new THREE.MeshPhysicalMaterial({ color: 0xe6f8ff, transparent: true, opacity: 0.62, roughness: 0.04, clearcoat: 1.0 })
  );
  const innerWater = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.003, 0.065, 12),
    new THREE.MeshPhysicalMaterial({ color: 0x38bdf8, clearcoat: 1.0 })
  );
  innerWater.position.y = -0.012;
  dropperGroup.add(bulb, pipette, innerWater);
  part7Dropper.add(arm, dropperGroup);
  root.add(part7Dropper);

  const puffTex = getSoftPuffTexture();
  const steamPuffs = Array.from({ length: 8 }, (_, i) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, opacity: 0, depthWrite: false }));
    root.add(sp);
    return { sp, off: i / 8, ang: i * 1.9 };
  });

  const waterDrop = new THREE.Mesh(
    new THREE.SphereGeometry(0.013, 12, 12),
    new THREE.MeshPhysicalMaterial({ color: 0x38bdf8, roughness: 0.04, clearcoat: 1.0 })
  );
  waterDrop.scale.set(0.8, 1.4, 0.8);
  waterDrop.visible = false;
  root.add(waterDrop);

  let crystalKind = 0, dehydration = 0, rehydrating = false, dropY = 0, clock = 0;

  const hsDropper = createTouchHotspot(new THREE.Vector3(0.045, 0.48, 0.03), () => {
    if (dehydration > 0.05) { rehydrating = true; dropY = 0.40; }
  }, 0.11, 0x62e8ff);
  root.add(hsDropper);
  hotspots.push(hsDropper);
  interactables.push(hsDropper.userData.hitMesh);

  const badge = createArabicBadge("CuSO₄·5H₂O (زرقاء) ⇄ سخّن لنزع ماء التبلور", "#4cc9f0", 0.45);
  badge.position.set(0, 0.58, 0);
  root.add(badge);

  emerge.addStage("default", part1Base,     { startSec: 0.24, durSec: 0.36, sinkDepth: 0.14, buildY: 0.24, spinRad: 0.14, caption: "قاعدة التثبيت وحامل القطّارة" });
  emerge.addStage("default", part2Tripod,   { startSec: 0.56, durSec: 0.42, sinkDepth: 0.24, buildY: 0.21, spinRad: 0.28, caption: "الحامل الثلاثي الفولاذي" });
  emerge.addStage("default", part3Burner,   { startSec: 0.94, durSec: 0.40, sinkDepth: 0.16, buildY: 0.14, spinRad: 0.22, caption: "موقد بنزن النحاسي" });
  emerge.addStage("default", part4Triangle, { startSec: 1.28, durSec: 0.36, sinkDepth: 0.24, buildY: 0.22, spinRad: 0.24, caption: "مثلث الخزف الحراري" });
  emerge.addStage("default", part5Dish,     { startSec: 1.60, durSec: 0.42, sinkDepth: 0.34, buildY: 0.28, spinRad: 0.18, caption: "جفنة التسخين الخزفية المصقولة" });
  emerge.addStage("default", part6Crystals, { startSec: 1.98, durSec: 0.46, sinkDepth: 0.32, buildY: 0.26, spinRad: 0.30, caption: "تشكّل البلّورات الملوّنة المتهدرتة" });
  emerge.addStage("default", part7Dropper,  { startSec: 2.38, durSec: 0.44, sinkDepth: 0.52, buildY: 0.48, spinRad: 0.18, caption: "قطّارة الماء الزجاجية لإعادة التميّؤ!" });
  emerge.addPopup("default", hsDropper,     { startSec: 2.76, durSec: 0.32 });
  emerge.addPopup("default", badge,         { startSec: 2.80, durSec: 0.32 });
  emerge.trigger("default");

  function triggerEmergence() { emerge.trigger("default"); }

  function setSubMode(idx) {
    crystalKind = idx;
    dehydration = 0; rehydrating = false;
    emerge.trigger("default");
  }

  function cycleSecondary() {
    if (dehydration > 0.1) { rehydrating = true; dropY = 0.40; }
    else { crystalKind = (crystalKind + 1) % 2; }
  }

  function update(dt, { heating = false } = {}) {
    clock += dt;
    const em = emerge.update(dt);
    const ready = !em.emerging;
    hotspots.forEach((h) => { if (ready) h.userData.pulse(clock); });

    const canHeat = heating && ready;
    if (canHeat) {
      rehydrating = false;
      dehydration = Math.min(1, dehydration + dt * 0.36);
    } else if (rehydrating && ready) {
      dropY -= dt * 0.52;
      bulb.scale.set(0.72, 1.44, 0.72);
      waterDrop.visible = dropY > standH + 0.03;
      waterDrop.position.set(0.045, Math.max(standH + 0.03, dropY), 0);
      if (dropY <= standH + 0.085) {
        dehydration = Math.max(0, dehydration - dt * 0.9);
        if (dehydration <= 0.01) { rehydrating = false; waterDrop.visible = false; }
      }
    } else {
      bulb.scale.set(0.85, 1.38, 0.85);
      waterDrop.visible = false;
    }

    flame.userData.update(clock, canHeat ? 1 : 0, 0.85);

    steamPuffs.forEach((sp) => {
      const steaming = canHeat && dehydration < 0.98;
      sp.sp.visible = steaming;
      if (steaming) {
        const u = (clock * 0.65 + sp.off) % 1;
        sp.sp.position.set(Math.cos(sp.ang) * 0.05, standH + 0.05 + u * 0.22, Math.sin(sp.ang) * 0.05);
        sp.sp.scale.setScalar(0.06 + u * 0.08);
        sp.sp.material.opacity = Math.sin(u * Math.PI) * 0.48;
      }
    });

    const hydCol = new THREE.Color(crystalKind === 0 ? 0x0d74e8 : 0xe84a7f);
    const anhCol = new THREE.Color(crystalKind === 0 ? 0xf5f7fa : 0x1e56c8);
    crystalMat.color.lerpColors(hydCol, anhCol, dehydration);
    crystalMat.roughness = THREE.MathUtils.lerp(0.12, 0.68, dehydration);

    if (crystalKind === 0) {
      badge.userData.setText(
        dehydration > 0.8 ? "CuSO₄ لا مائية (بيضاء) • المس القطّارة لإضافة الماء!" : "CuSO₄·5H₂O مائية (زرقاء) • سخّن لنزع ماء التبلور",
        dehydration > 0.8 ? "#ffcb44" : "#4cc9f0"
      );
    } else {
      badge.userData.setText(
        dehydration > 0.8 ? "CoCl₂ لا مائي (أزرق) • المس القطّارة لإضافة الماء!" : "CoCl₂·6H₂O مائي (وردي) • سخّن لنزع ماء التبلور",
        dehydration > 0.8 ? "#4cc9f0" : "#fd7391"
      );
    }

    return {
      progress: em.emerging ? em.overall : dehydration,
      sound: canHeat ? "burner" : "", soundLevel: dehydration, event: rehydrating ? "drop" : "",
      badge: "ص ٨ • البلّورات المتهدرتة",
      subTabs: ["١. كبريتات النحاس (أزرق ⇄ أبيض)", "٢. كلوريد الكوبلت (وردي ⇄ أزرق)"],
      subIndex: crystalKind,
      buildPill: em.buildPill,
      stateText: em.emerging
        ? em.caption
        : "هنا نتابع البلّورة الصلبة نفسها دون ذوبان: بالتسخين تمتص حرارة وتفقد ماء التبلور، وبإضافة قطرات الماء تطلق حرارة وتستعيد لونها!",
      holdLabel: canHeat ? "🔥 جارٍ نزع ماء التبلور (ماص)..." : "🔥 اضغط مطوّلًا لتسخين البلّورة",
      secondaryLabel: dehydration > 0.1 ? "💧 أضف قطرات ماء (طارد)" : "⇄ بدّل نوع البلّورة",
      showTertiary: false,
      lift: em.overall,
      stepChime: em.stepChime,
      emerging: em.emerging,
    };
  }

  return { root, interactables, update, setLift: emerge.setLift, setSubMode, triggerEmergence, cycleSecondary, reset: () => { dehydration = 0; triggerEmergence(); } };
}

/**
 * ============================================================================
 * STATION 3 (Pages 11-12): الكمّادات الفورية والوعاء الدموي + أمان تخفيف الحمض المركّز
 * ============================================================================
 */
export function createStation3PacksAndSafety({ showBooklet = true } = {}) {
  const root = new THREE.Group();
  attachLabLighting(root);
  const emerge = createBookletEmergenceController(root, "./targets/ar-plate-packs.png", { showBooklet });

  const interactables = [];
  const hotspots = [];
  const castBaseMat = createBrushedMetalMaterial(0x281c45, 0.36, 0.72);
  const chromeMat = createBrushedMetalMaterial(0xdce4f2, 0.18, 0.92);

  // ================= SUB A: Sculpted Cushioned Pack + Flowing Blood Cells! (6 Parts) =================
  const subA = new THREE.Group();
  root.add(subA);

  // Part 1: Medical Examination Tray Base
  const partA1Tray = new THREE.Group();
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.018, 0.32), castBaseMat);
  tray.position.y = 0.015;
  partA1Tray.add(tray);
  subA.add(partA1Tray);

  // Part 2: Sculpted 3D Cushioned Pillow Pack with Crimped Borders!
  const partA2Pouch = new THREE.Group();
  const pouchGeo = createCushionedPackGeometry(0.35, 0.24, 0.088);
  const pouchMat = new THREE.MeshPhysicalMaterial({
    color: 0x1ea8ec, roughness: 0.22, metalness: 0.06, clearcoat: 0.78, clearcoatRoughness: 0.16,
  });
  const pouch = new THREE.Mesh(pouchGeo, pouchMat);
  pouch.position.y = 0.068; pouch.castShadow = true;
  partA2Pouch.add(pouch);
  subA.add(partA2Pouch);

  // Part 3: Printed Chemical Label Patch + Inner Water Blister Ampoule & Salt Granules!
  const partA3Inner = new THREE.Group();
  const lblCanvas = document.createElement("canvas");
  lblCanvas.width = 256; lblCanvas.height = 128;
  const lg = lblCanvas.getContext("2d");
  function paintPackLabel(hot) {
    lg.fillStyle = hot ? "#fff3dc" : "#eaf9ff";
    lg.fillRect(0, 0, 256, 128);
    lg.strokeStyle = hot ? "#d9480f" : "#0b64a0";
    lg.lineWidth = 8; lg.strokeRect(6, 6, 244, 116);
    lg.fillStyle = "#1b1336"; lg.textAlign = "center";
    lg.font = "bold 28px Tahoma, sans-serif";
    lg.fillText(hot ? "كمّادة ساخنة" : "كمّادة باردة", 128, 48);
    lg.font = "bold 30px sans-serif";
    lg.fillStyle = hot ? "#b82518" : "#0066a6";
    lg.fillText(hot ? "MgSO₄ (+)" : "NH₄NO₃ (−)", 128, 94);
  }
  paintPackLabel(false);
  const lblTex = new THREE.CanvasTexture(lblCanvas);
  lblTex.colorSpace = THREE.SRGBColorSpace;
  const labelPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.18, 0.09),
    new THREE.MeshStandardMaterial({ map: lblTex, roughness: 0.35 })
  );
  labelPlate.rotation.x = -Math.PI / 2;
  labelPlate.position.set(0, 0.114, 0.02);

  const blister = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.022, 0.08, 10, 16),
    new THREE.MeshPhysicalMaterial({ color: 0x90e0ef, transparent: true, opacity: 0.85, roughness: 0.06, clearcoat: 1.0 })
  );
  blister.rotation.z = Math.PI / 2;
  blister.position.set(0, 0.115, -0.055);
  partA3Inner.add(labelPlate, blister);
  subA.add(partA3Inner);

  // Part 4: Anatomical Tissue Bed Supports
  const partA4Supports = new THREE.Group();
  [-0.14, 0.14].forEach((sx) => {
    const postA = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.16, 14), chromeMat);
    postA.position.set(sx, 0.15, 0);
    partA4Supports.add(postA);
  });
  subA.add(partA4Supports);

  // Part 5: Translucent 3D Blood Vessel Wall!
  const partA5Vessel = new THREE.Group();
  const vesselGroup = new THREE.Group();
  vesselGroup.position.set(0, 0.245, 0);
  const vesselMat = new THREE.MeshPhysicalMaterial({
    color: 0xe63946, roughness: 0.18, clearcoat: 0.85, transparent: true, opacity: 0.62, side: THREE.DoubleSide,
  });
  const outerVessel = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.36, 28, 1, true), vesselMat);
  outerVessel.rotation.z = Math.PI / 2;
  const ringLeft = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.005, 12, 28), new THREE.MeshStandardMaterial({ color: 0xb5172c }));
  ringLeft.rotation.y = Math.PI / 2; ringLeft.position.x = -0.18;
  const ringRight = ringLeft.clone(); ringRight.position.x = 0.18;
  vesselGroup.add(outerVessel, ringLeft, ringRight);
  partA5Vessel.add(vesselGroup);
  subA.add(partA5Vessel);

  // Part 6: Flowing 3D Biconcave Red Blood Cells inside the Blood Vessel!
  const partA6BloodCells = new THREE.Group();
  const rbcMat = new THREE.MeshPhysicalMaterial({ color: 0xd90429, roughness: 0.25, clearcoat: 0.8 });
  const rbcs = Array.from({ length: 14 }, (_, i) => {
    const cell = new THREE.Mesh(new THREE.SphereGeometry(0.016, 14, 10), rbcMat);
    cell.scale.set(0.55, 1.0, 1.0);
    partA6BloodCells.add(cell);
    return { mesh: cell, off: i / 14, radOff: ((i % 3) - 1) * 0.011 };
  });
  subA.add(partA6BloodCells);

  // ================= SUB B: Safe Acid Dilution down Beaker Wall (6 Self-Building Parts!) =================
  const subB = new THREE.Group();
  subB.visible = false;
  root.add(subB);

  // Part 1: Acid-Resistant Lab Tray
  const partB1Base = new THREE.Group();
  const acidTray = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.018, 48), castBaseMat);
  acidTray.position.y = 0.016;
  partB1Base.add(acidTray);
  subB.add(partB1Base);

  // Part 2: Graduated Borosilicate Beaker
  const partB2Beaker = new THREE.Group();
  const beakerB = createLathedBeaker(0.165, 0.34, 0.008);
  beakerB.position.y = 0.025;
  partB2Beaker.add(beakerB);
  subB.add(partB2Beaker);

  // Part 3: Large Refractive Water Volume (absorbs dilution heat safely!)
  const partB3Water = new THREE.Group();
  const waterPoolMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8, transparent: true, opacity: 0.72, roughness: 0.05, clearcoat: 1.0,
  });
  const waterPool = new THREE.Mesh(new THREE.CylinderGeometry(0.153, 0.148, 0.19, 36), waterPoolMat);
  waterPool.position.y = 0.125;
  partB3Water.add(waterPool);
  subB.add(partB3Water);

  // Part 4: Immersed Safety Thermometer + Glass Guide Rod along Inner Wall
  const partB4Sensors = new THREE.Group();
  const guideRod = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.34, 12), chromeMat);
  guideRod.position.set(-0.142, 0.21, 0);
  guideRod.rotation.z = 0.04;
  const miniThermo = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.32, 14), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  miniThermo.position.set(0.11, 0.22, 0);
  const miniBulb = new THREE.Mesh(new THREE.SphereGeometry(0.018, 14, 12), new THREE.MeshPhysicalMaterial({ color: 0xe63946, clearcoat: 1.0 }));
  miniBulb.position.set(0.11, 0.065, 0);
  partB4Sensors.add(guideRod, miniThermo, miniBulb);
  subB.add(partB4Sensors);

  // Part 5: Tilted Amber Concentrated Acid Reagent Bottle with Hazard Band!
  const partB5AcidBottle = new THREE.Group();
  const bottleGroup = new THREE.Group();
  bottleGroup.position.set(-0.195, 0.415, 0);
  bottleGroup.rotation.z = -0.82;

  const amberGlassMat = new THREE.MeshPhysicalMaterial({ color: 0xd97706, transparent: true, opacity: 0.82, roughness: 0.08, clearcoat: 1.0 });
  const bBody = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.14, 24), amberGlassMat);
  const bNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.028, 0.055, 20), amberGlassMat);
  bNeck.position.y = 0.095;
  const hazardBand = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.037, 0.048, 24), new THREE.MeshStandardMaterial({ color: 0xffcb44, roughness: 0.35 }));
  bottleGroup.add(bBody, bNeck, hazardBand);
  partB5AcidBottle.add(bottleGroup);
  subB.add(partB5AcidBottle);

  // Part 6: Wall-Hugging Golden Acid Trickle + Safe Thermal Dispersion Rings!
  const partB6Trickle = new THREE.Group();
  const trickle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0055, 0.0045, 0.18, 12),
    new THREE.MeshBasicMaterial({ color: 0xffb703 })
  );
  trickle.position.set(-0.143, 0.265, 0);
  trickle.visible = false;

  const warmGlowRing = new THREE.Mesh(
    new THREE.RingGeometry(0.03, 0.12, 32),
    new THREE.MeshBasicMaterial({ color: 0xff9f1c, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
  );
  warmGlowRing.rotation.x = -Math.PI / 2;
  warmGlowRing.position.y = 0.222;
  partB6Trickle.add(trickle, warmGlowRing);
  subB.add(partB6Trickle);

  let packCracked = false;
  function crackPack() { if (subMode === 0) packCracked = true; }
  let subMode = 0, isHotPack = false, lastPaintedHot = false, prog = 0, clock = 0;

  const hsPack = createTouchHotspot(new THREE.Vector3(0, 0.135, 0.06), crackPack, 0.12, 0xffcb44);
  subA.add(hsPack);
  hotspots.push(hsPack);
  interactables.push(hsPack.userData.hitMesh);

  const badge = createArabicBadge("اضغط على الكمّادة لكسر جيب الماء ومراقبة الوعاء الدموي!", "#62e8ff", 0.46);
  badge.position.set(0, 0.50, 0);
  root.add(badge);

  emerge.addStage("sub0", partA1Tray,       { startSec: 0.24, durSec: 0.34, sinkDepth: 0.08, buildY: 0.03, spinRad: 0.12, caption: "قاعدة الفحص الطبي" });
  emerge.addStage("sub0", partA2Pouch,      { startSec: 0.54, durSec: 0.44, sinkDepth: 0.18, buildY: 0.12, spinRad: 0.20, caption: "الوسادة البوليمرية للكمّادة الفورية" });
  emerge.addStage("sub0", partA3Inner,      { startSec: 0.94, durSec: 0.40, sinkDepth: 0.18, buildY: 0.14, spinRad: 0.16, caption: "جيب الماء الداخلي والملصق الكيميائي" });
  emerge.addStage("sub0", partA4Supports,   { startSec: 1.30, durSec: 0.36, sinkDepth: 0.24, buildY: 0.22, spinRad: 0.18, caption: "حوامل المقطع التشريحي" });
  emerge.addStage("sub0", partA5Vessel,     { startSec: 1.62, durSec: 0.44, sinkDepth: 0.32, buildY: 0.28, spinRad: 0.22, caption: "جدار الوعاء الدموي المرن" });
  emerge.addStage("sub0", partA6BloodCells, { startSec: 2.02, durSec: 0.42, sinkDepth: 0.30, buildY: 0.28, spinRad: 0.14, caption: "سريان كرات الدم الحمراء داخل الوعاء!" });
  emerge.addPopup("sub0", hsPack,           { startSec: 2.38, durSec: 0.32 });
  emerge.addPopup("sub0", badge,            { startSec: 2.42, durSec: 0.32 });

  emerge.addStage("sub1", partB1Base,       { startSec: 0.24, durSec: 0.34, sinkDepth: 0.08, buildY: 0.03, spinRad: 0.12, caption: "صينية الأمان المعملي المقاومة للأحماض" });
  emerge.addStage("sub1", partB2Beaker,     { startSec: 0.54, durSec: 0.46, sinkDepth: 0.38, buildY: 0.32, spinRad: 0.20, caption: "الكأس الزجاجي المدرّج" });
  emerge.addStage("sub1", partB3Water,      { startSec: 0.96, durSec: 0.42, sinkDepth: 0.26, buildY: 0.22, spinRad: 0.14, caption: "حجم الماء الكافي لاستيعاب الحرارة" });
  emerge.addStage("sub1", partB4Sensors,    { startSec: 1.34, durSec: 0.42, sinkDepth: 0.38, buildY: 0.34, spinRad: 0.18, caption: "ساق التوجيه والترمومتر المعملي" });
  emerge.addStage("sub1", partB5AcidBottle, { startSec: 1.72, durSec: 0.46, sinkDepth: 0.52, buildY: 0.44, spinRad: 0.26, caption: "زجاجة الحمض المركّز على جدار الإناء" });
  emerge.addStage("sub1", partB6Trickle,    { startSec: 2.12, durSec: 0.36, sinkDepth: 0.34, buildY: 0.30, spinRad: 0.10, caption: "مسار التنقيط الآمن على الجدار الداخلي!" });
  emerge.addPopup("sub1", badge,            { startSec: 2.44, durSec: 0.32 });

  emerge.trigger("sub0");

  function triggerEmergence() { emerge.trigger(subMode === 0 ? "sub0" : "sub1"); }

  function setSubMode(idx) {
    subMode = idx;
    subA.visible = idx === 0;
    subB.visible = idx === 1;
    hsPack.visible = idx === 0;
    packCracked = false;
    prog = 0;
    emerge.trigger(idx === 0 ? "sub0" : "sub1");
  }

  function cycleSecondary() {
    if (subMode === 0) { isHotPack = !isHotPack; packCracked = false; prog = 0; }
    else { prog = 0; }
  }

  function update(dt, { heating = false } = {}) {
    clock += dt;
    const em = emerge.update(dt);
    const ready = !em.emerging;
    hotspots.forEach((h) => { if (h.visible && ready) h.userData.pulse(clock); });
    if (heating && ready) crackPack();
    if (ready && (subMode === 0 ? packCracked : heating)) prog = Math.min(1, prog + dt * 0.42);

    if (subMode === 0) {
      if (isHotPack !== lastPaintedHot) {
        lastPaintedHot = isHotPack;
        paintPackLabel(isHotPack);
        lblTex.needsUpdate = true;
      }
      pouchMat.color.setHex(isHotPack ? 0xff6b35 : 0x1ea8ec);
      pouch.scale.y = 1 - Math.sin(prog * Math.PI) * 0.18;
      blister.scale.setScalar(Math.max(0.2, 1 - prog * 0.75));

      const vRadiusScale = isHotPack ? 1 + prog * 0.42 : 1 - prog * 0.40;
      vesselGroup.scale.set(1, vRadiusScale, vRadiusScale);

      const flowSpeed = isHotPack ? 0.35 + prog * 0.45 : 0.35 - prog * 0.22;
      rbcs.forEach((c) => {
        const u = (clock * flowSpeed + c.off) % 1;
        c.mesh.position.set(-0.17 + u * 0.34, 0.245 + c.radOff * vRadiusScale, Math.sin(u * 8) * 0.008 * vRadiusScale);
        c.mesh.rotation.z = clock * 2.0 + c.off * 6;
      });

      badge.userData.setText(
        isHotPack
          ? "كمّادة ساخنة (MgSO₄ طارد) ← توسيع الأوعية وسرعة تدفّق الدم"
          : "كمّادة باردة (NH₄NO₃ ماص) ← تضييق الأوعية وتخفيف التورّم",
        isHotPack ? "#ff9f1c" : "#62e8ff"
      );

      return {
        progress: em.emerging ? em.overall : prog,
        event: prog > 0 ? "pack" : "",
        badge: "ص ١١ • الكمّادات الفورية",
        subTabs: ["١. الكمّادة الباردة والساخنة", "٢. أمان تخفيف الحمض المركّز"],
        subIndex: 0,
        buildPill: em.buildPill,
        stateText: em.emerging
          ? em.caption
          : isHotPack
            ? "كبريتات الماغنسيوم MgSO₄: ذوبان طارد للحرارة يوسّع الوعاء الدموي ويزيد تدفّق كرات الدم الحمراء لإراحة العضلات."
            : "نترات الأمونيوم NH₄NO₃: ذوبان ماص للحرارة يبرّد الموضع المصاب فيضيّق الوعاء الدموي ويخفّف التورّم.",
        holdLabel: prog >= 0.95 ? "✓ تفاعلت الكمّادة الفورية" : "👋 اضغط لكسر جيب الماء",
        secondaryLabel: isHotPack ? "❄️ للكمّادة الباردة" : "🔥 للكمّادة الساخنة",
        showTertiary: prog > 0.1,
        lift: em.overall,
      stepChime: em.stepChime,
        emerging: em.emerging,
      };
    }

    const pouring = heating && ready && prog < 0.98;
    trickle.visible = pouring;
    warmGlowRing.material.opacity = pouring ? 0.45 + 0.25 * Math.sin(clock * 10) : prog * 0.22;
    waterPoolMat.color.lerp(new THREE.Color(prog > 0.15 ? 0x64dfdf : 0x38bdf8), 0.08);
    badge.userData.setText("تنقيط الحمض المركّز تدريجيًا على جدار الإناء المحتوي على الماء", "#ffcb44");

    return {
      progress: em.emerging ? em.overall : prog,
      sound: pouring ? "water" : "", soundLevel: 0.42,
      badge: "ص ١١ • أمان التخفيف",
      subTabs: ["١. الكمّادة الباردة والساخنة", "٢. أمان تخفيف الحمض المركّز"],
      subIndex: 1,
      buildPill: em.buildPill,
      stateText: em.emerging
        ? em.caption
        : "يضيف المختص الحمض المركّز تدريجيًا على جدار الإناء المحتوي على الماء ليستوعب الماء الحرارة بأمان، لأن العكس يسبب غليانًا فوريًا وتناثرًا للحمض!",
      holdLabel: "🧪 نقّط الحمض على الجدار ببطء",
      secondaryLabel: "↺ إعادة التجربة",
      showTertiary: false,
      lift: em.overall,
      stepChime: em.stepChime,
      emerging: em.emerging,
    };
  }

  return { root, interactables, update, setLift: emerge.setLift, setSubMode, triggerEmergence, cycleSecondary, primaryAction: crackPack, reset: () => { packCracked = false; prog = 0; triggerEmergence(); } };
}
