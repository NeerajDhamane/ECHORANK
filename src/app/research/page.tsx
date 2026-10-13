import { ResearchResultsView } from "@/components/research-results";
import { readResearchResults } from "@/lib/research-page";

export const metadata = { title: "Research | EchoRank" };

export default function ResearchPage() {
  return <ResearchResultsView results={readResearchResults()} />;
}
