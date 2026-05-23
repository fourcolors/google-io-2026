---
name: macro-exported-for-defmacro
description: Use `macro_exported?/3` (NOT `function_exported?/3`) when asserting a `defmacro` is defined on a module — defmacros compile to `MACRO-name/arity+1` and are invisible to function_exported?
metadata:
  type: feedback
---

When asserting that a module defines `defmacro <name>(args)`, use `macro_exported?(Module, :name, arity)`. **Do not** use `function_exported?(Module, :name, arity)` — it returns `false` for macros because `defmacro foo(x)` compiles to `MACRO-foo/2` (extra `__CALLER__` arg) which is not what `function_exported?` is checking.

Empirical evidence:
```elixir
defmodule M do
  defmacro __using__(_opts), do: quote(do: nil)
end

function_exported?(M, :__using__, 1)  # => false
macro_exported?(M, :__using__, 1)     # => true
M.__info__(:macros)                    # => [__using__: 1]
M.__info__(:functions)                 # => []
```

**Why:** Caught during adapter-phase-a S2 (2026-05-21). I wrote a test asserting `function_exported?(Compliance, :__using__, 1)` against a `defmacro __using__/1` — it failed even though the macro was correctly defined and `use Compliance` worked at compile time everywhere else. Pong's empirical probe diagnosed it cleanly. Sibling foot-gun to [[function-exported-otp21-load-order]] — both involve `function_exported?` having a blind spot, both surfaced as ping-author mistakes in consecutive scenarios.

**How to apply:**
- When specing a macro module's public API (especially `__using__/1` for `use Foo`-style helpers), assert with `macro_exported?/3`.
- For mixed modules (defines BOTH `def`s and `defmacro`s), pair `function_exported?` and `macro_exported?` checks if the spec needs to pin both surfaces.
- You CANNOT have both `defmacro __using__/1` AND `def __using__/1` on the same module — Elixir rejects the name/arity conflict.
- You CANNOT replace `defmacro __using__/1` with `def __using__/1` — `use` requires the `defmacro` form to inject AST into the using module's compile context. Plain `def` runs but its return value is discarded by `use`.
- The two-surface design pattern (`defmacro __using__/1` for the `use` API + `def some_helper/1` for direct calls) is the right shape — see [[macro-spec-two-surfaces]].
