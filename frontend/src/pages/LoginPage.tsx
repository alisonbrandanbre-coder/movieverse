import { Link, useLocation, useNavigate } from "react-router";

import { PageContainer } from "@/components/layout/PageContainer";
import { LoginForm } from "@/features/auth/components/LoginForm";

function redirectTarget(state: unknown): string {
  if (typeof state === "object" && state !== null && "from" in state && typeof state.from === "string") {
    return state.from;
  }
  return "/discover";
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <PageContainer className="max-w-md py-16">
      <h1 className="mb-6 text-2xl font-bold text-white">Iniciar sesión</h1>
      <LoginForm onSuccess={() => navigate(redirectTarget(location.state), { replace: true })} />
      <p className="mt-6 text-sm text-slate-400">
        ¿No tenés cuenta?{" "}
        <Link to="/register" className="text-violet-400 hover:underline">
          Registrate
        </Link>
      </p>
    </PageContainer>
  );
}
