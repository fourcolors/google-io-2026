---
name: optional-callbacks-compliance-trap
description: Adding @optional_callbacks to a behaviour can break compliance macros that iterate behaviour_info(:callbacks) — they default-include optional callbacks
metadata:
  type: feedback
---

When adding an `@optional_callbacks` declaration to an Elixir behaviour, `behaviour_info(:callbacks)` STILL returns the optional callback in its result. `behaviour_info(:optional_callbacks)` returns the same callback separately. A compliance/conformance macro that iterates `:callbacks` and asserts `function_exported?/3` for each will silently require every adapter to stub every optional callback — defeating the whole point of `@optional_callbacks`.

**Why:** Caught this in §7.3-007 — added `check_availability/1` as optional, and the existing `Flowstay.CRS.Adapter.Compliance` macro started failing for every adapter because they didn't stub the optional callback. Fix: filter `behaviour_info(:optional_callbacks)` from `:callbacks` before iterating.

**How to apply:** Whenever adding an `@optional_callbacks` declaration, immediately grep the project for `behaviour_info(:callbacks)` callers. Any that iterate without filtering optionals are now incorrect. Fix them in the same PR. Tests that pin "the N expected callbacks" by direct `behaviour_info(:callbacks)` call also need the same filter (or to update the expected count).

Related: [[flowstay-dispatch-router-pattern]] — both deal with the gap between behaviour declarations and live behaviour observation.
