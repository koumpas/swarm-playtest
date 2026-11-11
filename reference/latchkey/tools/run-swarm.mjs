// Runs the swarm on every stage in headless Chromium and writes log/vN.json + screenshots.
// usage: node tools/run-swarm.mjs            (measures the working-tree sim.js)
import { chromium } from 'playwright'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { serve } from './serve.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEEDS = [101, 202, 303, 404, 505], BOTS = 100, SHEET_BOTS = [15, 50, 85]; // never change the seeds between versions
const pct = (a, b) => b ? +(100 * a / b).toFixed(1) : 0;
const q = (arr, p) => { const s = arr.slice().sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : null; };

const srv = await serve(); const br = await chromium.launch();
const pg = await br.newPage({ viewport: { width: 960, height: 540 } });
const errors = []; pg.on('pageerror', e => errors.push(e.message));
await pg.goto(srv.url + '/index.html?mode=headless');
const info = await pg.evaluate(() => ({ version: LK_HEADLESS.version, stages: LK_HEADLESS.stages, band: LK_HEADLESS.band }));
const V = info.version, BAND = info.band, lines = [], say = s => { const l = `[v${V}] ${s}`; lines.push(l); console.log(l); };
const shotDir = path.join(ROOT, 'shots', 'v' + V); fs.mkdirSync(shotDir, { recursive: true });
say(`swarm run: seeds ${SEEDS.join(',')} · ${BOTS} bots · ${info.stages} stages · ${SEEDS.length * BOTS * info.stages} bot runs`);

const stages = [], findings = [];
for (let s = 0; s < info.stages; s++) {
  const runs = []; for (const seed of SEEDS) runs.push(await pg.evaluate(([s, seed, n]) => LK_HEADLESS.run(s, seed, n), [s, seed, BOTS]));
  const sum = k => runs.reduce((a, r) => a + r[k], 0), causes = {}, deaths = [], spots = {};
  for (const r of runs) { for (const d of r.deaths) { causes[d.c] = (causes[d.c] || 0) + 1; deaths.push([d.x, d.y, d.c, r.seed, d.i, d.k]); const k = Math.floor(d.x / 32) + ',' + Math.floor(d.y / 32) + '|' + d.c; spots[k] = (spots[k] || 0) + 1; } }
  const hotspots = Object.entries(spots).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => ({ cell: k.split('|')[0], cause: k.split('|')[1], count: n }));
  const total = SEEDS.length * BOTS, st = { index: s, name: runs[0].name, keys: runs[0].keys, pass: sum('pass'), total, passPct: pct(sum('pass'), total),
    lowPct: pct(sum('passLow'), sum('nLow')), midPct: pct(sum('passMid'), sum('nMid')), highPct: pct(sum('passHigh'), sum('nHigh')), nMid: sum('nMid'),
    avgFinishSec: +(runs.reduce((a, r) => a + (r.avgFinishSec || 0) * r.pass, 0) / Math.max(1, sum('pass'))).toFixed(2), maxFrames: Math.max(...runs.map(r => r.frames)),
    causes, stuck: sum('stuck'), embedded: sum('embedded'), warp: sum('warp'), earlyexit: sum('earlyexit'), hotspots,
    runs: runs.map(r => ({ seed: r.seed, pass: r.pass, passLow: r.passLow, passMid: r.passMid, passHigh: r.passHigh, frames: r.frames, simMs: r.simMs, causes: r.causes, stuck: r.stuck, embedded: r.embedded, warp: r.warp, earlyexit: r.earlyexit })),
    events: runs.flatMap(r => r.events.map(e => ({ type: e.type, seed: r.seed, bot: e.i, t: e.t, x: Math.round(e.x), y: Math.round(e.y) }))).slice(0, 60), deaths };
  stages.push(st);
  const hs = hotspots[0];
  say(`stage ${s + 1} ${st.name}: pass ${st.pass}/${total} (${st.passPct}%) · low ${st.lowPct} mid ${st.midPct} high ${st.highPct} · finish ${st.avgFinishSec} s · deaths ${Object.entries(causes).map(e => e.join(' ')).join(', ') || 'none'} · stuck ${st.stuck} embedded ${st.embedded} warp ${st.warp} early-exit ${st.earlyexit}${hs ? ` · top death spot: cell ${hs.cell} ${hs.cause} ×${hs.count}` : ''}`);
  const f = (kind, msg) => { findings.push({ stage: s + 1, kind, msg }); };
  if (st.midPct < BAND[0]) f('too-hard', `mid-skill pass ${st.midPct}% < ${BAND[0]}%`); else if (st.midPct > BAND[1]) f('too-easy', `mid-skill pass ${st.midPct}% > ${BAND[1]}%`);
  if (st.stuck) f('stuck', `${st.stuck} bots stuck (no progress for 8 s)`);
  if (st.embedded) f('embedded', `${st.embedded} bots inside a wall tile`);
  if (st.warp) f('warp', `${st.warp} frames where a bot moved more than 1.2 x top speed`);
  if (st.earlyexit) f('early-exit', `${st.earlyexit} bots left without all keys`);
  if (causes.timeout) f('timeout', `${causes.timeout} bots hit the 45 s limit`);
  if (st.highPct < st.midPct) f('skill-order', `high-skill pass ${st.highPct}% is below mid-skill ${st.midPct}%`);
  const se = +(100 * Math.sqrt(st.midPct / 100 * (1 - st.midPct / 100) / Math.max(1, st.nMid))).toFixed(1); st.midSE = se; // sampling error of the mid-skill pass rate, in points
  const edge = Math.min(Math.abs(st.midPct - BAND[0]), Math.abs(st.midPct - BAND[1])); if (edge < se) f('near-edge', `mid-skill pass ${st.midPct}% is ${edge.toFixed(1)} points from the band edge; sampling error is ±${se}. Do not tune on this: add seeds first`);
  if (st.avgFinishSec < 10 || st.avgFinishSec > 20) f('length', `mean finish time ${st.avgFinishSec} s is outside 10–20 s`);
}
for (const f of findings) say(`FINDING stage ${f.stage} [${f.kind}]: ${f.msg}`);
const inBand = stages.filter(s => s.midPct >= BAND[0] && s.midPct <= BAND[1]).length;
say(`stages in the ${BAND[0]}–${BAND[1]}% mid-skill band: ${inBand}/${stages.length}`);

// Write the log now, before the screenshots: the game reads it and draws the five-seed pass rates (bars and end label).
// If not, a screenshot shows only the number of one seed, and that can be 20 points from the measurement.
const out = { version: V, measuredAt: new Date().toISOString(), seeds: SEEDS, bots: BOTS, band: BAND, botRuns: SEEDS.length * BOTS * info.stages, inBand, stages, findings };
const writeLog = () => { fs.mkdirSync(path.join(ROOT, 'log'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'log', `v${V}.json`), JSON.stringify(out)); };
writeLog();

// real-time pass: frame time + screenshots (the HUD and heatmap in them are drawn by the game)
const cpu = [], raf = [], shots = [], sheets = [];
for (let s = 0; s < info.stages; s++) {
  await pg.goto(`${srv.url}/index.html?mode=swarm&stage=${s + 1}&seed=${SEEDS[0]}`); await pg.waitForTimeout(3000);
  const ft = await pg.evaluate(() => ({ cpu: __lk.frameMs.slice(30), raf: __lk.rafMs.slice(30) })); cpu.push(...ft.cpu); raf.push(...ft.raf);
  await pg.screenshot({ path: path.join(shotDir, `s${s + 1}-mid.png`) });
  await pg.goto(`${srv.url}/index.html?mode=swarm&stage=${s + 1}&seed=${SEEDS[0]}&speed=30`); await pg.waitForFunction(() => __lk.over, null, { timeout: 60000 }); await pg.waitForTimeout(300);
  await pg.screenshot({ path: path.join(shotDir, `s${s + 1}-end.png`) }); shots.push(`shots/v${V}/s${s + 1}-mid.png`, `shots/v${V}/s${s + 1}-end.png`);
}
await pg.setViewportSize({ width: 1440, height: 540 });
for (let s = 0; s < info.stages; s++) for (const b of SHEET_BOTS) {
  await pg.goto(`${srv.url}/index.html?mode=sheet&stage=${s}&seed=${SEEDS[0]}&bot=${b}`); await pg.waitForFunction(() => __lk.over);
  const sh = await pg.evaluate(() => __lk.sheet); sh.file = `shots/v${V}/s${s + 1}-bot${b}.png`; sheets.push(sh);
  if (b === 50) await pg.screenshot({ path: path.join(ROOT, sh.file) }); else delete sh.file;
}
const frameTime = { note: 'swarm mode, 100 bots, speed 1, headless Chromium on the build machine', frames: cpu.length, cpuMedianMs: q(cpu, 0.5), cpuP95Ms: q(cpu, 0.95), cpuMaxMs: q(cpu, 1), rafMedianMs: q(raf, 0.5), rafP95Ms: q(raf, 0.95) };
say(`frame time (update+draw, ${cpu.length} frames): median ${frameTime.cpuMedianMs} ms · p95 ${frameTime.cpuP95Ms} ms · max ${frameTime.cpuMaxMs} ms · rAF interval median ${frameTime.rafMedianMs} ms`);
if (errors.length) say(`PAGE ERRORS: ${errors.join(' | ')}`);
await br.close(); srv.srv.close();

Object.assign(out, { frameTime, shots, sheets, lines, pageErrors: errors }); writeLog();
const versions = fs.readdirSync(path.join(ROOT, 'log')).map(f => /^v(\d+)\.json$/.exec(f)).filter(Boolean).map(m => +m[1]).sort((a, b) => a - b);
fs.writeFileSync(path.join(ROOT, 'log', 'index.json'), JSON.stringify({ versions }));
console.log(`wrote log/v${V}.json`);
