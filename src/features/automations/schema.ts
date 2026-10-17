import { z } from "zod";
const id = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/);
const scalar = z.union([
  z.string().max(500),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);
const path = z
  .string()
  .max(100)
  .regex(/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*){0,4}$/)
  .refine(
    (v) =>
      !v
        .split(".")
        .some((k) => ["__proto__", "constructor", "prototype"].includes(k)),
    "Unsafe field path",
  );
const condition = z
  .object({
    id,
    type: z.literal("condition"),
    config: z
      .object({
        path,
        operator: z.enum(["eq", "gt", "lt", "is_null"]),
        value: scalar,
      })
      .strict(),
  })
  .strict();
const action = z
  .object({
    id,
    type: z.literal("action"),
    config: z.discriminatedUnion("operation", [
      z
        .object({
          provider: z.literal("email"),
          operation: z.literal("send_notification"),
          recipientId: z.uuid(),
        })
        .strict(),
      z
        .object({
          provider: z.literal("internal"),
          operation: z.literal("audit_record"),
        })
        .strict(),
    ]),
  })
  .strict();
const timezone = z
  .string()
  .max(80)
  .refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  });
export const definitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: z.string().trim().min(2).max(80),
    trigger: z.discriminatedUnion("type", [
      z
        .object({
          type: z.literal("webhook.signed"),
          config: z.object({}).strict(),
        })
        .strict(),
      z
        .object({
          type: z.literal("deadline.once"),
          config: z
            .object({
              at: z.iso.datetime({ offset: true }),
              timezone,
              leadMinutes: z.number().int().min(0).max(43200),
            })
            .strict(),
        })
        .strict(),
    ]),
    nodes: z
      .array(z.discriminatedUnion("type", [condition, action]))
      .min(1)
      .max(20),
    edges: z
      .array(
        z
          .object({
            from: id,
            to: id,
            when: z.enum(["true", "false", "success"]),
          })
          .strict(),
      )
      .max(40),
  })
  .strict()
  .superRefine((d, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    if (d.trigger.type === "deadline.once") {
      const { at, timezone } = d.trigger.config;
      let parts: Intl.DateTimeFormatPart[];
      try {
        parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23",
        }).formatToParts(new Date(at));
      } catch {
        return;
      }
      const part = (key: string) => parts.find((p) => p.type === key)?.value;
      const local = `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}`;
      if (local !== at.slice(0, 19))
        fail("Timestamp offset must match its timezone");
    }
    const nodes = new Map(d.nodes.map((n) => [n.id, n]));
    if (nodes.size !== d.nodes.length) {
      fail("Duplicate node IDs");
      return;
    }
    const incoming = new Map(d.nodes.map((n) => [n.id, 0]));
    const links = new Map(d.nodes.map((n) => [n.id, [] as string[]]));
    const seen = new Set<string>();
    for (const edge of d.edges) {
      if (!nodes.has(edge.from) || !nodes.has(edge.to)) {
        fail("Missing edge reference");
        continue;
      }
      const key = edge.from + ":" + edge.to + ":" + edge.when;
      if (seen.has(key)) fail("Duplicate edge");
      seen.add(key);
      if (nodes.get(edge.from)?.type === "action" && edge.when !== "success")
        fail("Actions require success edges");
      if (nodes.get(edge.from)?.type === "condition" && edge.when === "success")
        fail("Conditions require true or false edges");
      incoming.set(edge.to, incoming.get(edge.to)! + 1);
      links.get(edge.from)!.push(edge.to);
    }
    const roots = d.nodes.filter((n) => incoming.get(n.id) === 0);
    if (roots.length !== 1) fail("Exactly one entry node is required");
    if ([...incoming.values()].some((n) => n > 1))
      fail("Joins are not supported in schema v1");
    const visited = new Set<string>(),
      active = new Set<string>();
    const visit = (key: string, depth: number) => {
      if (active.has(key)) {
        fail("Cycle detected");
        return;
      }
      if (visited.has(key)) return;
      if (depth > 20) {
        fail("Graph too deep");
        return;
      }
      active.add(key);
      for (const child of links.get(key) ?? []) visit(child, depth + 1);
      active.delete(key);
      visited.add(key);
    };
    for (const root of roots) visit(root.id, 0);
    if (visited.size !== nodes.size) fail("Unreachable nodes or cycle");
    if (!d.nodes.some((n) => n.type === "action"))
      fail("At least one action is required");
    const email = d.nodes.filter(
      (n) => n.type === "action" && n.config.operation === "send_notification",
    );
    if (email.length > 1)
      fail("At most one email action per execution in schema v1");
  });
export type Definition = z.infer<typeof definitionSchema>;
export type Scalar = z.infer<typeof scalar>;
export interface Trace {
  id: string;
  type: "condition" | "action";
  status: "matched" | "not_matched" | "queued" | "recorded" | "skipped";
  operation?: string;
}
export function normalizeEvent(
  definition: Definition,
  raw: unknown,
): Record<string, Scalar> {
  const result: Record<string, Scalar> = {};
  for (const node of definition.nodes) {
    if (node.type !== "condition") continue;
    let value: unknown = raw;
    for (const part of node.config.path.split(".")) {
      if (
        !value ||
        typeof value !== "object" ||
        !Object.prototype.hasOwnProperty.call(value, part)
      ) {
        value = null;
        break;
      }
      value = (value as Record<string, unknown>)[part];
    }
    const parsed = scalar.safeParse(value);
    result[node.config.path] = parsed.success ? parsed.data : null;
  }
  return result;
}
export function evaluate(
  definition: Definition,
  fields: Record<string, Scalar>,
) {
  const targets = new Set(definition.edges.map((e) => e.to));
  const root = definition.nodes.find((n) => !targets.has(n.id));
  if (!root) throw new Error("invalid_graph");
  const pending = [root.id];
  const reached = new Set<string>();
  const trace: Trace[] = [];
  let recipientId: string | null = null,
    audit = false;
  while (pending.length) {
    const id = pending.shift()!;
    if (reached.has(id)) throw new Error("invalid_graph");
    reached.add(id);
    const node = definition.nodes.find((n) => n.id === id)!;
    let branch: "true" | "false" | "success" = "success";
    if (node.type === "condition") {
      const actual = fields[node.config.path] ?? null;
      const expected = node.config.value;
      const matched =
        node.config.operator === "is_null"
          ? actual === null
          : node.config.operator === "eq"
            ? actual === expected
            : typeof actual === "number" &&
              typeof expected === "number" &&
              (node.config.operator === "gt"
                ? actual > expected
                : actual < expected);
      trace.push({
        id,
        type: "condition",
        status: matched ? "matched" : "not_matched",
      });
      branch = matched ? "true" : "false";
    } else if (node.config.operation === "send_notification") {
      recipientId = node.config.recipientId;
      trace.push({
        id,
        type: "action",
        status: "queued",
        operation: "send_notification",
      });
    } else {
      audit = true;
      trace.push({
        id,
        type: "action",
        status: "recorded",
        operation: "audit_record",
      });
    }
    pending.push(
      ...definition.edges
        .filter((e) => e.from === id && e.when === branch)
        .map((e) => e.to),
    );
  }
  for (const n of definition.nodes)
    if (!reached.has(n.id))
      trace.push({ id: n.id, type: n.type, status: "skipped" });
  return {
    qualified: recipientId !== null || audit,
    recipientId,
    audit,
    trace,
  };
}
export const draftInput = z
  .object({ organizationId: z.uuid(), definition: definitionSchema })
  .strict();
