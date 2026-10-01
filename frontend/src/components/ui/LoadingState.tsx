import { LoaderCircle } from "lucide-react";

export function LoadingState({ label = "Cargando…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
      <LoaderCircle className="size-8 animate-spin text-violet-400" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  );
}
