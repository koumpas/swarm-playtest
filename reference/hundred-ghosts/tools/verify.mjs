// Checks of the final build in headless Chromium: human input path, touch, autoplay of all stages, replay, determinism vs log.
import { chromium } from 'playwright'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { serve } from './serve.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const s = await serve(); const br = await chromium.launch(); const out = {};
const errs = []; const mk = async o => { const c = await br.newContext(o); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); return p; };
// 1. keyboard: real key events move the player and jump
let pg = await mk({ viewport: { width: 960, height: 540 } }); await pg.goto(s.url + '/index.html'); await pg.waitForTimeout(600); await pg.keyboard.press('Enter'); await pg.waitForTimeout(300);
await pg.keyboard.down('ArrowRight'); await pg.waitForTimeout(500); await pg.keyboard.down('Space'); await pg.waitForTimeout(150); await pg.keyboard.up('Space'); await pg.keyboard.up('ArrowRight');
await pg.screenshot({ path: path.join(ROOT, 'shots', 'play-keyboard.png') }); out.keyboard = 'title -> Enter -> ArrowRight + Space sent; see shots/play-keyboard.png';
// 2. touch: on-screen buttons
pg = await mk({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }); await pg.goto(s.url + '/index.html?mode=play&stage=1'); await pg.waitForTimeout(500);
const box = await pg.locator('canvas').boundingBox(); const tap = (x, y) => ({ x: box.x + box.width * x / 960, y: box.y + box.height * y / 540 });
const cdp = await pg.context().newCDPSession(pg); const r = tap(210, 450), j = tap(860, 440);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y, id: 1 }] }); await pg.waitForTimeout(600);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: r.x, y: r.y, id: 1 }, { x: j.x, y: j.y, id: 2 }] }); await pg.waitForTimeout(120);
await pg.screenshot({ path: path.join(ROOT, 'shots', 'play-touch.png') }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); out.touch = 'touch right + jump sent in an emulated 844x390 phone viewport; see shots/play-touch.png';
// 3. autoplay: a top-skill bot on the human input path must finish all stages
pg = await mk({ viewport: { width: 960, height: 540 } }); await pg.goto(s.url + '/index.html?mode=play&auto=1'); await pg.waitForFunction(() => __hg.over, null, { timeout: 400000 }); await pg.waitForTimeout(300);
out.autoplay = await pg.evaluate(() => __hg.results); await pg.screenshot({ path: path.join(ROOT, 'shots', 'results-screen.png') });
// 4. replay v1 vs latest, same seed
const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'log', 'index.json'), 'utf8')).versions, last = idx[idx.length - 1];
await pg.goto(`${s.url}/index.html?mode=replay&a=1&b=${last}&stage=2&speed=4&hold=1`); await pg.waitForTimeout(2500); await pg.screenshot({ path: path.join(ROOT, 'shots', `replay-v1-vs-v${last}-stage2-mid.png`) });
await pg.waitForFunction(() => __hg.over, null, { timeout: 120000 }); await pg.screenshot({ path: path.join(ROOT, 'shots', `replay-v1-vs-v${last}-stage2-end.png`) });
// 5. determinism: every snapshot versions/vN.js, run again now, must give the pass counts in log/vN.json (seed 101)
out.determinism = [];
for (const n of idx) { await pg.goto(s.url + '/index.html?mode=headless'); await pg.addScriptTag({ url: `versions/v${n}.js` });
  const got = await pg.evaluate(n => { const A = HG_VERSIONS[n]; return A.STAGES.map((_, i) => { const sw = A.createSwarm(i, 101, 100); while (!sw.over) sw.step(); return sw.finished; }); }, n);
  const want = JSON.parse(fs.readFileSync(path.join(ROOT, 'log', `v${n}.json`), 'utf8')).stages.map(x => x.runs[0].pass); out.determinism.push({ version: n, match: JSON.stringify(got) === JSON.stringify(want), got, want }); }
// 6. viewer + title screenshots
await pg.goto(s.url + '/index.html'); await pg.waitForTimeout(1500); await pg.screenshot({ path: path.join(ROOT, 'shots', 'title.png') });
pg = await mk({ viewport: { width: 1280, height: 720 } }); await pg.goto(s.url + '/viewer.html'); await pg.waitForTimeout(21000); await pg.screenshot({ path: path.join(ROOT, 'shots', 'viewer-mid.png') }); await pg.waitForFunction(() => __viewer.done, null, { timeout: 60000 }); out.viewerSeconds = await pg.evaluate(() => +__viewer.el.toFixed(1)); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(ROOT, 'shots', 'viewer-end.png') });
out.pageErrors = errs; await br.close(); s.srv.close();
fs.writeFileSync(path.join(ROOT, 'log', 'verify.json'), JSON.stringify(out, null, 1));
console.log('autoplay', JSON.stringify(out.autoplay)); console.log('determinism', out.determinism.map(d => 'v' + d.version + ':' + d.match).join(' ')); console.log('viewer seconds', out.viewerSeconds, 'errors', errs.length, errs.slice(0, 3));
