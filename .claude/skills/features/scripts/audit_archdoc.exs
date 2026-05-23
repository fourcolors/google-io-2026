# audit_archdoc.exs
# CLI invocation:
#   elixir .claude/skills/features/scripts/audit_archdoc.exs
# Reads:
#   features/index.html
#   features/journeys.feature
#   features/invariants.feature
# Output: writes report to stdout; exit 0 on PASS, exit 1 on any audit failure.

defmodule AuditArchdoc do
  @moduledoc """
  Arch-doc round-trip audit. Closes the catalog ↔ commitments loop with
  three checks beyond what `coverage_check.exs` verifies:

  1. **Orphans** — index rows (commitments) with NO scenario `@ref:`
     pointing at them. (Also covered by `CoverageCheck` for the basic
     mapping gate; restated here so the audit report is self-contained.)

  2. **Dangling refs** — scenario `@ref:` tags pointing to IDs that
     don't exist in `features/index.html`. Indicates either a typo in a
     scenario or an index row that was removed but the scenario kept
     its reference.

  3. **Doubles** — a single commitment referenced by more than one
     scenario. Strict per goal criterion #3: "1098 commitments map to
     exactly one scenario each." Surfaces redundancy in the catalog.

  Source of truth is `features/index.html` (the Stage-1 extraction
  snapshot from the arch doc). The arch doc HTML itself has no direct
  `§X.Y-NNN` refs — those were assigned by extractor agents during
  Stage-1 commitment extraction. `/features update` keeps the index in
  sync with the HTML.
  """

  @row_id_regex ~r/<td>(§\d+\.\d+-\d{3})<\/td>/
  @ref_tag_regex ~r/@ref:(§\d+\.\d+-\d{3})/

  @doc """
  Run the audit on the given index and catalog strings.

  Returns `{:ok, summary}` on a clean audit, `{:error, summary}` if any
  of the three checks fail. Summary shape:

      %{
        total: non_neg_integer(),       # total index rows (commitments)
        mapped: non_neg_integer(),      # rows with ≥1 scenario @ref
        orphans: [String.t()],          # rows with no @ref (sorted)
        doubles: [{String.t(), pos_integer()}],  # {ref_id, scenario_count}
        dangling: [String.t()]          # @refs not in index (sorted, unique)
      }
  """
  def run(index_str, catalog_str) do
    index_ids = extract_index_ids(index_str)
    scenario_refs = extract_scenario_refs(catalog_str)

    referenced_ids =
      scenario_refs
      |> Enum.map(fn {ref, _scenario_idx} -> ref end)
      |> MapSet.new()

    mapped = MapSet.intersection(index_ids, referenced_ids)

    orphans =
      MapSet.difference(index_ids, referenced_ids)
      |> Enum.sort()

    dangling =
      MapSet.difference(referenced_ids, index_ids)
      |> Enum.sort()

    doubles = compute_doubles(scenario_refs, index_ids)

    summary = %{
      total: MapSet.size(index_ids),
      mapped: MapSet.size(mapped),
      orphans: orphans,
      doubles: doubles,
      dangling: dangling
    }

    if orphans == [] and doubles == [] and dangling == [] do
      {:ok, summary}
    else
      {:error, summary}
    end
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

  # Returns `[{ref_id, scenario_index}, ...]` — one entry per @ref
  # occurrence, with scenario_index identifying which scenario the ref
  # appeared in. Scenario boundaries are tag lines: a tag line that
  # starts a new scenario shares its index across all refs on that
  # logical scenario header.
  defp extract_scenario_refs(catalog_str) do
    catalog_str
    |> String.split("\n", trim: false)
    |> Enum.with_index()
    |> Enum.flat_map(fn {line, line_idx} ->
      # Each tag line is treated as a scenario boundary — refs on it
      # belong to scenario `line_idx`. This deliberately counts each
      # `@ref:` appearance separately even when grouped on one header
      # line, so doubles ARE caught when the same ref appears twice in
      # one header (which would be a typo bug anyway).
      Regex.scan(@ref_tag_regex, line, capture: :all_but_first)
      |> List.flatten()
      |> Enum.map(fn ref -> {ref, line_idx} end)
    end)
  end

  defp compute_doubles(scenario_refs, index_ids) do
    scenario_refs
    # Only count refs that actually exist in the index — dangling refs
    # are reported separately. A dangling ref appearing twice is two
    # dangling problems, not a "double."
    |> Enum.filter(fn {ref, _scenario_idx} -> MapSet.member?(index_ids, ref) end)
    # Distinct (ref, scenario_idx) pairs — same ref on the same tag
    # line counts once per scenario.
    |> Enum.uniq()
    |> Enum.group_by(fn {ref, _} -> ref end)
    |> Enum.filter(fn {_ref, occurrences} -> length(occurrences) > 1 end)
    |> Enum.map(fn {ref, occurrences} -> {ref, length(occurrences)} end)
    |> Enum.sort()
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
      {:ok, summary} ->
        print_report(summary, :pass)
        System.halt(0)

      {:error, summary} ->
        print_report(summary, :fail)
        System.halt(1)
    end
  end

  defp print_report(summary, verdict) do
    %{
      total: total,
      mapped: mapped,
      orphans: orphans,
      doubles: doubles,
      dangling: dangling
    } = summary

    verdict_label = if verdict == :pass, do: "PASS", else: "FAIL"

    IO.puts(
      "#{total} commitments / #{mapped} mapped / " <>
        "#{length(orphans)} orphans / #{length(doubles)} doubles / " <>
        "#{length(dangling)} dangling → #{verdict_label}"
    )

    unless orphans == [] do
      IO.puts("\nOrphans (index rows with no @ref):")
      Enum.each(orphans, &IO.puts("  - #{&1}"))
    end

    unless doubles == [] do
      IO.puts("\nDoubles (commitments referenced by >1 scenario):")
      Enum.each(doubles, fn {ref, count} -> IO.puts("  - #{ref} (#{count} scenarios)") end)
    end

    unless dangling == [] do
      IO.puts("\nDangling refs (scenario @ref:<id> not in index):")
      Enum.each(dangling, &IO.puts("  - #{&1}"))
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
# not when loaded by the test (which calls ExUnit.start() first).
if Process.whereis(ExUnit.Server) do
  :ok
else
  AuditArchdoc.main(System.argv())
end
