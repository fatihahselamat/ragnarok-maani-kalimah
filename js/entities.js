import * as THREE from 'three';
import { buildAvatar, animateAvatar, makeLabel, disposeObj, mat } from './character.js';

// ---------- Jeli (musuh) ----------
export class Monster {
  constructor(word, zone, home, color) {
    this.word = word;
    this.zone = zone;
    this.home = home;
    this.dead = false;
    this.gone = false;
    this.cool = 0;
    this.phase = Math.random() * 10;
    this.dying = 0;
    this.target = null;
    this.wait = Math.random() * 2;
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);
    const jelly = new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 18, 14),
      new THREE.MeshStandardMaterial({ color, roughness: 0.25, transparent: true, opacity: 0.92 })
    );
    jelly.scale.set(1, 0.85, 1);
    jelly.position.y = 0.6;
    this.body.add(jelly);
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat('#1f1a2a'));
      e.position.set(s * 0.22, 0.72, 0.6);
      e.scale.set(1, 1.3, 0.6);
      this.body.add(e);
    }
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), mat('#ffffff', { transparent: true, opacity: 0.6 }));
    hl.position.set(-0.28, 1.05, 0.3);
    this.body.add(hl);
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.85, 16), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.22, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.04;
    this.group.add(sh);
    this.label = makeLabel(word.ar, { px: 46, scale: 0.0105, bg: 'rgba(25,35,80,0.75)' });
    this.label.position.y = 2.2;
    this.group.add(this.label);
    const r = 4 + Math.random() * (home.r || 22), a = Math.random() * Math.PI * 2;
    this.group.position.set(home.x + Math.cos(a) * r, 0, home.z + Math.sin(a) * r);
    this.group.userData.entity = this;
  }
  defeat() { this.dead = true; this.dying = 0.5; }
  update(dt, t) {
    if (this.dead) {
      this.dying -= dt;
      const k = Math.max(0, this.dying / 0.5);
      this.group.scale.setScalar(0.2 + k * 0.8 + (1 - k) * 0.6);
      this.group.position.y += dt * 3;
      this.group.traverse((n) => { if (n.material && n.material.transparent) n.material.opacity = Math.min(n.material.opacity, k); });
      if (this.dying <= 0) this.gone = true;
      return;
    }
    if (this.cool > 0) this.cool -= dt;
    const p = this.group.position;
    let moving = false;
    if (this.target) {
      const dx = this.target.x - p.x, dz = this.target.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.4) { this.target = null; this.wait = 1.5 + Math.random() * 3; }
      else {
        p.x += (dx / d) * 1.3 * dt; p.z += (dz / d) * 1.3 * dt;
        this.group.rotation.y = Math.atan2(dx, dz);
        moving = true;
      }
    } else {
      this.wait -= dt;
      if (this.wait <= 0) {
        const r = 4 + Math.random() * (this.home.r || 22), a = Math.random() * Math.PI * 2;
        this.target = { x: this.home.x + Math.cos(a) * r, z: this.home.z + Math.sin(a) * r };
      }
    }
    const s = Math.sin(t * 5 + this.phase);
    this.body.position.y = moving ? Math.abs(s) * 0.3 : 0;
    this.body.scale.set(1 + (moving ? s * 0.06 : Math.sin(t * 2 + this.phase) * 0.03), 1 - (moving ? s * 0.06 : Math.sin(t * 2 + this.phase) * 0.03), 1);
  }
}

// ---------- NPC ----------
export function makeNpc({ name, x, z, look, cls, html, title }) {
  const g = new THREE.Group();
  const av = buildAvatar(look, cls);
  g.add(av);
  const lab = makeLabel(name, { px: 34, scale: 0.0095, bg: 'rgba(20,90,60,0.8)', family: 'system-ui, sans-serif' });
  lab.position.y = 2.7;
  g.add(lab);
  const mark = makeLabel('!', { px: 56, scale: 0.012, bg: 'rgba(255,200,40,0.95)', color: '#5a3a00', family: 'system-ui, sans-serif' });
  mark.position.y = 3.4;
  g.add(mark);
  g.position.set(x, 0, z);
  g.rotation.y = Math.PI / 2;
  const npc = { group: g, avatar: av, mark, pos: g.position, name, title, html };
  g.userData.entity = npc;
  g.userData.npc = true;
  return npc;
}

// ---------- Pemain lain ----------
const clampInt = (v, a, b) => Math.max(a, Math.min(b, v | 0));

export class Remotes {
  constructor(scene) {
    this.scene = scene;
    this.map = new Map();
  }
  count() { return this.map.size; }
  apply(p) {
    if (!p || typeof p.i !== 'string' || p.i.length > 16) return;
    if (p.bye) { this.remove(p.i); return; }
    const l = Array.isArray(p.l) ? p.l : [0, 0, 0, 0];
    const look = { skin: clampInt(l[0], 0, 4), hair: clampInt(l[1], 0, 7), hijab: !!l[2], sex: l[3] ? 'f' : 'm' };
    const cls = ['novice', 'priest', 'knight', 'assassin', 'mage', 'hunter', 'blacksmith'].includes(p.c) ? p.c : 'novice';
    const key = [look.skin, look.hair, look.hijab, look.sex, cls].join('|');
    const name = String(p.n || '?').replace(/[<>]/g, '').slice(0, 20);
    const lv = clampInt(p.v, 1, 99);
    let r = this.map.get(p.i);
    if (!r || r.key !== key) {
      if (r) this.dispose(r);
      const g = new THREE.Group();
      const av = buildAvatar(look, cls);
      g.add(av);
      g.position.set(+p.x || 0, 0, +p.z || 0);
      this.scene.add(g);
      r = { id: p.i, key, g, av, label: null, text: '', tx: g.position.x, tz: g.position.z, tr: 0, moving: false, last: 0, phase: Math.random() * 6 };
      this.map.set(p.i, r);
    }
    const text = `${name}  Lv${lv}`;
    if (r.text !== text) {
      if (r.label) { r.g.remove(r.label); disposeObj(r.label); }
      r.label = makeLabel(text, { px: 34, scale: 0.0095, bg: 'rgba(20,30,70,0.7)', family: 'system-ui, sans-serif' });
      r.label.position.y = 2.7;
      r.g.add(r.label);
      r.text = text;
    }
    r.tx = +p.x || 0; r.tz = +p.z || 0; r.tr = +p.r || 0; r.moving = !!p.m; r.last = performance.now();
  }
  dispose(r) { this.scene.remove(r.g); disposeObj(r.g); }
  remove(id) { const r = this.map.get(id); if (r) { this.dispose(r); this.map.delete(id); } }
  clear() { for (const r of this.map.values()) this.dispose(r); this.map.clear(); }
  update(dt, t) {
    const now = performance.now();
    for (const r of [...this.map.values()]) {
      if (now - r.last > 8000) { this.remove(r.id); continue; }
      const k = Math.min(1, dt * 8);
      const dx = r.tx - r.g.position.x, dz = r.tz - r.g.position.z;
      r.g.position.x += dx * k; r.g.position.z += dz * k;
      let da = r.tr - r.g.rotation.y;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      r.g.rotation.y += da * k;
      animateAvatar(r.av, t, r.moving || Math.hypot(dx, dz) > 0.2, r.phase);
    }
  }
}
