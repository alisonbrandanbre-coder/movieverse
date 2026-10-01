import { z } from "zod";

const email = z.string().trim().min(1, "Ingresá tu email").pipe(z.email("Ingresá un email válido"));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Ingresá tu contraseña"),
});

export const registerSchema = z
  .object({
    email,
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres")
      .max(128, "La contraseña es demasiado larga"),
    confirmPassword: z.string().min(1, "Repetí la contraseña"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden",
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
