import { it, expect } from "vitest";
import {
  definitionSchema,
  normalizeEvent,
  evaluate,
  type Definition,
} from "@/features/automations/schema";
export const definition: Definition = {
  schemaVersion: 1,
  name: "Priority alert",
  trigger: { type: "webhook.signed", config: {} },
  nodes: [
    {
      id: "check",
      type: "condition",
      config: { path: "ticket.priority", operator: "eq", value: "critical" },
    },
    {
      id: "notify",
      type: "action",
      config: {
        provider: "email",
        operation: "send_notification",
        recipientId: "10000000-0000-4000-8000-000000000001",
      },
    },
  ],
  edges: [{ from: "check", to: "notify", when: "true" }],
};
it("normalizes only configured scalar fields and executes deterministic branches", () => {
  const d = definitionSchema.parse(definition);
  const fields = normalizeEvent(d, {
    ticket: { priority: "critical", password: "private" },
    token: "private",
  });
  expect(fields).toEqual({ "ticket.priority": "critical" });
  expect(evaluate(d, fields)).toMatchObject({
    qualified: true,
    recipientId: "10000000-0000-4000-8000-000000000001",
  });
  const result = evaluate(
    d,
    normalizeEvent(d, { ticket: { priority: { nested: true } } }),
  );
  expect(result.qualified).toBe(false);
  expect(result.trace.map((n) => n.status)).toEqual(["not_matched", "skipped"]);
});
it.each([
  "unknown action",
  "cycle",
  "missing target",
  "duplicate id",
  "join",
  "script",
  "prototype",
])("rejects %s", (kind) => {
  const d = structuredClone(definition) as unknown as Record<string, unknown>;
  const nodes = d.nodes as Record<string, unknown>[];
  const edges = d.edges as Record<string, unknown>[];
  if (kind === "unknown action")
    nodes[1].config = { provider: "email", operation: "arbitrary" };
  if (kind === "cycle")
    edges.push({ from: "notify", to: "check", when: "success" });
  if (kind === "missing target") edges[0].to = "absent";
  if (kind === "duplicate id") nodes[1].id = "check";
  if (kind === "join")
    edges.push({ from: "check", to: "notify", when: "false" });
  if (kind === "script") d.script = "eval()";
  if (kind === "prototype")
    nodes[0].config = {
      path: "ticket.constructor",
      operator: "eq",
      value: null,
    };
  expect(definitionSchema.safeParse(d).success).toBe(false);
});
it("enforces typed comparisons and null semantics", () => {
  const d = structuredClone(definition);
  if (d.nodes[0].type !== "condition") throw Error();
  d.nodes[0].config.operator = "gt";
  d.nodes[0].config.value = 5;
  expect(evaluate(d, { "ticket.priority": "6" }).qualified).toBe(false);
  expect(evaluate(d, { "ticket.priority": 6 }).qualified).toBe(true);
  d.nodes[0].config.operator = "is_null";
  expect(evaluate(d, {}).qualified).toBe(true);
});
it("requires a timezone-consistent offset, including daylight saving gaps", () => {
  const d = structuredClone(definition);
  d.trigger = {
    type: "deadline.once",
    config: {
      at: "2027-03-14T02:30:00-05:00",
      timezone: "America/New_York",
      leadMinutes: 0,
    },
  };
  expect(definitionSchema.safeParse(d).success).toBe(false);
  d.trigger.config.at = "2027-03-14T03:30:00-04:00";
  expect(definitionSchema.safeParse(d).success).toBe(true);
  d.trigger.config.timezone = "invalid";
  expect(definitionSchema.safeParse(d).success).toBe(false);
});
