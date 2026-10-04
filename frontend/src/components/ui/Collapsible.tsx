import type { ReactNode } from "react";

interface CollapsibleProps {
  open: boolean;
  /** Referenced by the toggle's `aria-controls`. */
  id: string;
  children: ReactNode;
  className?: string;
}

/**
 * A region that expands and collapses smoothly (its height animates from 0 to its content
 * with a grid-rows transition; instant with reduced motion). Closed, it is `inert` and hidden
 * from assistive technology, so its controls cannot be reached.
 */
export function Collapsible({ open, id, children, className = "" }: CollapsibleProps) {
  return (
    <div
      id={id}
      aria-hidden={!open}
      inert={!open}
      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
    >
      <div className="min-h-0 overflow-hidden">
        <div className={className}>{children}</div>
      </div>
    </div>
  );
}
