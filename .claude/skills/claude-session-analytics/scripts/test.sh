#!/usr/bin/env bash
# Functional smoke test for the claude-session-analytics skill.
# Asserts that state.sql loads, all expected views exist, and every named
# query in references/queries.md runs without error against this repo's data.
#
# Exits 0 on full pass, 1 on any failure.
set -uo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNNER="$SKILL_DIR/scripts/run-query.sh"

PASS=0
FAIL=0
FAILED=()

run_test() {
  local name="$1"
  local sql="$2"
  if bash "$RUNNER" "$sql" >/dev/null 2>&1; then
    echo "  PASS  $name"
    PASS=$((PASS+1))
  else
    echo "  FAIL  $name"
    FAIL=$((FAIL+1))
    FAILED+=("$name")
    # Re-run with output visible for debugging
    echo "        ---- error output ----"
    bash "$RUNNER" "$sql" 2>&1 | sed 's/^/        /'
    echo "        ----------------------"
  fi
}

echo "claude-session-analytics: functional smoke test"
echo

echo "Section 1: views exist and are queryable"
for view in raw events tool_uses sessions model_prices; do
  run_test "view '$view'" "SELECT count(*) FROM $view;"
done

echo
echo "Section 2: named queries from references/queries.md"

run_test "Q1 daily spend (7d)" \
  "SELECT date_trunc('day', started_at) AS day, count(DISTINCT session_id) AS sessions, round(sum(total_cost_usd), 4) AS usd, sum(total_tokens)::bigint AS tokens FROM sessions GROUP BY 1 ORDER BY 1 DESC LIMIT 7;"

run_test "Q2 top tools (7d)" \
  "SELECT tool_name, count(*) AS calls, count(DISTINCT session_id) AS sessions FROM tool_uses WHERE ts >= CURRENT_TIMESTAMP - INTERVAL '7 days' GROUP BY 1 ORDER BY 2 DESC LIMIT 15;"

run_test "Q3a top sessions by cost" \
  "SELECT session_id, started_at, round(duration_seconds/60.0, 1) AS minutes, total_tokens, round(total_cost_usd, 4) AS usd, prompt_count, tool_count, model FROM sessions ORDER BY total_cost_usd DESC LIMIT 10;"

run_test "Q3b top sessions by duration" \
  "SELECT session_id, started_at, round(duration_seconds/60.0, 1) AS minutes, prompt_count, tool_count, total_tokens, round(total_cost_usd, 4) AS usd FROM sessions ORDER BY duration_seconds DESC LIMIT 10;"

run_test "Q4 skill invocations" \
  "SELECT json_extract_string(je.value, '\$.input.skill') AS skill, count(*) AS calls, count(DISTINCT e.session_id) AS sessions FROM events e, json_each(e.message.content) AS je WHERE e.type='assistant' AND json_extract_string(je.value,'\$.type')='tool_use' AND json_extract_string(je.value,'\$.name')='Skill' GROUP BY 1 ORDER BY 2 DESC;"

run_test "Q5 MCP tool usage" \
  "SELECT split_part(tool_name,'__',2) AS mcp_server, split_part(tool_name,'__',3) AS tool, count(*) AS calls, count(DISTINCT session_id) AS sessions FROM tool_uses WHERE tool_name LIKE 'mcp__%' GROUP BY 1, 2 ORDER BY 3 DESC;"

run_test "Q6 stop hooks per day" \
  "SELECT date_trunc('day', ts) AS day, count(*) AS stop_hooks, count(DISTINCT session_id) AS sessions FROM events WHERE system_subtype = 'stop_hook_summary' GROUP BY 1 ORDER BY 1 DESC LIMIT 14;"

run_test "Q7 cache efficiency" \
  "SELECT session_id, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, round(cache_read_tokens / NULLIF(input_tokens + cache_read_tokens, 0) * 100, 1) AS cache_hit_pct, round(total_cost_usd, 4) AS usd FROM sessions WHERE total_tokens > 0 ORDER BY started_at DESC LIMIT 10;"

run_test "Q8 transcript walk" \
  "SELECT ts, type, model, system_subtype FROM events WHERE session_id = (SELECT session_id FROM sessions ORDER BY started_at DESC LIMIT 1) ORDER BY ts LIMIT 10;"

run_test "Q9 recent sessions summary" \
  "SELECT session_id, started_at, round(duration_seconds/60.0, 1) AS min, prompt_count, tool_count, total_tokens, round(total_cost_usd, 4) AS usd, model FROM sessions ORDER BY started_at DESC LIMIT 10;"

echo
TOTAL=$((PASS+FAIL))
echo "Results: $PASS/$TOTAL passed"
if [ $FAIL -gt 0 ]; then
  echo "Failed:"
  for f in "${FAILED[@]}"; do
    echo "  - $f"
  done
  exit 1
fi
