---
name: verify-fake-module-claims-before-specing-removal
description: Before specing a "remove reference to non-existent X" assertion, grep for `defmodule X` across lib/ AND test/support/ — Elixir test-support modules ARE real even if they don't live in lib/
metadata:
  type: feedback
---

When a task description says a module is "fake-working" or "doesn't exist" and asks you to remove the reference, **verify the module's reality before writing the test**. Run `grep -r "defmodule <ModuleName>"` across the entire repo, including `test/support/`. Don't trust path conventions — Elixir compiles `test/support/` modules into the test environment just like `lib/` modules.

**Why:** On Phase A S1 of the FlowStay adapter work, GOAL.md described `Flowstay.CRS.Adapter.Test` as a non-existent module that needed its docstring reference removed. Reality: the module existed at `app/test/support/crs_adapter_test_impl.ex` and was actively exercised by 3 passing tests. If I'd written the test as "refute String.contains?(doc, \"Adapter.Test\")" without verifying, pong would have deleted the test-support module and broken 3 tests as a downstream regression. Caught by grep before the spec was written; lead resolved the GOAL.md framing via SendMessage round-trip.

**How to apply:**
- Whenever a spec asks you to remove/clean up a reference to module/function/file X, grep for the definition before writing the assertion.
- If the thing IS real, escalate via SendMessage to the lead with the discriminator question (keep-and-rephrase vs delete-and-expand-scope) — don't guess.
- Narrow the failing assertion to the literal misleading phrase, not the broader symbol name, so pong can fix the wording without cascading edits.
- Linked memory: [[check-test-support-before-declaring-missing]] (FlowStay-side note in user-memory captured the same lesson).
