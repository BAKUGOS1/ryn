# ADR 003: constrained immutable DAG

Accepted for Phase 2; no unfinished engine added to Phase 1.

Draft graph is editable. Publish validates strict schemaVersion=1, allowlisted triggers/operators/actions, unique node IDs, references, reachable nodes, no cycles, depth and node caps. Server evaluates current actor role and entitlements. Persist immutable version and active pointer in one transaction. Runs reference (organization_id, workflow_id, version_id) through compound keys. An edit never changes a running version.

Use typed comparisons with explicit null and timezone semantics; no scripts, SQL, regex or arbitrary expressions. Canvas position is presentation data, never authority. Version migration creates a new snapshot; never silently reinterpret historical definitions. Implement bounded DAG/property tests in Phase 2, editor on same contract in Phase 3.
