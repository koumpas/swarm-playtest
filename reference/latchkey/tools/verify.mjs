// Checks of the final build. usage: node tools/verify.mjs
// 1. each versions/vN.js, run again in Node, gives the pass counts in log/vN.json;
// 2. a top-skill bot on the human input path (?auto=1) finishes every stage in the browser;
// 3. key events move the player.
import { chromium } from 'playwright'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module'; import { serve } from './serve.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), require = createRequire(import.meta.url); let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
for (const f of fs.readdirSync(path.join(ROOT, 'versions')).sort()) { const n = parseInt(f.slice(1), 10), S = require(path.join(ROOT, 'versions', f)), log = JSON.parse(fs.readFileSync(path.join(ROOT, 'log', `v${n}.json`), 'utf8'));
  const got = log.stages.map(st => log.seeds.reduce((a, seed) => { const sw = S.createSwarm(st.index, seed, log.bots); while (!sw.over) sw.step(); return a + S.swarmStats(sw).pass; }, 0));
  ok(S.VERSION === n && got.join() === log.stages.map(s => s.pass).join(), `versions/${f} run again in Node: pass counts ${got.join(' ')} = log/v${n}.json (${log.stages.map(s => s.pass).join(' ')})`); }
const srv = await serve(), br = await chromium.launch(), pg = await br.newPage({ viewport: { width: 960, height: 540 } }); const errors = []; pg.on('pageerror', e => errors.push(e.message));
await pg.goto(srv.url + '/index.html?mode=play&auto=1'); let done = false; try { await pg.waitForFunction(() => __lk.over, null, { timeout: 240000 }); done = true; } catch (e) {}
const res = await pg.evaluate(() => __lk.results); ok(done, `bot on the human input path finished all stages; time and deaths for each stage: ${JSON.stringify(res)}`);
await pg.goto(srv.url + '/index.html?mode=play&stage=1'); await pg.waitForTimeout(300);
const shot = async () => (await pg.screenshot({ clip: { x: 0, y: 0, width: 200, height: 480 } })).toString('base64');
await pg.keyboard.down('ArrowDown'); await pg.waitForTimeout(300); await pg.keyboard.up('ArrowDown'); const a = await shot(); await pg.keyboard.down('KeyD'); await pg.waitForTimeout(300); await pg.keyboard.up('KeyD'); const b = await shot();
ok(a !== b, 'key events change the picture near the spawn (ArrowDown, then D)'); ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
await br.close(); srv.srv.close(); console.log(bad ? bad + ' check(s) failed' : 'all checks passed'); process.exit(bad ? 1 : 0);
