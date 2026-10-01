import { forwardRef, useId, type InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, id, className = "", ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-slate-300">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={`rounded-lg border bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:outline-2 focus:outline-violet-400 ${error ? "border-rose-500" : "border-slate-700"} ${className}`}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-sm text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
});
