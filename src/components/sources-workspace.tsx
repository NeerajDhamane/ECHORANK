"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { getSources } from "@/lib/sources";

type SourcesData = ReturnType<typeof getSources>;
const SOURCE_COLORS = ["#f4b14a", "#65cfa1", "#828df5", "#ed8279", "#49b8cc", "#ba86e8", "#a2aabd", "#d1a65b"];

export function SourcesWorkspace({ data, simulatedIncluded }: { data: SourcesData; simulatedIncluded: boolean }) {
  const [tab, setTab] = useState<"domains" | "urls">("domains");
  const [gapOnly, setGapOnly] = useState(false);
  const shown = gapOnly ? data.gapDomains : data.domains;
  return <div className="workspace-page sources-page">
    <div className="page-heading"><p className="eyebrow">BRAND WORKSPACE</p><h1>Sources</h1><p>See which domains appear in successful AI answers within the current filter scope.</p></div>
    {simulatedIncluded && <Badge variant="simulated">simulated data included</Badge>}
    <div className="sources-summary"><span><b>{data.domains.length}</b> domains</span><span><b>{data.totalCitations}</b> citations</span><span><b>{data.answers}</b> answers in scope</span></div>
    <div className="sources-layout">
      <Card className="sources-card sources-chart-card"><CardHeader><div><CardTitle>Source types</CardTitle><p>{data.totalCitations} total citations in this scope</p></div></CardHeader><CardContent>
        {data.typeBreakdown.length ? <><div className="sources-donut" role="img" aria-label={`Citations by source type, ${data.totalCitations} total`}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.typeBreakdown} dataKey="citations" nameKey="type" innerRadius="60%" outerRadius="88%" paddingAngle={3} stroke="none">{data.typeBreakdown.map((item, index) => <Cell key={item.type} fill={SOURCE_COLORS[index % SOURCE_COLORS.length]} />)}</Pie><Tooltip formatter={(value, name) => [`${String(value)} citations`, String(name)]} /></PieChart></ResponsiveContainer><div className="sources-donut-center"><strong>{data.totalCitations}</strong><span>citations</span></div></div><div className="sources-type-legend">{data.typeBreakdown.map((item, index) => <span key={item.type}><i style={{ background: SOURCE_COLORS[index % SOURCE_COLORS.length] }} />{item.type}<b>{item.citations}</b></span>)}</div></> : <EmptyState title="No cited sources yet" description="Sources appear after successful tracked answers include citations." />}
      </CardContent></Card>
      <Card className="sources-card sources-table-card"><CardHeader><div><CardTitle>Domains and URLs</CardTitle><p>Usage is measured against all successful answers in the current scope.</p></div></CardHeader><CardContent>
        <div className="sources-controls" role="group" aria-label="Source view"><button type="button" aria-pressed={tab === "domains"} className={tab === "domains" ? "sources-tab sources-tab-active" : "sources-tab"} onClick={() => setTab("domains")}>Domains</button><button type="button" aria-pressed={tab === "urls"} className={tab === "urls" ? "sources-tab sources-tab-active" : "sources-tab"} onClick={() => setTab("urls")}>URLs</button><label className="sources-gap-toggle"><input type="checkbox" checked={gapOnly} onChange={(event) => setGapOnly(event.target.checked)} /> Gap analysis</label></div>
        {tab === "urls" ? <EmptyState title="Citation URLs are not stored" description="This handoff schema retains normalized domains, not individual URL paths. Switch to Domains to review the available citation evidence." /> : shown.length ? <div className="sources-table-wrap"><table className="sources-table"><thead><tr><th scope="col">Domain</th><th scope="col">Used</th><th scope="col">Avg. citations</th><th scope="col">Type</th><th scope="col">Cited with</th></tr></thead><tbody>{shown.map((source) => <tr key={source.domain}><th scope="row"><a href={`https://${source.domain}`} target="_blank" rel="noreferrer">{source.domain}</a></th><td>{source.usedPercent.toFixed(1)}% <small>n={source.answers}/{data.answers}</small></td><td>{source.averageCitations.toFixed(2)}</td><td><Badge variant="source">{source.type}</Badge></td><td><div className="sources-brands">{source.citedWith.length ? source.citedWith.map((brand) => <span key={brand}>{brand}</span>) : <small>Unattributed</small>}</div></td></tr>)}</tbody></table></div> : <EmptyState title={gapOnly ? "No source gaps in this scope" : "No cited sources yet"} description={gapOnly ? "A gap requires a domain cited alongside a competitor and never alongside your brand in the selected scope." : "Sources appear after successful tracked answers include citations."} />}
      </CardContent></Card>
    </div>
  </div>;
}
