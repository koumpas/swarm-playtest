// Latchkey - simulation bundle (movement + stages + bots).
// Top-down "dodge and collect": take every key, then reach the exit. Contact with a hazard = death.
// This file is the versioned part of the game. tools/cut.sh copies it to versions/vN.js.
(function (root) {
'use strict';
const VERSION = 5;
const T = 32, COLS = 30, ROWS = 15, LIMIT = 2700; // tile px, arena size in tiles, time limit in frames (45 s at 60 Hz)
const PH = { half: 8, speed: 3, acc: 0.6, grab: 15 }; // player box half-size px, px/frame, px/frame^2, key pick-up radius px

// ---------- deterministic random ----------
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(a, b) { let h = Math.imul(a | 0, 0x9E3779B1) ^ Math.imul((b | 0) + 0x7F4A7C15, 0x85EBCA6B); h = Math.imul(h ^ h >>> 16, 0x45d9f3b); h = Math.imul(h ^ h >>> 16, 0x45d9f3b); return (h ^ h >>> 16) >>> 0; }
function gauss(rng) { const u = Math.max(1e-9, rng()), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// ---------- stage builder ----------
// All builder units are tiles. Positions of spawn, key, exit, drone and orbiter are tile cells (the thing sits at the cell centre).
// drone: goes from (x,y) to (x+ax,y+ay) and back, one full cycle in `period` frames.
// orbiter: circles (x,y) at radius `rad`, one turn in `period` frames. zap: a floor rectangle that is deadly for `on` frames of each `period`.
function build(name, hue, fn) {
  const st = { name, hue, tiles: new Uint8Array(COLS * ROWS), keys: [], drones: [], zaps: [], spawn: { x: 2.5 * T, y: 7.5 * T }, exit: { x: 27.5 * T, y: 7.5 * T } };
  const c = v => (v + 0.5) * T;
  const b = {
    wall(x, y, w, h) { for (let i = 0; i < (w || 1); i++) for (let j = 0; j < (h || 1); j++) if (x + i >= 0 && x + i < COLS && y + j >= 0 && y + j < ROWS) st.tiles[(y + j) * COLS + x + i] = 1; },
    spawn(x, y) { st.spawn = { x: c(x), y: c(y) }; },
    key(x, y) { st.keys.push({ x: c(x), y: c(y) }); },
    exit(x, y) { st.exit = { x: c(x), y: c(y) }; },
    drone(o) { st.drones.push({ kind: 'drone', x: c(o.x), y: c(o.y), ax: (o.ax || 0) * T, ay: (o.ay || 0) * T, orbit: 0, turn: 1, period: o.period || 180, phase: o.phase || 0, r: o.r || 12 }); },
    orbiter(o) { st.drones.push({ kind: 'orbiter', x: c(o.x), y: c(o.y), ax: 0, ay: 0, orbit: (o.rad || 2) * T, turn: o.ccw ? -1 : 1, period: o.period || 180, phase: o.phase || 0, r: o.r || 12 }); },
    zap(o) { st.zaps.push({ x: o.x * T, y: o.y * T, w: (o.w || 1) * T, h: (o.h || 1) * T, period: o.period || 120, on: o.on || 60, phase: o.phase || 0 }); },
  };
  b.wall(0, 0, COLS, 1); b.wall(0, ROWS - 1, COLS, 1); b.wall(0, 0, 1, ROWS); b.wall(COLS - 1, 0, 1, ROWS);
  fn(b);
  st.allKeys = (1 << st.keys.length) - 1;
  st.fields = st.keys.map(k => field(st, k.x, k.y)); st.fields.push(field(st, st.exit.x, st.exit.y)); // index keys.length = the exit
  return st;
}
function solid(st, cx, cy) { return cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS || st.tiles[cy * COLS + cx] === 1; }
// walking distance (in tiles) from every cell to one target cell; 8 directions, no cutting of wall corners
function field(st, px, py) {
  const F = new Float32Array(COLS * ROWS).fill(1e6), done = new Uint8Array(COLS * ROWS);
  F[Math.floor(py / T) * COLS + Math.floor(px / T)] = 0;
  for (;;) {
    let u = -1, best = 1e6; for (let i = 0; i < F.length; i++) if (!done[i] && F[i] < best) { best = F[i]; u = i; }
    if (u < 0) break; done[u] = 1; const ux = u % COLS, uy = (u / COLS) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const nx = ux + dx, ny = uy + dy; if (solid(st, nx, ny)) continue;
      if (dx && dy && (solid(st, ux + dx, uy) || solid(st, ux, uy + dy))) continue;
      const v = best + (dx && dy ? 1.4142 : 1), n = ny * COLS + nx; if (v < F[n]) F[n] = v;
    }
  }
  return F;
}

const STAGES = [
  build('Open Floor', 205, b => {
    b.spawn(2, 7); b.key(5, 2); b.key(12, 12); b.key(19, 2); b.key(25, 12); b.exit(27, 2);
    b.wall(8, 6, 2, 2); b.wall(15, 6, 2, 2); b.wall(22, 6, 2, 2);
    b.drone({ x: 8.5, y: 1, ay: 4, period: 200 }); b.drone({ x: 8.5, y: 9, ay: 4, period: 200, phase: 50 });
    b.drone({ x: 15.5, y: 1, ay: 4, period: 180, phase: 90 }); b.drone({ x: 15.5, y: 9, ay: 4, period: 180 });
    b.drone({ x: 22.5, y: 1, ay: 4, period: 160 }); b.drone({ x: 22.5, y: 9, ay: 4, period: 160, phase: 40 });
  }),
  build('Three Lanes', 150, b => {
    b.spawn(2, 2); b.key(14, 2); b.key(20, 7); b.key(8, 7); b.key(15, 12); b.exit(27, 12);
    b.wall(1, 4, 24, 2); b.wall(5, 9, 24, 2);
    b.drone({ x: 8, y: 1, ay: 2, period: 110 });
    b.drone({ x: 6, y: 7, ax: 17, period: 420 }); b.drone({ x: 14, y: 6, ay: 2, period: 100 }); b.drone({ x: 26.5, y: 4.5, ax: 0, ay: 0.01, period: 100, r: 10 });
    b.drone({ x: 9, y: 11, ay: 2, period: 96 }); b.drone({ x: 21, y: 11, ay: 1.6, period: 96, phase: 24 }); b.orbiter({ x: 15, y: 12, rad: 1.2, period: 130, r: 9 });
  }),
  build('Orbit Room', 285, b => {
    b.spawn(2, 7); b.key(7, 3); b.key(7, 11); b.key(15, 7); b.key(23, 3); b.key(23, 11); b.exit(27, 1);
    b.wall(11, 1, 1, 11); b.wall(19, 3, 1, 11);
    b.orbiter({ x: 7, y: 3, rad: 1.8, period: 150 }); b.orbiter({ x: 7, y: 11, rad: 1.8, period: 150, ccw: true, phase: 40 });
    b.orbiter({ x: 15, y: 7, rad: 2, period: 140 }); b.orbiter({ x: 15, y: 7, rad: 2, period: 140, phase: 70 }); b.orbiter({ x: 15, y: 7, rad: 4, period: 260, ccw: true });
    b.orbiter({ x: 23, y: 3, rad: 1.8, period: 120 }); b.drone({ x: 19, y: 1, ay: 1, period: 90 }); b.orbiter({ x: 23, y: 11, rad: 1.8, period: 120, ccw: true, phase: 30 });
  }),
  build('Zap Gates', 20, b => {
    b.spawn(2, 2); b.key(4, 7); b.key(10, 7); b.key(17, 7); b.key(18, 12); b.key(25, 7); b.exit(27, 2);
    b.wall(7, 1, 1, 10); b.wall(14, 4, 1, 10); b.wall(21, 1, 1, 10);
    b.zap({ x: 7, y: 11, w: 1, h: 3, period: 120, on: 60 }); b.zap({ x: 14, y: 1, w: 1, h: 3, period: 120, on: 60, phase: 30 }); b.zap({ x: 21, y: 11, w: 1, h: 3, period: 100, on: 55 });
    b.drone({ x: 1.5, y: 5, ax: 4.5, period: 150 }); b.orbiter({ x: 10, y: 7, rad: 1.6, period: 120 });
    b.drone({ x: 16, y: 4, ay: 5, period: 150 }); b.drone({ x: 19, y: 9, ay: -5, period: 150, phase: 37 });
    b.orbiter({ x: 25, y: 7, rad: 2, period: 130 }); b.orbiter({ x: 25, y: 7, rad: 2, period: 130, phase: 65 }); b.drone({ x: 23, y: 3, ax: 5, period: 170 });
  }),
];
// Bot gym: a test arena used only to develop the bot script. It has each mechanic once. Not one of the 4 stages, not measured.
const GYM = build('Bot Gym', 100, b => {
  b.spawn(2, 7); b.key(8, 3); b.key(20, 11); b.exit(27, 7);
  b.wall(5, 5, 3, 2); b.wall(14, 1, 1, 5); b.wall(14, 9, 1, 5);
  b.orbiter({ x: 8, y: 3, rad: 1.6, period: 140 }); b.zap({ x: 14, y: 6, w: 1, h: 3, period: 120, on: 60 });
  b.drone({ x: 17, y: 8, ay: 5, period: 150 }); b.drone({ x: 22, y: 7, ax: 4, period: 170 });
});

// ---------- world queries ----------
let PX = 0, PY = 0; // scratch outputs (no allocation in the hot loop)
function dronePos(d, t) {
  const a = 2 * Math.PI * ((t + d.phase) / d.period);
  if (d.orbit) { PX = d.x + Math.cos(a * d.turn) * d.orbit; PY = d.y + Math.sin(a * d.turn) * d.orbit; }
  else { const k = 0.5 - 0.5 * Math.cos(a); PX = d.x + d.ax * k; PY = d.y + d.ay * k; }
  return API;
}
function zapOn(z, t) { return (((t + z.phase) % z.period) + z.period) % z.period < z.on; }
// frames until the zap turns on (0 while it is on); the renderer uses it for the warning flash
function zapWarn(z, t) { const k = (((t + z.phase) % z.period) + z.period) % z.period; return k < z.on ? 0 : z.period - k; }

// ---------- player ----------
function newPlayer(st) { return { x: st.spawn.x, y: st.spawn.y, vx: 0, vy: 0, keys: 0, alive: true, done: false, cause: '', ev: 0 }; }
function clonePlayer(p) { return { x: p.x, y: p.y, vx: p.vx, vy: p.vy, keys: p.keys, alive: true, done: false, cause: '', ev: 0 }; }
// input: 0 = stand, 1..8 = E, SE, S, SW, W, NW, N, NE
const D = Math.SQRT1_2, DX = [0, 1, D, 0, -D, -1, -D, 0, D], DY = [0, 0, D, 1, D, 0, -D, -1, -D];
function inputOf(dx, dy) { return dx > 0 ? (dy > 0 ? 2 : dy < 0 ? 8 : 1) : dx < 0 ? (dy > 0 ? 4 : dy < 0 ? 6 : 5) : (dy > 0 ? 3 : dy < 0 ? 7 : 0); }
// One fixed step. t = real frame, th = frame used for the hazards (bots plan with th = t - lag; the game calls it with th = t).
// pad = extra safety margin in px that a bot adds to every hazard when it plans (the game calls it with 0).
// p.ev bits: 1 took a key, 2 hit a wall.
function step(st, p, inp, t, th, pad) {
  if (!p.alive || p.done) return;
  p.ev = 0; pad = pad || 0;
  const h = PH.half, a = PH.acc;
  let d = DX[inp] * PH.speed - p.vx; p.vx += d > a ? a : d < -a ? -a : d;
  d = DY[inp] * PH.speed - p.vy; p.vy += d > a ? a : d < -a ? -a : d;
  if (p.vx !== 0) {
    let nx = p.x + p.vx; const y0 = Math.floor((p.y - h) / T), y1 = Math.floor((p.y + h - 0.001) / T);
    if (p.vx > 0) { const cx = Math.floor((nx + h - 0.001) / T); for (let cy = y0; cy <= y1; cy++) if (solid(st, cx, cy)) { nx = cx * T - h; p.vx = 0; p.ev |= 2; break; } }
    else { const cx = Math.floor((nx - h) / T); for (let cy = y0; cy <= y1; cy++) if (solid(st, cx, cy)) { nx = (cx + 1) * T + h; p.vx = 0; p.ev |= 2; break; } }
    p.x = nx;
  }
  if (p.vy !== 0) {
    let ny = p.y + p.vy; const x0 = Math.floor((p.x - h) / T), x1 = Math.floor((p.x + h - 0.001) / T);
    if (p.vy > 0) { const cy = Math.floor((ny + h - 0.001) / T); for (let cx = x0; cx <= x1; cx++) if (solid(st, cx, cy)) { ny = cy * T - h; p.vy = 0; p.ev |= 2; break; } }
    else { const cy = Math.floor((ny - h) / T); for (let cx = x0; cx <= x1; cx++) if (solid(st, cx, cy)) { ny = (cy + 1) * T + h; p.vy = 0; p.ev |= 2; break; } }
    p.y = ny;
  }
  // hazards first: a key under a drone does not save the player
  const ds = st.drones;
  for (let i = 0; i < ds.length; i++) {
    const dr = ds[i]; dronePos(dr, th);
    const cx = PX < p.x - h ? p.x - h : PX > p.x + h ? p.x + h : PX, cy = PY < p.y - h ? p.y - h : PY > p.y + h ? p.y + h : PY;
    const ex = PX - cx, ey = PY - cy, r = dr.r - 2 + pad;
    if (ex * ex + ey * ey < r * r) { p.alive = false; p.cause = dr.kind; return; }
  }
  const zs = st.zaps, hh = h - 2 + pad;
  for (let i = 0; i < zs.length; i++) {
    const z = zs[i];
    if (p.x + hh > z.x && p.x - hh < z.x + z.w && p.y + hh > z.y && p.y - hh < z.y + z.h && zapOn(z, th)) { p.alive = false; p.cause = 'zap'; return; }
  }
  const ks = st.keys, g2 = PH.grab * PH.grab;
  for (let i = 0; i < ks.length; i++) if (!(p.keys >> i & 1)) { const ex = ks[i].x - p.x, ey = ks[i].y - p.y; if (ex * ex + ey * ey < g2) { p.keys |= 1 << i; p.ev |= 1; } }
  if (p.keys === st.allKeys) { const ex = st.exit.x - p.x, ey = st.exit.y - p.y; if (ex * ex + ey * ey < g2) p.done = true; }
}

// ---------- scripted bots ----------
// A bot is a script, not a learned policy. It knows the walking distance to its target (the nearest key it does
// not have, then the exit) from a distance field made once for each stage. At each decision it tries a fixed list
// of simple actions (follow the route, go in one of 8 directions for a moment, wait, step and stop) in a forward
// roll-out of the real game step, and takes the one that ends nearest to the target without a death.
// Skill (0..1) sets the noise: slow decisions, a late view of the hazards, a short look-ahead, a late start of each
// new action, and lapses. Risk (0..1) sets the safety margin the bot wants around each hazard.
let WX = 0, WY = 0;
// walking distance in px from (x,y) to target k (k = keys.length is the exit); sets the next waypoint in WX, WY
function estDist(st, k, x, y) {
  const tg = k < st.keys.length ? st.keys[k] : st.exit, F = st.fields[k];
  const cx = Math.floor(x / T), cy = Math.floor(y / T);
  if (cx === Math.floor(tg.x / T) && cy === Math.floor(tg.y / T)) { WX = tg.x; WY = tg.y; return Math.hypot(tg.x - x, tg.y - y); }
  let best = 1e9;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy; if (solid(st, nx, ny)) continue;
    if (dx && dy && (solid(st, cx + dx, cy) || solid(st, cx, cy + dy))) continue;
    const px = (nx + 0.5) * T, py = (ny + 0.5) * T, v = F[ny * COLS + nx] * T + Math.hypot(px - x, py - y);
    if (v < best) { best = v; WX = px; WY = py; }
  }
  return best;
}
function pickTarget(st, p) {
  let best = 1e9, k = st.keys.length;
  for (let i = 0; i < st.keys.length; i++) if (!(p.keys >> i & 1)) { const v = estDist(st, i, p.x, p.y); if (v < best) { best = v; k = i; } }
  return k;
}
function followDir(st, p, k) {
  estDist(st, k, p.x, p.y); const dx = WX - p.x, dy = WY - p.y;
  if (dx * dx + dy * dy < 4) return 0;
  return ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8) + 1;
}
function bits(v) { let n = 0; while (v) { n += v & 1; v >>= 1; } return n; }
// plan: { dir: -1 follow the route | 0 stand | 1..8, len: frames of that, stop: 1 = stand after it, 0 = follow the route after it, t0 }
function planInput(st, p, pl, k, t) { return t - pl.t0 < pl.len ? (pl.dir < 0 ? followDir(st, p, k) : pl.dir) : pl.stop ? 0 : followDir(st, p, k); }
function rollout(st, p0, pl, k, t0, lag, pad, H) {
  const p = clonePlayer(p0); pl.t0 = t0;
  for (let f = 0; f < H; f++) {
    const t = t0 + f; step(st, p, planInput(st, p, pl, k, t), t, t - lag, pad);
    if (!p.alive) return -1e6 + f * 1000;
    if (p.done) return 1e6 - f;
    if (p.ev & 1) k = pickTarget(st, p);
  }
  // progress in a fixed time: keys taken, then walking distance to the target; to end at a stop costs extra
  return bits(p.keys) * 5000 - estDist(st, k, p.x, p.y) - (pl.stop ? 25 : 0) - (p.vx === 0 && p.vy === 0 ? 40 : 0);
}
function makeBot(i, n, seed) {
  const rng = mulberry32(hash2(seed, i)); const skill = n > 1 ? i / (n - 1) : 0.5, risk = rng();
  return { i, skill, risk, rng, lag: Math.round((1 - skill) * 10), period: 5 + Math.round((1 - skill) * 10), sigma: (1 - skill) * 6, H: 36 + Math.round(skill * 24),
    pad: (1 - risk) * 5, lapse: (1 - skill) * 0.04, start: Math.floor(rng() * 45), next: 0, tg: -1,
    plan: { dir: 0, len: 0, stop: 1, t0: 0 }, prev: null, ax: 0, ay: 0, at: 0, stuck: false };
}
function think(st, b, p, t) {
  const P = b.period;
  if (b.rng() < b.lapse) { b.next = t + P; return; }
  const k = b.tg, cands = [{ dir: -1, len: b.H, stop: 0 }, { dir: -1, len: P, stop: 1 }, { dir: -1, len: 2 * P, stop: 1 },
    { dir: 0, len: P, stop: 0 }, { dir: 0, len: 2 * P, stop: 0 }, { dir: 0, len: 4 * P, stop: 0 }, { dir: 0, len: b.H, stop: 1 }];
  for (let d = 1; d <= 8; d++) cands.push({ dir: d, len: P, stop: 0 }, { dir: d, len: 2 * P, stop: 0 }, { dir: d, len: P, stop: 1 });
  // no progress for 5 s: go away from the route for 40 frames and try again
  if (t - b.at > 300) { b.at = t; const f = followDir(st, p, k), back = { dir: f ? (f + 3) % 8 + 1 : 5, len: 40, stop: 0 }; if (rollout(st, p, back, k, t, b.lag, b.pad, 50) > -1e5) { b.prev = null; b.plan = back; b.next = t + 40; return; } }
  let pick = cands[0], best = -Infinity;
  for (const c of cands) { const s = rollout(st, p, c, k, t, b.lag, b.pad, b.H); if (s > best) { best = s; pick = c; } }
  // a new action starts late: the timing error of this bot. Until then the old action goes on.
  const late = Math.min(2 * P, Math.round(Math.abs(gauss(b.rng)) * b.sigma));
  b.prev = late > 0 ? b.plan : null; pick.t0 = t + late; b.plan = pick;
  b.next = t + P + Math.floor(b.rng() * 3);
}
// the input of a bot for frame t (the game can put a bot on the human input path with this)
function botInput(st, b, p, t) {
  if (t < b.start) return 0;
  if (b.tg < 0 || (b.tg < st.keys.length && (p.keys >> b.tg & 1))) b.tg = pickTarget(st, p);
  if (t >= b.next) think(st, b, p, t);
  const pl = b.prev && t < b.plan.t0 ? b.prev : b.plan;
  return planInput(st, p, pl, b.tg, t);
}
function botStep(st, b, p, t) { step(st, p, botInput(st, b, p, t), t, t, 0); }

function createSwarm(stageIndex, seed, n) {
  n = n || 100;
  const st = stageIndex === 'gym' ? GYM : STAGES[stageIndex];
  const bots = []; for (let i = 0; i < n; i++) { const b = makeBot(i, n, seed); b.p = newPlayer(st); b.ax = b.p.x; b.ay = b.p.y; bots.push(b); }
  const sw = { version: VERSION, stageIndex, seed, n, st, bots, t: 0, deaths: [], events: [], finished: 0, dead: 0, over: false, step: () => stepSwarm(sw) };
  return sw;
}
function stepSwarm(sw) {
  if (sw.over) return;
  const st = sw.st, t = sw.t, h = PH.half; let active = 0;
  for (const b of sw.bots) {
    const p = b.p; if (!p.alive || p.done) continue;
    active++;
    const ox = p.x, oy = p.y, ok = p.keys;
    botStep(st, b, p, t);
    // audit: things that must never happen
    if (p.alive) {
      if (!b.embedded && (solid(st, Math.floor((p.x - h + 0.5) / T), Math.floor((p.y - h + 0.5) / T)) || solid(st, Math.floor((p.x + h - 0.5) / T), Math.floor((p.y - h + 0.5) / T)) || solid(st, Math.floor((p.x - h + 0.5) / T), Math.floor((p.y + h - 0.5) / T)) || solid(st, Math.floor((p.x + h - 0.5) / T), Math.floor((p.y + h - 0.5) / T)))) { b.embedded = true; sw.events.push({ type: 'embedded', i: b.i, t, x: p.x, y: p.y }); }
      if (Math.hypot(p.x - ox, p.y - oy) > PH.speed * 1.2) sw.events.push({ type: 'warp', i: b.i, t, x: p.x, y: p.y });
      if (p.done && p.keys !== st.allKeys) sw.events.push({ type: 'earlyexit', i: b.i, t, x: p.x, y: p.y });
      if (p.keys !== ok || Math.hypot(p.x - b.ax, p.y - b.ay) > 24) { b.ax = p.x; b.ay = p.y; b.at = t; }
      else if (!b.stuck && t - b.at > 480) { b.stuck = true; sw.events.push({ type: 'stuck', i: b.i, t, x: p.x, y: p.y }); }
    }
    if (!p.alive) { sw.dead++; sw.deaths.push({ x: Math.round(p.x), y: Math.round(p.y), c: p.cause, t, i: b.i, k: bits(p.keys) }); }
    else if (p.done) { sw.finished++; b.tDone = t; }
  }
  sw.t++;
  if (active === 0) sw.over = true;
  else if (sw.t >= LIMIT) { for (const b of sw.bots) { const p = b.p; if (p.alive && !p.done) { p.alive = false; p.cause = 'timeout'; sw.dead++; sw.deaths.push({ x: Math.round(p.x), y: Math.round(p.y), c: 'timeout', t: sw.t, i: b.i, k: bits(p.keys) }); } } sw.over = true; }
}
// tiers: low = bots 0..34, mid = 35..64, high = 65..99 (for n = 100)
function tierOf(b, n) { const k = b.i / n; return k < 0.35 ? 0 : k < 0.65 ? 1 : 2; }
function swarmStats(sw) {
  const pass = [0, 0, 0], tot = [0, 0, 0], causes = {}; let tsum = 0;
  for (const b of sw.bots) { const k = tierOf(b, sw.n); tot[k]++; if (b.p.done) { pass[k]++; tsum += b.tDone; } }
  for (const d of sw.deaths) causes[d.c] = (causes[d.c] || 0) + 1;
  const ev = { stuck: 0, embedded: 0, warp: 0, earlyexit: 0 }; for (const e of sw.events) ev[e.type]++;
  return { n: sw.n, frames: sw.t, pass: sw.finished, passLow: pass[0], passMid: pass[1], passHigh: pass[2], nLow: tot[0], nMid: tot[1], nHigh: tot[2],
    avgFinishSec: sw.finished ? +(tsum / sw.finished / 60).toFixed(2) : null, causes, stuck: ev.stuck, embedded: ev.embedded, warp: ev.warp, earlyexit: ev.earlyexit };
}

const API = { VERSION, T, COLS, ROWS, LIMIT, PH, STAGES, GYM, solid, dronePos, zapOn, zapWarn, newPlayer, clonePlayer, step, inputOf, makeBot, botInput, botStep, createSwarm, swarmStats, tierOf, mulberry32,
  estDist, pickTarget, followDir, rollout, bits, get PX() { return PX; }, get PY() { return PY; } };
root.LK_VERSIONS = root.LK_VERSIONS || {}; root.LK_VERSIONS[VERSION] = API; root.LK_SIM = API;
if (typeof module !== 'undefined') module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
