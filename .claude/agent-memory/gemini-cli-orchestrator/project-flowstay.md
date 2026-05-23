---
name: project-flowstay
description: FlowStay project context and history of Gemini review delegations
metadata:
  type: project
---

# FlowStay Project

## Overview
Voice-driven hotel booking widget. iFrame embeds on hotel sites; LiveKit voice agent drives booking via MCP tools on Elixir backend. CTO (Sterling Cobb) is treating this as a viable execution target.

## Architecture doc location
`/Users/fourcolors/Projects/1_active/flow-industry/flowstay/docs/architecture.html`
Content is markdown embedded in a `<script type="text/markdown" id="md-source">` tag (~134KB).

## Review delegations

### 2026-05-14: Architecture doc technical review
- **Model:** gemini-2.5-pro
- **Task:** Independent technical review before execution commit
- **Raw output:** `/tmp/gemini-review-raw-output.txt`
- **Key findings:**
  - Deepgram model choice not specified (Nova vs. Flux matters for conversational agents)
  - Saga trigger order questionable (CRS confirm should precede payment auth, not follow it)
  - `narrate` tool serializes MCP + TTS; latency gap flagged
  - Missing: CRS data normalization contract (biggest structural gap)
  - Missing: multi-tenancy isolation design
  - Missing: secret management discussion
  - iHotelier PCI incompatibility with hosted-token flow correctly flagged by doc; Gemini agrees it's the #1 risk
- **Gemini verdict:** Not good-enough-to-execute; two critical unresolved dependencies block build

### 2026-05-14: Architecture doc re-review (post-edit pass)
- **Model:** gemini-2.5-pro
- **Task:** Verify two critical gaps closed + new §8.1, §8.6, §10.1 coherence
- **Raw output:** `/tmp/gemini-rereview-raw.txt`
- **Synthesis doc:** `/Users/fourcolors/Projects/1_active/flow-industry/flowstay/.scratch/architecture-review-synthesis.md`
- **Gap closure verdict:**
  - iHotelier PCI handoff: CLOSED — §8.1 + §8.6 fully specify two-phase payment and CRS-as-processor path
  - CRS normalization struct: CLOSED — §10.1 has 8 nested Elixir structs, minimum adapter contract, Deferred sub-section
- **Remaining flags (4 items, none blocking):**
  1. No observability/alerting on `pending_push` table rows
  2. PII surface of `customize_experience` tool response not explicitly excluded from logs/traces
  3. No CI contract testing between Elixir-generated PromptBundle and Python worker expectation
  4. Dev panel gated only by `dev_panel: true` embed flag — needs WorkOS auth
- **Gemini verdict:** EXECUTION-READY. Second-order refinements remain but no architectural blockers.

**Why:** Mr. Cobb wants to verify edits landed before committing to build. Execution-ready verdict means team can build against the doc.
**How to apply:** Both critical Gemini-flagged gaps are now closed. Future reviews of this doc should focus on Tier 2/3 items from synthesis doc (reconnect state machine, barge-in policy, etc.).

### 2026-05-23: B.3 ping-pong audit — Session S= token parser
- **Model:** gemini-2.5-pro (CLI 0.42.0)
- **Task:** Independent cross-model audit of `Flowstay.CRS.ReservHotel.Session` (APEX S= token parser from ibe5.main HTML body)
- **Raw output:** `/tmp/gemini-b3-raw-output.txt`
- **Written audit:** `/Users/fourcolors/Projects/1_active/flow-industry/flowstay/.claude/ping-pong/reservhotel-phase-b/2/gemini_audit.md`
- **Gemini verdict:** FAIL (3 axes failed: Right, Smart, Extra mile)
- **Key findings:**
  - Axis 3 (Right) FAIL: `Enum.reject(&(&1 == ""))` doesn't filter whitespace-only values; CSS `[name="S"]` is case-sensitive and won't match `name="s"`
  - Axis 4 (Smart) FAIL: `_ -> {:error, :session_mint_failed}` catch-all swallows diagnostic context
  - Axis 5 (Extra mile) FAIL: `is_binary(html)` guard is redundant — `with` clause already guarantees binary
- **Claude verdict:** PASS (all 5 axes PASS; flagged same whitespace edge case as an observation, not a FAIL)
- **Divergence:** Gemini ruled harder on axes 4 and 5 — rated the error-swallowing and guard redundancy as outright FAILs; Claude rated them as defensible tradeoffs. Consensus on whitespace-only finding. Claude's "prefer last" memory note was unique to Claude.
- **Invocation pattern:** `gemini -m gemini-2.5-pro -p "$(cat /tmp/prompt.txt)" --yolo`

### 2026-05-23: RC1 Phase C — room ID strategy cross-model audit
- **Model:** gemini-2.5-pro
- **Task:** Independent second opinion on whether Phase C `search_rooms/1` should use IBE codes verbatim (a), map to FlowStay stable IDs (b), or hybrid (c)
- **Raw output:** `/tmp/gemini-rc1-raw.txt`
- **Written verdict:** `/Users/fourcolors/Projects/1_active/flow-industry/flowstay/.scratch/phase-c-research/rc1-room-codes-gemini.md`
- **Gemini verdict:** **(b) — Map IBE codes → FlowStay stable IDs**
- **Key rationale:** Idempotency stability (vendor rename → duplicate hold → double charge is the killer case); namespace collision prevention for multi-vendor future; pattern already partly established via `vendor_extras["reservhotel_room_code"]`
- **Risk flagged:** Mapping maintenance — stale config causes lost revenue until fixed
- **Invocation pattern:** `gemini -m gemini-2.5-pro -p "$(cat /tmp/rc1-gemini-prompt.txt)" --yolo`
