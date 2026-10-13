import type { HTMLAttributes } from "react";
import { clsx } from "clsx";
type BadgeVariant = "default" | "positive" | "negative" | "neutral" | "simulated" | "sent" | "priority" | "source";
export function Badge({ variant = "default", className, ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) { return <span className={clsx("ui-badge", `badge-${variant}`, className)} {...props} />; }
