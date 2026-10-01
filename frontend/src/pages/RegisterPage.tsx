import { Link, useNavigate } from "react-router";

import { PageContainer } from "@/components/layout/PageContainer";
import { RegisterForm } from "@/features/auth/components/RegisterForm";

export function RegisterPage() {
  const navigate = useNavigate();

  return (
    <PageContainer className="max-w-md py-16">
      <h1 className="mb-6 text-2xl font-bold text-white">Crear cuenta</h1>
      <RegisterForm onSuccess={() => navigate("/discover", { replace: true })} />
      <p className="mt-6 text-sm text-slate-400">
        ¿Ya tenés cuenta?{" "}
        <Link to="/login" className="text-violet-400 hover:underline">
          Iniciá sesión
        </Link>
      </p>
    </PageContainer>
  );
}
