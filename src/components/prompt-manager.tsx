"use client";
import { useMemo, useState, type FormEvent } from "react";
import { BookOpen, Check, ChevronDown, Edit3, Plus, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { PromptRecord, PromptStatus, TopicRecord } from "@/lib/prompt-access";
import type { PromptSuggestion } from "@/lib/prompt-suggestions";
import type { TagRecord } from "@/lib/tags";
import { LOCALE_OPTIONS } from "@/lib/locales";

type PromptTab = "active" | "suggested" | "inactive";
type PromptWithTopic = PromptRecord;

async function errorFrom(response: Response): Promise<string> {
  try { const payload: unknown = await response.json(); if (typeof payload === "object" && payload !== null && "error" in payload) return String(payload.error); } catch { /* generic message below */ }
  return "Unable to complete that request.";
}

export function PromptManager({ brandId, initialPrompts, initialTopics, suggestions, initialTags, initialPromptTags }: { brandId: string; initialPrompts: PromptRecord[]; initialTopics: TopicRecord[]; suggestions: PromptSuggestion[]; initialTags: TagRecord[]; initialPromptTags: Record<string, TagRecord[]> }) {
  const [prompts, setPrompts] = useState(initialPrompts);
  const [topics, setTopics] = useState(initialTopics);
  const [tab, setTab] = useState<PromptTab>("active");
  const [formOpen, setFormOpen] = useState(false);
  const [topicFormOpen, setTopicFormOpen] = useState(false);
  const [topicId, setTopicId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tags, setTags] = useState(initialTags);
  const [promptTags, setPromptTags] = useState(initialPromptTags);
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});

  const visiblePrompts = useMemo(() => prompts.filter((prompt) => prompt.status === tab), [prompts, tab]);
  const grouped = useMemo(() => {
    const groups = new Map<string, { title: string; items: PromptWithTopic[] }>();
    for (const prompt of visiblePrompts) {
      const id = prompt.topicId ?? "__ungrouped";
      const title = topics.find((topic) => topic.id === prompt.topicId)?.name ?? "Uncategorized";
      const group = groups.get(id) ?? { title, items: [] };
      group.items.push(prompt); groups.set(id, group);
    }
    return [...groups.entries()].map(([id, group]) => ({ id, ...group }));
  }, [topics, visiblePrompts]);

  async function addPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setPendingId("create");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/brands/${brandId}/prompts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: String(form.get("text") ?? ""), topicId: String(form.get("topicId") ?? "") || null, status: "active", locale: String(form.get("locale") ?? "global") }) });
      if (!response.ok) { setError(await errorFrom(response)); return; }
      const prompt = await response.json() as PromptRecord;
      setPrompts((items) => [...items, prompt]); setFormOpen(false); setTab("active"); setNotice("Prompt added.");
    } catch { setError("Could not reach EchoRank. Please try again."); }
    finally { setPendingId(null); }
  }

  async function addTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPendingId("topic");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/brands/${brandId}/topics`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: String(form.get("name") ?? "") }) });
      if (!response.ok) { setError(await errorFrom(response)); return; }
      const topic = await response.json() as TopicRecord;
      setTopics((items) => [...items, topic].sort((a, b) => a.name.localeCompare(b.name))); setTopicId(topic.id); setTopicFormOpen(false); setNotice("Topic added.");
    } catch { setError("Could not reach EchoRank. Please try again."); }
    finally { setPendingId(null); }
  }

  async function addSuggestion(suggestion: PromptSuggestion) {
    setError(""); setNotice(""); setPendingId(suggestion.id);
    try {
      let topic = topics.find((item) => item.name.toLocaleLowerCase() === suggestion.topicName.toLocaleLowerCase());
      if (!topic) {
        const topicResponse = await fetch(`/api/brands/${brandId}/topics`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: suggestion.topicName }) });
        if (!topicResponse.ok) { setError(await errorFrom(topicResponse)); return; }
        topic = await topicResponse.json() as TopicRecord;
        setTopics((items) => [...items, topic!].sort((a, b) => a.name.localeCompare(b.name)));
      }
      const response = await fetch(`/api/brands/${brandId}/prompts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: suggestion.text, topicId: topic.id, status: "active" }) });
      if (!response.ok) { setError(await errorFrom(response)); return; }
      const prompt = await response.json() as PromptRecord;
      setPrompts((items) => [...items, prompt]); setNotice("Suggested prompt added.");
    } catch { setError("Could not reach EchoRank. Please try again."); }
    finally { setPendingId(null); }
  }

  async function update(id: string, values: { text?: string; status?: PromptStatus; locale?: string }) {
    setError(""); setNotice(""); setPendingId(id);
    try {
      const response = await fetch(`/api/brands/${brandId}/prompts/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(values) });
      if (!response.ok) { setError(await errorFrom(response)); return; }
      const prompt = await response.json() as PromptRecord;
      setPrompts((items) => items.map((item) => item.id === id ? prompt : item)); setEditingId(null); setNotice("Prompt updated.");
    } catch { setError("Could not reach EchoRank. Please try again."); }
    finally { setPendingId(null); }
  }

  async function remove(id: string) {
    setError(""); setNotice(""); setPendingId(id);
    try {
      const response = await fetch(`/api/brands/${brandId}/prompts/${id}`, { method: "DELETE" });
      if (!response.ok) { setError(await errorFrom(response)); return; }
      setPrompts((items) => items.filter((item) => item.id !== id)); setNotice("Prompt removed. Existing chat history is preserved.");
    } catch { setError("Could not reach EchoRank. Please try again."); }
    finally { setPendingId(null); }
  }

  async function attachTag(promptId: string, tag: TagRecord) {
    if ((promptTags[promptId] ?? []).some((item) => item.id === tag.id)) return;
    const response = await fetch(`/api/brands/${brandId}/prompts/${promptId}/tags`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tagId: tag.id }) });
    if (!response.ok) { setError(await errorFrom(response)); return; }
    setPromptTags((current) => ({ ...current, [promptId]: [...(current[promptId] ?? []), tag] })); setNotice("Tag added to prompt.");
  }

  async function addTag(promptId: string) {
    const name = (tagDrafts[promptId] ?? "").trim();
    if (!name) return;
    setError(""); setNotice(""); setPendingId(`tag:${promptId}`);
    try {
      const existing = tags.find((item) => item.name.toLowerCase() === name.toLowerCase());
      let tag = existing;
      if (!tag) {
        const response = await fetch(`/api/brands/${brandId}/tags`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
        if (!response.ok) { setError(await errorFrom(response)); return; }
        tag = await response.json() as TagRecord;
        setTags((current) => current.some((item) => item.id === tag!.id) ? current : [...current, tag!].sort((a, b) => a.name.localeCompare(b.name)));
      }
      await attachTag(promptId, tag);
      setTagDrafts((current) => ({ ...current, [promptId]: "" }));
    } catch { setError("Could not reach EchoRank. Please try again."); }
    finally { setPendingId(null); }
  }

  async function detachTag(promptId: string, tag: TagRecord) {
    try {
      const response = await fetch(`/api/brands/${brandId}/prompts/${promptId}/tags`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ tagId: tag.id }) });
      if (!response.ok) { setError(await errorFrom(response)); return; }
      setPromptTags((current) => ({ ...current, [promptId]: (current[promptId] ?? []).filter((item) => item.id !== tag.id) })); setNotice("Tag removed from prompt.");
    } catch { setError("Could not reach EchoRank. Please try again."); }
  }

  async function removeTag(tag: TagRecord) {
    try {
      const response = await fetch(`/api/brands/${brandId}/tags/${tag.id}`, { method: "DELETE" });
      if (!response.ok) { setError(await errorFrom(response)); return; }
      setTags((current) => current.filter((item) => item.id !== tag.id));
      setPromptTags((current) => Object.fromEntries(Object.entries(current).map(([id, items]) => [id, items.filter((item) => item.id !== tag.id)])));
      setNotice(`Tag “${tag.name}” deleted from your account.`);
    } catch { setError("Could not reach EchoRank. Please try again."); }
  }

  const counts = { active: prompts.filter((item) => item.status === "active").length, suggested: suggestions.length, inactive: prompts.filter((item) => item.status === "inactive").length };
  return <div className="workspace-page prompts-page"><div className="page-heading prompts-heading"><div><p className="eyebrow">TRACKING SETUP</p><h1>Prompts</h1><p>Manage the questions you want to track and organize them by topic.</p></div><div className="prompt-page-actions"><Button variant="secondary" onClick={() => setTopicFormOpen((open) => !open)}><BookOpen size={15} /> Add topic</Button><Button onClick={() => setFormOpen((open) => !open)}><Plus size={15} /> Add prompt</Button></div></div>
    {error && <p className="form-error prompt-feedback" role="alert">{error}</p>}{notice && <p className="form-success prompt-feedback" role="status">{notice}</p>}
    {topicFormOpen && <form className="inline-prompt-form topic-create-form" onSubmit={addTopic}><div><label htmlFor="new-topic">Topic name</label><Input id="new-topic" name="name" maxLength={60} required placeholder="e.g. Buying questions" /></div><Button type="submit" loading={pendingId === "topic"}>Create topic</Button></form>}
    {formOpen && <form className="inline-prompt-form prompt-create-form" onSubmit={addPrompt}><div className="prompt-compose-text"><label htmlFor="new-prompt">Question to track</label><Textarea id="new-prompt" name="text" maxLength={500} minLength={3} required placeholder="What question might a customer ask an AI assistant?" /></div><div><label htmlFor="prompt-topic">Topic</label><Select id="prompt-topic" name="topicId" value={topicId} onChange={(event) => setTopicId(event.target.value)}><option value="">Uncategorized</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</Select></div><div><label htmlFor="prompt-locale">Locale hint (approximate)</label><Select id="prompt-locale" name="locale" defaultValue="global">{LOCALE_OPTIONS.map((locale) => <option key={locale.code} value={locale.code}>{locale.name}{locale.code === "global" ? "" : ` (${locale.code})`}</option>)}</Select></div><div className="form-actions"><Button variant="ghost" type="button" onClick={() => setFormOpen(false)}>Cancel</Button><Button type="submit" loading={pendingId === "create"}>Add prompt</Button></div></form>}
    <div className="prompt-tabs" role="tablist" aria-label="Prompt status">{(["active", "suggested", "inactive"] as const).map((value) => <button type="button" role="tab" aria-selected={tab === value} aria-controls="prompt-panel" key={value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>{value[0].toUpperCase() + value.slice(1)} <span>{counts[value]}</span></button>)}</div>
    <section id="prompt-panel" role="tabpanel" className="prompt-panel" aria-label={`${tab[0].toUpperCase() + tab.slice(1)} prompts`}>
      {tab === "suggested" ? suggestions.length ? <div className="suggestion-groups">{[...new Set(suggestions.map((item) => item.intent))].map((intent) => <div className="suggestion-group" key={intent}><h2>{intentLabels[intent]}</h2>{suggestions.filter((item) => item.intent === intent).map((suggestion) => <article className="suggestion-card" key={suggestion.id}><div><p>{suggestion.text}</p><div className="suggestion-meta"><Badge variant="neutral">{suggestion.tier}</Badge><span>{suggestion.topicName}</span></div></div><Button size="sm" onClick={() => void addSuggestion(suggestion)} loading={pendingId === suggestion.id}><Plus size={14} /> Add</Button></article>)}</div>)}</div> : <EmptyState icon={<Sparkles size={19} />} title="No new suggestions" description="Your current prompt list already covers the available templates. You can add a prompt of your own at any time." />
        : grouped.length ? <div className="prompt-groups">{grouped.map((group) => <details className="prompt-topic-group" key={group.id} open><summary><span>{group.title}</span><Badge variant="neutral">{group.items.length}</Badge><ChevronDown size={15} /></summary><div className="prompt-topic-items">{group.items.map((prompt) => <article className="prompt-row" key={prompt.id}>
          {editingId === prompt.id ? <form className="prompt-edit-form" onSubmit={(event) => { event.preventDefault(); void update(prompt.id, { text: editingText }); }}><Textarea aria-label="Edit prompt" maxLength={500} minLength={3} required value={editingText} onChange={(event) => setEditingText(event.target.value)} /><div><Button size="sm" type="submit" loading={pendingId === prompt.id}><Check size={14} /> Save</Button><Button size="sm" variant="ghost" type="button" onClick={() => setEditingId(null)}><X size={14} /> Cancel</Button></div></form>
            : <><div className="prompt-row-main"><p>{prompt.text}</p><div className="prompt-evidence"><span>Visibility <b>—</b></span><span>Rank <b>—</b></span><span>Sentiment <b className="sentiment-empty">—</b></span><span className="locale-chip" title="Locale hint (approximate)">{prompt.locale ?? "global"}</span><Select aria-label={`Locale hint (approximate) for ${prompt.text}`} value={prompt.locale ?? "global"} disabled={pendingId === prompt.id} onChange={(event) => void update(prompt.id, { locale: event.target.value })}>{prompt.locale && !LOCALE_OPTIONS.some((option) => option.code === prompt.locale) && <option value={prompt.locale}>{prompt.locale} (existing)</option>}{LOCALE_OPTIONS.map((locale) => <option key={locale.code} value={locale.code}>{locale.name}{locale.code === "global" ? "" : ` (${locale.code})`}</option>)}</Select></div><div className="prompt-tag-chips">{(promptTags[prompt.id] ?? []).map((tag) => <span className="prompt-tag-chip" key={tag.id}>{tag.name}<button type="button" aria-label={`Remove ${tag.name} tag from prompt`} onClick={() => void detachTag(prompt.id, tag)}><X size={11} /></button></span>)}<form onSubmit={(event) => { event.preventDefault(); void addTag(prompt.id); }}><input aria-label="Add or find tag" list={`prompt-tag-options-${prompt.id}`} maxLength={40} value={tagDrafts[prompt.id] ?? ""} onChange={(event) => setTagDrafts((current) => ({ ...current, [prompt.id]: event.target.value }))} placeholder="+ Add tag" /><datalist id={`prompt-tag-options-${prompt.id}`}>{tags.map((tag) => <option key={tag.id} value={tag.name} />)}</datalist><button type="submit" aria-label="Add tag" disabled={!tagDrafts[prompt.id]?.trim() || pendingId === `tag:${prompt.id}`}><Plus size={13} /></button></form></div></div><div className="prompt-row-actions"><button type="button" aria-label={`Edit prompt: ${prompt.text}`} title="Edit" onClick={() => { setEditingId(prompt.id); setEditingText(prompt.text); }}><Edit3 size={15} /></button><button type="button" aria-label={tab === "active" ? `Deactivate prompt: ${prompt.text}` : `Activate prompt: ${prompt.text}`} title={tab === "active" ? "Deactivate" : "Activate"} disabled={pendingId === prompt.id} onClick={() => void update(prompt.id, { status: tab === "active" ? "inactive" : "active" })}><Check size={15} /></button><button type="button" className="remove-prompt" aria-label={`Remove prompt: ${prompt.text}`} title="Remove" disabled={pendingId === prompt.id} onClick={() => void remove(prompt.id)}><Trash2 size={15} /></button></div></>}
        </article>)}</div></details>)}</div> : <EmptyState icon={<BookOpen size={19} />} title={tab === "active" ? "No active prompts yet" : "No inactive prompts"} description={tab === "active" ? "Add a question or pick a suggestion to start building your tracking list." : "Prompts you deactivate will appear here. You can reactivate them whenever you need."} action={tab === "active" ? <Button onClick={() => setFormOpen(true)}><Plus size={15} /> Add prompt</Button> : undefined} />}
      </section>
    {tags.length > 0 && <details className="prompt-tag-management"><summary>Manage account tags <Badge variant="neutral">{tags.length}</Badge></summary><div>{tags.map((tag) => <span key={tag.id}>{tag.name}<button type="button" aria-label={`Delete ${tag.name} tag`} onClick={() => void removeTag(tag)}>Delete</button></span>)}</div></details>}
    <p className="prompt-footnote">Visibility, rank, and sentiment show “—” until a prompt has tracking results.</p>
  </div>;
}

const intentLabels: Record<PromptSuggestion["intent"], string> = { discovery: "Category discovery", alternatives: "Brand alternatives", comparison: "Comparisons", evaluation: "Evaluation" };
