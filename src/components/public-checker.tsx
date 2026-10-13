"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { PublicCheckResult } from "@/lib/public-check";

export function PublicChecker() {
  const startedAt = useRef(0);
  const [result, setResult] = useState<PublicCheckResult | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { startedAt.current = Date.now(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setMessage(""); setResult(null);
    try {
      const response = await fetch("/api/public/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ brand: form.get("brand"), question: form.get("question"), website: form.get("website"), startedAt: startedAt.current }) });
      const data: unknown = await response.json();
      if (!response.ok) { setMessage(typeof data === "object" && data && "error" in data ? String(data.error) : "The check failed."); return; }
      setResult(data as PublicCheckResult);
    } catch { setMessage("Could not reach the checker. Please try again."); }
    finally { setBusy(false); }
  }

  return <>
    <form className="public-check-form" onSubmit={submit}>
      <label>Brand name<input name="brand" maxLength={60} required placeholder="e.g. Acme Cloud" /></label>
      <label>What would you ask AI?<textarea name="question" maxLength={200} required rows={3} placeholder="e.g. What are reliable tools for a growing team?" /></label>
      <label className="honeypot" aria-hidden="true" tabIndex={-1}>Leave this field empty<input name="website" autoComplete="off" tabIndex={-1} /></label>
      <button className="button button-primary" disabled={busy}>{busy ? "Checking…" : "Check my brand"}</button>
    </form>
    {message && <p role="alert" className="public-check-message">{message}</p>}
    {result && <section className="public-check-results" aria-live="polite">
      {result.simulated && <p className="simulated-banner"><strong>DEMO MODE: SIMULATED</strong> — no AI provider key is configured, so these answers are illustrative.</p>}
      <h2>{result.mentionedCount} of {result.sampleSize} answers mentioned {"your brand"}</h2>
      <p>Sample size n={result.sampleSize}. Mention range: {result.variability.mentionsMin}–{result.variability.mentionsMax}; positions: {result.variability.positionMin ?? "—"}–{result.variability.positionMax ?? "—"}.</p>
      <p>Sentiment among mentions: {result.sentiment.positive} positive, {result.sentiment.neutral} neutral, {result.sentiment.negative} negative (n={result.sentiment.n}). Average position: {result.averagePosition?.toFixed(1) ?? "—"}.</p>
      <h3>Other names mentioned</h3><p>{result.otherNames.length ? result.otherNames.join(", ") : "No other names detected."}</p>
      <h3>Top cited sources</h3>{result.topSources.length ? <ul>{result.topSources.map((source) => <li key={source.domain}>{source.domain} · {source.answers} answers</li>)}</ul> : <p>No citations detected.</p>}
      <h3>Answers <small>(select to expand)</small></h3>{result.samples.map((sample, index) => <details key={index}><summary>Sample {index + 1}: {sample.mentioned ? "brand mentioned" : "not mentioned"}</summary><p>{sample.answer}</p></details>)}
      <p className="sample-caption">AI answers vary — this is a small sample.</p>
    </section>}
  </>;
}
