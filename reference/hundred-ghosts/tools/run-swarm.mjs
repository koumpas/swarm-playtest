// Runs the swarm on every stage in headless Chromium and writes log/vN.json + screenshots.
// usage: node tools/run-swarm.mjs            (measures the working-tree sim.js)
import { chromium } from 'playwright'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { serve } from './serve.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEEDS = [101, 202, 303, 404, 505], BOTS = 100, BAND = [60, 80], SHEET_BOTS = [15, 50, 85];
const pct = (a, b) => b ? +(100 * a / b).toFixed(1) : 0;
const q = (arr, p) => { const s = arr.slice().sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : null; };

const srv = await serve(); const br = await chromium.launch();
const pg = await br.newPage({ viewport: { width: 960, height: 540 } });
const errors = []; pg.on('pageerror', e => errors.push(e.message));
await pg.goto(srv.url + '/index.html?mode=headless');
const info = await pg.evaluate(() => ({ version: HG_HEADLESS.version, stages: HG_HEADLESS.stages }));
const V = info.version, lines = [], say = s => { const l = `[v${V}] ${s}`; lines.push(l); console.log(l); };
const shotDir = path.join(ROOT, 'shots', 'v' + V); fs.mkdirSync(shotDir, { recursive: true });
say(`swarm run: seeds ${SEEDS.join(',')} · ${BOTS} bots · ${info.stages} stages · ${SEEDS.length * BOTS * info.stages} bot runs`);

const stages = [], findings = [];
for (let s = 0; s < info.stages; s++) {
  const runs = []; for (const seed of SEEDS) runs.push(await pg.evaluate(([s, seed, n]) => HG_HEADLESS.run(s, seed, n), [s, seed, BOTS]));
  const sum = k => runs.reduce((a, r) => a + r[k], 0), causes = {}, deaths = [], spots = {};
  for (const r of runs) { for (const d of r.deaths) { causes[d.c] = (causes[d.c] || 0) + 1; deaths.push([d.x, d.y, d.c, r.seed, d.i]); const k = Math.floor(d.x / 32) + '|' + d.c; spots[k] = (spots[k] || 0) + 1; } }
  const hotspots = Object.entries(spots).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => ({ tile: +k.split('|')[0], cause: k.split('|')[1], count: n }));
  const total = SEEDS.length * BOTS, st = { index: s, name: runs[0].name, widthPx: runs[0].widthPx, pass: sum('pass'), total, passPct: pct(sum('pass'), total),
    lowPct: pct(sum('passLow'), sum('nLow')), midPct: pct(sum('passMid'), sum('nMid')), highPct: pct(sum('passHigh'), sum('nHigh')), nMid: sum('nMid'),
    avgFinishSec: +(runs.reduce((a, r) => a + (r.avgFinishSec || 0) * r.pass, 0) / Math.max(1, sum('pass'))).toFixed(2), maxFrames: Math.max(...runs.map(r => r.frames)),
    causes, stuck: sum('stuck'), embedded: sum('embedded'), fallthrough: sum('fallthrough'), hotspots,
    runs: runs.map(r => ({ seed: r.seed, pass: r.pass, passLow: r.passLow, passMid: r.passMid, passHigh: r.passHigh, frames: r.frames, simMs: r.simMs, causes: r.causes, stuck: r.stuck, embedded: r.embedded, fallthrough: r.fallthrough })),
    events: runs.flatMap(r => r.events.map(e => ({ type: e.type, seed: r.seed, bot: e.i, t: e.t, x: Math.round(e.x), y: Math.round(e.y) }))).slice(0, 60), deaths };
  stages.push(st);
  const hs = hotspots[0];
  say(`stage ${s + 1} ${st.name}: pass ${st.pass}/${total} (${st.passPct}%) · low ${st.lowPct} mid ${st.midPct} high ${st.highPct} · deaths ${Object.entries(causes).map(e => e.join(' ')).join(', ') || 'none'} · stuck ${st.stuck} embedded ${st.embedded} fall-through ${st.fallthrough}${hs ? ` · top death spot: tile ${hs.tile} ${hs.cause} ×${hs.count}` : ''}`);
  const f = (kind, msg) => { findings.push({ stage: s + 1, kind, msg }); };
  if (st.midPct < BAND[0]) f('too-hard', `mid-skill pass ${st.midPct}% < ${BAND[0]}%`); else if (st.midPct > BAND[1]) f('too-easy', `mid-skill pass ${st.midPct}% > ${BAND[1]}%`);
  if (st.stuck) f('stuck', `${st.stuck} bots stuck (no progress for 8 s)`);
  if (st.embedded) f('embedded', `${st.embedded} bots ended inside a solid tile`);
  if (st.fallthrough) f('fall-through', `${st.fallthrough} fall-through events on moving platforms`);
  if (causes.timeout) f('timeout', `${causes.timeout} bots hit the 45 s limit`);
  if (st.highPct < 75) f('high-skill-fail', `high-skill pass only ${st.highPct}%`);
}
for (const f of findings) say(`FINDING stage ${f.stage} [${f.kind}]: ${f.msg}`);
const inBand = stages.filter(s => s.midPct >= BAND[0] && s.midPct <= BAND[1]).length;
say(`stages in the ${BAND[0]}–${BAND[1]}% mid-skill band: ${inBand}/${stages.length}`);

// write the log now, so the pass-rate bars of the other stages are filled in the screenshots; it is written again at the end
fs.mkdirSync(path.join(ROOT, 'log'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'log', `v${V}.json`), JSON.stringify({ version: V, seeds: SEEDS, bots: BOTS, band: BAND, inBand, stages, findings, lines }));
// real-time pass: frame time + screenshots (the HUD and heatmap in them are drawn by the game)
const cpu = [], raf = [], shots = [], sheets = [];
for (let s = 0; s < info.stages; s++) {
  await pg.goto(`${srv.url}/index.html?mode=swarm&stage=${s + 1}&seed=${SEEDS[0]}&hold=1`); await pg.waitForTimeout(3500);
  const ft = await pg.evaluate(() => ({ cpu: __hg.frameMs.slice(30), raf: __hg.rafMs.slice(30) })); cpu.push(...ft.cpu); raf.push(...ft.raf);
  await pg.screenshot({ path: path.join(shotDir, `s${s + 1}-mid.png`) });
  await pg.goto(`${srv.url}/index.html?mode=swarm&stage=${s + 1}&seed=${SEEDS[0]}&hold=1&speed=30`); await pg.waitForFunction(() => __hg.over, null, { timeout: 60000 }); await pg.waitForTimeout(400);
  await pg.screenshot({ path: path.join(shotDir, `s${s + 1}-end.png`) }); shots.push(`shots/v${V}/s${s + 1}-mid.png`, `shots/v${V}/s${s + 1}-end.png`);
}
await pg.setViewportSize({ width: 1440, height: 540 });
for (let s = 0; s < info.stages; s++) for (const b of SHEET_BOTS) {
  await pg.goto(`${srv.url}/index.html?mode=sheet&stage=${s}&seed=${SEEDS[0]}&bot=${b}`); await pg.waitForFunction(() => __hg.over);
  const sh = await pg.evaluate(() => __hg.sheet); sh.file = `shots/v${V}/s${s + 1}-bot${b}.png`; sheets.push(sh);
  if (b === 50) await pg.screenshot({ path: path.join(ROOT, sh.file) }); else delete sh.file;
}
const frameTime = { note: 'swarm mode, 100 bots, speed 1, headless Chromium on the build machine', frames: cpu.length, cpuMedianMs: q(cpu, 0.5), cpuP95Ms: q(cpu, 0.95), cpuMaxMs: q(cpu, 1), rafMedianMs: q(raf, 0.5), rafP95Ms: q(raf, 0.95) };
say(`frame time (update+draw, ${cpu.length} frames): median ${frameTime.cpuMedianMs} ms · p95 ${frameTime.cpuP95Ms} ms · max ${frameTime.cpuMaxMs} ms · rAF interval median ${frameTime.rafMedianMs} ms`);
if (errors.length) say(`PAGE ERRORS: ${errors.join(' | ')}`);
await br.close(); srv.srv.close();

const out = { version: V, measuredAt: new Date().toISOString(), seeds: SEEDS, bots: BOTS, band: BAND, botRuns: SEEDS.length * BOTS * info.stages, inBand, stages, findings, frameTime, shots, sheets, lines, pageErrors: errors };
fs.mkdirSync(path.join(ROOT, 'log'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'log', `v${V}.json`), JSON.stringify(out));
const versions = fs.readdirSync(path.join(ROOT, 'log')).map(f => /^v(\d+)\.json$/.exec(f)).filter(Boolean).map(m => +m[1]).sort((a, b) => a - b);
fs.writeFileSync(path.join(ROOT, 'log', 'index.json'), JSON.stringify({ versions }));
console.log(`wrote log/v${V}.json`);
