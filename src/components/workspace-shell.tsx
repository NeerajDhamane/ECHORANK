"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Activity, Bell, BookOpen, ChevronDown, FileText, Gauge, Globe2, Layers, Lightbulb, Menu, MessageSquare, Network, Search, Settings, Shield, Sparkles, Tag, X, Code2 } from "lucide-react";

const sections = [
  { label: "WORKSPACE", items: [["Overview", "", Gauge], ["Prompts", "prompts", Search], ["Chats", "chats", MessageSquare], ["Sources", "sources", BookOpen], ["Ranking", "ranking", Activity], ["Gaps", "gaps", Network], ["Recommendations", "recommendations", Lightbulb], ["Discovery", "discovery", Sparkles]] },
  { label: "TOOLS", items: [["Content score", "tools/content-score", Layers], ["Crawl audit", "tools/crawl-audit", Shield], ["Briefs", "tools/briefs", FileText], ["llms.txt", "tools/llms-txt", Globe2]] },
  { label: "MANAGE", items: [["Report", "report", FileText], ["Alerts", "alerts", Bell], ["Developer", "developer", Code2], ["Settings", "settings", Settings]] },
] as const;

function SidebarNav({ brandId, close }: { brandId: string; close?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  return <nav className="workspace-nav" aria-label="Workspace navigation">{sections.map((section) => <div className="nav-section" key={section.label}><p>{section.label}</p>{section.items.map(([label, path, Icon]) => { const base = path ? `/dashboard/${brandId}/${path}` : `/dashboard/${brandId}`; const href = query ? `${base}?${query}` : base; const active = pathname === base || (path !== "" && pathname.startsWith(`${base}/`)); return <Link key={label} href={href} onClick={close} aria-current={active ? "page" : undefined} className={active ? "nav-active" : ""}><Icon size={17} strokeWidth={1.8} /><span>{label}</span></Link>; })}</div>)}</nav>;
}

type FilterOption = { id: string; name: string };
type FilterOptions = { platforms: string[]; locales: FilterOption[]; tags: FilterOption[] };

function FilterControl({ label, name, options, value, onChange, allLabel = "All" }: { label: string; name: string; options: Array<string | FilterOption>; value: string; onChange: (name: string, value: string) => void; allLabel?: string }) {
  return <label className="filter-control"><span>{label}</span><select aria-label={label} name={name} value={value} onChange={(event) => onChange(name, event.target.value)}><option value="">{allLabel}</option>{options.map((option) => { const optionValue = typeof option === "string" ? option : option.id; const optionLabel = typeof option === "string" ? option : option.name; return <option key={optionValue} value={optionValue}>{optionLabel}</option>; })}</select><ChevronDown size={13} aria-hidden="true" /></label>;
}

function ToolbarFilters({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = Object.fromEntries(["range", "platform", "locale", "tagId"].map((key) => [key, searchParams.get(key) ?? (key === "range" ? "30d" : "")])) as Record<string, string>;
  const includeSimulated = searchParams.get("includeSimulated") === "true";
  function update(name: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(name, value); else params.delete(name);
    if (name === "range" && value !== "custom") { params.delete("from"); params.delete("to"); }
    if (name === "range" && value === "custom") {
      const today = new Date().toISOString().slice(0, 10);
      const from = new Date(`${today}T00:00:00.000Z`);
      from.setUTCDate(from.getUTCDate() - 29);
      params.set("from", from.toISOString().slice(0, 10));
      params.set("to", today);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }
  return <><FilterControl label="Date range" name="range" options={[{ id: "7d", name: "7 days" }, { id: "30d", name: "30 days" }, { id: "90d", name: "90 days" }, { id: "custom", name: "Custom" }]} value={filters.range} onChange={update} allLabel="30 days" />{filters.range === "custom" && <><label className="filter-control filter-date"><span>From</span><input aria-label="From date" type="date" value={searchParams.get("from") ?? ""} onChange={(event) => update("from", event.target.value)} /></label><label className="filter-control filter-date"><span>To</span><input aria-label="To date" type="date" value={searchParams.get("to") ?? ""} onChange={(event) => update("to", event.target.value)} /></label></>}<FilterControl label="Platform" name="platform" options={options.platforms} value={filters.platform} onChange={update} /><FilterControl label="Locale-hinted (approximate)" name="locale" options={options.locales} value={filters.locale} onChange={update} /><FilterControl label="Tag" name="tagId" options={options.tags} value={filters.tagId} onChange={update} /><label className="simulated-control"><input type="checkbox" checked={includeSimulated} onChange={(event) => update("includeSimulated", event.target.checked ? "true" : "")} /><span>Simulated</span></label></>;
}

function Toolbar({ brandId, brandName, filterOptions, unreadAlerts }: { brandId: string; brandName: string; filterOptions: FilterOptions; unreadAlerts: number }) {
  return <header className="workspace-topbar"><Link className="brand-lockup workspace-logo" href="/dashboard"><span className="echo-mark" aria-hidden="true"><i /></span><span>EchoRank</span></Link><div className="topbar-tools"><Link className="brand-picker" href="/dashboard" aria-label={`Current brand: ${brandName}`}><span className="brand-avatar">{brandName.slice(0, 1).toUpperCase()}</span><span className="brand-picker-text"><b>{brandName}</b><small>Brand workspace</small></span><ChevronDown size={15} /></Link><span className="toolbar-divider" /><Suspense fallback={<span className="toolbar-filter-placeholder">Filters</span>}><ToolbarFilters options={filterOptions} /></Suspense><Link className="icon-button alert-button" href={`/dashboard/${encodeURIComponent(brandId)}/alerts`} aria-label={`Alerts${unreadAlerts ? `, ${unreadAlerts} unread` : ""}`}><Bell size={18} />{unreadAlerts > 0 && <span className="alert-count">{unreadAlerts > 99 ? "99+" : unreadAlerts}</span>}</Link><button className="user-avatar" type="button" aria-label="User menu">ER</button></div></header>;
}

export function WorkspaceShell({ brandId, brandName, filterOptions, unreadAlerts, children }: { brandId: string; brandName: string; filterOptions: FilterOptions; unreadAlerts: number; children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <div className="workspace-frame"><Toolbar brandId={brandId} brandName={brandName} filterOptions={filterOptions} unreadAlerts={unreadAlerts} /><div className="workspace-body"><aside className="workspace-sidebar"><div className="sidebar-brand"><span>BRAND WORKSPACE</span><Link href="/dashboard" aria-label="Select brand"><Tag size={15} /><ChevronDown size={13} /></Link></div><Suspense fallback={<div className="nav-placeholder" />}><SidebarNav brandId={brandId} /></Suspense><div className="sidebar-foot"><span className="live-dot" /> Evidence synced as answers are collected</div></aside><main className="workspace-main"><div className="mobile-toolbar"><button className="icon-button" aria-label="Open navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu size={20} /></button><span>{brandName}</span></div>{children}</main></div>{menuOpen && <div className="mobile-drawer-backdrop" onClick={() => setMenuOpen(false)}><aside className="mobile-drawer" onClick={(event) => event.stopPropagation()}><div className="mobile-drawer-head"><Link className="brand-lockup" href="/dashboard"><span className="echo-mark" aria-hidden="true"><i /></span><span>EchoRank</span></Link><button className="icon-button" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X size={18} /></button></div><Suspense fallback={<div className="nav-placeholder" />}><SidebarNav brandId={brandId} close={() => setMenuOpen(false)} /></Suspense></aside></div>}</div>;
}
