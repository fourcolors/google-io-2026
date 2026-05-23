---
name: codex-audit-findings
description: Patterns Codex (gpt-5.5) catches well vs. misses in adversarial Elixir code audits
metadata:
  type: feedback
---

Observed in B.3 audit (2026-05-23, reservhotel-phase-b):

**Codex catches well:**
- Primary-source vs implementation divergence (e.g., memory says "prefer last populated"; impl uses List.first — Codex flagged this as a FAIL while Claude PASSed it)
- Test enforcement gaps: source-grep regexes that don't cover all the cases the test comment claims (e.g., missing `GenServer.start_link/3` coverage)
- Exact-match filter gaps (empty string vs whitespace-only) — converged with Claude and Gemini on this

**Codex is appropriately adversarial on:**
- Axis 4 (Smart / discipline tests): more likely to FAIL when a test comment overclaims its coverage than Claude, which tends to give "defense in depth" credit
- Axis 6 (primary source divergence): sharp at catching first/last ordering mismatches against documented recon

**Codex may over-flag:**
- Dead code claims (e.g., `is_binary` guard) — Codex nuanced this correctly (PASS with nuance) but Gemini failed it; worth watching on future audits

**Divergence pattern (B.3):** Codex FAIL, Gemini FAIL, Claude PASS. Claude tends to be more generous on Axis 4 (discipline tests). Codex + Gemini convergence on overall FAIL with Claude PASS is a signal worth surfacing to lead as "2-of-3 FAIL."

**How to apply:** when Codex and Claude diverge on PASS/FAIL for a single axis, treat it as a finding worth escalating — the divergence itself is signal. Don't average out; surface both verdicts.
