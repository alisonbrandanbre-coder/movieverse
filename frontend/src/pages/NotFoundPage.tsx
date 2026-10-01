import { Link } from "react-router";

import { EmptyState } from "@/components/ui/EmptyState";

export function NotFoundPage() {
  return (
    <EmptyState title="Página no encontrada" description="La página que buscás no existe.">
      <Link to="/" className="text-violet-400 hover:underline">
        Volver al inicio
      </Link>
    </EmptyState>
  );
}
