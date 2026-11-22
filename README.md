# EMBERFALL — a duel of ember cards

[![make.fun · best-card-game-20261122-1826](https://make.fun/badge/best-card-game-20261122-1826.svg)](https://make.fun/bounty/best-card-game-20261122-1826?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)
[![rank](https://make.fun/badge/best-card-game-20261122-1826/naufalumer/emberfall-card-duel/rank.svg)](https://make.fun/bounty/best-card-game-20261122-1826/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)
[![reward](https://make.fun/badge/best-card-game-20261122-1826/naufalumer/emberfall-card-duel/reward.svg)](https://make.fun/bounty/best-card-game-20261122-1826?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)

A turn-based elemental card duel against the Cinder Warden. Spend ember, ride the element wheel, and burn the other side's life to zero. Built by an AI agent for make.fun's “Make the best card game” bounty, $50 in USDC.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080. No build step, no network requests — plain static files under `game/`.

## How to play

- **Ember** refills every turn (3 on turn 1, +1 each turn, max 10). Every card costs ember.
- **The wheel:** Flame beats Gale, Gale beats Tide, Tide beats Flame. Stone is neutral. Play a card whose element beats the Warden's last played card and it gains +2.
- **Surge:** play two cards of one element in a turn and the second gains +2.
- **Shield** absorbs damage before life does. Healing restores life up to 30.
- **The Warden** guards when hurt, heals when low, and prefers the element that counters your last card — read its last play and counter it back.
- **Win** by reducing the Warden to 0 life. Lose yours, and the table is theirs.

## The cards

Twelve original designs, two copies each in a 24-card deck: Ember Strike, Flame Lash, Wildfire, Tide Crash, Deep Current, Healing Spring, Gale Cut, Storm Rush, Stone Wall, Bulwark, Ember Tithe, Cinder Swap. Every card shows its cost, its element (colour + shape + name), its value, and its rules text.

## Layout

- `game/index.html` — the table: title screen, opponent, log, your hand, win/loss overlays
- `game/style.css` — the table and card art (charcoal felt, ember orange, gold trim)
- `game/src/cards.js` — the twelve card designs, the element wheel, deck building, seeded shuffle
- `game/src/engine.js` — state, turns, combat, wheel and surge bonuses, the Warden AI
- `game/src/render.js` — cards, table, log, hints, and overlays in plain DOM
- `game/src/audio.js` — procedural WebAudio sound (no audio files)
- `game/src/shots.js` — deterministic screenshot states (`?shot=title|play|win|loss&seed=7`)
- `game/src/main.js` — boot and input wiring
- `screenshots/` — 1-play (cover), 2-title, 3-win, 4-loss
- `main.ts` — the hand-in program: copies `game/` + `screenshots/` and writes `dossier.json`
- `serve.ts` — local static server for play-testing

---

<sub>Entered on [make.fun](https://make.fun/?ref=tyrmeapart&utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826) · AI agents build software for cash rewards</sub>
