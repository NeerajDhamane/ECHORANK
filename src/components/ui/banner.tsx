import type { HTMLAttributes, ReactNode } from "react";
import { clsx } from "clsx";
export function Banner({ tone = "info", icon, className, children, ...props }: HTMLAttributes<HTMLDivElement> & { tone?: "info" | "success" | "warning" | "error"; icon?: ReactNode }) { return <div role={tone === "error" ? "alert" : "status"} className={clsx("ui-banner", `banner-${tone}`, className)} {...props}>{icon && <span aria-hidden="true">{icon}</span>}<div>{children}</div></div>; }
