import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { clsx } from "clsx";
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) { return <input className={clsx("ui-input", className)} {...props} />; }
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) { return <select className={clsx("ui-input", className)} {...props}>{children}</select>; }
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea className={clsx("ui-input ui-textarea", className)} {...props} />; }
