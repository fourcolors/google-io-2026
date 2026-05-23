# Ping-Pong team — pair programming with an over-the-shoulder auditor

**Activation: Model Decision.** Apply this rule when the task is implementation work that
benefits from test-first discipline and independent QC — especially after a prior attempt
produced a "premature done" or a wrong diagnosis. Invoked explicitly via the `/ping-pong`
workflow (`@.agents/workflows/ping-pong.md`).

## The roster

Three role personas, defined as skill assets and dispatched as subagents. Do **not** inline
them here (each is large, and they are the single source of truth) — reference them:

| Role | Handle | What it does | Persona |
|------|--------|--------------|---------|
| **Navigator** | `pp-ping` | Per-scenario spec writer. Discovers the project's test conventions and writes a **failing** test in-place. The test docstring carries the BDD scenario; the assertions carry the acceptance criteria. **The test IS the spec.** | `@.agents/skills/ping-pong/agents/pp-ping.md` |
| **Driver** | `pp-pong` | Implementer. Reads pp-ping's failing test, implements until it passes (RED→GREEN), writes structured evidence back. | `@.agents/skills/ping-pong/agents/pp-pong.md` |
| **Auditor** | `pp-auditor` | Over-the-shoulder QC. Reads the diff, reproduces the test, checks pong on five axes — **on task, correct, right, smart, extra mile** — and asks "is this dumb?" Not just a test runner. | `@.agents/skills/ping-pong/agents/pp-auditor.md` |

## On-team vs. off-team (preserve independence)

- **pp-ping + pp-pong are the pair** — they may message each other mid-cycle (navigator and
  driver coordinate directly, no intermediary).
- **pp-auditor sits outside the pair** — it reports only to the lead. Its value comes from
  *not* being in the pair's conversation. (Same reason cross-model reviewers write their
  verdicts to separate files before reading each other's.)

## Dispatch model in Antigravity

The Claude Code original dispatched these via `Agent({subagent_type: "pp-ping"})` with
`TeamCreate` / `TaskCreate` / `SendMessage`. In Antigravity:

- **Spawn** each role with `define_subagent` (custom system prompt = the persona file above)
  then `invoke_subagent` — **fresh per scenario**, no anchoring on prior cycles.
- **Pair messaging** uses Antigravity's inter-agent messaging (agents message by ID).
- **Task state** uses the native Task List instead of `TaskCreate`/`TaskGet`.
- The deeper background (full skill, audit modes, escalation table) lives in the copied
  skill: `@.agents/skills/ping-pong/SKILL.md`.

At cycle checkpoints, consult the advisor (`@.agents/rules/advisor.md`).
