---
name: flowstay-dispatch-router-pattern
description: When wiring a central FSM-gated dispatch in MCPRuntime, use private route_to_handler/3 clauses (one per tool atom) — match the project's existing per-tool handler style.
metadata:
  type: feedback
---

For FlowStay's MCP dispatch wiring (§3.4-011..013), the established pattern is:

1. `dispatch/3` reads `Session.get_state(call_id)` once, pulls `current_workflow` + `current_scene`, and calls `Allowlist.for_scene/2` LIVE (do NOT cache or table-ize this — test 2 of any positive-path scenario will trip on a constant table).
2. `Allowlist.for_scene/2` returns either a list of atoms OR `{:error, :unknown_workflow | :unknown_scene}` — collapse the error branch to `[]` so the gate fails closed per §3.4-004.
3. Route via private `route_to_handler/3` clauses, one per tool atom, that call the existing per-tool runtime functions unchanged. Args shape is per-tool (string vs map vs list) — pattern-match each clause's args.

**Why**: matches the explicit lead spec on task mcp-fsm-gating/2 + the live-derivation discipline §3.4-009 demands. A constant scene→tools table would pass the literal-scenario test but fail the derivation-liveness anchor test (which intentionally swaps the seeded scene to a different tool/scene pair).

**How to apply**: any time the lead asks you to wire a gated dispatch entrypoint into an existing runtime module — don't introduce a new behaviour, registry, or telemetry seam unless asked. Match the depth of the change to the depth of the problem. RED → GREEN here was one diff in one file (mcp_runtime.ex) with zero new handlers.
