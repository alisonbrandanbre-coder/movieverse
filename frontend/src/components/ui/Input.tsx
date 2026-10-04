import type { LucideIcon } from "lucide-react";
import { forwardRef, type InputHTMLAttributes } from "react";

type Size = "md" | "lg";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Decorative icon shown inside the field, on the left. */
  icon?: LucideIcon;
  invalid?: boolean;
  inputSize?: Size;
  /** Violet border with a halo, for the page's main field (e.g. the search bar). */
  emphasis?: boolean;
}

const SIZES: Record<Size, string> = { md: "py-2.5 text-sm", lg: "py-3.5 text-md" };

/** Bare styled input. Use `TextField` when the field needs a visible label and error. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { icon: Icon, invalid = false, inputSize = "md", emphasis = false, className = "", ...props },
  ref,
) {
  const border = invalid ? "border-danger-strong" : emphasis ? "border-violet-light/70 shadow-halo" : "border-line";
  const input = (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`w-full rounded-control border bg-deep/70 px-4 text-fg placeholder:text-fg-muted/80 transition focus:border-focus focus:shadow-halo focus:outline-none ${SIZES[inputSize]} ${Icon ? "pl-11" : ""} ${border} ${className}`}
      {...props}
    />
  );
  if (!Icon) return input;
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-violet-light" aria-hidden />
      {input}
    </div>
  );
});
