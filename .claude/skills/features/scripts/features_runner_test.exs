# features_runner_test.exs
# Run with: elixir .claude/skills/features/scripts/features_runner_test.exs

ExUnit.start()

Code.require_file("features_runner.exs", __DIR__)

defmodule FeaturesRunnerTest do
  use ExUnit.Case

  describe "FeaturesRunner.parse_scenarios/1" do
    test "extracts scenarios with title, tags, and @requires paths" do
      catalog = """
      Feature: Session
        @invariant @ref:§1.0-014 @phase:1 @requires:app/test/flowstay/session_test.exs
        Scenario: Canonical state lives in one GenServer per session
          Given a call_id
          Then the GenServer holds state

        @invariant @ref:§1.0-015 @phase:1
        Scenario: Per-call observation journal lives in its own table
          Given observations
          Then they land in call_observations
      """

      scenarios = FeaturesRunner.parse_scenarios(catalog)

      assert length(scenarios) == 2

      [s1, s2] = scenarios

      assert s1.title == "Canonical state lives in one GenServer per session"
      assert "@invariant" in s1.tags
      assert "@ref:§1.0-014" in s1.tags
      assert "@phase:1" in s1.tags
      assert s1.requires == ["app/test/flowstay/session_test.exs"]

      assert s2.title == "Per-call observation journal lives in its own table"
      assert s2.requires == []
    end

    test "captures multiple @requires on one scenario" do
      catalog = """
      Feature: Multi-wired
        @invariant @ref:§2.0-001 @requires:app/test/a_test.exs:10 @requires:worker/tests/b.py::test_x
        Scenario: Covers two backings
          Then ok
      """

      [s] = FeaturesRunner.parse_scenarios(catalog)
      assert s.requires == ["app/test/a_test.exs:10", "worker/tests/b.py::test_x"]
    end
  end

  describe "FeaturesRunner.run/2 with mock dispatcher" do
    test "scenario with no @requires reports :not_wired" do
      catalog = """
      Feature: Bare
        @invariant @ref:§1.0-001
        Scenario: Has no backing yet
          Then todo
      """

      dispatcher = fn _path -> raise "should not be called" end

      result = FeaturesRunner.run(catalog, dispatcher: dispatcher)

      assert result.total == 1
      assert result.passed == 0
      assert result.failed == 0
      assert result.not_wired == 1
      assert [%{title: "Has no backing yet", verdict: :not_wired}] = result.results
    end

    test "scenario with one passing @requires reports :passed" do
      catalog = """
      Feature: Wired
        @invariant @ref:§1.0-014 @requires:app/test/flowstay/session_test.exs
        Scenario: Session GenServer
          Then ok
      """

      dispatcher = fn "app/test/flowstay/session_test.exs" -> {:ok, "ran fine"} end

      result = FeaturesRunner.run(catalog, dispatcher: dispatcher)

      assert result.passed == 1
      assert result.failed == 0
      assert result.not_wired == 0
    end

    test "scenario with one failing @requires reports :failed with reason" do
      catalog = """
      Feature: Broken
        @invariant @ref:§1.0-099 @requires:app/test/no_such_test.exs
        Scenario: Test does not exist
          Then nope
      """

      dispatcher = fn "app/test/no_such_test.exs" -> {:error, "file not found"} end

      result = FeaturesRunner.run(catalog, dispatcher: dispatcher)

      assert result.failed == 1
      assert [%{verdict: :failed, failures: [{"app/test/no_such_test.exs", "file not found"}]}] =
               result.results
    end

    test "scenario with multiple @requires — all must pass for :passed" do
      catalog = """
      Feature: Multi-required
        @invariant @ref:§2.0-001 @requires:app/test/a_test.exs @requires:app/test/b_test.exs
        Scenario: Both must pass
          Then ok
      """

      dispatcher = fn
        "app/test/a_test.exs" -> {:ok, ""}
        "app/test/b_test.exs" -> {:error, "boom"}
      end

      result = FeaturesRunner.run(catalog, dispatcher: dispatcher)

      assert result.failed == 1
      assert result.passed == 0
    end

    test "tag filter narrows the set of scenarios" do
      catalog = """
      Feature: Mixed phases
        @invariant @ref:§1.0-001 @phase:1 @requires:app/test/a_test.exs
        Scenario: phase 1 scenario
          Then ok

        @invariant @ref:§2.0-001 @phase:2 @requires:app/test/b_test.exs
        Scenario: phase 2 scenario
          Then ok
      """

      dispatcher = fn _ -> {:ok, ""} end

      result = FeaturesRunner.run(catalog, dispatcher: dispatcher, tag_filter: "@phase:1")

      assert result.total == 1
      assert [%{title: "phase 1 scenario"}] = result.results
    end

    test "summary aggregates correctly across mixed verdicts" do
      catalog = """
      Feature: Mixed verdicts
        @invariant @ref:§a-001 @requires:app/test/pass_test.exs
        Scenario: passes
          Then ok

        @invariant @ref:§a-002 @requires:app/test/fail_test.exs
        Scenario: fails
          Then ok

        @invariant @ref:§a-003
        Scenario: not wired yet
          Then ok
      """

      dispatcher = fn
        "app/test/pass_test.exs" -> {:ok, ""}
        "app/test/fail_test.exs" -> {:error, "nope"}
      end

      result = FeaturesRunner.run(catalog, dispatcher: dispatcher)

      assert result.total == 3
      assert result.passed == 1
      assert result.failed == 1
      assert result.not_wired == 1
    end
  end

  describe "FeaturesRunner.dispatch_path/1 (path → shell command)" do
    test "app/ exs paths route to mix test under cd app" do
      assert FeaturesRunner.dispatch_path("app/test/flowstay/session_test.exs") ==
               {:elixir, "app", "test/flowstay/session_test.exs"}

      assert FeaturesRunner.dispatch_path("app/test/flowstay/session_test.exs:42") ==
               {:elixir, "app", "test/flowstay/session_test.exs:42"}
    end

    test "worker/ py paths route to uv run pytest under cd worker" do
      assert FeaturesRunner.dispatch_path("worker/tests/test_agent.py") ==
               {:python, "worker", "tests/test_agent.py"}

      assert FeaturesRunner.dispatch_path("worker/tests/test_agent.py::test_minimal") ==
               {:python, "worker", "tests/test_agent.py::test_minimal"}
    end

    test "unrecognized path returns :unrecognized" do
      assert FeaturesRunner.dispatch_path("random/path") == :unrecognized
    end

    test ".claude/.../*.exs scripts route to standalone elixir runner" do
      assert FeaturesRunner.dispatch_path(".claude/skills/features/scripts/foo_test.exs") ==
               {:elixir_script, ".claude/skills/features/scripts/foo_test.exs"}
    end
  end
end
