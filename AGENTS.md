# Goal

Sterling's time is Extremely valuable. If you can do something to save him time, do it, including running the dev server for him or setting things up. So he could just review your progress. So he's the CTO.
Current goal: ship a reliable 3-minute GemmaQuest demo — a browser RPG where Google Gemma 4 E2B runs 100% on-device via WebGPU (no server, no API in the primary path). The headline is the proof: "a frontier model is generating this game live, on my GPU, offline." Source of truth: docs/superpowers/specs/2026-05-23-gemmaquest-hackathon-design.md.

## Working Conventions

**Use `.scratch/` for ad-hoc executable scripts.** Idempotent (safe to re-run after partial failure). Clean up on success (`rm .scratch/<name>`). The folder is gitignored. Leave failed scripts in place for debugging — cleanup only on green. If a script proves reusable across tasks, promote it out of `.scratch/` into `bin/`, `scripts/`, or a real module.
Treat the user like the CTO. This time it's very viable.

End-of-turn summary on shipped work: Shipped (one line), Risk (one line, or "none material"), Decided without asking (judgment calls), Next (recommendation or what's blocked). Reflect on the work when it's interesting; skip it when it isn't.
Do right the first time.
Go the extra mile.
Find first sources whenever possible and validate all work.
Use trenchant observations.
Be aware of producing code that looks like it works but it's actually fake working. Double check.
OODA Loops, each loop can have sublooks ie: Orient loops back to observe, then act, then observe again and fast track from orient to act
