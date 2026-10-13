import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import type { gapOpportunities } from "@/lib/gaps";

type GapItem = ReturnType<typeof gapOpportunities>[number];

export function GapsWorkspace({ items, simulatedIncluded, brandId }: { items: GapItem[]; simulatedIncluded: boolean; brandId: string }) {
  const actionable = items.filter((item) => !item.lowData);
  return <div className="workspace-page gaps-page">
    <div className="page-heading"><p className="eyebrow">BRAND WORKSPACE</p><h1>Gap opportunities</h1><p>Prompts where tracked competitors appear while your brand is less visible. Opportunity is an observed association, not a prediction.</p></div>
    {simulatedIncluded && <Badge variant="simulated">simulated data included</Badge>}
    <Card className="gaps-card"><CardHeader><div><CardTitle>Prompt gaps</CardTitle><p>{items.length} opportunities · {actionable.length} with at least 3 answers</p></div></CardHeader><CardContent>
      {items.length ? <div className="gaps-table-wrap"><table className="gaps-table"><thead><tr><th>Prompt</th><th>Your rate</th><th>Top rival</th><th>Opportunity</th><th>Next steps</th></tr></thead><tbody>{items.map((item) => <tr key={item.promptId} className={item.lowData ? "gap-low-data" : undefined}>
        <td><span className="gap-prompt">{item.prompt}</span><small>{item.lowData ? `Low data · n=${item.answers}; interpret cautiously` : `Sample size n=${item.answers}`}</small></td>
        <td>{item.yourRate}% <small>n={item.yourMentions}/{item.answers}</small></td>
        <td><b>{item.topRival}</b><small>{item.rivalRate}% · n={item.rivalMentions}/{item.answers}</small></td>
        <td><div className="gap-score"><div className="gap-score-track"><span style={{ width: `${Math.min(item.opportunity * 100, 100)}%` }} /></div><b>{(item.opportunity * 100).toFixed(1)}%</b><small>n={item.answers}</small></div></td>
        <td><div className="gap-actions"><Link href={`/dashboard/${encodeURIComponent(brandId)}/tools/briefs?promptId=${encodeURIComponent(item.promptId)}`}>Generate brief</Link><button type="button" disabled title="Available after T026 (Discovery feed)">Find discussions</button></div></td>
      </tr>)}</tbody></table></div> : <EmptyState title="No gap opportunities in this scope" description="A prompt appears here when at least one active competitor was mentioned and your brand was not visible in every answer. Adjust the current filters or collect more tracking data." />}
      <p className="gaps-method">Score = top rival mention rate × (1 − your mention rate). Rows with fewer than 3 answers are greyed as low data. No search volume is inferred.</p>
    </CardContent></Card>
  </div>;
}
