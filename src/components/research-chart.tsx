"use client";

import { Bar, BarChart, CartesianGrid, Cell, ErrorBar, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ResearchModel } from "@/lib/research-page";

const VERSION_LABELS = { plain: "Plain", faq: "FAQ", stats: "Statistics-dense" } as const;
const COLORS = { plain: "#7c9cff", faq: "#ffb238", stats: "#6fcf97" } as const;

export function ResearchChart({ model }: { model: ResearchModel }) {
  const data = model.versions.map((item) => ({
    ...item,
    label: VERSION_LABELS[item.version],
    ratePercent: item.rate === null ? 0 : item.rate * 100,
    interval: item.rate === null || item.ci95 === null
      ? [0, 0]
      : [(item.rate - item.ci95.low) * 100, (item.ci95.high - item.rate) * 100],
  }));

  return (
    <div className="research-chart" role="img" aria-label={`Citation rates with Wilson 95% confidence intervals for ${model.model}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 28, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="4 5" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" width={112} tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(value, _name, item) => {
            const row = item.payload;
            return [`${Number(value).toFixed(1)}% · n=${row.citedTrials}/${row.trials}`, "Citation rate"];
          }} />
          <Bar dataKey="ratePercent" name="Citation rate" radius={[0, 5, 5, 0]} maxBarSize={28}>
            {data.map((item) => <Cell key={item.version} fill={COLORS[item.version]} />)}
            <ErrorBar dataKey="interval" direction="x" stroke="#edeff5" strokeWidth={1.5} width={4} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
