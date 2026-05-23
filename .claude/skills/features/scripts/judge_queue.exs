# judge_queue.exs
# CLI:
#   elixir .claude/skills/features/scripts/judge_queue.exs [@tag-filter]
# Reads features/*.feature, builds a per-scenario prompt-queue file for
# Claude Code's Agent SDK judge runner (no ANTHROPIC_API_KEY needed).
#
# Output: .scratch/judge-runs/queue/<scenario_ref>.prompt.md
#   Each file has the prompt body the operator can paste into an
#   Agent({subagent_type: 'general-purpose', prompt: <body>}) call.
#
# Pattern: queue → operator-runs-claude-agents → verdicts in
# .scratch/judge-runs/<scenario_ref>.json → aggregate via
# judge_aggregate.exs (future).

defmodule JudgeQueue do
  @ref_tag_regex ~r/@ref:(§\d+\.\d+-\d{3})/
  @requires_tag_regex ~r/@requires:([^\s]+)/

  def main(args) do
    repo_root = File.cwd!() |> ensure_repo_root()

    tag_filter =
      case Enum.find(args, &String.starts_with?(&1, "@")) do
        nil -> nil
        tag -> tag
      end

    catalog =
      File.read!(Path.join(repo_root, "features/journeys.feature")) <>
        "\n" <>
        File.read!(Path.join(repo_root, "features/invariants.feature"))

    queue_dir = Path.join(repo_root, ".scratch/judge-runs/queue")
    File.mkdir_p!(queue_dir)

    scenarios = parse_scenarios(catalog)

    filtered =
      case tag_filter do
        nil -> scenarios
        t -> Enum.filter(scenarios, fn s -> t in s.tags end)
      end

    enqueued =
      filtered
      |> Enum.filter(&(&1.requires != []))
      |> Enum.map(fn s -> enqueue(s, queue_dir, repo_root) end)

    IO.puts(
      "Queued #{length(enqueued)} prompts to #{Path.relative_to(queue_dir, repo_root)}/" <>
        if(tag_filter, do: " (filter: #{tag_filter})", else: "")
    )
  end

  defp parse_scenarios(catalog_str) do
    lines = String.split(catalog_str, "\n")

    # Two-phase: walk lines, accumulate { tag_line, title, body } per scenario.
    # State: :outside | {:after_tags, tag_line} | {:in_body, scenario}
    {scenarios, last_state} = Enum.reduce(lines, {[], :outside}, &step/2)

    # Flush any in-flight scenario at EOF
    case last_state do
      {:in_body, scenario} -> Enum.reverse([scenario | scenarios])
      _ -> Enum.reverse(scenarios)
    end
  end

  defp step(line, {acc, state}) do
    trimmed = String.trim(line)

    cond do
      # A tag line — flush current scenario, start new tag state
      String.starts_with?(trimmed, "@") ->
        acc2 =
          case state do
            {:in_body, scenario} -> [scenario | acc]
            _ -> acc
          end

        {acc2, {:after_tags, line}}

      # Scenario header right after tags
      String.starts_with?(trimmed, "Scenario:") and match?({:after_tags, _}, state) ->
        {:after_tags, tag_line} = state
        title = trimmed |> String.replace_prefix("Scenario:", "") |> String.trim()

        refs =
          Regex.scan(@ref_tag_regex, tag_line, capture: :all_but_first)
          |> List.flatten()

        requires =
          Regex.scan(@requires_tag_regex, tag_line, capture: :all_but_first)
          |> List.flatten()

        scenario_id = List.first(refs) || title

        scenario = %{
          id: scenario_id,
          title: title,
          tags: extract_tags(tag_line),
          refs: refs,
          requires: requires,
          tag_line: tag_line,
          body: ""
        }

        {acc, {:in_body, scenario}}

      # Feature header — flush current scenario and reset
      String.starts_with?(trimmed, "Feature:") ->
        acc2 =
          case state do
            {:in_body, scenario} -> [scenario | acc]
            _ -> acc
          end

        {acc2, :outside}

      # Body line of current scenario — accumulate
      match?({:in_body, _}, state) ->
        {:in_body, scenario} = state
        {acc, {:in_body, %{scenario | body: scenario.body <> line <> "\n"}}}

      # Anything else outside a scenario — ignore
      true ->
        {acc, state}
    end
  end

  defp extract_tags(line) do
    Regex.scan(~r/@[^\s]+/, line) |> List.flatten()
  end

  defp enqueue(scenario, queue_dir, repo_root) do
    filename = Path.join(queue_dir, "#{escape_filename(scenario.id)}.prompt.md")

    evidence_block =
      scenario.requires
      |> Enum.map(fn path -> "- `#{Path.join(repo_root, path)}`" end)
      |> Enum.join("\n")

    body = """
    You are a strict contract auditor for the FlowStay feature catalog.

    Decide whether the evidence ACTUALLY demonstrates the scenario contract.
    Be strict — a test that mechanically passes but doesn't verify the
    contract (asserts on the wrong thing, mocked-out invariant, etc.)
    is a FAIL.

    **SCENARIO:**

    ```
    #{scenario.tag_line}
    Scenario: #{scenario.title}
    #{scenario.body}
    ```

    **EVIDENCE** (read all via the Read tool):

    #{evidence_block}

    **Verdict format.** Write to `#{Path.join(repo_root, ".scratch/judge-runs/#{escape_filename(scenario.id)}.json")}`:

    ```json
    {
      "scenario_ref": "#{scenario.id}",
      "verdict": "pass" | "fail",
      "reasoning": "<one paragraph — specific, cites identifiers from the evidence>",
      "judged_by": "claude-agent-sdk subagent"
    }
    ```

    After writing the file, respond with one line: `JUDGED: pass` or `JUDGED: fail`. Nothing else.
    """

    File.write!(filename, body)
    filename
  end

  defp escape_filename(id), do: String.replace(id, "/", "_")

  defp ensure_repo_root(cwd) do
    if File.exists?(Path.join(cwd, ".git")) do
      cwd
    else
      parent = Path.dirname(cwd)
      if parent == cwd, do: System.halt(1), else: ensure_repo_root(parent)
    end
  end
end

JudgeQueue.main(System.argv())
