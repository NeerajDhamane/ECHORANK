"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { DiscoveryItem } from "@/lib/discovery/types";

type Prompt = { id: string; text: string };
type Status = "all" | "new" | "saved" | "dismissed";

export function DiscoveryWorkspace({ brandId, prompts, initialItems, hasReddit }: { brandId: string; prompts: Prompt[]; initialItems: DiscoveryItem[]; hasReddit: boolean }) {
  const [items, setItems] = useState(initialItems);
  const [status, setStatus] = useState<Status>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [pendingId, setPendingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const base = `/api/brands/${encodeURIComponent(brandId)}/discovery`;

  async function load(nextStatus: Status) {
    setStatus(nextStatus); setError("");
    try {
      const query = nextStatus === "all" ? "" : `?status=${nextStatus}`;
      const response = await fetch(`${base}${query}`);
      if (!response.ok) throw new Error("Unable to load discovery items.");
      setItems(await response.json() as DiscoveryItem[]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load discovery items."); }
  }

  async function refresh() {
    setRefreshing(true); setError(""); setNotice("");
    try {
      const response = await fetch(`${base}/refresh`, { method: "POST" });
      const result = await response.json() as { promptsSearched?: number; itemsFound?: number; sourceFailures?: number; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Refresh failed.");
      setNotice(`Searched ${result.promptsSearched ?? 0} prompts; received ${result.itemsFound ?? 0} results${result.sourceFailures ? `; ${result.sourceFailures} source searches were unavailable` : ""}.`);
      await load(status);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Refresh failed."); }
    finally { setRefreshing(false); }
  }

  async function changeStatus(itemId: string, nextStatus: "saved" | "dismissed") {
    setPendingId(itemId); setError("");
    try {
      const response = await fetch(`${base}/${encodeURIComponent(itemId)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: nextStatus }) });
      if (!response.ok) throw new Error("Unable to update this item.");
      await load(status);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update this item."); }
    finally { setPendingId(""); }
  }

  const promptMap = new Map(prompts.map((prompt) => [prompt.id, prompt.text]));
  return <div className="workspace-page discovery-page">
    <div className="page-heading"><p className="eyebrow">INSIGHTS</p><h1>Discovery</h1><p>Public discussions related to your tracked prompts. Results are search matches, not endorsements or recommendations.</p></div>
    <p className="discovery-ethics">Read the thread, then reply as yourself if you genuinely have something useful to add.</p>
    <Card><CardHeader><div><CardTitle>Public discussions</CardTitle><p>Hacker News and Stack Exchange work without credentials.{hasReddit ? " Reddit search is enabled." : " Reddit is added only when its API credentials are configured."}</p></div><Button type="button" loading={refreshing} disabled={!prompts.length} onClick={refresh}>Refresh feed</Button></CardHeader><CardContent>
      {error && <p role="alert" className="form-error">{error}</p>}{notice && <p role="status" className="form-success">{notice}</p>}
      <nav className="discovery-tabs" aria-label="Filter discussions">{(["all", "new", "saved", "dismissed"] as const).map((tab) => <button key={tab} type="button" aria-pressed={status === tab} onClick={() => void load(tab)}>{tab === "all" ? "All" : `${tab[0]!.toUpperCase()}${tab.slice(1)}`}</button>)}</nav>
      {items.length ? <div className="discovery-list">{items.map((item) => <article className="discovery-item" key={item.id}>
        <div className="discovery-item-heading"><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title} <span aria-hidden="true">↗</span></a><span className="discovery-score">{item.relevance.toFixed(2)}</span></div>
        <p className="discovery-meta">{item.platform === "hn" ? "Hacker News" : item.platform === "reddit" ? "Reddit" : "Stack Exchange"} · {item.subreddit ?? "Public discussion"} · score {item.score} · {item.numComments} comments</p>
        <p className="discovery-why">Matched search: {promptMap.get(item.promptId ?? "") ?? "tracked prompt"}</p>
        <div className="discovery-actions"><a className="button button-secondary button-sm" href={item.url} target="_blank" rel="noopener noreferrer">Open ↗</a>{item.status !== "saved" && <Button type="button" size="sm" disabled={pendingId === item.id} onClick={() => void changeStatus(item.id, "saved")}>Save</Button>}{item.status !== "dismissed" && <Button type="button" size="sm" variant="ghost" disabled={pendingId === item.id} onClick={() => void changeStatus(item.id, "dismissed")}>Dismiss</Button>}<span className="discovery-status">{item.status}</span></div>
      </article>)}</div> : <EmptyState title={prompts.length ? "No discussions in this view" : "Add prompts to start discovery"} description={prompts.length ? "Refresh to search public discussions for up to 10 active prompts. Results depend on what each source makes available." : "The feed uses active prompts from this workspace to search public sources."} />}
      <p className="discovery-caveat">Discovery only searches and displays public discussions. EchoRank never posts, replies, votes, or messages on external sites. Relevance is a transparent heuristic.</p>
    </CardContent></Card>
  </div>;
}
