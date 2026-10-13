"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

type Check = { id: string; ok: boolean; pts: number; detail: string; fix: string };
type HistoryItem = { id: string; url: string; score: number; createdAt: string };
type AuditResult = { url: string; score: number; elapsedMs: number; checks: Check[]; previousScore: number | null; delta: number | null; history: HistoryItem };

async function responseError(response: Response): Promise<string> {
  try { const body: unknown = await response.json(); if (typeof body === "object" && body !== null && "error" in body) return String(body.error); } catch { /* generic message below */ }
  return "Unable to complete the crawl audit.";
}

export function CrawlAuditWorkspace({ brandId, initialHistory }: { brandId: string; initialHistory: HistoryItem[] }) {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<AuditResult | null>(null);
  const [history, setHistory] = useState(initialHistory);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function audit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    try {
      const response = await fetch(`/api/brands/${encodeURIComponent(brandId)}/crawl-audit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
      if (!response.ok) { setError(await responseError(response)); return; }
      const value = await response.json() as AuditResult;
      setResult(value); setHistory((items) => [value.history, ...items].slice(0, 30));
    } catch { setError("Could not reach EchoRank. Please try again."); }
    finally { setPending(false); }
  }
  return <div className="workspace-page crawl-audit-page">
    <div className="page-heading"><p className="eyebrow">TOOLS</p><h1>Crawlability audit</h1><p>A lightweight approximation that checks page access and common AI-readiness signals. It is not a full site crawler.</p></div>
    <Card className="crawl-audit-form"><CardHeader><div><CardTitle>Audit a public page</CardTitle><p>Only HTTP and HTTPS on standard ports are checked. Private and local destinations are blocked.</p></div></CardHeader><CardContent><form onSubmit={audit}><label htmlFor="audit-url">Page URL</label><div><input id="audit-url" className="ui-input" type="url" required value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/page" /><Button type="submit" loading={pending} disabled={!url.trim()}>Run audit</Button></div>{error && <p className="form-error" role="alert">{error}</p>}</form></CardContent></Card>
    {result ? <Card className="crawl-audit-result"><CardHeader><div><CardTitle>Audit results</CardTitle><p className="crawl-audit-url">{result.url}</p></div></CardHeader><CardContent><div className="crawl-score-summary"><div className="score-ring" style={{ background: `conic-gradient(var(--signal) ${result.score}%, rgba(130,141,245,.14) 0)` }}><div><strong>{result.score}</strong><span>/ 100</span></div></div><div><b>{result.checks.filter((item) => item.ok).length} of {result.checks.length} checks passed</b><p>{result.elapsedMs} ms for the main page response</p><small>{result.previousScore === null ? "First audit for this workspace." : <>Previous {result.previousScore} → current {result.score} · {result.delta !== null && result.delta > 0 ? "+" : ""}{result.delta} points</>}</small></div></div><div className="crawl-check-list">{result.checks.map((check) => <article className={`crawl-check ${check.ok ? "crawl-check-pass" : "crawl-check-fail"}`} key={check.id}><header><b>{check.ok ? "✓" : "!"} {check.id}</b><span>{check.ok ? `+${check.pts}` : `${check.pts} pts available`}</span></header><p>{check.detail}</p>{!check.ok && <small>Fix: {check.fix}</small>}</article>)}</div><p className="crawl-audit-note">Robots guidance is per crawler: blocking an AI bot can be an intentional business choice. The audit does not assume every crawler should be allowed.</p></CardContent></Card> : <EmptyState title="Enter a public URL to begin" description="The audit checks response status and speed, robots rules, indexability, HTML content, metadata, headings, structured data, sitemap, and llms.txt." />}
    <Card className="crawl-audit-history"><CardHeader><div><CardTitle>Audit history</CardTitle><p>Recent audits for this brand workspace.</p></div></CardHeader><CardContent>{history.length ? <div>{history.map((item, index) => <article key={item.id}><span><b>{item.url}</b><small>{item.createdAt || "Just now"}</small></span><strong>{item.score}<small>{index + 1 < history.length ? `${item.score - history[index + 1]!.score >= 0 ? "+" : ""}${item.score - history[index + 1]!.score} vs previous` : "score"}</small></strong></article>)}</div> : <EmptyState title="No audits saved yet" description="Completed audits will appear here." />}</CardContent></Card>
  </div>;
}
