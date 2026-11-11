// Hundred Ghosts - simulation bundle (physics + stages + bots).
// This file is the versioned part of the game. tools/cut.sh copies it to versions/vN.js
// so that any old version can be replayed with the same seed.
(function (root) {
'use strict';
const VERSION = 12;
const T = 32, ROWS = 17, LIMIT = 2700; // tile px, rows, stage time limit in frames (45 s at 60 Hz)
const PH = { w: 18, h: 26, runMax: 4, accG: 0.6, accA: 0.4, fric: 0.5, airFric: 0.12,
  grav: 0.55, jumpV: 10.2, cutV: 3.5, maxFall: 12, coyote: 6, buffer: 6, padV: 15, crumble: 24 };

// ---------- deterministic random ----------
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(a, b) { let h = Math.imul(a | 0, 0x9E3779B1) ^ Math.imul((b | 0) + 0x7F4A7C15, 0x85EBCA6B); h = Math.imul(h ^ h >>> 16, 0x45d9f3b); h = Math.imul(h ^ h >>> 16, 0x45d9f3b); return (h ^ h >>> 16) >>> 0; }
function gauss(rng) { const u = Math.max(1e-9, rng()), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// ---------- stage builder ----------
// Tiles: 0 empty, 1 solid, 2 spike, 3 crumble, 4 bounce pad. All builder units are tiles.
function build(name, hue, fn) {
  const cols = []; const st = { name, hue, saws: [], plats: [], lasers: [] };
  let x = 0, h = 12;
  const col = cx => cols[cx] || (cols[cx] = new Uint8Array(ROWS));
  const fill = (cx, from) => { const c = col(cx); for (let r = from; r < ROWS; r++) c[r] = 1; };
  const b = {
    run(n) { for (let i = 0; i < n; i++) fill(x++, h); },
    gap(n) { for (let i = 0; i < n; i++) col(x++); },
    up(k) { h -= k; }, down(k) { h += k; },
    spikes(n) { for (let i = 0; i < n; i++) { fill(x, h); col(x)[h - 1] = 2; x++; } },
    crumble(n) { for (let i = 0; i < n; i++) { col(x)[h] = 3; x++; } },
    pad() { fill(x, h + 1); col(x)[h] = 4; x++; },
    block(dx, dy, w, hh) { for (let i = 0; i < w; i++) for (let j = 0; j < hh; j++) { const r = h + dy + j; if (r >= 0 && r < ROWS) col(x + dx + i)[r] = 1; } },
    ceil(n, clear) { b.block(0, -clear - 2, n, 2); },
    saw(o) { st.saws.push({ x: (x + (o.dx || 0) + 0.5) * T, y: (h - (o.dy || 0.5)) * T, r: o.r || 14, ax: (o.ax || 0) * T, ay: (o.ay || 0) * T, orbit: (o.orbit || 0) * T, period: o.period || 120, phase: o.phase || 0 }); },
    plat(o) { st.plats.push({ x: (x + (o.dx || 0)) * T, y: (h + (o.dy || 0)) * T, w: (o.w || 3) * T, h: 10, ax: (o.ax || 0) * T, ay: (o.ay || 0) * T, period: o.period || 180, phase: o.phase || 0 }); },
    laser(o) { o = o || {}; st.lasers.push({ x: (x + (o.dx || 0) + 0.5) * T, y0: (h - (o.hgt || 5)) * T, y1: h * T, period: o.period || 120, on: o.on || 60, phase: o.phase || 0 }); },
    goal() { st.goalX = (x + 2) * T; st.goalY = h * T; b.run(8); },
  };
  st.spawn = { x: 2 * T, y: h * T - PH.h };
  fn(b);
  st.W = cols.length; st.tiles = new Uint8Array(st.W * ROWS);
  for (let cx = 0; cx < st.W; cx++) if (cols[cx]) st.tiles.set(cols[cx], cx * ROWS);
  for (const s of st.saws) { const m = Math.abs(s.ax) + s.orbit + s.r + 8; s.minX = Math.min(s.x, s.x + s.ax) - s.orbit - s.r - 8; s.maxX = Math.max(s.x, s.x + s.ax) + s.orbit + s.r + 8; }
  for (const p of st.plats) { p.minX = Math.min(p.x, p.x + p.ax) - 8; p.maxX = Math.max(p.x, p.x + p.ax) + p.w + 8; }
  return st;
}

const STAGES = [
  build('First Steps', 222, b => {
    b.run(10); b.gap(3); b.run(6); b.gap(4); b.run(5); b.up(1); b.run(5); b.up(1); b.run(4); b.down(2); b.run(4);
    b.spikes(2); b.run(5); b.gap(4); b.run(6); b.spikes(3); b.run(6); b.up(2); b.run(3); b.gap(4); b.down(2); b.run(4); b.goal();
  }),
  build('Spike Garden', 280, b => {
    b.run(8); b.spikes(2); b.run(6); b.spikes(2); b.run(5); b.up(1); b.run(4); b.spikes(2); b.run(3); b.gap(3); b.run(3);
    b.spikes(1); b.run(4); b.spikes(1); b.run(4); b.spikes(1); b.run(4); b.down(1); b.run(3);
    b.ceil(6, 3); b.run(2); b.spikes(1); b.run(3); b.run(4); b.up(2); b.run(4); b.spikes(3); b.run(3); b.gap(4); b.down(1); b.run(3); b.spikes(2); b.run(3); b.goal();
  }),
  build('Saw Mill', 22, b => {
    b.run(8); b.saw({ dy: 0.6, ay: -3, period: 150 }); b.run(6); b.saw({ dy: 0.5, ax: 4, period: 220 }); b.run(8); b.gap(3); b.run(4);
    b.saw({ dx: 1, dy: 2, ay: -3, period: 180 }); b.gap(3); b.run(5); b.up(1);
    b.saw({ dx: 4, dy: 0.6, ay: -3, period: 150 }); b.run(10);
    b.saw({ dx: 3, dy: 1.5, orbit: 2, period: 180 }); b.run(8); b.gap(4); b.run(3); b.saw({ dy: 0.5, ax: 4, period: 180 }); b.run(7); b.goal();
  }),
  build('Ferry Lines', 190, b => {
    b.run(8); b.plat({ dx: 0.5, w: 4, ax: 4, period: 200 }); b.gap(9); b.run(5);
    b.plat({ dx: 0.5, w: 3, ay: -5, period: 220 }); b.gap(4); b.up(5); b.run(6); b.gap(3); b.down(5); b.run(4);
    b.plat({ dx: 0.5, w: 3, ax: 3, period: 160 }); b.plat({ dx: 6.5, w: 4, ax: 3.5, period: 160, phase: 80 }); b.gap(14); b.run(5);
    b.plat({ dx: 0.5, w: 4, ax: 5.5, period: 240 }); b.gap(10); b.down(1); b.run(4); b.goal();
  }),
  build('Crumble Bridge', 36, b => {
    b.run(8); b.crumble(5); b.run(3); b.crumble(3); b.gap(2); b.crumble(3); b.run(3); b.up(1); b.crumble(4); b.gap(3); b.crumble(2); b.gap(3); b.crumble(2); b.run(4);
    b.saw({ dx: 1, dy: 0.5, ax: 4, period: 140 }); b.crumble(6); b.run(4); b.down(1); b.crumble(1); b.gap(2); b.crumble(1); b.gap(2); b.crumble(1); b.gap(2); b.run(4); b.goal();
  }),
  build('Spring Loaded', 130, b => {
    b.run(8); b.pad(); b.up(5); b.run(4); b.down(3); b.run(5); b.pad(); b.gap(5); b.run(2); b.spikes(1); b.run(3); b.pad(); b.spikes(5); b.run(4);
    b.up(2); b.run(3); b.saw({ dx: 3.5, dy: 3, ay: -3, period: 120 }); b.saw({ dx: 9.5, dy: 3, ay: -3, period: 120, phase: 30 }); b.pad(); b.gap(5); b.pad(); b.gap(5); b.run(5); b.pad(); b.up(5); b.run(4); b.goal();
  }),
  build('Laser Gate', 320, b => {
    b.run(8); b.laser(); b.run(6); b.laser({ phase: 60 }); b.run(3); b.laser({ phase: 40 }); b.run(3); b.laser({ phase: 80 }); b.run(6); b.gap(3); b.run(2);
    b.laser({ period: 100, on: 55 }); b.run(2); b.gap(3); b.run(5); b.spikes(2); b.run(1); b.laser(); b.run(5); b.up(1);
    b.laser({ period: 70, on: 35 }); b.run(3); b.laser({ period: 70, on: 35, phase: 35 }); b.run(3); b.laser({ period: 70, on: 35 }); b.run(6);
    b.saw({ dy: 0.5, ax: 5, period: 150 }); b.run(6); b.laser({ on: 85 }); b.run(4); b.goal();
  }),
  build('Gauntlet', 0, b => {
    b.run(6); b.spikes(2); b.run(3); b.gap(3); b.run(2); b.saw({ dx: 2, dy: 0.6, ay: -3, period: 100 }); b.run(5); b.crumble(4);
    b.plat({ dx: 0.5, w: 3, ax: 4, period: 180 }); b.gap(8); b.run(3); b.laser(); b.run(3); b.pad(); b.up(4); b.run(5); b.spikes(1); b.run(2); b.gap(4); b.down(2); b.run(3);
    b.crumble(2); b.gap(2); b.crumble(2); b.run(5); b.laser({ period: 120, on: 50 }); b.run(4); b.saw({ dx: 2, dy: 0.6, ay: -3, period: 150 }); b.run(6); b.spikes(2); b.run(3);
    b.plat({ dx: 0.5, w: 3, ay: -4, period: 200 }); b.gap(4); b.up(4); b.run(3); b.laser(); b.run(2); b.goal();
  }),
];
// Bot gym: a test track used only to develop the bot script. Not one of the 8 stages, not measured.
const GYM = build('Bot Gym', 160, b => {
  b.run(8); b.gap(3); b.run(5); b.up(2); b.run(4); b.spikes(2); b.run(5); b.saw({ dy: 0.6, ay: -3, period: 100 }); b.run(6);
  b.plat({ dx: 0.5, w: 3, ax: 4, period: 200 }); b.gap(8); b.run(5); b.crumble(4); b.run(4); b.pad(); b.up(4); b.run(4); b.laser(); b.run(3); b.goal();
});

// ---------- world queries ----------
function tile(st, tx, ty) { if (tx < 0) return 1; if (tx >= st.W || ty < 0 || ty >= ROWS) return 0; return st.tiles[tx * ROWS + ty]; }
let PX = 0, PY = 0; // scratch outputs (no allocation in the hot loop)
function osc(e, t) { return 0.5 - 0.5 * Math.cos(2 * Math.PI * ((t + e.phase) / e.period)); }
function sawPos(s, t) { if (s.orbit) { const a = 2 * Math.PI * ((t + s.phase) / s.period); PX = s.x + Math.cos(a) * s.orbit; PY = s.y + Math.sin(a) * s.orbit; } else { const k = osc(s, t); PX = s.x + s.ax * k; PY = s.y + s.ay * k; } return API; }
function platPos(p, t) { const k = osc(p, t); PX = p.x + p.ax * k; PY = p.y + p.ay * k; return API; }
function laserOn(l, t) { return (((t + l.phase) % l.period) + l.period) % l.period < l.on; }

// ---------- player ----------
function newPlayer(st) { return { x: st.spawn.x, y: st.spawn.y, vx: 0, vy: 0, ground: false, coy: 0, buf: 0, jp: false, boost: false, ride: -1, alive: true, done: false, cause: '', face: 1, cr: [], ev: 0 }; }
function clonePlayer(p) { return { x: p.x, y: p.y, vx: p.vx, vy: p.vy, ground: p.ground, coy: p.coy, buf: p.buf, jp: p.jp, boost: p.boost, ride: p.ride, alive: true, done: false, cause: '', face: p.face, cr: p.cr.slice(), ev: 0 }; }
function solid(st, p, tx, ty, t) {
  const v = tile(st, tx, ty);
  if (v === 1 || v === 4) return true;
  if (v === 3) { const idx = tx * ROWS + ty, cr = p.cr; for (let i = 0; i < cr.length; i += 2) if (cr[i] === idx) return t - cr[i + 1] <= PH.crumble; return true; }
  return false;
}
// One fixed step. t = real frame (crumble timers), th = frame used for moving hazards
// (bots plan with th = t - lag for saws and lasers; platforms use t since v4. The game calls it with th = t).
// p.ev bits: 1 jumped, 2 landed, 4 bounced.
function step(st, p, dir, jump, t, th) {
  if (!p.alive || p.done) return;
  p.ev = 0;
  const w = PH.w, h = PH.h;
  let carry = 0;
  if (p.ride >= 0) { const pl = st.plats[p.ride]; platPos(pl, t - 1); const ox = PX; platPos(pl, t); carry = PX - ox; p.y = PY - h; p.vy = 0; }
  if (dir) { p.vx += dir * (p.ground ? PH.accG : PH.accA); if (p.vx > PH.runMax) p.vx = PH.runMax; if (p.vx < -PH.runMax) p.vx = -PH.runMax; p.face = dir; }
  else { const f = p.ground ? PH.fric : PH.airFric; if (p.vx > f) p.vx -= f; else if (p.vx < -f) p.vx += f; else p.vx = 0; }
  if (jump && !p.jp) p.buf = PH.buffer;
  p.jp = jump;
  if (p.buf > 0 && p.coy > 0) { p.vy = -PH.jumpV; p.buf = 0; p.coy = 0; p.ground = false; p.ride = -1; p.boost = false; p.ev |= 1; }
  else if (p.buf > 0) p.buf--;
  if (!jump && !p.boost && p.vy < -PH.cutV) p.vy = -PH.cutV;
  p.vy += PH.grav; if (p.vy > PH.maxFall) p.vy = PH.maxFall;

  // horizontal move + tile collision
  const mv = p.vx + carry; let nx = p.x + mv;
  if (mv !== 0) {
    const y0 = Math.floor(p.y / T), y1 = Math.floor((p.y + h - 0.001) / T);
    if (mv > 0) { const tx = Math.floor((nx + w - 0.001) / T); for (let ty = y0; ty <= y1; ty++) if (solid(st, p, tx, ty, t)) { nx = tx * T - w; p.vx = 0; break; } }
    else { const tx = Math.floor(nx / T); for (let ty = y0; ty <= y1; ty++) if (solid(st, p, tx, ty, t)) { nx = (tx + 1) * T; p.vx = 0; break; } }
  }
  p.x = nx;

  // vertical move + tile collision
  const wasG = p.ground, prevB = p.y + h; let ny = p.y + p.vy; p.ground = false;
  const x0 = Math.floor(p.x / T), x1 = Math.floor((p.x + w - 0.001) / T);
  if (p.vy > 0) {
    const ty = Math.floor((ny + h - 0.001) / T); let hit = false, pad = false;
    for (let tx = x0; tx <= x1; tx++) if (solid(st, p, tx, ty, t)) {
      hit = true; const v = tile(st, tx, ty);
      if (v === 4) pad = true;
      if (v === 3) { const idx = tx * ROWS + ty; let known = false; for (let i = 0; i < p.cr.length; i += 2) if (p.cr[i] === idx) known = true; if (!known) p.cr.push(idx, t); }
    }
    if (hit) { ny = ty * T - h; if (pad) { p.vy = -PH.padV; p.boost = true; p.ev |= 4; } else { p.vy = 0; p.ground = true; if (!wasG) p.ev |= 2; } }
  } else if (p.vy < 0) {
    const ty = Math.floor(ny / T);
    for (let tx = x0; tx <= x1; tx++) if (solid(st, p, tx, ty, t)) { ny = (ty + 1) * T; p.vy = 0; break; }
  }
  // one-way moving platforms
  let ride = -1;
  if (p.vy >= 0 && !p.ground) {
    const plats = st.plats;
    for (let i = 0; i < plats.length; i++) {
      const pl = plats[i]; if (p.x + w < pl.minX || p.x > pl.maxX) continue;
      platPos(pl, t); const lx = PX, top = PY;
      if (p.x + w <= lx || p.x >= lx + pl.w) continue;
      let ok = p.ride === i;
      if (!ok) { platPos(pl, t - 1); ok = prevB <= PY + 1 && ny + h >= top; }
      if (ok) { ny = top - h; p.vy = 0; p.ground = true; ride = i; if (!wasG) p.ev |= 2; break; }
    }
  }
  p.ride = ride;
  p.y = ny;
  if (p.ground) p.coy = PH.coyote; else if (p.coy > 0) p.coy--;

  // hazards
  if (p.y > ROWS * T + 16) { p.alive = false; p.cause = 'pit'; return; }
  const ty0 = Math.floor(p.y / T), ty1 = Math.floor((p.y + h - 0.001) / T);
  for (let tx = x0; tx <= x1; tx++) for (let ty = ty0; ty <= ty1; ty++) if (tile(st, tx, ty) === 2) {
    const sx = tx * T + 5, sy = ty * T + 10;
    if (p.x + w > sx && p.x < sx + 22 && p.y + h > sy) { p.alive = false; p.cause = 'spike'; return; }
  }
  const saws = st.saws;
  for (let i = 0; i < saws.length; i++) {
    const s = saws[i]; if (p.x + w < s.minX || p.x > s.maxX) continue;
    sawPos(s, th);
    const cx = PX < p.x ? p.x : PX > p.x + w ? p.x + w : PX, cy = PY < p.y ? p.y : PY > p.y + h ? p.y + h : PY;
    const dx = PX - cx, dy = PY - cy, r = s.r - 2;
    if (dx * dx + dy * dy < r * r) { p.alive = false; p.cause = 'saw'; return; }
  }
  const ls = st.lasers;
  for (let i = 0; i < ls.length; i++) {
    const l = ls[i];
    if (p.x + w > l.x - 3 && p.x < l.x + 3 && p.y + h > l.y0 && p.y < l.y1 && laserOn(l, th)) { p.alive = false; p.cause = 'laser'; return; }
  }
  if (p.x + w / 2 >= st.goalX) p.done = true;
}

// ---------- scripted bots ----------
// A bot is a script, not a learned policy. At each decision it tries a fixed list of simple
// actions (run, wait, jump after d frames with a short or long hold) in a forward roll-out of
// the game step, and takes the one that gets furthest without a death. Skill (0..1) sets the
// noise: slow decisions, a late view of moving hazards, and an error on the jump frame.
// Risk (0..1) sets how much timing margin the bot wants before it commits to a jump.
let DIR = 0, JUMP = false;
function planInput(pl, t) { DIR = pl.stop && t >= pl.stop ? 0 : pl.dir; JUMP = t >= pl.js && t < pl.he; }
const JUMP_D = [0, 2, 4, 7, 10, 14, 19, 25], JUMP_HOLD = [6, 12, 22];
function rollout(st, p0, pl, t0, lag, settle) {
  const p = clonePlayer(p0); const isJump = pl.js >= t0 && pl.he > pl.js;
  let after = -1, f = 0;
  for (; f < 150; f++) {
    const t = t0 + f; planInput(pl, t); step(st, p, DIR, JUMP, t, t - lag);
    if (!p.alive) return -1e6 + f * 1000;
    if (p.done) return 1e6 - f;
    if (after >= 0) { if (--after <= 0) break; continue; }
    const acted = isJump ? t > pl.js + 2 : f >= pl.len;
    if (acted && p.ground) after = settle;
  }
  // progress against a full-speed run; standing, going back or ending against a wall costs extra
  return p.x - PH.runMax * f - (isJump ? 8 : 0) - (pl.dir !== 1 ? 60 : pl.stop ? 30 : p.vx === 0 ? 100 : 0);
}
function makeBot(i, n, seed) {
  const rng = mulberry32(hash2(seed, i)); const skill = n > 1 ? i / (n - 1) : 0.5;
  return { i, skill, risk: rng(), rng, lag: Math.round((1 - skill) * 9), sigma: 0.4 + (1 - skill) * 3.6, period: 5 + Math.round((1 - skill) * 10),
    react: 1 + Math.round((1 - skill) * 4), lapse: (1 - skill) * 0.04, start: Math.floor(rng() * 45), next: 0,
    plan: { dir: 0, js: -1, he: -1, len: 0 }, ax: 0, at: 0, stuck: false };
}
function think(st, b, p, t) {
  if (b.rng() < b.lapse) { b.next = t + b.period; return; }
  const P = b.period, cands = [], cur = b.plan;
  const air = !p.ground && p.coy <= 0;
  if (air) {
    for (const dir of [1, 0, -1]) { cands.push({ dir, js: cur.js, he: cur.he, len: 0 }); if (cur.he > t) cands.push({ dir, js: cur.js, he: t, len: 0 }); }
  } else {
    cands.push({ dir: 1, js: -1, he: -1, len: 2 * P });
    for (const d of JUMP_D) for (const k of JUMP_HOLD) cands.push({ dir: 1, js: t + d, he: t + d + k, len: 0, d, k });
    cands.push({ dir: 0, js: -1, he: -1, len: P });
    cands.push({ dir: 0, js: t, he: t + 22, len: 0, d: 0, k: 22 });
    cands.push({ dir: -1, js: -1, he: -1, len: P });
    cands.push({ dir: -1, js: t, he: t + 22, len: 0, d: 0, k: 22 });
  }
  if (!air) { // v2: "take a few steps and stop" (a human does this between two hazards)
    cands.push({ dir: 1, js: -1, he: -1, len: P + 10, stop: t + P });
    cands.push({ dir: 1, js: -1, he: -1, len: 2 * P + 10, stop: t + 2 * P });
    // v2: no progress for 5 s -> go back about 3 tiles and try again with a run-up
    if (t - b.at > 300) { const back = { dir: -1, js: -1, he: -1, len: 40 }; b.at = t; if (rollout(st, p, back, t, b.lag, 2) > -1e5) { b.plan = back; b.next = t + 40; return; } }
  }
  for (const c of cands) c.score = rollout(st, p, c, t, b.lag, b.react + 1);
  // prefer a jump frame whose neighbours in the list also work (the middle of the window, not its edge)
  const bonus = (1 - b.risk) * 10;
  for (let i = 0; i < cands.length; i++) { const c = cands[i]; if (c.d === undefined || c.dir !== 1 || c.score < -1e5) continue; c.adj = 0;
    for (const j of [i - JUMP_HOLD.length, i + JUMP_HOLD.length]) { const o = cands[j]; if (o && o.d !== undefined && o.dir === 1 && o.k === c.k && o.score > -1e5) c.adj += bonus; } }
  for (const c of cands) if (c.adj) c.score += c.adj;
  cands.sort((a, c) => c.score - a.score);
  let pick = cands[0];
  if (!air && b.risk < 0.7) { // careful bots want the jump to work 2 frames late (and early) too
    for (const c of cands) {
      if (c.score < -1e5) break;
      if (c.d === undefined) { pick = c; break; }
      let ok = rollout(st, p, { dir: c.dir, js: c.js + 2, he: c.he + 2, len: 0 }, t, b.lag, b.react + 1) > -1e5;
      if (ok && b.risk < 0.4 && c.d >= 2) ok = rollout(st, p, { dir: c.dir, js: c.js - 2, he: c.he - 2, len: 0 }, t, b.lag, b.react + 1) > -1e5;
      if (ok) { pick = c; break; }
    }
  }
  const pl = { dir: pick.dir, js: pick.js, he: pick.he, len: pick.len, stop: pick.stop || 0 };
  b.next = t + P + Math.floor(b.rng() * 3);
  if (pick.d !== undefined) { // a new jump: add the timing error of this bot
    const js = Math.max(t, pick.js + Math.round(gauss(b.rng) * b.sigma));
    pl.js = js; pl.he = js + Math.max(2, pick.k + Math.round(gauss(b.rng) * b.sigma));
    if (js - t <= 2 * P) b.next = js + 1 + Math.floor(b.rng() * 2); // committed: no new decision before take-off
  }
  b.plan = pl;
}

function createSwarm(stageIndex, seed, n) {
  n = n || 100;
  const st = stageIndex === 'gym' ? GYM : STAGES[stageIndex];
  const bots = []; for (let i = 0; i < n; i++) { const b = makeBot(i, n, seed); b.p = newPlayer(st); b.ax = b.p.x; bots.push(b); }
  const sw = { version: VERSION, stageIndex, seed, n, st, bots, t: 0, deaths: [], events: [], finished: 0, dead: 0, over: false, step: () => stepSwarm(sw) };
  return sw;
}
function botStep(st, b, p, t) {
  if (t < b.start) step(st, p, 0, false, t, t);
  else { if (t >= b.next) think(st, b, p, t); planInput(b.plan, t); step(st, p, DIR, JUMP, t, t); if (p.ev & 2) b.next = Math.min(b.next, t + b.react); }
}
function stepSwarm(sw) {
  if (sw.over) return;
  const st = sw.st, t = sw.t; let active = 0;
  for (const b of sw.bots) {
    const p = b.p; if (!p.alive || p.done) continue;
    active++;
    const wasRide = p.ride;
    botStep(st, b, p, t);
    // audit: things that must never happen
    if (p.alive) {
      const x0 = Math.floor((p.x + 0.5) / T), x1 = Math.floor((p.x + PH.w - 0.5) / T), y0 = Math.floor((p.y + 0.5) / T), y1 = Math.floor((p.y + PH.h - 0.5) / T);
      if (!b.embedded) for (let tx = x0; tx <= x1; tx++) for (let ty = y0; ty <= y1; ty++) if (solid(st, p, tx, ty, t)) { b.embedded = true; sw.events.push({ type: 'embedded', i: b.i, t, x: p.x, y: p.y }); }
      if (wasRide >= 0 && p.ride < 0 && !(p.ev & 1)) { const pl = st.plats[wasRide]; platPos(pl, t); if (p.x + PH.w > PX + 2 && p.x < PX + pl.w - 2 && p.y + PH.h > PY + 2) sw.events.push({ type: 'fallthrough', i: b.i, t, x: p.x, y: p.y }); }
      if (Math.abs(p.x - b.ax) > 24) { b.ax = p.x; b.at = t; }
      else if (!b.stuck && t - b.at > 480) { b.stuck = true; sw.events.push({ type: 'stuck', i: b.i, t, x: p.x, y: p.y }); }
    }
    if (!p.alive) { sw.dead++; sw.deaths.push({ x: Math.round(p.x + PH.w / 2), y: Math.round(Math.min(p.y + PH.h / 2, ROWS * T - 6)), c: p.cause, t, i: b.i }); }
    else if (p.done) { sw.finished++; b.tDone = t; }
  }
  sw.t++;
  if (active === 0) sw.over = true;
  else if (sw.t >= LIMIT) { for (const b of sw.bots) { const p = b.p; if (p.alive && !p.done) { p.alive = false; p.cause = 'timeout'; sw.dead++; sw.deaths.push({ x: Math.round(p.x + PH.w / 2), y: Math.round(p.y + PH.h / 2), c: 'timeout', t: sw.t, i: b.i }); } } sw.over = true; }
}
// tiers: low = bots 0..34, mid = 35..64, high = 65..99 (for n = 100)
function tierOf(b, n) { const k = b.i / n; return k < 0.35 ? 0 : k < 0.65 ? 1 : 2; }
function swarmStats(sw) {
  const pass = [0, 0, 0], tot = [0, 0, 0], causes = {}; let tsum = 0;
  for (const b of sw.bots) { const k = tierOf(b, sw.n); tot[k]++; if (b.p.done) { pass[k]++; tsum += b.tDone; } }
  for (const d of sw.deaths) causes[d.c] = (causes[d.c] || 0) + 1;
  const ev = { stuck: 0, embedded: 0, fallthrough: 0 }; for (const e of sw.events) ev[e.type]++;
  return { n: sw.n, frames: sw.t, pass: sw.finished, passLow: pass[0], passMid: pass[1], passHigh: pass[2], nLow: tot[0], nMid: tot[1], nHigh: tot[2],
    avgFinishSec: sw.finished ? +(tsum / sw.finished / 60).toFixed(2) : null, causes, stuck: ev.stuck, embedded: ev.embedded, fallthrough: ev.fallthrough };
}

const API = { VERSION, T, ROWS, LIMIT, PH, STAGES, GYM, tile, solid, sawPos, platPos, laserOn, newPlayer, step, makeBot, botStep, createSwarm, swarmStats, tierOf, mulberry32,
  get PX() { return PX; }, get PY() { return PY; } };
root.HG_VERSIONS = root.HG_VERSIONS || {}; root.HG_VERSIONS[VERSION] = API; root.HG_SIM = API;
if (typeof module !== 'undefined') module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
