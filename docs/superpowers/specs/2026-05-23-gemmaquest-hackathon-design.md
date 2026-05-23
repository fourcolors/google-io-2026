# GemmaQuest — Hackathon Design Spec

**Date:** 2026-05-23
**Event:** Google I/O 2026 Hackathon
**Status:** Approved design, ready for implementation plan
**Build budget:** A few hours, today

## Overview

GemmaQuest is a serverless, browser-based generative RPG. A Google Gemma model runs
**entirely on-device via WebGPU** (transformers.js + ONNX) to author NPC dialogue and
world lore in real time. There is no server and no API in the primary path.

This spec refines the existing scaffolding into a reliable hackathon demo. The concept
is locked; the work is ruthless scoping, reliability fixes, and a rehearsed demo.

## The one goal

Deliver a reliable 3-minute demo whose headline is: **"a 2.3B-param Gemma model is
generating this game live, on my GPU, with no server."** The game is the vehicle; the
proof is the point. Anything that does not serve that headline is cut.

## Constraints (locked)

- **Time:** a few hours, today. Scope follows the demo, not the reverse.
- **Presentation:** we demo on our own machine, so the model can be pre-cached and
  pre-warmed off-camera. Judges do not watch a download bar.
- **The wow:** 100% in-browser inference. If in-browser cannot be made reliable in the
  time available, we fall back (see Risk Gate) — the user accepted this explicitly.
- **Demo style:** "prove offline first." Show there is no server *before* playing.

## Model decision

**Primary model: `onnx-community/gemma-4-E2B-it-ONNX`** (Gemma 4 E2B, ~2.3B effective
params, multimodal, Q4 weights ~1.5GB), run with WebGPU.

Decided by the user over the lighter-weight alternative
(`onnx-community/gemma-3-270m-it-ONNX`). E2B was chosen for dialogue quality and the
"frontier model in the browser" narrative. The design neutralizes the three risks E2B
introduces (slow first-token, q4f16 overflow, heavy warm-up) — see Foundation Work and
Risk Gate.

**Verified facts (2026-05-23):**
- Both ONNX repos exist and are transformers.js-compatible.
- In-browser Gemma 4 E2B inference is proven in the wild (e.g. the
  `nico-martin/gemma4-browser-extension` project: transformers.js + WebGPU, q4f16).
- **Known landmine:** onnxruntime issue #26732 — `fp16`/`q4f16` Gemma models can produce
  invalid (garbage) output on WebGPU due to numeric overflow. The demo's quantization
  must be pinned by an actual test, not assumed.

## Demo script — "prove offline first"

This sequence is the source of truth for scope.

- **Beat 0 (off-camera):** model pre-cached in IndexedDB, browser warmed, one inference
  already run to JIT the WebGPU pipeline. Cold-loading is never shown.
- **Beat 1 — "No server":** open DevTools → Network, toggle **Offline**. Optionally kill
  wifi for theatre.
- **Beat 2 — "It's resident":** realm loads; the `LOCAL · GPU` badge glows green — model
  in memory, network dead.
- **Beat 3 — "It's alive":** walk to an NPC, ask a question, tokens stream in live while
  offline.
- **Beat 4 — "It keeps generating":** move; biome lore writes itself as you explore.
- **Beat 5 — close:** "No key, no server, no internet. It just plays."

## Architecture — the inference adapter seam

One seam makes the fallback trivial. The game and UI talk only to an `InferenceEngine`
interface; they never know which engine answers.

```
Game / UI  ──calls──>  InferenceEngine.generate(systemPrompt, userPrompt, maxTokens, onToken)
                              │
                 ┌────────────┴────────────┐
            LocalWorkerEngine          ApiEngine
         (transformers.js + WebGPU)   (fetch hosted Gemma)
         single persistent worker      same interface
```

- **`InferenceEngine`** — the interface. One method: stream tokens for a prompt, calling
  `onToken` per token and resolving on completion.
- **`LocalWorkerEngine`** — primary path. Owns a *single persistent* Web Worker running
  Gemma 4 E2B via transformers.js on WebGPU. Serializes generation requests through a
  queue (one in-flight at a time).
- **`ApiEngine`** — fallback path. Same interface, backed by a hosted Gemma/LLM API. The
  game is byte-identical; only the "no server" claim is dropped.

Switching local → API is a one-line config change, not a rewrite. Build
`LocalWorkerEngine` first; `ApiEngine` is a ~20-minute insurance policy finished only if
the spike wobbles.

### Components and boundaries

- **Game engine / renderer / tilemap** (`src/game/*`) — procedural world, player,
  camera, NPC placement. Unchanged in scope; emits events (`biome_discover`,
  `npc_talk`, `walk`, `dialog_close`).
- **Orchestration** (`src/main.js`) — wires game events to `InferenceEngine` calls and
  updates the UI. This is where the worker-reload bug lives and must be rewired to the
  adapter.
- **Inference** (`src/workers/ai.worker.js` + new engine wrapper) — model load,
  streaming generation, device/quantization reporting.
- **UI** (`index.html` + `src/style.css`) — loader, lore log, NPC dialog, and the new
  `LOCAL · GPU` proof badge.

## Scope

### IN — the whole build

- Reliable E2B local load + pre-warm (verified quantization, JIT'd pipeline).
- Single persistent worker with a request queue (replaces per-call worker spawning).
- Procedural world walk (exists — keep).
- Biome lore generation routed through the persistent worker (rewire — currently broken).
- NPC free-form chat, streaming (exists — keep).
- `LOCAL · GPU` proof badge + offline cold-open beat (new — first-class).
- `ApiEngine` fallback behind the same interface (insurance).
- Demo-day checklist + one full rehearsal.

### OUT — cut today

- Quest system / JSON quest verification (biggest time sink, lowest demo payoff).
- Branching dialogue trees.
- Multimodal image/audio input (E2B supports it; scope creep for a 3-minute demo).
- Model-selection UI (lock to E2B; hide the dropdown — fewer things to break live).

## Foundation work — must-fix regardless of scope

1. **Kill the worker-reload bug (critical).** `generateBiomeLore()` in `main.js:250`
   spawns a *new worker and reloads the model on every biome discovery*. With the 1.5GB
   E2B model this will OOM or freeze the demo. Route all generation through the one
   persistent worker via `InferenceEngine`.
2. **Serialize requests.** One worker, one in-flight generation, a queue. Biome lore and
   NPC chat must not hit the GPU simultaneously.
3. **Pin the quantization.** During the spike, confirm the chosen dtype (`q4` vs `q4f16`
   vs `fp16`) produces valid, non-garbage output on the demo GPU. Default to the safest
   correct option that is fast enough.
4. **Pre-cache + pre-warm** per the demo-day checklist.

## The "Local Only" proof — a real feature, not a talking point

- **`LOCAL · GPU` badge.** Flips green only when the model is resident *and* the device
  is `webgpu`. Read from the worker's existing `ready` message (it already reports
  `device`). This is the visual anchor of the "prove offline first" cold-open.
- **Visible token streaming.** Already implemented — the single most convincing element.
  Keep it.
- **(Stretch, only if time) "GPU thinking" pulse.** A small indicator during generation
  that reframes E2B's slower first-token as "watch it compute locally" rather than lag.

## Risk gate — the 45-minute spike

Hard time-box. The spike tests **demo quality**, not just "tokens come out." All three
must pass:

1. **It loads** — E2B loads from cache and reaches `ready` on `webgpu`.
2. **It reads well** — the *actual* NPC and biome-lore prompts produce output you would
   put on screen: coherent, in-character, not garbage, not bland.
3. **It's fast enough** — after warm-up, streaming starts in demo-acceptable time
   (target: < ~2s).

**If any criterion fails by minute 45:** flip `InferenceEngine` to `ApiEngine`, keep the
identical game, and drop only the "no server" line. The pivot is defined now, not
discovered at minute 50.

## Demo-day checklist

- Pick the exact browser + profile used on stage (Chrome stable, dedicated profile,
  WebGPU confirmed).
- Warm the model into IndexedDB ahead of time (full download done off-camera).
- Run one inference to JIT the WebGPU pipeline.
- Measure cold-from-cache load time; know the number.
- Rehearse the Network-tab Offline toggle (and wifi kill).
- One full 3-minute run-through end to end.

## Success criteria

- The 3-minute "prove offline first" demo runs end to end without a network call in the
  primary path.
- `LOCAL · GPU` badge is green; NPC dialogue and biome lore stream while offline.
- The worker-reload bug is gone; no OOM or freeze across a full run.
- If the spike fails, the `ApiEngine` fallback delivers the same game with no code churn.

## Notes

- This directory is not currently a git repository, so the design is saved but not
  committed. Initialize git if version history is wanted.
- Companion visual: `~/.agent/diagrams/gemmaquest-plan.html`.
