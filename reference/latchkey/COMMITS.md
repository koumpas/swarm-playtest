# The 5 version commits of Latchkey

```
v1: first playable build, not yet measured

4 one-screen stages (30 x 15 tiles), deterministic 60 Hz movement in 8
directions, keys + exit, 3 hazard kinds (drone on a line, orbiter on a
ring, zap floor), human play (keyboard), swarm mode with 100 scripted
bots, heatmap, pass bars, headless harness.
Stage layouts are a first design on paper (player speed 3 px/frame =
5.6 tiles/s; routes of about 47-83 tiles for 10-20 s).
No swarm run was made on the 4 stages before this commit; the bot script
was developed only on the separate "Bot Gym" arena (3 seeds: 86-91 of 100
bots finish it, mid-skill 26-28 of 30, 0 stuck).


```

```
v2: stage 2 has 2 fewer full-lane drones; stage 3 route made longer

Measurement (v1, 2000 bot runs): 3 of 4 stages in the 50-70% band.
- stage 2 mid-skill pass 40.0% < 50%. 238 of 245 deaths are on the 5
  drones that go across a lane from wall to wall (no safe side, only
  timing). Mid-skill deaths at each: x=20 top lane 23, x=8 top 16,
  x=21 bottom 24, x=9 bottom 18, x=14 middle 6. Deaths are spread, no
  one spot is broken, so one drone is removed and one is made passable:
  the top-lane drone at x=20 is removed; the bottom-lane drone at x=21
  goes 1.3 tiles and not 2 (it now leaves a strip of about 28 px at the
  bottom wall; the player is 16 px wide).
- stage 3 is in the band (63.3%) but the mean finish time is 9.05 s,
  below the 10-20 s that was asked. The two inner walls had a door in
  the middle (rows 6-8). Now the door of wall x=11 is at the bottom
  (rows 12-13) and the door of wall x=19 is at the top (rows 1-2), and
  the exit moves from (27,7) to (27,1). Route on paper: about +9 tiles
  (+1.7 s). The pass rate of stage 3 can change with this; not yet measured.
Stages 1 and 4 and the bot script are the same as v1.


```

```
v3: v2 went too far; stages 2 and 3 made a little harder

Measurement (v2, 2000 bot runs): 2 of 4 stages in the 50-70% band, down
from 3 of 4. Both v2 changes made a stage too easy:
- stage 2 mid-skill pass 40.0% -> 70.7% (band top is 70%). The drone at
  x=21 in the bottom lane now kills 7 mid-skill bots (v1: 24). Its travel
  is set 1.3 -> 1.6 tiles: the safe strip at the bottom wall goes from
  about 28 px to about 19 px (player 16 px). The drone removed in v2
  stays removed.
- stage 3 mid-skill pass 63.3% -> 72.7%. The longer route (finish time
  9.05 s -> 10.90 s, now inside 10-20 s) also made it easier: with the
  door of wall x=11 at the bottom, bots come to the middle rings from
  below and deaths there fell from 36 to 14 (mid-skill). This was not
  expected. The route stays; the ring of key (7,11), where 0 mid-skill
  bots died, gets a second orbiter half a turn from the first.
Stages 1 and 4 and the bot script are the same as v1.


```

```
v4: revert the v3 orbiter on stage 3 (it made the stage easier); larger orbiter at key (23,3)

Measurement (v3, 2000 bot runs): 3 of 4 stages in the 50-70% band.
- stage 2 mid-skill pass 70.7% -> 68.0%: in the band. No change.
- stage 3 mid-skill pass 72.7% -> 77.3%: the v3 change was wrong. The
  second orbiter on the ring of key (7,11) killed 0 mid-skill bots; they
  wait for it. The wait moved the time at which they come to the middle
  rings, and mid-skill deaths there fell from 13 to 6. A hazard that bots
  can wait for is not a harder stage. Reverted here.
  24 of 34 mid-skill deaths are with 3 keys, and 16 of them in one cell
  (22,2) on the ring of key (23,3) (1 orbiter, 120 frames a turn, about
  3.0 px/frame, the same as the player). This is where bots do die, so
  the change goes there: the radius of that orbiter is set 12 -> 16 px.
Stages 1, 2 and 4 and the bot script are not changed.


```

```
v5: stage 3: revert the larger orbiter (no effect); a drone in the top door of wall x=19

Measurement (v4, 2000 bot runs): 3 of 4 stages in the 50-70% band, the
same as v3. Stage 3 mid-skill pass 77.3% -> 74.7%, still above 70%.
Without the v3 orbiter the stage was 72.7% in v2, so the larger orbiter
(12 -> 16 px) moved it by +2.0 points = 3 bots of 150: no real effect.
Careful bots see the larger orbiter and wait. Reverted here.
Note on the numbers: the mid-skill group is 150 bot runs for each stage
(30 bots x 5 seeds). One bot is 0.67 points and the sampling error near
70% is about +-3.7 points, so 72.7 / 77.3 / 74.7 are not clearly
different. Three versions (v3, v4 and v2 before them) moved stage 3
inside this noise.
Change: a larger step, with a hazard kind whose effect was measured on
stage 2. There, each drone that goes across a lane killed 10-17% of the
mid-skill bots that came to it. Stage 3 gets one such drone in the top
door of wall x=19 (rows 1-2, travel 1 tile, 90 frames a cycle); every
route to keys 4 and 5 goes through that door. On paper: 74.7% x 0.83-0.90
= 62-67%. Not measured before this commit.
This is the last version allowed in this run (limit: 5).


```

