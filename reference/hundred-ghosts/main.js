// Hundred Ghosts - game shell: title, human play, swarm mode, replay mode, review sheets.
(function () {
'use strict';
const R = HGRender, SIM = HG_SIM, Q = new URLSearchParams(location.search), text = R.text, panel = R.panel;
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
let LW = 960, LH = 540, dpr = 1;
function resize() { dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = LW * dpr; cv.height = LH * dpr; const k = Math.min(innerWidth / LW, innerHeight / LH); cv.style.width = LW * k + 'px'; cv.style.height = LH * k + 'px'; }
addEventListener('resize', resize);
const NST = SIM.STAGES.length, SEED = +(Q.get('seed') || 101), SPEED = Math.max(1, +(Q.get('speed') || 1));
const HG = window.__hg = { mode: '', over: false, frameMs: [], rafMs: [], results: [] };
let state = 'title', tick = 0;
let INDEX = { versions: [SIM.VERSION] }; const LOGS = {};
const getJSON = u => fetch(u, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
function loadVersion(n) { n = +n; if (HG_VERSIONS[n]) return Promise.resolve(HG_VERSIONS[n]); return new Promise((ok, bad) => { const s = document.createElement('script'); s.src = 'versions/v' + n + '.js'; s.onload = () => ok(HG_VERSIONS[n]); s.onerror = bad; document.head.appendChild(s); }); }
function barsOf(n) { const l = LOGS[n]; return l ? l.stages.map(s => s.midPct) : new Array(NST).fill(null); }

// ---------- input ----------
const keys = {}, touch = { l: false, r: false, j: false, on: false }; let pressed = [];
addEventListener('keydown', e => { if (!keys[e.code]) pressed.push(e.code); keys[e.code] = true; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); });
addEventListener('keyup', e => { keys[e.code] = false; });
const pts = new Map(); let taps = [];
function lp(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * LW, y: (e.clientY - r.top) / r.height * LH }; }
function touchZones() { touch.l = touch.r = touch.j = false; for (const p of pts.values()) { if (p.x < 130 && p.y > 330) touch.l = true; else if (p.x < 290 && p.y > 330) touch.r = true; else if (p.x > 600) touch.j = true; } }
cv.addEventListener('pointerdown', e => { const p = lp(e); if (e.pointerType === 'touch') touch.on = true; pts.set(e.pointerId, p); taps.push(p); touchZones(); e.preventDefault(); });
cv.addEventListener('pointermove', e => { if (pts.has(e.pointerId)) { pts.set(e.pointerId, lp(e)); touchZones(); } });
const up = e => { pts.delete(e.pointerId); touchZones(); }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
const hit = c => pressed.includes(c), anyOf = (...c) => c.some(k => keys[k]);

// ---------- title ----------
const MENU = [['PLAY', () => startPlay(0)], ['SWARM · 100 ghost bots', () => startSwarm('all')], ['REPLAY · v1 against latest', () => startReplay(1, INDEX.versions[INDEX.versions.length - 1], 'all')], ['LEADERBOARD', () => openBoard()]];
let menuSel = 0, demo = null;
function updateTitle() {
  if (!demo || demo.sw.over) demo = new R.SwarmView(SIM, (tick / 900 | 0) % NST, SEED + (tick / 900 | 0));
  demo.update(1);
  if (hit('ArrowDown') || hit('KeyS')) menuSel = (menuSel + 1) % MENU.length; if (hit('ArrowUp') || hit('KeyW')) menuSel = (menuSel + MENU.length - 1) % MENU.length;
  for (const t of taps) for (let i = 0; i < MENU.length; i++) if (Math.abs(t.y - (318 + i * 44)) < 22 && Math.abs(t.x - 480) < 220) { menuSel = i; MENU[i][1](); return; }
  if (hit('Enter') || hit('Space')) MENU[menuSel][1]();
}
function drawTitle() {
  demo.draw(ctx, 0, 0, LW, LH, { none: true }); ctx.fillStyle = 'rgba(8,8,30,.5)'; ctx.fillRect(0, 0, LW, LH);
  const bob = Math.sin(tick * 0.05) * 5;
  ctx.save(); ctx.shadowColor = '#ff7ad9'; ctx.shadowBlur = 30; text(ctx, 'HUNDRED', 480, 150 + bob, 92, '#fff', 'center', 900); text(ctx, 'GHOSTS', 480, 236 + bob, 92, '#ffe27a', 'center', 900); ctx.restore();
  text(ctx, 'an obstacle course that plays itself 100 times, then gets fixed', 480, 276, 16, '#c9cdf5', 'center', 600);
  MENU.forEach((m, i) => { const y = 318 + i * 44, sel = i === menuSel; panel(ctx, 280, y - 26, 400, 38, sel ? 0.9 : 0.55); if (sel) { ctx.strokeStyle = '#ff7ad9'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(280, y - 26, 400, 38, 8); ctx.stroke(); } text(ctx, (sel ? '▶ ' : '') + m[0], 480, y, 18, sel ? '#fff' : '#b8bde6', 'center', 800); });
  text(ctx, '← → move · space jump · R restart stage · esc menu', 480, 508, 13, '#9aa0c8', 'center', 600);
  text(ctx, 'v' + SIM.VERSION + ' · seed ' + SEED, 944, 526, 12, '#9aa0c8', 'right', 700);
}

// ---------- human play ----------
const G = {};
function startPlay(i) { state = 'play'; G.times = []; G.dcount = []; G.frames = []; G.rec = []; G.auto = Q.get('auto') === '1'; G.keys = Q.get('auto') === '2'; G.eligible = i === 0 && !G.auto; startStage(i); }
function newBot() { const b = SIM.makeBot(99, 100, SEED + G.deaths * 7 + G.stage); b.start = 0; b.next = G.t; return b; }
function startStage(i) { G.run = HGPlay.newRun(SIM, i); G.codes = []; G.stage = i; G.st = SIM.STAGES[i]; G.t = 0; G.deaths = 0; G.p = SIM.newPlayer(G.st); G.cam = 0; G.respawn = 0; G.clear = 0; G.sq = 0; G.shake = 0; G.parts = new R.Particles(); G.intro = 100; G.bot = newBot(); HG.stage = i; }
function updatePlay() {
  if (hit('Escape')) { state = 'title'; return; }
  const p = G.p, st = G.st; G.parts.update(); G.sq *= 0.82; G.shake *= 0.85; if (G.intro > 0) G.intro--;
  if (G.clear > 0) { if (--G.clear === 0) { if (G.stage + 1 < NST) startStage(G.stage + 1); else { state = 'results'; HG.over = true; HG.results = G.times.map((t, i) => ({ sec: t, deaths: G.dcount[i] })); openResults(); } } return; }
  if (!G.auto) { // a person (or, with auto=2, a bot that presses the keys): each tick is one recorded input code
    let code = 1; const run = G.run;
    if (G.keys) { if (run.respawn === 0) { const c = Object.assign({}, run.p, { cr: run.p.cr.slice() }); SIM.botStep(st, G.bot, c, run.t); const pl = G.bot.plan, t = run.t; code = ((pl.stop && t >= pl.stop ? 0 : pl.dir) + 1) | (t >= pl.js && t < pl.he ? 4 : 0); } }
    else code = ((anyOf('ArrowRight', 'KeyD') || touch.r ? 1 : 0) - (anyOf('ArrowLeft', 'KeyA') || touch.l ? 1 : 0) + 1) | (anyOf('Space', 'KeyZ', 'ArrowUp', 'KeyW') || touch.j ? 4 : 0) | (hit('KeyR') ? 8 : 0);
    const stepped = run.respawn === 0 && !(code & 8), q = run.p; G.codes.push(code);
    const ev = HGPlay.tick(SIM, run, code); G.t = run.t; G.deaths = run.deaths; G.respawn = run.respawn; G.p = run.p; if (ev & 4) G.bot = newBot();
    if (stepped) { const fx = q.x + 9, fy = q.y + 26;
      if (q.ev & 1) { G.sq = -0.5; G.parts.burst(fx, fy, 5, '#dfe2ff', 1.6, 16); } if (q.ev & 2) { G.sq = 0.6; G.parts.burst(fx, fy, 6, '#dfe2ff', 1.8, 16); } if (q.ev & 4) { G.sq = -0.9; G.parts.burst(fx, fy, 12, '#7cff6b', 3.5, 24); G.shake = 3; }
      if (ev & 1) { G.shake = 11; G.parts.burst(fx, Math.min(q.y + 13, 530), 26, '#ff5d73', 5, 40); G.parts.burst(fx, Math.min(q.y + 13, 530), 10, '#fff', 3, 30); }
      if (ev & 2) { G.clear = 80; G.frames[G.stage] = run.frames; G.times[G.stage] = +(run.frames / 60).toFixed(2); G.dcount[G.stage] = run.deaths; G.rec[G.stage] = HGPlay.encode(G.codes); G.parts.burst(st.goalX, st.goalY - 40, 40, '#ffe27a', 5, 50); } }
    const wW = st.W * SIM.T, tg = Math.max(0, Math.min(wW - LW, G.p.x - LW * 0.4)); G.cam += (tg - G.cam) * 0.14; return;
  }
  if (G.respawn > 0) { G.t++; if (--G.respawn === 0) { G.p = SIM.newPlayer(st); G.bot = newBot(); } return; }
  if (hit('KeyR')) { G.p = SIM.newPlayer(st); G.bot = newBot(); return; }
  SIM.botStep(st, G.bot, p, G.t);
  const fx = p.x + 9, fy = p.y + 26;
  if (p.ev & 1) { G.sq = -0.5; G.parts.burst(fx, fy, 5, '#dfe2ff', 1.6, 16); }
  if (p.ev & 2) { G.sq = 0.6; G.parts.burst(fx, fy, 6, '#dfe2ff', 1.8, 16); }
  if (p.ev & 4) { G.sq = -0.9; G.parts.burst(fx, fy, 12, '#7cff6b', 3.5, 24); G.shake = 3; }
  if (!p.alive) { G.deaths++; G.shake = 11; G.parts.burst(p.x + 9, Math.min(p.y + 13, 530), 26, '#ff5d73', 5, 40); G.parts.burst(p.x + 9, Math.min(p.y + 13, 530), 10, '#fff', 3, 30); G.respawn = 45; }
  else if (p.done) { G.clear = 80; G.times[G.stage] = +(G.t / 60).toFixed(2); G.dcount[G.stage] = G.deaths; G.parts.burst(st.goalX, st.goalY - 40, 40, '#ffe27a', 5, 50); }
  G.t++;
  const worldW = st.W * SIM.T, target = Math.max(0, Math.min(worldW - LW, p.x - LW * 0.4)); G.cam += (target - G.cam) * 0.14;
}
function drawPlay() {
  const st = G.st, p = G.p; R.drawBackdrop(ctx, st, G.cam, LW, LH);
  ctx.save(); const sh = G.shake > 0.4 ? G.shake : 0; ctx.translate(-G.cam + Math.sin(tick * 1.9) * sh, Math.cos(tick * 2.3) * sh - 4);
  R.drawWorld(ctx, SIM, st, G.t, G.cam, LW, { cr: p.cr }); G.parts.draw(ctx); if (p.alive && G.respawn === 0) R.drawPlayer(ctx, p, G.t, G.sq + Math.max(-0.3, Math.min(0.3, -p.vy * 0.02))); ctx.restore();
  panel(ctx, 10, 10, 300, 40); text(ctx, 'STAGE ' + (G.stage + 1) + '/' + NST + ' · ' + st.name.toUpperCase(), 22, 36, 15, '#fff', 'left', 800);
  panel(ctx, LW - 230, 10, 220, 40); text(ctx, (G.t / 60).toFixed(1) + ' s', LW - 216, 36, 16, '#fff', 'left', 800); text(ctx, 'deaths ' + G.deaths, LW - 22, 36, 14, '#ff8fa0', 'right', 800);
  if (G.auto || G.keys) text(ctx, G.keys ? 'BOT PRESSES THE KEYS' : 'AUTO (bot on the human input path)', 480, 36, 12, '#ffe27a', 'center', 800);
  if (G.intro > 0) { ctx.globalAlpha = Math.min(1, G.intro / 30); text(ctx, st.name.toUpperCase(), 480, 200, 54, '#fff', 'center', 900); ctx.globalAlpha = 1; }
  if (G.clear > 0) { panel(ctx, 280, 190, 400, 90, 0.85); text(ctx, 'STAGE CLEAR', 480, 232, 34, '#ffe27a', 'center', 900); text(ctx, G.times[G.stage] + ' s · ' + G.deaths + ' deaths', 480, 262, 16, '#fff', 'center', 700); }
  if (touch.on) { ctx.globalAlpha = 0.35; [['◀', 65, touch.l], ['▶', 210, touch.r]].forEach(b => { ctx.fillStyle = b[2] ? '#ff7ad9' : '#fff'; ctx.beginPath(); ctx.arc(b[1], 450, 54, 0, 7); ctx.fill(); text(ctx, b[0], b[1], 464, 40, '#10122c', 'center'); }); ctx.fillStyle = touch.j ? '#ff7ad9' : '#fff'; ctx.beginPath(); ctx.arc(860, 440, 64, 0, 7); ctx.fill(); text(ctx, 'JUMP', 860, 448, 22, '#10122c', 'center', 900); ctx.globalAlpha = 1; }
}
// ---------- results, name entry, leaderboard ----------
// The server never takes a time from the page. It replays the recorded inputs with the same sim and stores what it gets.
const B = { rows: null, status: '', name: '', sent: false, busy: false, mine: '', kind: 'h' };
const store = { get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
if (Q.get('owner')) store.set('hg_owner', Q.get('owner'));
function loadBoard() { B.status = 'loading…'; fetch('api/scores', { cache: 'no-store' }).then(r => r.ok ? r.json() : Promise.reject()).then(d => { B.rows = d.scores; B.status = ''; }).catch(() => { B.rows = null; B.status = 'leaderboard not available here (it needs the hosted game)'; }); }
function openBoard() { state = 'board'; loadBoard(); }
function openResults() { B.sent = false; B.busy = false; B.mine = ''; B.name = store.get('hg_name'); loadBoard(); }
function submitScore() {
  if (B.busy || B.sent || !B.name) return; B.busy = true; B.status = 'checking your run…'; store.set('hg_name', B.name);
  fetch('api/scores', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: B.name, version: SIM.VERSION, stages: G.rec, key: store.get('hg_owner') || undefined }) })
    .then(r => r.json().then(d => ({ ok: r.ok, d }))).then(({ ok, d }) => { B.busy = false; if (!ok) { B.status = d.error || 'not accepted'; return; } B.sent = true; B.rows = d.scores; B.mine = B.name; B.kind = d.kind; B.status = 'rank ' + d.rank + ' · checked by replay on the server'; HG.submitted = d; })
    .catch(() => { B.busy = false; B.status = 'could not reach the leaderboard'; });
}
const canSubmit = () => G.eligible && G.rec.filter(Boolean).length === NST && !B.sent;
addEventListener('keydown', e => { if (state !== 'results' || !canSubmit()) return;
  if (e.key.length === 1 && /[A-Za-z0-9-]/.test(e.key) && B.name.length < 12) B.name += e.key; else if (e.key === 'Backspace') B.name = B.name.slice(0, -1); else if (e.key === 'Enter') submitScore(); else return; e.preventDefault(); });
function updateResults() {
  if (hit('Escape')) { state = 'title'; return; }
  if (canSubmit()) { if (taps.length) { const n = window.prompt('Name for the leaderboard (letters, digits, -; 12 at most)', B.name) || ''; B.name = n.replace(/[^A-Za-z0-9-]/g, '').slice(0, 12); if (B.name) submitScore(); } return; }
  if (hit('Enter') || hit('Space') || taps.length) state = 'title';
}
function updateBoard() { if (hit('Escape') || hit('Enter') || hit('Space') || taps.length) state = 'title'; }
function drawRows(x, y, w, maxRows) {
  text(ctx, 'LEADERBOARD · v' + SIM.VERSION, x, y, 16, '#ffe27a', 'left', 900); text(ctx, 'all 8 stages, total time', x + w, y, 11, '#9aa0c8', 'right', 600);
  if (!B.rows) { text(ctx, B.status || '', x, y + 34, 13, '#9aa0c8', 'left', 600); return; }
  if (!B.rows.length) text(ctx, 'no times yet. Be the first.', x, y + 34, 13, '#9aa0c8', 'left', 600);
  B.rows.slice(0, maxRows).forEach((r, i) => { const yy = y + 30 + i * 27, me = B.mine && r.name.toLowerCase() === B.mine.toLowerCase() && r.kind === B.kind;
    if (me) { ctx.fillStyle = 'rgba(255,122,217,.22)'; ctx.fillRect(x - 8, yy - 18, w + 16, 25); }
    text(ctx, (i + 1) + '', x + 18, yy, 15, i === 0 ? '#ffe27a' : '#9aa0c8', 'right', 800); text(ctx, r.name, x + 30, yy, 15, '#fff', 'left', 800);
    if (r.kind !== 'h') { const nw = ctx.measureText(r.name).width; ctx.fillStyle = r.kind === 'b' ? '#6ec6ff' : '#ffb347'; ctx.beginPath(); ctx.roundRect(x + 38 + nw, yy - 13, 36, 16, 4); ctx.fill(); text(ctx, r.kind === 'b' ? 'BOT' : 'PAR', x + 56 + nw, yy - 1, 10, '#10122c', 'center', 900); }
    text(ctx, (r.frames / 60).toFixed(2) + ' s', x + w - 50, yy, 15, '#fff', 'right', 800); text(ctx, r.kind === 'p' ? '' : r.deaths + ' ✕', x + w, yy, 13, '#ff8fa0', 'right', 700); });
}
function drawBoard() {
  R.drawBackdrop(ctx, SIM.STAGES[0], tick * 2, LW, LH); ctx.fillStyle = 'rgba(8,8,30,.6)'; ctx.fillRect(0, 0, LW, LH);
  text(ctx, 'HUNDRED GHOSTS', 480, 66, 40, '#fff', 'center', 900); panel(ctx, 250, 92, 460, 380); drawRows(274, 126, 412, 12);
  text(ctx, 'BOT = a scripted ghost bot · PAR = a target time, not a played run', 480, 494, 12, '#9aa0c8', 'center', 600); text(ctx, 'enter / tap: back', 480, 520, 13, '#9aa0c8', 'center', 600);
}
function drawResults() {
  R.drawBackdrop(ctx, SIM.STAGES[0], tick * 2, LW, LH); ctx.fillStyle = 'rgba(8,8,30,.6)'; ctx.fillRect(0, 0, LW, LH);
  text(ctx, 'ALL STAGES CLEAR', 480, 62, 44, '#ffe27a', 'center', 900); panel(ctx, 30, 86, 430, 330); panel(ctx, 480, 86, 450, 400);
  let tt = 0, dd = 0; G.times.forEach((t, i) => { tt += G.frames[i] !== undefined ? G.frames[i] / 60 : t; dd += G.dcount[i]; const y = 120 + i * 30; text(ctx, (i + 1) + '  ' + SIM.STAGES[i].name, 52, y, 15, '#fff', 'left', 700); text(ctx, t.toFixed(2) + ' s', 360, y, 15, '#b8f', 'right', 800); text(ctx, G.dcount[i] + ' ✕', 440, y, 15, '#ff8fa0', 'right', 800); });
  text(ctx, 'TOTAL', 52, 396, 19, '#ffe27a', 'left', 900); text(ctx, tt.toFixed(2) + ' s', 360, 396, 19, '#ffe27a', 'right', 900); text(ctx, dd + ' ✕', 440, 396, 19, '#ff8fa0', 'right', 900);
  drawRows(504, 120, 402, 12);
  if (canSubmit()) { panel(ctx, 30, 428, 430, 58, 0.9); text(ctx, 'YOUR NAME', 52, 450, 11, '#9aa0c8', 'left', 800); text(ctx, B.name + (tick % 40 < 20 ? '▌' : ''), 52, 475, 20, '#fff', 'left', 900); text(ctx, touch.on ? 'tap to enter' : 'type, then Enter', 440, 475, 12, '#ffe27a', 'right', 700); }
  else if (!G.eligible) { text(ctx, G.auto ? 'bot run: not sent to the leaderboard' : 'start from stage 1 for a leaderboard time', 245, 462, 13, '#9aa0c8', 'center', 600); }
  if (B.status && B.rows) text(ctx, B.status, 245, 510, 13, B.sent ? '#5df2a0' : '#ffb347', 'center', 800);
  text(ctx, (canSubmit() ? 'esc' : 'enter / tap') + ': back to title', 705, 512, 13, '#9aa0c8', 'center', 600);
}

// ---------- swarm mode ----------
const W = {};
function startSwarm(stage) { state = 'swarm'; HG.mode = 'swarm'; HG.over = false; W.tour = stage === 'all'; W.bars = barsOf(SIM.VERSION); if (W.tour) W.bars = new Array(NST).fill(null); W.hold = 0; W.done = false; swarmStage(W.tour ? 0 : stage); }
function swarmStage(i) { W.view = new R.SwarmView(SIM, i, SEED, { bars: W.bars }); W.hold = 0; HG.stage = i; }
function updateSwarm() {
  if (hit('Escape')) { state = 'title'; return; }
  if (W.done) return; const v = W.view; v.update(SPEED);
  if (v.sw.over) { if (W.hold === 0) { W.bars = v.bars.slice(); HG.results.push(Object.assign({ stage: v.stageIndex }, SIM.swarmStats(v.sw))); }
    if (++W.hold > 170 / Math.min(SPEED, 3) && W.tour && v.stageIndex + 1 < NST) swarmStage(v.stageIndex + 1);
    else if (W.hold > 5 && (!W.tour || v.stageIndex + 1 >= NST)) { HG.over = true; if (Q.get('hold') === '1' || !W.tour) W.done = true; else if (W.hold > 400) state = 'title'; } }
}
function drawSwarm() {
  const v = W.view; v.draw(ctx, 0, 0, LW, LH, { full: true, speed: SPEED });
  if (v.sw.over) { const pct = v.midPct(), col = R.bandColor(pct); panel(ctx, 300, 200, 360, 104, 0.9); text(ctx, v.st.name.toUpperCase(), 480, 228, 14, '#b8bde6', 'center', 800); text(ctx, Math.round(pct) + '% mid-skill pass', 480, 262, 28, col, 'center', 900);
    text(ctx, pct < 60 ? 'TOO HARD · below the 60–80 band' : pct > 80 ? 'TOO EASY · above the 60–80 band' : 'IN THE 60–80 BAND', 480, 288, 13, col, 'center', 800); }
}

// ---------- replay mode: two versions, same seed, same bots ----------
const P = {};
function startReplay(a, b, stage) { state = 'loading'; HG.mode = 'replay'; Promise.all([loadVersion(a), loadVersion(b), getJSON('log/v' + a + '.json'), getJSON('log/v' + b + '.json')]).then(r => { P.api = [r[0], r[1]]; P.ver = [a, b]; P.tour = stage === 'all'; LOGS[a] = r[2] || LOGS[a]; LOGS[b] = r[3] || LOGS[b]; replayStage(P.tour ? 0 : +stage); state = 'replay'; }).catch(() => { state = 'title'; }); }
function replayStage(i) { P.views = P.api.map((api, k) => new R.SwarmView(api, i, SEED, {})); P.hold = 0; P.stage = i; HG.stage = i; HG.over = false; }
function updateReplay() {
  if (hit('Escape')) { state = 'title'; return; }
  P.views.forEach(v => v.update(SPEED));
  if (P.views.every(v => v.sw.over)) { HG.over = true; if (++P.hold > 200 && Q.get('hold') !== '1') replayStage(P.tour ? (P.stage + 1) % NST : P.stage); }
}
function drawReplay() {
  P.views[0].draw(ctx, 0, 0, LW, 269, { versionLabel: P.ver[0], accent: '#ff8fa0' }); P.views[1].draw(ctx, 0, 271, LW, 269, { versionLabel: P.ver[1], accent: '#5df2a0' });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 269, LW, 2);
  panel(ctx, 290, 256, 380, 28, 0.95); text(ctx, 'SAME SEED ' + SEED + ' · SAME 100 BOT SKILL PROFILES' + (SPEED !== 1 ? ' · ×' + SPEED + ' speed' : ''), 480, 275, 12, '#ffe27a', 'center', 800);
}

// ---------- review sheet: 6 frames of one bot's run, for the playtester panel ----------
function drawSheet() {
  const s = +(Q.get('stage') || 0), bi = +(Q.get('bot') || 50); LW = 1440; resize();
  const sw = SIM.createSwarm(s, SEED, 100), b = sw.bots[bi], snaps = [];
  while (!sw.over && (b.p.alive && !b.p.done)) { sw.step(); snaps.push({ x: b.p.x, y: b.p.y, vx: b.p.vx, vy: b.p.vy, face: b.p.face, alive: b.p.alive, done: b.p.done, cr: b.p.cr.slice() }); }
  const F = snaps.length, st = sw.st, worldW = st.W * SIM.T; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (let k = 0; k < 6; k++) { const f = Math.max(0, Math.round(F * (k + 1) / 6) - 1), p = snaps[f], cx = (k % 3) * 480, cy = (k / 3 | 0) * 270, cam = Math.max(0, Math.min(worldW - 960, p.x - 400));
    ctx.save(); ctx.beginPath(); ctx.rect(cx, cy, 480, 270); ctx.clip(); ctx.translate(cx, cy); ctx.scale(0.5, 0.5); R.drawBackdrop(ctx, st, cam, 960, 540); ctx.translate(-cam, -4); R.drawWorld(ctx, SIM, st, f, cam, 960, { cr: p.cr });
    if (p.alive) R.drawPlayer(ctx, p, f, 0); else { const pp = new R.Particles(); pp.burst(p.x + 9, Math.min(p.y + 13, 520), 26, '#ff5d73', 9, 10); pp.a.forEach(q => { q.x += q.vx * 3; q.y += q.vy * 3; q.s *= 2; }); pp.draw(ctx); }
    ctx.restore(); panel(ctx, cx + 6, cy + 6, 250, 24); const last = k === 5; text(ctx, 't=' + (f / 60).toFixed(1) + 's' + (last ? (p.done ? ' · REACHED GOAL' : ' · DIED: ' + b.p.cause) : ''), cx + 14, cy + 23, 13, last ? (p.done ? '#5df2a0' : '#ff8fa0') : '#fff', 'left', 800);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(cx, cy, 480, 270); }
  HG.over = true; HG.sheet = { stage: s, bot: bi, skill: b.skill, frames: F, result: b.p.done ? 'goal' : b.p.cause, x: Math.round(b.p.x), stageWidth: worldW };
}

// ---------- headless API for tools/run-swarm.mjs ----------
window.HG_HEADLESS = { run(stage, seed, n) { const t0 = performance.now(), sw = SIM.createSwarm(stage, seed, n || 100); while (!sw.over) sw.step(); const r = SIM.swarmStats(sw); r.stage = stage; r.seed = seed; r.simMs = Math.round(performance.now() - t0); r.deaths = sw.deaths; r.events = sw.events; r.name = sw.st.name; r.widthPx = sw.st.W * SIM.T; return r; }, version: SIM.VERSION, stages: NST };

// ---------- main loop ----------
function update() {
  tick++;
  if (state === 'title') updateTitle(); else if (state === 'play') updatePlay(); else if (state === 'results') updateResults(); else if (state === 'board') updateBoard(); else if (state === 'swarm') updateSwarm(); else if (state === 'replay') updateReplay();
  pressed = []; taps = [];
}
function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (state === 'title') drawTitle(); else if (state === 'play') drawPlay(); else if (state === 'results') drawResults(); else if (state === 'board') drawBoard(); else if (state === 'swarm') drawSwarm(); else if (state === 'replay') drawReplay();
  else { ctx.fillStyle = '#0b1026'; ctx.fillRect(0, 0, LW, LH); text(ctx, 'loading…', 480, 270, 20, '#fff', 'center'); }
}
let last = 0, acc = 0;
function frame(now) {
  const dt = Math.min(100, now - last); if (last) HG.rafMs.push(+dt.toFixed(2)); last = now; acc += dt; let n = 0; const t0 = performance.now();
  while (acc >= 1000 / 60 - 0.5 && n < 4) { update(); acc -= 1000 / 60; n++; } if (acc > 100) acc = 0; if (acc < 0) acc = 0;
  draw(); if (HG.frameMs.length < 4000) HG.frameMs.push(+(performance.now() - t0).toFixed(2));
  requestAnimationFrame(frame);
}
resize();
const mode = Q.get('mode');
if (mode === 'sheet') { drawSheet(); return; }
if (mode === 'headless') { HG.mode = 'headless'; return; }
Promise.all([getJSON('log/index.json'), getJSON('log/v' + SIM.VERSION + '.json')]).then(r => {
  if (r[0] && r[0].versions && r[0].versions.length) INDEX = r[0]; if (r[1]) LOGS[SIM.VERSION] = r[1];
  const stage = Q.get('stage') || 'all', s0 = stage === 'all' || stage === 'gym' ? stage : +stage - 1;
  if (mode === 'swarm') startSwarm(s0); else if (mode === 'replay') startReplay(+(Q.get('a') || 1), +(Q.get('b') || INDEX.versions[INDEX.versions.length - 1]), s0); else if (mode === 'play') startPlay(s0 === 'all' ? 0 : s0); else if (mode === 'board') openBoard();
  requestAnimationFrame(frame);
});
})();
