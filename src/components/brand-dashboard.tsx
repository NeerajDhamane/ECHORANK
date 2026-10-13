"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Globe2, Plus, Tag } from "lucide-react";
import type { BrandRecord } from "@/lib/brand-access";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

async function errorMessage(response: Response): Promise<string> {
  try { const payload: unknown = await response.json(); if (typeof payload === "object" && payload !== null && "error" in payload) return String(payload.error); } catch { /* use generic message */ }
  return "Unable to complete that request.";
}

export function BrandDashboard({ initialBrands }: { initialBrands: BrandRecord[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(initialBrands.length === 0);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/brands", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        name: String(form.get("name") ?? ""), website: String(form.get("website") ?? "").trim() || null,
        industry: String(form.get("industry") ?? "").trim() || null,
        aliases: String(form.get("aliases") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
      }) });
      if (!response.ok) { setMessage(await errorMessage(response)); return; }
      const brand = await response.json() as BrandRecord;
      router.push(`/dashboard/${brand.id}`); router.refresh();
    } catch { setMessage("Could not reach EchoRank. Please try again."); }
    finally { setPending(false); }
  }

  return <main className="brand-dashboard">
    <div className="dashboard-heading"><div><p className="eyebrow">YOUR WORKSPACES</p><h1>Brands</h1><p>Track how AI platforms describe your brand and compare the evidence over time.</p></div><Button onClick={() => setOpen((value) => !value)}><Plus size={16} /> Add brand</Button></div>
    {open && <section className="brand-form-card"><div className="brand-form-heading"><div><h2>Create a brand workspace</h2><p>Add your brand details. You can add competitors next.</p></div><button type="button" className="quiet-close" onClick={() => setOpen(false)} aria-label="Close form">×</button></div>
      <form className="brand-form-grid" onSubmit={create}><div><label htmlFor="brand-name">Brand name</label><Input id="brand-name" name="name" maxLength={100} required autoFocus /></div><div><label htmlFor="brand-website">Website</label><Input id="brand-website" name="website" type="url" placeholder="https://example.com" /></div><div><label htmlFor="brand-industry">Industry</label><Input id="brand-industry" name="industry" maxLength={120} placeholder="Optional" /></div><div><label htmlFor="brand-aliases">Aliases</label><Input id="brand-aliases" name="aliases" placeholder="Comma-separated alternate names" /></div>
        {message && <p className="form-error" role="alert">{message}</p>}<div className="form-actions"><Button type="submit" loading={pending}>Create workspace <ArrowRight size={15} /></Button></div>
      </form></section>}
    {initialBrands.length ? <div className="brand-grid">{initialBrands.map((brand) => <Link className="brand-card" key={brand.id} href={`/dashboard/${brand.id}`}><div className="brand-card-icon">{brand.name.slice(0, 1).toUpperCase()}</div><div className="brand-card-content"><div className="brand-card-title"><h2>{brand.name}</h2><ArrowRight size={16} /></div><p>{brand.website || "Website not added"}</p><div className="brand-card-meta"><span><Tag size={13} /> {brand.aliases.length} aliases</span><span><Globe2 size={13} /> Manage workspace</span></div></div></Link>)}</div>
      : !open && <EmptyState title="No brand workspaces yet" description="Add a brand to set up its profile, aliases, and competitors." action={<Button onClick={() => setOpen(true)}><Plus size={15} /> Add your first brand</Button>} />}
  </main>;
}
