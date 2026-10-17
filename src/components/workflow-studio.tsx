"use client";
import { memo, useCallback, useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type NodeProps,
  type Connection,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Check,
  GitBranch,
  Mail,
  FileCheck2,
  Plus,
  Trash2,
  Play,
  Save,
} from "lucide-react";
import { compileCanvas, toCanvas } from "@/features/automations/canvas";
import {
  definitionSchema,
  evaluate,
  normalizeEvent,
  type Definition,
} from "@/features/automations/schema";
import { post } from "./forms";
type StepNode = Node<{ node: Definition["nodes"][number] }, "step">;
const Step = memo(function Step({ data, selected }: NodeProps<StepNode>) {
  const node = data.node;
  const Icon =
    node.type === "condition"
      ? GitBranch
      : node.config.operation === "send_notification"
        ? Mail
        : FileCheck2;
  return (
    <div className={`studio-node ${selected ? "is-selected" : ""}`}>
      <Handle type="target" position={Position.Top} />
      <span className={`studio-node-icon ${node.type}`}>
        <Icon size={18} />
      </span>
      <div>
        <small>
          {node.type === "condition"
            ? "CONDITION"
            : node.config.operation === "send_notification"
              ? "NOTIFICATION"
              : "AUDIT"}
        </small>
        <strong>{node.id.replaceAll("_", " ")}</strong>
        <span>
          {node.type === "condition"
            ? `${node.config.path} ${node.config.operator} ${String(node.config.value)}`
            : node.config.operation === "send_notification"
              ? "Verified team recipient"
              : "Workspace audit record"}
        </span>
      </div>
      {node.type === "condition" ? (
        <>
          <Handle
            id="true"
            type="source"
            position={Position.Bottom}
            style={{ left: "30%" }}
          />
          <Handle
            id="false"
            type="source"
            position={Position.Bottom}
            style={{ left: "70%", background: "#b56f35" }}
          />
          <div className="studio-node-branches">
            <span>True</span>
            <span>False</span>
          </div>
        </>
      ) : (
        <Handle id="success" type="source" position={Position.Bottom} />
      )}
    </div>
  );
});
const nodeTypes = { step: Step };
export default function WorkflowStudio({
  organizationId,
  id,
  revision,
  definition,
  recipients,
  allowSave = true,
}: {
  organizationId: string;
  id: string;
  revision: number;
  definition: unknown;
  recipients: { user_id: string; email: string }[];
  allowSave?: boolean;
}) {
  const initial = useMemo(
    () => definitionSchema.parse(definition),
    [definition],
  );
  const canvas = useMemo(() => toCanvas(initial), [initial]);
  const [nodes, setNodes, onNodesChange] = useNodesState<StepNode>(
    canvas.nodes,
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(canvas.edges);
  const [name, setName] = useState(initial.name);
  const [trigger, setTrigger] = useState(initial.trigger);
  const [selected, setSelected] = useState(initial.nodes[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [invalidValues, setInvalidValues] = useState<Record<string, string>>(
    {},
  );
  const inputError = nodes.some(
    (n) =>
      n.data.node.type === "condition" &&
      n.data.node.config.operator !== "is_null" &&
      n.id in invalidValues,
  );
  const saveLock = useRef(false);
  const [draftRevision, setDraftRevision] = useState(revision);
  // Ignore canvas selection and position: they are not part of the saved contract.
  const fingerprint = JSON.stringify({
    name,
    trigger,
    nodes: nodes.map((n) => n.data.node),
    edges: edges.map((e) => [e.source, e.target, e.sourceHandle]),
  });
  const [savedFingerprint, setSavedFingerprint] = useState(fingerprint);
  const dirty = fingerprint !== savedFingerprint || inputError;
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const navigate = (event: MouseEvent) => {
      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.target === "_blank" ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      )
        return;
      const url = new URL(link.href);
      if (url.pathname === location.pathname && url.search === location.search)
        return;
      if (
        !window.confirm(
          "Leave this page and discard your unsaved workflow changes?",
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty]);
  const [sample, setSample] = useState('{"priority":"critical"}');
  const [simulation, setSimulation] = useState<{
    fingerprint: string;
    result: ReturnType<typeof evaluate>;
  } | null>(null);
  const preview =
    !inputError && simulation?.fingerprint === fingerprint
      ? simulation.result
      : null;
  const setPreview = (result: ReturnType<typeof evaluate> | null) =>
    setSimulation(result ? { fingerprint, result } : null);
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [branch, setBranch] = useState("true");
  const router = useRouter();
  const validation = useMemo(() => {
    try {
      return {
        definition: compileCanvas(
          { schemaVersion: 1, name, trigger },
          nodes,
          edges,
        ),
        errors: [] as string[],
      };
    } catch (error) {
      return {
        definition: null,
        errors:
          error instanceof Error && "issues" in error
            ? (error.issues as { message: string }[]).map((i) => i.message)
            : ["Check workflow configuration."],
      };
    }
  }, [name, trigger, nodes, edges]);
  const connect = useCallback(
    (connection: Connection) => {
      setSimulation(null);
      setEdges((es) =>
        addEdge({ ...connection, label: connection.sourceHandle }, es),
      );
    },
    [setEdges],
  );
  const current = nodes.find((n) => n.id === selected)?.data.node;
  function update(node: Definition["nodes"][number]) {
    setPreview(null);
    setNodes((ns) =>
      ns.map((n) => (n.id === selected ? { ...n, data: { node } } : n)),
    );
  }
  function add(type: "condition" | "audit" | "email") {
    if (nodes.length >= 20) return;
    const nodeId =
      type + "_" + crypto.randomUUID().replaceAll("-", "").slice(0, 8);
    const node: Definition["nodes"][number] =
      type === "condition"
        ? {
            id: nodeId,
            type: "condition",
            config: { path: "priority", operator: "eq", value: "critical" },
          }
        : type === "audit"
          ? {
              id: nodeId,
              type: "action",
              config: { provider: "internal", operation: "audit_record" },
            }
          : {
              id: nodeId,
              type: "action",
              config: {
                provider: "email",
                operation: "send_notification",
                recipientId: recipients[0]?.user_id ?? "",
              },
            };
    setNodes((ns) => [
      ...ns,
      {
        id: nodeId,
        type: "step",
        position: { x: 100, y: ns.length * 160 },
        data: { node },
      },
    ]);
    setSelected(nodeId);
    setPreview(null);
  }
  async function save() {
    if (!validation.definition || inputError || !allowSave || saveLock.current)
      return;
    saveLock.current = true;
    setBusy(true);
    setMessage("");
    try {
      await post(`/api/automations/${id}/save`, {
        organizationId,
        revision: draftRevision,
        definition: validation.definition,
      });
      setSavedFingerprint(fingerprint);
      setDraftRevision((value) => value + 1);
      setMessage("Draft saved. Review and publish from the workflow card.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed.");
    } finally {
      saveLock.current = false;
      setBusy(false);
    }
  }
  function test() {
    try {
      if (!validation.definition || inputError)
        throw Error("Resolve validation errors first.");
      if (sample.length > 32768) throw Error("Sample exceeds 32 KiB.");
      const raw: unknown = JSON.parse(sample);
      if (!raw || typeof raw !== "object" || Array.isArray(raw))
        throw Error("Use a JSON object.");
      setPreview(
        evaluate(
          validation.definition,
          normalizeEvent(validation.definition, raw),
        ),
      );
      setMessage(
        "Simulation only. No event, usage, email or audit record was created.",
      );
    } catch (e) {
      setPreview(null);
      setMessage(e instanceof Error ? e.message : "Invalid sample.");
    }
  }
  return (
    <section className="workflow-studio" aria-label="Workflow editor">
      <div className="studio-toolbar">
        <div>
          <span className="eyebrow">DRAFT STUDIO</span>
          <h3>Connect a moment to an action.</h3>
        </div>
        <button
          className="button"
          type="button"
          disabled={busy || !validation.definition || inputError || !allowSave}
          onClick={save}
        >
          <Save size={16} />
          {!allowSave
            ? "Sample · saving disabled"
            : busy
              ? "Saving…"
              : "Save draft"}
        </button>
      </div>
      <p className="quiet" role="status">
        {dirty ? "Unsaved changes" : "No unsaved changes"} · Closing the studio
        keeps your edits on this page. Canvas positions are not saved.
      </p>
      <div className="studio-layout">
        <div className="studio-main">
          <div className="studio-trigger">
            <Check size={18} />
            <span>
              <strong>
                {trigger.type === "webhook.signed"
                  ? "Signed webhook"
                  : "Deadline reminder"}
              </strong>
              <small>Verified event → workflow entry</small>
            </span>
          </div>
          <div className="studio-canvas">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={connect}
              onNodeClick={(_, node) => {
                setSelected(node.id);
              }}
              fitView
              minZoom={0.35}
              maxZoom={1.7}
              aria-label="Draft workflow canvas"
            >
              <Background gap={20} color="#cbd7d2" />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
          <div className="studio-palette" aria-label="Node palette">
            <button
              type="button"
              onClick={() => add("condition")}
              disabled={nodes.length >= 20}
            >
              <Plus size={15} />
              Condition
            </button>
            <button
              type="button"
              onClick={() => add("audit")}
              disabled={nodes.length >= 20}
            >
              <Plus size={15} />
              Audit record
            </button>
            <button
              type="button"
              onClick={() => add("email")}
              disabled={
                nodes.length >= 20 ||
                nodes.some(
                  (n) =>
                    n.data.node.type === "action" &&
                    n.data.node.config.operation === "send_notification",
                ) ||
                !recipients.length
              }
            >
              <Plus size={15} />
              Notification
            </button>
          </div>
        </div>
        <aside className="studio-inspector">
          <h4>Workflow settings</h4>
          <label>
            Name
            <input
              value={name}
              minLength={2}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {trigger.type === "deadline.once" && (
            <>
              <label>
                Deadline with UTC offset
                <input
                  value={trigger.config.at}
                  onChange={(e) =>
                    setTrigger({
                      ...trigger,
                      config: { ...trigger.config, at: e.target.value },
                    })
                  }
                  placeholder="2027-01-20T09:00:00+05:30"
                />
              </label>
              <label>
                IANA timezone
                <input
                  value={trigger.config.timezone}
                  onChange={(e) =>
                    setTrigger({
                      ...trigger,
                      config: { ...trigger.config, timezone: e.target.value },
                    })
                  }
                />
              </label>
              <label>
                Minutes before
                <input
                  type="number"
                  min={0}
                  max={43200}
                  value={trigger.config.leadMinutes}
                  onChange={(e) =>
                    setTrigger({
                      ...trigger,
                      config: {
                        ...trigger.config,
                        leadMinutes: Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
            </>
          )}
          <label>
            Selected step
            <select
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
              }}
            >
              {nodes.map((n) => (
                <option value={n.id} key={n.id}>
                  {n.id.replaceAll("_", " ")} · {n.data.node.type}
                </option>
              ))}
            </select>
          </label>
          {current?.type === "condition" ? (
            <>
              <label>
                Field path
                <input
                  value={current.config.path}
                  maxLength={100}
                  onChange={(e) =>
                    update({
                      ...current,
                      config: { ...current.config, path: e.target.value },
                    })
                  }
                />
              </label>
              <label>
                Comparison
                <select
                  aria-label="Comparison operator"
                  value={current.config.operator}
                  onChange={(e) =>
                    update({
                      ...current,
                      config: {
                        ...current.config,
                        operator: e.target.value as
                          "eq" | "gt" | "lt" | "is_null",
                      },
                    })
                  }
                >
                  <option value="eq">Equals (typed)</option>
                  <option value="gt">Greater than</option>
                  <option value="lt">Less than</option>
                  <option value="is_null">Is missing or null</option>
                </select>
              </label>
              <label>
                Expected value as JSON
                <input
                  aria-label="Expected value as JSON"
                  key={selected + ":value"}
                  value={
                    invalidValues[selected] ??
                    JSON.stringify(current.config.value)
                  }
                  aria-invalid={selected in invalidValues}
                  disabled={current.config.operator === "is_null"}
                  onChange={(e) => {
                    try {
                      const value: unknown = JSON.parse(e.target.value);
                      if (
                        value === null ||
                        (typeof value === "string" && value.length <= 500) ||
                        (typeof value === "number" && Number.isFinite(value)) ||
                        typeof value === "boolean"
                      ) {
                        update({
                          ...current,
                          config: { ...current.config, value },
                        });

                        setInvalidValues((values) => {
                          const next = { ...values };
                          delete next[selected];
                          return next;
                        });
                        setMessage("");
                      } else {
                        setInvalidValues((values) => ({
                          ...values,
                          [selected]: e.target.value,
                        }));
                        setMessage(
                          "Expected a JSON scalar, with strings up to 500 characters.",
                        );
                      }
                    } catch {
                      setInvalidValues((values) => ({
                        ...values,
                        [selected]: e.target.value,
                      }));
                      setMessage('Use JSON: "critical", 5, true or null.');
                    }
                  }}
                />
                <small>
                  Strings need quotes; numeric comparisons require numbers.
                </small>
              </label>
            </>
          ) : current?.type === "action" &&
            current.config.operation === "send_notification" ? (
            <label>
              Team recipient
              <select
                value={current.config.recipientId}
                onChange={(e) =>
                  update({
                    ...current,
                    config: {
                      provider: "email",
                      operation: "send_notification",
                      recipientId: e.target.value,
                    },
                  })
                }
              >
                {recipients.map((r) => (
                  <option key={r.user_id} value={r.user_id}>
                    {r.email}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            current && (
              <p className="quiet">
                Records a bounded internal audit entry when this action is
                reached.
              </p>
            )
          )}
          {current && (
            <button
              className="button button-secondary"
              type="button"
              onClick={() => {
                setNodes((ns) => ns.filter((n) => n.id !== selected));
                setEdges((es) =>
                  es.filter(
                    (e) => e.source !== selected && e.target !== selected,
                  ),
                );
                setSelected(nodes.find((n) => n.id !== selected)?.id ?? "");

                setPreview(null);
              }}
            >
              <Trash2 size={15} />
              Remove selected step
            </button>
          )}
        </aside>
      </div>
      <details className="studio-connections">
        <summary>Connections · keyboard and mobile controls</summary>
        <p className="quiet">
          Connect steps here or drag between the canvas handles. One entry, no
          cycles or joins.
        </p>
        <div className="studio-connect-fields">
          <label>
            From
            <select
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setBranch(
                  nodes.find((n) => n.id === e.target.value)?.data.node.type ===
                    "condition"
                    ? "true"
                    : "success",
                );
              }}
            >
              <option value="">Select step</option>
              {nodes.map((n) => (
                <option key={n.id}>{n.id}</option>
              ))}
            </select>
          </label>
          <label>
            Branch
            <select value={branch} onChange={(e) => setBranch(e.target.value)}>
              {nodes.find((n) => n.id === source)?.data.node.type ===
              "condition" ? (
                <>
                  <option value="true">True</option>
                  <option value="false">False</option>
                </>
              ) : (
                <option value="success">Success</option>
              )}
            </select>
          </label>
          <label>
            To
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Select step</option>
              {nodes
                .filter((n) => n.id !== source)
                .map((n) => (
                  <option key={n.id}>{n.id}</option>
                ))}
            </select>
          </label>
          <button
            className="button button-secondary"
            type="button"
            disabled={!source || !target}
            onClick={() =>
              connect({
                source,
                target,
                sourceHandle: branch,
                targetHandle: null,
              })
            }
          >
            Connect
          </button>
        </div>
        {edges.map((e) => (
          <div className="studio-edge" key={e.id}>
            <span>
              {e.source} → {e.sourceHandle} → {e.target}
            </span>
            <button
              type="button"
              aria-label={`Remove connection from ${e.source} to ${e.target}`}
              onClick={() =>
                setEdges((es) => es.filter((edge) => edge.id !== e.id))
              }
            >
              Remove
            </button>
          </div>
        ))}
      </details>
      <div className="studio-validation" role="status">
        {validation.errors.length ? (
          <>
            <strong>Resolve before saving</strong>
            <ul>
              {[...new Set(validation.errors)].map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </>
        ) : (
          <p>
            <Check size={16} />
            Valid workflow · {nodes.length} steps · One immutable contract
          </p>
        )}
      </div>
      <details className="studio-simulation">
        <summary>Test safely with a sample event</summary>
        <p className="quiet">
          Uses the same validator and deterministic evaluator as the worker.
          Runs locally; nothing is published or sent.
        </p>
        <label>
          Sample JSON
          <textarea
            rows={4}
            value={sample}
            maxLength={32768}
            onChange={(e) => {
              setSample(e.target.value);
              setPreview(null);
            }}
          />
        </label>
        <button
          className="button button-secondary"
          type="button"
          onClick={test}
          disabled={!validation.definition || inputError}
        >
          <Play size={15} />
          Simulate draft
        </button>
        {preview && (
          <div className="studio-test-result">
            <strong>
              {preview.qualified
                ? "Action path reached"
                : "No action path reached"}
            </strong>
            <ol className="run-timeline">
              {preview.trace.map((step) => (
                <li key={step.id}>
                  <strong>{step.id.replaceAll("_", " ")}</strong>
                  <span>{step.status.replaceAll("_", " ")}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </details>
      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
