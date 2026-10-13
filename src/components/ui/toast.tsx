"use client";
import { useEffect } from "react";
import { X } from "lucide-react";
export function Toast({ message, tone = "info", onDismiss }: { message: string; tone?: "info" | "success" | "error"; onDismiss: () => void }) {
  useEffect(() => { if (tone === "error") return; const timer = window.setTimeout(onDismiss, 4000); return () => window.clearTimeout(timer); }, [onDismiss, tone]);
  return <div className={`ui-toast toast-${tone}`} role={tone === "error" ? "alert" : "status"}><span>{message}</span><button type="button" aria-label="Dismiss notification" onClick={onDismiss}><X size={16} /></button></div>;
}
