import type { ButtonHTMLAttributes } from "react";

import { buttonClasses, type ButtonSize, type ButtonVariant } from "./buttonClasses";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = "primary", size = "md", className = "", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={`${buttonClasses({ variant, size })} ${className}`} {...props} />;
}
