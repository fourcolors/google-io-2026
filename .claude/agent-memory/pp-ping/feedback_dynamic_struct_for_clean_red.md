---
name: dynamic-struct-for-clean-red
description: When specing a not-yet-defined struct module, use `struct(Module, fields)` and `session.__struct__ == Module` instead of `%Module{...}` literals — literals CompileError, dynamic construction lets RED surface as UndefinedFunctionError
metadata:
  type: feedback
---

# Dynamic struct construction keeps RED clean

**Rule:** When writing a failing test for a module that doesn't exist yet (typical pp-ping scenario), don't use struct literals (`%Mod{field: x}`) in patterns or constructions. Use `struct(Mod, field: x)` for construction and `session.__struct__ == Mod` for type assertions.

**Why:** `%Mod{...}` is expanded at compile time. If `Mod` doesn't exist, the test file CompileErrors instead of running. The pong sees a noisy "your test file is broken" instead of the clean "the function you need to define isn't defined yet" signal. RED should always be a clean `UndefinedFunctionError` on the symbol pong is about to implement — not a CompileError on test-file syntax.

**How to apply:** 
- Construction: `session = struct(Flowstay.X.Session, token: "abc")` not `session = %Session{token: "abc"}`.
- Type pin: `assert session.__struct__ == Flowstay.X.Session` not `assert %Session{} = session`.
- Field assert: `assert session.token == "abc"` not `assert %Session{token: "abc"} = session`.
- This applies to ALL pp-ping tests where the target module is brand-new. Confirmed 2026-05-23 on B.3 Session spec — advisor flagged before write, RED came up as 7×UndefinedFunctionError exactly.

Related: [[feedback_function_exported_otp21]] (sibling load-order trap on the discipline-pin axis).
