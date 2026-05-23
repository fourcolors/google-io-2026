# Named Query Catalog

Curated queries against the views defined in `../state.sql` (`events`, `tool_uses`, `sessions`, `model_prices`). For anything outside this catalog, use `/duckdb-skills:query "<question>"`.

Run via:
```bash
bash .claude/skills/claude-session-analytics/scripts/run-query.sh "<sql>"
```

## 1. Daily spend & session count (last 7 days)

```sql
SELECT
  date_trunc('day', started_at)   AS day,
  count(DISTINCT session_id)      AS sessions,
  round(sum(total_cost_usd), 4)   AS usd,
  sum(total_tokens)::bigint       AS tokens
FROM sessions
GROUP BY 1 ORDER BY 1 DESC LIMIT 7;
```

## 2. Most-used tools this week

```sql
SELECT
  tool_name,
  count(*)                   AS calls,
  count(DISTINCT session_id) AS sessions
FROM tool_uses
WHERE ts >= CURRENT_TIMESTAMP - INTERVAL '7 days'
GROUP BY 1 ORDER BY 2 DESC LIMIT 15;
```

## 3a. Top sessions by cost

```sql
SELECT
  session_id,
  started_at,
  round(duration_seconds/60.0, 1) AS minutes,
  total_tokens,
  round(total_cost_usd, 4)        AS usd,
  prompt_count,
  tool_count,
  model
FROM sessions
ORDER BY total_cost_usd DESC LIMIT 10;
```

## 3b. Longest sessions by wall time

```sql
SELECT
  session_id,
  started_at,
  round(duration_seconds/60.0, 1) AS minutes,
  prompt_count,
  tool_count,
  total_tokens,
  round(total_cost_usd, 4)        AS usd
FROM sessions
ORDER BY duration_seconds DESC LIMIT 10;
```

## 4. Skill invocations (Skill tool calls)

```sql
SELECT
  json_extract_string(je.value, '$.input.skill') AS skill,
  count(*)                                       AS calls,
  count(DISTINCT e.session_id)                   AS sessions
FROM events e,
     json_each(e.message.content) AS je
WHERE e.type = 'assistant'
  AND json_extract_string(je.value, '$.type') = 'tool_use'
  AND json_extract_string(je.value, '$.name') = 'Skill'
GROUP BY 1 ORDER BY 2 DESC;
```

## 5. MCP tool usage (per server / per tool)

```sql
SELECT
  split_part(tool_name, '__', 2) AS mcp_server,
  split_part(tool_name, '__', 3) AS tool,
  count(*)                       AS calls,
  count(DISTINCT session_id)     AS sessions
FROM tool_uses
WHERE tool_name LIKE 'mcp__%'
GROUP BY 1, 2 ORDER BY 3 DESC;
```

## 6. Stop-hook firings (per day)

```sql
SELECT
  date_trunc('day', ts)      AS day,
  count(*)                   AS stop_hooks,
  count(DISTINCT session_id) AS sessions
FROM events
WHERE system_subtype = 'stop_hook_summary'
GROUP BY 1 ORDER BY 1 DESC LIMIT 14;
```

## 7. Cache efficiency (recent sessions)

```sql
SELECT
  session_id,
  input_tokens,
  output_tokens,
  cache_read_tokens,
  cache_write_tokens,
  round(cache_read_tokens / NULLIF(input_tokens + cache_read_tokens, 0) * 100, 1)
    AS cache_hit_pct,
  round(total_cost_usd, 4) AS usd
FROM sessions
WHERE total_tokens > 0
ORDER BY started_at DESC LIMIT 10;
```

Sort by `cache_hit_pct DESC` to find the highest-cache-hit sessions.

## 8. Session transcript walk

Given a `session_id`, replay every record from that session in order:

```sql
SELECT ts, type, model, system_subtype
FROM events
WHERE session_id = '<paste-session-id>'
ORDER BY ts;
```

## 9. Recent sessions summary (default)

```sql
SELECT
  session_id,
  started_at,
  round(duration_seconds/60.0, 1)  AS min,
  prompt_count,
  tool_count,
  total_tokens,
  round(total_cost_usd, 4)         AS usd,
  model
FROM sessions
ORDER BY started_at DESC LIMIT 10;
```

---

**Dropped from the OTel-era catalog:**
- *Compaction frequency* — not present in JSONL (it's a harness lifecycle event).
- *Tool decisions (accept/reject)* — not in JSONL; would require parsing assistant content for `tool_decision`-style markers that don't reliably exist.
