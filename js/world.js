import * as THREE from 'three';
import { ZONES } from './data.js';
import { makeLabel, mat } from './character.js';

export const ZP = ZONES.map((z, i) => ({ x: i * 70, z: i === 0 ? 0 : Math.sin(i * 1.1) * 26 }));
export const ZONE_R = 30;
export const gateX = (i) => (ZP[i - 1].x + ZP[i].x) / 2;
export const BOUNDS = { minX: -40, maxX: ZP[ZP.length - 1].x + 60, minZ: -70, maxZ: 70 };

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 8, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createWorld(scene) {
  const SKY = '#bfe3f5';
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 50, 140);
  scene.add(new THREE.HemisphereLight('#ffffff', '#8fbf7a', 1.05));
  const sun = new THREE.DirectionalLight('#fff3d6', 1.5);
  sun.position.set(40, 70, 30);
  scene.add(sun);

  const cx = (BOUNDS.minX + BOUNDS.maxX) / 2;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(BOUNDS.maxX - BOUNDS.minX + 240, 400), mat('#8fcf7a'));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(cx, 0, 0);
  scene.add(ground);

  const glow = glowTexture();
  ZONES.forEach((z, i) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(ZONE_R * 2.2, ZONE_R * 2.2),
      new THREE.MeshBasicMaterial({ color: z.color, map: glow, transparent: true, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(ZP[i].x, 0.02 + i * 0.001, ZP[i].z);
    scene.add(m);
  });

  // laluan
  for (let i = 1; i < ZP.length; i++) {
    const a = ZP[i - 1], b = ZP[i];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(len, 4), new THREE.MeshBasicMaterial({ color: '#d9c08f' }));
    p.rotation.x = -Math.PI / 2;
    p.rotation.z = Math.atan2(b.z - a.z, b.x - a.x);
    p.position.set((a.x + b.x) / 2, 0.035, (a.z + b.z) / 2);
    scene.add(p);
  }

  // hiasan
  const R = rng(7);
  const free = (x, z) => {
    for (const q of ZP) if (Math.hypot(x - q.x, z - q.z) < 11) return false;
    for (let i = 1; i < ZP.length; i++) if (segDist(x, z, ZP[i - 1].x, ZP[i - 1].z, ZP[i].x, ZP[i].z) < 4.5) return false;
    return true;
  };
  const place = (n, w = 1) => {
    const out = [];
    let guard = 0;
    while (out.length < n && guard++ < n * 40) {
      const x = BOUNDS.minX + R() * (BOUNDS.maxX - BOUNDS.minX);
      const z = BOUNDS.minZ + R() * (BOUNDS.maxZ - BOUNDS.minZ);
      if (free(x, z)) out.push([x, z]);
    }
    return out;
  };
  const zoneTint = (x) => {
    let bi = 0, bd = 1e9;
    ZP.forEach((q, i) => { const d = Math.abs(q.x - x); if (d < bd) { bd = d; bi = i; } });
    return ZONES[bi].jeli;
  };
  const dummy = new THREE.Object3D();
  const trees = place(520);
  const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(1.4, 3.2, 7), new THREE.MeshStandardMaterial({ roughness: 0.8 }), trees.length);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.3, 1.5, 6), mat('#7a5230'), trees.length);
  const col = new THREE.Color();
  trees.forEach(([x, z], i) => {
    const s = 0.8 + R() * 0.9;
    dummy.position.set(x, 0.75 * s, z); dummy.scale.set(s, s, s); dummy.rotation.set(0, R() * 6, 0); dummy.updateMatrix();
    trunk.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, (1.5 + 1.4) * s, z); dummy.updateMatrix();
    crown.setMatrixAt(i, dummy.matrix);
    col.set('#4fa05a').lerp(new THREE.Color(zoneTint(x)), 0.28);
    col.offsetHSL(0, 0, (R() - 0.5) * 0.08);
    crown.setColorAt(i, col);
  });
  scene.add(trunk, crown);

  const rocks = place(110);
  const rk = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.8, 0), mat('#9aa0a8'), rocks.length);
  rocks.forEach(([x, z], i) => {
    const s = 0.5 + R() * 1.3;
    dummy.position.set(x, 0.3 * s, z); dummy.scale.set(s, s * 0.7, s); dummy.rotation.set(R(), R() * 6, R()); dummy.updateMatrix();
    rk.setMatrixAt(i, dummy.matrix);
  });
  scene.add(rk);

  const flowers = place(420);
  const fl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 6, 5), new THREE.MeshStandardMaterial({ roughness: 0.6 }), flowers.length);
  const fcols = ['#ff7fa8', '#ffd84a', '#ffffff', '#9fd0ff'];
  flowers.forEach(([x, z], i) => {
    dummy.position.set(x, 0.16, z); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
    fl.setMatrixAt(i, dummy.matrix);
    fl.setColorAt(i, col.set(fcols[(R() * 4) | 0]));
  });
  scene.add(fl);

  // gunung latar
  for (let i = 0; i < 34; i++) {
    const x = BOUNDS.minX - 60 + R() * (BOUNDS.maxX - BOUNDS.minX + 140);
    const side = i % 2 ? 1 : -1;
    const m = new THREE.Mesh(new THREE.ConeGeometry(14 + R() * 14, 30 + R() * 30, 5), mat('#8fa7d8', { transparent: true, opacity: 0.8 }));
    m.position.set(x, 12, side * (95 + R() * 25));
    scene.add(m);
  }

  // kampung: rumah
  const houseSpots = [[-14, -12], [14, -14], [-16, 12], [16, 13], [0, -20]];
  houseSpots.forEach(([x, z], i) => {
    const g = new THREE.Group();
    g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(5, 3.2, 5), mat(['#f3e6c8', '#f7d9c4', '#dfeaf7'][i % 3])), { position: new THREE.Vector3(0, 1.6, 0) }));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.4, 2.4, 4), mat(['#c85a4a', '#4a7ac8', '#5ab07a'][i % 3]));
    roof.position.y = 4.4; roof.rotation.y = Math.PI / 4;
    g.add(roof);
    g.position.set(x, 0, z);
    scene.add(g);
  });

  // mercu tanda zon + nama
  const animated = [];
  ZONES.forEach((z, i) => {
    const g = new THREE.Group();
    g.position.set(ZP[i].x, 0, ZP[i].z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 0.6, 8), mat('#b9b4a8'));
    base.position.y = 0.3;
    g.add(base);
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.3, 0),
      new THREE.MeshStandardMaterial({ color: z.jeli, emissive: z.jeli, emissiveIntensity: 0.55, roughness: 0.25 })
    );
    crystal.position.y = 2.6;
    g.add(crystal);
    animated.push(crystal);
    const lab = makeLabel(z.ar, { px: 60, scale: 0.016, bg: 'rgba(30,40,90,0.78)' });
    lab.position.y = 5.2;
    g.add(lab);
    scene.add(g);
  });

  // gerbang (zon 2+) dengan penghalang
  const gates = {};
  for (let i = 2; i < ZP.length; i++) {
    const gx = gateX(i);
    const gz = (ZP[i - 1].z + ZP[i].z) / 2;
    const g = new THREE.Group();
    g.position.set(gx, 0, gz);
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1, 6, 1), mat('#b9b4a8'));
      p.position.set(0, 3, s * 4);
      g.add(p);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 9.5), mat('#8d887c'));
    lintel.position.y = 6.2;
    g.add(lintel);
    const lab = makeLabel(ZONES[i].ar, { px: 40, scale: 0.012, bg: 'rgba(120,30,40,0.8)' });
    lab.position.set(0, 8, 0);
    g.add(lab);
    const barrier = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 7),
      new THREE.MeshBasicMaterial({ color: '#ff4a4a', transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })
    );
    barrier.rotation.y = Math.PI / 2;
    barrier.position.set(0, 3.5, -gz);
    g.add(barrier);
    scene.add(g);
    gates[i] = { barrier, label: lab };
  }

  return {
    setLocked(i, locked) {
      const g = gates[i];
      if (g) { g.barrier.visible = locked; }
    },
    update(t) {
      animated.forEach((c, i) => { c.rotation.y = t * 0.8 + i; c.position.y = 2.6 + Math.sin(t * 1.6 + i) * 0.25; });
    },
  };
}
