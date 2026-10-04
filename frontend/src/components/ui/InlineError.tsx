import { TriangleAlert } from "lucide-react";

import { Button } from "./Button";

/**
 * Compact error for a section inside a page (a carousel row, a side list): one line and a
 * "Reintentar", where a full `ErrorState` would be too big.
 */
export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex w-full flex-wrap items-center gap-3 rounded-card border border-dashed border-danger-strong/40 px-5 py-4 text-sm text-fg-secondary"
    >
      <TriangleAlert className="size-4 shrink-0 text-danger" aria-hidden />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
