import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { getRanking } from "@/lib/ranking";

type Ranking = ReturnType<typeof getRanking>;
const pct = (value: number | null) => value === null ? "n/a" : `${value.toFixed(1)}%`;

export function RankingWorkspace({ ranking, simulatedIncluded, exportUrl }: { ranking: Ranking; simulatedIncluded: boolean; exportUrl: string }) {
  return <div className="workspace-page ranking-page">
    <div className="page-heading"><p className="eyebrow">BRAND WORKSPACE</p><h1>Ranking comparison</h1><p>Compare how often your brand and competitors appear in tracked answers.</p></div>
    {simulatedIncluded && <Badge variant="simulated">simulated data included</Badge>}
    <Card className="ranking-card"><CardHeader><div><CardTitle>Visibility by brand</CardTitle><p>Visibility is the share of sampled answers mentioning each brand. Δ compares the immediately preceding equal length window.</p></div><a className="ranking-export" href={exportUrl}>Export CSV</a></CardHeader><CardContent>
      {ranking.sampleSize ? <div className="ranking-table-wrap"><table className="ranking-table"><thead><tr><th scope="col">Brand</th><th scope="col">Visibility</th><th scope="col">Δ</th><th scope="col">Sentiment</th><th scope="col">Avg. rank</th><th scope="col">Mentions</th></tr></thead><tbody>{ranking.items.map((item) => <tr key={item.brandId} className={item.isOwn ? "ranking-own" : undefined}>
        <th scope="row"><b>{item.name}</b>{item.isOwn && <Badge>You</Badge>}</th>
        <td>{pct(item.visibility)}<small>n={item.mentions}/{item.sampleSize}</small></td>
        <td>{item.delta === null ? "n/a" : `${item.delta >= 0 ? "+" : ""}${item.delta.toFixed(1)} pp`}<small>{item.delta === null ? "no previous sample" : `n=${item.previousMentions}/${item.previousSampleSize}`}</small></td>
        <td>{item.sentiment === null ? "n/a" : `${item.sentiment.toFixed(0)}/100`}<small>n={item.sentimentN}</small></td>
        <td>{item.averageRank === null ? "n/a" : item.averageRank.toFixed(1)}</td><td>{item.mentions}<small>n={item.sampleSize}</small></td>
      </tr>)}</tbody></table></div> : <EmptyState title="No ranking data in this scope" description="Collect tracking answers or adjust the current filters to compare brand visibility." />}
      <p className="ranking-method">Visibility uses successful answers as its denominator. Sentiment is the average of each brand’s recorded sentiment scores; sentiment is shown on a 0–100 scale. Missing historical samples are shown as n/a.</p>
    </CardContent></Card>
  </div>;
}
