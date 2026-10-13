"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity, ArrowDownRight, ArrowUpRight, Minus, TrendingUp } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Stat } from "@/components/ui/stat";
import type { getOverview } from "@/lib/analytics";

type Overview = ReturnType<typeof getOverview>;
const COLORS = ["#ffb238", "#70cfa0", "#9d8cff", "#51bdd1", "#ed7d96", "#7d91b0"];
const PERCENT = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

export function OverviewDashboard({ brandId, overview, activePromptCount }: { brandId: string; overview: Overview; activePromptCount: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [movingAverage, setMovingAverage] = useState(false);
  function chatsHref(name?: string, value?: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (name && value) params.set(name, value);
    const query = params.toString();
    return query ? `/dashboard/${brandId}/chats?${query}` : `/dashboard/${brandId}/chats`;
  }
  const chartData = useMemo(() => overview.trend.map((run, index) => {
    const previous = overview.trend.slice(Math.max(0, index - 6), index + 1);
    const item: Record<string, string | number> = {
      runId: run.runId,
      date: new Date(`${run.startedAt.replace(" ", "T")}Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      sampleSize: run.sampleSize,
    };
    for (const brand of run.brands) {
      const values = previous.flatMap((point) => point.brands.filter((series) => series.brandId === brand.brandId).map((series) => series.visibility * 100));
      item[brand.brandId] = (movingAverage ? values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1) : brand.visibility * 100);
    }
    return item;
  }), [movingAverage, overview.trend]);

  return <div className="overview-page">
    {overview.simulatedIncluded && <Banner tone="warning" icon={<Activity size={16} />} className="overview-honesty">Simulated answers are included. Use these results as directional examples, not real provider measurements.</Banner>}
    <div className="overview-stat-grid">
      <Stat label="Visibility" value={overview.stats.visibility === null ? "—" : `${PERCENT.format(overview.stats.visibility)}%`} detail="Answers that mentioned your brand" sampleSize={overview.stats.visibilityN} icon={<TrendingUp size={17} />} />
      <Stat label="Average rank" value={overview.stats.averageRank === null ? "—" : PERCENT.format(overview.stats.averageRank)} detail="Lower is a stronger position" sampleSize={overview.stats.rankN} icon={<Activity size={17} />} />
      <Stat label="Positive sentiment" value={overview.stats.positiveSentiment === null ? "—" : `${PERCENT.format(overview.stats.positiveSentiment)}%`} detail="Among answers mentioning you" sampleSize={overview.stats.sentimentN} icon={<ArrowUpRight size={17} />} />
      <Stat label="Answers" value={overview.stats.answers.toLocaleString()} detail="Successful answers in this scope" icon={<Minus size={17} />} />
    </div>

    <Card className="overview-card overview-trend-card">
      <CardHeader><div><CardTitle>Visibility trend</CardTitle><p>Share of successful answers that mention each tracked brand.</p></div><label className="overview-toggle"><input type="checkbox" checked={movingAverage} onChange={(event) => setMovingAverage(event.target.checked)} /> 7-run moving average</label></CardHeader>
      <CardContent>{chartData.length ? <div className="overview-chart overview-trend-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 8, right: 18, left: -14, bottom: 4 }} onClick={(state) => { const index = typeof state.activeTooltipIndex === "number" ? state.activeTooltipIndex : -1; const runId = chartData[index]?.runId; if (typeof runId === "string") router.push(chatsHref("runId", runId)); }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="4 5" vertical={false} /><XAxis dataKey="date" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} unit="%" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip content={({ active, payload, label }) => active && payload?.length ? <div className="overview-tooltip"><strong>{label}</strong><small>n={String(payload[0]?.payload.sampleSize ?? 0)}</small>{payload.map((entry) => <p key={String(entry.dataKey)}><i style={{ background: String(entry.color) }} />{String(entry.name)} <b>{PERCENT.format(Number(entry.value))}%</b></p>)}</div> : null} /><Legend wrapperStyle={{ fontSize: 11, color: "var(--text-muted)" }} />
        {overview.trend[0]?.brands.map((brand, index) => <Line key={brand.brandId} type="monotone" dataKey={brand.brandId} name={brand.name} stroke={brand.brandId === brandId ? COLORS[0] : COLORS[(index + 1) % COLORS.length]} strokeWidth={brand.brandId === brandId ? 3 : 2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />)}
      </LineChart></ResponsiveContainer></div> : activePromptCount === 0 ? <EmptyState title="No active prompts yet" description="Add prompts to define what you want to track across AI answers." action={<Link className="button button-primary button-sm" href={`/dashboard/${brandId}/prompts`}>Add prompts</Link>} /> : <EmptyState title="No tracking data yet" description="Run tracking to collect answers and see how often AI platforms mention your brand." />}</CardContent>
      {chartData.length > 0 && <p className="overview-chart-hint">Select a run on the chart to open its Chats filter.</p>}
    </Card>

    <div className="overview-two-column">
      <Card className="overview-card"><CardHeader><div><CardTitle>Sentiment</CardTitle><p>Associated sentiment for answers that mention your brand.</p></div></CardHeader><CardContent>{overview.sentiment.n ? <><div className="overview-donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ name: "Positive", value: overview.sentiment.positive }, { name: "Neutral", value: overview.sentiment.neutral }, { name: "Negative", value: overview.sentiment.negative }]} dataKey="value" nameKey="name" innerRadius="63%" outerRadius="86%" paddingAngle={3} stroke="none">{COLORS.slice(0, 3).map((color, index) => <Cell key={color} fill={color} opacity={index === 1 ? 0.72 : 1} />)}</Pie><Tooltip formatter={(value, name) => [`${value} answers`, name]} /></PieChart></ResponsiveContainer><div className="overview-donut-center"><strong>{overview.sentiment.n}</strong><span>answers</span></div></div><div className="overview-legend">{[["Positive", overview.sentiment.positive, COLORS[0]], ["Neutral", overview.sentiment.neutral, COLORS[1]], ["Negative", overview.sentiment.negative, COLORS[2]]].map(([label, value, color]) => <span key={String(label)}><i style={{ background: String(color) }} />{String(label)} <b>{String(value)}</b></span>)}</div></> : <EmptyState title="No sentiment sample" description="Sentiment appears when an answer mentions your brand." />}</CardContent></Card>
      <Card className="overview-card"><CardHeader><div><CardTitle>Visibility by platform</CardTitle><p>Answers mentioning you, as a share of each platform&apos;s sample.</p></div></CardHeader><CardContent>{overview.platforms.length ? <div className="overview-chart overview-platform-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={overview.platforms} layout="vertical" margin={{ top: 3, right: 14, left: 8, bottom: 0 }} onClick={(state) => { const index = typeof state.activeTooltipIndex === "number" ? state.activeTooltipIndex : -1; const platform = overview.platforms[index]?.platform; if (platform) router.push(chatsHref("platform", platform)); }}><CartesianGrid stroke="var(--border)" strokeDasharray="4 5" horizontal={false} /><XAxis type="number" domain={[0, 100]} unit="%" tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="platform" width={110} tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value, _name, item) => [`${PERCENT.format(Number(value))}% · n=${String(item.payload.sampleSize)}`, "Visibility"]} /><Bar dataKey={(row) => row.visibility * 100} name="Visibility" fill={COLORS[0]} radius={[0, 5, 5, 0]} maxBarSize={24} /></BarChart></ResponsiveContainer></div> : <EmptyState title="No platform results" description="Platform results will appear after a completed tracking run." />}</CardContent><p className="overview-chart-hint">Select a platform to open matching Chats.</p></Card>
    </div>

    <Card className="overview-card"><CardHeader><div><CardTitle>Share of voice</CardTitle><p>Share of successful answers that mention each tracked brand.</p></div></CardHeader><CardContent>{overview.shareOfVoice.some((item) => item.sampleSize > 0) ? <div className="overview-chart overview-share-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={overview.shareOfVoice} layout="vertical" margin={{ top: 3, right: 40, left: 10, bottom: 0 }} onClick={(state) => { const index = typeof state.activeTooltipIndex === "number" ? state.activeTooltipIndex : -1; const item = overview.shareOfVoice[index]; if (item) router.push(chatsHref("brandFoundId", item.brandId)); }}><CartesianGrid stroke="var(--border)" strokeDasharray="4 5" horizontal={false} /><XAxis type="number" domain={[0, 100]} unit="%" tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" width={120} tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value, _name, item) => [`${PERCENT.format(Number(value))}% · n=${String(item.payload.sampleSize)}`, "Share of voice"]} /><Bar dataKey={(row) => row.share * 100} name="Share of voice" radius={[0, 5, 5, 0]} maxBarSize={24}>{overview.shareOfVoice.map((item, index) => <Cell key={item.brandId} fill={item.brandId === brandId ? COLORS[0] : COLORS[(index + 1) % COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer></div> : <EmptyState title="No share-of-voice sample" description="Run tracking to compare mentions across your brand and competitors." />}
        {overview.shareOfVoice.some((item) => item.sampleSize > 0) && <div className="overview-share-deltas">{overview.shareOfVoice.map((item) => <span key={item.brandId}><b>{item.name}</b>{item.brandId === brandId ? <em>You</em> : <em className={item.vsYou > 0 ? "delta-positive" : "delta-negative"}>{item.vsYou > 0 ? <ArrowUpRight size={12} /> : item.vsYou < 0 ? <ArrowDownRight size={12} /> : null}{PERCENT.format(Math.abs(item.vsYou * 100))} pp vs you</em>}<small>{PERCENT.format(item.share * 100)}% · n={item.mentions}/{item.sampleSize}</small></span>)}</div>}
      </CardContent></Card>

    <Card className="overview-card"><CardHeader><div><CardTitle>Top sources</CardTitle><p>Domains cited in answers within the current scope.</p></div></CardHeader><CardContent>{overview.sources.length ? <div className="overview-table-wrap"><table className="overview-table"><thead><tr><th>Domain</th><th>Type</th><th>Used</th><th>Avg. citations</th></tr></thead><tbody>{overview.sources.map((source) => <tr key={source.domain}><td><Link href={chatsHref("source", source.domain)}>{source.domain}</Link></td><td><Badge variant="source">{source.type}</Badge></td><td>{PERCENT.format(source.usedPercent)}% <small>n={source.answers}/{overview.stats.answers}</small></td><td>{PERCENT.format(source.averageCitations)}</td></tr>)}</tbody></table></div> : <EmptyState title="No cited sources yet" description="Sources will appear after tracked answers include citations." />}</CardContent></Card>

    <Card className="overview-card"><CardHeader><div><CardTitle>Recent chats</CardTitle><p>Latest successful answers in the current scope.</p></div><Link className="overview-view-all" href={chatsHref()}>View all chats →</Link></CardHeader><CardContent>{overview.recentChats.length ? <ul className="overview-recent-list">{overview.recentChats.map((chat) => <li key={chat.id}><Link href={chatsHref("promptId", chat.promptId)}><span className="overview-recent-prompt">{chat.prompt}</span><small>{chat.platform} · {chat.createdAt}</small></Link><div>{chat.isSimulated === 1 && <Badge variant="simulated">simulated</Badge>}<Badge variant={chat.mentioned ? "positive" : "neutral"}>{chat.mentioned ? "Mentioned" : "Not mentioned"}</Badge>{chat.sentiment && <Badge variant={chat.sentiment === "positive" ? "positive" : chat.sentiment === "negative" ? "negative" : "neutral"}>{chat.sentiment}</Badge>}</div></li>)}</ul> : <EmptyState title="No chats in this scope" description="Run tracking or adjust the date and platform filters to view answers." />}</CardContent></Card>
  </div>;
}
