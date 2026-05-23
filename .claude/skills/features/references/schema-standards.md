# Schema Standards

For authoring and modifying scenarios in `features/journeys.feature` and `features/invariants.feature`.

## File split rule (protagonist-based)

| File | Goes here when… |
|---|---|
| `journeys.feature` | The scenario describes something a **guest does or experiences**. Protagonist = guest. Steps read: *Given a guest…, When the guest says/clicks…, Then the agent responds…* |
| `invariants.feature` | The scenario asserts something the **system must always uphold** regardless of guest behavior. Protagonist = system. Steps read: *Given the system…, When Y, Then Z must hold.* |

**Cross-cutting scenarios** (both journey and invariant): live in `journeys.feature`, tagged `@invariant`. No duplication — a promise has exactly one home; tags express the other aspects.

## Tag taxonomy

| Tag | Meaning | Required? |
|---|---|---|
| `@journey` / `@invariant` | Kind tag (matches file) | Yes (one of) |
| `@ref:§X.Y` | Doc-section anchor for traceability + coverage check | Yes (≥1) |
| `@phase:N` | Maps to §13 build-order step (1..11). `/features run @phase:1` filters | Recommended |
| `@requires:<path>` | Backing test reference. Per-runner native syntax: Elixir uses `elixir/test/file.exs:LINE` (file:line); Python uses `python/tests/file.py::test_name` (pytest). Runner dispatches by path prefix. | Optional |
| `@v2` | Committed in doc but explicitly v2; excluded from default runs | Optional |
| `@flake` | Known-flaky scenario; excluded from gating but tracked | Escape hatch |

Add new tags only when a real need arises. Tags are free-form Gherkin — no enforcement beyond convention.

## When to add a `Judge:` line

**Add it when** the right answer depends on context and can't be a regex: agent narration, tone, framing, error-recovery phrasing, or when one of §14.3's rubrics applies (persona, one-question-at-a-time, honest unhappy-path, latency narration, etc.).

**Skip it when** the Then-steps are mechanically checkable (state advanced, value matched, count is N, error rejected).

Format: `Judge: <one sentence describing the spirit being checked>`. Reference §14.3 rubrics by name in the sentence when applicable.

## Example

```gherkin
# invariants.feature

Feature: state_version advances monotonically on every mutation
  @invariant @ref:§10 @ref:§13 @phase:1

  Scenario: Every successful tool call increments state_version by 1
    @requires:elixir/test/state_version_test.exs:42
    Given the Session GenServer at state_version N
    When any mutating handle_call succeeds
    Then state_version is N+1
    And the audit log records (call_id, N+1, reason)


# journeys.feature

Feature: Guest revises dates mid-cart and the system recovers cleanly
  @journey @invariant @ref:§3.5 @ref:§5.2 @ref:§7.3 @ref:§11.2 @phase:8

  Scenario: Date revision releases the old hold and places a new one
    Given a guest with a held room for the current dates
    When the guest says "actually, let's do the 14th"
    Then update_form(check_in, 14th) is called
    And search_rooms re-runs for the new window
    And the old hold is released exactly once
    And a new hold is placed for the new window if availability exists
    Judge: agent acknowledges the change, narrates the wait, does not promise the old dates
```
