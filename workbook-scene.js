import * as THREE from "three";

const loader = new THREE.TextureLoader();
// Centre of each tracked illustration in its printed A4 page, measured in PDF points.
const plates = {
  fridge: [3, 2, 269], calorimeter: [5, 4, 217],
  crystals: [8, 9, 252], packs: [11, 10, 217],
};

function pageMesh(pageNumber, width, depth, spineSide) {
  const paper = loader.load(`./assets/paper-${String(pageNumber).padStart(2, "0")}.webp`);
  paper.colorSpace = THREE.SRGBColorSpace;
  paper.anisotropy = 4;
  const geometry = new THREE.PlaneGeometry(width, depth, 24, 8);
  geometry.rotateX(-Math.PI / 2);
  const vertices = geometry.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), z = vertices.getZ(i);
    const fromSpine = 0.5 - spineSide * x / width;
    const bow = 0.017 * Math.sin(Math.PI * fromSpine) * Math.exp(-3 * fromSpine);
    const corner = 0.009 * Math.pow(fromSpine, 7) * Math.pow(2 * z / depth, 4);
    vertices.setY(i, 0.003 + bow + corner);
  }
  geometry.computeVertexNormals();
  const face = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    map: paper, color: 0xfffdfa, roughness: 0.96, metalness: 0, side: THREE.DoubleSide,
  }));
  face.receiveShadow = true;
  return face;
}

export function createOpenWorkbook(plateUrl) {
  const id = plateUrl.split("ar-plate-")[1].split(".")[0];
  const [page, facingPage, diagramY] = plates[id];
  const group = new THREE.Group();
  const width = 0.72, depth = width * 841.92 / 594.96;
  const side = page % 2 ? 1 : -1;
  const centerZ = (0.5 - diagramY / 841.92) * depth;
  const centerX = side * width / 2;
  const cover = new THREE.Mesh(new THREE.BoxGeometry(2 * width + 0.024, 0.009, depth + 0.021),
    new THREE.MeshStandardMaterial({color: 0x183c3d, roughness: 0.72}));
  cover.position.set(centerX, -0.012, centerZ);
  const edges = new THREE.Mesh(new THREE.BoxGeometry(2 * width, 0.009, depth),
    new THREE.MeshStandardMaterial({color: 0xe7ddc8, roughness: 0.95}));
  edges.position.set(centerX, -0.004, centerZ);
  const face = pageMesh(page, width, depth, side);
  const facing = pageMesh(facingPage, width, depth, -side);
  face.position.z = facing.position.z = centerZ;
  facing.position.x = side * width;
  group.add(cover, edges, face, facing);
  return group;
}

// A small animated water surface. Only its vertices move; the glass stays still.
export function createWaterSurface(radius) {
  const geometry = new THREE.RingGeometry(0.001, radius, 40, 7);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial({
    color: 0x78d6dd, roughness: 0.13, metalness: 0.12, clearcoat: 1,
    transparent: true, opacity: 0.68, depthWrite: false, side: THREE.DoubleSide,
  }));
  const positions = geometry.attributes.position;
  positions.setUsage(THREE.DynamicDrawUsage);
  let lastUpdate = -1;
  function animate(time, motion) {
    if (time - lastUpdate < 1 / 24) return;
    lastUpdate = time;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), z = positions.getZ(i);
      const r = Math.hypot(x, z) / radius;
      const wave = Math.sin(12 * r - 6 * time) + 0.5 * Math.sin(30 * x + 17 * z + time * 4);
      positions.setY(i, 0.003 * Math.pow(r, 8) + motion * 0.003 * wave * (1 - r * r));
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
  }
  return {mesh, animate};
}
