# Goal: Land §13 step-1 test harness — ExUnit + pytest driving the agent against real models

## Specific

Build the cross-runtime test harness §13 step 1 commits to: a **Python worker** (LiveKit Agents SDK with the cascaded plugin — Gemini 3.1 Flash Lite text/SSE LLM, Deepgram STT, Gemini TTS) driveable from **ExUnit** on the Elixir side, with **pytest** on the Python side asserting mechanical contracts (tool calls, scene transitions, transcripts) — not model behavior. The harness re-verifies `update_chat_ctx()` and `generate_reply(instructions=...)` work on the cascaded path before §6 / §7 are allowed to depend on them.

Spine + observability already shipped in M1 + M2 + M3. This milestone closes the **harness** piece so the three §13-step-1 things land together as the arch doc commits.

Worker lives at `worker/` (parallel to `app/`). The existing `python/` directory is `flow/` v1 reference material per [[flowstay-voice-arch-key-facts]] — separate from the v2 worker.

## Measurable

- `cd worker && uv run pytest` passes a non-trivial smoke test (worker boots, dependencies resolve, fixture loads)
- `cd app && mix test` includes an end-to-end test that drives the worker via the harness adapter
- `features/invariants.feature` §13.0-003..007 scenario is **runnable** — a deterministic test that asserts harness drives agent against real models (Deepgram STT, Gemini 3.1 Flash Lite cascaded, Gemini TTS) and asserts on transcript/tool-call/scene-transition

## Achievable

Decomposed into 5 ping-pong scenarios (dispatched in order):

- **M4.1** Python worker scaffolded at `worker/` with uv + pytest; trivial smoke test passes
- **M4.2** LiveKit Agents SDK installed; minimal `AgentSession` defined with cascaded plugin config
- **M4.3a** Python-side `AgentSession.run()` smoke — pytest-asyncio harness drives a `MinimalAgent` through one turn and asserts on `result.expect` events (proves the cascaded chain runs a turn before the Elixir bridge tries to drive it)
- **M4.3b** Worker test harness adapter — Elixir side launches the worker subprocess and observes its lifecycle
- **M4.4** End-to-end: ExUnit test drives one scene transition through the worker; asserts on transcript

`auditor_mode`:
- M4.1, M4.2, M4.3a: `claude-solo` (deterministic single-runtime scaffolding)
- M4.3b, M4.4: `consult` (cross-runtime bridge → LLM-compliance-adjacent; benefits from Gemini + Codex independent eyes)

> 2026-05-15 split: M4.3 was bifurcated after pre-flight + GOAL re-read surfaced a scope/audit-mode mismatch with the task list. M4.3a is the Python-side end-to-end smoke that proves the cascaded plugin chain runs a turn (was implicit in M4.2's wiring tests; broken out explicitly so the Elixir bridge has a deterministic Python contract to target). M4.3b is the original M4.3 — Elixir launches the worker subprocess.

## Relevant

§13 step 1: *"You cannot debug later steps without [the test harness, observability spine, and minimal spine]."* M1+M2+M3 shipped spine + observability; the harness is the assertion mechanism that proves they all hold under real load. Phase 2+ workflow scenarios in the catalog (`@phase:3+`) depend on this harness existing as their `@requires` target.

The harness is also the *single deferred piece* of §13 step 1 — once M4 ships, the §14.2 deterministic eval gate can fire on every commit, and the @phase:1 cluster of 117 scenarios becomes runnable end-to-end.

## Time-bound

4 ping-pong cycles. Bubble to user if any single scenario exceeds 3 re-dispatches without progress. Bubble immediately on environment blockers (LiveKit API access, model credentials missing, etc.).
