---
name: feedback-regression-pin-scenarios
description: When prior-scenario impl already satisfies negative-path AC by short-circuit, ship test as regression pin — don't manufacture RED
metadata:
  type: feedback
---

When a scenario's AC is the negative half of a triad (e.g. unauthorized-path / fail-closed / error-shape) and the positive scenario already shipped a short-circuit that mechanically satisfies the negative AC, the test will be GREEN-on-arrival. This is not a broken spec — it's an honest regression pin.

**Why:** Confirmed 2026-05-18 on §3.4-013 (mcp-fsm-gating scenario C). Scenario B's `MCPRuntime.dispatch/3` (`mcp_runtime.ex:36-49`) routed `{:error, :tool_not_authorized}` from the gate before `route_to_handler` could be invoked, so the negative AC (error shape + side-effect absence) was satisfied by the existing case clause. Manufacturing a RED by expanding AC scope (e.g. requiring a telemetry event on rejection) would have been worse craft than the honest framing. Mr. Cobb / team-lead approved option (a): ship as regression pin, skip pong, pp-auditor adversarially flips the impl to verify the pin is real.

**How to apply:**

- BEFORE writing the test, trace the AC against the existing impl. If the AC is structurally guaranteed by an upstream short-circuit, predict GREEN-on-arrival and flag to lead BEFORE running.
- Offer the lead three paths: (a) ship as regression pin and skip pong, (b) run pong cycle with zero-LOC impl acknowledged, (c) expand AC to manufacture RED. Recommend (a); never silently pick (c).
- Cite the specific short-circuit (file:line of the case clause) in your finding so the lead and auditor can verify the pin is real.
- Include a premise-guard `refute` early in the test that trips with a distinct message if the upstream contract changes (e.g. `refute :tool in Allowlist.for_scene(:wf, :scene)` — if the scene def later authorizes the tool, the snapshot equality would silently pass, but the refute catches it loudly).
- The auditor's job becomes "adversarially flip the short-circuit and confirm RED" — that's how the pin proves itself.

Related: [[feedback_pp_first_run_calibration]] — ceremony scales with seam complexity. Regression pins skip the ping-pong-pong-pong dance and go straight to ping-ship-audit.
