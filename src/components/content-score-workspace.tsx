"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/input";
import type { ContentScoreHistoryItem } from "@/lib/content-scores";
import type { scoreAndSaveContent } from "@/lib/content-scores";

type ScoreResult = ReturnType<typeof scoreAndSaveContent>;
async function responseError(response: Response): Promise<string> {
  try { const body: unknown = await response.json(); if (typeof body === "object" && body !== null && "error" in body) return String(body.error); } catch { /* generic message below */ }
  return "Unable to score this content.";
}

export function ContentScoreWorkspace({ brandId, initialHistory }: { brandId: string; initialHistory: ContentScoreHistoryItem[] }) {
  const [content, setContent] = useState("");
  const [label, setLabel] = useState("");
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [history, setHistory] = useState(initialHistory);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function score(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/brands/${encodeURIComponent(brandId)}/content-score`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content, ...(label.trim() ? { label: label.trim() } : {}) }) });
      if (!response.ok) { setError(await responseError(response)); return; }
      const scored = await response.json() as ScoreResult;
      setResult(scored); setHistory((items) => [scored.history, ...items].slice(0, 50)); setNotice("Score saved to this workspace.");
    } catch { setError("Could not reach EchoRank. Please try again."); }
    finally { setPending(false); }
  }

  return <div className="workspace-page content-score-page">
    <div className="page-heading"><p className="eyebrow">TOOLS</p><h1>Content score</h1><p>A transparent checklist for readability and page structure. It does not predict citations or search rankings.</p></div>
    <Card className="content-score-input"><CardHeader><div><CardTitle>Score pasted content</CardTitle><p>Paste draft text or HTML. URL fetching will be available after the safe-fetch task.</p></div></CardHeader><CardContent><form onSubmit={score}>
      <label htmlFor="content-label">Draft label <span>(optional)</span></label><input id="content-label" className="ui-input" maxLength={80} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. Product page before edits" />
      <label htmlFor="content-to-score">Content</label><Textarea id="content-to-score" required maxLength={100000} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Paste page text or HTML here…" />
      {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
      <div className="content-score-form-footer"><span>{content.length.toLocaleString()} / 100,000 characters</span><Button type="submit" loading={pending} disabled={!content.trim()}>Score content</Button></div>
    </form></CardContent></Card>
    {result ? <Card className="content-score-result"><CardHeader><div><CardTitle>Content structure score</CardTitle><p>Each point comes from one of the checks below. This score is a heuristic, not a performance guarantee.</p></div></CardHeader><CardContent>
      <div className="content-score-summary"><div className="score-ring" style={{ background: `conic-gradient(var(--signal) ${result.score}%, rgba(130,141,245,.14) 0)` }}><div><strong>{result.score}</strong><span>/ 100</span></div></div><div><b>{result.passed.length} of {result.checks.length} checks passed</b><p>{result.previousScore === null ? "First saved score for this workspace." : <>Previous {result.previousScore} → current {result.score} · {result.delta !== null && result.delta > 0 ? "+" : ""}{result.delta} points</>}</p><small>{result.features.wordCount} words · {result.features.sentenceCount} sentences · Flesch {result.features.fleschReadingEase}</small></div></div>
      <div className="content-check-columns"><section><h3>Passed</h3>{result.passed.length ? result.passed.map((check) => <div className="content-check passed" key={check.label}><b>✓ {check.label}</b><span>+{check.pts} pts</span></div>) : <p className="content-score-muted">No checks passed yet.</p>}</section><section><h3>Needs attention</h3>{result.failed.length ? result.failed.map((check) => <div className="content-check failed" key={check.label}><b>{check.label}</b><span>{check.pts} pts available</span><p>Fix: {check.fix}</p></div>) : <p className="content-score-muted">All checks passed.</p>}</section></div>
    </CardContent></Card> : <EmptyState title="Paste a draft to get started" description="The scorer checks FAQ structure, readability, sentence length, headings, lists, JSON-LD, substance, and passive voice." />}
    <Card className="content-score-history"><CardHeader><div><CardTitle>Score history</CardTitle><p>Saved scores for this brand workspace.</p></div></CardHeader><CardContent>{history.length ? <div className="content-history-list">{history.map((item, index) => <div key={item.id}><span><b>{item.label || "Untitled draft"}</b><small>{item.createdAt || "Just now"}</small></span><strong>{item.score}<small>{index + 1 < history.length ? `${item.score - history[index + 1]!.score >= 0 ? "+" : ""}${item.score - history[index + 1]!.score} vs previous` : "score"}</small></strong></div>)}</div> : <EmptyState title="No saved scores yet" description="Your saved scoring attempts will appear here." />}</CardContent></Card>
  </div>;
}
