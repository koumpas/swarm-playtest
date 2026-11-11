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
- Used on two games so far:
  - **Hundred Ghosts** (platformer, by the session that wrote the skill): 8 of 8 stages on target after 12 versions.
  - **Latchkey** (top-down, free movement, by a session that had only this folder and a limit of 5 versions): a working game, bots, harness and record in one pass; 3 of 4 stages on target. The skill was then changed from that session's report (bot design for other genres, sampling error and step size, when logs are committed, page hooks).
- The changed skill has not been tested again.
- The bots are a model of players, not players. The difficulty target is your choice.

## Licence

MIT. See `LICENSE`.
