import Link from "next/link";
type Tab = { label: string; href: string };
export function Tabs({ tabs, activeHref, label = "Sections" }: { tabs: Tab[]; activeHref: string; label?: string }) { return <nav aria-label={label} className="ui-tabs">{tabs.map((tab) => <Link key={tab.href} href={tab.href} aria-current={activeHref === tab.href ? "page" : undefined} className={activeHref === tab.href ? "active" : ""}>{tab.label}</Link>)}</nav>; }
