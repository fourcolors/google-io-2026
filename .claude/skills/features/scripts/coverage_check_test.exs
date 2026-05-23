# coverage_check_test.exs
# Run with: elixir .claude/skills/features/scripts/coverage_check_test.exs

ExUnit.start()

Code.require_file("coverage_check.exs", __DIR__)

defmodule CoverageCheckTest do
  use ExUnit.Case

  @fixture_dir Path.join(__DIR__, "fixtures")

  setup do
    File.mkdir_p!(@fixture_dir)
    on_exit(fn -> File.rm_rf!(@fixture_dir) end)
    :ok
  end

  describe "CoverageCheck.run/2" do
    test "passes when every index row is referenced by ≥1 scenario" do
      index = """
      <tr><td>§7.3-001</td></tr>
      <tr><td>§7.3-002</td></tr>
      """

      catalog = """
      Feature: Hold lifecycle
        @invariant @ref:§7.3-001 @ref:§7.3-002
        Scenario: Releases on go_back
          Then ok
      """

      assert {:ok, %{total: 2, mapped: 2, unmapped: []}} =
               CoverageCheck.run(index, catalog)
    end

    test "fails listing unmapped index entries" do
      index = """
      <tr><td>§7.3-001</td></tr>
      <tr><td>§7.3-002</td></tr>
      <tr><td>§7.3-003</td></tr>
      """

      catalog = """
      Feature: Partial
        @invariant @ref:§7.3-001
        Scenario: Only one ref
          Then ok
      """

      assert {:error, %{total: 3, mapped: 1, unmapped: ["§7.3-002", "§7.3-003"]}} =
               CoverageCheck.run(index, catalog)
    end

    test "ignores no-feature marker lines" do
      index = """
      <tr><td>§7.3-001</td></tr>
      <!-- no-feature: §20 glossary, prose-only -->
      """

      catalog = """
      Feature: Holds
        @invariant @ref:§7.3-001
        Scenario: ok
          Then ok
      """

      assert {:ok, %{total: 1, mapped: 1, unmapped: []}} =
               CoverageCheck.run(index, catalog)
    end

    test "multiple @ref tags on one scenario all count" do
      index = """
      <tr><td>§7.3-001</td></tr>
      <tr><td>§7.3-002</td></tr>
      """

      catalog = """
      Feature: Combined
        @invariant @ref:§7.3-001 @ref:§7.3-002
        Scenario: Covers both
          Then ok
      """

      assert {:ok, %{total: 2, mapped: 2, unmapped: []}} =
               CoverageCheck.run(index, catalog)
    end
  end
end
