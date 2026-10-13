import { notFound } from "next/navigation";
import { z } from "zod";
import { ReportWorkspace } from "@/components/report-workspace";
import { getSharedReport } from "@/lib/reports";

export const instant = false;

export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!z.string().regex(/^[A-Za-z0-9_-]{32}$/u).safeParse(token).success) notFound();
  const data = getSharedReport(token);
  if (!data) notFound();
  return <ReportWorkspace data={data} filters={{ range: "custom", from: data.range.from === "—" ? undefined : data.range.from, to: data.range.to === "—" ? undefined : data.range.to, includeSimulated: data.overview.simulatedIncluded }} shared />;
}
