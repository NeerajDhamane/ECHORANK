import type { ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md"; loading?: boolean };
export function Button({ variant = "secondary", size = "md", loading = false, disabled, className, children, ...props }: ButtonProps) {
  return <button className={clsx("button", `button-${variant}`, size === "sm" && "button-sm", className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>{loading && <span className="button-spinner" aria-hidden="true" />}{children}</button>;
}
