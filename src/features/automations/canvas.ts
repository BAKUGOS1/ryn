import { definitionSchema, type Definition } from "./schema";
export interface CanvasStep {
  id: string;
  data: { node: Definition["nodes"][number] };
  position: { x: number; y: number };
}
export interface CanvasLink {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
}
// Presentation data never enters the execution contract.
export function toCanvas(definition: Definition) {
  return {
    nodes: definition.nodes.map((node, index) => ({
      id: node.id,
      type: "step" as const,
      position: { x: 80 + (index % 2) * 280, y: 70 + index * 150 },
      data: { node },
    })),
    edges: definition.edges.map((edge, index) => ({
      id: "link_" + index,
      source: edge.from,
      target: edge.to,
      sourceHandle: edge.when,
      label: edge.when,
    })),
  };
}
export function compileCanvas(
  base: Pick<Definition, "schemaVersion" | "name" | "trigger">,
  nodes: CanvasStep[],
  edges: CanvasLink[],
): Definition {
  return definitionSchema.parse({
    ...base,
    nodes: nodes.map((n) => ({ ...n.data.node, id: n.id })),
    edges: edges.map((e) => ({
      from: e.source,
      to: e.target,
      when: e.sourceHandle,
    })),
  });
}
