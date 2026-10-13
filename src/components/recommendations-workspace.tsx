"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { listRecommendations } from "@/lib/recommendations";

type Recommendation = ReturnType<typeof listRecommendations>[number];
const GROUPS = [
  { id: "authority", title: "Off-page / Authority" },
  { id: "content", title: "On-page / Content" },
  { id: "technical", title: "Technical" },
];

function formatEvidence(value: string | null): Array<[string, string]> {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return [];
    return Object.entries(parsed as Record<string, unknown>).map(([key, item]) => [key, typeof item === "string" ? item : JSON.stringify(item)]);
  } catch { return [["evidence", value]]; }
}

export function RecommendationsWorkspace({ brandId, initialItems }: { brandId: string; initialItems: Recommendation[] }) {
  const [items, setItems] = useState(initialItems);
  const [showDone, setShowDone] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const shown = items.filter((item) => showDone || item.status !== "done");

  async function changeStatus(item: Recommendation, status: string) {
    if (status !== "open" && status !== "in_progress" && status !== "done") return;
    setSavingId(item.id);
    setErrorMessage("");
    try {
      const response = await fetch(`/api/brands/${encodeURIComponent(brandId)}/recommendations/${encodeURIComponent(item.id)}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Unable to update this recommendation.");
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status } : entry));
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : "Unable to update this recommendation.");
    } finally { setSavingId(null); }
  }

  return <div className="workspace-page recommendations-page">
    <div className="page-heading"><p className="eyebrow">BRAND WORKSPACE</p><h1>Recommendations</h1><p>Evidence-linked suggestions based on your tracked answers. These heuristics describe associations, not causes.</p></div>
    <div className="recommendations-toolbar"><span>{shown.length} recommendation{shown.length === 1 ? "" : "s"}</span><label><input type="checkbox" checked={showDone} onChange={(event) => setShowDone(event.target.checked)} /> Show done</label></div>
    {errorMessage && <p className="recommendations-error" role="alert">{errorMessage}</p>}
    {shown.length === 0 ? <EmptyState title="No recommendations yet" description="Recommendations appear after a completed real-data tracking run crosses a documented threshold." /> : GROUPS.map((group) => {
      const groupItems = shown.filter((item) => item.category === group.id);
      if (!groupItems.length) return null;
      return <section className="recommendation-group" key={group.id} aria-labelledby={`rec-group-${group.id}`}><h2 id={`rec-group-${group.id}`}>{group.title}</h2><div className="recommendation-cards">{groupItems.map((item) => <Card className="recommendation-card" key={item.id}>
        <CardHeader><div><div className="recommendation-card-title"><CardTitle>{item.title}</CardTitle><Badge variant="priority" className={`recommendation-priority priority-${item.priority}`}>{item.priority}</Badge></div><p>{item.detail}</p></div></CardHeader>
        <CardContent><div className="recommendation-evidence"><h3>Evidence</h3><dl>{formatEvidence(item.evidence).map(([key, value]) => <div key={key}><dt>{key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())}</dt><dd>{value}</dd></div>)}</dl></div><details className="recommendation-basis"><summary>Why this rule?</summary><p>{item.basis}</p></details><div className="recommendation-actions"><small>Created {item.createdAt}</small><label>Status<select aria-label={`Status for ${item.title}`} value={item.status} disabled={savingId === item.id} onChange={(event) => void changeStatus(item, event.target.value)}><option value="open">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select></label></div></CardContent>
      </Card>)}</div></section>;
    })}
    <p className="recommendations-footnote">Rules R8 and R9 will evaluate crawl and structured-data evidence when Crawlability audit is implemented. Simulated answers are excluded.</p>
  </div>;
}
