---
name: feedback-error-normalizer-input-shape
description: When specing an error-normalizer downstream of a request wrapper, pin the post-normalization input shape — not the raw vendor-lib shape — in the test fixtures
metadata:
  type: feedback
---

When pong has already shipped a request wrapper that post-processes responses (e.g., B.2's `log_and_return/2` normalizes Req 0.5's `headers: %{}` map-of-lists into `[{name, value}]` tuples), the error-normalizer is a **downstream** consumer of that wrapper's output, not a raw-Req consumer.

**Rule**: in the spec for the downstream normalizer, construct fixtures using the wrapper's NORMALIZED shape, NOT the raw vendor shape. Cite the upstream wrapper's normalization in the describe-block comment so the next reader (and the auditor) doesn't get confused.

**Why**: if you spec the normalizer to handle raw Req map-headers, pong either (a) duplicates the wrapper's normalization inside the normalizer (dead code), or (b) the contract becomes ambiguous about which layer owns headers-shape and the next person to touch either layer breaks the other. Pinning the post-wrapper shape keeps the wrapper's normalization as the single source of truth.

**How to apply**: before writing the test, read the upstream wrapper's return-path (`log_and_return/2` in B.2's case at `http_client.ex:97`) and confirm what the downstream actually sees. Construct test fixtures matching THAT, not the vendor's raw shape. Add an explicit one-line describe-block comment documenting the contract: "this function lives downstream of X's normalization, so headers are list-of-tuples not map-of-lists." Auditor can then verify exhaustiveness against the right input space.

Sibling to [[project_flowstay_crs_adapter_test_shape]] for CRS-adapter testing idioms.
