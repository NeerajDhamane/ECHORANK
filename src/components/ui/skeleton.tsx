import { clsx } from "clsx";
export function Skeleton({ className, width }: { className?: string; width?: string }) { return <span className={clsx("ui-skeleton", className)} style={width ? { width } : undefined} aria-hidden="true" />; }
