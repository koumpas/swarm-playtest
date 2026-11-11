---
name: swarm-playtest
description: Build a small browser game so that 100 scripted bots can play it, then improve it in measured versions until it hits the difficulty the user asked for. Use when the user wants a game that tests, balances or fixes itself, wants playtest numbers for a game Claude is building, or says "swarm playtest", "bots play my game", "balance the difficulty", "make the game fix itself". For new browser games written in plain JavaScript. Not for existing games in large engines.
---

# Swarm playtest

You build a game, a swarm of scripted bots that plays it, and a record of measured versions. The user sets a difficulty target. You change the game until the measurement hits the target, and you keep each step in git, also the wrong ones.

There are two worked examples. `reference/hundred-ghosts/` is the full one (a platformer, 12 versions, with title screen, touch, replay, viewer). `reference/latchkey/` is a small one for a different genre (top-down, free movement, 5 versions), built by a session that had only this skill. Read a reference file when a step tells you to. The code is dense: copy the tools whole, adapt the harness, and write your own game and renderer.

## What to expect

- This was used on three games. A platformer: 8 of 8 stages on target after 12 versions. A top-down arena game, by a session that had only this folder: 3 of 4 stages on target after a limit of 5 versions. A one-button rhythm game, also from this folder only: 4 of 4 on target at version 5, the last one allowed, and its tester did not call it a safe hit.
- Hitting the target is not the same as a better game. In the rhythm run the panel score went down (4.83 to 4.5) while the target was hit, because one band for all stages removed the difficulty curve. See Step 0.
- Plan about 1.5 to 2 versions for each stage. Version 1 (game, bots, harness) is most of the work. Each later version is one probe, one edit and one measurement of about 40 seconds.
- The loop does not converge by itself. Read "Noise and step size" in Step 5 before you tune.

## Scope

Use this for a new browser game in plain HTML and JavaScript with no build step, where you write the game.

Do not use it, and tell the user why, when:
- the game exists already and its logic is mixed into the render loop, or it uses a physics engine that is not deterministic;
- the game has no "finished / failed" result and the user does not want one. If the game only has a score, you can add a pass rule (a life meter that a hit fills and a miss empties, or a score threshold). Say in the README that the rule is new. Its numbers are then your main tuning lever;
- the game is multiplayer or depends on a server.

## Step 0: ask two things, then start

1. **The difficulty target.** "What share of mid-skill players must finish each stage on the first try?" If the user has no opinion, propose 60–80% and say that this is a choice, not a rule.
2. **The genre, the number of stages and their length** (if not given). Default: 6 to 8 stages, 10 to 20 seconds each.

3. **One band for all stages, or a band for each stage?** One band for all gives a flat difficulty curve: the first stage must fail as many players as the last. If the stages have labels such as EASY to EXPERT, or the user wants a curve, set a band for each stage (for example 80–95% for the first, 40–60% for the last).

Do not ask more. Decide the rest. Put the target band in ONE place in the game (a constant in `sim.js`); the harness and the renderer read it from there. If a stage has a fixed length (a music track), drop the length check.

## Step 1: the contract (this makes all other steps possible)

Put the whole simulation in ONE file, `sim.js`. It is the versioned part of the game. Rules:

- **Fixed timestep.** One `step()` call = one frame at 60 Hz. No `Date`, no `performance.now()`, no `Math.random()` in `sim.js`. Use a seeded generator (`mulberry32` in the reference).
- **No drawing in `sim.js`, and it must also load in Node**: no `window`, no `document`, and `module.exports = API` at the end. The probe scripts and the final check need this.
- **Moving things are a pure function of the frame number** (`pos = f(t)`), so a bot can ask where a hazard is 40 frames from now at no cost.
- **Player state is one small object that can be cloned.** State that belongs to one player (a tile that breaks, a key that is taken) lives in that object, not in the world. So 100 bots share one world and do not touch each other.
- **Stages are data from a small builder**, in game units. The reference builder is a cursor that moves right (`b.run(6); b.gap(3)`); for a game with free movement use positions (`b.wall(x, y, w, h); b.key(x, y)`). Write the statements of a stage with `;` between them: `tools/export.mjs` splits changed lines at `;` to show the real changed statements.
- If stage data is not written by hand (a chart from a file), put the data inside `sim.js`, because `versions/vN.js` must run alone, and make the builder an edit list (`b.drop(i); b.rule('window', 0.07)`). Do not put a `;` inside a function body on a stage line; the export cuts there.
- Decide if a rule number is one for the game or one for each stage, and say it in the README. "One change on a stage" pushes you to a number for each stage; a game where each stage has its own rules can be a doubtful design that no measurement shows.
- **The frame grid.** At 60 Hz each event is on a 16.7 ms grid. If you compare a number with a value on that grid (a timing window), list the values it can take before you choose a step. A change between two grid values changes nothing.
- **A version constant** at the top: `const VERSION = 1;`.

`sim.js` gives these functions (see the `API` object at the end of the reference `sim.js`):

| Function | Job |
|---|---|
| `newPlayer(stage)` | a new player state at the start |
| `step(stage, player, <input>, t, tHazard)` | one frame; sets `player.alive`, `player.done`, `player.cause`. The input is what your genre needs (the reference has `dir, jump`; an arena game can use one number for 8 directions). Keep `t` (real frame) and `tHazard` (the frame a bot uses for things that kill); drop `tHazard` if nothing moves. |
| `createSwarm(stageIndex, seed, n)` | n bots on one stage; has `step()`, `over`, `deaths[]`, `events[]` |
| `swarmStats(swarm)` | pass counts for low, mid and high skill; causes of death; audit counts |
| `makeBot`, `botStep` | one bot, so the game can also show a bot on the human input path |

The file registers itself as `X_VERSIONS[VERSION]` (your own global name). Each version is later copied to `versions/vN.js`; the replay, the viewer and the final check load old versions through this.

**Page hooks that the harness needs** (reference: `main.js`):

| Hook | Job |
|---|---|
| `index.html?mode=headless` and `window.X_HEADLESS.run(stage, seed, n)` | run one swarm with no drawing and return the stats, deaths and events |
| `index.html?mode=swarm&stage=N&seed=S&speed=K&hold=1` | swarm mode on one stage |
| `index.html?mode=sheet&stage=N&seed=S&bot=I` | one picture with 6 frames of one bot's run, for the reviewers |
| `window.__x.over`, `__x.frameMs`, `__x.sheet` | "the run is finished", frame times, and the result of the sheet run |
| `index.html?mode=play&auto=1&speed=K` | a top-skill bot on the human input path, for the final check; `speed` is needed when a stage is long |

## Step 2: the bots

The bots are scripts, not a learned policy: at each decision a bot clones its own state, plays each action of a short list forward with the real `step()`, and takes the action with the most progress and no death. Noise makes the skill range. Reference: `think`, `rollout`, `makeBot` in `sim.js`.

**First: does look-ahead fit?** It fits when the player chooses between actions (move, jump, wait). It does not fit a timing game with one button, where the whole future is on the screen: a look-ahead finds the perfect press each time. There the bot is a model of the press error, not a planner: for each note, press at note time + a constant habit of that bot + a random error, or do not press. Its numbers (spread of the press time by skill, the shortest gap a bot can tap, more error after a miss or a pause, lapses) decide the pass rate, and you have no human data for them: say so in the README. Card and turn games need their own bot too. In all cases keep: scripted, seeded, a skill range from noise, the same three groups.

For a look-ahead bot, you must define five things for your genre. The reference defines them for a platformer; do not copy them to another genre.

1. **Progress.** One number that says how near the goal a state is.
   - Side-scroller: x position against the frames used.
   - Free movement with walls: a walking-distance field to the present target (Dijkstra on the tile grid, once for each stage), plus a large value for each item taken. See `field`, `estDist` in `reference/latchkey/sim.js`.
2. **The action list.** The simple things a person does.
   - Platformer: run, wait, step and stop, go back, jump after d frames with a short, medium or long hold.
   - Free movement: follow the route; each direction for 1 or 2 decision periods and then follow; a direction and then stop; wait 1, 2 or 4 periods and then follow; stand.
3. **The default policy inside the look-ahead.** What the bot does after the action ends, until the look-ahead ends ("continue to run right"; "follow the distance field", `followDir` in the latchkey example). Without it, all short actions look the same.
4. **The noise terms, set by skill 0..1**: how often it decides; how late it sees things that kill; a random delay or error on the start of each new action (in the reference: the frame of each jump); lapses; a shorter look-ahead for low skill.
5. **Risk 0..1**: how much margin the bot wants, in frames or in pixels around a hazard.

Bot i of n has skill `i/(n-1)`. Low = bottom 35%, mid = middle 30%, high = top 35%. The target is for the mid group.

Rules. Each cost a version in the reference run:

- **Give the bots the basic actions of a person**, also "take a few steps and stop", "wait", and "go back after 5 s with no progress". Without them, bots stand still and it looks like the game is broken.
- **Apply the late view only to things that kill.** Not to the thing that carries the bot, and not to the bot's own position.
- **Score progress against time**, and make "stand still" and "end against a wall" cost extra. If not, bots wait forever.
- If a target order exists (which key first), say in the README which rule the bots use. It is a model choice.

The gym:
- Develop the bot script on a separate small **gym track** that has each mechanic once. Do not run the swarm on the real stages before v1 is committed.
- The gym is good enough when: the pass rate is in order (low < mid < high), no bot is stuck, and the audits are 0. **Then read the full run of one mid-skill bot** (print it or draw it). Look for an error that causes the next error, and for a loss at the same place in each run. A faulty bot passed the numbers above in one test and cost a version.
- Before v1 you may run ONE top-skill bot through each real stage, to see that the stage can be finished and how long it takes. This is not a swarm run. Fix a stage that is too short or cannot be finished before v1.
- Add two findings to the harness: `skill-order` (low < mid < high on each stage) and `length` (mean finish time inside the range from Step 0).

A bot change after v1 is its own version, with its own commit, and you say in the message and in the README that the bots are no longer the same script.

Report the low and high groups too. If the mid group is in the band but the low group passes 1–14%, the game is closed to the bottom third of players; say so.

Cost: about 30 actions x 60 frames of look-ahead x 100 bots is roughly 1 second for one swarm run in Node.

## Step 3: what the game draws by itself

In swarm mode the game draws, with no video edit:
- all bots, translucent, coloured by skill group;
- a red heatmap of every death;
- one pass-rate bar for each stage with the target band marked;
- the version number and the seed;
- a speed label when it runs faster than real time.

If a failure is the sum of many small losses (a meter that empties), the place where the run ends is not the cause. Record and draw where the losses are (the miss rate of each note), not only the end.

**One seed on screen is not the measurement.** The live bar shows the seed on screen (30 mid-skill bots); the log has 5 seeds (150). They can differ by 15 points. Where a picture goes to a reviewer or to the user, also give the 5-seed number (the reference brief has a column for it).

Also build, unless the user limits the scope: a title screen, human play (keyboard and touch), a results screen, and a replay mode that shows two versions with the same seed. Reference: `render.js` (`SwarmView`), `main.js`.

## Step 4: the harness

Set up the folder first: `git init`, `npm init -y`, `npm i -D playwright`, `npx playwright install chromium`, and a `.gitignore` with `node_modules`. `cut.sh` runs `git add -A`; without the ignore file the first commit takes all of `node_modules`.

`tools/run-swarm.mjs` (reference; adapt it) opens the game in headless Chromium and, for each stage, runs the swarm on 5 fixed seeds with 100 bots. It writes `log/vN.json` first, then the screenshots to `shots/vN/`.

Record for each stage: pass rate for all, low, mid and high; causes of death; every death position; the top death spots (by column in a side-scroller, by cell in a 2-D game); and 2 or 3 audits of things that must never happen in your genre. Examples: a player inside a wall; a player that falls through a platform it stood on; a move of more than top speed in one frame; a finish with a required item missing. Always: bots with no progress for 8 s, and bots that hit the time limit. A useful extra field at each death is what the player held or had done.

Also record frame time in swarm mode. Never change the seeds between versions.

## Step 5: the loop

For each version:

1. **Diagnose on the committed version only.** Use small probe scripts (`tools/probe.js`, `tools/diag.js`, `tools/quick.js`) to see where and why bots die. Trace one bot before you blame the game: the first "bug" is often in the bot script.
2. **Change `sim.js`**, raise `VERSION`.
3. **Commit first, then measure.** `tools/release.sh N message-file` calls `tools/cut.sh` (copy `sim.js` to `versions/vN.js`, commit, tag `vN`), then runs the swarm and writes the panel brief. Do not test a change with the swarm before the commit. So a wrong change is in the history as a version.
4. **The commit message states the measurement and the change**, with numbers and units. `reference/hundred-ghosts/COMMITS.md` has 12 examples. Pattern: measurement, place, numbers, change.
5. **Run the playtester panel** on that version (Step 6).
6. Read the new numbers. If a change made things worse, say so in the next commit message and revert it there. Do not rewrite history.

**Where the logs go.** The tag `vN` is made before the measurement, so `log/vN.json`, `shots/vN/` and the reviews of version N are committed with version N+1. After the last version, make one more commit ("record") with its logs, the export and the README.

Order of work: first the places where no bot can pass, then stages below the target, then stages above it. The target has two sides: a stage that every bot finishes is also out of the band.

### Noise and step size

- **Know the size of one sample.** The mid group is 30 bots x 5 seeds = 150 runs. One bot is 0.67 points. Near 70% the standard error is about 3.7 points. Two versions that differ by less than about 5 points are the same.
- **Fixed seeds do not make two versions a paired test.** A change that kills nobody still moves the time at which bots come to later hazards, and that can move the result by some points.
- **If a stage is nearer to the band edge than the sampling error, do not change it yet.** Run the committed version on more seeds (`SEEDS=20 node tools/probe.js <stage>` in the reference; 20 seeds is a good number) and decide from the larger sample. The table in the README uses the 5-seed number; print both when they are on different sides of an edge. In one test this rule found a stage that looked in the band and was not.
- More seeds on a committed version are a probe, and that is permitted. A swarm run on a change that is not committed is not.
- **Aim at the middle of the band,** not at its edge.
- **If a step went too far, go back half of the effect, not half of the number.** Most levers are not linear. When you have two measured points, work out the next value from them.
- **Change one thing at a time on a stage,** and prefer a change whose effect you measured before. Then still expect to be wrong: in the two runs, single changes moved a stage by +30 and by -32 points.
- **Do not touch a stage that is in the band** to fix a smaller thing, unless you have versions to spare. One such change cost a stage that was never got back.

Stop when every stage is in the band and the panel score has been flat for three versions. If the user limits the number of versions or panel runs, stop at the limit and report the stages that are not in the band.

### Lessons from the two runs

- **Measure, do not trust a number worked out on paper.** A jump is shorter in the real step function than in the formula; a "62–67%" guess measured 42.7%; a model that said 85% measured 33%.
- **A slower hazard is not an easier hazard.** It is in the way for a longer time.
- **A hazard that a bot can wait for, or can see the size of, does not make a stage harder.** A hazard on the only route does, and by a lot.
- **Two hazards with the same period can be in step with the player**, so the second one kills nobody. Offset it by a quarter period.
- **A new hazard behind a broken spot is not measured** until bots get there. Say so.
- When deaths are spread over many hazards and no spot stands out, remove one hazard. Expect a large effect.

## Step 6: the playtester panel

After each version, start three subagents at the same time: `speedrunner`, `casual`, `designer`. Give each its persona, its build number and the path of `log/reviews/PANEL.md`. They must not read code, logs, other builds or other reviews; this rule is only words in the brief, so say in the README that you cannot prove it was obeyed.

`PANEL.md` and `tools/review-pack.mjs` in the reference are written for that game ("platformer", "8 stages", "16 images", progress as a share of the stage width). Keep their structure and write the text again for your game.

The brief for each stage has: 6 frames of one mid-skill run, the swarm at the end, a table of three recorded players, and the 5-seed pass rate. In a game that fits on one screen, 6 frames of the same room do not show a run: draw the path so far as a line, and say in the brief that the line is the past and the hazards are the present.

Each reviewer writes `log/reviews/vN/<persona>.json` with a score for each stage, a score out of 10, and 60–110 words. The panel score of a version is the mean of the three.

Do not run the first panel before you have read one bot trace: the reviewers cannot tell a bot fault from a game fault, and they will describe it as a property of the stage. Say in the brief what the pictures cannot show (sound, feel).

The panel and the target can disagree. Report that; do not hide it. When the panel says the curve is flat, the cause is the band from Step 0, not the build.

## Step 7: the record

- `tools/export.mjs` (copy it whole) reads git and the reviews and writes `log/history.json`. It needs: tags `vN`; the file name `sim.js`; `log/vN.json` with `stages[]` that have `midPct`, `passPct`, `causes`, `deaths`, and with `findings`, `frameTime`, `lines`, `inBand`, `botRuns`; and reviews with `persona`, `score`, `stageScores`, `review`, `best`, `worst`.
- `viewer.html` plays the history: the swarm of each version on the left (it runs `versions/vN.js` live), the real log lines, the diff and the reviews on the right. Nothing in it is written by hand.
- A final check script (reference: `tools/verify.mjs`; write a smaller one if you have no viewer): each `versions/vN.js` run again gives the pass counts in its log; a top-skill bot finishes every stage through the human input path; key events move the player.

## Step 8: the README

It must have: how to run; the user's exact prompt; a table of the mid-skill pass rate for each stage and version, with the panel score; real counts (versions, changes that were reverted, bots, bot runs, reviews); and a list of what is NOT verified.

The NOT verified list always has, unless you really did them:
- no human has played the game;
- no real phone or other browser;
- the bots are a model of players, and the target was the user's choice;
- which versions changed the bot script;
- the panel is model subagents that looked at still images.

## Wording rules for anything the user will publish

- Say "hit the difficulty I asked for". Do not say "balanced", "fair" or "fun" as facts.
- Say what was found in plain words: "stages no bot could finish", "a stage every bot finished".
- Give the count of versions that changed the game, not the count of all commits, when you say how many times it "fixed itself".
- Keep the failures in. They are the most believable part.

## Files in this skill

`reference/hundred-ghosts/`:

| File | Use |
|---|---|
| `sim.js` | Keep its shape (version constant, seeded random, builder, player functions, bot functions, swarm functions, `API`). Copy `mulberry32`, `hash2`, `gauss`, `tierOf`, `stepSwarm`, `swarmStats`. Write your own physics, stages and the inside of `think` and `rollout`. |
| `tools/serve.mjs`, `tools/cut.sh`, `tools/release.sh`, `tools/export.mjs` | Copy whole. |
| `tools/run-swarm.mjs` | Adapt: global names, audits, death cells. |
| `tools/review-pack.mjs`, `log/reviews/PANEL.md` | Keep the structure, write the text again. |
| `tools/probe.js`, `tools/quick.js`, `tools/diag.js`, `tools/jump.js` | Probe examples; `jump.js` and `diag.js` are for a platformer. |
| `main.js` | The page hooks, the fixed-step loop, the play and swarm states. |
| `render.js`, `index.html`, `viewer.html` | The platformer's drawing, the page, and the history viewer. |
| `COMMITS.md` | The 12 version commit messages. |
| `tools/verify.mjs`, `README.md` | The final check and the finished README of the example. |
| `post.html`, `tools/render-post.mjs`, `tools/music.py` | Optional: a short video of the result. No step needs them. |

`reference/latchkey/` (see its `README.md`): `sim.js` for a free-movement bot, `game.js` for a renderer and shell in one file with the page hooks, `tools/run-swarm.mjs` with 2-D death cells and the band read from the page, `tools/verify.mjs` as a small final check, and `COMMITS.md` with 5 more commit messages, two of them reverts.
