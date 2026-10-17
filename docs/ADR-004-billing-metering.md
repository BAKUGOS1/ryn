# ADR 004: independent meters, no live billing

Accepted; billing implementation deferred to Phase 4 sandbox.

Probe = admitted scheduled network attempt, deduped by schedule occurrence. Run = accepted qualified automation; condition-false background polls do not consume run quota. Action sends, AI tokens and orchestration steps are separate usage/cost meters. Retried delivery must not charge a second run. Atomic reservations precede execution; append-only ledger settles outcomes with unique idempotency keys. Reconcile abandoned reservations.

Plan proposal: Free 300 runs / 3,000 probes / 1 seat; Starter 5,000 / 10,000 / 2; Pro 25,000 / 150,000 / 5; Business 100,000 / 1,000,000 / 20. These are unvalidated commercial hypotheses. Phase 1 is a noncommercial foundation with a fixed 20-seat safety ceiling to exercise invitations, clearly NOT the Free plan. Pricing/entitlements must replace this ceiling before launch.

Razorpay hosted sandbox via BillingProvider; authoritative reconciliation, raw-body HMAC, durable inbox, out-of-order handling. Merchant eligibility, taxes, sandbox account, costs and production terms unverified. No billing SDK, keys, live checkout or payments added now.
