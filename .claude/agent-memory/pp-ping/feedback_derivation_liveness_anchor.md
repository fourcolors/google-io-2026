---
name: feedback_derivation_liveness_anchor
description: For specs that say "derive live, not from constant", pair the obvious case with a second case at a different input to defeat a constant-lookup impl
metadata:
  type: feedback
---

When an acceptance criterion is of the form "X is derived live from Y — NOT a constant table", a single test at one fixed input cannot distinguish a live derivation from a hardcoded match. Add a second test at a DIFFERENT input where a constant-table impl would either spuriously pass (wrong) or spuriously fail (also wrong).

**Why**: A pong that pattern-matches `dispatch(tool, _call_id, _args) when tool in [:show_room_details, ...]` would pass a single-input test but violate the "live derivation" contract. The contract is unfalsifiable from one example.

**How to apply**: pick a second `(workflow, scene, tool)` triple where the authorized-tool set differs from the first. The same tool at a different scene, or a different tool at the first scene, both work. The second test passes ONLY if the dispatch read live scene state.

Used on scenario-B of mcp-fsm-gating: test 1 is `(room_booking, results_index, :show_room_details)`; test 2 is `(room_booking, room_details, :add_room_to_cart)`. Together they pin "the gate read live scene state to pick the legal-tools list."
