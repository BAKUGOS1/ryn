import { Workflow } from "lucide-react";
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-icon">
        <Workflow size={21} aria-hidden="true" />
      </span>
      ryn<span className="brand-dot">.</span>
    </span>
  );
}
