# The 12 version commits of Hundred Ghosts

Each message states the measurement and the change. Use them as examples.

```
v1: first playable build, not yet measured

8 stages, deterministic 60 Hz physics, human play (keyboard + touch),
swarm mode with 100 scripted ghost bots, replay mode, headless harness.
Stage layouts are a first design from the jump numbers on paper
(flat jump about 148 px, jump height about 94 px, pad height about 204 px).
No swarm run was made on the 8 stages before this commit; the bot script
was developed only on the separate "Bot Gym" track.


```

```
v2: bot script fix (no stage change): stuck bots 1065 -> measured again

Measurement (v1, 4000 bot runs): 1065 bots stuck or timed out. Traces show
that part of this is the bot script, not the game:
- stage 7: bots stopped before laser 2 (tile 14.5) for 45 s. The script could
  only "run 2 decisions ahead" or "wait"; it could not take a few steps and
  stop between two lasers that are 96 px apart.
- stages 2 and 8: bots stopped with no run-up and never went back.
Change: the bot script gets 3 basic human actions: "step forward and stop",
a medium jump hold (12 frames), and "go back about 3 tiles after 5 s with no
progress". Physics and all 8 stages are the same as v1.
Note: from v2 the bots are not the same script as in v1. Skill and risk
values per bot and all seeds are the same.


```

```
v3: remove 3 places with no safe action (stages 2, 6, 8)

Measurement (v2): 627 timeouts in 4000 bot runs; careful bots stop and wait.
- stage 2, tile 35 (123 timeouts, 85 of them high-skill): single spikes with
  2 clear tiles (64 px) between them. From a stop there, only a 6-frame hop
  on 1 exact frame lands between the spikes; a full jump (132-148 px)
  lands on the next spike. Clear run between single spikes set 2 -> 4 tiles.
- stage 2, tiles 13-19: landing zones before spikes(3) and before the step
  were 4, 3 and 2 tiles. Set to 6, 5 and 4 tiles.
- stage 6, tile 17 (74 timeouts; high-skill pass 50.9% < low-skill 92.6%):
  pad flight is about 218 px, the gap is 192 px plus up to 32 px of pad
  tile: margin -6..+26 px. Gap set 6 -> 5 tiles (160 px).
- stage 8, tile 38 (105 timeouts): pad launch up a 4-tile wall, then a
  spike 3 tiles after the edge, not visible from below. Spike moved to
  5 tiles after the edge.


```

```
v4: bot script fix 2 (no stage change): view lag no longer moves the platform under the bot

Measurement (v3): stage 4 mid-skill pass 22.0%, 305 pit deaths. Traces show
bots that ride a ferry and then step into the pit. Cause is in the bot
script: a bot plans with a late view of moving hazards (0-9 frames). The
same late time was used for the platform that carries the bot, so its plan
started from a wrong own position.
Change: plans use the real time for moving platforms; the late view stays
for saws and lasers. Test before commit on stage 4: mid 22.0% -> 45.3%.
Physics and stages are the same as v3. The bots differ from v3 in this
one point.


```

```
v5: make the too-hard stages easier (2, 3, 4, 7, 8)

Measurement (v4), mid-skill pass: stage 2 21.3%, stage 3 28.0%,
stage 4 45.3%, stage 7 57.3%, stage 8 22.7% (target 60-80%).
- stage 2: 82 timeouts at tile 66 (2-tile ledge, then 3 spikes, no run-up):
  ledge 2 -> 4 tiles. 46 spike deaths under the low ceiling: 2 spikes -> 1.
- stage 3: saw deaths at tiles 8 (65), 30 (45), 39-42: saw periods
  100/90/110 -> 150 frames; the two bobbing saws 3 -> 5 tiles apart.
- stage 4: 48 pit deaths at the first ferry: ferry 3 -> 4 tiles wide.
  Twin ferries 2 -> 3 tiles wide. Saw on the last ferry line: period
  120 -> 180 frames.
- stage 7: 117 laser deaths at laser 2 (27 of them high-skill). It goes on
  at frame 120, when a full-speed player gets there (frames 108-153).
  Phase moved by 60 frames, so it is already on when the player comes.
- stage 8: 139 deaths at tiles 64-69 (laser, then saw 2 tiles later, then
  3 spikes): 4 tiles between laser and saw, saw period 120 -> 180,
  spikes 3 -> 2. First ferry 2 -> 3 tiles wide.


```

```
v6: second balance pass; stages 1 and 6 made HARDER

Measurement (v5), mid-skill pass: stage 1 86.7% and stage 6 100% (too
easy); stage 2 52.7%, stage 3 36.0%, stage 4 53.3%, stage 8 34.0% (too hard).
Harder:
- stage 1: gap at tile 47 3 -> 4 tiles; single spike at tile 38 -> 2 spikes.
- stage 6: 0 deaths in 500 runs. Spikes after pad 3: 5 -> 6 tiles (pad
  flight about 218 px, 6 spikes need about 200 px). New bobbing saw in the
  flight path between pad 4 and pad 5.
Easier:
- stage 2: 48 deaths at the 3 spikes at tile 15: 3 -> 2 spikes.
- stage 3: patrol saws period 160 -> 220 and 120 -> 180; saw over the gap
  at tile 30 moved 1 tile up, period 150 -> 180.
- stage 4: 58 saw deaths on the last ferry: saw period 180 -> 240, the same
  as the ferry, so the saw is up when the ferry goes below it.
  Second twin ferry starts 0.5 tile nearer.
- stage 8: 62 laser deaths at tile 64 (35 high-skill; no room to stop
  after the crumble tiles): run before the laser 3 -> 5 tiles, period
  90 -> 120. Patrol saw at tiles 69-71 (78 deaths) -> one bobbing saw.


```

```
v7: revert the failed stage 6 change from v6; third balance pass

Measurement (v6): stage 6 pass 8/500 (1.6%), 491 timeouts at tiles 26-27.
The v6 change "spikes after pad 3: 5 -> 6 tiles" was wrong. I used the
paper number for the pad flight (218 px). Measured flight from the pad:
the player comes down 6.1-6.5 tiles after the pad tile, on the 6th spike,
from each start position. Reverted to 5 spikes. The new saw from v6 stays
(it was reached by 9 bots only, so its effect is not yet measured).
Other v6 results, mid-skill pass: stage 1 86.7% (too easy), stage 3 59.3%,
stage 4 52.7% (too hard).
- stage 1: 20 timeouts at tile 53 (4 tiles of run between a gap and 2
  spikes): run 4 -> 6 tiles. Harder: gaps at tiles 16 and 67 3 -> 4 tiles,
  spikes at tile 53 2 -> 3.
- stage 3: 30 deaths at the two bobbing saws: period 150 -> 170.
- stage 4: 40 pit deaths between the twin ferries: second ferry 3 -> 4
  tiles wide. 36 pit deaths at the end of the last ferry line: it stopped
  0.5 tile short of the ground; travel 6 -> 6.5 tiles.


```

```
v8: undo a second failed change (stage 3 saw period); fourth balance pass

Measurement (v7), mid-skill pass: stage 3 51.3% (v6: 59.3%), stage 4
52.7%, stage 1 82.0%, stage 6 90.0%.
- stage 3: the v7 change "two bobbing saws, period 150 -> 170" made it
  worse: deaths at tiles 38-39 went 30 -> 80. Period set back to 150.
  The first saw is 2 tiles after a 1-tile step, so a player who jumps the
  step comes down in the saw: both saws moved 2 tiles away from the step.
- stage 4: 63 saw deaths on the last ferry (v6: 27); the longer ferry
  travel from v7 moved the timing. Lowest saw position 0.5 -> 1.5 tiles
  above the ferry, so a player who stands on the ferry is always safe and
  only a jump can touch the saw.
- stage 1 (too easy): first gap 2 -> 3 tiles.
- stage 6 (too easy, 47 deaths, all at the v6 saw): second bobbing saw in
  the flight path between pad 5 and the landing, half a period later.


```

```
v9: stage 4 last ferry wider; stage 6 second saw now has an effect

Measurement (v8), mid-skill pass: stage 4 44.7% (v7: 52.7%), stage 6
90.0% (no change), stage 3 58.7%.
- stage 4: 48 pit deaths at tile 67. Traces: bots come down on the front
  end of the 3-tile ferry and run off it in the next 3-5 frames. Ferry
  3 -> 4 tiles wide, travel 6.5 -> 5.5 tiles (it still touches the ground
  at the far end).
- stage 6: the second saw from v8 killed 0 bots. It was half a period
  after the first saw and the flight between them is about half a period,
  so each bot that got past saw 1 was in time for saw 2. Offset 60 -> 30
  frames.
- stage 3: 25 deaths at the patrol saw at tile 17: patrol 5 -> 4 tiles.


```

```
v10: stage 4 last ferry: saw removed, far ground 1 tile lower; stage 3 and 6 tuned

Measurement (v9), mid-skill pass: stage 4 50.7%, stage 3 57.3%, stage 6
84.7%. The v9 change "last ferry 3 -> 4 tiles wide" did not remove the
deaths at tile 67 (48 -> 46).
- stage 4: new traces show a different cause: bots ride the ferry and then
  jump for the far ground too early (4.1 tiles from a stop; a standing
  jump is 132 px = 4.1 tiles, so 1 late or early frame fails). Far ground
  set 1 tile lower, which gives a longer jump. The saw on this ferry line
  (36 deaths) is removed: with the early-jump risk it was two tests at
  one place.
- stage 3: 29 deaths at the saw wheel (tiles 53-54): period 140 -> 180.
- stage 6 (too easy): one spike 2 tiles after the landing of pad 2.


```

```
v11: two small changes at the band edges (stages 3 and 7)

Measurement (v10): 7 of 8 stages in the 60-80% mid-skill band. Stage 3 is
at 59.3% (0.7 below), stage 7 is at 80.0% (on the upper edge).
- stage 3: 22 deaths at the first patrol saw (tile 17): period 220 -> 260.
- stage 7 (a little harder): last laser on-time 70 -> 85 of 120 frames.


```

```
v12: stage 3: one saw removed; a third "slower saw" change reverted

Measurement (v11): stage 3 mid-skill pass 56.0% (v10: 59.3%). The v11
change "patrol saw period 220 -> 260" made it worse (deaths at tile 17
22 -> 26). This is the third time that a slower saw gave more deaths
(v7, v9/v11): a slow saw is in the way for a longer time. Period set back
to 220.
The stage has 7 saws and the deaths are spread over all of them (no one
spot above 26 of 209). The second of the two bobbing saws (tile 46, 17
deaths) is removed and the run there is 2 tiles shorter.


```
