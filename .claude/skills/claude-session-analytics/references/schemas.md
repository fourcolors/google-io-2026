# View Schemas

Defined in `../state.sql`. Source data: `~/.claude/projects/<project-hash>/*.jsonl` — Claude Code's native per-session NDJSON logs.

---

## `raw` — pass-through of every JSONL record

Every column the JSONL contains, type-inferred via `read_json_auto`. Use only when `events` doesn't expose what you need. The interesting structured columns:

| Column | Type | Notes |
|---|---|---|
| `type` | varchar | `user`, `assistant`, `system`, `attachment`, `ai-title`, `last-prompt`, `file-history-snapshot`, `queue-operation` |
| `timestamp` | varchar | ISO-8601 string; cast to `TIMESTAMP` in `events` |
| `sessionId` | uuid | One UUID per `claude` process launch |
| `promptId` | varchar | Stable within a user turn; useful for distinct-prompt counts |
| `message` | struct | The Claude API message — `role`, `content` (JSON), `model`, `usage`, `stop_reason`, etc. Only set on `user`/`assistant` records. |
| `subtype` | varchar | Only set on `system` records — see catalog below |
| `cwd` | varchar | Working dir at session start (handy for cross-project filtering) |
| `gitBranch` | varchar | Branch at session start |
| `version` | varchar | Claude Code version |

**`type='system'` subtypes seen so far:** `local_command`, `stop_hook_summary`, `turn_duration`, `away_summary`.

---

## `events` — every record, with common scalars lifted

| Column | Type | Notes |
|---|---|---|
| `ts` | timestamp | Casted from `raw.timestamp` |
| `type` | varchar | Record type |
| `session_id` | uuid | |
| `prompt_id` | varchar | |
| `model` | varchar | From `message.model` — present only on `assistant` records |
| `input_tokens` | bigint | `message.usage.input_tokens` (0 if absent) |
| `output_tokens` | bigint | `message.usage.output_tokens` |
| `cache_read_tokens` | bigint | `message.usage.cache_read_input_tokens` |
| `cache_write_tokens` | bigint | `message.usage.cache_creation_input_tokens` |
| `git_branch` | varchar | |
| `cwd` | varchar | |
| `cc_version` | varchar | |
| `system_subtype` | varchar | Only set on `system` records |
| `message` | struct | Full message struct for ad-hoc digging |

---

## `tool_uses` — one row per assistant tool invocation

Built by unnesting `message.content` JSON arrays where `type='tool_use'`.

| Column | Type | Notes |
|---|---|---|
| `ts` | timestamp | When the assistant emitted the call |
| `session_id` | uuid | |
| `model` | varchar | The model that made the call |
| `tool_name` | varchar | `Bash`, `Read`, `Edit`, `Skill`, `mcp__livekit-docs__code_search`, etc. |
| `tool_use_id` | varchar | Anthropic API tool-use ID |

To get the tool input, join back to `events.message.content` via `tool_use_id`.

---

## `model_prices` — pricing table (USD per million tokens)

| Column | Type | Notes |
|---|---|---|
| `model` | varchar | Anthropic model ID |
| `in_per_mtok` | double | Input price |
| `out_per_mtok` | double | Output price |
| `cache_read_per_mtok` | double | Cache-read price (typically 10% of input) |
| `cache_write_per_mtok` | double | Cache-creation price (typically 125% of input for 5-min cache) |

Update when Anthropic changes prices. Last verified 2026-05-15.

---

## `sessions` — per-session rollup (the workhorse view)

| Column | Type | Notes |
|---|---|---|
| `session_id` | uuid | |
| `started_at` | timestamp | First event |
| `last_event_at` | timestamp | Last event |
| `duration_seconds` | bigint | Wall time |
| `event_count` | bigint | All records |
| `prompt_count` | bigint | Distinct `promptId` among `user` records |
| `tool_count` | bigint | From `tool_uses` |
| `assistant_msgs` | bigint | `type='assistant'` count |
| `stop_hooks` | bigint | `system_subtype='stop_hook_summary'` count |
| `input_tokens` | bigint | |
| `output_tokens` | bigint | |
| `cache_read_tokens` | bigint | |
| `cache_write_tokens` | bigint | |
| `total_tokens` | bigint | Sum of all four token types |
| `total_cost_usd` | double | Computed: tokens × `model_prices` |
| `model` | varchar | Dominant model in the session |
