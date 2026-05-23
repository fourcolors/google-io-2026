---
name: session-two-versions
description: Flowstay.Session has TWO version counters — state_version (any mutation) and scene_version (scene-changing mutations only)
metadata:
  type: project
---

`Flowstay.Session.CanonicalState` carries both `state_version` and `scene_version`:

- `state_version` bumps on *any* GenServer-mediated mutation (set/update_scene_state included).
- `scene_version` bumps ONLY when `current_scene` actually changes (`advance_scene/2`, `go_back/1`, `go_forward/1`).
- Implementation: `bump_versions(state_bump: …, scene_bump: …)` at `app/lib/flowstay/session.ex:272-284`.

**Why:** Naive grep for "version" surfaces `state_version` first (it's the common case in existing tests). When a spec says "scene_version bumps" or pins the `(call_id, scene_version, room_id)` key shape, you must verify the mutation actually touches scene_version, not just state_version.

**How to apply:** When specing anything that pins behavior on `scene_version`, (a) read `bump_versions/2` to confirm which API calls flip which counter, and (b) in the test, capture `scene_version` before+after the mutation as a precondition assertion so an impl regression on the wrong counter fails loudly. Pair with [[derivation-liveness-anchor]] for "derived live, not constant" specs.

Fresh sessions start at `scene_version: 0` (default at `app/lib/flowstay/session/canonical_state.ex:294`), useful for tests that want "two fresh sessions, same scene_version, vary only call_id".
