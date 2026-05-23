# coverage_check.exs
# CLI invocation:
#   elixir .claude/skills/features/scripts/coverage_check.exs
# Reads:
#   features/index.html
#   features/journeys.feature
#   features/invariants.feature
# Output: writes report to stdout; exit 0 on PASS, exit 1 on unmapped > 0.

defmodule CoverageCheck do
  @moduledoc """
  Stage-3 mechanical gate for FlowStay feature catalog extraction.

  Verifies every row in `features/index.html` is referenced by ≥1 scenario
  via @ref:§X.Y-NNN tags in features/journeys.feature or features/invariants.feature.
  """

  @row_id_regex ~r/<td>(§\d+\.\d+-\d{3})<\/td>/
  @ref_tag_regex ~r/@ref:(§\d+\.\d+-\d{3})/

  @doc """
  Run coverage check on the given index and catalog strings.

  Returns `{:ok, summary}` if every non-no-feature row in the index appears
  in at least one scenario's @ref tags, otherwise `{:error, summary}`.

  Summary shape: `%{total: integer, mapped: integer, unmapped: [String.t()]}`.
  """
  def run(index_str, catalog_str) do
    index_ids = extract_index_ids(index_str)
    ref_ids = extract_ref_ids(catalog_str)

    mapped = MapSet.intersection(index_ids, ref_ids)
    unmapped = MapSet.difference(index_ids, ref_ids) |> Enum.sort()

    summary = %{
      total: MapSet.size(index_ids),
      mapped: MapSet.size(mapped),
      unmapped: unmapped
    }

    if Enum.empty?(unmapped), do: {:ok, summary}, else: {:error, summary}
  end

  defp extract_index_ids(str) do
    str
    |> String.split("\n", trim: true)
    |> Enum.flat_map(fn line ->
      case Regex.run(@row_id_regex, line, capture: :all_but_first) do
        [id] -> [id]
        _ -> []
      end
    end)
    |> MapSet.new()
  end

  defp extract_ref_ids(str) do
    Regex.scan(@ref_tag_regex, str, capture: :all_but_first)
    |> List.flatten()
    |> MapSet.new()
  end

  def main(_args) do
    repo_root = File.cwd!() |> ensure_repo_root()

    index_path = Path.join(repo_root, "features/index.html")
    journeys_path = Path.join(repo_root, "features/journeys.feature")
    invariants_path = Path.join(repo_root, "features/invariants.feature")

    Enum.each([index_path, journeys_path, invariants_path], fn p ->
      unless File.exists?(p) do
        IO.puts(:stderr, "ERROR: required file missing: #{p}")
        System.halt(1)
      end
    end)

    index = File.read!(index_path)
    catalog = File.read!(journeys_path) <> "\n" <> File.read!(invariants_path)

    case run(index, catalog) do
      {:ok, %{total: t, mapped: m}} ->
        IO.puts("#{t} commitments / #{m} mapped / 0 unmapped       → PASS")
        System.halt(0)

      {:error, %{total: t, mapped: m, unmapped: u}} ->
        IO.puts("#{t} commitments / #{m} mapped / #{length(u)} unmapped → FAIL")
        IO.puts("\nUnmapped index rows:")
        Enum.each(u, &IO.puts("  - #{&1}"))
        System.halt(1)
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

# CLI entry — only run main when invoked directly,
# not when this file is loaded by the test (which calls ExUnit.start() first).
if Process.whereis(ExUnit.Server) do
  :ok
else
  CoverageCheck.main(System.argv())
end
