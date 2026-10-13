"use client";

import { useEffect, useState } from "react";

type KeyInfo = { id: string; label: string | null; createdAt: string | null; lastUsedAt: string | null };
export function DeveloperWorkspace() {
  const [keys, setKeys] = useState<KeyInfo[]>([]);
  const [label, setLabel] = useState("");
  const [revealed, setRevealed] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() { const response = await fetch("/api/keys"); if (response.ok) { const data = await response.json() as { keys: KeyInfo[] }; setKeys(data.keys); } }
  useEffect(() => {
    let active = true;
    void fetch("/api/keys").then(async (response) => response.ok ? await response.json() as { keys: KeyInfo[] } : null)
      .then((data) => { if (active && data) setKeys(data.keys); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setRevealed("");
    try { const response = await fetch("/api/keys", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label }) }); const data = await response.json() as { token?: string; error?: string }; if (!response.ok || !data.token) { setMessage(data.error ?? "Could not create API key."); return; } setRevealed(data.token); setLabel(""); await load(); }
    catch { setMessage("Could not create API key."); } finally { setBusy(false); }
  }
  async function revoke(id: string) {
    setBusy(true); setMessage("");
    try { const response = await fetch(`/api/keys/${encodeURIComponent(id)}`, { method: "DELETE" }); const data = await response.json() as { error?: string }; if (!response.ok) { setMessage(data.error ?? "Could not revoke API key."); return; } setKeys((current) => current.filter((key) => key.id !== id)); setRevealed(""); }
    catch { setMessage("Could not revoke API key."); } finally { setBusy(false); }
  }
  return <div className="workspace-page developer-page"><div className="page-heading"><p className="eyebrow">PROGRAMMATIC ACCESS</p><h1>Developer access</h1><p>Connect trusted MCP clients or call the versioned REST API using a personal API key.</p></div>
    <section className="settings-card developer-card"><div className="settings-card-heading"><div><h2>API keys</h2><p>Keys are shown only once. Revoking a key takes effect immediately.</p></div></div>
      <form className="developer-key-form" onSubmit={(event) => void create(event)}><label>Key label<input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={60} required placeholder="e.g. Cursor laptop" /></label><button className="button button-primary" disabled={busy}>Create key</button></form>
      {revealed && <div className="developer-reveal" role="status"><strong>Copy this key now. It cannot be shown again.</strong><code>{revealed}</code><button type="button" onClick={() => void navigator.clipboard.writeText(revealed)}>Copy key</button></div>}
      {message && <p role="alert">{message}</p>}
      <div className="developer-keys">{keys.length ? keys.map((key) => <article key={key.id}><div><strong>{key.label ?? "Unnamed key"}</strong><small>Created {key.createdAt ?? "unknown"} · Last used {key.lastUsedAt ?? "never"}</small></div><button type="button" className="button button-secondary button-sm" onClick={() => void revoke(key.id)} disabled={busy}>Revoke</button></article>) : <p>No API keys yet.</p>}</div>
    </section>
    <section className="settings-card developer-card"><div className="settings-card-heading"><div><h2>REST API v1</h2><p>Send `Authorization: Bearer er_…` with each request.</p></div></div><pre>{`GET  /api/v1/brands\nGET  /api/v1/brands/{brandId}/overview\nGET  /api/v1/brands/{brandId}/prompts\nPOST /api/v1/brands/{brandId}/prompts\nPOST /api/v1/brands/{brandId}/track\nGET  /api/v1/runs/{runId}\nGET  /api/v1/brands/{brandId}/chats\nGET  /api/v1/brands/{brandId}/sources\nGET  /api/v1/brands/{brandId}/gaps\nGET  /api/v1/brands/{brandId}/recommendations`}</pre><p>See <code>API.md</code> at the project root for request examples and response behavior.</p></section>
    <section className="settings-card developer-card"><div className="settings-card-heading"><div><h2>MCP over Streamable HTTP</h2><p>Endpoint: <code>https://YOUR_HOST/api/mcp</code></p></div></div><h3>Claude Code</h3><pre>{`claude mcp add --transport http echorank https://YOUR_HOST/api/mcp --header "Authorization: Bearer er_YOUR_KEY"`}</pre><h3>Cursor</h3><pre>{`{\n  "mcpServers": {\n    "echorank": {\n      "url": "https://YOUR_HOST/api/mcp",\n      "headers": { "Authorization": "Bearer er_YOUR_KEY" }\n    }\n  }\n}`}</pre><p>Available tools: list_brands, get_overview, add_prompt, run_tracking, get_gap_opportunities, get_recommendations. Tracking is limited to five runs per key per UTC day.</p></section>
  </div>;
}
