"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { getChatDetail, getChatPage, ChatListItem } from "@/lib/chats";
import { highlightText } from "@/lib/highlight";

type ChatPage = ReturnType<typeof getChatPage>;
type ChatDetail = NonNullable<ReturnType<typeof getChatDetail>>;
type PromptGroup = { promptId: string; prompt: string; topicName: string; chats: ChatListItem[] };

export function ChatsWorkspace({ brandId, ownBrand, initialData }: {
  brandId: string;
  ownBrand: { id: string; name: string };
  initialData: ChatPage;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [detailResult, setDetailResult] = useState<{ chatId: string; detail?: ChatDetail; error?: string } | null>(null);

  function update(name: string, value: string) {
    const params = new URLSearchParams(queryString);
    if (value) params.set(name, value); else params.delete(name);
    if (name !== "page") params.set("page", "1");
    const query = params.toString();
    router.replace(query ? `${window.location.pathname}?${query}` : window.location.pathname, { scroll: false });
  }

  const groups = useMemo(() => {
    const topics = new Map<string, { label: string; prompts: Map<string, PromptGroup> }>();
    for (const chat of initialData.chats) {
      const topicName = chat.topicName ?? "Uncategorized";
      let topic = topics.get(topicName);
      if (!topic) { topic = { label: topicName, prompts: new Map() }; topics.set(topicName, topic); }
      let prompt = topic.prompts.get(chat.promptId);
      if (!prompt) { prompt = { promptId: chat.promptId, prompt: chat.prompt, topicName, chats: [] }; topic.prompts.set(chat.promptId, prompt); }
      prompt.chats.push(chat);
    }
    return [...topics.values()].map((topic) => ({ ...topic, items: [...topic.prompts.values()] }));
  }, [initialData.chats]);
  const selectedPromptId = searchParams.get("promptId") ?? groups[0]?.items[0]?.promptId ?? "";
  const timeline = useMemo(() => groups.flatMap((topic) => topic.items).find((item) => item.promptId === selectedPromptId)?.chats ?? [], [groups, selectedPromptId]);
  const selectedChat = timeline.find((chat) => chat.id === selectedChatId) ?? timeline[0];
  const detail = selectedChat?.id === detailResult?.chatId ? detailResult.detail ?? null : null;
  const detailError = selectedChat?.id === detailResult?.chatId ? detailResult.error ?? "" : "";
  const detailLoading = Boolean(selectedChat && selectedChat.id !== detailResult?.chatId);

  useEffect(() => {
    if (!selectedChat) return;
    const controller = new AbortController();
    void fetch(`/api/brands/${encodeURIComponent(brandId)}/chats/${encodeURIComponent(selectedChat.id)}${queryString ? `?${queryString}` : ""}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load this answer.");
        const result = await response.json() as ChatDetail;
        setDetailResult({ chatId: selectedChat.id, detail: result });
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setDetailResult({ chatId: selectedChat.id, error: cause instanceof Error ? cause.message : "Unable to load this answer." });
      });
    return () => controller.abort();
  }, [brandId, queryString, selectedChat]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    update("search", String(form.get("search") ?? "").trim());
  }

  const filterParams = new URLSearchParams(queryString);
  const from = filterParams.get("from") ?? "";
  const to = filterParams.get("to") ?? "";
  return <div className="workspace-page chats-page">
    <div className="page-heading"><p className="eyebrow">BRAND WORKSPACE</p><h1>Chats</h1><p>Review AI answers by prompt, run, and platform. Text is stored as evidence and rendered literally.</p></div>
    <div className="chats-filter-card">
      <div className="chats-filter-row"><label><span>Platform</span><select aria-label="Filter by platform" value={searchParams.get("platform") ?? ""} onChange={(event) => update("platform", event.target.value)}><option value="">All platforms</option>{[...new Set(initialData.chats.map((chat) => chat.platform))].sort().map((platform) => <option key={platform} value={platform}>{platform}</option>)}</select></label>
        <label><span>Mention</span><select aria-label="Filter by mention" value={searchParams.get("mentioned") ?? ""} onChange={(event) => update("mentioned", event.target.value)}><option value="">Any</option><option value="true">Mentioned</option><option value="false">Not mentioned</option></select></label>
        <label><span>Sentiment</span><select aria-label="Filter by sentiment" value={searchParams.get("sentiment") ?? ""} onChange={(event) => update("sentiment", event.target.value)}><option value="">Any</option><option value="positive">Positive</option><option value="neutral">Neutral</option><option value="negative">Negative</option></select></label>
        <label className="chats-date-filter"><span>From</span><input aria-label="From date" type="date" value={from} onChange={(event) => { const params = new URLSearchParams(queryString); params.set("range", "custom"); if (event.target.value) params.set("from", event.target.value); else params.delete("from"); params.set("page", "1"); router.replace(`${window.location.pathname}?${params}`, { scroll: false }); }} /></label>
        <label className="chats-date-filter"><span>To</span><input aria-label="To date" type="date" value={to} onChange={(event) => { const params = new URLSearchParams(queryString); params.set("range", "custom"); if (event.target.value) params.set("to", event.target.value); else params.delete("to"); params.set("page", "1"); router.replace(`${window.location.pathname}?${params}`, { scroll: false }); }} /></label>
        {searchParams.get("includeSimulated") === "true" && <Badge variant="simulated">simulated included</Badge>}
      </div>
      <form className="chats-search" onSubmit={submitSearch}><Search size={15} /><input key={searchParams.get("search") ?? ""} name="search" placeholder="Search prompts" defaultValue={searchParams.get("search") ?? ""} aria-label="Search prompts" /><button type="submit">Search</button></form>
    </div>
    <div className="chats-results-summary">{initialData.total.toLocaleString()} answer{initialData.total === 1 ? "" : "s"} in this scope</div>
    <div className="chats-two-pane">
      <Card className="chats-prompt-pane"><CardHeader><div><CardTitle>Prompts</CardTitle><p>Grouped by topic · {initialData.chats.length} shown</p></div></CardHeader><CardContent>{groups.length ? <div className="chats-prompt-groups">{groups.map((topic) => <section key={topic.label}><h3>{topic.label}</h3>{topic.items.map((prompt) => <button type="button" key={prompt.promptId} className={`chats-prompt-item${prompt.promptId === selectedPromptId ? " chats-prompt-selected" : ""}`} onClick={() => update("promptId", prompt.promptId)}><span>{prompt.prompt}</span><small>{prompt.chats.length} answer{prompt.chats.length === 1 ? "" : "s"}</small></button>)}</section>)}</div> : <EmptyState title="No answers in this scope" description="Try a different date or filter, or run tracking to collect answers." />}</CardContent>
        <div className="chats-pagination"><button type="button" disabled={initialData.page <= 1} onClick={() => update("page", String(initialData.page - 1))}><ChevronLeft size={14} /> Previous</button><span>Page {initialData.page} of {Math.max(initialData.pages, 1)}</span><button type="button" disabled={initialData.page >= initialData.pages} onClick={() => update("page", String(initialData.page + 1))}>Next <ChevronRight size={14} /></button></div>
      </Card>
      <Card className="chats-timeline-pane"><CardHeader><div><CardTitle>{timeline[0]?.prompt ?? "Answer timeline"}</CardTitle><p>{timeline.length ? `${timeline.length} answer${timeline.length === 1 ? "" : "s"} for this prompt in the current page` : "Select a prompt to see its answer timeline."}</p></div></CardHeader><CardContent>{timeline.length ? <div className="chats-timeline">
        <ol className="chats-timeline-list">{timeline.map((chat) => <li key={chat.id}><button type="button" aria-pressed={chat.id === selectedChat?.id} className={`chats-timeline-item${chat.id === selectedChat?.id ? " chats-timeline-selected" : ""}`} onClick={() => setSelectedChatId(chat.id)}><span className="chats-timeline-marker" /><span className="chats-timeline-meta"><b>{chat.platform}</b><small>{chat.startedAt ?? chat.createdAt}</small></span><span className="chats-timeline-badges">{chat.isSimulated === 1 && <Badge variant="simulated">simulated</Badge>}<Badge variant={chat.mentioned ? "positive" : "neutral"}>{chat.mentioned ? `Mentioned #${chat.position ?? "—"}` : "Not mentioned"}</Badge>{chat.sentiment && <span className={`chat-sentiment-dot sentiment-${chat.sentiment}`} title={`${chat.sentiment} sentiment`} aria-label={`${chat.sentiment} sentiment`} />}</span></button></li>)}</ol>
        <section className="chats-answer-detail" aria-live="polite">{detailLoading ? <p className="chats-detail-message" role="status">Loading answer…</p> : detailError ? <p className="chats-detail-message chats-detail-error" role="alert">{detailError}</p> : detail?.rawResponse ? <><div className="chats-answer-heading"><span>{detail.platform}</span><span>{detail.createdAt}</span>{detail.isSimulated === 1 && <Badge variant="simulated">simulated</Badge>}</div><p className="chats-answer-text">{highlightText(detail.rawResponse, detail.highlightBrands, ownBrand.id).map((segment, index) => segment.brandId ? <mark key={`${segment.brandId}-${index}`} className={segment.isOwnBrand ? "chat-highlight-own" : "chat-highlight-rival"}>{segment.text}</mark> : <span key={`text-${index}`}>{segment.text}</span>)}</p>
            {detail.sources.length > 0 && <div className="chats-source-chips"><span>Cited sources</span>{detail.sources.map((source) => <a key={source.domain} href={`https://${source.domain}`} target="_blank" rel="noreferrer">{source.domain} <small>×{source.citationCount}</small></a>)}</div>}
            <div className="chats-answer-footer"><span>{detail.sentiment ? <><i className={`chat-sentiment-dot sentiment-${detail.sentiment}`} /> {detail.sentiment} sentiment</> : "No own-brand sentiment score"}</span><span>Locale: {detail.locale ?? "global"}</span></div>
          </> : <EmptyState title="No answer selected" description="Choose a run and platform answer from the timeline." />}</section>
      </div> : <EmptyState title="No answers for this prompt" description="Choose another prompt or clear some filters." />}</CardContent></Card>
    </div>
  </div>;
}
