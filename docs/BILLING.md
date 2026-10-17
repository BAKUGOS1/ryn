# Billing boundary

No billing code, SDK, keys, checkout, subscription creation or live payment activation exists in Phase 1. Razorpay sandbox belongs to Phase 4 after merchant authorization. See ADR-004 for accounting and proposed quotas.

The foundation UI does not imply a paid or Free commercial subscription. Its 20-seat testing ceiling must be replaced by versioned entitlements before launch. No automatic conversion of development workspaces to paid plans.

Separate probes, qualified runs, notification sends, AI tokens and provider infrastructure steps. Transactional reservations/ledger + provider reconciliation will be mandatory. Product prices and gross margin remain hypotheses until measured.
