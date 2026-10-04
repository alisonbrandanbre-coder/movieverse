import { Link, useLocation, useNavigate } from "react-router";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { LoginForm } from "@/features/auth/components/LoginForm";

function redirectTarget(state: unknown): string {
  if (typeof state === "object" && state !== null && "from" in state && typeof state.from === "string") {
    return state.from;
  }
  return "/";
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <AuthLayout
      title="Iniciá sesión"
      subtitle="Tu universo te está esperando."
      footer={
        <>
          ¿No tenés cuenta?{" "}
          <Link to="/register" className="font-semibold text-violet-soft hover:underline">
            Creá tu cuenta
          </Link>
        </>
      }
    >
      <LoginForm onSuccess={() => navigate(redirectTarget(location.state), { replace: true })} />
    </AuthLayout>
  );
}
