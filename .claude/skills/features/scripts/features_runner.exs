# features_runner.exs
# CLI invocation:
#   elixir .claude/skills/features/scripts/features_runner.exs [@tag-filter] [--det-only]
# Reads:
#   features/journeys.feature + features/invariants.feature (or pipes via CATALOG env)
# Output: per-scenario verdict + summary; exit 0 on all-pass, 1 on any failure.

defmodule FeaturesRunner do
  @moduledoc """
  Mechanical runner for the FlowStay feature catalog (`/features run`).

  Replaces the v1 "Claude executes the procedure" pattern with a real
  parser + dispatcher. Closes the infrastructure for goal criterion #1
  (`/features run --det-only` → 410/410 green).

  ## Lifecycle

      catalog (.feature text)
        → parse_scenarios → list of %{title, tags, requires, line}
          → run/2 (filters by tag, dispatches each @requires, aggregates)
            → %{total, passed, failed, not_wired, results}

  ## Path conventions

  The `@requires:<path>` tag uses these prefixes (matched by
  `dispatch_path/1`):

  - `app/test/<...>.exs[:LINE]` → Elixir runner under `cd app/`
  - `worker/tests/<...>.py[::name]` → Python runner under `cd worker/`

  Anything else returns `:unrecognized`, surfaced as a failure with
  reason "unrecognized requires path".
  """

  # A tag line is one with @-prefixed tokens, before a Scenario: header.
  @tag_token_regex ~r/(@[^\s]+)/

  @doc """
  Parse a Gherkin-style catalog string into a list of scenario maps.

  Each map has `:title`, `:tags` (list of strings including the `@`),
  `:requires` (list of paths from `@requires:<path>` tags), and `:line`
  (1-indexed line of the `Scenario:` header for diagnostics).
  """
  def parse_scenarios(catalog_str) do
    lines =
      catalog_str
      |> String.split("\n")
      |> Enum.with_index(1)

    do_parse(lines, [], nil)
  end

  defp do_parse([], acc, _pending_tags) do
    Enum.reverse(acc)
  end

  defp do_parse([{line, line_idx} | rest], acc, pending_tags) do
    trimmed = String.trim(line)

    cond do
      String.starts_with?(trimmed, "Scenario:") and pending_tags != nil ->
        title = trimmed |> String.replace_prefix("Scenario:", "") |> String.trim()

        requires =
          pending_tags
          |> Enum.filter(&String.starts_with?(&1, "@requires:"))
          |> Enum.map(&String.replace_prefix(&1, "@requires:", ""))

        scenario = %{
          title: title,
          tags: pending_tags,
          requires: requires,
          line: line_idx
        }

        do_parse(rest, [scenario | acc], nil)

      String.starts_with?(trimmed, "@") ->
        # Tag line — accumulate. Later scenario consumes it.
        tags =
          Regex.scan(@tag_token_regex, line, capture: :all_but_first)
          |> List.flatten()

        do_parse(rest, acc, tags)

      trimmed == "" ->
        # Blank line — preserve pending_tags; tag line may span before scenario.
        do_parse(rest, acc, pending_tags)

      true ->
        # Any other content (Given/When/Then, Feature: header, etc.) — clear
        # pending tags so they don't bleed into the next scenario.
        do_parse(rest, acc, nil)
    end
  end

  @doc """
  Map a `@requires:<path>` to a dispatch target.

  Returns `{:elixir, cwd, rel_path}`, `{:python, cwd, rel_path}`,
  `{:elixir_script, path}`, or `:unrecognized`. The runner uses this
  to build the right shell command per backing test runtime.
  """
  def dispatch_path(path) do
    cond do
      String.starts_with?(path, "app/test/") and elixir_test_path?(path) ->
        rel = String.replace_prefix(path, "app/", "")
        {:elixir, "app", rel}

      String.starts_with?(path, "worker/tests/") and python_test_path?(path) ->
        rel = String.replace_prefix(path, "worker/", "")
        {:python, "worker", rel}

      String.starts_with?(path, ".claude/") and elixir_test_path?(path) ->
        {:elixir_script, path}

      true ->
        :unrecognized
    end
  end

  defp elixir_test_path?(path), do: String.contains?(path, ".exs")
  defp python_test_path?(path), do: String.contains?(path, ".py")

  @doc """
  Run the catalog with the given options.

  Opts:
  - `:dispatcher` — 1-arity fn taking a requires-path, returning
    `{:ok, output}` or `{:error, reason}`. Defaults to real shell-out.
  - `:tag_filter` — string tag (e.g., `"@phase:1"`); only scenarios
    bearing it run.

  Returns `%{total, passed, failed, not_wired, results}` where each
  entry in `:results` is `%{title, verdict, failures}` with verdict
  in `[:passed, :failed, :not_wired]`.
  """
  def run(catalog_str, opts \\ []) do
    dispatcher = Keyword.get(opts, :dispatcher, &real_dispatch/1)
    tag_filter = Keyword.get(opts, :tag_filter)

    scenarios =
      catalog_str
      |> parse_scenarios()
      |> apply_tag_filter(tag_filter)

    # Memoize dispatch by path so a test file is only executed ONCE even if
    # 50 scenarios point at it. Without this, mix test fires N times.
    unique_paths =
      scenarios
      |> Enum.flat_map(& &1.requires)
      |> Enum.uniq()

    total_paths = length(unique_paths)

    IO.puts(:stderr, "Dispatching #{total_paths} unique test paths…")

    path_results =
      unique_paths
      |> Enum.with_index(1)
      |> Enum.map(fn {path, idx} ->
        IO.puts(:stderr, "  [#{idx}/#{total_paths}] #{path}")
        {path, dispatcher.(path)}
      end)
      |> Map.new()

    memo_dispatcher = fn path ->
      Map.get(path_results, path, {:error, "path not dispatched: #{path}"})
    end

    results = Enum.map(scenarios, &run_scenario(&1, memo_dispatcher))

    aggregate(results)
  end

  defp apply_tag_filter(scenarios, nil), do: scenarios

  defp apply_tag_filter(scenarios, tag) when is_binary(tag) do
    Enum.filter(scenarios, fn s -> tag in s.tags end)
  end

  defp run_scenario(%{requires: []} = scenario, _dispatcher) do
    %{title: scenario.title, verdict: :not_wired, failures: []}
  end

  defp run_scenario(%{requires: requires} = scenario, dispatcher) do
    failures =
      Enum.flat_map(requires, fn path ->
        case dispatcher.(path) do
          {:ok, _output} -> []
          {:error, reason} -> [{path, reason}]
        end
      end)

    verdict = if failures == [], do: :passed, else: :failed

    %{title: scenario.title, verdict: verdict, failures: failures}
  end

  defp aggregate(results) do
    counts =
      Enum.reduce(results, %{passed: 0, failed: 0, not_wired: 0}, fn r, acc ->
        Map.update!(acc, r.verdict, &(&1 + 1))
      end)

    Map.merge(counts, %{
      total: length(results),
      results: results
    })
  end

  # Real shell-out dispatcher. Routes by path prefix to mix / pytest / standalone elixir.
  defp real_dispatch(path) do
    case dispatch_path(path) do
      {:elixir, cwd, rel} ->
        case System.cmd("mix", ["test", rel],
               cd: cwd,
               stderr_to_stdout: true,
               env: [{"MIX_ENV", "test"}]
             ) do
          {output, 0} -> {:ok, output}
          {output, _status} -> {:error, output}
        end

      {:python, cwd, rel} ->
        case System.cmd("uv", ["run", "pytest", rel],
               cd: cwd,
               stderr_to_stdout: true
             ) do
          {output, 0} -> {:ok, output}
          {output, _status} -> {:error, output}
        end

      {:elixir_script, script_path} ->
        case System.cmd("elixir", [script_path], stderr_to_stdout: true) do
          {output, 0} -> {:ok, output}
          {output, _status} -> {:error, output}
        end

      :unrecognized ->
        {:error, "unrecognized requires path: #{path}"}
    end
  end

  def main(args) do
    {tag_filter, _det_only} = parse_args(args)

    repo_root = File.cwd!() |> ensure_repo_root()

    journeys_path = Path.join(repo_root, "features/journeys.feature")
    invariants_path = Path.join(repo_root, "features/invariants.feature")

    Enum.each([journeys_path, invariants_path], fn p ->
      unless File.exists?(p) do
        IO.puts(:stderr, "ERROR: required file missing: #{p}")
        System.halt(1)
      end
    end)

    catalog = File.read!(journeys_path) <> "\n" <> File.read!(invariants_path)

    result = run(catalog, tag_filter: tag_filter)

    print_report(result, tag_filter)

    if result.failed > 0, do: System.halt(1), else: System.halt(0)
  end

  defp parse_args(args) do
    {tag_filter, rest} =
      case Enum.split_with(args, &String.starts_with?(&1, "@")) do
        {[tag | _], rest} -> {tag, rest}
        {[], rest} -> {nil, rest}
      end

    det_only = "--det-only" in rest
    {tag_filter, det_only}
  end

  defp print_report(result, tag_filter) do
    %{total: total, passed: p, failed: f, not_wired: nw, results: scenarios} = result

    filter_label = if tag_filter, do: " (filter: #{tag_filter})", else: ""

    IO.puts(
      "#{total} scenarios#{filter_label} — #{p} passed / #{f} failed / #{nw} not wired"
    )

    unless f == 0 do
      IO.puts("\nFailures:")

      scenarios
      |> Enum.filter(&(&1.verdict == :failed))
      |> Enum.each(fn s ->
        IO.puts("  [FAIL] #{s.title}")

        Enum.each(s.failures, fn {path, reason} ->
          summary = reason |> String.split("\n") |> List.first() || ""
          IO.puts("    #{path}: #{summary}")
        end)
      end)
    end
  end

  defp ensure_repo_root(cwd) do
    if File.exists?(Path.join(cwd, ".git")) do
      cwd
    else
      parent = Path.dirname(cwd)

      if parent == cwd do
        IO.puts(:stderr, "ERROR: not inside a git repo")
        System.halt(1)
      else
        ensure_repo_root(parent)
      end
    end
  end
end

if Process.whereis(ExUnit.Server) do
  :ok
else
  FeaturesRunner.main(System.argv())
end
