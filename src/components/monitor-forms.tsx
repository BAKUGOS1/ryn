"use client";
import { ActionForm } from "./forms";
export function CreateMonitor({
  organizationId,
  recipients,
}: {
  organizationId: string;
  recipients: { user_id: string; email: string }[];
}) {
  return (
    <ActionForm
      endpoint="/api/monitors"
      submit="Create paused monitor"
      transform={(v) => ({ ...v, intervalMinutes: Number(v.intervalMinutes) })}
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <label>
        Monitor name
        <input
          name="name"
          minLength={2}
          maxLength={80}
          placeholder="Customer portal"
          required
        />
      </label>
      <label>
        Public HTTPS endpoint
        <input
          name="url"
          type="url"
          placeholder="https://example.com/health"
          maxLength={2048}
          required
        />
        <small>
          Approved hosts only. Redirects, query strings and private networks are
          blocked.
        </small>
      </label>
      <label>
        Check every
        <select name="intervalMinutes" defaultValue="15">
          <option value="15">15 minutes</option>
          <option value="30">30 minutes</option>
          <option value="60">1 hour</option>
          <option value="1440">24 hours</option>
        </select>
      </label>
      <label>
        Notify a verified team member
        <select name="recipientId" required>
          {recipients.map((r) => (
            <option value={r.user_id} key={r.user_id}>
              {r.email}
            </option>
          ))}
        </select>
      </label>
    </ActionForm>
  );
}
export function MonitorState({
  organizationId,
  id,
  state,
}: {
  organizationId: string;
  id: string;
  state: "active" | "paused";
}) {
  return (
    <ActionForm
      endpoint={"/api/monitors/" + id}
      submit={state === "active" ? "Pause monitor" : "Activate monitor"}
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <input
        type="hidden"
        name="state"
        value={state === "active" ? "paused" : "active"}
      />
    </ActionForm>
  );
}
