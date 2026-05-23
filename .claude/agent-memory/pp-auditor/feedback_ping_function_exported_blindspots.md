---
name: ping-function-exported-blindspots
description: Pattern across adapter-phase-a S1+S2 — ping shipped `function_exported?` foot-gun specs in two consecutive scenarios; future audits should bite hard on ping's use of introspection idioms
metadata:
  type: feedback
---

In `adapter-phase-a`, ping shipped TWO consecutive specs with `function_exported?` blind spots that pong caught and routed back as one-liner test-author fixes:

- **S1**: `function_exported?/3` returned `false` for a callback that DID exist, because OTP-21+ requires `Code.ensure_loaded!/1` before introspection on modules that haven't been auto-loaded. Memory: `feedback_function_exported_otp21` (project memory).
- **S2**: `function_exported?(Compliance, :__using__, 1)` returned `false` because `defmacro __using__(opts)` compiles to `MACRO-__using__/2` (extra `__CALLER__` arg) — invisible to `function_exported?/3`. The right call is `macro_exported?/3`. Memory: `feedback_macro_exported_for_defmacro` (project memory).

**Why**: Two-in-a-row is a pattern, not noise. Both bugs share the same shape — ping reaches for `function_exported?` as a universal "is this thing callable?" check, but the introspection has at least two well-known blind spots (auto-loading + macros). Both bugs only surface at RUN TIME, not COMPILE TIME, so pong's first-pass run catches them but it's wasted cycle. Better caught by audit.

**How to apply**:

When auditing pp-ping's test file, if a spec uses `function_exported?`, immediately check:

1. **Auto-loading**: is there a `Code.ensure_loaded!(module)` BEFORE the `function_exported?` call? If not, FAIL "Right" axis with a hint at OTP-21 discipline.
2. **Macros**: is the function being probed a `defmacro` (especially `__using__/1`)? If yes, the right check is `macro_exported?/3`, NOT `function_exported?/3`. FAIL "Right" axis with a hint at the `MACRO-name/arity+1` compilation form.
3. **Behaviour callbacks**: if the function is on a behaviour, is it a `@callback` (compile-time) or a `@macrocallback` (compile-time, but produces a macro)? Same fork as above.

The fix is always a one-liner in the test file, NOT in the impl. Pong should refuse to "fix" the introspection by changing the IMPL (e.g., adding a `def __using__/1` wrapper) — that would be impl-bending-to-test, the wrong direction.

**Cross-scenario signal**: if I see a THIRD `function_exported?` foot-gun from ping in a future cycle, escalate to lead: "ping's introspection idiom is unreliable across N=3 scenarios — recommend ping add a pre-flight introspection sanity check to their spec-writing workflow." Don't tolerate it past N=3.

Linked: [[feedback_function_exported_otp21]], [[feedback_macro_exported_for_defmacro]] (both in project memory).
