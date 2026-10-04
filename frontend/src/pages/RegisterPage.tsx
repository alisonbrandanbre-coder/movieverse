import { Link, useNavigate } from "react-router";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { RegisterForm } from "@/features/auth/components/RegisterForm";

export function RegisterPage() {
  const navigate = useNavigate();

  return (
    <AuthLayout
      title="Creá tu cuenta"
      subtitle="Empezá a trazar tu propia constelación."
      footer={
        <>
          ¿Ya tenés cuenta?{" "}
          <Link to="/login" className="font-semibold text-violet-soft hover:underline">
            Iniciá sesión
          </Link>
        </>
      }
    >
      <RegisterForm onSuccess={() => navigate("/onboarding", { replace: true })} />
    </AuthLayout>
  );
}
