-- claude-session-analytics: view definitions over native Claude Code session JSONL.
--
-- Source: ~/.claude/projects/<project-hash>/*.jsonl
--   These are Claude Code's native per-session logs (NDJSON, one record per line).
--   Each session is one file; record types: user, assistant, system, attachment, etc.
--
-- Required env var:
--   CC_JSONL_GLOB — glob pattern for session JSONL files
--   (run-query.sh derives this from $PWD)

LOAD json;

CREATE OR REPLACE VIEW raw AS
SELECT *
FROM read_json_auto(
  getenv('CC_JSONL_GLOB'),
  format='newline_delimited',
  union_by_name=true,
  sample_size=-1
);

-- Every record across every session in this project, with the common scalars lifted out.
CREATE OR REPLACE VIEW events AS
SELECT
  timestamp::TIMESTAMP                                     AS ts,
  type,
  sessionId                                                AS session_id,
  promptId                                                 AS prompt_id,
  message.model                                            AS model,
  COALESCE(message.usage.input_tokens, 0)                  AS input_tokens,
  COALESCE(message.usage.output_tokens, 0)                 AS output_tokens,
  COALESCE(message.usage.cache_read_input_tokens, 0)       AS cache_read_tokens,
  COALESCE(message.usage.cache_creation_input_tokens, 0)   AS cache_write_tokens,
  gitBranch                                                AS git_branch,
  cwd,
  version                                                  AS cc_version,
  subtype                                                  AS system_subtype,
  message
FROM raw
WHERE sessionId IS NOT NULL AND timestamp IS NOT NULL;

-- One row per assistant tool invocation. Built by unnesting message.content JSON arrays.
CREATE OR REPLACE VIEW tool_uses AS
SELECT
  e.ts,
  e.session_id,
  e.model,
  json_extract_string(je.value, '$.name') AS tool_name,
  json_extract_string(je.value, '$.id')   AS tool_use_id
FROM events e,
     json_each(e.message.content) AS je
WHERE e.type = 'assistant'
  AND json_extract_string(je.value, '$.type') = 'tool_use';

-- Per-model pricing in USD per million tokens. Update when Anthropic changes prices.
-- Source: anthropic.com/pricing as of 2026-05-15.
CREATE OR REPLACE VIEW model_prices AS
SELECT * FROM (VALUES
  ('claude-opus-4-7',    15.00, 75.00, 1.50, 18.75),
  ('claude-opus-4-6',    15.00, 75.00, 1.50, 18.75),
  ('claude-sonnet-4-6',   3.00, 15.00, 0.30,  3.75),
  ('claude-sonnet-4-5',   3.00, 15.00, 0.30,  3.75),
  ('claude-haiku-4-5',    1.00,  5.00, 0.10,  1.25)
) AS t(model, in_per_mtok, out_per_mtok, cache_read_per_mtok, cache_write_per_mtok);

-- Per-session rollup. Cost is computed from tokens × model_prices (JSONL has no cost field).
CREATE OR REPLACE VIEW sessions AS
WITH msg AS (
  SELECT
    session_id,
    MIN(ts)                                                  AS started_at,
    MAX(ts)                                                  AS last_event_at,
    COUNT(*)                                                 AS event_count,
    COUNT(DISTINCT prompt_id) FILTER (WHERE type='user')     AS prompt_count,
    COUNT(*) FILTER (WHERE type='assistant')                 AS assistant_msgs,
    COUNT(*) FILTER (WHERE system_subtype='stop_hook_summary') AS stop_hooks,
    SUM(input_tokens)                                        AS input_tokens,
    SUM(output_tokens)                                       AS output_tokens,
    SUM(cache_read_tokens)                                   AS cache_read_tokens,
    SUM(cache_write_tokens)                                  AS cache_write_tokens,
    MAX(model)                                               AS model
  FROM events
  GROUP BY session_id
),
tools AS (
  SELECT session_id, COUNT(*) AS tool_count
  FROM tool_uses GROUP BY session_id
),
cost AS (
  SELECT
    e.session_id,
    SUM(
      e.input_tokens       * COALESCE(p.in_per_mtok,         0) / 1e6 +
      e.output_tokens      * COALESCE(p.out_per_mtok,        0) / 1e6 +
      e.cache_read_tokens  * COALESCE(p.cache_read_per_mtok, 0) / 1e6 +
      e.cache_write_tokens * COALESCE(p.cache_write_per_mtok,0) / 1e6
    ) AS total_cost_usd
  FROM events e
  LEFT JOIN model_prices p ON p.model = e.model
  GROUP BY e.session_id
)
SELECT
  m.session_id,
  m.started_at,
  m.last_event_at,
  DATEDIFF('second', m.started_at, m.last_event_at)        AS duration_seconds,
  m.event_count,
  m.prompt_count,
  COALESCE(t.tool_count, 0)                                AS tool_count,
  m.assistant_msgs,
  m.stop_hooks,
  m.input_tokens::BIGINT                                   AS input_tokens,
  m.output_tokens::BIGINT                                  AS output_tokens,
  m.cache_read_tokens::BIGINT                              AS cache_read_tokens,
  m.cache_write_tokens::BIGINT                             AS cache_write_tokens,
  (m.input_tokens + m.output_tokens + m.cache_read_tokens + m.cache_write_tokens)::BIGINT
                                                           AS total_tokens,
  COALESCE(c.total_cost_usd, 0)                            AS total_cost_usd,
  m.model
FROM msg m
LEFT JOIN tools t USING (session_id)
LEFT JOIN cost  c USING (session_id);
