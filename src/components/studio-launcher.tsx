"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
const Studio = dynamic(() => import("./workflow-studio"), {
  ssr: false,
  loading: () => <p role="status">Opening the workflow studio…</p>,
});
export function StudioLauncher(props: {
  organizationId: string;
  id: string;
  revision: number;
  definition: unknown;
  recipients: { user_id: string; email: string }[];
  allowSave?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="studio-launcher">
      <button
        className="button button-secondary"
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {open ? "Close studio" : "Open visual editor"}
      </button>
      {open && <Studio {...props} />}
    </div>
  );
}
