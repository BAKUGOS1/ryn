"use client";
import { useState } from "react";
import { ActionForm } from "./forms";
import { definitionSchema } from "@/features/automations/schema";
export function CreateAutomation({
  organizationId,
  recipients,
  canCreateWebhook,
}: {
  organizationId: string;
  recipients: { user_id: string; email: string }[];
  canCreateWebhook: boolean;
}) {
  const [kind, setKind] = useState<"deadline" | "webhook">("deadline");
  const [credentials, setCredentials] = useState<{
    sourceId: string;
    secret: string;
  } | null>(null);
  return (
    <>
      <ActionForm
        endpoint="/api/automations"
        submit="Create draft workflow"
        transform={(v) => ({
          organizationId,
          definition: definitionSchema.parse({
            schemaVersion: 1,
            name: v.name,
            trigger:
              kind === "webhook"
                ? { type: "webhook.signed", config: {} }
                : {
                    type: "deadline.once",
                    config: {
                      at:
                        String(v.deadlineAt) +
                        ":00" +
                        (v.timezone === "Asia/Kolkata" ? "+05:30" : "Z"),
                      timezone: v.timezone,
                      leadMinutes: Number(v.leadMinutes),
                    },
                  },
            nodes: [
              ...(kind === "webhook"
                ? [
                    {
                      id: "priority",
                      type: "condition",
                      config: {
                        path: String(v.path),
                        operator: "eq",
                        value: String(v.value),
                      },
                    },
                  ]
                : []),
              {
                id: "notify",
                type: "action",
                config: {
                  provider: "email",
                  operation: "send_notification",
                  recipientId: v.recipientId,
                },
              },
            ],
            edges:
              kind === "webhook"
                ? [{ from: "priority", to: "notify", when: "true" }]
                : [],
          }),
        })}
        onSuccess={(data) => {
          if (data.secret)
            setCredentials({ sourceId: data.sourceId, secret: data.secret });
        }}
      >
        <label>
          Workflow name
          <input
            name="name"
            minLength={2}
            maxLength={80}
            placeholder="Critical event notification"
            required
          />
        </label>
        <label>
          Trigger
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "webhook" | "deadline")}
          >
            <option value="deadline">One-time deadline</option>
            {canCreateWebhook && (
              <option value="webhook">Signed webhook</option>
            )}
          </select>
        </label>
        {kind === "webhook" ? (
          <>
            <label>
              Event field
              <input
                name="path"
                defaultValue="priority"
                required
                maxLength={100}
              />
            </label>
            <label>
              Notify when this field equals
              <input
                name="value"
                defaultValue="critical"
                maxLength={500}
                required
              />
            </label>
          </>
        ) : (
          <>
            <label>
              Deadline date and time
              <input type="datetime-local" name="deadlineAt" required />
            </label>
            <label>
              Timezone
              <select name="timezone">
                <option value="Asia/Kolkata">
                  India (Asia/Kolkata, UTC+05:30)
                </option>
                <option value="UTC">UTC</option>
              </select>
            </label>
            <label>
              Minutes before deadline
              <input
                type="number"
                name="leadMinutes"
                min={0}
                max={43200}
                defaultValue={60}
                required
              />
            </label>
          </>
        )}
        <label>
          Notify team member
          <select name="recipientId" required>
            {recipients.map((r) => (
              <option value={r.user_id} key={r.user_id}>
                {r.email}
              </option>
            ))}
          </select>
        </label>
      </ActionForm>
      {credentials && (
        <div className="invite-result" role="status">
          <strong>Save your webhook signing secret now</strong>
          <p>Shown once. Publish the draft before sending events.</p>
          <label>
            Source ID
            <input readOnly value={credentials.sourceId} />
          </label>
          <label>
            Signing secret
            <input
              readOnly
              value={credentials.secret}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <p>Endpoint: /api/events/webhook/{credentials.sourceId}</p>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setCredentials(null)}
          >
            I’ve saved the secret
          </button>
        </div>
      )}
    </>
  );
}
export function EditAutomation({
  organizationId,
  id,
  revision,
  definition,
}: {
  organizationId: string;
  id: string;
  revision: number;
  definition: unknown;
}) {
  return (
    <ActionForm
      endpoint={`/api/automations/${id}/save`}
      submit="Save a new draft"
      transform={(v) => ({
        organizationId,
        revision,
        definition: definitionSchema.parse(JSON.parse(String(v.definition))),
      })}
    >
      <label>
        Workflow JSON
        <textarea
          name="definition"
          defaultValue={JSON.stringify(definition, null, 2)}
          rows={14}
          maxLength={7500}
          required
          spellCheck={false}
        />
        <small>
          Published versions stay immutable. Saving does not change active
          executions.
        </small>
      </label>
    </ActionForm>
  );
}
export function WorkflowAction({
  organizationId,
  id,
  revision,
  action,
  state,
}: {
  organizationId: string;
  id: string;
  revision?: number;
  action: "publish" | "state";
  state?: "active" | "paused" | "archived";
}) {
  return (
    <ActionForm
      endpoint={`/api/automations/${id}/${action}`}
      submit={
        action === "publish"
          ? "Validate & publish"
          : state === "paused"
            ? "Pause"
            : state === "active"
              ? "Resume"
              : "Archive"
      }
      transform={() => ({
        organizationId,
        ...(revision ? { revision } : {}),
        ...(state ? { state } : {}),
      })}
    >
      <span className="quiet">
        {action === "publish"
          ? "Publishes the saved draft with current recipient permissions."
          : state === "archived"
            ? "Archive stops future events. This cannot be resumed from the app."
            : ""}
      </span>
    </ActionForm>
  );
}
export function RotateWebhook({
  organizationId,
  id,
}: {
  organizationId: string;
  id: string;
}) {
  const [secret, setSecret] = useState("");
  return (
    <>
      <ActionForm
        endpoint={`/api/automations/${id}/rotate`}
        submit="Rotate signing secret"
        transform={() => ({ organizationId })}
        onSuccess={(data) => setSecret(data.secret)}
      >
        <p className="quiet">The previous secret stops working immediately.</p>
      </ActionForm>
      {secret && (
        <label>
          New secret — shown once
          <input readOnly value={secret} onFocus={(e) => e.target.select()} />
          <button
            className="button button-secondary"
            type="button"
            onClick={() => setSecret("")}
          >
            I’ve saved it
          </button>
        </label>
      )}
    </>
  );
}
