# Wumpus Protocol: Game Rules

Wumpus Protocol is a GitHub-native cave game played through issue comments.

## Goal

Stabilize the weekly research cave by exploring rooms, collecting artifacts, and avoiding hidden hazards.

## How To Play

1. Open the active weekly cave issue from the profile README.
2. Add one command per comment.
3. Wait for GitHub Actions to update the board.
4. Refresh the profile README to see the new cave state.

## Commands

```txt
/help
/sense
/move north
/move south
/move east
/move west
/grab
/shoot north
/shoot south
/shoot east
/shoot west
```

## Board

- `AGENT` is the player position.
- Hidden rooms show `?`.
- Glowing icons near the agent are clues from `/sense`.
- The right panel explains the latest move and weekly hunters.

## Hazards

- Wumpus / Unsolved Problem: entering its room loses the run.
- PIT / Broken Build: entering its room loses the run.
- CTX / Context Switch: moves the agent to another safe room.

## Artifacts

Artifacts increase the score when collected with `/grab`.

Artifact examples:

- Algorithm Relic
- Security Key
- Blockchain Ledger
- Bioinformatics Sample
- Quantum Fragment
- Chemistry Formula
- Teaching Scroll
- System Blueprint

## Weekly Cycle

- One shared cave issue is active per week.
- Everyone plays in that same issue during the week.
- The cave resets automatically every Monday at 00:09 Dhaka time.
- A new weekly issue is created automatically.
- The README buttons are updated to the new active issue.

## Scoring

- `/sense`: +1
- Valid movement: +2
- Context Switch movement: +2
- Missed shot: +1
- Collected artifact: +8
- Solving the Wumpus: +40

## Fair Play

Use one command per comment. The game is meant to be lightweight, collaborative, and fun.
