"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
export async function post(path: string, payload: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Please retry.");
  return data;
}
export function ActionForm({
  endpoint,
  children,
  submit = "Save changes",
  transform,
  onSuccess,
}: {
  endpoint: string;
  children: React.ReactNode;
  submit?: string;
  transform?: (data: Record<string, FormDataEntryValue>) => unknown;
  onSuccess?: (data: Record<string, string>) => void;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const values = Object.fromEntries(new FormData(e.currentTarget));
      const data = await post(endpoint, transform ? transform(values) : values);
      setMessage(data.message ?? "Changes saved.");
      if (onSuccess) onSuccess(data);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={send} className="form-stack">
      {children}
      <Button disabled={busy}>{busy ? "Working…" : submit}</Button>
      {message && (
        <p role="status" className="form-message">
          {message}
        </p>
      )}
    </form>
  );
}
export function Logout() {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <>
      <Button
        variant="ghost"
        onClick={async () => {
          try {
            await post("/api/auth/logout", {});
            router.push("/auth/login");
            router.refresh();
          } catch {
            setError("Sign out failed. Retry.");
          }
        }}
      >
        Sign out
      </Button>
      {error && <span role="status">{error}</span>}
    </>
  );
}
export function CreateWorkspace() {
  const router = useRouter();
  return (
    <ActionForm
      endpoint="/api/organizations"
      submit="Create workspace"
      onSuccess={(data) => router.push("/app/" + data.id + "/overview")}
    >
      <label>
        Workspace name
        <input
          name="name"
          placeholder="Acme operations"
          minLength={2}
          maxLength={80}
          required
        />
      </label>
      <label>
        Workspace address
        <input
          name="slug"
          placeholder="acme-operations"
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          minLength={3}
          maxLength={40}
          required
        />
        <small>Lowercase letters, numbers and hyphens.</small>
      </label>
    </ActionForm>
  );
}
