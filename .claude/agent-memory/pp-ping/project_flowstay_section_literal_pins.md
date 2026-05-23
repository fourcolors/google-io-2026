---
name: project_flowstay_section_literal_pins
description: FlowStay catalog refresh pins surface from §N.N-NNN literals in describe strings + test docstrings; place them where grep finds them
metadata:
  type: project
---

The FlowStay catalog refresh greps for `§<section>-<number>` literals (e.g., `§3.4-011`) to round-trip-pin scenarios across re-wordings. Each scenario that has a § contract should appear as a literal in either:

- the test's `describe` block string, or
- the test's `test` name string / docstring

**Why**: Re-wording test names is normal during refactor; the § literal is the stable bridge between the catalog and the test surface. Without it, the catalog can lose its anchor.

**How to apply**:

```elixir
describe "§3.4-011 — MCPRuntime.dispatch/3 positive path (FSM-gated)" do
  test "§3.4-011: dispatch routes to handler when scene authorizes the tool" do
    ...
```

Matches the pattern shipped in `app/test/flowstay/workflow/allowlist_test.exs:123`. Keep the describe-string short — ExUnit caps the combined describe+test name at 255 chars.
