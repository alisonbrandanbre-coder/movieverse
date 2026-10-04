import { LoaderCircle } from "lucide-react";

export function LoadingState({ label = "Cargando…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-3 py-16 text-fg-secondary">
      <LoaderCircle className="size-8 animate-spin text-violet-light" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  );
}
