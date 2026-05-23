---
name: feedback-a3-canonical-state-destructure
description: Pong used destructure-style %CanonicalState{scene_version: ...} = get_state(call_id) for a public Session helper — fails fast on shape drift. Approved pattern for future Session-reading helpers
metadata:
  type: feedback
---

When a Session-state-reading helper needs a single field, prefer destructure-style binding over dot-access:

```elixir
%CanonicalState{scene_version: scene_version} = get_state(call_id)
"#{call_id}:scene_v#{scene_version}:#{room_id}"
```

over

```elixir
scene_version = get_state(call_id).scene_version
"#{call_id}:scene_v#{scene_version}:#{room_id}"
```

**Why:** The destructure form fails compile-fast if `%CanonicalState{}` ever drops or renames `scene_version`, instead of silently returning `nil` and producing `"call_abc:scene_v:RM-DELUXE"`. Caught and approved in audit of a3-call-id-wiring S1 (`Session.placement_idempotency_key/2`, 2026-05-22) — counted as an "extra mile" axis win.

**How to apply:** In future Session-reading audits, treat naked `.field` access as a Right-axis weakness when a destructure would catch shape drift. Don't downgrade to FAIL over it (it's a polish nit, not a bug), but flag it under Extra mile / suggest in the verdict.
