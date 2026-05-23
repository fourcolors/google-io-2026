---
name: append-vs-new-test-file
description: When extending a peer helper, append a describe block to the existing test file rather than creating a sibling
metadata:
  type: feedback
---

When the spec adds a peer function to an existing module (e.g. `for_scene/2` next to `for_workflow/1`), append a new `describe` block to the existing test file. Don't create a sibling test file unless the surface is genuinely separate.

**Why:** Co-located pins are easier to keep in sync, and a single file communicates "this is one module's contract surface". A sibling `for_scene_test.exs` would force a reader to jump files to compare workflow-level vs scene-level behavior — the contrast between sorted+deduped (`for_workflow/1`) vs as-declared (`for_scene/2`) is the load-bearing detail and benefits from being right next to each other. Also matches [[keep-it-simple]] from global memory: flat lists beat pre-designed hierarchies.

**How to apply:** Default to extending the existing test file when adding tests for a peer function on the same module. Only spin a sibling file if the existing one would balloon past readability (rule of thumb: > ~300 lines) or if the new function tests live in a fundamentally different fixture/setup regime.
