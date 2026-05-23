---
description: Run the ping-pong loop — pair programming (ping=navigator, pong=driver) with an independent auditor — to autonomously execute a task, a list of tasks, or a plan with scoped scenarios.
---

# /ping-pong

When the user types `/ping-pong <work>`, act as the **team lead / orchestrator**. Accept the
work in whatever shape it arrives, decompose what's coarse, dispatch a per-scenario trio,
verify on every return, and only bubble to the user when the loop genuinely can't recover.
The goal is **autonomous execution** of solid-enough input.

Roster and roles: `@.agents/rules/ping-pong-team.md`. Full background, audit modes, and the
escalation table: `@.agents/skills/ping-pong/SKILL.md`.

## Steps

1. **Frame the work.**
   - A single task → decompose into BDD scenarios.
   - A list of tasks → process each, decomposing as needed.
   - A plan with pre-scoped scenarios → take them as given; dispatch in dependency order.
   - If a scenario's context is thin, dispatch the built-in `research` subagent first.

2. **Consult the advisor before committing to the decomposition** (per
   `@.agents/rules/advisor.md`) — this is "before substantive work."

3. **Per scenario, run one cycle:**
   a. `define_subagent` **pp-ping** from `@.agents/skills/ping-pong/agents/pp-ping.md`;
      `invoke_subagent` with the scenario brief. It writes a **failing** test in-place, in
      the project's own test convention. The test IS the spec.
   b. `define_subagent` **pp-pong** from `@.agents/skills/ping-pong/agents/pp-pong.md`;
      `invoke_subagent` with the task id. It implements until the test passes (RED→GREEN)
      and reports structured evidence. The pair may message each other directly.
   c. `define_subagent` **pp-auditor** from `@.agents/skills/ping-pong/agents/pp-auditor.md`
      (kept **off** the pair). It reproduces the test and checks five axes — on task,
      correct, right, smart, extra mile — and asks "is this dumb?"

4. **Verify on return — do not trust "done".**
   - Re-run pp-ping's test yourself from its path.
   - Confirm the task has pong's structured evidence; missing fields or a red test → re-dispatch.
   - Route auditor failures: *On task* → re-ping (spec missed intent); *Correct* → re-pong
     (test didn't pass on re-run); *Right* → re-pong (hygiene / half-finished); *Smart* →
     re-pong with a "simpler approach" prompt.

5. **At each checkpoint and before declaring the scenario done**, consult the advisor
   (`@.agents/rules/advisor.md`) — make the work durable first.

6. **Respawn** dead or stale subagents as needed (fresh `define_subagent`); spawn lead-side
   helpers (`research`, etc.) that report to the lead, not to the trio.

7. **Escalate to the user only** when the loop can't self-recover after the routing in
   step 4. Otherwise keep cycling until every scenario is green.
