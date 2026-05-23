# audit_archdoc_test.exs
# Run with: elixir .claude/skills/features/scripts/audit_archdoc_test.exs

ExUnit.start()

Code.require_file("audit_archdoc.exs", __DIR__)

defmodule AuditArchdocTest do
  use ExUnit.Case

  describe "AuditArchdoc.run/2" do
    test "passes when every index row is referenced by exactly one scenario" do
      index = """
      <tr><td>§7.3-001</td></tr>
      <tr><td>§7.3-002</td></tr>
      """

      catalog = """
      Feature: Hold lifecycle
        @invariant @ref:§7.3-001
        Scenario: Releases on go_back
          Then ok

        @invariant @ref:§7.3-002
        Scenario: Cancels jobs
          Then ok
      """

      assert {:ok,
              %{
                total: 2,
                mapped: 2,
                orphans: [],
                doubles: [],
                dangling: []
              }} = AuditArchdoc.run(index, catalog)
    end

    test "fails listing orphaned index rows (no scenario references them)" do
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

      assert {:error,
              %{
                total: 3,
                mapped: 1,
                orphans: ["§7.3-002", "§7.3-003"],
                doubles: [],
                dangling: []
              }} = AuditArchdoc.run(index, catalog)
    end

    test "fails listing dangling refs (scenario @ref pointing to non-existent index row)" do
      index = """
      <tr><td>§7.3-001</td></tr>
      """

      catalog = """
      Feature: Bad ref
        @invariant @ref:§7.3-001 @ref:§9.9-999
        Scenario: Mixes valid and dangling
          Then ok
      """

      assert {:error,
              %{
                total: 1,
                mapped: 1,
                orphans: [],
                doubles: [],
                dangling: ["§9.9-999"]
              }} = AuditArchdoc.run(index, catalog)
    end

    test "fails listing doubles (commitment referenced by multiple scenarios)" do
      index = """
      <tr><td>§7.3-001</td></tr>
      <tr><td>§7.3-002</td></tr>
      """

      catalog = """
      Feature: Overlapping coverage
        @invariant @ref:§7.3-001
        Scenario: First scenario for §7.3-001
          Then ok

        @invariant @ref:§7.3-001 @ref:§7.3-002
        Scenario: Second scenario covers §7.3-001 again
          Then ok
      """

      assert {:error,
              %{
                total: 2,
                mapped: 2,
                orphans: [],
                doubles: [{"§7.3-001", 2}],
                dangling: []
              }} = AuditArchdoc.run(index, catalog)
    end

    test "reports all failure types together in a mixed scenario" do
      index = """
      <tr><td>§1.0-001</td></tr>
      <tr><td>§1.0-002</td></tr>
      <tr><td>§1.0-003</td></tr>
      """

      catalog = """
      Feature: Mixed
        @invariant @ref:§1.0-001
        Scenario: First covers 001
          Then ok

        @invariant @ref:§1.0-001 @ref:§9.9-999
        Scenario: Second double-covers 001 and dangles 999
          Then ok
      """

      # 001 is mapped (and doubled). 002 + 003 are orphans. 999 is dangling.
      assert {:error,
              %{
                total: 3,
                mapped: 1,
                orphans: ["§1.0-002", "§1.0-003"],
                doubles: [{"§1.0-001", 2}],
                dangling: ["§9.9-999"]
              }} = AuditArchdoc.run(index, catalog)
    end

    test "ignores no-feature marker comments in index" do
      index = """
      <tr><td>§7.3-001</td></tr>
      <!-- no-feature: §20 glossary, prose-only -->
      """

      catalog = """
      Feature: One
        @invariant @ref:§7.3-001
        Scenario: ok
          Then ok
      """

      assert {:ok, %{total: 1, mapped: 1, orphans: [], doubles: [], dangling: []}} =
               AuditArchdoc.run(index, catalog)
    end
  end
end
