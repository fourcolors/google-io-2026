---
name: flowstay-workflow-tests
description: Test layout + shape for Flowstay.Workflow.* modules in the FlowStay Elixir app
metadata:
  type: project
---

Tests for `Flowstay.Workflow.*` modules live at `app/test/flowstay/workflow/` (e.g. `allowlist_test.exs`).

Established shape (2026-05-18, set by Bucket #1 of §3.4 work):
- `use ExUnit.Case, async: true`
- module docstring carries the BDD scenario + § refs
- `describe "§X.Y-NNN — short title"` blocks group tests by spec section
- literal-equality `==` pins on the canonical `room_booking` surface (RuntimePins pattern)
- synthetic `Workflow.t()` for derivation-logic edge cases (empty agent_tools, dedup, sort)
- `{:error, :unknown_workflow}` is the established tag for missing workflow names — comes from `Flowstay.Workflow.fetch/1`

**Why:** This is the seam where the FSM gating triad (§3.4-011..013) plugs in. The catalog round-trips on § literals in docstrings/headings, so embed the literal `§N.M-NNN` in the describe heading (not just a comment) for it to survive re-wording.

**How to apply:** When a scenario adds a new helper to `Flowstay.Workflow.*`, default to appending a `describe` block to the same test file rather than creating a sibling — keeps related pins co-located. See [[append-vs-new-test-file]].
