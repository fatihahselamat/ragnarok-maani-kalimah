import * as THREE from 'three';
import { ZONES, zoneWords } from './data.js';
import { CLASSES, SKINS, HAIRS, buildAvatar, animateAvatar, makeLabel, disposeObj } from './character.js';
import { createWorld, ZP, gateX, BOUNDS } from './world.js';
import { Monster, makeNpc, Remotes } from './entities.js';
import { pickWord, makeQuestion, xpNeed, hpMax, MAX_LV } from './quiz.js';
import { Net } from './net.js';
import { CONFIG } from './config.js';

// Fon Arab mesti sedia sebelum label 3D dilukis (maks 3 saat).
await Promise.race([
  Promise.all([document.fonts.load('700 40px Amiri', 'كلمة'), document.fonts.load('400 24px Amiri', 'كلمة')]).catch(() => {}),
  new Promise((r) => setTimeout(r, 3000)),
]);

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SPEED = 6.5;
const UNLOCK_AT = 0.7;
const JOB_LV = 5;

// ---------- three ----------
const canvas = $('#game');
const coarse = matchMedia('(pointer:coarse)').matches;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.5 : 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
const world = createWorld(scene);

// pratonton watak
const pvScene = new THREE.Scene();
pvScene.background = new THREE.Color('#cfe8ff');
pvScene.add(new THREE.HemisphereLight('#fff', '#a9c9a0', 1.2));
const pvSun = new THREE.DirectionalLight('#fff', 1.4);
pvSun.position.set(3, 6, 5);
pvScene.add(pvSun);
const pvFloor = new THREE.Mesh(new THREE.CircleGeometry(1.4, 32), new THREE.MeshStandardMaterial({ color: '#9fd88a' }));
pvFloor.rotation.x = -Math.PI / 2;
pvScene.add(pvFloor);
const pvCam = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
pvCam.position.set(0, 1.5, 5.2);
pvCam.lookAt(0, 1.05, 0);
let pvAvatar = null;

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  pvCam.aspect = w / h;
  if (w > 700) pvCam.setViewOffset(w, h, w * 0.17, 0, w, h);
  else pvCam.setViewOffset(w, h, 0, h * 0.16, w, h);
  pvCam.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------- bunyi ----------
let muted = false;
let ac = null;
function beep(freq, dur = 0.12, type = 'sine', vol = 0.06, delay = 0) {
  if (muted) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + dur);
  } catch (e) { /* abaikan */ }
}
const sfx = {
  ok: () => { beep(660, 0.1); beep(880, 0.16, 'sine', 0.06, 0.09); },
  no: () => beep(180, 0.25, 'sawtooth', 0.05),
  lv: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.2, 'triangle', 0.06, i * 0.1)),
};

// ---------- storan (localStorage sahaja) ----------
const KEY = 'maani.v1.';
const store = {
  get(u) { try { const p = JSON.parse(localStorage.getItem(KEY + u.toLowerCase())); return p && p.v === 1 ? p : null; } catch { return null; } },
  set(p) { try { localStorage.setItem(KEY + p.user.toLowerCase(), JSON.stringify(p)); localStorage.setItem(KEY + '_last', p.user); } catch (e) { /* penuh/dilarang */ } },
  last() { try { return localStorage.getItem(KEY + '_last') || ''; } catch { return ''; } },
};
const cleanUser = (s) => String(s || '').trim().replace(/[^\w@.\- ]/g, '').slice(0, 40);
const newProfile = (u) => ({
  v: 1, user: u, name: u.split('@')[0].slice(0, 16),
  look: { sex: 'f', skin: 1, hair: 1, hijab: true },
  cls: 'novice', lv: 1, xp: 0, hp: hpMax(1), pos: [0, 6], words: {}, ans: 0, ok: 0, t: Date.now(),
});
function validProfile(p) {
  return p && p.v === 1 && typeof p.user === 'string' && typeof p.lv === 'number' && p.words && typeof p.words === 'object' && p.look && CLASSES[p.cls];
}

let P = null;
let state = 'login';
let streak = 0;

const mastered = (w) => ((P.words[w.ar] || {}).c || 0) >= 2;
const zoneProg = (z) => { const ws = zoneWords(z); return ws.filter(mastered).length / ws.length; };
const isUnlocked = (i) => i <= 1 || zoneProg(i - 1) >= UNLOCK_AT;
const save = () => { if (P) { P.pos = [+player.x.toFixed(1), +player.z.toFixed(1)]; store.set(P); } };

// ---------- UI umum ----------
let toastT = 0;
function toast(msg, ms = 2200) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => (el.hidden = true), ms);
}
const UI_PANELS = ['#dialog', '#menu', '#book', '#job', '#map'];
const uiOpen = () => UI_PANELS.some((s) => !$(s).hidden);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function hud() {
  if (!P) return;
  $('#hName').textContent = P.name;
  $('#hCls').textContent = CLASSES[P.cls].name;
  $('#hLv').textContent = 'Lv ' + P.lv;
  const hm = hpMax(P.lv);
  $('#hpBar').style.width = clamp((P.hp / hm) * 100, 0, 100) + '%';
  $('#hpTxt').textContent = `HP ${Math.max(0, Math.round(P.hp))}/${hm}`;
  const need = xpNeed(P.lv);
  $('#xpBar').style.width = (P.lv >= MAX_LV ? 100 : (P.xp / need) * 100) + '%';
  $('#xpTxt').textContent = P.lv >= MAX_LV ? 'MAX' : `XP ${P.xp}/${need}`;
}

// ---------- pemain ----------
const player = { x: 0, z: 6, rot: 0, avatar: null, label: null, moving: false, group: new THREE.Group() };
scene.add(player.group);
function rebuildPlayer() {
  if (player.avatar) { player.group.remove(player.avatar); disposeObj(player.avatar); }
  if (player.label) { player.group.remove(player.label); disposeObj(player.label); }
  player.avatar = buildAvatar(P.look, P.cls);
  player.group.add(player.avatar);
  player.label = makeLabel(`${P.name}  Lv${P.lv}`, { px: 34, scale: 0.0095, bg: 'rgba(47,95,191,0.85)', family: 'system-ui, sans-serif' });
  player.label.position.y = 2.7;
  player.group.add(player.label);
  player.labelText = `${P.name}|${P.lv}`;
}
function refreshLabel() {
  if (player.labelText !== `${P.name}|${P.lv}`) {
    player.group.remove(player.label); disposeObj(player.label);
    player.label = makeLabel(`${P.name}  Lv${P.lv}`, { px: 34, scale: 0.0095, bg: 'rgba(47,95,191,0.85)', family: 'system-ui, sans-serif' });
    player.label.position.y = 2.7;
    player.group.add(player.label);
    player.labelText = `${P.name}|${P.lv}`;
  }
}

// ---------- Monster & NPC ----------
const monsters = [];
function spawnMonster(zi, home = ZP[zi], wz = zi) {
  const w = pickWord(wz, P ? P.words : {});
  if (!w) return;
  const m = new Monster(w, zi, home, ZONES[wz].jeli);
  m.wordZone = wz;
  scene.add(m.group);
  monsters.push(m);
}
ZONES.forEach((z, i) => {
  if (z.town) return;
  const n = Math.min(7, Math.max(4, zoneWords(i).length));
  for (let k = 0; k < n; k++) spawnMonster(i);
});
// Jeli latihan di kampung (kalimah zon 1) supaya soalan pertama mudah dijumpai.
for (let k = 0; k < 3; k++) spawnMonster(0, { x: 0, z: 0, r: 9 }, 1);

const GUIDE_LOOK = { sex: 'f', skin: 1, hair: 1, hijab: true };
const npcs = [];
function addNpc(o) { const n = makeNpc(o); scene.add(n.group); npcs.push(n); return n; }
addNpc({
  name: 'Ustazah Maani', x: 4, z: 3, look: GUIDE_LOOK, cls: 'priest', title: 'Selamat datang, Novice',
  html: () => `<p>Di sini bermulanya pengembaraan Maani Kalimah Tafsir Tingkatan 4.</p>
  <p>• Berjalan ke timur untuk memasuki <b>Lembah Takwir</b>.<br>• Soalan muncul bila anda melanggar <b>Jeli</b> (makhluk jeli berwarna dengan perkataan Arab di atasnya). Ada 3 Jeli latihan di kampung ini. Ikut anak panah kuning di bawah skrin.<br>• Tekan butang peta 🗺️ (atau kekunci M) untuk pergi terus ke kampung yang sudah dibuka.<br>• Jawab betul untuk XP. Jawab salah akan kurangkan HP.<br>• Satu kalimah dikuasai selepas 2 jawapan betul. Kuasai 70% kalimah satu zon untuk buka gerbang zon seterusnya.<br>• Capai <b>Lv ${JOB_LV}</b> untuk memilih job: Priest, Knight, Assassin, Mage, Hunter atau Blacksmith.</p>`,
});
ZONES.forEach((z, i) => {
  if (z.town) return;
  addNpc({
    name: 'Penjaga ' + z.ar, x: ZP[i].x - 7, z: ZP[i].z + 6, look: { sex: i % 2 ? 'm' : 'f', skin: i % 5, hair: i % 8, hijab: i % 2 === 0 }, cls: ['knight', 'hunter', 'mage', 'blacksmith', 'priest', 'assassin', 'knight'][i - 1], title: z.name,
    html: () => {
      const ws = zoneWords(i);
      const done = ws.filter(mastered).length;
      const next = i < ZONES.length - 1 ? `Kuasai ${Math.ceil(ws.length * UNLOCK_AT)} kalimah untuk buka gerbang ke zon seterusnya.` : 'Ini zon terakhir. Kuasai semua kalimah untuk jadi Pahlawan Maani.';
      return `<p><span class="ar" style="font-size:24px">${esc(z.ar)}</span></p><p>Kalimah dikuasai: <b>${done}/${ws.length}</b>.<br>${next}</p><p>Tip: kalimah yang ditunjukkan di atas kepala Jeli ialah soalan anda.</p>`;
    },
  });
});

// ---------- Multiplayer ----------
const net = new Net(CONFIG);
const remotes = new Remotes(scene);
net.onMsg = (p) => { if (p && p.i !== net.id) remotes.apply(p); };
net.onStatus = updateNet;
function updateNet() {
  const el = $('#netStat');
  if (net.mode === 'online') el.textContent = net.ready ? `Online · ${remotes.count() + 1} di zon` : 'Menyambung…';
  else if (net.mode === 'local') el.textContent = 'Ujian (tab sama)';
  else el.textContent = 'Solo';
}
net.init().then(updateNet);
let sendT = 0, lastSent = { x: 1e9, z: 1e9 }, hb = 0;
function netTick(dt) {
  sendT += dt; hb += dt;
  if (sendT < 0.35 || !P || !net.ready) return;
  sendT = 0;
  const moved = Math.hypot(player.x - lastSent.x, player.z - lastSent.z) > 0.15;
  if (!moved && hb < 2) return;
  hb = 0;
  lastSent = { x: player.x, z: player.z };
  net.send({
    n: P.name, c: P.cls, v: P.lv,
    l: [P.look.skin, P.look.hair, P.look.hijab ? 1 : 0, P.look.sex === 'f' ? 1 : 0],
    x: +player.x.toFixed(2), z: +player.z.toFixed(2), r: +player.rot.toFixed(2), m: player.moving ? 1 : 0,
  });
  updateNet();
}

// ---------- Zon ----------
let curZone = -1;
function zoneAt(x, z) {
  let bi = 0, bd = 1e9;
  ZP.forEach((q, i) => { const d = Math.hypot(q.x - x, q.z - z); if (d < bd) { bd = d; bi = i; } });
  return bi;
}
function setZone(i) {
  if (i === curZone) return;
  curZone = i;
  const z = ZONES[i];
  $('#zoneBar').textContent = z.town ? z.name : `${z.name} · ${zoneWords(i).filter(mastered).length}/${zoneWords(i).length}`;
  toast(z.name, 1800);
  remotes.clear();
  net.join(i);
}
function refreshGates() { for (let i = 2; i < ZONES.length; i++) world.setLocked(i, !isUnlocked(i)); }

// ---------- Input ----------
const keys = {};
addEventListener('keydown', (e) => {
  if (e.target && e.target.tagName === 'INPUT') return;
  keys[e.key.toLowerCase()] = true;
  if (state === 'play' && (e.key === 'e' || e.key === 'Enter' || e.key === ' ') && !uiOpen() && !battle) { e.preventDefault(); doAction(); }
  if ((e.key === 'm' || e.key === 'M') && state === 'play' && !battle) { if ($('#map').hidden) openMap(); else $('#map').hidden = true; }
  if (e.key === 'Escape' && state === 'play') { if (uiOpen()) closeAllUI(); else openMenu(); }
});
addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

const stick = { x: 0, y: 0, id: null };
const stEl = $('#stick'), knob = $('#knob');
function moveStick(e) {
  const r = stEl.getBoundingClientRect();
  let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const max = r.width / 2 - 14, l = Math.hypot(dx, dy);
  if (l > max) { dx *= max / l; dy *= max / l; }
  knob.style.transform = `translate(${dx}px,${dy}px)`;
  stick.x = dx / max; stick.y = -dy / max;
}
stEl.addEventListener('pointerdown', (e) => { stick.id = e.pointerId; stEl.setPointerCapture(e.pointerId); moveStick(e); });
stEl.addEventListener('pointermove', (e) => { if (e.pointerId === stick.id) moveStick(e); });
const stickEnd = (e) => { if (e.pointerId === stick.id) { stick.id = null; stick.x = stick.y = 0; knob.style.transform = ''; } };
stEl.addEventListener('pointerup', stickEnd);
stEl.addEventListener('pointercancel', stickEnd);

function inputVec() {
  let x = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
  let y = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
  x += stick.x; y += stick.y;
  const l = Math.hypot(x, y);
  if (l > 1) { x /= l; y /= l; }
  return { x, y, len: Math.min(1, l) };
}

let yaw = Math.PI / 4, dist = 17;
const PITCH = 0.95;
let down = null, last = null;
const ray = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let target = null, chase = null, pendingTalk = null;
const marker = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.6, 24), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
marker.rotation.x = -Math.PI / 2;
marker.visible = false;
scene.add(marker);

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), b: e.button, moved: false }; last = { x: e.clientX }; });
canvas.addEventListener('pointermove', (e) => {
  if (!down) return;
  if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) down.moved = true;
  if (down.moved && (down.b === 2 || down.b === 1 || e.pointerType === 'touch')) { yaw -= (e.clientX - last.x) * 0.006; }
  last.x = e.clientX;
});
canvas.addEventListener('pointerup', (e) => {
  if (down && !down.moved && down.b === 0 && performance.now() - down.t < 500 && state === 'play' && !battle && !uiOpen()) tap(e);
  down = null;
});
canvas.addEventListener('wheel', (e) => { dist = clamp(dist + e.deltaY * 0.01, 9, 28); }, { passive: true });
$('#btnRotL').onclick = () => (yaw += 0.5);
$('#btnRotR').onclick = () => (yaw -= 0.5);

function entityFromHit(h) {
  let o = h.object;
  while (o && !(o.userData && o.userData.entity)) o = o.parent;
  return o ? o.userData.entity : null;
}
function tap(e) {
  const nx = (e.clientX / innerWidth) * 2 - 1, ny = -(e.clientY / innerHeight) * 2 + 1;
  ray.setFromCamera({ x: nx, y: ny }, camera);
  const mh = ray.intersectObjects(monsters.filter((m) => !m.dead).map((m) => m.group), true)[0];
  if (mh) { chase = entityFromHit(mh); target = null; pendingTalk = null; return; }
  const nh = ray.intersectObjects(npcs.map((n) => n.group), true)[0];
  if (nh) { pendingTalk = entityFromHit(nh); chase = null; target = null; return; }
  const pt = new THREE.Vector3();
  if (ray.ray.intersectPlane(plane, pt)) {
    target = { x: clamp(pt.x, BOUNDS.minX, BOUNDS.maxX), z: clamp(pt.z, BOUNDS.minZ, BOUNDS.maxZ) };
    chase = null; pendingTalk = null;
    marker.position.set(target.x, 0.06, target.z);
    marker.visible = true;
    marker.material.opacity = 0.9;
  }
}

// ---------- NPC dialog ----------
let nearNpc = null;
function doAction() { if (nearNpc) openDialog(nearNpc); }
$('#btnAct').onclick = doAction;
function openDialog(n) {
  $('#dTitle').textContent = n.title;
  $('#dBody').innerHTML = typeof n.html === 'function' ? n.html() : n.html;
  $('#dialog').hidden = false;
  stick.x = stick.y = 0;
}
$('#dClose').onclick = () => ($('#dialog').hidden = true);

// ---------- Battle ----------
let battle = null;
function startBattle(m) {
  if (battle || uiOpen()) return;
  const q = makeQuestion(m.word, { reduce: P.cls === 'mage' });
  battle = { m, q, done: false };
  target = null; chase = null; pendingTalk = null; stick.x = stick.y = 0;
  $('#bHint').textContent = q.type === 'w2m' ? 'Apakah makna kalimah ini?' : 'Pilih kalimah yang bermaksud:';
  const pr = $('#bPrompt');
  pr.textContent = q.prompt;
  pr.className = 'prompt ar' + (q.type === 'w2m' ? '' : ' mid');
  const box = $('#bOpts');
  box.innerHTML = '';
  q.options.forEach((o) => {
    const b = document.createElement('button');
    b.className = 'ar' + (q.type === 'm2w' ? ' big' : '');
    b.textContent = o.text;
    b.onclick = () => answer(o, b);
    box.appendChild(b);
  });
  const f = $('#bFeed');
  f.textContent = '';
  f.className = 'feed';
  $('#battle').hidden = false;
}
function answer(opt, btn) {
  if (!battle || battle.done) return;
  battle.done = true;
  const w = battle.q.word;
  const rec = (P.words[w.ar] = P.words[w.ar] || { c: 0, w: 0 });
  P.ans++;
  const feed = $('#bFeed');
  [...$('#bOpts').children].forEach((b) => { if (b.textContent === battle.q.answer) b.classList.add('ok'); });
  if (opt.ok) {
    P.ok++; rec.c++; streak++;
    let xp = 10 + (streak >= 3 ? 5 : 0);
    if (P.cls === 'assassin') xp = Math.round(xp * 1.3);
    if (P.cls === 'hunter' && streak >= 3) xp *= 2;
    if (P.cls === 'priest') P.hp = Math.min(hpMax(P.lv), P.hp + 6);
    feed.textContent = `Betul! +${xp} XP` + (streak >= 3 ? ` · ${streak} berturut-turut` : '');
    feed.className = 'feed good';
    sfx.ok();
    addXp(xp);
    setTimeout(() => endBattle(true), 900);
  } else {
    rec.w++; streak = 0;
    btn.classList.add('no');
    const dmg = P.cls === 'knight' ? 8 : 15;
    P.hp -= dmg;
    let extra = '';
    if (P.cls === 'blacksmith') { addXp(3); extra = ' · +3 XP (ketekunan)'; }
    feed.textContent = `Salah. -${dmg} HP${extra}`;
    feed.className = 'feed bad';
    sfx.no();
    setTimeout(() => endBattle(false), 1700);
  }
  hud();
  save();
}
function endBattle(ok) {
  const b = battle;
  battle = null;
  $('#battle').hidden = true;
  if (!b) return;
  if (ok) {
    b.m.defeat();
    const { zone: zi, home: hm, wordZone: wz } = b.m;
    setTimeout(() => spawnMonster(zi, hm, wz), 5000);
  } else {
    b.m.cool = 3;
    const dx = player.x - b.m.group.position.x, dz = player.z - b.m.group.position.z, d = Math.hypot(dx, dz) || 1;
    player.x += (dx / d) * 3; player.z += (dz / d) * 3;
  }
  refreshGates();
  const zi = curZone;
  if (zi > 0) $('#zoneBar').textContent = `${ZONES[zi].name} · ${zoneWords(zi).filter(mastered).length}/${zoneWords(zi).length}`;
  if (P.hp <= 0) respawn();
  save();
}
function respawn() {
  toast('Anda tumbang. Dibawa pulang ke kampung.', 2600);
  P.hp = hpMax(P.lv);
  player.x = 0; player.z = 6;
  hud();
}
function addXp(n) {
  if (P.lv >= MAX_LV) return;
  P.xp += n;
  let up = false;
  while (P.lv < MAX_LV && P.xp >= xpNeed(P.lv)) { P.xp -= xpNeed(P.lv); P.lv++; up = true; }
  if (up) {
    P.hp = hpMax(P.lv);
    sfx.lv();
    toast(`Naik level! Lv ${P.lv}`, 2600);
    refreshLabel();
    if (P.lv >= JOB_LV && P.cls === 'novice') setTimeout(openJob, 1800);
  }
  hud();
}

// ---------- Menu, buku, job ----------
function closeAllUI() { UI_PANELS.forEach((s) => ($(s).hidden = true)); }

// ---------- Peta & perjalanan pantas ----------
const MAP_POS = [[60, 80], [160, 80], [260, 80], [360, 80], [360, 210], [260, 210], [160, 210], [60, 210]];
let mapSel = 0;
const gateNeed = (i) => (i >= 2 ? Math.ceil(zoneWords(i - 1).length * UNLOCK_AT) : 0);
function openMap() {
  if (battle || state !== 'play') return;
  closeAllUI();
  mapSel = curZone >= 0 ? curZone : 0;
  renderMap();
  $('#map').hidden = false;
}
function renderMap() {
  let s = '';
  for (let i = 1; i < ZONES.length; i++) {
    const [x1, y1] = MAP_POS[i - 1], [x2, y2] = MAP_POS[i];
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${isUnlocked(i) ? '#c9a95e' : '#b5b5b5'}" stroke-width="6" stroke-linecap="round" ${isUnlocked(i) ? '' : 'stroke-dasharray="2 10"'}/>`;
  }
  ZONES.forEach((z, i) => {
    const [x, y] = MAP_POS[i];
    const open = isUnlocked(i), sel = i === mapSel;
    const ws = zoneWords(i), done = ws.filter(mastered).length;
    s += `<g data-z="${i}"><rect x="${x - 34}" y="${y - 34}" width="68" height="104" fill="transparent"/>`;
    s += `<circle cx="${x}" cy="${y}" r="26" fill="${open ? z.color : '#d4d4d4'}" stroke="${sel ? '#2f5fbf' : '#fff'}" stroke-width="${sel ? 5 : 3}"/>`;
    s += `<text x="${x}" y="${y + 8}" text-anchor="middle" font-size="22" font-weight="700">${i === 0 ? '🏠' : i}</text>`;
    if (!open) s += `<text x="${x + 20}" y="${y - 16}" font-size="16">🔒</text>`;
    s += `<text class="ar" x="${x}" y="${y + 46}" text-anchor="middle" font-size="13" font-weight="700">${esc(z.ar)}</text>`;
    if (i > 0) s += `<text x="${x}" y="${y + 62}" text-anchor="middle" font-size="11">${done}/${ws.length}</text>`;
    if (i === curZone) s += `<text x="${x}" y="${y - 32}" text-anchor="middle" font-size="20">📍</text>`;
    s += '</g>';
  });
  $('#mapSvg').innerHTML = s;
  renderMapInfo();
}
function renderMapInfo() {
  const z = ZONES[mapSel], open = isUnlocked(mapSel), here = mapSel === curZone;
  let h = `<h3>${esc(z.name)}</h3>`;
  if (mapSel > 0) { const ws = zoneWords(mapSel); h += `<p style="margin:2px 0">Kalimah dikuasai: <b>${ws.filter(mastered).length}/${ws.length}</b></p>`; }
  if (!open) h += `<p>🔒 Kuasai ${gateNeed(mapSel)} kalimah di ${esc(ZONES[mapSel - 1].name)} untuk membuka zon ini.</p>`;
  else h += `<button class="primary" id="mapGo"${here ? ' disabled' : ''}>${here ? 'Anda berada di sini' : 'Pergi ke sini'}</button>`;
  $('#mapInfo').innerHTML = h;
  const go = $('#mapGo');
  if (go) go.onclick = () => travel(mapSel);
}
function travel(i) {
  if (battle || !isUnlocked(i)) return;
  if (i === 0) { player.x = 0; player.z = 6; }
  else { player.x = ZP[i].x - 4; player.z = ZP[i].z + 4; }
  target = null; chase = null; pendingTalk = null; marker.visible = false;
  const cp = Math.cos(PITCH);
  camPos.set(player.x + Math.sin(yaw) * cp * dist, 1.3 + Math.sin(PITCH) * dist, player.z + Math.cos(yaw) * cp * dist);
  $('#map').hidden = true;
  toast(`Tiba di ${ZONES[i].name}`, 1800);
  save();
}
$('#mapSvg').addEventListener('click', (e) => {
  const g = e.target.closest('[data-z]');
  if (g) { mapSel = +g.dataset.z; renderMap(); }
});
$('#btnMap').onclick = openMap;
$('#mapClose').onclick = () => ($('#map').hidden = true);
function openMenu() {
  $('#mJob').hidden = P.lv < JOB_LV;
  $('#mMute').textContent = muted ? '🔇 Bunyi: senyap' : '🔊 Bunyi: hidup';
  $('#menu').hidden = false;
}
$('#btnMenu').onclick = openMenu;
$('#mClose').onclick = () => ($('#menu').hidden = true);
$('#mMute').onclick = () => { muted = !muted; $('#mMute').textContent = muted ? '🔇 Bunyi: senyap' : '🔊 Bunyi: hidup'; };

function openBook() {
  let h = '';
  ZONES.forEach((z, i) => {
    if (z.town) return;
    const ws = zoneWords(i);
    const locked = !isUnlocked(i);
    h += `<h3>${esc(z.name)} ${locked ? '🔒' : ''} <span class="stars">${ws.filter(mastered).length}/${ws.length}</span></h3>`;
    ws.forEach((w) => {
      const c = (P.words[w.ar] || {}).c || 0;
      h += `<div class="wrow"><span class="stars">${c >= 2 ? '★★' : c === 1 ? '★☆' : '☆☆'}</span><span class="m ar">${esc(w.mean)}</span><span class="ar">${esc(w.ar)}</span></div>`;
    });
  });
  $('#bookBody').innerHTML = h;
  $('#book').hidden = false;
}
$('#btnBook').onclick = openBook;
$('#mBook').onclick = () => { $('#menu').hidden = true; openBook(); };
$('#bookClose').onclick = () => ($('#book').hidden = true);

function openJob() {
  if (state !== 'play' || P.lv < JOB_LV) return;
  const list = $('#jobList');
  list.innerHTML = '';
  Object.entries(CLASSES).forEach(([k, c]) => {
    if (k === 'novice') return;
    const b = document.createElement('button');
    b.innerHTML = `<b>${c.name} <span class="ar">${c.ar}</span></b><em>"${esc(c.quote)}"</em><em>${esc(c.bonus)}</em>`;
    b.style.borderColor = c.trim;
    if (P.cls === k) b.style.background = '#dfe8ff';
    b.onclick = () => {
      P.cls = k; rebuildPlayer(); hud(); save(); $('#job').hidden = true;
      toast(`Job: ${c.name}`);
    };
    list.appendChild(b);
  });
  $('#job').hidden = false;
}
$('#mJob').onclick = () => { $('#menu').hidden = true; openJob(); };
$('#jobClose').onclick = () => ($('#job').hidden = true);

function exportFile() {
  save();
  const blob = new Blob([JSON.stringify(P, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `maani-${P.user.replace(/[^\w.-]/g, '_')}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Fail progress disimpan');
}
$('#mExport').onclick = exportFile;
$('#mLogout').onclick = () => { save(); closeAllUI(); logout(); };
$('#mLook').onclick = () => { $('#menu').hidden = true; save(); openCreator(true); };

// ---------- Log masuk ----------
$('#user').value = store.last();
function login() {
  const u = cleanUser($('#user').value);
  if (u.length < 2) { toast('Masukkan nama pengguna atau emel'); return; }
  const ex = store.get(u);
  if (ex) { P = ex; startGame(); }
  else { P = newProfile(u); openCreator(false); }
}
$('#btnLogin').onclick = login;
$('#user').addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });
$('#btnImport').onclick = () => $('#fileIn').click();
$('#fileIn').onchange = async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const p = JSON.parse(await f.text());
    if (!validProfile(p)) throw new Error('format');
    p.user = cleanUser(p.user) || 'pemain';
    p.name = String(p.name || p.user).slice(0, 16);
    p.lv = clamp(p.lv | 0, 1, MAX_LV);
    p.hp = clamp(+p.hp || hpMax(p.lv), 1, hpMax(p.lv));
    p.xp = Math.max(0, p.xp | 0);
    store.set(p);
    $('#user').value = p.user;
    toast('Progress dimuat. Tekan Masuk.');
  } catch (err) { toast('Fail tidak sah'); }
};
function logout() {
  state = 'login';
  P = null;
  remotes.clear(); net.leave(); curZone = -1;
  $('#hud').hidden = true;
  $('#login').hidden = false;
  player.group.visible = false;
}

// ---------- Cipta watak ----------
let draft = null, editing = false;
function renderCreator() {
  $('#cName').value = draft.name;
  document.querySelectorAll('#cSex button').forEach((b) => b.classList.toggle('on', b.dataset.v === draft.sex));
  document.querySelectorAll('#cHijab button').forEach((b) => b.classList.toggle('on', (b.dataset.v === '1') === draft.hijab));
  $('#cHijabRow').hidden = draft.sex !== 'f';
  const showHair = !(draft.sex === 'f' && draft.hijab);
  $('#cHair').hidden = !showHair; $('#cHairLabel').hidden = !showHair;
  document.querySelectorAll('#cSkin button').forEach((b, i) => b.classList.toggle('on', i === draft.skin));
  document.querySelectorAll('#cHair button').forEach((b, i) => b.classList.toggle('on', i === draft.hair));
  if (pvAvatar) { pvScene.remove(pvAvatar); disposeObj(pvAvatar); }
  pvAvatar = buildAvatar({ ...draft, hijab: draft.sex === 'f' && draft.hijab }, editing ? P.cls : 'novice');
  pvAvatar.scale.setScalar(1.1);
  pvScene.add(pvAvatar);
}
function buildSwatches(id, arr, key) {
  const box = $(id);
  box.innerHTML = '';
  arr.forEach((c, i) => {
    const b = document.createElement('button');
    b.style.background = c;
    b.setAttribute('aria-label', 'warna ' + (i + 1));
    b.onclick = () => { draft[key] = i; renderCreator(); };
    box.appendChild(b);
  });
}
buildSwatches('#cSkin', SKINS, 'skin');
buildSwatches('#cHair', HAIRS, 'hair');
document.querySelectorAll('#cSex button').forEach((b) => (b.onclick = () => { draft.sex = b.dataset.v; if (draft.sex === 'm') draft.hijab = false; else draft.hijab = true; renderCreator(); }));
document.querySelectorAll('#cHijab button').forEach((b) => (b.onclick = () => { draft.hijab = b.dataset.v === '1'; renderCreator(); }));
$('#cName').addEventListener('input', (e) => { draft.name = e.target.value.replace(/[<>]/g, '').slice(0, 16); });
function openCreator(edit) {
  editing = edit;
  draft = { name: P.name, sex: P.look.sex, skin: P.look.skin, hair: P.look.hair, hijab: !!P.look.hijab };
  state = 'creator';
  $('#login').hidden = true;
  $('#hud').hidden = true;
  $('#creator').hidden = false;
  player.group.visible = false;
  renderCreator();
}
$('#btnCreate').onclick = () => {
  const name = draft.name.trim() || P.user.split('@')[0].slice(0, 16);
  P.name = name;
  P.look = { sex: draft.sex, skin: draft.skin, hair: draft.hair, hijab: draft.sex === 'f' && draft.hijab };
  store.set(P);
  startGame();
};

// ---------- Mula ----------
function startGame() {
  state = 'play';
  $('#login').hidden = true;
  $('#creator').hidden = true;
  $('#hud').hidden = false;
  player.group.visible = true;
  rebuildPlayer();
  player.x = clamp(P.pos[0], BOUNDS.minX, BOUNDS.maxX);
  player.z = clamp(P.pos[1], BOUNDS.minZ, BOUNDS.maxZ);
  if (!isUnlocked(zoneAt(player.x, player.z))) { player.x = 0; player.z = 6; }
  P.hp = clamp(P.hp, 1, hpMax(P.lv));
  curZone = -1;
  streak = 0;
  refreshGates();
  hud();
  setZone(zoneAt(player.x, player.z));
  yaw = Math.PI / 4;
  const h = $('#hint'); h.style.opacity = 1; setTimeout(() => (h.style.opacity = 0), 9000);
  if (P.lv >= JOB_LV && P.cls === 'novice') setTimeout(openJob, 800);
  save();
}
setInterval(() => { if (state === 'play') save(); }, 10000);
addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') save(); });
addEventListener('pagehide', () => { if (state === 'play') save(); });

// ---------- Gelung ----------
const clock = new THREE.Clock();
let T = 0, gateToast = 0;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();

function updatePlay(dt) {
  player.moving = false;
  if (!battle && !uiOpen()) {
    const iv = inputVec();
    let mx = 0, mz = 0, mag = 0;
    if (iv.len > 0.08) {
      chase = null; target = null; pendingTalk = null; marker.visible = false;
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      mx = rx * iv.x + fx * iv.y; mz = rz * iv.x + fz * iv.y; mag = iv.len;
    } else {
      let tp = null, stop = 0.3;
      if (chase && !chase.dead) { tp = chase.group.position; stop = 1.0; }
      else if (pendingTalk) { tp = pendingTalk.pos; stop = 2.2; }
      else if (target) tp = target;
      if (chase && chase.dead) chase = null;
      if (tp) {
        const dx = tp.x - player.x, dz = tp.z - player.z, d = Math.hypot(dx, dz);
        if (d > stop) { mx = dx / d; mz = dz / d; mag = 1; }
        else {
          if (target) { target = null; marker.visible = false; }
          if (pendingTalk) { const n = pendingTalk; pendingTalk = null; openDialog(n); }
        }
      }
    }
    if (mag > 0) {
      const l = Math.hypot(mx, mz);
      player.x += (mx / l) * SPEED * mag * dt;
      player.z += (mz / l) * SPEED * mag * dt;
      const want = Math.atan2(mx, mz);
      let da = want - player.rot; da = Math.atan2(Math.sin(da), Math.cos(da));
      player.rot += da * Math.min(1, dt * 14);
      player.moving = true;
    }
    // sempadan + gerbang
    player.x = clamp(player.x, BOUNDS.minX, BOUNDS.maxX);
    player.z = clamp(player.z, BOUNDS.minZ, BOUNDS.maxZ);
    for (let i = 2; i < ZONES.length; i++) {
      if (!isUnlocked(i) && player.x > gateX(i) - 0.8) {
        player.x = gateX(i) - 0.8;
        if (T - gateToast > 3) { gateToast = T; toast(`Gerbang tertutup. Kuasai ${Math.ceil(zoneWords(i - 1).length * UNLOCK_AT)} kalimah di zon sebelum ini.`, 2600); }
        break;
      }
    }
    // langgar Jeli
    for (const m of monsters) {
      if (!m.dead && m.cool <= 0 && Math.hypot(m.group.position.x - player.x, m.group.position.z - player.z) < 1.6) { startBattle(m); break; }
    }
  }
  player.group.position.set(player.x, 0, player.z);
  player.group.rotation.y = player.rot;
  animateAvatar(player.avatar, T, player.moving);

  // NPC berdekatan
  nearNpc = null;
  let nd = 3.4;
  for (const n of npcs) { const d = Math.hypot(n.pos.x - player.x, n.pos.z - player.z); if (d < nd) { nd = d; nearNpc = n; } }
  $('#btnAct').hidden = !nearNpc || !!battle || uiOpen();

  // penunjuk arah ke Jeli terdekat
  let best = null, bd = 1e9;
  for (const m of monsters) {
    if (m.dead || !isUnlocked(m.zone)) continue;
    const d = Math.hypot(m.group.position.x - player.x, m.group.position.z - player.z);
    if (d < bd) { bd = d; best = m; }
  }
  if (best && bd > 3 && !battle && !uiOpen()) {
    const dx = best.group.position.x - player.x, dz = best.group.position.z - player.z;
    const xs = dx * Math.cos(yaw) - dz * Math.sin(yaw), ys = -dx * Math.sin(yaw) - dz * Math.cos(yaw);
    $('#cArrow').style.transform = `rotate(${Math.atan2(xs, ys)}rad)`;
    $('#cTxt').textContent = `Jeli terdekat ${Math.round(bd)} m · langgar untuk soalan`;
    $('#compass').hidden = false;
  } else $('#compass').hidden = true;

  setZone(zoneAt(player.x, player.z));
  netTick(dt);

  if (marker.visible) { marker.material.opacity = 0.5 + Math.sin(T * 8) * 0.4; marker.scale.setScalar(1 + Math.sin(T * 8) * 0.1); }

  // kamera
  camLook.set(player.x, 1.3, player.z);
  const cp = Math.cos(PITCH);
  const want = new THREE.Vector3(player.x + Math.sin(yaw) * cp * dist, 1.3 + Math.sin(PITCH) * dist, player.z + Math.cos(yaw) * cp * dist);
  camPos.lerp(want, Math.min(1, dt * 8));
  camera.position.copy(camPos);
  camera.lookAt(camLook);
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  T += dt;
  if (state === 'creator') {
    if (pvAvatar) { pvAvatar.rotation.y += dt * 0.7; animateAvatar(pvAvatar, T, false); }
    renderer.render(pvScene, pvCam);
    return;
  }
  world.update(T);
  for (let i = monsters.length - 1; i >= 0; i--) {
    const m = monsters[i];
    m.update(dt, T);
    if (m.gone) { scene.remove(m.group); disposeObj(m.group); monsters.splice(i, 1); }
  }
  npcs.forEach((n, i) => { animateAvatar(n.avatar, T, false, i); n.mark.position.y = 3.4 + Math.sin(T * 3 + i) * 0.12; });
  remotes.update(dt, T);
  if (state === 'play') updatePlay(dt);
  else {
    // latar skrin log masuk
    camera.position.set(Math.cos(T * 0.08) * 34, 15, Math.sin(T * 0.08) * 34);
    camera.lookAt(0, 2, 0);
  }
  renderer.render(scene, camera);
}

// ---------- PWA ----------
let deferred = null;
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
  $('#btnInstall').hidden = false;
  $('#mInstall').hidden = false;
});
const doInstall = async () => {
  if (!deferred) return;
  deferred.prompt();
  await deferred.userChoice.catch(() => {});
  deferred = null;
  $('#btnInstall').hidden = true;
  $('#mInstall').hidden = true;
};
$('#btnInstall').onclick = doInstall;
$('#mInstall').onclick = doInstall;
const ios = (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) && !navigator.standalone;
if (ios) $('#iosNote').hidden = false;
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

clock.start();
frame();
