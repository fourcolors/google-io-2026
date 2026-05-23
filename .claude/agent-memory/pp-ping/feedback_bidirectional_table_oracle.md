---
name: bidirectional-table-oracle
description: Round-trip tests for bidirectional mapping modules need a hardcoded oracle separate from the impl; deriving from the module under test is self-satisfying
metadata:
  type: feedback
---

When specing a module that exposes bidirectional lookups (e.g., `to_a/1` ↔ `to_b/1` with both expected to be inverses), the round-trip property assertion `to_b(to_a(x)) == x` PASSES even if both functions are wrong — as long as they're inverses of each other. Same for `to_a(to_b(y)) == y`.

**The trap**: deriving the test's input list by calling the module under test. E.g., `for code <- Module.all_codes(), do: assert Module.to_b(Module.to_a(code)) == code` — this is circular; `all_codes/0` could return `[]` or could disagree with the spec, and the round-trip would still "pass".

**The fix**: hardcode a `@pairs` (or `@oracle`) literal list at the top of the test file, duplicated from the implementation table on purpose. Drive all assertions — happy-path, round-trip, set-membership — from that oracle. The duplication IS the contract; if the impl drifts, the test fails.

**Why:** Caught by advisor before writing C.1 (`RoomMap`) spec, 2026-05-23. The 8 IBE↔FlowStay code pairs needed an independent oracle so the round-trip tests weren't trivially satisfied by any pair of mutually-inverse-but-wrong functions.

**How to apply:** Any time a spec calls for round-trip / bidirectional property tests on a lookup module, write the canonical mapping as a literal `@pairs` list at the top of the test file. Add a moduledoc note explaining why the duplication is intentional, so future maintainers don't "DRY" it by referencing the impl module. Bonus: add negative-symmetry assertions (`to_a/1` rejects b-shaped inputs and vice versa) to catch lazy single-merged-map implementations.

Related: [[dynamic-struct-for-clean-red]] (sibling pattern — keep RED clean and predictable).
