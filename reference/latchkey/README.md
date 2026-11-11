# Latchkey: the second worked example (not a platformer)

A top-down "dodge and collect" game: 4 one-screen stages, 8-direction movement, keys and an exit, three hazard kinds. It was built by a session that had only the skill folder, in 5 versions, with a 50–70% target. Result: 3 of 4 stages in the band; stage 3 ended at 42.7%. `COMMITS.md` has the 5 messages, with two reverted changes and the reason the last stage was not hit (steps taken inside the sampling error, then one step too large).

Read this example for:
- `sim.js`: a bot for free movement. Progress = a walking-distance field (`field`, `estDist`), a default policy inside the look-ahead (`followDir`, `planInput`), noise without a jump (`makeBot`, `think`), audits for this genre (`stepSwarm`).
- `game.js`: the renderer and the shell in one file, and the page hooks that the harness needs.
- `tools/run-swarm.mjs`: 2-D death cells, the band read from the page, the sampling error of each stage, the log written before the screenshots.
- `tools/review-pack.mjs`, `log/reviews/PANEL.md`: a brief for a one-screen game. This is game text; write your own.
- `tools/verify.mjs`: a small verify step with no viewer.

It has no title screen, touch input, replay mode, viewer or video. For those, see `../hundred-ghosts/`.

Three files here are newer than the 5 measured versions: `run-swarm.mjs`, `game.js` (end label and bars) and `release.sh` were corrected after the run, from what the run found. The numbers in `COMMITS.md` are from the run.
