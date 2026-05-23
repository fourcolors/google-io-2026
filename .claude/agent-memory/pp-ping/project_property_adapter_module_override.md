---
name: property-adapter-module-override
description: The canonical FlowStay test-wiring mechanism for swapping in a stub CRS adapter — Application env override read by Property.adapter_module/1
metadata:
  type: project
---

`app/lib/flowstay/identity/property.ex:91-96` defines `Property.adapter_module/1`:

```elixir
def adapter_module(%__MODULE__{crs_adapter: name}) do
  case Application.get_env(:flowstay, :crs_adapter_override) do
    mod when is_atom(mod) and not is_nil(mod) -> mod
    _ -> resolve_adapter(name)
  end
end
```

Tests inject a stub adapter via:

```elixir
setup do
  Application.put_env(:flowstay, :crs_adapter_override, MyStub)
  on_exit(fn -> Application.delete_env(:flowstay, :crs_adapter_override) end)
  :ok
end
```

**Use this convention** when writing tests that need an Oban worker / Cart / any callsite that resolves an adapter from a `Property` row to call a stub. Do NOT invent a new mechanism (e.g., direct module arg, persistent_term keyed by property_id, mox). The codebase has converged on Application env + a single global override.

The docstring above the function explicitly names this as "the §7 A.4 wiring decision" — it's an architectural commitment, not an incidental.

**Per-call configurability** (e.g., "this stub returns X for hold 1 and Y for hold 2") layers on top via `:persistent_term` keyed by the stub module itself + the discriminator. The `StubCRS` pattern in `app/test/flowstay/cart_test.exs:13-49` shows this.

**Stub completeness gotcha**: if the production code path under test calls `adapter.capabilities()` or `adapter.metadata()` (not just the 5 mandatory CRUD-style callbacks), the stub MUST implement them. The `StubCRS` in cart_test.exs cheats — no capabilities/metadata — and only works because Cart never inspects them. Workers that branch on capability advertisement must have stubs that declare capabilities. Related: [[feedback_verify_fake_module_claims]].
