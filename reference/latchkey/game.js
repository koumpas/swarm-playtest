// Latchkey - renderer and game shell: human play, swarm mode, review sheets, headless API.
// The renderer reads the simulation state; it never changes it.
(function () {
'use strict';
const SIM = LK_SIM, Q = new URLSearchParams(location.search), T = SIM.T, AW = SIM.COLS * T, AH = SIM.ROWS * T; // arena 960 x 480
const BAND = [50, 70]; // the difficulty target: mid-skill first-try pass rate, percent
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
let LW = 960, LH = 540;
function resize() { const dpr = Math.min(2, devicePixelRatio || 1); cv.width = LW * dpr; cv.height = LH * dpr; const k = Math.min(innerWidth / LW, innerHeight / LH); cv.style.width = LW * k + 'px'; cv.style.height = LH * k + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
addEventListener('resize', resize);
const NST = SIM.STAGES.length, SEED = +(Q.get('seed') || 101), SPEED = Math.max(1, +(Q.get('speed') || 1));
const LK = window.__lk = { mode: '', over: false, frameMs: [], rafMs: [], results: [] };
const TIER_COL = ['#ff9f43', '#4dd0ff', '#c58bff'], TIER_NAME = ['low', 'mid', 'high'], FONT = 'system-ui, -apple-system, Segoe UI, sans-serif';
const getJSON = u => fetch(u, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
function text(s, x, y, size, col, align, weight) { ctx.font = `${weight || 700} ${size}px ${FONT}`; ctx.fillStyle = col || '#fff'; ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(s, x, y); }
function panel(x, y, w, h, a) { ctx.fillStyle = `rgba(8,10,28,${a === undefined ? 0.78 : a})`; ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill(); }
function bandColor(p) { return p == null ? '#555a80' : p < BAND[0] ? '#ff5d73' : p > BAND[1] ? '#ffb347' : '#5df2a0'; }
let heatSprite = null;
function heat() { if (!heatSprite) { heatSprite = document.createElement('canvas'); heatSprite.width = heatSprite.height = 64; const c = heatSprite.getContext('2d'), g = c.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(255,48,24,.36)'); g.addColorStop(0.5, 'rgba(255,24,24,.13)'); g.addColorStop(1, 'rgba(255,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); } return heatSprite; }

// ---------- world ----------
// keys: bit mask of the keys that are taken (not drawn); pass -1 to draw every key
function drawWorld(st, t, keys) {
  ctx.fillStyle = `hsl(${st.hue},30%,9%)`; ctx.fillRect(0, 0, AW, AH);
  ctx.strokeStyle = `hsla(${st.hue},40%,60%,.06)`; ctx.lineWidth = 1; ctx.beginPath(); for (let x = 0; x <= SIM.COLS; x++) { ctx.moveTo(x * T, 0); ctx.lineTo(x * T, AH); } for (let y = 0; y <= SIM.ROWS; y++) { ctx.moveTo(0, y * T); ctx.lineTo(AW, y * T); } ctx.stroke();
  for (const z of st.zaps) { const on = SIM.zapOn(z, t), w = SIM.zapWarn(z, t);
    ctx.fillStyle = on ? 'rgba(255,70,90,.8)' : w <= 30 && (w >> 2) % 2 === 0 ? 'rgba(255,200,60,.4)' : 'rgba(255,90,110,.1)'; ctx.fillRect(z.x, z.y, z.w, z.h);
    ctx.strokeStyle = on ? '#fff' : '#ff5d73'; ctx.lineWidth = 2; ctx.setLineDash(on ? [] : [5, 5]); ctx.strokeRect(z.x + 1, z.y + 1, z.w - 2, z.h - 2); ctx.setLineDash([]); }
  for (let y = 0; y < SIM.ROWS; y++) for (let x = 0; x < SIM.COLS; x++) if (SIM.solid(st, x, y)) { ctx.fillStyle = `hsl(${st.hue},35%,${26 + ((x + y) % 2) * 3}%)`; ctx.fillRect(x * T, y * T, T, T); ctx.fillStyle = `hsl(${st.hue},40%,40%)`; ctx.fillRect(x * T, y * T, T, 3); }
  // hazard paths, so that a still image shows where a drone goes
  ctx.strokeStyle = 'rgba(255,110,130,.28)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]);
  for (const d of st.drones) { ctx.beginPath(); if (d.orbit) ctx.arc(d.x, d.y, d.orbit, 0, 7); else { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + d.ax, d.y + d.ay); } ctx.stroke(); } ctx.setLineDash([]);
  const open = keys === st.allKeys, e = st.exit;
  ctx.fillStyle = open ? '#5df2a0' : '#3a3f5c'; ctx.beginPath(); ctx.roundRect(e.x - 13, e.y - 13, 26, 26, 5); ctx.fill(); ctx.strokeStyle = open ? '#fff' : '#7a80a8'; ctx.lineWidth = 2; ctx.stroke(); text('EXIT', e.x, e.y + 4, 9, open ? '#0b1026' : '#b8bde6', 'center', 900);
  st.keys.forEach((k, i) => { if (keys >= 0 && (keys >> i & 1)) return; const bob = Math.sin(t * 0.08 + i) * 2; ctx.save(); ctx.translate(k.x, k.y + bob); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#ffe27a'; ctx.fillRect(-7, -7, 14, 14); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(-7, -7, 14, 14); ctx.restore(); });
  for (const d of st.drones) { SIM.dronePos(d, t); const x = SIM.PX, y = SIM.PY; ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.12); ctx.fillStyle = d.kind === 'orbiter' ? '#ff7a45' : '#ff4d6d'; ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r = i % 2 ? d.r - 4 : d.r; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.fillStyle = '#2a0b14'; ctx.beginPath(); ctx.arc(0, 0, d.r * 0.35, 0, 7); ctx.fill(); ctx.restore(); }
}
function drawPlayer(p, col) { const h = SIM.PH.half; ctx.fillStyle = col || '#7df9ff'; ctx.beginPath(); ctx.roundRect(p.x - h, p.y - h, 2 * h, 2 * h, 4); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
function drawBars(bars, cur) {
  const x0 = 470, w = 112, y = 494, h = 30;
  bars.forEach((v, i) => { const x = x0 + i * (w + 8); ctx.fillStyle = '#1a1e3a'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(93,242,160,.22)'; ctx.fillRect(x + w * BAND[0] / 100, y, w * (BAND[1] - BAND[0]) / 100, h); // the target band
    if (v != null) { ctx.fillStyle = bandColor(v); ctx.fillRect(x, y + 8, w * v / 100, h - 16); }
    ctx.strokeStyle = i === cur ? '#fff' : '#555a80'; ctx.lineWidth = i === cur ? 2 : 1; ctx.strokeRect(x, y, w, h);
    text('S' + (i + 1) + (v == null ? ' –' : ' ' + Math.round(v) + '%'), x + 4, y - 4, 10, i === cur ? '#fff' : '#9aa0c8', 'left', 800); });
  text('mid-skill pass · band ' + BAND[0] + '–' + BAND[1] + '%', x0, 538, 9, '#9aa0c8', 'left', 700);
}
function hudBase(stageIndex, st) { ctx.fillStyle = '#0b0d1f'; ctx.fillRect(0, AH, LW, LH - AH); text('LATCHKEY', 12, 503, 15, '#ffe27a', 'left', 900); text('stage ' + (stageIndex === 'gym' ? 'gym' : stageIndex + 1) + ' · ' + st.name, 100, 503, 13, '#fff', 'left', 700); }
function hudVersion() { text('v' + SIM.VERSION + ' · seed ' + SEED + (SPEED !== 1 ? ' · ×' + SPEED + ' speed' : ''), 12, 532, 12, '#b8bde6', 'left', 800); }

// ---------- input ----------
const keys = {}; let pressed = [];
addEventListener('keydown', e => { if (!keys[e.code]) pressed.push(e.code); keys[e.code] = true; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); });
addEventListener('keyup', e => { keys[e.code] = false; });
const hit = c => pressed.includes(c), anyOf = (...c) => c.some(k => keys[k]);
let state = 'loading', tick = 0; const LOGS = {};
function barsOf() { const l = LOGS[SIM.VERSION]; return l ? l.stages.map(s => s.midPct) : new Array(NST).fill(null); }

// ---------- human play ----------
const G = {};
function newBot() { const b = SIM.makeBot(99, 100, SEED + G.deaths * 7 + G.stage); b.start = 0; return b; }
function startPlay(i) { state = 'play'; LK.mode = 'play'; G.times = []; G.dcount = []; G.auto = Q.get('auto') === '1'; G.deaths = 0; startStage(i); }
function startStage(i) { G.stage = i; G.st = SIM.STAGES[i]; G.deaths = 0; LK.stage = i; respawn(); }
function respawn() { G.t = 0; G.p = SIM.newPlayer(G.st); G.respawn = 0; G.clear = 0; G.bot = newBot(); } // every try starts at frame 0, the same as a bot's first try
function updatePlay() {
  const p = G.p, st = G.st;
  if (G.clear > 0) { if (--G.clear === 0) { if (G.stage + 1 < NST) startStage(G.stage + 1); else { state = 'results'; LK.over = true; LK.results = G.times.map((t, i) => ({ sec: t, deaths: G.dcount[i] })); } } return; }
  if (G.respawn > 0) { if (--G.respawn === 0) respawn(); return; }
  if (hit('KeyR')) { respawn(); return; }
  const inp = G.auto ? SIM.botInput(st, G.bot, p, G.t) : SIM.inputOf((anyOf('ArrowRight', 'KeyD') ? 1 : 0) - (anyOf('ArrowLeft', 'KeyA') ? 1 : 0), (anyOf('ArrowDown', 'KeyS') ? 1 : 0) - (anyOf('ArrowUp', 'KeyW') ? 1 : 0));
  SIM.step(st, p, inp, G.t, G.t, 0); // the bot and the human use the same call
  if (!p.alive) { G.deaths++; G.respawn = 40; } else if (p.done) { G.clear = 70; G.times[G.stage] = +(G.t / 60).toFixed(2); G.dcount[G.stage] = G.deaths; }
  G.t++;
}
function drawPlay() {
  const st = G.st, p = G.p; drawWorld(st, G.t, p.keys);
  if (p.alive) drawPlayer(p); else { ctx.fillStyle = 'rgba(255,93,115,.8)'; ctx.beginPath(); ctx.arc(p.x, p.y, 6 + (40 - G.respawn), 0, 7); ctx.fill(); }
  hudBase(G.stage, st); hudVersion();
  text('keys ' + SIM.bits(p.keys) + '/' + st.keys.length + ' · ' + (G.t / 60).toFixed(1) + ' s · deaths ' + G.deaths, 470, 503, 14, '#fff', 'left', 800);
  text(G.auto ? 'AUTO: a bot on the human input path' : 'arrows or WASD: move · R: restart the stage', 470, 528, 12, G.auto ? '#ffe27a' : '#9aa0c8', 'left', 700);
  if (!p.alive) text('CAUGHT: ' + p.cause.toUpperCase(), 480, 240, 34, '#ff8fa0', 'center', 900);
  if (G.clear > 0) { panel(300, 190, 360, 90, 0.9); text('STAGE CLEAR', 480, 232, 32, '#ffe27a', 'center', 900); text(G.times[G.stage] + ' s · ' + G.deaths + ' deaths', 480, 262, 16, '#fff', 'center', 700); }
}
function drawResults() {
  ctx.fillStyle = '#0b1026'; ctx.fillRect(0, 0, LW, LH); text('ALL STAGES CLEAR', 480, 110, 44, '#ffe27a', 'center', 900);
  G.times.forEach((t, i) => text((i + 1) + '  ' + SIM.STAGES[i].name + '   ' + t.toFixed(2) + ' s   ' + G.dcount[i] + ' deaths', 480, 180 + i * 40, 20, '#fff', 'center', 700));
  text('enter: play again', 480, 430, 14, '#9aa0c8', 'center', 600); hudVersion();
}

// ---------- swarm mode ----------
function SwarmView(stageIndex, seed) { this.sw = SIM.createSwarm(stageIndex, seed, 100); this.st = this.sw.st; this.stageIndex = stageIndex; }
SwarmView.prototype.midPct = function () { let pass = 0, tot = 0; for (const b of this.sw.bots) if (SIM.tierOf(b, this.sw.n) === 1) { tot++; if (b.p.done) pass++; } return tot ? 100 * pass / tot : 0; };
SwarmView.prototype.draw = function () {
  const sw = this.sw, st = this.st; drawWorld(st, sw.t, -1);
  ctx.globalCompositeOperation = 'lighter'; const hs = heat(); for (const d of sw.deaths) ctx.drawImage(hs, d.x - 32, d.y - 32); ctx.globalCompositeOperation = 'source-over';
  const cnt = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; // tier x (alive, done, dead)
  for (const b of sw.bots) { const k = SIM.tierOf(b, sw.n), p = b.p; cnt[k][p.done ? 1 : p.alive ? 0 : 2]++; if (!p.alive || p.done) continue; ctx.globalAlpha = 0.5; ctx.fillStyle = TIER_COL[k]; ctx.beginPath(); ctx.roundRect(p.x - 7, p.y - 7, 14, 14, 4); ctx.fill(); }
  ctx.globalAlpha = 1;
  hudBase(this.stageIndex, st); hudVersion();
  text((sw.t / 60).toFixed(1) + ' s · 100 bots · red = deaths', 300, 503, 11, '#9aa0c8', 'left', 700);
  cnt.forEach((c, k) => { text(TIER_NAME[k] + ' ' + c[1] + ' out ' + c[2] + ' dead', 175 + k * 98, 532, 10, TIER_COL[k], 'left', 800); });
  // The number that is the measurement is the one in log/vN.json (all seeds). One seed alone is only shown as a small note.
  const logged = this.stageIndex === 'gym' ? null : W.bars[this.stageIndex], bars = W.bars.slice(); if (this.stageIndex !== 'gym' && logged == null && sw.over) bars[this.stageIndex] = this.midPct(); drawBars(bars, this.stageIndex);
  if (sw.over) { const one = this.midPct(), pct = logged == null ? one : logged, col = bandColor(pct); panel(300, 190, 360, 100, 0.9);
    text(st.name.toUpperCase() + (logged == null ? ' · seed ' + sw.seed + ' only (not yet measured)' : ' · all seeds · this seed ' + sw.seed + ': ' + Math.round(one) + '%'), 480, 216, 12, '#b8bde6', 'center', 800); text(Math.round(pct) + '% mid-skill pass', 480, 250, 28, col, 'center', 900);
    text(pct < BAND[0] ? 'TOO HARD · below the ' + BAND[0] + '–' + BAND[1] + ' band' : pct > BAND[1] ? 'TOO EASY · above the ' + BAND[0] + '–' + BAND[1] + ' band' : 'IN THE ' + BAND[0] + '–' + BAND[1] + ' BAND', 480, 275, 13, col, 'center', 800); }
};
const W = { bars: [] };
function startSwarm(stage) { state = 'swarm'; LK.mode = 'swarm'; LK.over = false; W.tour = stage === 'all'; W.bars = barsOf(); W.hold = 0; W.view = new SwarmView(W.tour ? 0 : stage, SEED); }
function updateSwarm() {
  const v = W.view; for (let i = 0; i < SPEED && !v.sw.over; i++) v.sw.step();
  if (v.sw.over) { if (W.hold === 0) LK.results.push(Object.assign({ stage: v.stageIndex }, SIM.swarmStats(v.sw)));
    if (++W.hold > 150 && W.tour && v.stageIndex + 1 < NST && Q.get('hold') !== '1') { W.view = new SwarmView(v.stageIndex + 1, SEED); W.hold = 0; } else if (W.hold > 3 && (!W.tour || v.stageIndex + 1 >= NST)) LK.over = true; }
}

// ---------- review sheet: 6 frames of one bot's run, for the playtester panel ----------
function drawSheet() {
  const s = +(Q.get('stage') || 0), bi = +(Q.get('bot') || 50); LW = 1440; resize();
  const sw = SIM.createSwarm(s, SEED, 100), b = sw.bots[bi], snaps = [];
  while (!sw.over && b.p.alive && !b.p.done) { sw.step(); snaps.push({ x: b.p.x, y: b.p.y, keys: b.p.keys, alive: b.p.alive, done: b.p.done }); }
  const F = snaps.length, st = sw.st; ctx.fillStyle = '#0b0d1f'; ctx.fillRect(0, 0, LW, LH);
  for (let k = 0; k < 6; k++) { const f = Math.max(0, Math.round(F * (k + 1) / 6) - 1), p = snaps[f], cx = (k % 3) * 480, cy = (k / 3 | 0) * 270, last = k === 5;
    ctx.save(); ctx.translate(cx, cy + 30); ctx.scale(0.5, 0.5); drawWorld(st, f + 1, p.keys);
    ctx.strokeStyle = 'rgba(125,249,255,.75)'; ctx.lineWidth = 3; ctx.beginPath(); for (let i = 0; i <= f; i += 2) ctx.lineTo(snaps[i].x, snaps[i].y); ctx.lineTo(p.x, p.y); ctx.stroke(); // the path so far
    if (p.alive) drawPlayer(p); else { ctx.strokeStyle = '#ff5d73'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(p.x - 16, p.y - 16); ctx.lineTo(p.x + 16, p.y + 16); ctx.moveTo(p.x + 16, p.y - 16); ctx.lineTo(p.x - 16, p.y + 16); ctx.stroke(); }
    ctx.restore();
    text('t=' + ((f + 1) / 60).toFixed(1) + 's · keys ' + SIM.bits(p.keys) + '/' + st.keys.length + (last ? (p.done ? ' · REACHED THE EXIT' : ' · DIED: ' + b.p.cause + ' (red cross)') : ''), cx + 10, cy + 21, 14, last ? (p.done ? '#5df2a0' : '#ff8fa0') : '#fff', 'left', 800);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(cx, cy, 480, 270); }
  LK.over = true; LK.sheet = { stage: s, bot: bi, skill: b.skill, frames: F, result: b.p.done ? 'exit' : b.p.cause, keys: SIM.bits(b.p.keys), keysTotal: st.keys.length };
}

// ---------- headless API for tools/run-swarm.mjs ----------
window.LK_HEADLESS = { run(stage, seed, n) { const t0 = performance.now(), sw = SIM.createSwarm(stage, seed, n || 100); while (!sw.over) sw.step(); const r = SIM.swarmStats(sw); r.stage = stage; r.seed = seed; r.simMs = Math.round(performance.now() - t0); r.deaths = sw.deaths; r.events = sw.events; r.name = sw.st.name; r.keys = sw.st.keys.length; return r; }, version: SIM.VERSION, stages: NST, band: BAND };

// ---------- main loop ----------
function update() { tick++; if (state === 'play') updatePlay(); else if (state === 'swarm') updateSwarm(); else if (state === 'results' && hit('Enter')) startPlay(0); pressed = []; }
function draw() { if (state === 'play') drawPlay(); else if (state === 'swarm') W.view.draw(); else if (state === 'results') drawResults(); }
let last = 0, acc = 0;
function frame(now) {
  const dt = Math.min(100, now - last); if (last) LK.rafMs.push(+dt.toFixed(2)); last = now; acc += dt; let n = 0; const t0 = performance.now();
  while (acc >= 1000 / 60 - 0.5 && n < 4) { update(); acc -= 1000 / 60; n++; } if (acc > 100 || acc < 0) acc = 0;
  draw(); if (LK.frameMs.length < 4000) LK.frameMs.push(+(performance.now() - t0).toFixed(2));
  requestAnimationFrame(frame);
}
resize();
const mode = Q.get('mode');
if (mode === 'sheet') { drawSheet(); return; }
if (mode === 'headless') { LK.mode = 'headless'; return; }
getJSON('log/v' + SIM.VERSION + '.json').then(r => {
  if (r) LOGS[SIM.VERSION] = r;
  const stage = Q.get('stage') || (mode === 'swarm' ? 'all' : '1'), s0 = stage === 'all' || stage === 'gym' ? stage : +stage - 1;
  if (mode === 'swarm') startSwarm(s0); else startPlay(s0 === 'all' || s0 === 'gym' ? 0 : s0);
  requestAnimationFrame(frame);
});
})();
