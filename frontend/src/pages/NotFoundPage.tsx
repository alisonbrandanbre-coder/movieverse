import { Link } from "react-router";

import { buttonClasses } from "@/components/ui/buttonClasses";
import { EmptyState } from "@/components/ui/EmptyState";

export function NotFoundPage() {
  return (
    <EmptyState title="Página no encontrada" description="Esta estrella no existe en nuestro universo.">
      <Link to="/" className={buttonClasses({ variant: "secondary" })}>
        Volver al inicio
      </Link>
    </EmptyState>
  );
}
