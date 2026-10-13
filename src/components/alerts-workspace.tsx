"use client";
import { useState } from "react";
import { Bell, Check } from "lucide-react";

type AlertItem = { id: string; ruleId: string | null; message: string; read: number; createdAt: string | null };
type RuleItem = { id: string; type: string; threshold: number; enabled: number };
const descriptions: Record<string, string> = {
  visibility_drop: "Your visibility fell from the previous run by this many percentage points.",
  competitor_gain: "A tracked competitor gained this many points and now exceeds your visibility.",
  negative_sentiment: "Negative sentiment exceeds this share of analyzed brand mentions.",
  lost_prompt: "A prompt where your brand appeared no longer includes it in the latest run.",
};
const titles: Record<string, string> = { visibility_drop: "Visibility drop", competitor_gain: "Competitor gain", negative_sentiment: "Negative sentiment", lost_prompt: "Lost prompt" };

export function AlertsWorkspace({ brandId, initialAlerts, initialRules }: { brandId: string; initialAlerts: AlertItem[]; initialRules: RuleItem[] }) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [rules, setRules] = useState(initialRules);
  const [error, setError] = useState("");
  async function update(body: Record<string, unknown>) {
    setError("");
    const response = await fetch(`/api/brands/${encodeURIComponent(brandId)}/alerts`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) { setError("Your alert change could not be saved. Try again."); return false; }
    return true;
  }
  async function setRead(item: AlertItem) {
    if (!await update({ alertId: item.id, read: item.read === 0 })) return;
    setAlerts((current) => current.map((alert) => alert.id === item.id ? { ...alert, read: alert.read === 0 ? 1 : 0 } : alert));
  }
  async function updateRule(rule: RuleItem, patch: Partial<Pick<RuleItem, "enabled" | "threshold">>) {
    const updated = { ...rule, ...patch };
    if (!await update({ ruleId: rule.id, enabled: updated.enabled === 1, threshold: updated.threshold })) return;
    setRules((current) => current.map((item) => item.id === rule.id ? updated : item));
  }
  return <div className="workspace-page alerts-page">
    <div className="page-heading"><p className="eyebrow">WORKSPACE SIGNALS</p><h1>Alerts</h1><p>In-app notices are created from completed tracking runs with at least 10 real answers.</p></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="alerts-section"><header><div><h2>Recent alerts</h2><p>Read status is saved for this brand workspace.</p></div></header>
      {alerts.length ? <div className="alert-list">{alerts.map((item) => <article className={`alert-item${item.read ? " alert-item-read" : ""}`} key={item.id}><span className="alert-item-icon"><Bell size={16} /></span><div className="alert-item-copy"><p>{item.message}</p><small>{item.createdAt ?? ""}</small></div><button type="button" className="alert-read-button" onClick={() => void setRead(item)} aria-label={item.read ? "Mark alert unread" : "Mark alert read"}>{item.read ? "Unread" : <><Check size={14} /> Mark read</>}</button></article>)}</div> : <div className="alerts-empty"><Bell size={19} /><b>No alerts yet</b><span>Alerts appear after a completed run meets a rule and sample-size requirement.</span></div>}
    </section>
    <section className="alerts-section alert-rules"><header><div><h2>Rule settings</h2><p>Thresholds use percentage points, except negative sentiment which uses percent.</p></div></header>
      <div className="alert-rule-list">{rules.map((rule) => <article className="alert-rule" key={rule.id}><div><b>{titles[rule.type] ?? rule.type}</b><p>{descriptions[rule.type] ?? "Alert when this rule matches a completed run."}</p></div><div className="alert-rule-controls"><label><span>Threshold</span><input aria-label={`${titles[rule.type] ?? rule.type} threshold`} type="number" min="0" max="100" step="1" value={rule.threshold} onChange={(event) => { const value = Number(event.target.value); setRules((current) => current.map((item) => item.id === rule.id ? { ...item, threshold: value } : item)); }} onBlur={(event) => void updateRule(rule, { threshold: Number(event.target.value) })} /></label><label className="alert-enabled"><input type="checkbox" checked={rule.enabled === 1} onChange={(event) => void updateRule(rule, { enabled: event.target.checked ? 1 : 0 })} /><span>Enabled</span></label></div></article>)}</div>
    </section>
  </div>;
}
