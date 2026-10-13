"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { BrandRecord } from "@/lib/brand-access";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

async function responseError(response: Response): Promise<string> {
  try { const payload: unknown = await response.json(); if (typeof payload === "object" && payload !== null && "error" in payload) return String(payload.error); } catch { /* use generic message */ }
  return "Unable to complete that request.";
}

export function BrandSettings({ brand, initialCompetitors }: { brand: BrandRecord; initialCompetitors: BrandRecord[] }) {
  const router = useRouter();
  const [competitors, setCompetitors] = useState(initialCompetitors);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [busy, setBusy] = useState(false);
  const [competitorError, setCompetitorError] = useState("");
  const [competitorBusy, setCompetitorBusy] = useState(false);

  async function saveBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaveMessage(""); setSaveError(""); setBusy(true);
    const values = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/brands/${brand.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({
        name: String(values.get("name") ?? ""), website: String(values.get("website") ?? "").trim() || null,
        industry: String(values.get("industry") ?? "").trim() || null,
        aliases: String(values.get("aliases") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
      }) });
      if (!response.ok) { setSaveError(await responseError(response)); return; }
      setSaveMessage("Brand details saved."); router.refresh();
    } catch { setSaveError("Could not reach EchoRank. Please try again."); }
    finally { setBusy(false); }
  }

  async function addCompetitor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setCompetitorError(""); setCompetitorBusy(true);
    const form = event.currentTarget; const values = new FormData(form);
    try {
      const response = await fetch(`/api/brands/${brand.id}/competitors`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        name: String(values.get("name") ?? ""), website: String(values.get("website") ?? "").trim() || null,
        industry: null, aliases: String(values.get("aliases") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
      }) });
      if (!response.ok) { setCompetitorError(await responseError(response)); return; }
      const competitor = await response.json() as BrandRecord;
      setCompetitors((current) => [...current, competitor].sort((a, b) => a.name.localeCompare(b.name)));
      form.reset(); router.refresh();
    } catch { setCompetitorError("Could not reach EchoRank. Please try again."); }
    finally { setCompetitorBusy(false); }
  }

  async function removeCompetitor(competitor: BrandRecord) {
    setCompetitorError("");
    try {
      const response = await fetch(`/api/brands/${brand.id}/competitors`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ competitorId: competitor.id }) });
      if (!response.ok) { setCompetitorError(await responseError(response)); return; }
      setCompetitors((current) => current.filter((item) => item.id !== competitor.id)); router.refresh();
    } catch { setCompetitorError("Could not reach EchoRank. Please try again."); }
  }

  async function deleteBrand() {
    if (!window.confirm(`Remove ${brand.name} from your active workspaces? Its historical tracking records will be retained.`)) return;
    setBusy(true); setSaveError("");
    try {
      const response = await fetch(`/api/brands/${brand.id}`, { method: "DELETE" });
      if (!response.ok) { setSaveError(await responseError(response)); setBusy(false); return; }
      router.replace("/dashboard"); router.refresh();
    } catch { setSaveError("Could not reach EchoRank. Please try again."); setBusy(false); }
  }

  return <div className="workspace-page brand-settings-page"><div className="page-heading"><p className="eyebrow">WORKSPACE SETTINGS</p><h1>{brand.name}</h1><p>Manage your brand profile, aliases, and comparison set.</p></div>
    <section className="settings-card"><div className="settings-card-heading"><div><h2>Brand details</h2><p>Keep the identifying information used throughout your workspace up to date.</p></div></div>
      <form onSubmit={saveBrand} className="settings-form"><div className="settings-field"><label htmlFor="settings-name">Brand name</label><Input id="settings-name" name="name" maxLength={100} required defaultValue={brand.name} /></div><div className="settings-field"><label htmlFor="settings-website">Website</label><Input id="settings-website" name="website" type="url" placeholder="https://example.com" defaultValue={brand.website ?? ""} /></div><div className="settings-field"><label htmlFor="settings-industry">Industry</label><Input id="settings-industry" name="industry" maxLength={120} defaultValue={brand.industry ?? ""} /></div><div className="settings-field"><label htmlFor="settings-aliases">Aliases</label><Input id="settings-aliases" name="aliases" defaultValue={brand.aliases.join(", ")} placeholder="Comma-separated alternate names" /><small>Alternate names used to recognize your brand in answers.</small></div>
        {saveError && <p className="form-error" role="alert">{saveError}</p>}{saveMessage && <p className="form-success" role="status">{saveMessage}</p>}<div className="form-actions"><Button type="submit" loading={busy}>Save changes</Button></div>
      </form>
    </section>
    <section className="settings-card"><div className="settings-card-heading"><div><h2>Competitors</h2><p>Compare your brand with other brands your customers may consider.</p></div></div>
      {competitors.length ? <ul className="competitor-list">{competitors.map((competitor) => <li key={competitor.id}><div className="competitor-avatar">{competitor.name.slice(0,1).toUpperCase()}</div><div className="competitor-info"><strong>{competitor.name}</strong><span>{competitor.website || "Website not added"}{competitor.aliases.length ? ` · ${competitor.aliases.length} aliases` : ""}</span></div><button type="button" className="remove-competitor" onClick={() => void removeCompetitor(competitor)} aria-label={`Remove ${competitor.name}`}><Trash2 size={16} /></button></li>)}</ul> : <EmptyState title="No competitors added" description="Add the brands you want to compare against. You can update this list any time." />}
      <form onSubmit={addCompetitor} className="competitor-form"><div className="settings-field"><label htmlFor="competitor-name">Competitor name</label><Input id="competitor-name" name="name" maxLength={100} required /></div><div className="settings-field"><label htmlFor="competitor-website">Website</label><Input id="competitor-website" name="website" type="url" placeholder="https://example.com" /></div><div className="settings-field"><label htmlFor="competitor-aliases">Aliases</label><Input id="competitor-aliases" name="aliases" placeholder="Comma-separated" /></div>
        {competitorError && <p className="form-error" role="alert">{competitorError}</p>}<div className="form-actions"><Button type="submit" loading={competitorBusy}><Plus size={15} /> Add competitor</Button></div>
      </form>
    </section>
    <section className="settings-card danger-zone"><div><h2>Remove brand</h2><p>Hide this brand and its competitors from active workspaces. Historical tracking records are retained and stay inaccessible.</p></div><Button variant="danger" onClick={() => void deleteBrand()} disabled={busy}><Trash2 size={15} /> Remove brand</Button></section>
  </div>;
}
