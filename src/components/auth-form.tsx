"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type AuthFormProps = { mode: "login" | "signup" };

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const isSignup = mode === "signup";
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      ...(isSignup ? { name: String(formData.get("name") ?? "") } : {}),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    };

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message = typeof result === "object" && result !== null && "error" in result
          ? String(result.error)
          : "Unable to complete your request.";
        setErrorMessage(message);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setErrorMessage("Could not reach EchoRank. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-8">
        <Link href="/" className="font-display text-sm font-semibold uppercase tracking-[0.22em] text-[var(--signal)]">
          EchoRank
        </Link>
        <h1 className="mt-8 font-display text-3xl font-semibold">
          {isSignup ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          {isSignup ? "Start tracking your brand’s AI search visibility." : "Sign in to continue to your workspace."}
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          {isSignup && (
            <div>
              <label className="mb-2 block text-sm text-[var(--text-muted)]" htmlFor="name">Name</label>
              <input
                autoComplete="name"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[var(--signal)] focus:ring-2 focus:ring-[var(--focus)]"
                id="name"
                maxLength={80}
                name="name"
                required
              />
            </div>
          )}
          <div>
            <label className="mb-2 block text-sm text-[var(--text-muted)]" htmlFor="email">Email</label>
            <input
              autoComplete="email"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[var(--signal)] focus:ring-2 focus:ring-[var(--focus)]"
              id="email"
              name="email"
              required
              type="email"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-[var(--text-muted)]" htmlFor="password">Password</label>
            <input
              autoComplete={isSignup ? "new-password" : "current-password"}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm outline-none focus:border-[var(--signal)] focus:ring-2 focus:ring-[var(--focus)]"
              id="password"
              minLength={isSignup ? 8 : 1}
              name="password"
              required
              type="password"
            />
          </div>

          {errorMessage && (
            <p className="rounded-lg border border-[var(--negative)]/40 bg-[var(--negative)]/10 px-3 py-2 text-sm text-[var(--negative)]" role="alert">
              {errorMessage}
            </p>
          )}

          <button
            className="w-full rounded-lg bg-[var(--signal)] px-4 py-3 text-sm font-semibold text-[var(--on-signal)] transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
          {isSignup ? "Already have an account? " : "New to EchoRank? "}
          <Link className="font-medium text-[var(--signal)] hover:underline" href={isSignup ? "/login" : "/signup"}>
            {isSignup ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </section>
    </main>
  );
}
