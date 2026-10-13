"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

type Prompt = { id: string; text: string };
type Brief = { id: string; promptId: string; brief: string; enriched: boolean };
function renderMarkdown(source: string) {
  return source.split(/\n\s*\n/).filter(Boolean).map((block, index) => {
    const lines = block.split("\n");
    const heading = /^(#{1,3})\s+(.+)$/.exec(lines[0] ?? "");
    if (heading) {
      const Tag = heading[1]!.length === 1 ? "h2" : heading[1]!.length === 2 ? "h3" : "h4";
      return <Tag key={index}>{heading[2]}</Tag>;
    }
    if (lines.every((line) => /^-\s+/.test(line))) return <ul key={index}>{lines.map((line, item) => <li key={item}>{line.replace(/^-\s+/, "")}</li>)}</ul>;
    if (lines.every((line) => /^\d+\.\s+/.test(line))) return <ol key={index}>{lines.map((line, item) => <li key={item}>{line.replace(/^\d+\.\s+/, "")}</li>)}</ol>;
    return <p key={index}>{lines.map((line, item) => <span key={item}>{line.replace(/\*\*(.+?)\*\*/g, "$1")}{item < lines.length - 1 && <br />}</span>)}</p>;
  });
}

export function BriefWorkspace({ brandId, prompts, initialPromptId }: { brandId: string; prompts: Prompt[]; initialPromptId: string }) {
  const [promptId, setPromptId] = useState(initialPromptId);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function generate() {
    setPending(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/brands/${encodeURIComponent(brandId)}/briefs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ promptId }) });
      const result = await response.json() as Brief | { error?: string };
      if (!response.ok || !("brief" in result)) { setError("error" in result ? result.error ?? "Unable to generate brief." : "Unable to generate brief."); return; }
      setBrief(result); setNotice(result.enriched ? "Draft enriched with a configured real provider. Review all claims before use." : "Deterministic brief saved. Unknown details are marked [FILL IN].");
    } catch { setError("Could not reach EchoRank. Please try again."); }
    finally { setPending(false); }
  }
  function download() {
    if (!brief) return;
    const url = URL.createObjectURL(new Blob([brief.brief], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "echorank-content-brief.md"; anchor.click(); URL.revokeObjectURL(url);
  }
  return <div className="workspace-page brief-page">
    <div className="page-heading"><p className="eyebrow">TOOLS</p><h1>Content brief</h1><p>Build a writing outline from this workspace’s tracked rival descriptions and cited domains. Verify claims before publishing.</p></div>
    <Card><CardHeader><div><CardTitle>Choose a buyer question</CardTitle><p>Unknown brand details remain [FILL IN]. No-key mode uses a deterministic brief.</p></div></CardHeader><CardContent>
      {prompts.length ? <><label htmlFor="brief-prompt">Tracked prompt</label><select id="brief-prompt" className="ui-input" value={promptId} onChange={(event) => { setPromptId(event.target.value); setBrief(null); }}>
        {prompts.map((prompt) => <option value={prompt.id} key={prompt.id}>{prompt.text}</option>)}
      </select><div className="brief-controls"><Button type="button" loading={pending} disabled={!promptId} onClick={generate}>Generate brief</Button>{error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}</div></> : <EmptyState title="No active prompts yet" description="Add a prompt to this brand before generating a brief." />}
    </CardContent></Card>
    {brief && <Card><CardHeader><div><CardTitle>Generated brief</CardTitle><p>Saved to this brand workspace. Confirm evidence and fill all placeholders before use.</p></div></CardHeader><CardContent><div className="brief-actions"><Button type="button" onClick={() => { void navigator.clipboard.writeText(brief.brief).then(() => setNotice("Brief copied to clipboard.")); }}>Copy</Button><Button type="button" variant="secondary" onClick={download}>Download .md</Button><Link href={`/dashboard/${encodeURIComponent(brandId)}/tools/content-score`}><Button type="button" variant="secondary">Score my draft</Button></Link></div><article className="brief-markdown">{renderMarkdown(brief.brief)}</article></CardContent></Card>}
  </div>;
}
