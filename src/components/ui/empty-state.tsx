import type { ReactNode } from "react";
export function EmptyState({ title, description, action, icon }: { title: string; description: string; action?: ReactNode; icon?: ReactNode }) { return <div className="ui-empty" role="status">{icon && <div className="empty-icon" aria-hidden="true">{icon}</div>}<h2>{title}</h2><p>{description}</p>{action}</div>; }
