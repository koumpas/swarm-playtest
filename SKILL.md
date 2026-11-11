---
name: swarm-playtest
description: Build a small browser game so that 100 scripted bots can play it, then improve it in measured versions until it hits the difficulty the user asked for. Use when the user wants a game that tests, balances or fixes itself, wants playtest numbers for a game Claude is building, or says "swarm playtest", "bots play my game", "balance the difficulty", "make the game fix itself". For new browser games written in plain JavaScript. Not for existing games in large engines.
---

# Swarm playtest

You build a game, a swarm of scripted bots that plays it, and a record of measured versions. The user sets a difficulty target. You change the game until the measurement hits the target, and you keep each step in git, also the wrong ones.

`reference/hundred-ghosts/` is a full worked example (a platformer, 12 versions). Read a reference file when a step tells you to. Adapt it; do not copy the game.

## Scope

Use this for a new browser game in plain HTML and JavaScript with no build step, where you write the game.

Do not use it, and tell the user why, when:
- the game exists already and its logic is mixed into the render loop, or it uses a physics engine that is not deterministic;
- the game has no clear "finished the stage / failed the stage" result;
- the game is multiplayer or depends on a server.

## Step 0: ask two things, then start

1. **The difficulty target.** "What share of mid-skill players must finish each stage on the first try?" If the user has no opinion, propose 60–80% and say that this is a choice, not a rule.
2. **The genre and the number of stages** (if not given). Default: 6 to 8 short stages, 10 to 20 seconds each.

Do not ask more. Decide the rest.

## Step 1: the contract (this makes all other steps possible)

Put the whole simulation in ONE file, `sim.js`. It is the versioned part of the game. Rules:

- **Fixed timestep.** One `step()` call = one frame at 60 Hz. No `Date`, no `performance.now()`, no `Math.random()` in `sim.js`. Use a seeded generator (`mulberry32` in the reference).
- **No drawing in `sim.js`.** The renderer reads the state; it never changes it.
- **Moving things are a pure function of the frame number** (`pos = f(t)`), so a bot can ask "where is that saw 40 frames from now" at no cost.
- **Player state is one small object that can be cloned.** State that belongs to one player (for example a tile that breaks after a step) lives in that object, not in the world. So 100 bots share one world and do not touch each other.
- **Stages are data from a small builder**, in game units (`b.run(6); b.gap(3); b.spikes(2)`). A change to a stage is then one short line in a diff, and a commit message can name it.
- **A version constant** at the top: `const VERSION = 1;`.

`sim.js` must give these functions (see `reference/hundred-ghosts/sim.js`, the `API` object at the end):

| Function | Job |
|---|---|
| `newPlayer(stage)` | a new player state at the start |
| `step(stage, player, input, t, tHazard)` | one frame; sets `player.alive`, `player.done`, `player.cause` |
| `createSwarm(stageIndex, seed, n)` | n bots on one stage; has `step()`, `over`, `deaths[]`, `events[]` |
| `swarmStats(swarm)` | pass counts for low, mid and high skill; causes of death; audit counts |
| `makeBot`, `botStep` | one bot, so the game can also show a bot on the human input path |

The file registers itself as `HG_VERSIONS[VERSION]` (use your own global name). Each version is later copied to `versions/vN.js`, and the replay and the viewer load old versions through this.

## Step 2: the bots

The bots are scripts, not a learned policy. Use the look-ahead pattern from the reference (`think`, `rollout`, `makeBot` in `sim.js`):

1. At each decision, the bot has a short fixed list of simple actions (run, wait, step and stop, go back, jump after d frames with a short, medium or long hold).
2. It clones its own player state and plays each action forward with the real `step()`.
3. It takes the action that makes the most progress without a death.
4. **Noise makes the skill range.** Skill 0..1 sets: how often it decides, how late it sees moving hazards, and the error on the frame of each jump. Risk 0..1 sets how much timing margin it wants.
5. Bot i of n has skill `i/(n-1)`. Low = bottom 35%, mid = middle 30%, high = top 35%. The target is for the mid group.

Rules that cost a version each in the reference run. Obey them from the start:

- **Give the bots the basic actions of a person**: "take a few steps and stop", a medium hold, and "go back for a run-up after 5 s with no progress". Without them, bots stand still and it looks like the game is broken.
- **Do not apply the late view to the thing that carries the bot** (a moving platform under it). Apply it only to hazards.
- **Score progress against time, not position at the end**, and make "stand still" and "end against a wall" cost extra. If not, bots wait forever at a wall.
- Develop the bot script on a separate small **gym track** that has each mechanic once. Do not run the swarm on the real stages before v1 is committed.
- A bot change after v1 is its own version, with its own commit, and you say in the message and in the README that the bots are no longer the same script.

For a genre where look-ahead does not fit (cards, turns), write a different bot, but keep: scripted, seeded, a skill range from noise, and the same three groups.

## Step 3: what the game draws by itself

In swarm mode the game draws, with no video edit:
- all bots, translucent, coloured by skill group;
- a red heatmap of every death;
- one pass-rate bar for each stage with the target band marked;
- the version number and the seed;
- a speed label when it runs faster than real time.

Also build: a title screen, human play (keyboard and touch), a results screen, and a replay mode that shows two versions with the same seed. Reference: `render.js` (`SwarmView`), `main.js`.

## Step 4: the harness

`tools/run-swarm.mjs` (reference) opens the game in headless Chromium with Playwright and, for each stage, runs the swarm on 5 fixed seeds with 100 bots. It writes `log/vN.json` and screenshots to `shots/vN/`.

Record for each stage: pass rate for all, low, mid and high; causes of death; every death position; the top death spots; and three audits that must stay at 0 or be explained:
- a player inside a solid tile,
- a player that falls through a platform it stood on,
- a bot with no progress for 8 s, and bots that hit the time limit.

Also record frame time in swarm mode. Never change the seeds between versions.

## Step 5: the loop

For each version:

1. **Diagnose on the committed version only.** Use small probe scripts (`tools/probe.js`, `tools/diag.js`, `tools/jump.js` in the reference) to see where and why bots die. Trace one bot before you blame the game: the first "bug" is often in the bot script.
2. **Change `sim.js`**, raise `VERSION`.
3. **Commit first, then measure.** `tools/release.sh N message-file` copies `sim.js` to `versions/vN.js`, commits, tags `vN`, runs the swarm and writes the panel brief. Do not test a change with the swarm before the commit. So a wrong change is in the history as a version.
4. **The commit message states the measurement and the change**, with numbers and units. Example: `stage 6, tile 17 (74 timeouts): pad flight is about 218 px, the gap is 192 px plus up to 32 px of pad tile. Gap set 6 -> 5 tiles.`
5. **Run the playtester panel** on that version (Step 6).
6. Read the new numbers. If a change made things worse, say so in the next commit message and revert it there. Do not rewrite history.

Order of work: first the places where no bot can pass (softlocks, impossible jumps), then stages below the target, then stages above the target. Make at least one too-easy stage harder; the target has two sides.

Stop when every stage is in the target band and the panel score has been flat for three versions.

Lessons from the reference run:
- **Measure, do not trust a number worked out on paper.** A jump or a launch is shorter in the real step function than in the formula.
- **A slower hazard is not an easier hazard.** It is in the way for a longer time. This was wrong three times.
- **Two hazards with the same period can be in step with the player**, so the second one kills nobody. Offset it by a quarter period.
- **A new hazard behind a broken spot is not measured** until bots get there. Say so.
- When deaths are spread over many hazards and no spot stands out, remove one hazard. Do not tune all of them.

## Step 6: the playtester panel

After each version, start three subagents at the same time: `speedrunner`, `casual`, `designer`. Give each only `log/reviews/PANEL.md` (the rules) and its build number. `tools/review-pack.mjs N` writes the brief from recorded runs: for each stage, 6 frames of one mid-skill run and the swarm at the end, plus a table of three recorded players.

The reviewers must not read code, logs, other builds or other reviews. Each writes `log/reviews/vN/<persona>.json` with a score for each stage, a score out of 10, and 60–110 words. The panel score of a version is the mean of the three.

The panel and the target can disagree (for example: "stage 1 is too deadly for a first stage" while it is inside the band). Report that; do not hide it.

## Step 7: the record

- `tools/export.mjs` reads git (tags, messages, the real changed statements of `sim.js`) and the reviews, and writes `log/history.json`. It also puts reviews and git data into each `log/vN.json`.
- `viewer.html` plays the history: the swarm of each version on the left (it runs `versions/vN.js` live), the real log lines, the diff and the reviews on the right. Nothing in it is written by hand.
- `tools/verify.mjs` checks the final build: each `versions/vN.js` run again gives the pass counts in its log; a top-skill bot finishes every stage through the human input path; key and touch events work; the viewer runs to its end.

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

- `reference/hundred-ghosts/`: `sim.js`, `render.js`, `main.js`, `index.html`, `viewer.html`, `post.html`, `tools/`, `log/reviews/PANEL.md`, `README.md`, and `COMMITS.md` (the 12 version commit messages, as examples of step 5).
- Run `npm i -D playwright && npx playwright install chromium` in the new game folder for the harness.
