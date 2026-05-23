# Subagent observations: adaptive-researcher

Date: May 14, 2026

* 🔴 FlowStay is an Elixir project — cannot import Mastra (TypeScript/Node). Mastra API code is reference shape only, not drop-in.
* 🔴 User's mental model of "Observational Memory" (agent emits inline silent notes to chat history) diverges from Mastra's actual OM (background Observer agent compresses at token thresholds). Surfaced this explicitly per advisor guidance.
* 🟡 FlowStay uses: LiveKit cascaded pipeline, MCP tools on Elixir side, 30–40-min calls, Gemini 2.x LLM, prompt caching desired
* 🟡 User is reworking §6 of an architecture doc about memory — replacing server-side "working memory" (set_goal, note_preference, etc.) that breaks prompt cache each turn
* 🟡 Mastra OM: Observer + Reflector background agents, triggered at token thresholds (30k msg tokens, 40k obs tokens), not per-turn
* 🔴 Hard booking state (price ceiling, rejected rooms, dates) must live in canonical booking DB queried via MCP — not in OM stream. OM is chat compression, not system of record.
* ✅ TravelClick iHotelier CRS research complete (2026-05-14) — confirmed: REST+SOAP dual surface, OAuth2 auth, 10-min hold TTL, PCI-direct card model, Shop/Book REST API endpoints
* 🟡 iHotelier hold TTL = 10 minutes (verified from TravelClick docs via search snippet: "reserves the specified roomtype inventory for 10 minutes")
* 🟡 iHotelier Shop REST API staging Swagger: https://api-staging.travelclick.com/swagger-ui/?urls.primaryName=Staging+-+Shop+V1 (requires auth)
* 🟡 iHotelier HTNG SOAP endpoint: https://connect.ihotelier.com/HTNGService/services/HTNG2011BService (BID Number auth)

Date: May 15, 2026

* ✅ LiveKit Agents SDK architecture-doc validation complete (20 claims, 2026-05-15) — current stable is 1.5.9 (released 2026-05-13); doc's "~1.5" reference is correct and current
* 🔴 `MCPToolset` lives in `livekit.agents.mcp`, NOT a standalone `livekit.agents.mcp.MCPToolset` import — import path is `from livekit.agents import Agent, mcp` then `mcp.MCPToolset(...)`. The `mcp_servers` deprecation on both `AgentSession` and `Agent` is confirmed.
* 🟡 `on_user_turn_completed` signature confirmed: `(self, turn_ctx: llm.ChatContext, new_message: llm.ChatMessage) -> None` — doc describes it as `ChatContext`/`ChatMessage`, which is correct; it is an Agent class override (pipeline node), not a session callback
* 🟡 Barge-in is NOT unconditionally on by default — default interruption mode on LiveKit Cloud is "adaptive" (not plain VAD); Silero VAD is still needed but the doc's claim about "Silero VAD + LiveKit turn detection" being the recommended combo is confirmed; interruptions are enabled by default
* 🔴 `Toolset` (capital T) IS a real LiveKit construct in `livekit.agents.llm` (`from livekit.agents.llm import Toolset`) — not just architecture doc terminology
* 🟡 `ToolSearchToolset` and `ToolProxyToolset` confirmed in `livekit.agents.beta.toolsets`; `ToolProxyToolset` is a subclass of `ToolSearchToolset`
* 🟡 Dispatch metadata is available via `job_ctx.job.metadata` (string, read at startup); confirmed read-once pattern — no live-mutation mechanism found in source or docs

Date: May 14, 2026 (debate evidence gathering — build readiness)

* ✅ Architecture doc FOR-readiness evidence gathered (2026-05-14) — confirmed: §13 build order is 11 steps, test harness + observability are step 1, auth step 4; doc's LiveKit API claims all confirmed against livekit-agents 1.5.9 (May 13 2026)
* 🟡 Existing flow app (`flow/elixir/`) has: `VoiceSession` GenServer with OTel spans, `bookings/executor.ex`, `bookings/hold_watchdog.ex`, CRS adapters for TravelClick+Synxis+Inntopia+Windsurfer, `pci/redact.ex`, `demo_hotel_controller.ex`, `payments/` context — substantial prior-art for FlowStay
* 🟡 `demo_hotel_html/galeon.html.heex` exists and matches doc §14 reference to `flow/elixir/lib/flow_stay_web/controllers/demo_hotel_controller.ex`
* 🔴 §12 lists 10 open design gaps (not build gaps): iHotelier PCI handoff decision critical before adapter code; connection/process-crash failure behaviors; session edge cases (2 tabs, abandon after hold). These are NOT in §13 build order — doc is explicit they need design work separately
* 🟡 `flowstay/` directory is empty except docs + CLAUDE.md — no Elixir source yet; the flow app is the prior art, not a dependency

Date: May 14, 2026 (addendum — Elixir ecosystem validation)

* ✅ Elixir ecosystem validation complete (13 claims, 2026-05-14) — all 13 confirmed or nuanced
* ⚠️ Oban claim: doc says "Postgres-backed" — partially correct. Oban v2.22+ supports Postgres, MySQL, AND SQLite3. Postgres is canonical for production/distributed; no Redis support at all.
* ⚠️ WorkOS Elixir SDK is explicitly "experimental" per WorkOS (github.com/workos/workos-elixir). Not recommended for production; may lag API changes. README doc referencing WorkOS should note this caveat.
* ⚠️ Axiom Elixir: no first-party Elixir SDK — works via standard OTLP exporter (opentelemetry_exporter hex package). Axiom accepts OTLP logs/traces/metrics at /v1/* endpoints. Spans confirmed; Elixir side uses community opentelemetry_api/opentelemetry packages.
* 🟡 Oban orphaned jobs (mid-execution at crash) need Lifeline plugin to rescue — they stay in :executing state, not automatically retried without the plugin. Jobs not yet started are safe automatically.

Date: May 14, 2026 (MCP spec validation)

* 🔴 MCP spec (2025-06-18) defines exactly two transports: stdio and Streamable HTTP. Old HTTP+SSE (spec 2024-11-05) is deprecated. No standalone WebSocket. MCPServerHTTP/MCPServerStdio map correctly to these two.
* 🔴 MCP auth spec mandates OAuth 2.1 for HTTP transport (SHOULD). LiveKit `headers` param on MCPServerHTTP is a convenience — passing a static API key in Authorization header works mechanically but is not spec-conformant. Architecture doc claim "headers handle auth" undersells the OAuth 2.1 requirement.
* 🟡 `allowed_tools` on MCPServerHTTP is a LiveKit SDK client-side filter only — SDK fetches full `tools/list` from server, then drops non-listed tools before passing to LLM. Not a protocol primitive; MCP has no per-client ACL.
* 🟡 MCP discovery flow: `initialize` request → server capabilities response → client sends `notifications/initialized` (required handshake step, often omitted in doc descriptions) → `tools/list` → `tools/call`. Correct method name is `tools/list`, not `list_tools`.
* 🟡 `ToolSearchToolset`/`ToolProxyToolset` are LiveKit beta only — no MCP protocol equivalent. ToolProxyToolset keeps 2 fixed tools (cache-stable across turns); preferred for FlowStay's 30-40 min calls with Gemini prompt caching. MCP protocol only has `notifications/tools/list_changed` for dynamic updates (full re-fetch, not on-demand).

Date: May 14, 2026 (addendum — prompt caching validation)

* 🔴 Anthropic cache prefix is a cumulative hash of all content up to and including the cache_control marker. Any change at or before the marker produces a new hash → full cache miss. Content appended AFTER the last marker is not part of the hash → prefix cache survives turns.
* 🔴 Gemini context caching (explicit) works differently from Anthropic: create a CachedContent object, reference it by resource name. Appending content after the reference does not invalidate the cache. Modification to the CachedContent object itself requires delete + recreate (full miss).
* 🔴 Gemini Live API does NOT support explicit context caching — confirmed indirectly: Live API docs never mention it; livekit/agents issue #2359 requesting it was "closed as not planned." Live API uses context window compression (server-side sliding window) instead.
* 🟡 Both providers: cache reads = 10% of base input price (90% discount). Anthropic TTL: 5 min default (1.25x write) or 1 hr (2x write). Gemini TTL: 1 hr default (plus per-hour storage fee).
* 🟡 Mastra OM cache stability claim is architecturally sound: observations block is append-only until Reflector fires at 40k obs tokens → full cache invalidation at that point only. Mastra docs do not claim Anthropic Claude backend compatibility explicitly.
* 🟡 30k/40k Mastra thresholds are conservative for 30-40 min calls vs 1M-token Gemini 2.5/Claude Sonnet 4.6 windows. At ~400 tokens/exchange, Observer fires after ~75 exchanges — well within a single long call.
* ✅ Prompt caching validation complete (2026-05-14) — 8 architecture doc claims assessed; 4 confirmed, 2 partially confirmed, 1 unverifiable (realtime system message injection), 1 nuanced (Mastra multi-backend)

Date: May 14, 2026 (debate evidence — against readiness)

* 🔴 Step-1 requires Session GenServer + observational-memory journal + PubSub, but Step-4 adds the auth model (signed session token + server-side state validation). Every MCP call that lands in Steps 5+ needs the Step-4 auth boundary — so the Step-1 GenServer must be built with placeholder auth hooks or it will need a retrofit that touches all existing tool plumbing.
* 🔴 `update_chat_ctx()` has documented production issues: (a) does not propagate messages to agent in Gemini Realtime model (issue #3386); (b) strips system/developer messages when using google.realtime.RealtimeModel (issue #4497). The observation journal (§6.2) relies on `update_chat_ctx` to persist observations — if this breaks with Gemini, the entire OM architecture fails silently.
* 🔴 Tool-call-result loss during barge-in: documented LiveKit issue #3702 — when a user interrupts during/after tool execution, completed tool calls and results are NOT saved to chat history, causing LLM to re-execute tools on next turn. This hits FlowStay's `add_room_to_cart` / `hold_room` path directly — duplicate hold placements.
* 🔴 `flowstay/elixir/` directory has only `.env.example`, `.env.local`, and `README.md` — NO Elixir source code. The entire Elixir side (GenServer, FSM, MCP server, LiveView, CRS adapters, Oban workers) must be written from scratch. Step 1 of §13 builds a "minimal spine" but that spine has zero prior art in the `flowstay/` repo itself.
* 🟡 iHotelier PCI handoff (§12) is explicitly flagged "critical to resolve before the TravelClick adapter is implemented" — this is Step 8 in §13. The adapter code cannot be written before this decision, but Steps 1–7 don't unblock it. The decision requires legal/contract review of TravelClick terms, not just engineering.
* 🟡 "In-place correction" (§12) — "actually, make it the 14th" — is undesigned. It modifies fields across scene history, must invalidate search results and any active hold, and requires a new FSM pattern not present in the §5.1 state machine diagram.
* 🟡 Barge-in with Gemini TTS is an open question in §13. LiveKit's agent gets wedged after user interruption during `.say(allow_interruptions=False)` calls (issue #1613). The `narrate` tool uses `session.say()` — if the guest barges in during a `narrate` call with a hold target, the spotlight and speech can desync regardless of the "highlight before speak" ordering guarantee.
* 🟡 Guest identity tiers (§12) deferred — anonymous vs. loyalty vs. login — but `guest.email` and `guest.phone` are in the §10 data model. If a loyalty guest authenticates mid-call, the data model changes under the running GenServer. No migration path designed.
* 🟡 Existing flow app has VoiceSession GenServer, CRS adapters, booking executor with hold watchdog, PCI redaction, demo controller — substantial prior art. FlowStay is a rewrite, not a lift. The prior app's scene system (scenes/*.ex) is a different architecture than the declarative §3.2 scene-definition approach.

Date: May 14, 2026 (payment/PCI validation)

* 🔴 iHotelier does NOT accept processor tokens as a token consumer — it is a PCI-direct CRS that accepts raw card data inside its own scope. Doc claim "CRS accepts tokenized payment" is WRONG for iHotelier. FlowStay needs a proxy-detokenization layer or to route capture through iHotelier's own gateway.
* 🔴 PCI DSS v4.0.1 (effective April 2025) added script-protection requirement (Reqs 6.4.3, 11.6.1) to SAQ-A. Hosted iframe merchants must get written confirmation from their TPSP that the embedded solution protects against script attacks, or implement controls themselves. This may change SAQ eligibility.
* 🟡 3DS 1.0 sunset: October 15, 2022 (Visa, MC, others). EMV 3DS 2.2.0 is current. Desktop UX is modal/overlay (no redirect). Frictionless flow skips user interaction when risk score is favorable. SCA/PSD2 is EEA-specific.
* 🟡 Stripe auth-then-capture (capture_method=manual): 7-day hold window for online card-not-present (Visa/MC/Amex/Discover). Void releases hold with no money movement; refund required only after capture/settlement.
* 🟡 Idempotency windows: Stripe 24h, Adyen minimum 7 days. Both use stored first-response pattern for safe retry.
* ❓ 60s auth→CRS timeout: no industry standard. Defensible given 10-min iHotelier hold TTL and 7-day card auth window. CyberSource documents 60s API timeout limit (platform constraint, not a standard).
* 🟡 Saga on Oban: `Sage` library (github.com/Nebo15/sage) is the canonical Elixir saga implementation — dependency-free, compensation steps, exactly the FlowStay use case. Oban + Sage is a legitimate combo for 3-4 step sagas. Temporal/Step Functions preferred for long-running (weeks/months) or multi-service sagas.

Date: May 14, 2026 (WorkOS auth research)

* 🔴 WorkOS Elixir SDK is explicitly "experimental" — confirmed from prior research. For FlowStay's Elixir backend, WorkOS REST API must be called directly (no production-ready SDK).
* 🔴 WorkOS phone OTP exists ONLY as MFA (second factor), NOT as primary identity. No SMS-as-primary-login. Guest phone-number auth at call time is NOT a WorkOS use case — store guests in application DB with phone as lookup key, not in WorkOS.
* 🔴 WorkOS has NO built-in "super-admin with cross-org access" concept. Impersonation (workos.com/docs/authkit/impersonation) is the closest: WorkOS Dashboard admin impersonates a specific user in a specific org, 60-min session, `act` claim in JWT. For FlowStay system admin needing live cross-org access, this must be layered in application code (e.g., separate org for internal staff + custom role check in middleware).
* 🟡 WorkOS JWT claims on access token: `sub` (user ID), `sid` (session ID), `org_id`, `role`, `permissions` slugs, standard exp. JWKS endpoint: `https://api.workos.com/sso/jwks/<clientId>`. Org switching via refresh token endpoint with `organization_id` param — new token has correct `org_id`/`role`/`permissions`.
* 🟡 WorkOS RBAC: environment-level roles + org-scoped custom roles (auto-prefixed `org:`). Roles embedded in JWT. Permission slugs in JWT capped at 4KB cookie limit — keep permissions list lean.
* 🟡 WorkOS pricing (2026): User Management free up to 1M MAUs (sign-in, sign-up, or profile update in calendar month). $2,500/month per additional million. NO separate workforce vs consumer pricing tier — same MAU model for all user types. SSO/SAML connections billed per connection (not per user).
* 🟡 AuthKit for Next.js: `@workos-inc/authkit-nextjs` package — server-side + client-side utilities, HTTP-only cookies, middleware-based route protection, App Router native. Hosted UI (redirect to WorkOS) vs custom UI (API direct). Hosted UI is recommended path — gets SSO redirect detection, bot detection, MFA, identity linking for free.
* 🟡 Per-org SSO: each WorkOS org gets its own SAML/OIDC connection configured via Admin Portal (self-serve by customer IT admin) or API. AuthKit auto-detects SSO and redirects to correct IdP. Supports SAML + OIDC protocols.
* 🟡 Magic Auth (passwordless): email OTP only — 6-digit code, 10-minute expiry. No phone/SMS magic link. Social logins (Google, Microsoft, GitHub) via OAuth. Passkeys also supported per overview docs.

Date: May 15, 2026 (thariqs/html-effectiveness research)

* ✅ html-effectiveness repo fully read (2026-05-15) — 20 standalone HTML files, 242 stars, no license declared (no license = all rights reserved; patterns safe to adapt as inspiration, not as copy-paste)
* 🟡 Universal palette across ALL 20 demos: `--ivory #FAF9F5`, `--slate #141413`, `--clay #D97757`, `--clay-d #B85C3E`, `--oat #E3DACC`, `--olive #788C5D`, gray scale `#F0EEE6`→`#3D3D3A`. Zero external font loading — pure system stacks (ui-serif/Georgia, system-ui, ui-monospace).
* 🟡 Index page TOC: `<nav class="toc">` with pill-style anchor links (`border-radius: 999px`), count badges in `<span class="n">`, `scroll-margin-top: 28px` on sections, `scroll-behavior: smooth` on html. Cards in CSS Grid `repeat(auto-fill, minmax(316px, 1fr))`. No sticky sidebar — top nav only.
* 🟡 Feature explainer (14-research-feature-explainer.html): 200px sticky left sidebar TOC with nested L1/L2 links; `<details>/<summary>` for collapsible steps; `data-tabs`/`data-t` for tab panels; `.callout`, `.tldr`, `.eyebrow` utility classes. ~377 lines total (145 HTML / 220 CSS / 12 JS).
* 🔴 No license in html-effectiveness repo — `license: null` confirmed via GitHub API. Adapt patterns as inspiration; do not wholesale copy source files into the skill's snippet library.
* 🔴 SVG colors in html-effectiveness use hardcoded hex (#D97757, #87867F etc.) NOT CSS var() in presentation attributes — var() fails in SVG attrs cross-browser. CSS class-based styling via embedded `<style>` inside SVG CAN use var(); mixed approach is the pattern.
* 🟡 Arrowhead pattern (all SVGs): `<marker viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">` + `<path d="M0,0 L10,5 L0,10 z">`. Multiple named markers for edge color variants (gray/clay/olive/rust).
* 🟡 Solid lines = sync request path; dashed lines (stroke-dasharray="4 4" or "5 4") = async/event/retry path. Consistent across demos 10, 13, 16. Documented in demo 16 caption.
* 🟡 Decision gate diamonds: `<path d="Mx,y1 Lx2,y2 Lx,y3 Lx3,y2 Z">` — four L-commands rhombus, NOT `<polygon>` or rotated `<rect>`. Terminal nodes use rx="22" (pill), standard boxes rx="10", diamonds rx=0.
* 🟡 Completed snippet catalog: 23 entries across 5 categories; primary sources fetched from github.com/thariqs/html-effectiveness raw files.

Date: May 21, 2026

* 🔴 RM-STANDARD nightly rate mismatch: wiki test plan says $145, code (reserv_hotel.ex:95) charges $165. RM-KITCHENETTE is also $165 — test plan lists $165 for kitchenette but $145 for standard. The test suite asserts $165 indirectly (tests RM-DELUXE math exactly; standard/kitchenette not dollar-asserted), so tests pass despite wiki discrepancy.
* 🔴 §7 Inventory Holds is 0/65 shipped (only section at 0%) — hold WatchDog, heartbeat extension, and re-verify-availability logic are entirely unimplemented in the app; reserv_hotel.ex creates hold structs locally but nothing persists or enforces TTL against the DB.
* 🟡 §5 Room Booking FSM: 50/105 shipped. All 8 FSM-graph claims (§5.1-001 through §5.1-008) are marked ✅ Shipped M3. Widget scenes hub→searching→results_index→room_details→compare_rooms→cart→checkout→confirmation all render in widget_live.ex.
* 🟡 Launch gap audit is production-readiness checklist (credential swaps), NOT a feature-gap list. 5 sections: TravelClick adapter swap, Stripe live keys, LiveKit cluster, WorkOS org, Oban Postgres engine. All marked ✅ (steps to do, not done).
* 🟡 Cofresi seed: slug=villa-cofresi, org=villa-cofresi-org, crs_adapter=Elixir.Flowstay.CRS.ReservHotel, code=1990, demo_enabled=true. Demo page (show.html.heex) reads property.slug dynamically — no hardcoded slug logic except Cofresi-specific copy.
* ✅ Cofresi status report delivered; 10-test suite verified against reserv_hotel_test.exs structure; confirmed doc-vs-code rate drift found.
* ✅ §7 landscape audit complete (2026-05-21): 65 commitments confirmed in catalog (§7.0:2 §7.1:14 §7.2:5 §7.3:13 §7.4:31); 30 feature scenarios across invariants.feature + journeys.feature; 9 scenarios @stubbed; Oban NOT in application.ex (no supervisor child); InventoryHold schema exists (migration 20260516000003); no holds context module, no hold workers; bookings/executor_bridge_test.exs exists; booking_sequence_test.exs exists.
* 🔴 Oban is NOT wired into Flowstay.Application — it is absent from the supervisor children list. The §7.2 durability requirement (Oban jobs for warn/expiry) cannot function until Oban is added to application.ex and config. This is the single highest-leverage blocker.
* 🟡 reserv_hotel.ex create_hold/extend_hold/release_hold are fully in-memory stubs: create_hold generates a local hold_id + 15-min expires_at but writes nothing to DB; extend_hold returns new expires_at with no DB update; release_hold returns :ok with no side effects. None touch Flowstay.InventoryHold schema.
* 🟡 §7 test file coverage: all @requires files for §7 invariants/journeys exist on disk EXCEPT app/test/flowstay/runtime_pins_test.exs (needs verification) — booking_sequence_test.exs, oban_test.exs, saga_test.exs, canonical_state_test.exs, session_versioning_test.exs, session_navigation_test.exs, adapter_test.exs, travel_click_test.exs, executor_test.exs, executor_bridge_test.exs all confirmed present.

Date: May 23, 2026 (RQ1 — ibe5_finalize.confirm wizard-walk vs cold POST)

* 🔴 RQ1 verdict: UNKNOWN — wizard-walk requirement is explicitly flagged as unresolved in recon round 3 "Unanswered questions" section (section-7-implementation.html ~line 1027). Both round 3 and the adapter-implementation plan (line 287) call it out as the top Phase D empirical question. No prior probe confirmed cold-POST acceptance.
* 🟡 Key structural evidence for "wizard-walk likely required": (1) session token `s=289346122` is minted by the server at ibe5.main Step 1, carried as URL param through all 5 steps, and appears in all 71 hidden form fields; (2) `makeReserv()` JS populates `room` + `rate` + `CCtype` fields immediately before submit — confirming server sees these from the form body, not from a prior GET response embedded in the page's server-side session. The `s=` token is the only candidate for server-side state.
* 🟡 Key structural evidence against wizard-walk being mandatory: (1) all booking-critical fields are in the form body (none appear to be server-assigned to the form server-side during GETs); (2) `ibe5.get_xml_data` is fully stateless; (3) the IBE shows no CSRF token in the form dump (checkout-form-inputs.json confirms no `_csrf_token` or equivalent named field); (4) architecture is OracleAS/mod_plsql-era — classic stateless web tier.
* 🔴 The `fastlink2_checkcc` question is also unresolved: if it returns a token that `ibe5_finalize.confirm` validates server-side, cold POST fails regardless of session. Form dump shows no field named like a CC token — but the server could check it against the `s=` session state.
* ✅ Web search for public IBE5 integrations returned zero hits — no open-source adapters or writeups exist. Evidence base is 100% internal recon.

Date: May 23, 2026 (RQ3 — request fingerprinting)

* 🔴 Cloudflare is the CDN/WAF for reservhotel.com — confirmed by `server: cloudflare` + `cf-ray` headers and IPs 104.18.18/19.138 (Cloudflare AS13335). Bot Management is active (CF challenge platform script injected passively into all responses).
* 🟡 CF challenge mode is PASSIVE (bot telemetry beacon), NOT an active interstitial. Both no-UA curl and browser UA get HTTP 200 + full 133KB page. The CF script fires client-side post-load to score the session but does NOT gate the server response. Verdict: Cloudflare Bot Management Free/Pro tier, not Enterprise with JS challenge blocking.
* 🟡 XML endpoint (`POST ibe5.get_xml_data`) has NO bot detection at all — returns 200 + valid XML with no UA. 5 rapid fire calls all 200 at ~180ms. No rate limit observed.
* 🟡 HTML endpoints (`GET ibe5.main`, `GET ibe5_rooms_multiroom.main`) also return 200 with no UA. Response body is identical (133KB) regardless of UA. WAF blocks are only on non-IBE paths (`api.reservhotel.com`, `/rsvhotel/*`).
* 🔴 No JA3/TLS fingerprinting gate observed at any IBE endpoint — curl's TLS profile is materially different from a browser's and still gets full responses. A residential proxy is NOT needed for the IBE paths.
* ✅ RQ3 verdict confirmed (2026-05-23): LAX. Standard Req client with a realistic browser UA is sufficient. No residential proxy, no cookie jar seeding, no JS execution required for `ibe5.get_xml_data` or the main IBE wizard pages.

Date: May 23, 2026 (RQ2 — S= session token TTL)

* 🔴 ReservHotel IBE is built on Oracle APEX/mod_plsql — confirmed by `/win/owa/` URL path (Oracle HTTP Server DAD path). The `S=` numeric token IS the Oracle APEX session ID, not a custom application token.
* 🟡 Oracle APEX session timeout defaults: Maximum Session Idle Time = 1 hour (3600s) at instance level; application-level settings override instance defaults; mod_plsql connection pool idle cleanup = 15 min (PlsqlIdleSessionCleanupInterval). IBE application may override to shorter value (common for hospitality IBEs — 15-30 min is the industry guidance for low-risk public apps).
* 🔴 No vendor documentation is publicly available for ReservHotel's specific idle timeout configuration. The 1-hour APEX default is the best baseline but not confirmed for this deployment. TTL is empirically unverified.
* 🟡 Pooling implication: per-booking fresh session is the only safe default. APEX sessions carry server-side page state across steps; if a pooled session has prior room/date state from a different guest's booking it may corrupt step 2-4 responses. Even if TTL allows reuse, state isolation argues against pooling.
* ✅ RQ2 research complete (2026-05-23) — verdict: "1 hour default, likely shorter; fresh per booking is the safe recommendation."

Date: May 23, 2026 (RQ4 — fastlink2_checkcc mandatory vs UX-only)

* ✅ RQ4 verdict: UX-ONLY (high confidence from JS source, unconfirmed server-side) — `fastlink2_checkcc` returns a plain-text string starting with "1" (valid) or "0" (invalid); no token field. `makeReserv(response)` populates room code, rate code, CCtype, and preference comments (smoking/king/handicap) — all derived from local form state, NOT from the checkcc response string. The response argument is used only for the binary 1/0 gate, not as a value injected into any form field.
* 🔴 Server-side caveat remains: the IBE server could check whether checkcc was called against the `s=` session token before accepting confirm. No recon round tested this. The 106-input form dump shows NO field named like a CC-validation token (no `cc_auth`, `preauth_code`, `gateway_ref`, etc.) — which strongly argues the checkcc response string carries no token the server expects back.
* 🟡 Recommendation locked: skip checkcc in Phase D for the demo adapter; add it later if live testing shows confirm rejects without prior checkcc call. The endpoint's adapter-mapping table already labels it "optional — UX" in section-7-implementation.html line 989.

Date: May 23, 2026 (RQ6 — ReservHotel test BIN / sandbox routing)

* 🔴 ReservHotel HAS a test card mechanism: "Test Credit Card Generator" in hotel extranet (Booking Engine tab → Credit Card Generator → Generate). Cards are dynamically issued, expire quickly. Access is login-gated — hotel extranet credentials required, not public.
* 🔴 ReservHotel's 8 supported gateways: PayPal, Net Element, Authorize.Net, USAePay, GlobalCollect, Shift4, CyberSource, Stripe. Which Villa Cofresi (hotel=1990) uses is NOT publicly discoverable — not in IBE JS, not on villacofresi.com. Must be determined empirically or via direct inquiry.
* 🔴 4242 4242 4242 4242 is Stripe's proprietary test BIN — not universal. Will route to real processor as normal Visa BIN unless Stripe is active gateway AND merchant is in test mode. Do NOT submit against live Cofresi IBE without confirming gateway identity.
* 🟡 Authorize.Net canonical Visa test card: 4111 1111 1111 1111 (CVV 900, any future expiry). Works only when merchant account is in sandbox/test mode. Only relevant if Cofresi uses Authorize.Net.
* 🟡 xDebug= param in ibe5.get_xml_data (availability only, line 1074 recon doc) — no test-mode param observed on fastlink2_checkcc or ibe5_finalize.confirm.
* ✅ RQ6 verdict: PARTIALLY RESOLVED — test card mechanism confirmed to exist (extranet generator) but gateway identity for Cofresi unknown → sandbox routing unconfirmable without hotel credentials or direct inquiry.

Date: May 23, 2026 (RQ5 — ibe5_finalize.confirm response format)

* 🔴 ibe5_finalize.confirm response is a NATIVE BROWSER REDIRECT (not AJAX, not JSON). The booking AJAX chain (validateReservation → ibe5_check_availability → fastlink2_checkcc → makeReserv) ends with `$("#checkout").attr("onsubmit",""); $("#checkout").submit()` — a native HTML form POST to ibe5_finalize.confirm. Browser follows the 302/response directly. No JS intercepts the server response.
* 🔴 Post-confirmation landing page is `ibe5_ext.check_itin` NOT `ibe5_confirmation.main`. Confirmed from live Akumal itinerary URL: `ibe5_ext.check_itin?lang=1&conf=D63161&hotel=34131&lastname=LEWIS`. The confirmation number is in the `conf=` query param.
* 🟡 Confirmation number format observed: alphanumeric, letter-prefix + 5 digits (e.g., `D63161`). Extraction regex for Floki parse of redirect URL or Location header: `conf=([A-Z]\d+)` or `conf=([A-Z0-9]+)`.
* 🟡 fastlink2_checkcc response codes: starts with "1" = card valid (proceed to form submit); contains "0" = card invalid ("Please check your credit card numbers and try again."); other string = server error message (displayed literally via `showMessage(creditValid)`).
* 🟡 ibe5_check_availability response codes: "0" = unavailable/price changed (error); "2" = redirect to calendar; anything else = available (proceed to checkcc).
* 🟡 The checkout form id="checkout" POSTs to `https://www.reservhotel.com/win/owa/ibe5_finalize.confirm` with no `target` attribute (default _self). HTTPoison must follow the redirect (HTTPoison follow_redirect: true) and check the final URL for `conf=` param.
* ✅ RQ5 empirically resolved via live browser walk of Hedonism II IBE (hotel=10419) + Akumal confirmation URL observation (2026-05-23).

Date: May 23, 2026 (RC1 — room code convention for Phase C)

* 🔴 RC1 verdict: use IBE vendor codes verbatim (e.g. `A1K`) as `room_id` / `room_external_id`. Three hard dependencies: (1) idempotency key is `call_id:scene_vN:room_id` (session.ex:45) — must be deterministic without a mapping layer; (2) `find_offer` does string equality on `room_id` (mcp_runtime.ex:173) — must match what parser emitted; (3) Phase D `ibe5_finalize.confirm` form needs `room=<IBE code>` (section-7-implementation.html:799).
* 🟡 Current in-memory stub stores `RM-KITCHENETTE` in both `room_id` and `vendor_extras["reservhotel_room_code"]` (reserv_hotel.ex:315,331) — Phase C replaces this with real IBE codes; stub divergence is known and expected.
* ✅ RC1 analysis written to .scratch/phase-c-research/rc1-room-codes-claude.md (2026-05-23).

Date: May 23, 2026 (RC2 — fixture sanitization for Phase C)

* 🔴 RC2 verdict: NO `test/fixtures/` directory. Project convention (confirmed session_test.exs, http_client_test.exs) is inline `@module_attribute` HTML strings. Phase C parser test should embed extracted rooms-page fragment as `@attribute` in a new `parser_test.exs`, NOT a committed `.html` file.
* 🟡 Scrub MUST items for rooms-page fixture: APEX `S=` token (`grep -oE 'S=[0-9]{6,12}'`), cf-ray headers (header dumps only, not in HTML body), `transid`/`member_id`/`crm_id` if non-empty (all empty in checkout form dump — verify in rooms fixture), `r=` referrer field (blank it regardless).
* 🟡 Do NOT scrub: `hotel=1990` (public), room codes (parser targets), prices (test data — annotate staleness with inline comment `<!-- FIXTURE CAPTURED 2026-05-23 -->`), rate codes.
* 🔴 Phase C rooms page (`ibe5_rooms_multiroom.main` Step 2) has NO PII — guest data not submitted until Step 4+. Confirmed by checkout form dump: `fname/lname/email/phone/street` all `""` at checkout load (even later). No PII scrub needed for Phase C.
* 🟡 Edge cases requiring manual eye: HTML comments (`<!-- DAD: ... -->` APEX debug output may embed session IDs); JS `var` initializations (`var sessionId = "289346122"` — grep: `grep -En '"[0-9]{8,12}"'`).
* 🟡 Verification one-liner: `grep -En 'S=[0-9]{6,12}|cf-ray|set-cookie|clarity\.ms|termly\.io|member_id=[^&"]{1,}|crm_id=[^&"]{1,}|transid=[^&"]{1,}' <file>` — must return zero lines.
* ✅ RC2 analysis written to .scratch/phase-c-research/rc2-fixture-sanitization-claude.md (2026-05-23).
* 🔴 RC3 test-stance: the `1 excluded` test is `@moduletag :real_models` in worker_harness_e2e_test.exs — env-var-gated via test_helper.exs (exclude when GOOGLE_API_KEY absent/stubbed). New live test MUST mirror this idiom with `RESERVHOTEL_LIVE` env var, not a bare `@tag :live` with `--include`.
* 🔴 Assertion-shape discipline: value-tight assertions (price=$185, count=5) belong in fixture test ONLY. Live integration test asserts structure-only (length >= 1, total > 0, contract fields non-nil). Seasonal price drift + sellouts make value-tight live assertions flaky.
* 🟡 Triage rule for live test failure: NEVER retry. Decision tree: (1) IBE down? → incident log. (2) length==0? → re-capture fixture, diff HTML. (3) field missing? → parser update needed. "Re-run to see if passes" is the antipattern.
* ✅ RC3 analysis written to .scratch/phase-c-research/rc3-test-stance-claude.md (2026-05-23).
* 🔴 Phase C endpoint correction: `GET ibe5_rooms_multiroom.main` is a browser shell only — room data loads via AJAX `POST ibe5_rooms_v55`. Phase C parser must target `ibe5_rooms_v55`, not the GET endpoint. Plan doc is wrong on this point.
* 🔴 selectRate() JS param naming is inverted: param[4] labeled "tax" in function signature is actually pre-tax subtotal; param[5] labeled "subtotal" is the tax amount. The sidebar CSS classes confirm: `.taxes` div shows pre-tax room cost, `.subtotal` div shows tax amount.
* 🟡 All 8 extractable fields for Phase C use structured selectors or onclick attrs — NO prose heuristics needed. Key selectors: `div[id^="roomdet"]` (rooms), `li[rate-code]` (rate plans), `p.freecancel[nights]` (cancellation days), `span.fromprice{room_code}` (nightly rate), button onclick for total/deposit/tax.
* 🟡 Inventory: `span.roomsleft` text → `~r/Only (\d+) Room/` — present for all 8 rooms in live response.
* 🟡 Rate code is numeric integer string "22" (not mnemonic "BAR"). Deposit kind is effectively `:fixed` (97% of total, not first-night). Tax rate confirmed 9% (Puerto Rico occupancy tax) by division of live amounts.
* ✅ RC4 analysis written to .scratch/phase-c-research/rc4-rate-plan-parsing-claude.md (2026-05-23).
