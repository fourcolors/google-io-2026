---
name: claude-session-analytics
description: Claude Code dev-session analytics for THIS repo — DuckDB views over the native session JSONL logs at `~/.claude/projects/<project>/*.jsonl`. Tracks token spend, tool calls, skill activations, sessions, cache efficiency. Use when answering "how much did today cost?", "what tools am I using most?", "show me my last 5 sessions", "which sessions burned the most tokens?".
allowed-tools: Bash, Read
user-invocable: false
---

# claude-session-analytics

Analytics over the user's Claude Code session activity in the current repo. The data source is Claude Code's own per-session NDJSON logs at `~/.claude/projects/<project-hash>/*.jsonl` — the same files that power session resume. Each session is one file; each line is one record (`user`, `assistant`, `system`, etc.).

DuckDB reads the JSONL directly via `read_json_auto`; views are defined in `state.sql`. **No OTel collector, no persistent DB file, no extension dependencies** — just `duckdb` (already installed) and the JSONL files (always present).

## How to query

**Named query** (from `references/queries.md`):
```bash
bash .claude/skills/claude-session-analytics/scripts/run-query.sh "<sql>"
```

**Ad-hoc / NL question:** defer to `/duckdb-skills:query "<question>"`. Point it at `state.sql` for view definitions.

**CSV output:** prefix with `CC_FMT=csv`.

The script:
1. Resolves the project's Claude Code dir from `$PWD` (replace `/` and `_` with `-`).
2. Exports `CC_JSONL_GLOB` pointing at that dir's `*.jsonl`.
3. Runs `duckdb -init state.sql -c "$1"`.

## Reference files

- `state.sql` — view DDL (`raw`, `events`, `tool_uses`, `model_prices`, `sessions`). The schema contract.
- `references/schemas.md` — column-by-column docs for the views.
- `references/queries.md` — 9 named queries (daily spend, tools, top sessions, skills, MCP, hooks, cache, transcript walk, recent sessions).
- `scripts/test.sh` — functional smoke test. Exits 0 when all 5 views are queryable and all 9 named queries run cleanly. Run before reporting "the skill is broken."

## Coverage notes

The JSONL is **richer** than the previous OTel pipeline in most ways:
- User prompts are NOT redacted (OTel redacted them).
- Tool inputs are fully available, including MCP tools (`mcp__server__tool`).
- `cwd`, `gitBranch`, `cc_version` per record — useful for cross-branch / cross-version analysis.

But it's **missing** a few harness-level events:
- Compaction events (lifecycle, not in transcript).
- Tool accept/reject decisions.
- MCP server *connection* events (per-tool calls are available; per-connection is not).
- All hook types except `stop_hook_summary` (which appears as `system.subtype`).

Don't promise queries for the missing events.

## Output style

- Lead with the data, not preamble.
- Costs to 4 decimal places (USD), tokens with commas, durations as `Xm Ys`.
- Session lists include: `started_at`, `duration`, `tokens`, `cost_usd`, `prompts`, `tools`.
- Memory entries: state the rule/fact first, then **Why:** + **How to apply:** lines.
- Terse. The user can read query output — don't narrate the obvious.

## Self-update

When a question is asked twice, add it to `references/queries.md`. When the JSONL schema changes (new record `type`, new `subtype`, new `message.usage` field), update `state.sql` and `references/schemas.md` together. When Anthropic ships new model prices, update the `model_prices` VALUES list in `state.sql`.
