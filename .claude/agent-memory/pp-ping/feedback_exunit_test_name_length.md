---
name: feedback_exunit_test_name_length
description: ExUnit caps the combined describe + test name at 255 chars; keep describe block strings short to avoid SystemLimitError at compile time
metadata:
  type: feedback
---

ExUnit computes a "full test name" as `test <describe-string> <test-name-string>` and rejects anything over 255 chars at compile time with `SystemLimitError`. The combination includes describe + test name + the literal `test ` prefix and one space, so the practical budget is tight.

**Why**: Long, descriptive describe strings (e.g., "Flowstay.MCPRuntime.dispatch/3 positive path: authorized tool routes through FSM gate to underlying handler") plus long test names will blow the limit. The error is compile-time only — no warning earlier.

**How to apply**: keep describe strings under ~80 chars; let the test name carry per-case detail. Section literals like `§3.4-011` are short and worth keeping in both. Format example that works: `describe "§3.4-011 — MCPRuntime.dispatch/3 positive path (FSM-gated)"`.
