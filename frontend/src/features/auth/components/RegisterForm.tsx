import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import { ApiError, getErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

import { registerSchema, type RegisterFormValues } from "../schemas";
import { useAuth } from "../useAuth";

function serverFieldError(error: unknown, field: "email" | "password"): string | undefined {
  if (!(error instanceof ApiError) || !error.details) return undefined;
  const value = error.details[field];
  return Array.isArray(value) ? value[0] : value;
}

export function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const auth = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) });

  const mutation = useMutation({
    mutationFn: ({ email, password }: RegisterFormValues) => auth.register({ email, password }),
    onSuccess,
  });

  const passwordServerError = serverFieldError(mutation.error, "password");

  return (
    <form noValidate onSubmit={handleSubmit((values) => mutation.mutate(values))} className="flex flex-col gap-4">
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        error={errors.email?.message ?? serverFieldError(mutation.error, "email")}
        {...register("email")}
      />
      <TextField
        label="Contraseña"
        type="password"
        autoComplete="new-password"
        error={errors.password?.message ?? passwordServerError}
        {...register("password")}
      />
      <TextField
        label="Repetir contraseña"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
      {mutation.isError && !passwordServerError && (
        <p role="alert" className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {getErrorMessage(mutation.error, "No pudimos crear tu cuenta.")}
        </p>
      )}
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Creando cuenta…" : "Crear cuenta"}
      </Button>
    </form>
  );
}
