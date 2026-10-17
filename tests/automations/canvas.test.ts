import { it, expect } from "vitest";
import { compileCanvas, toCanvas } from "@/features/automations/canvas";
import { sampleWorkflow } from "@/features/automations/templates";
import { evaluate, normalizeEvent } from "@/features/automations/schema";
it("round-trips the exact worker contract without presentation fields", () => {
  const canvas = toCanvas(sampleWorkflow);
  canvas.nodes[0].position = { x: 999, y: -450 };
  const compiled = compileCanvas(sampleWorkflow, canvas.nodes, canvas.edges);
  expect(compiled).toEqual(sampleWorkflow);
  expect(JSON.stringify(compiled)).not.toContain("position");
  for (const priority of ["critical", "low", null, 5])
    expect(evaluate(compiled, normalizeEvent(compiled, { priority }))).toEqual(
      evaluate(sampleWorkflow, normalizeEvent(sampleWorkflow, { priority })),
    );
});
it("cannot save a visual connection that the worker schema rejects", () => {
  const canvas = toCanvas(sampleWorkflow);
  canvas.edges.push({
    id: "bad",
    source: "record_evidence",
    target: "critical_priority",
    sourceHandle: "success",
    label: "success",
  });
  expect(() =>
    compileCanvas(sampleWorkflow, canvas.nodes, canvas.edges),
  ).toThrow();
});
