import * as THREE from 'three';

export const SKINS = ['#ffe3cf', '#f6caa3', '#e0a878', '#c18559', '#8a5a3c'];
export const HAIRS = ['#4a2f1b', '#1f1a17', '#8b5a2b', '#d1a94b', '#4a3470', '#a3334a', '#2f6b4f', '#2c4f9a'];

// Palet mengikut gambar rujukan (Priest, Knight, Assassin, Mage, Hunter, Blacksmith).
export const CLASSES = {
  novice:     { name: 'Novice',     ar: 'مبتدئ',  body: '#e9dfc4', trim: '#b89b5e', cover: '#e9dfc4', pants: '#8a7a5a', boot: '#5a4330', sleeve: '#e9dfc4', quote: 'Setiap perjalanan bermula dengan satu langkah.', bonus: 'Belum ada bonus. Capai Lv 5 untuk tukar job.' },
  priest:     { name: 'Priest',     ar: 'كاهن',   body: '#f4f1ee', trim: '#2f5fbf', cover: '#ffffff', pants: '#f4f1ee', boot: '#3a2a22', sleeve: '#f4f1ee', skirt: '#f4f1ee', quote: 'Doa adalah kekuatan sejati.', bonus: 'Pulih 6 HP setiap jawapan betul.' },
  knight:     { name: 'Knight',     ar: 'فارس',   body: '#3a63c4', trim: '#c0c6d0', cover: '#dfe5f2', pants: '#5a5f6a', boot: '#8b909a', sleeve: '#3a63c4', quote: 'Melindungi yang lemah.', bonus: 'Jawapan salah hanya kurangkan 8 HP (biasa 15).' },
  assassin:   { name: 'Assassin',   ar: 'قناص',   body: '#4a3a46', trim: '#a02338', cover: '#2d2630', pants: '#2d2630', boot: '#5a3a28', sleeve: '#4a3a46', quote: 'Bayangan yang tak pernah terlihat.', bonus: '+30% XP setiap jawapan betul.' },
  mage:       { name: 'Mage',       ar: 'ساحر',   body: '#5b3fb0', trim: '#d8b45a', cover: '#3b2a73', pants: '#3b2a73', boot: '#3a2a22', sleeve: '#5b3fb0', skirt: '#5b3fb0', quote: 'Ilmu pengetahuan adalah cahaya.', bonus: 'Cahaya Ilmu: satu pilihan salah disingkirkan setiap soalan.' },
  hunter:     { name: 'Hunter',     ar: 'صياد',   body: '#6b4a32', trim: '#6b8f4e', cover: '#4d7a45', pants: '#3a3028', boot: '#5a3a28', sleeve: '#6b4a32', quote: 'Alam adalah rumah kami.', bonus: 'Selepas 3 betul berturut-turut, XP dua kali ganda.' },
  blacksmith: { name: 'Blacksmith', ar: 'حداد',   body: '#7a4f3a', trim: '#8a2f46', cover: '#a8324f', pants: '#3a2a28', boot: '#4a3322', sleeve: '#f1ece4', skirt: '#7a3b4a', quote: 'Kekuatan lahir dari ketekunan.', bonus: 'Dapat +3 XP walaupun jawapan salah (ketekunan).' },
};

const mats = {};
export const mat = (c, o) => {
  const k = c + (o ? JSON.stringify(o) : '');
  return mats[k] || (mats[k] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0, ...o }));
};
const mesh = (geom, m, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(geom, m);
  o.position.set(x, y, z);
  return o;
};
const S = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
const CY = (a, b, h, s = 10) => new THREE.CylinderGeometry(a, b, h, s);
const BX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const GOLD = () => mat('#e2b94a', { metalness: 0.5, roughness: 0.35 });
const SILVER = () => mat('#cfd4de', { metalness: 0.55, roughness: 0.35 });

function orb(color) {
  return mesh(S(0.14, 14, 10), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.3 }));
}

function buildWeapon(cls) {
  const w = new THREE.Group();
  if (cls === 'priest' || cls === 'mage') {
    const orbColor = cls === 'priest' ? '#4a8fff' : '#a45cff';
    w.add(mesh(CY(0.035, 0.035, 1.9, 8), GOLD(), 0, 0.45, 0));
    const o = orb(orbColor); o.position.y = 1.5; w.add(o);
    const ring = mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 16), GOLD(), 0, 1.5, 0); w.add(ring);
    w.add(mesh(new THREE.ConeGeometry(0.06, 0.2, 6), GOLD(), 0, 1.78, 0));
  } else if (cls === 'knight') {
    w.rotation.x = -1.2;
    w.add(mesh(BX(0.09, 0.8, 0.025), SILVER(), 0, 0.5, 0));
    w.add(mesh(BX(0.3, 0.05, 0.06), GOLD(), 0, 0.1, 0));
    w.add(mesh(CY(0.025, 0.025, 0.18, 6), mat('#5a3a28'), 0, 0, 0));
  } else if (cls === 'assassin') {
    w.rotation.x = -1.3;
    w.add(mesh(BX(0.06, 0.5, 0.02), SILVER(), 0, 0.3, 0));
    w.add(mesh(CY(0.022, 0.022, 0.14, 6), mat('#3a2a22'), 0, -0.02, 0));
  } else if (cls === 'hunter') {
    const bow = mesh(new THREE.TorusGeometry(0.55, 0.025, 6, 20, Math.PI), mat('#7a5230'), 0, 0.3, 0);
    bow.rotation.z = -Math.PI / 2;
    w.add(bow);
    w.add(mesh(CY(0.006, 0.006, 1.1, 4), mat('#eeeeee'), -0.0, 0.3, 0));
  } else if (cls === 'blacksmith') {
    w.add(mesh(CY(0.04, 0.04, 1.1, 8), mat('#7a5230'), 0, 0.3, 0));
    w.add(mesh(BX(0.4, 0.2, 0.2), mat('#8a8f99', { metalness: 0.6, roughness: 0.4 }), 0, 0.85, 0));
  } else {
    w.add(mesh(CY(0.03, 0.03, 0.7, 6), mat('#8a6a3a'), 0, 0.2, 0));
  }
  return w;
}

export function buildAvatar(look, cls = 'novice') {
  const C = CLASSES[cls] || CLASSES.novice;
  const female = look.sex === 'f';
  const covered = (female && !!look.hijab) || cls === 'assassin';
  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);
  const skin = mat(SKINS[(look.skin | 0) % SKINS.length]);
  const hairCol = HAIRS[(look.hair | 0) % HAIRS.length];

  // kaki
  const legs = [];
  for (const s of [-1, 1]) {
    const l = new THREE.Group();
    l.position.set(s * 0.13, 0.46, 0);
    l.add(mesh(CY(0.085, 0.08, 0.4, 8), mat(C.pants), 0, -0.2, 0));
    l.add(mesh(BX(0.19, 0.13, 0.3), mat(C.boot), 0, -0.42, 0.04));
    rig.add(l);
    legs.push(l);
  }

  // badan
  const bodyH = 0.62;
  rig.add(mesh(CY(0.25, 0.3, bodyH, 12), mat(C.body), 0, 0.46 + bodyH / 2, 0));
  if (C.skirt) rig.add(mesh(CY(0.3, 0.56, 0.62, 16), mat(C.skirt), 0, 0.38, 0));
  rig.add(mesh(CY(0.31, 0.31, 0.07, 14), mat(C.trim), 0, 0.64, 0));
  const emblem = mesh(BX(0.11, 0.11, 0.02), GOLD(), 0, 0.98, 0.27);
  emblem.rotation.z = Math.PI / 4;
  rig.add(emblem);

  // armor / apron / beg
  if (cls === 'knight') {
    rig.add(mesh(CY(0.27, 0.31, 0.4, 12), mat('#c9ced8', { metalness: 0.5, roughness: 0.4 }), 0, 0.96, 0));
    rig.add(mesh(CY(0.24, 0.24, 0.05, 12), mat('#3a63c4'), 0, 0.78, 0));
    for (const s of [-1, 1]) rig.add(mesh(S(0.14, 10, 8), SILVER(), s * 0.34, 1.12, 0));
  }
  if (cls === 'blacksmith') {
    rig.add(mesh(BX(0.42, 0.56, 0.04), mat('#6a4a3a'), 0, 0.86, 0.29));
    rig.add(mesh(BX(0.46, 0.06, 0.05), mat('#3a2a22'), 0, 0.62, 0.3));
  }
  if (cls === 'hunter') rig.add(mesh(CY(0.3, 0.45, 0.35, 12), mat('#4d7a45'), 0, 1.1, -0.02));
  if (cls === 'novice') rig.add(mesh(BX(0.3, 0.36, 0.15), mat('#8a6a3a'), 0, 0.9, -0.3));
  if (cls === 'assassin') {
    for (const s of [-1, 1]) rig.add(mesh(BX(0.12, 0.14, 0.1), mat('#5a3a28'), s * 0.3, 0.62, 0.12));
  }

  // jubah belakang
  const capeCol = { knight: '#3a63c4', assassin: '#a02338', hunter: '#4d7a45' }[cls];
  if (capeCol) {
    const cape = mesh(BX(0.62, 0.95, 0.05), mat(capeCol), 0, 0.95, -0.3);
    cape.rotation.x = 0.1;
    rig.add(cape);
  }
  if (cls === 'hunter') {
    const q = new THREE.Group();
    q.position.set(0.16, 1.0, -0.36);
    q.rotation.z = 0.3;
    q.add(mesh(CY(0.08, 0.07, 0.5, 8), mat('#5a3a28')));
    for (let i = 0; i < 3; i++) q.add(mesh(CY(0.01, 0.01, 0.3, 4), mat('#d9c9a0'), -0.03 + i * 0.03, 0.35, 0));
    rig.add(q);
  }

  // tangan
  const arms = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group();
    a.position.set(s * 0.34, 1.05, 0);
    a.add(mesh(CY(0.07, 0.065, 0.4, 8), mat(C.sleeve), 0, -0.18, 0));
    a.add(mesh(S(0.075, 10, 8), skin, 0, -0.4, 0));
    rig.add(a);
    arms.push(a);
  }
  const weapon = buildWeapon(cls);
  weapon.position.set(0, -0.4, 0.04);
  arms[1].add(weapon);
  if (cls === 'knight') {
    const shield = new THREE.Group();
    shield.position.set(-0.1, -0.3, 0.12);
    const disc = mesh(CY(0.34, 0.3, 0.07, 6), mat('#3a63c4'));
    disc.rotation.x = Math.PI / 2;
    shield.add(disc);
    const rim = mesh(new THREE.TorusGeometry(0.31, 0.03, 6, 6), SILVER(), 0, 0, 0.04);
    shield.add(rim);
    const cross = mesh(BX(0.08, 0.36, 0.02), GOLD(), 0, 0, 0.06);
    const cross2 = mesh(BX(0.26, 0.08, 0.02), GOLD(), 0, 0.04, 0.06);
    shield.add(cross, cross2);
    arms[0].add(shield);
  }

  // kepala
  const head = new THREE.Group();
  head.position.y = 1.5;
  rig.add(head);
  const ez = covered ? 0.445 : 0.365;
  const ey = covered ? -0.045 : -0.02;
  if (covered) {
    const col = cls === 'novice' && look.hijab ? C.cover : C.cover;
    const shell = mesh(S(0.47, 20, 14), mat(col), 0, 0.04, -0.04);
    shell.scale.set(1, 1.03, 1.02);
    head.add(shell);
    const face = mesh(S(0.37, 20, 14), skin, 0, -0.03, 0.14);
    face.scale.set(1, 1.02, 0.85);
    head.add(face);
    if (female) {
      const drape = mesh(CY(0.34, 0.62, 0.62, 18), mat(col), 0, -0.5, -0.04);
      head.add(drape);
    }
  } else {
    head.add(mesh(S(0.4, 20, 14), skin));
    const hair = mesh(new THREE.SphereGeometry(0.44, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(hairCol), 0, 0.02, -0.03);
    hair.rotation.x = -0.5;
    head.add(hair);
    const fringe = mesh(S(0.2, 12, 8), mat(hairCol), 0, 0.27, 0.27);
    fringe.scale.set(1.6, 0.6, 0.8);
    head.add(fringe);
    if (female) {
      const back = mesh(S(0.4, 14, 10), mat(hairCol), 0, -0.22, -0.2);
      back.scale.set(1, 1.35, 0.7);
      head.add(back);
    } else {
      const tuft = mesh(new THREE.ConeGeometry(0.1, 0.25, 6), mat(hairCol), 0, 0.5, 0.05);
      tuft.rotation.x = 0.3;
      head.add(tuft);
    }
  }
  // mata + pipi + mulut
  for (const s of [-1, 1]) {
    const eye = mesh(S(0.058, 10, 8), mat('#2a1a14'), s * 0.14, ey, ez);
    eye.scale.set(1, 1.35, 0.5);
    const hl = mesh(S(0.02, 6, 6), mat('#ffffff'), 0.02, 0.035, 0.03);
    eye.add(hl);
    head.add(eye);
    const blush = mesh(S(0.05, 8, 6), mat('#ff8f8f', { transparent: true, opacity: 0.5 }), s * 0.24, ey - 0.09, ez - 0.07);
    blush.scale.set(1, 0.6, 0.3);
    head.add(blush);
  }
  head.add(mesh(BX(0.07, 0.015, 0.01), mat('#8a3a3a'), 0, ey - 0.13, ez - 0.01));

  // hiasan kepala ikut job
  if (cls === 'mage') {
    const hat = new THREE.Group();
    hat.position.set(0, 0.34, 0);
    hat.add(mesh(CY(0.66, 0.66, 0.04, 20), mat('#4b3395')));
    hat.add(mesh(new THREE.ConeGeometry(0.34, 0.75, 14), mat('#5b3fb0'), 0, 0.38, 0));
    hat.add(mesh(CY(0.345, 0.36, 0.08, 14), mat('#d8b45a'), 0, 0.06, 0));
    head.add(hat);
  }
  if (cls === 'priest') {
    const star = mesh(BX(0.09, 0.09, 0.02), GOLD(), 0, 0.3, 0.38);
    star.rotation.z = Math.PI / 4;
    head.add(star);
  }
  if (cls === 'blacksmith') {
    for (const s of [-1, 1]) {
      head.add(mesh(new THREE.TorusGeometry(0.075, 0.022, 6, 14), mat('#7a5a3a', { metalness: 0.4 }), s * 0.11, 0.33, 0.33));
      head.add(mesh(S(0.06, 8, 6), mat('#8fe0ff', { transparent: true, opacity: 0.7 }), s * 0.11, 0.33, 0.35));
    }
  }
  if (cls === 'knight' && !covered) {
    head.add(mesh(new THREE.TorusGeometry(0.34, 0.02, 6, 18, Math.PI), SILVER(), 0, 0.12, 0.05));
  }

  root.userData = { legs, arms, rig, head };
  return root;
}

export function animateAvatar(root, t, moving, phase = 0) {
  const u = root.userData;
  if (!u.legs) return;
  const sw = moving ? Math.sin(t * 10 + phase) * 0.7 : 0;
  u.legs[0].rotation.x = sw;
  u.legs[1].rotation.x = -sw;
  u.arms[0].rotation.x = -sw * 0.6;
  u.arms[1].rotation.x = moving ? sw * 0.5 : 0;
  u.rig.position.y = moving ? Math.abs(Math.sin(t * 10 + phase)) * 0.06 : Math.sin(t * 2 + phase) * 0.012;
}

export function makeLabel(text, o = {}) {
  const px = o.px || 44;
  const family = o.family || "Amiri, 'Noto Naskh Arabic', system-ui, sans-serif";
  const font = `${o.weight || '700'} ${px}px ${family}`;
  const c = document.createElement('canvas');
  let x = c.getContext('2d');
  x.font = font;
  const w = Math.ceil(x.measureText(text).width + px * 0.9);
  const h = Math.ceil(px * 1.55);
  c.width = w;
  c.height = h;
  x = c.getContext('2d');
  x.font = font;
  x.fillStyle = o.bg || 'rgba(20,30,70,0.7)';
  const r = h / 2;
  x.beginPath();
  if (x.roundRect) x.roundRect(0, 0, w, h, r);
  else x.rect(0, 0, w, h);
  x.fill();
  x.fillStyle = o.color || '#ffffff';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, w / 2, h / 2 + px * 0.05);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  const sc = o.scale || 0.0105;
  sp.scale.set(w * sc, h * sc, 1);
  sp.renderOrder = 20;
  return sp;
}

export function disposeObj(o) {
  o.traverse((n) => {
    if (n.geometry) n.geometry.dispose();
    if (n.isSprite && n.material) {
      if (n.material.map) n.material.map.dispose();
      n.material.dispose();
    }
  });
}
