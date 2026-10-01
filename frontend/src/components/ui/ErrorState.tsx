import { TriangleAlert } from "lucide-react";

import { Button } from "./Button";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = "Algo salió mal", message, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <TriangleAlert className="size-10 text-amber-400" aria-hidden />
      <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      <p className="text-sm text-slate-400">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
