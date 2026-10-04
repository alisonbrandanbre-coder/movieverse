import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import { getErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

import { loginSchema, type LoginFormValues } from "../schemas";
import { useAuth } from "../useAuth";

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const { login } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const mutation = useMutation({ mutationFn: login, onSuccess });

  return (
    <form noValidate onSubmit={handleSubmit((values) => mutation.mutate(values))} className="flex flex-col gap-5">
      <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
      <TextField
        label="Contraseña"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />
      {mutation.isError && (
        <p role="alert" className="rounded-control border border-danger-strong/40 bg-danger-strong/10 px-4 py-2.5 text-sm text-danger">
          {getErrorMessage(mutation.error, "No pudimos iniciar sesión.")}
        </p>
      )}
      <Button type="submit" size="lg" className="mt-1 w-full" disabled={mutation.isPending}>
        {mutation.isPending ? "Ingresando…" : "Entrar al universo"}
      </Button>
    </form>
  );
}
