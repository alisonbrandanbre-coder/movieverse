import { TriangleAlert } from "lucide-react";

import { Button } from "./Button";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = "Algo salió mal", message, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <div className="flex size-18 items-center justify-center rounded-full border border-danger-strong/40 bg-danger-strong/10">
        <TriangleAlert className="size-8 text-danger" aria-hidden />
      </div>
      <h2 className="font-display text-3xl tracking-wide text-fg">{title}</h2>
      <p className="text-fg-secondary">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
