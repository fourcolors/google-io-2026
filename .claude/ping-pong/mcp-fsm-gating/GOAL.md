# Goal: Un-stub @stubbed:mcp_fsm_gating_runtime by wiring FSM-driven authorization into MCP dispatch

## Specific

Wire `Flowstay.WorkerRuntime.mcp_authorize_tool_call/2` into the actual MCP
tool-dispatch path so unauthorized tool calls return
`{:error, :tool_not_authorized}` without executing the tool handler. The gate
input — "what tools are legal at the current scene" — must be derived from
the live scene definition (`Flowstay.Workflow.Scene.agent_tools`), NOT a
constants table or stale cache. This is the SECURITY boundary §3.4-004
demands ("MCP server independently authorizes and validates every call"),
even though §3.4-003 reminds us the worker's `allowed_tools` is NOT
authorization — only the server side is.

Deliverables:
1. A scene-level allowlist helper — `Flowstay.Workflow.Allowlist.for_scene/2`
   (companion to the workflow-level `for_workflow/1` we shipped in Bucket #1).
2. A central dispatch entry point — likely `Flowstay.MCPRuntime.dispatch/3`
   (tool_atom, call_id, args) — that calls the gate first, then routes to
   the right runtime function on success, or returns
   `{:error, :tool_not_authorized}` on failure.
3. Tests that pin both the positive and negative paths with literal-equality
   assertions per the RuntimePins pattern.

## Measurable

Work-level success when ALL of:

1. `Flowstay.Workflow.Allowlist.for_scene/2` exists with tests covering
   hub + room_booking scenes.
2. `Flowstay.MCPRuntime.dispatch/3` (or equivalent central gate) exists and
   either:
   - routes authorized calls to the right runtime function (positive case), OR
   - returns `{:error, :tool_not_authorized}` on disallowed calls
     (negative case) AND the runtime function is NOT invoked (assert via
     side-effect absence — no Session state change).
3. `mix test` reports 1112+ tests, 0 failures.
4. At least one test contains the literal `§3.4-011` (or `§3.4-013`) in a
   docstring / assertion message so the catalog round-trip pin survives
   re-wording.
5. The `@stubbed:mcp_fsm_gating_runtime` tag remains for now — un-stubbing
   the catalog scenario is a Bucket #2.5 follow-up that requires the
   Python-side integration test (Bucket #4). The work-level GOAL here is the
   Elixir-side gate; the @stubbed removal comes when both halves are exercised.

## Achievable

Three scenarios in dependency order:

- **scenario-A**: `Workflow.Allowlist.for_scene/2` — derivation helper (no
  side effects, pure data lookup). Builds the input the gate needs.
- **scenario-B**: Positive dispatch — authorized tool routes through to
  the runtime function, returns the runtime's result.
- **scenario-C**: Negative dispatch — unauthorized tool returns
  `{:error, :tool_not_authorized}`, runtime function is NOT called (verified
  by absent side effect on canonical state).

TaskCreate emits these as task IDs; the lead dispatches a pp-ping/pp-pong/
pp-auditor cycle per scenario in this order.

## Relevant

§3.4-011..013 is the FSM-gating triad — the security side of the
"§3.4-004 server independently authorizes" contract. Currently `@stubbed`
because the existing tests pin posture/constants but never exercise the
"call arrives → gate rejects → runtime not invoked" path against real
Session state. Mr. Cobb's broader §3.4 plan is to take all four buckets
(codegen / FSM-gate / allowlist-flow / E2E Python test) from stubbed →
live; this is bucket #2 of #4. Blocks bucket #3 (worker-side allowlist
update flow) only to the extent that bucket #3 may want to reuse the
gate-helper API; otherwise independent of buckets #3 / #4.

## Time-bound

Max 3 ping-pong cycles total (one per scenario) + 1 re-dispatch budget per
scenario. After 6 dispatches without convergence, escalate to Mr. Cobb with
the current state and the specific blocker. Wall-clock soft cap: this
session.
