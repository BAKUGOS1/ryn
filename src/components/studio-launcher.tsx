"use client";
import dynamic from "next/dynamic";
import { useId, useState } from "react";
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
  const [loaded, setLoaded] = useState(false);
  const regionId = useId();
  return (
    <div className="studio-launcher">
      <button
        className="button button-secondary"
        type="button"
        onClick={() => {
          setLoaded(true);
          setOpen(!open);
        }}
        aria-controls={regionId}
        aria-expanded={open}
      >
        {open ? "Close studio" : "Open visual editor"}
      </button>
      <div id={regionId} hidden={!open}>
        {loaded && <Studio {...props} />}
      </div>
    </div>
  );
}
