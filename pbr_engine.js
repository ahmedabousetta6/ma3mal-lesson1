import * as THREE from "three";

/**
 * ============================================================================
 * PHOTOREALISTIC PBR & SHADER ENGINE FOR «مَعْمَل» 3D WebAR / VR LAB
 * - High-Definition 1024x512 Studio HDRI Reflection Map (Overhead Softboxes + Rim Lights)
 * - Custom GLSL Volumetric Turbulent Bunsen Flame Shader
 * - Holographic 3D-Print Blueprint Scan Ring & Wireframe Construction Helpers
 * - Double-Walled Lathed Borosilicate Glassware with Refractive Rim & Meniscus
 * - Procedural Cellular Styrofoam, Brushed Steel, Copper Tubing, Frost & Faceted Crystal Materials
 * - Sculpted Pillow Pouch Geometry & High-DPI Floating Arabic Callouts
 * ============================================================================
 */

export function createStudioEnvMap(renderer) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  const sky = ctx.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0.0, "#ffffff");
  sky.addColorStop(0.14, "#dff4ff");
  sky.addColorStop(0.34, "#5d4b9c");
  sky.addColorStop(0.50, "#191132");
  sky.addColorStop(0.72, "#2f2054");
  sky.addColorStop(1.0, "#0b0718");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1024, 512);

  const box = (x, y, w, h, col, blur = 26) => {
    ctx.save();
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = blur;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  };
  // Bright studio softboxes & crisp specular vertical strips for realistic glass & metal reflections
  box(58, 24, 210, 150, "rgba(255, 250, 236, 0.99)", 36);
  box(328, 36, 46, 250, "rgba(255, 255, 255, 0.96)", 16);
  box(520, 22, 240, 148, "rgba(165, 242, 255, 0.97)", 34);
  box(820, 44, 128, 196, "rgba(255, 206, 115, 0.92)", 28);
  box(968, 38, 32, 240, "rgba(125, 226, 209, 0.90)", 14);

  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromEquirectangular(tex);
  const env = target.texture;
  env.userData.renderTarget = target;
  tex.dispose();
  pmrem.dispose();
  return env;
}

export function attachLabLighting(parentGroup) {
  const hemi = new THREE.HemisphereLight(0xeaf6fa, 0x71583f, 0.85);
  hemi.position.set(0, 2.2, 0);
  parentGroup.add(hemi);

  const key = new THREE.DirectionalLight(0xffefd8, 1.75);
  key.position.set(0.95, 1.95, 1.25);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.15;
  key.shadow.camera.far = 4.0;
  key.shadow.camera.left = -0.85;
  key.shadow.camera.right = 0.85;
  key.shadow.camera.top = 0.95;
  key.shadow.camera.bottom = -0.65;
  key.shadow.bias = -0.0005;
  key.target = parentGroup;
  parentGroup.add(key);

  const rim = new THREE.DirectionalLight(0xc3e3f5, 0.86);
  rim.position.set(-1.2, 1.15, -0.95);
  rim.target = parentGroup;
  parentGroup.add(rim);

  const fill = new THREE.DirectionalLight(0xffdebb, 0.36);
  fill.position.set(-0.6, 0.45, 1.1);
  fill.target = parentGroup;
  parentGroup.add(fill);
}

let cachedShadowTex = null;
export function createContactShadow(size = 0.95) {
  if (!cachedShadowTex) {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const g = c.getContext("2d");
    const rad = g.createRadialGradient(128, 128, 14, 128, 128, 124);
    rad.addColorStop(0, "rgba(8, 5, 22, 0.84)");
    rad.addColorStop(0.52, "rgba(8, 5, 22, 0.40)");
    rad.addColorStop(1, "rgba(8, 5, 22, 0)");
    g.fillStyle = rad;
    g.fillRect(0, 0, 256, 256);
    cachedShadowTex = new THREE.CanvasTexture(c);
  }
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: cachedShadowTex, transparent: true, depthWrite: false })
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.001;
  return plane;
}

let cachedPuffTex = null;
export function getSoftPuffTexture() {
  if (!cachedPuffTex) {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const g = c.getContext("2d");
    const rad = g.createRadialGradient(64, 64, 4, 64, 64, 60);
    rad.addColorStop(0, "rgba(245, 253, 255, 0.78)");
    rad.addColorStop(0.42, "rgba(205, 242, 255, 0.36)");
    rad.addColorStop(1, "rgba(205, 242, 255, 0)");
    g.fillStyle = rad;
    g.fillRect(0, 0, 128, 128);
    cachedPuffTex = new THREE.CanvasTexture(c);
  }
  return cachedPuffTex;
}

let cachedBrushBump = null;
export function createBrushedMetalMaterial(colorHex, roughness = 0.2, metalness = 0.92) {
  if (!cachedBrushBump) {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "#808080";
    g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y++) {
      const v = 106 + ((y * 41 + (y % 5) * 9) % 44);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(0, y, 256, 1);
    }
    cachedBrushBump = new THREE.CanvasTexture(c);
    cachedBrushBump.wrapS = cachedBrushBump.wrapT = THREE.RepeatWrapping;
  }
  return new THREE.MeshPhysicalMaterial({
    color: colorHex,
    roughness,
    metalness,
    clearcoat: 0.35,
    clearcoatRoughness: 0.22,
    bumpMap: cachedBrushBump,
    bumpScale: 0.0035,
  });
}

let cachedFoamBump = null;
export function createStyrofoamMaterial(colorHex = 0xfcfaf4) {
  if (!cachedFoamBump) {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "#d8d8d8";
    g.fillRect(0, 0, 256, 256);
    for (let y = 6; y < 256; y += 12) {
      for (let x = 6; x < 256; x += 12) {
        const ox = ((y * 7) % 5) - 2;
        const oy = ((x * 11) % 5) - 2;
        g.strokeStyle = "#969696";
        g.lineWidth = 1.4;
        g.beginPath();
        g.arc(x + ox, y + oy, 5.2, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = "#efefef";
        g.beginPath();
        g.arc(x + ox - 1, y + oy - 1, 3.2, 0, Math.PI * 2);
        g.fill();
      }
    }
    cachedFoamBump = new THREE.CanvasTexture(c);
    cachedFoamBump.wrapS = cachedFoamBump.wrapT = THREE.RepeatWrapping;
    cachedFoamBump.repeat.set(3, 2);
  }
  return new THREE.MeshPhysicalMaterial({
    color: colorHex,
    roughness: 0.62,
    metalness: 0.02,
    sheen: 0.35,
    sheenColor: new THREE.Color(0xffffff),
    bumpMap: cachedFoamBump,
    bumpScale: 0.0045,
    side: THREE.DoubleSide,
  });
}

export function createOakWoodMaterial() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "#9e6b3b";
  g.fillRect(0, 0, 512, 512);
  const grain = g.createImageData(512, 512);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const sweep = y + 7 * Math.sin(x / 113 + y / 70) + 2 * Math.sin(x / 35);
    const v = 6 * Math.sin(sweep * 0.30) + 3 * Math.sin(sweep * 0.78) + 1.3 * Math.sin(x * 19.7 + y * 12.1);
    const i = (y * 512 + x) * 4;
    grain.data.set([119 + v, 86 + v * 0.8, 57 + v * 0.6, 255],i);
  }
  g.putImageData(grain,0,0);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({
    map,
    bumpMap: map,
    bumpScale: 0.00065,
    roughness: 0.62,
    metalness: 0.05,
  });
}

export function createWireGauzeMaterial() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#485063";
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#b0bad0";
  g.lineWidth = 2.4;
  for (let i = 0; i <= 256; i += 8) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
  }
  const rad = g.createRadialGradient(128, 128, 10, 128, 128, 86);
  rad.addColorStop(0, "#faf7f0");
  rad.addColorStop(0.78, "#ded8c8");
  rad.addColorStop(1, "rgba(220,214,198,0)");
  g.fillStyle = rad;
  g.beginPath();
  g.arc(128, 128, 86, 0, Math.PI * 2);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({
    map: tex,
    bumpMap: tex,
    bumpScale: 0.005,
    roughness: 0.52,
    metalness: 0.52,
    emissive: new THREE.Color(0x000000),
  });
}

/**
 * Detailed Brass Laboratory Bunsen Burner with Base, Gas Side-Tube, Air Collar, Barrel & Volumetric Flame!
 */
export function createDetailedBunsenBurner(flameScale = 0.72) {
  const group = new THREE.Group();
  const castIronMat = createBrushedMetalMaterial(0x28263d, 0.42, 0.78);
  const brassMat = createBrushedMetalMaterial(0xebb852, 0.2, 0.92);
  const copperMat = createBrushedMetalMaterial(0xd97b43, 0.24, 0.88);

  const heavyBase = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.078, 0.018, 28), castIronMat);
  heavyBase.position.y = 0.011;
  heavyBase.castShadow = true;

  const brassPedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.036, 0.024, 24), brassMat);
  brassPedestal.position.y = 0.03;

  const gasNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.065, 14), copperMat);
  gasNozzle.rotation.z = Math.PI / 2 - 0.15;
  gasNozzle.position.set(-0.042, 0.03, 0);

  const hoseStub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0075, 0.0075, 0.05, 14),
    new THREE.MeshStandardMaterial({ color: 0xc93b4b, roughness: 0.65 })
  );
  hoseStub.rotation.z = Math.PI / 2;
  hoseStub.position.set(-0.085, 0.024, 0);

  const airCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.022, 24), copperMat);
  airCollar.position.y = 0.048;

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.058, 24), brassMat);
  barrel.position.y = 0.082;
  barrel.castShadow = true;

  const crown = new THREE.Mesh(new THREE.TorusGeometry(0.0145, 0.0028, 10, 24), copperMat);
  crown.rotation.x = Math.PI / 2;
  crown.position.y = 0.111;

  const flame = createRealisticFlameAssembly(flameScale);
  flame.position.y = 0.112;

  group.add(heavyBase, brassPedestal, gasNozzle, hoseStub, airCollar, barrel, crown, flame);
  group.userData.flame = flame;
  return group;
}

export function createRealisticFlameAssembly(scale = 1.0) {
  const group = new THREE.Group();

  const vertexShader = `
    uniform float uTime;
    uniform float uIntensity;
    uniform float uOxygen;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vec3 pos = position;
      float h = clamp(uv.y, 0.0, 1.0);
      float swayAmp = mix(0.016, 0.004, uOxygen) * h * uIntensity;
      pos.x += sin(uTime * 15.0 + h * 7.0) * swayAmp;
      pos.z += cos(uTime * 13.0 + h * 6.0) * swayAmp;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const fragmentShader = `
    uniform float uTime;
    uniform float uIntensity;
    uniform float uOxygen;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
      );
    }
    float fbm(vec2 p) {
      float v = 0.0;
      v += 0.55 * noise(p);
      v += 0.30 * noise(p * 2.15 + 3.1);
      v += 0.15 * noise(p * 4.4 - 1.7);
      return v;
    }

    void main() {
      if (uIntensity <= 0.01) discard;
      float y = vUv.y;
      float x = abs(vUv.x - 0.5) * 2.0;

      float widthProfile = pow(1.0 - y, mix(0.60, 0.84, uOxygen));
      float speed = mix(4.8, 10.0, uOxygen);
      float n = fbm(vec2(vUv.x * 4.5, y * 4.0 - uTime * speed));

      float shape = (1.0 - x / max(0.08, widthProfile)) + (n - 0.5) * mix(0.52, 0.24, uOxygen) * y;
      float alpha = smoothstep(0.0, 0.42, shape) * smoothstep(1.0, 0.70, y) * smoothstep(0.0, 0.07, y);

      float innerCone = smoothstep(0.48, 0.0, y) * smoothstep(0.55, 0.04, x);

      vec3 yellowOuter = mix(vec3(1.0, 0.28, 0.03), vec3(1.0, 0.90, 0.35), clamp(shape * 0.9 + 0.2, 0.0, 1.0));
      yellowOuter = mix(yellowOuter, vec3(0.25, 0.70, 1.0), innerCone * 0.65);

      vec3 blueJet = mix(vec3(0.08, 0.38, 1.0), vec3(0.45, 0.96, 1.0), clamp(innerCone * 1.35 + shape * 0.35, 0.0, 1.0));
      blueJet = mix(blueJet, vec3(0.90, 0.99, 1.0), innerCone * 0.80);

      vec3 col = mix(yellowOuter, blueJet, uOxygen);
      float finalAlpha = clamp(alpha * uIntensity * mix(0.96, 0.92, uOxygen), 0.0, 1.0);
      if (finalAlpha < 0.01) discard;
      gl_FragColor = vec4(col * 1.35, finalAlpha);
    }
  `;

  const uniforms = {
    uTime: { value: 0 },
    uIntensity: { value: 0 },
    uOxygen: { value: 0.78 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const planeGeo = new THREE.PlaneGeometry(0.115 * scale, 0.165 * scale, 8, 16);
  planeGeo.translate(0, 0.082 * scale, 0);
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(planeGeo, mat);
    m.rotation.y = (i * Math.PI) / 3;
    group.add(m);
  }

  const flameLight = new THREE.PointLight(0x4cc9f0, 0, 0.55);
  flameLight.position.set(0, 0.07 * scale, 0);
  group.add(flameLight);

  group.userData.update = (time, intensity, oxygenMix = 0.78) => {
    uniforms.uTime.value = time;
    uniforms.uIntensity.value = intensity;
    uniforms.uOxygen.value = oxygenMix;
    flameLight.intensity = intensity * 0.85;
    group.visible = intensity > 0.01;
  };
  return group;
}

/**
 * Double-Walled Lathed Borosilicate Glass Beaker with Rim Highlight & Volumetric Graduations
 */
export function createLathedBeaker(radius = 0.175, height = 0.4, wall = 0.008) {
  const group = new THREE.Group();
  const pts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(radius * 0.92, 0),
    new THREE.Vector2(radius, 0.022),
    new THREE.Vector2(radius, height - 0.015),
    new THREE.Vector2(radius + 0.014, height),
    new THREE.Vector2(radius + 0.007, height + 0.007),
    new THREE.Vector2(radius - wall, height - 0.012),
    new THREE.Vector2(radius - wall, 0.024),
    new THREE.Vector2(radius * 0.88, 0.012),
    new THREE.Vector2(0.001, 0.012),
  ];
  const latheGeo = new THREE.LatheGeometry(pts, 56);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xeaf9ff,
    transparent: true,
    opacity: 0.33,
    roughness: 0.03,
    metalness: 0.04,
    ior: 1.52,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    reflectivity: 1.0,
    specularIntensity: 1.0,
    depthWrite: false,
  });
  const beakerMesh = new THREE.Mesh(latheGeo, glassMat);
  group.add(beakerMesh);

  // Specular top glass rim torus so the beaker opening gleams realistically
  const lipRing = new THREE.Mesh(
    new THREE.TorusGeometry(radius + 0.006, 0.0045, 12, 48),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.58,
      roughness: 0.02,
      clearcoat: 1.0,
      depthWrite: false,
    })
  );
  lipRing.rotation.x = Math.PI / 2;
  lipRing.position.y = height + 0.002;
  group.add(lipRing);

  const sc = document.createElement("canvas");
  sc.width = 256;
  sc.height = 256;
  const g = sc.getContext("2d");
  g.strokeStyle = "rgba(255,255,255,0.9)";
  g.fillStyle = "rgba(255,255,255,0.9)";
  g.lineWidth = 3.2;
  g.font = "bold 17px sans-serif";
  for (let i = 1; i <= 6; i++) {
    const py = 240 - i * 32;
    const w = i % 2 === 0 ? 64 : 36;
    g.beginPath();
    g.moveTo(86, py);
    g.lineTo(86 + w, py);
    g.stroke();
    if (i % 2 === 0) {
      g.fillText(`${i * 50} mL`, 156, py + 5);
    }
  }
  const decalTex = new THREE.CanvasTexture(sc);
  const decalCyl = new THREE.Mesh(
    new THREE.CylinderGeometry(radius + 0.0012, radius + 0.0012, height * 0.84, 32, 1, true, -0.65, 1.3),
    new THREE.MeshBasicMaterial({ map: decalTex, transparent: true, depthWrite: false, side: THREE.DoubleSide })
  );
  decalCyl.position.y = height * 0.48;
  group.add(decalCyl);

  return group;
}

/**
 * Sculpted 3D Cushioned Medical Gel/Salt Pack Geometry (Pillowed center + crimped heat-sealed border!)
 */
export function createCushionedPackGeometry(width = 0.34, depth = 0.24, maxThickness = 0.085) {
  const geo = new THREE.BoxGeometry(width, maxThickness, depth, 28, 6, 22);
  const pos = geo.attributes.position;
  const hw = width / 2;
  const hd = depth / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.min(1, Math.abs(x) / hw);
    const nz = Math.min(1, Math.abs(z) / hd);
    // Smooth cosine pillow dome that pinches down to a thin crimped border at the outer 12%
    const edgeX = Math.cos(nx * Math.PI * 0.5);
    const edgeZ = Math.cos(nz * Math.PI * 0.5);
    const dome = Math.pow(Math.max(0, edgeX * edgeZ), 0.58);
    const crimp = (nx > 0.88 || nz > 0.86) ? 0.08 + 0.02 * Math.sin((x + z) * 180) : dome;
    pos.setY(i, y * crimp);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Crisp High-DPI 3D Floating Arabic Pill Badge
 */
export function createArabicBadge(text, accentColor = "#ffcb44", scaleWidth = 0.38) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  function paint(label, accent) {
    ctx.clearRect(0, 0, 768, 128);
    ctx.beginPath();
    ctx.roundRect(14, 14, 740, 100, 50);
    ctx.fillStyle = "rgba(20, 13, 42, 0.92)";
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = accent;
    ctx.stroke();

    ctx.direction = "rtl";
    let fontSize = 33;
    ctx.font = `bold ${fontSize}px Tahoma, 'Segoe UI', system-ui, sans-serif`;
    while (ctx.measureText(label).width > 688 && fontSize > 19) {
      fontSize -= 2;
      ctx.font = `bold ${fontSize}px Tahoma, 'Segoe UI', system-ui, sans-serif`;
    }
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 384, 65);
  }

  paint(text, accentColor);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
  );
  sprite.scale.set(scaleWidth, scaleWidth * (128 / 768), 1);
  sprite.renderOrder = 25;

  let curT = text, curA = accentColor;
  sprite.userData.setText = (nextT, nextA = curA) => {
    if (nextT === curT && nextA === curA) return;
    curT = nextT;
    curA = nextA;
    paint(nextT, nextA);
    tex.needsUpdate = true;
  };
  return sprite;
}

/**
 * Interactive 3D Touch Hotspot (Pulsing Dual Ring + Invisible Raycast Collider)
 */
export function createTouchHotspot(position, onTapCallback, hitRadius = 0.095, colorHex = 0xffcb44) {
  const group = new THREE.Group();
  group.position.copy(position);

  const ringMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
    depthTest: false,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.02, 0.031, 28), ringMat);
  ring.renderOrder = 22;

  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.01, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false })
  );
  dot.renderOrder = 23;

  const hitMesh = new THREE.Mesh(
    new THREE.SphereGeometry(hitRadius, 10, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitMesh.userData.onTap = onTapCallback;

  group.add(ring, dot, hitMesh);
  group.userData.hitMesh = hitMesh;
  group.userData.pulse = (clock) => {
    const s = 1 + 0.24 * Math.sin(clock * 4.8);
    ring.scale.setScalar(s);
    if (ring.parent) {
      ring.lookAt(ring.parent.localToWorld(new THREE.Vector3(0, 0.2, 1)));
    }
  };
  return group;
}
