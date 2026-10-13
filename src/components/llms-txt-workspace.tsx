"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GENERATED_BOTS, buildLlmsTxt, buildRobots, siteSitemapUrl, type GeneratedBot, type LlmsPage } from "@/lib/llms-txt";

type PageRow = LlmsPage & { id: number };
type FileKind = "llms.txt" | "robots.txt";
const emptyPage = (id: number): PageRow => ({ id, title: "", url: "", note: "" });

export function LlmsTxtWorkspace({ brandId, brandName }: { brandId: string; brandName: string }) {
  const [name, setName] = useState(brandName);
  const [summary, setSummary] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [contactUrl, setContactUrl] = useState("");
  const [pages, setPages] = useState<PageRow[]>([emptyPage(1)]);
  const [nextPageId, setNextPageId] = useState(2);
  const [allow, setAllow] = useState<Record<GeneratedBot, boolean>>(() => Object.fromEntries(GENERATED_BOTS.map((bot) => [bot, true])) as Record<GeneratedBot, boolean>);
  const [file, setFile] = useState<FileKind>("llms.txt");
  const [notice, setNotice] = useState("");
  const siteMap = siteSitemapUrl(siteUrl);
  const llmsText = buildLlmsTxt({ name, summary, pages, ...(contactUrl.trim() ? { contactUrl } : {}) });
  const robotsText = siteMap ? buildRobots(siteMap, allow) : "# Enter a valid public HTTP or HTTPS site URL to generate robots.txt.\n";
  const preview = file === "llms.txt" ? llmsText : robotsText;

  function updatePage(id: number, field: keyof LlmsPage, value: string) {
    setPages((current) => current.map((page) => page.id === id ? { ...page, [field]: value } : page));
  }
  function addPage() { setPages((current) => [...current, emptyPage(nextPageId)]); setNextPageId((id) => id + 1); }
  async function copy() {
    try { await navigator.clipboard.writeText(preview); setNotice(`${file} copied to clipboard.`); }
    catch { setNotice("Clipboard access is unavailable in this browser. Select and copy the preview text."); }
  }
  function download() {
    const blob = new Blob([preview], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = file; link.click(); URL.revokeObjectURL(link.href);
    setNotice(`${file} downloaded.`);
  }

  return <div className="workspace-page llms-generator-page">
    <div className="page-heading"><p className="eyebrow">TOOLS</p><h1>llms.txt &amp; robots.txt</h1><p>Create editable files for your site root and verify robots rules with the crawl audit.</p></div>
    <div className="llms-generator-layout"><Card className="llms-generator-form"><CardHeader><div><CardTitle>Site details</CardTitle><p>These drafts are not published automatically. Review them before uploading.</p></div></CardHeader><CardContent>
      <label htmlFor="generator-name">Site name</label><input id="generator-name" className="ui-input" maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
      <label htmlFor="generator-summary">One-line description</label><textarea id="generator-summary" className="ui-input" maxLength={240} rows={2} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Describe the site in a sentence." />
      <label htmlFor="generator-site-url">Site URL <span>(used to build the sitemap address)</span></label><input id="generator-site-url" className="ui-input" type="url" value={siteUrl} onChange={(event) => setSiteUrl(event.target.value)} placeholder="https://example.com" />
      <label htmlFor="generator-contact">About or contact URL <span>(optional)</span></label><input id="generator-contact" className="ui-input" type="url" value={contactUrl} onChange={(event) => setContactUrl(event.target.value)} placeholder="https://example.com/about" />
      <div className="llms-pages-heading"><h3>Key pages</h3><Button size="sm" variant="secondary" type="button" onClick={addPage}>Add page</Button></div>
      <div className="llms-page-fields">{pages.map((page) => <fieldset key={page.id}><legend>Key page</legend><label htmlFor={`page-title-${page.id}`}>Title</label><input id={`page-title-${page.id}`} className="ui-input" maxLength={100} value={page.title} onChange={(event) => updatePage(page.id, "title", event.target.value)} placeholder="Pricing" /><label htmlFor={`page-url-${page.id}`}>URL</label><input id={`page-url-${page.id}`} className="ui-input" type="url" value={page.url} onChange={(event) => updatePage(page.id, "url", event.target.value)} placeholder="https://example.com/pricing" /><label htmlFor={`page-note-${page.id}`}>One-line summary</label><input id={`page-note-${page.id}`} className="ui-input" maxLength={180} value={page.note} onChange={(event) => updatePage(page.id, "note", event.target.value)} placeholder="Plans and included features" />{pages.length > 1 && <button className="llms-remove-page" type="button" onClick={() => setPages((current) => current.filter((item) => item.id !== page.id))}>Remove page</button>}</fieldset>)}</div>
      <div className="llms-bot-settings"><h3>Robots.txt access by crawler</h3><p>Allow all are selected by default. Only change agents you intentionally want to block.</p>{GENERATED_BOTS.map((bot) => <label key={bot}><input type="checkbox" checked={allow[bot]} onChange={(event) => setAllow((current) => ({ ...current, [bot]: event.target.checked }))} /><span>{bot}</span><small>{allow[bot] ? "Allow" : "Disallow"}</small></label>)}</div>
    </CardContent></Card>
    <Card className="llms-preview-card"><CardHeader><div><CardTitle>Live preview</CardTitle><p>Upload to your site root as <code>/{file}</code>.</p></div></CardHeader><CardContent>
      <div className="llms-file-tabs" role="tablist" aria-label="Generated file">{(["llms.txt", "robots.txt"] as const).map((kind) => <button type="button" role="tab" aria-selected={file === kind} className={file === kind ? "active" : ""} key={kind} onClick={() => { setFile(kind); setNotice(""); }}>{kind}</button>)}</div>
      {file === "robots.txt" && !siteMap && <p className="form-error" role="alert">Enter a valid HTTP or HTTPS site URL to create the Sitemap directive.</p>}
      <pre className="llms-preview" aria-label={`${file} preview`}>{preview}</pre>
      <div className="llms-preview-actions"><Button size="sm" onClick={() => void copy()} disabled={file === "robots.txt" && !siteMap}>Copy</Button><Button size="sm" variant="secondary" onClick={download} disabled={file === "robots.txt" && !siteMap}>Download</Button><a href={`/dashboard/${encodeURIComponent(brandId)}/tools/crawl-audit`}>Verify with Crawl audit</a></div>
      {notice && <p className="form-success" role="status">{notice}</p>}
      <p className="llms-honesty-note"><b>About llms.txt:</b> It is a proposed community convention. Adoption by AI providers is not guaranteed, and this file does not guarantee citations or improved visibility.</p>
      <p className="llms-upload-note">Upload the reviewed files to your site root (<code>/llms.txt</code> and <code>/robots.txt</code>), then re-run the Crawlability audit to check them.</p>
    </CardContent></Card></div>
  </div>;
}
