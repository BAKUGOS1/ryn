# Roadmap and gates

| Phase | Scope                                                                                | Status / exit gate                                                                             |
| ----- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| 0     | Focused source audit, foundation/executor/schema/metering ADRs                       | Documents delivered; upstream projects not compiled or security-certified                      |
| 1     | Auth, organizations, invitations, RBAC/RLS, shell, CI                                | Implemented locally; hosted integration and full browser/mobile gates open                     |
| 2     | Safe HTTPS monitor → two failures → incident/email → recovery, then webhook/deadline | Monitor slice implemented/tested locally; hosted integration plus webhook/deadline remain open |
| 3     | Graph editor over the same validated workflow contract                               | Not started; mobile authoring, accessibility and publish validation required                   |
| 4     | Metering, commercial entitlements and Razorpay sandbox                               | Not started; merchant verification and replay/race tests required                              |
| 5     | Bounded AI drafts, reliability/load and recovery drills                              | Not started; no autonomous actions                                                             |
| 6     | Pilot users, measured economics, staged release                                      | Owner approval required for deployment/live billing                                            |

Immediate next work: configure development Supabase; apply reviewed migration only there; run signed-in two-tenant browser checklist; run DB advisors and concurrent acceptance/load tests. Resolve mobile/browser gates and lint maintenance before release. Phase 2 source work was authorized while these credential-dependent gates remain open; no deployment acceptance is implied.

Phase 2 branch delivery: see `PHASE_2_DELIVERY.md` for the implemented monitoring slice and open acceptance gates.
