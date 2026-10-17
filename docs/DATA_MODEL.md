# Data model

| Table                    | Key / scope                                                              | Access                                                   |
| ------------------------ | ------------------------------------------------------------------------ | -------------------------------------------------------- |
| organizations            | UUID; unique slug; owner Auth FK; archived_at                            | Active member SELECT; guarded RPC writes                 |
| organization_members     | (organization_id,user_id); one owner per org; active/suspended           | Active tenant member SELECT; guarded management RPC      |
| organization_settings    | organization_id PK/FK; IANA timezone                                     | Member SELECT; admin/owner RPC                           |
| organization_invites     | UUID; org + inviter composite FK; unique token_hash; email/expiry/status | Admin/owner safe-column SELECT; token_hash never granted |
| audit_logs               | UUID; organization_id + actor Auth FK; resource ID; timestamp            | Admin/owner SELECT; function-only writes                 |
| private.mutation_buckets | user_id PK; minute window / count                                        | No client table grants; function only                    |

All exposed tables have RLS enabled. No write policies or table DML grants are given to authenticated/anon. Private helpers have fixed empty search_path and qualified references. Public RPCs are SECURITY INVOKER; private state-changing functions explicitly verify the identity and role. PUBLIC/anon execute revoked. No SQL or JWT metadata role trust.

Invitation rows lock on acceptance; organization row locks serialize seat changes/archive and ensure consistent authorization. Mutation bucket serializes per-user creation limits. RLS revocation is immediate for suspended memberships. Invalid operations roll back with no partial audit rows.

No deletes cascade audit/history. Workspace archive hides tenant rows and revokes invitations. Restoration is an administrative recovery operation, not a public endpoint. Owner transfer and permanent deletion intentionally deferred.
