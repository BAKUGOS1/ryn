"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionForm, post } from "./forms";
import { Button } from "./ui/button";
import type { Membership, Role } from "@/features/organizations/model";
export function InviteForm({ id, role }: { id: string; role: Role }) {
  const [link, setLink] = useState("");
  return (
    <>
      <ActionForm
        endpoint={`/api/organizations/${id}/invite`}
        submit="Create invite link"
        onSuccess={(data) =>
          setLink(window.location.origin + "/invite#" + data.token)
        }
      >
        <label>
          Email address
          <input
            name="email"
            type="email"
            placeholder="teammate@company.com"
            required
          />
        </label>
        <label>
          Workspace role
          <select name="role" defaultValue="editor">
            <option value="viewer">Viewer — read access</option>
            <option value="editor">Editor — future workflow editing</option>
            {role === "owner" && (
              <option value="admin">Admin — team and settings</option>
            )}
          </select>
        </label>
      </ActionForm>
      {link && (
        <div className="invite-result" role="status">
          <strong>Share this link with your teammate</strong>
          <p>
            Only the invited email can accept. Expires in 7 days. No email has
            been sent.
          </p>
          <input
            aria-label="Invitation link"
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
          />
        </div>
      )}
    </>
  );
}
export function MemberControls({
  id,
  member,
  actorRole,
}: {
  id: string;
  member: Membership;
  actorRole: Role;
}) {
  return (
    <ActionForm endpoint={`/api/organizations/${id}/member`} submit="Update">
      <input type="hidden" name="userId" value={member.user_id} />
      <label>
        Role for {member.email}
        <select name="role" defaultValue={member.role}>
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
          {actorRole === "owner" && <option value="admin">Admin</option>}
        </select>
      </label>
      <label>
        Access for {member.email}
        <select name="status" defaultValue={member.status}>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </label>
    </ActionForm>
  );
}
export function Revoke({ id, inviteId }: { id: string; inviteId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  return (
    <>
      <Button
        variant="secondary"
        onClick={async () => {
          try {
            await post(`/api/organizations/${id}/revoke`, { inviteId });
            router.refresh();
          } catch (e) {
            setStatus(e instanceof Error ? e.message : "Please retry.");
          }
        }}
      >
        Revoke
      </Button>
      {status && <p role="status">{status}</p>}
    </>
  );
}
export function SettingsForm({
  id,
  name,
  timezone,
}: {
  id: string;
  name: string;
  timezone: string;
}) {
  return (
    <ActionForm endpoint={`/api/organizations/${id}/settings`}>
      <label>
        Workspace name
        <input
          name="name"
          defaultValue={name}
          minLength={2}
          maxLength={80}
          required
        />
      </label>
      <label>
        Timezone
        <input
          name="timezone"
          defaultValue={timezone}
          list="timezones"
          required
        />
        <datalist id="timezones">
          <option value="Asia/Kolkata" />
          <option value="UTC" />
          <option value="Europe/London" />
          <option value="America/New_York" />
        </datalist>
        <small>Use an IANA timezone, such as Asia/Kolkata.</small>
      </label>
    </ActionForm>
  );
}
export function Archive({ id }: { id: string }) {
  const router = useRouter();
  return (
    <ActionForm
      endpoint={`/api/organizations/${id}/archive`}
      submit="Archive workspace"
      onSuccess={() => router.push("/app")}
    >
      <label>
        Type ARCHIVE to confirm
        <input
          name="confirmation"
          pattern="ARCHIVE"
          required
          autoComplete="off"
        />
      </label>
    </ActionForm>
  );
}
