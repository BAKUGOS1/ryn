import type { Definition } from "./schema";
// Sample data is isolated to the public editor playground; it cannot be published.
export const sampleWorkflow: Definition = {
  schemaVersion: 1,
  name: "Record critical tickets",
  trigger: { type: "webhook.signed", config: {} },
  nodes: [
    {
      id: "critical_priority",
      type: "condition",
      config: { path: "priority", operator: "eq", value: "critical" },
    },
    {
      id: "record_evidence",
      type: "action",
      config: { provider: "internal", operation: "audit_record" },
    },
  ],
  edges: [{ from: "critical_priority", to: "record_evidence", when: "true" }],
};
