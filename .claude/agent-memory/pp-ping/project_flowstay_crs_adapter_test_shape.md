---
name: flowstay-crs-adapter-test-shape
description: How CRS Adapter behaviour assertions are written in flowstay/app — behaviour_info/1 + function_exported?/3 + Code.fetch_docs/1 introspection idioms
metadata:
  type: project
---

Tests for `Flowstay.CRS.Adapter` and its implementations live at `app/test/flowstay/crs/`:

- `adapter_test.exs` — pins the behaviour itself (callback decls via `Adapter.behaviour_info(:callbacks)`) and a test-support adapter (`Flowstay.CRS.Adapter.Test`) at `app/test/support/crs_adapter_test_impl.ex`.
- `reserv_hotel_test.exs` — pins the concrete ReservHotel adapter (search/hold/confirm contract + math + PCI filter).
- `travel_click_test.exs`, `types_test.exs` — siblings.

**Established test shape for behaviour-contract pins:**

```elixir
test "Adapter declares @callback foo/0" do
  callbacks = Adapter.behaviour_info(:callbacks)
  assert {:foo, 0} in callbacks
end

test "Adapter.Impl exports foo/0" do
  assert function_exported?(Adapter.Impl, :foo, 0)
end

test "moduledoc does not contain phrase X" do
  {:docs_v1, _, _, _, moduledoc, _, _} = Code.fetch_docs(Adapter)
  doc = case moduledoc do
    %{"en" => s} -> s
    s when is_binary(s) -> s
    _ -> ""
  end
  refute String.contains?(doc, "phrase")
end
```

**Why:** When evolving the Adapter behaviour, the test layer uses behaviour-introspection rather than runtime call shape, so the assertion lands at the contract level (the callback decl) rather than at the implementation level (the function exists). This decouples spec from impl technique — pong picks how to satisfy the contract.

**How to apply:** When specing scenarios on `Flowstay.CRS.Adapter` or new sibling behaviours, append a new describe block to `adapter_test.exs` (not a new sibling file — [[feedback_append_vs_new_test_file]]). The Adapter.Test stub at `test/support/crs_adapter_test_impl.ex` is the in-memory implementation used to prove behaviour-conformance without hitting real adapters; it stays canonical — never delete it without rewriting the 3 tests in `adapter_test.exs:38-58` that depend on it.
