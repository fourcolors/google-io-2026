---
name: project_session_genserver_seeding
description: How to seed Flowstay.Session canonical-state fields that have no public setter (use :sys.replace_state via the registry tuple)
metadata:
  type: project
---

When a test needs to put `Flowstay.Session` into a state that no public API can produce (e.g., `current_workflow: :room_booking` — the struct has the field but no setter), seed it directly with `:sys.replace_state/2` against the via-tuple registration.

**Why**: `current_workflow` exists on `CanonicalState` but `Session.advance_scene/2` only mutates `current_scene` via `FSM.transition`. Adding a `Session.set_workflow/2` API is usually out-of-scope on ping-pong scenarios that say "no Session GenServer behavior changes." `:sys.replace_state` is the standard Elixir test seeding tool and doesn't force any implementation technique on pong.

**How to apply**:

```elixir
:sys.replace_state(
  {:via, Registry, {Flowstay.SessionRegistry, call_id}},
  fn %CanonicalState{} = s -> %{s | current_workflow: :room_booking, current_scene: :results_index} end
)
```

The registry name (`Flowstay.SessionRegistry`) comes from `session.ex:97` (`via/1`). Works through the via-tuple; no need to `GenServer.whereis` first. Pairs with `Session.Supervisor.start_session(call_id)` to get a fresh server.
