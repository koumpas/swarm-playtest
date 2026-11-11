# Hundred Ghosts

An original browser obstacle-course platformer that tests itself with 100 scripted ghost bots, and a record of how it was fixed from v1 to v12.

Play it: https://hundred-ghosts.vercel.app · History viewer: https://hundred-ghosts.vercel.app/viewer.html

All numbers in this file come from `log/*.json` and `git`. `tools/export.mjs` and `tools/verify.mjs` make them again.

## How to run

```bash
npm install
```

```bash
npx playwright install chromium
```

```bash
node tools/serve.mjs 8100
```

The two install steps are necessary only for the measurement tools. The game itself has no build step and no dependency.

| Page | What it shows |
|---|---|
| `http://127.0.0.1:8100/index.html` | Title screen. Main controls: PLAY, STAGE SELECT, LEADERBOARD. Below them, marked "watch only": the 100-bot swarm. |
| `index.html?mode=swarm&stage=3&seed=101&speed=2` | Swarm mode on one stage (`stage=all` for all 8). |
| `index.html?mode=replay&a=1&b=12&stage=2&speed=4` | Two versions, top and bottom, same seed. |
| `index.html?mode=play&auto=1` | A top-skill bot plays through the human input path. |
| `viewer.html` | Split-screen history, v1 to v12, 40.8 s. Options: `?per=3.3&speed=8`. `R` starts it again. |
| `post.html` | Square cut for a social video (25.6 s, 16 bars at 150 BPM), one headline for each shot. `?scale=2` draws it at 2160x2160. Headlines use Phosphate, a macOS system font. Render: `SCALE=2 node tools/render-post.mjs video/master-2160-silent.mp4`, music: `python3 tools/music.py video/music.wav` (an original electronic track made in code with numpy, no samples, no lyrics), then mux with ffmpeg. Outputs: `video/hundred-ghosts-post.mp4` (1080x1080, for upload) and `video/hundred-ghosts-post-2160.mp4` (master). |

Controls: arrow keys or A/D to move, Space / Z / Up to jump, R to restart a stage, Esc for the menu. On a touch screen: two buttons at the bottom left, JUMP at the bottom right.

Measure the current `sim.js` again (same seeds):

```bash
node tools/run-swarm.mjs
```

## Leaderboard (hosted game only)

There are two boards. **Full run:** the total time for all 8 stages, from stage 1. **Stage records:** the best time for each stage, from a full run or from one stage played alone (STAGE SELECT in the menu). A tie goes to the earlier run.

Three kinds of entry:
- a person's run;
- `GHOST`: a seeded, replay-checked run by a scripted bot of ordinary skill (Wisp, Boo, Mist). These are ranked, so the board is not empty and the first records can be beaten;
- the **perfect time**: the best run by the top-skill bot (best of 600 full runs, best of 300 for each stage). It is shown as a reference line and is not ranked.

After a run, the results screen asks for a name and sends the run to `/api/scores`.

- **The page does not send a time.** It sends the recorded inputs (one code for each tick). The server replays them with the same `sim.js` and `play.js` and stores the time that the replay gives. A cut or changed recording is refused.
- **Storage:** one small file for each score in a private Vercel Blob store. All fields are in the file name, so a listing is the leaderboard.
- **Reserved names** (`alex`, `ghost…`), ghost entries and the perfect time need an owner key that is not in this repository.
- **Rate limit:** 6 submissions in 10 minutes and 30 in 24 hours for each visitor. The address is stored only as a hash.
- **Names:** swear words and slurs are refused, also with digits, dashes or stretched letters (`lib/names.js`; the lists are stored in ROT13). A word list cannot catch all cases.
- **One stored run for each name:** the best one.
- **Limits:** names are not accounts, so two people can use the same name. The check proves that the inputs give the time; it cannot prove that a person, and not a script, made the inputs. Scores belong to a game version: a new `sim.js` version starts an empty board.
- Local static server: the game plays, the leaderboard says that it is not available.

## What the game draws by itself

The death heatmap (red glow in the stage and in the whole-stage strip), one mid-skill pass-rate bar for each stage with the 60–80% band, the version badge, the seed, the bot counts, and the speed label. None of this is added in a video edit.

## The loop that was used

1. Change `sim.js` (the versioned file: physics, stages, bot script). Commit it with the measurement and the change in the message. Tag it `vN`. `tools/cut.sh` also copies it to `versions/vN.js`.
2. `tools/run-swarm.mjs` runs 100 bots x 5 seeds (101, 202, 303, 404, 505) x 8 stages = 4,000 bot runs in headless Chromium, and writes `log/vN.json` and `shots/vN/`.
3. Three playtester subagents (speedrunner, casual, designer) each get 16 game-rendered images of that version and a table of three recorded runs. They do not see the code, the history or other reviews. Each writes a review and a score out of 10 to `log/reviews/vN/`.
4. The next change is made from these results.

Changes were committed first and measured after that. So a wrong change is in the history as its own version. One exception: the v4 bot change was tested on stage 4 before the commit; the commit message says so.

## Real counts

| Item | Count |
|---|---|
| Versions (git tags `v1`..`v12`, one commit each) | 12 |
| Other commits (viewer, tools, README, logs; no change to `sim.js`) | 2 |
| Versions that changed stages | 9 (v3, v5–v12) |
| Versions that changed only the bot script | 2 (v2, v4) |
| Changes that made the result worse and were reverted | 3 (v6 stage 6 spikes; v7 stage 3 saw period; v11 stage 3 saw period) |
| Changes that had no effect and were replaced | 2 (v8 stage 6 second saw; v9 stage 4 wider ferry) |
| Bots in each swarm | 100 |
| Bot runs measured | 48,000 (12 versions x 4,000) |
| Playtester reviews | 36 (12 versions x 3) |
| Stages | 8 |

### Mid-skill pass rate (%) for each stage, and panel score

Mid-skill = bots 35–64 of 100, 150 runs for each stage and version. Target band 60–80.

| Version | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 | In band | Timeouts | Panel /10 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| v1 | 92.7 | 0 | 37.3 | 40.7 | 77.3 | 35.3 | 43.3 | 6 | 1/8 | 1065 | 3.73 |
| v2 | 86.7 | 0.7 | 28 | 22 | 76.7 | 84 | 57.3 | 5.3 | 1/8 | 627 | 4.17 |
| v3 | 86.7 | 21.3 | 28 | 22 | 76.7 | 100 | 57.3 | 16 | 1/8 | 168 | 4.33 |
| v4 | 86.7 | 21.3 | 28 | 45.3 | 76.7 | 100 | 57.3 | 22.7 | 1/8 | 172 | 4.80 |
| v5 | 86.7 | 52.7 | 36 | 53.3 | 76.7 | 100 | 80 | 34 | 2/8 | 56 | 5.43 |
| v6 | 86.7 | 62 | 59.3 | 52.7 | 76.7 | 2 | 80 | 62 | 4/8 | 539 | 4.63 |
| v7 | 82 | 62 | 51.3 | 52.7 | 76.7 | 90 | 80 | 62 | 4/8 | 28 | 5.97 |
| v8 | 78.7 | 62 | 58.7 | 44.7 | 76.7 | 90 | 80 | 62 | 5/8 | 30 | 6.33 |
| v9 | 78.7 | 62 | 57.3 | 50.7 | 76.7 | 84.7 | 80 | 62 | 5/8 | 30 | 6.23 |
| v10 | 78.7 | 62 | 59.3 | 72 | 76.7 | 64.7 | 80 | 62 | 7/8 | 36 | 6.20 |
| v11 | 78.7 | 62 | 56 | 72 | 76.7 | 64.7 | 76.7 | 62 | 7/8 | 36 | 6.27 |
| v12 | 78.7 | 62 | 66.7 | 72 | 76.7 | 64.7 | 76.7 | 62 | 8/8 | 36 | 6.30 |

Stages: 1 First Steps, 2 Spike Garden, 3 Saw Mill, 4 Ferry Lines, 5 Crumble Bridge, 6 Spring Loaded, 7 Laser Gate, 8 Gauntlet.

- Stages made HARDER because they were too easy: stage 1 (92.7% -> 78.7%) and stage 6 (100% at v3–v5 -> 64.7%).
- The panel score went up until v8 and then stayed between 6.20 and 6.33 for five versions. The work stopped at v12 for that reason.
- "Embedded in a solid tile" events: 0 in 48,000 runs. "Fall-through on a moving platform" events: 0 in 48,000 runs. The harness looked for both in each frame. No collision or tunnelling bug was found; the problems found were softlocks (places with no safe action), balance, and two faults in the bot script.
- Frame time in swarm mode (100 bots, JavaScript update + draw, headless Chromium on the build machine, 1,440 frames for each version): median 0.4–0.7 ms, 95th percentile 0.7–1.3 ms, maximum 2.7 ms. This is script time only; it does not include the browser's own paint time.
- Average time to the goal in v12: 9.5 s to 14.6 s for each stage.

### Token use

- Playtester panel: 3,248,951 tokens (sum of the usage that each of the 36 subagents reported; 89,536 to 92,161 each).
- Main session (design, code, diagnosis): not measured. The session gives no token counter.

## Checks that were made on the final build (`log/verify.json`)

- Each snapshot `versions/v1.js` .. `v12.js` was run again and gave the same pass counts as its log file (seed 101, all 8 stages): 12 of 12 match.
- A top-skill bot finished all 8 stages through the human play path (`mode=play&auto=1`), 0 deaths, 96.1 s in total.
- Real key events (Enter, ArrowRight, Space) and touch events in an emulated 844x390 phone viewport were sent, and screenshots were saved (`shots/play-keyboard.png`, `shots/play-touch.png`).
- The viewer played v1 to v12 and showed its end card after 40.8 s with no page error.

## What is NOT verified

- **No human has played it.** "A human can finish all stages" is supported only by the bot run on the human input path. Feel, input latency and fun for a person are not known.
- **Real phone performance and real touch.** Touch was sent only in an emulated viewport on a desktop Chromium. No phone, no Safari, no Firefox.
- **The bots are a model, not people.** They are scripts with noise (decision interval 5–15 frames, hazard view 0–9 frames late, jump-timing error with sigma 0.4–4.0 frames, a risk value). A pass rate of 60–80% for mid-skill bots does not prove 60–80% for mid-skill humans.
- **The bot script changed in v2 and v4.** v1 and v12 use the same seeds and the same skill and risk values for each bot, but not the same script. v2 added three actions (step and stop, medium hold, go back for a run-up); v4 removed the late view for the platform under the bot. A part of the v1 -> v12 difference comes from these two changes: see the v1 -> v2 and v3 -> v4 rows, where no stage changed.
- **The playtester panel is three language-model subagents** that looked at still images and a table. They did not hold a controller. Their images show seed 101 only, so a number they quote (for example "Saw Mill 57%") can differ from the 5-seed number in the table.
- **Panel and band do not fully agree.** In v12 all three reviewers still say that stage 1 is too deadly for a first stage (78.7% mid-skill pass, 53.7% low-skill) and that stage 3 is hard for its position. The 60–80% target for all stages gives a flat difficulty curve. This is a design question that is open.
- **Frame time** was measured only in headless Chromium on one machine.
- **No sound.** The game has none.
- **Stages are not proven optimal or free of softlocks for humans.** 36 bot runs of 4,000 still hit the 45 s limit in v12 (stage 2: 24, stage 6: 6, stage 5: 4, stage 1: 2).

## Files

- `index.html`, `main.js`, `render.js`: game shell and renderer. `play.js`: the human play loop as a function of recorded inputs. `api/scores.js`: the leaderboard function. `sim.js`: the versioned simulation (current = v12).
- `viewer.html`: split-screen history. It reads `log/history.json` and runs `versions/vN.js` live.
- `versions/v1.js` .. `v12.js`: snapshot of `sim.js` at each tag.
- `log/v1.json` .. `v12.json`: for each version: metrics, all death positions (heatmap data), findings, log lines, reviews, git data. `log/history.json`: the export for the viewer. `log/reviews/`: panel rules, briefs and the 36 raw reviews. `log/verify.json`: final checks.
- `shots/v1/` and `shots/v12/` (and all versions between): game screenshots. `shots/replay-v1-vs-v12-stage2-*.png`, `shots/viewer-*.png`, `shots/title.png`, `shots/results-screen.png`.
- `tools/`: `serve.mjs`, `run-swarm.mjs` (measure), `cut.sh` / `release.sh` (version), `review-pack.mjs` (panel brief), `export.mjs` (git + reviews to JSON), `verify.mjs`, and small diagnosis helpers (`quick.js`, `probe.js`, `diag.js`, `jump.js`).

## The exact prompt

> Build "Hundred Ghosts", an original browser obstacle-course platformer that tests and improves itself, in `hundred-ghosts/`. Run `git init` inside that subfolder (not the parent) so each version is one commit.
>
> ## The game
> - 2D side-view platformer, 8 or more short stages (10 to 20 s each), plain HTML/JS/Canvas or WebGL, no build step if possible, opens from `index.html` through a small local static server.
> - A human can play it (keyboard and touch). It must look good in a 5-second clip: clear silhouettes, strong colour, juice (squash, particles, screen shake), a title screen, a results screen.
> - All physics is deterministic from a seed, with a fixed timestep.
>
> ## The swarm
> - A "swarm mode" runs 100 translucent ghost bots through a stage at the same time. The bots are scripted (not learned) with a range of skill: noisy reaction time, jump-timing error, and different risk levels.
> - The game itself draws: a red death heatmap, a pass-rate bar for each stage, a version counter, and the seed. These must be rendered by the game, not added later in a video edit.
> - A replay mode shows two versions side by side with the same seed and the same bots (for example v1 against the final version).
>
> ## The improvement loop (this is the subject of the post)
> 1. Build v1 honestly; do not plant bugs.
> 2. Run the swarm on each stage in a headless browser (Playwright). Record pass rate, death positions, stuck bots, fall-through events, frame time. Save screenshots.
> 3. Find problems: bugs (collision, tunnelling, stuck corners, softlocks) and balance (target pass rate band 60% to 80% for mid-skill bots; make at least one stage HARDER if it is too easy).
> 4. Fix, commit as the next version with a message that states the measurement and the change (for example "stage 4 pass rate 3%: gap 212 px > max jump 190 px; gap set to 176 px"), and run again with the same seeds.
> 5. Also run a playtester panel: use subagents that each play a stage from screenshots or a recorded run, then write a short review and a score out of 10. Store each review with its version. Show the average score per version.
> 6. Continue until all stages are in the band and the panel score stops rising. Keep any failed or reverted fix in the history; do not hide it.
>
> ## The split-screen viewer
> - A page `viewer.html` that plays the story: left side the swarm replay for a version, right side the real log lines, the diff summary, and the playtester reviews for that version, with the version counter rising. It must read from the real log and git data (export them to JSON), not from hand-written text. Make it suitable for a 30 to 45 second screen recording, with a speed label if sped up.
>
> ## Deliverables in `hundred-ghosts/`
> - `index.html` (game), `viewer.html`, `log/` with one JSON file per version (metrics, heatmap data, reviews), screenshots of v1 and the final version.
> - `README.md` with: how to run, the exact prompt you were given, real counts (versions, fixes, bots, runs, reviews), token use if you can measure it, and a list of what is NOT verified (for example real phone performance).
>
> Done means: the game runs locally, a human can finish all stages, the swarm metrics are in the target band, the viewer plays the real history from v1 to the final version, and the README numbers match the log. Report real numbers only.

Background that came with the prompt: the game is for a social post that shows the model playing and improving its own game, as a split screen; original game only (borrow the genre, do not recreate an existing game); local only, nothing deployed or published.
