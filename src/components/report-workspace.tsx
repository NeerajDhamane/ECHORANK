"use client";
import { useState } from "react";
import type { ReportData, ReportShare } from "@/lib/reports";
import { Button } from "@/components/ui/button";

type Filters = { range: "7d" | "30d" | "90d" | "custom"; from?: string; to?: string; includeSimulated: boolean; platform?: string; promptId?: string; tagId?: string; locale?: string };
function percent(value: number | null) { return value === null ? "—" : `${value.toFixed(1)}%`; }
function count(value: number | null) { return value === null ? "—" : value.toFixed(2); }

export function ReportWorkspace({ brandId, data, filters, initialShares, shared = false }: { brandId?: string; data: ReportData; filters: Filters; initialShares?: ReportShare[]; shared?: boolean }) {
  const [shares, setShares] = useState(initialShares ?? []);
  const [pending, setPending] = useState(false);
  const [range, setRange] = useState(filters.range);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const base = brandId ? `/api/brands/${encodeURIComponent(brandId)}/report-shares` : "";
  const exportQuery = new URLSearchParams({ range: filters.range, ...(filters.from ? { from: filters.from } : {}), ...(filters.to ? { to: filters.to } : {}), ...(filters.platform ? { platform: filters.platform } : {}), ...(filters.promptId ? { promptId: filters.promptId } : {}), ...(filters.tagId ? { tagId: filters.tagId } : {}), ...(filters.locale ? { locale: filters.locale } : {}), includeSimulated: String(filters.includeSimulated) }).toString();

  async function createShare() {
    if (!brandId) return;
    setPending(true); setError(""); setNotice("");
    try {
      const response = await fetch(base, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(filters) });
      const result = await response.json() as { id?: string; token?: string; createdAt?: string; error?: string };
      if (!response.ok || !result.id || !result.token) throw new Error(result.error ?? "Unable to create the share link.");
      setShares((items) => [{ id: result.id!, token: result.token!, createdAt: result.createdAt ?? "Just now" }, ...items]);
      setNotice("Snapshot link created. Anyone with the link can view this frozen report.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create the share link."); }
    finally { setPending(false); }
  }

  async function revoke(id: string) {
    setPending(true); setError("");
    try {
      const response = await fetch(`${base}/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to revoke this share link.");
      setShares((items) => items.filter((item) => item.id !== id)); setNotice("Share link revoked.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to revoke this share link."); }
    finally { setPending(false); }
  }

  return <div className={`report-workspace${shared ? " report-public" : ""}`}>
    {!shared && <div className="report-controls no-print">
      <form method="get" className="report-range-form"><label>Range <select name="range" value={range} onChange={(event) => setRange(event.target.value as Filters["range"])}><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="custom">Custom</option></select></label>{range === "custom" && <><label>From <input type="date" name="from" defaultValue={filters.from ?? ""} required /></label><label>To <input type="date" name="to" defaultValue={filters.to ?? ""} required /></label></>}{filters.platform && <input type="hidden" name="platform" value={filters.platform} />}{filters.promptId && <input type="hidden" name="promptId" value={filters.promptId} />}{filters.tagId && <input type="hidden" name="tagId" value={filters.tagId} />}{filters.locale && <input type="hidden" name="locale" value={filters.locale} />}<label className="report-simulated-toggle"><input type="checkbox" name="includeSimulated" value="true" defaultChecked={filters.includeSimulated} /> Include simulated data</label><Button type="submit" size="sm">Update</Button></form>
      <div className="report-control-actions"><Button type="button" onClick={() => window.print()}>Download PDF</Button><a className="button button-secondary" href={`/api/brands/${encodeURIComponent(brandId ?? "")}/export.csv?table=chats&${exportQuery}`}>Chats CSV</a><a className="button button-secondary" href={`/api/brands/${encodeURIComponent(brandId ?? "")}/export.csv?table=ranking&${exportQuery}`}>Ranking CSV</a><a className="button button-secondary" href={`/api/brands/${encodeURIComponent(brandId ?? "")}/export.csv?table=sources&${exportQuery}`}>Sources CSV</a><Button type="button" loading={pending} onClick={createShare}>Create share link</Button></div>
      {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
      {shares.length > 0 && <div className="report-share-list"><h2>Share snapshots</h2>{shares.map((share) => <div key={share.id}><a href={`/r/${encodeURIComponent(share.token)}`} target="_blank" rel="noopener noreferrer">/r/{share.token}</a><small>{share.createdAt}</small><Button type="button" size="sm" onClick={() => { void navigator.clipboard.writeText(new URL(`/r/${share.token}`, window.location.origin).toString()).then(() => setNotice("Share link copied to clipboard.")); }}>Copy link</Button><Button type="button" size="sm" variant="danger" disabled={pending} onClick={() => void revoke(share.id)}>Revoke</Button></div>)}</div>}
    </div>}
    <article className="report-sheet">
      <header className="report-header"><p className="report-eyebrow">ECHORANK · VISIBILITY REPORT</p><h1>{data.brand.name}</h1><p>{data.brand.website ?? ""}{data.brand.industry ? ` · ${data.brand.industry}` : ""}</p><p>Period: {data.range.from} to {data.range.to} · Generated {data.generatedAt}</p><p>Data: {data.overview.stats.answers} answers · {data.promptCount} prompts · {data.overview.platforms.length} platforms</p>{filters.includeSimulated && <span className="report-simulated-badge">SIMULATED DATA INCLUDED</span>}</header>
      <section className="report-section"><h2>Key indicators</h2><div className="report-kpis"><div><strong>{percent(data.overview.stats.visibility)}</strong><span>Visibility · n={data.overview.stats.visibilityN}</span></div><div><strong>{count(data.overview.stats.averageRank)}</strong><span>Average rank · n={data.overview.stats.rankN}</span></div><div><strong>{percent(data.overview.stats.positiveSentiment)}</strong><span>Positive sentiment · n={data.overview.stats.sentimentN}</span></div></div></section>
      <section className="report-section page-break"><h2>Monthly trend</h2><table><thead><tr><th scope="col">Month</th><th scope="col">Visibility</th><th scope="col">Answers (n)</th><th scope="col">Positive sentiment</th><th scope="col">Sentiment n</th><th scope="col">Average rank</th><th scope="col">Rank n</th></tr></thead><tbody>{data.monthly.map((item) => <tr key={item.month}><th scope="row">{item.month}</th><td>{percent(item.visibility)}</td><td>{item.answers}</td><td>{percent(item.positiveSentiment)}</td><td>{item.sentimentN}</td><td>{count(item.averageRank)}</td><td>{item.rankN}</td></tr>)}</tbody></table></section>
      <section className="report-section"><h2>Prompt performance</h2><table><thead><tr><th scope="col">Prompt</th><th scope="col">Visibility</th><th scope="col">Change vs previous equal period</th><th scope="col">Answers (n)</th></tr></thead><tbody>{data.prompts.length ? data.prompts.map((item) => <tr key={item.promptId}><th scope="row">{item.prompt}</th><td>{percent(item.visibility)}</td><td>{item.delta === null ? "—" : `${item.delta > 0 ? "+" : ""}${item.delta.toFixed(1)} pts`}</td><td>{item.answers}</td></tr>) : <tr><td colSpan={4}>No prompt answers in this range.</td></tr>}</tbody></table><p>Showing the top {data.prompts.length} prompts by answer count. Change is unavailable if the previous period has no sample.</p></section>
      <section className="report-section"><h2>Competitor comparison</h2><table><thead><tr><th scope="col">Brand</th><th scope="col">Visibility</th><th scope="col">Change</th><th scope="col">Average rank</th><th scope="col">Sentiment (0–100)</th><th scope="col">Mentions / n</th></tr></thead><tbody>{data.ranking.items.map((item) => <tr key={item.brandId}><th scope="row">{item.isOwn ? `${item.name} (you)` : item.name}</th><td>{percent(item.visibility)}</td><td>{item.delta === null ? "—" : `${item.delta > 0 ? "+" : ""}${item.delta.toFixed(1)} pts`}</td><td>{count(item.averageRank)}</td><td>{item.sentiment === null ? "n/a" : `${item.sentiment.toFixed(0)}/100`} · n={item.sentimentN}</td><td>{item.mentions} / {item.sampleSize}</td></tr>)}</tbody></table></section>
      <section className="report-section"><h2>Top cited sources</h2><table><thead><tr><th scope="col">Domain</th><th scope="col">Type</th><th scope="col">Answers using source / n</th><th scope="col">Used</th><th scope="col">Citations</th></tr></thead><tbody>{data.sources.domains.slice(0, 10).map((item) => <tr key={item.domain}><th scope="row">{item.domain}</th><td>{item.type}</td><td>{item.answers} / {data.sources.answers}</td><td>{percent(item.usedPercent)}</td><td>{item.citations}</td></tr>)}</tbody></table>{data.sources.domains.length === 0 && <p>No citations were recorded in this range.</p>}</section>
      <section className="report-section"><h2>Gap opportunities</h2>{data.gaps.length ? <table><thead><tr><th scope="col">Prompt</th><th scope="col">Top rival</th><th scope="col">Opportunity</th><th scope="col">Answers (n)</th></tr></thead><tbody>{data.gaps.map((item) => <tr key={item.promptId}><th scope="row">{item.prompt}</th><td>{item.topRival}</td><td>{(item.opportunity * 100).toFixed(1)}%</td><td>{item.answers}</td></tr>)}</tbody></table> : <p>No positive prompt gaps were found in this sample.</p>}</section>
      <section className="report-section"><h2>Open recommendations</h2>{data.recommendations.length ? data.recommendations.map((item) => <div className="report-recommendation" key={item.id}><h3>{item.title}</h3><p>{item.detail}</p><small>{item.category} · {item.priority} priority · Evidence: {item.evidence ?? "Not recorded"}</small></div>) : <p>No open recommendations.</p>}</section>
      <footer className="report-methodology"><h2>Methodology &amp; limitations</h2><p>Visibility is the share of successful tracked answers that mentioned a brand. Sentiment percentages use only own-brand mentions with a recorded sentiment. Values describe this sample and are associated with the tracked questions; they do not establish causes. AI answers vary between runs.</p><p>Sample in this range: n={data.overview.stats.answers} successful answers · {data.promptCount} prompts · {data.overview.platforms.length} platforms. Real answers: {data.simulation.real} · Simulated answers: {data.simulation.simulated}. {filters.includeSimulated ? "Simulated answers are included in headline values above." : "Simulated answers are excluded from headline values above."}</p><p>Period: {data.range.from} to {data.range.to}. Ranking, sentiment, and prompt deltas have their own displayed sample counts where available. Source usage denominators are successful answers in the same range.</p></footer>
    </article>
  </div>;
}
