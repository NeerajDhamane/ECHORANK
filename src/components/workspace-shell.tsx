"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bell, BookOpen, ChevronDown, FileText, Gauge, Globe2, Layers, Lightbulb, Menu, MessageSquare, Network, Search, Settings, Shield, Sparkles, Tag, X } from "lucide-react";

const sections = [
  { label: "WORKSPACE", items: [["Overview", "", Gauge], ["Prompts", "prompts", Search], ["Chats", "chats", MessageSquare], ["Sources", "sources", BookOpen], ["Ranking", "ranking", Activity], ["Gaps", "gaps", Network], ["Recommendations", "recommendations", Lightbulb], ["Discovery", "discovery", Sparkles]] },
  { label: "TOOLS", items: [["Content score", "tools/content-score", Layers], ["Crawl audit", "tools/crawl-audit", Shield], ["Briefs", "tools/briefs", FileText], ["llms.txt", "tools/llms-txt", Globe2]] },
  { label: "MANAGE", items: [["Report", "report", FileText], ["Alerts", "alerts", Bell], ["Settings", "settings", Settings]] },
] as const;

function SidebarNav({ brandId, close }: { brandId: string; close?: () => void }) {
  const pathname = usePathname();
  return <nav className="workspace-nav" aria-label="Workspace navigation">{sections.map((section) => <div className="nav-section" key={section.label}><p>{section.label}</p>{section.items.map(([label, path, Icon]) => { const href = path ? `/dashboard/${brandId}/${path}` : `/dashboard/${brandId}`; const active = pathname === href || (path !== "" && pathname.startsWith(`${href}/`)); return <Link key={label} href={href} onClick={close} aria-current={active ? "page" : undefined} className={active ? "nav-active" : ""}><Icon size={17} strokeWidth={1.8} /><span>{label}</span></Link>; })}</div>)}</nav>;
}

function FilterControl({ label, name, options, value }: { label: string; name: string; options: string[]; value?: string }) {
  return <label className="filter-control"><span>{label}</span><select aria-label={label} name={name} defaultValue={value} onChange={(event) => { const url = new URL(window.location.href); if (event.target.value) url.searchParams.set(name, event.target.value); else url.searchParams.delete(name); window.history.replaceState(null, "", url); }}><option value="">All</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select><ChevronDown size={13} aria-hidden="true" /></label>;
}

function Toolbar({ brandName }: { brandName: string }) {
  return <header className="workspace-topbar"><Link className="brand-lockup workspace-logo" href="/dashboard"><span className="echo-mark" aria-hidden="true"><i /></span><span>EchoRank</span></Link><div className="topbar-tools"><Link className="brand-picker" href="/dashboard" aria-label={`Current brand: ${brandName}`}><span className="brand-avatar">{brandName.slice(0, 1).toUpperCase()}</span><span className="brand-picker-text"><b>{brandName}</b><small>Brand workspace</small></span><ChevronDown size={15} /></Link><span className="toolbar-divider" /><FilterControl label="Date range" name="range" options={["7 days", "30 days", "90 days"]} value="30 days" /><FilterControl label="Platform" name="platform" options={["ChatGPT", "Claude", "Gemini"]} /><FilterControl label="Locale" name="locale" options={["en-US", "en-GB"]} /><FilterControl label="Tag" name="tag" options={[]} /><label className="simulated-control"><input type="checkbox" onChange={(event) => { const url = new URL(window.location.href); if (event.target.checked) url.searchParams.set("includeSimulated", "true"); else url.searchParams.delete("includeSimulated"); window.history.replaceState(null, "", url); }} /><span>Simulated</span></label><button className="icon-button alert-button" type="button" aria-label="Alerts"><Bell size={18} /></button><button className="user-avatar" type="button" aria-label="User menu">ER</button></div></header>;
}

export function WorkspaceShell({ brandId, brandName, children }: { brandId: string; brandName: string; children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <div className="workspace-frame"><Toolbar brandName={brandName} /><div className="workspace-body"><aside className="workspace-sidebar"><div className="sidebar-brand"><span>BRAND WORKSPACE</span><Link href="/dashboard" aria-label="Select brand"><Tag size={15} /><ChevronDown size={13} /></Link></div><Suspense fallback={<div className="nav-placeholder" />}><SidebarNav brandId={brandId} /></Suspense><div className="sidebar-foot"><span className="live-dot" /> Evidence synced as answers are collected</div></aside><main className="workspace-main"><div className="mobile-toolbar"><button className="icon-button" aria-label="Open navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu size={20} /></button><span>{brandName}</span></div>{children}</main></div>{menuOpen && <div className="mobile-drawer-backdrop" onClick={() => setMenuOpen(false)}><aside className="mobile-drawer" onClick={(event) => event.stopPropagation()}><div className="mobile-drawer-head"><Link className="brand-lockup" href="/dashboard"><span className="echo-mark" aria-hidden="true"><i /></span><span>EchoRank</span></Link><button className="icon-button" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X size={18} /></button></div><Suspense fallback={<div className="nav-placeholder" />}><SidebarNav brandId={brandId} close={() => setMenuOpen(false)} /></Suspense></aside></div>}</div>;
}
