# swarm-playtest

A Claude Code skill. It tells Claude how to build a small browser game that 100 scripted bots can play, and how to improve the game in measured, committed versions until it hits the difficulty you asked for.

The method comes from one finished project, Hundred Ghosts:
- Play it: https://hundred-ghosts.vercel.app
- The 12 measured versions: https://github.com/koumpas/hundred-ghosts

## Install

Copy this folder into your skills folder with the name `swarm-playtest`:

```bash
git clone https://github.com/koumpas/swarm-playtest ~/.claude/skills/swarm-playtest
```

Then, in Claude Code, ask for a game and say that you want a swarm playtest, for example:
"Build a small browser game with 6 stages. Use the swarm-playtest skill. My difficulty target: 60–80% of mid-skill bots finish each stage."

## What is in it

- `SKILL.md`: the steps and the rules (deterministic simulation in one file, scripted bots with a skill range, a harness, commit first and measure after, a playtester panel, an honest README).
- `reference/hundred-ghosts/`: the full worked example (game, bots, tools, viewer) and `COMMITS.md` with its 12 version commit messages.
- `reference/latchkey/`: a second, small example in a different genre.

## Scope and status

- For new browser games in plain JavaScript that Claude writes. Not for existing games in large engines.
- Used on three games so far:
  - **Hundred Ghosts** (platformer, by the session that wrote the skill): 8 of 8 stages on target after 12 versions.
  - **Latchkey** (top-down, free movement; a session that had only this folder; limit of 5 versions): a working game, bots, harness and record in one pass; 3 of 4 stages on target.
  - **A one-button rhythm game** (a session that had only this folder; limit of 5 versions): 4 of 4 tracks on target at the last version. Its tester did not call it a safe hit, and the playtester score went down while the target was hit.
- The skill text was changed after each test, from the tester's report. The text here was not tested again after the last change.
- The bots are a model of players, not players. The difficulty target is your choice, and hitting it is not the same as a better game.

## Licence

MIT. See `LICENSE`.
