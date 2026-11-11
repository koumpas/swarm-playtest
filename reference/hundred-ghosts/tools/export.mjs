// Exports the real history for viewer.html: git data per version tag + playtester reviews.
// Writes log/history.json (and copies panel scores into it). usage: node tools/export.mjs
import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = c => execSync('git ' + c, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }).trim();
const tags = git('tag').split('\n').filter(t => /^v\d+$/.test(t)).map(t => +t.slice(1)).sort((a, b) => a - b);
const versions = [];
for (const n of tags) {
  const tag = 'v' + n, prev = n > 1 ? 'v' + (n - 1) : null;
  const [hash, date, subject] = git(`log -1 --format=%h%x1f%cI%x1f%s ${tag}`).split('\x1f');
  const body = git(`log -1 --format=%b ${tag}`).split('\n').filter(l => !/^Co-Authored-By/.test(l)).join('\n').trim();
  const g = { hash, date, subject, body, simDiff: [], filesChanged: 0, insertions: 0, deletions: 0 };
  if (prev) {
    for (const l of git(`diff --numstat ${prev} ${tag} -- . ":(exclude)log" ":(exclude)shots" ":(exclude)versions"`).split('\n').filter(Boolean)) { const [a, d] = l.split('\t'); g.filesChanged++; g.insertions += +a || 0; g.deletions += +d || 0; }
    // statement-level diff of the versioned sim file: the real removed / added builder calls
    const dl = git(`diff -U0 ${prev} ${tag} -- sim.js`).split('\n'); let cur = null;
    const split = l => l.slice(1).trim().split(/;\s*/).map(x => x.trim()).filter(Boolean);
    for (const l of dl) { if (l.startsWith('@@')) { cur = { hunk: l.replace(/^@@ (.*) @@.*/, '$1'), del: [], add: [] }; g.simDiff.push(cur); } else if (cur && l[0] === '-' && !l.startsWith('---')) cur.del.push(...split(l)); else if (cur && l[0] === '+' && !l.startsWith('+++')) cur.add.push(...split(l)); }
    for (const h of g.simDiff) { const add = h.add.slice(), del = []; for (const d of h.del) { const i = add.indexOf(d); if (i >= 0) add.splice(i, 1); else del.push(d); } h.del = del.join('; ').slice(0, 400); h.add = add.join('; ').slice(0, 400); }
    g.simDiff = g.simDiff.filter(h => (h.del || h.add) && !/const VERSION/.test(h.del));
  }
  const logFile = path.join(ROOT, 'log', `v${n}.json`), log = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, 'utf8')) : null;
  const rdir = path.join(ROOT, 'log', 'reviews', tag), reviews = [];
  if (fs.existsSync(rdir)) for (const f of fs.readdirSync(rdir).filter(f => f.endsWith('.json')).sort()) { try { const r = JSON.parse(fs.readFileSync(path.join(rdir, f), 'utf8')); reviews.push({ persona: r.persona, score: +r.score, stageScores: r.stageScores, review: r.review, best: r.best, worst: r.worst }); } catch (e) { console.error('bad review', tag, f); } }
  const panelScore = reviews.length ? +(reviews.reduce((a, r) => a + r.score, 0) / reviews.length).toFixed(2) : null;
  versions.push({ version: n, git: g, reviews, panelScore,
    metrics: log && { inBand: log.inBand, botRuns: log.botRuns, mid: log.stages.map(s => s.midPct), pass: log.stages.map(s => s.passPct), timeouts: log.stages.reduce((a, s) => a + (s.causes.timeout || 0), 0), deaths: log.stages.reduce((a, s) => a + s.deaths.length, 0), findings: log.findings.length, frameTime: log.frameTime },
    lines: log ? log.lines : [] });
  if (log) { log.reviews = reviews; log.panelScore = panelScore; log.git = g; fs.writeFileSync(logFile, JSON.stringify(log)); } // one file per version: metrics + heatmap data + reviews + git
}
const out = { exportedAt: new Date().toISOString(), stageNames: versions.length && fs.existsSync(path.join(ROOT, 'log', 'v1.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'log', 'v1.json'), 'utf8')).stages.map(s => s.name) : [], versions,
  totals: { versions: versions.length, commits: +git('rev-list --count HEAD'), botRuns: versions.reduce((a, v) => a + (v.metrics ? v.metrics.botRuns : 0), 0), reviews: versions.reduce((a, v) => a + v.reviews.length, 0) } };
fs.writeFileSync(path.join(ROOT, 'log', 'history.json'), JSON.stringify(out, null, 1));
console.log('versions', out.totals.versions, 'botRuns', out.totals.botRuns, 'reviews', out.totals.reviews);
for (const v of versions) console.log('v' + v.version, v.git.hash, 'inBand', v.metrics && v.metrics.inBand, 'panel', v.panelScore, '(' + v.reviews.map(r => r.score).join(', ') + ')', 'diff hunks', v.git.simDiff.length);
