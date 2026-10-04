import { useId, type ReactElement, type ReactNode } from "react";

interface TooltipProps {
  text: string;
  /** Receives the tooltip id, to wire it as `aria-describedby`. */
  children: (tooltipId: string) => ReactElement;
  className?: string;
}

/**
 * Small hover/focus tooltip. Works on disabled buttons too: give the button
 * `pointer-events-none` so the hover lands on this wrapper.
 */
export function Tooltip({ text, children, className = "" }: TooltipProps): ReactNode {
  const id = useId();
  return (
    <span className={`group/tooltip relative inline-flex ${className}`}>
      {children(id)}
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-control border border-line-strong bg-raised px-3 py-1.5 text-xs font-semibold text-fg opacity-0 shadow-poster transition group-focus-within/tooltip:opacity-100 group-hover/tooltip:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
