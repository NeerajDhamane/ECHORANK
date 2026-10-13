# PART 4 — Design System & Page Specs

Original design (do not copy any commercial product's logo, copy, or assets). Mood: calm, technical, evidence-first. Dark navy canvas with one warm **signal-amber** accent. Reports print in light mode.

## 1. Design tokens (put in `src/app/globals.css`)
```css
:root {
  --bg: #0f1420;            --bg-panel: #161c2c;      --bg-panel-hover: #1c2338;
  --border: #262e42;        --text: #edeff5;          --text-muted: #8890a6;
  --signal: #ffb238;        --signal-soft: rgba(255,178,56,.14);   --on-signal: #1a1200;
  --positive: #6fcf97;      --neutral: #8890a6;       --negative: #f2726b;
  --data-blue: #7c9cff;     --focus: #7c9cff;
}
```
Chart palette (competitors, muted): `#7c9cff #6fcf97 #c792ea #5ad1d1 #d1a05a #f2726b #9aa5c4`. **Own brand is always `--signal`, line width 3; competitors 1.5.**
Fonts (self-hosted via `@fontsource`): display **Space Grotesk** 500/600/700 · body **Inter** 400/500/600 · numbers/code **JetBrains Mono** 400/500 (`.tabular` class with `font-variant-numeric: tabular-nums`).

## 2. Scales
- Spacing: 4px base (4, 8, 12, 16, 24, 32, 48). Page gutter 24px; max content width 1200px.
- Radius: 8 (inputs, chips), 12 (cards), 16 (modals). Borders 1px `--border`. No heavy shadows; elevation = lighter panel + border.
- Type: H1 28/600 display · H2 20/600 · H3 16/600 · body 14/400 · small 12/400 muted · KPI number 32/500 mono.
- Motion: 150ms ease for hover/focus; the **signal ping** (pulsing amber dot) is allowed only on "run in progress" and the logo. Respect `prefers-reduced-motion`.

## 3. App shell
- **Top bar (sticky):** logo · **brand switcher** · date range (7d/30d/90d/custom) · platform filter · locale filter · tag filter · **"Include simulated"** toggle (default off) · alerts bell · user menu.
- **Left nav (workspace):** Overview · Prompts · Chats · Sources · Ranking · Gaps · Recommendations · Discovery · Tools (Content score, Crawl audit, Briefs, llms.txt) · Report · Alerts · Settings.
- Filters are URL query params (shareable, survive reload) and apply to every analytic view.
- Mobile (<768px): left nav becomes a drawer; tables scroll horizontally inside their card.

## 4. Components (build once in `components/ui`)
| Component | Spec |
|---|---|
| Button | Primary = amber fill + `--on-signal` text; Secondary = border + panel; Ghost; Danger = `--negative`. Focus ring 2px `--focus`. Loading state shows spinner + disabled |
| Input / Select / Textarea | `--bg` fill, 1px border, focus border `--signal`; label above (12px muted); inline error text `--negative` |
| Card | `--bg-panel`, 1px border, radius 12, padding 20; optional header row (title + actions) |
| Stat card | Label (12 muted) · value (32 mono) · sub-line (delta ▲▼ colored + "n=…") |
| Badge | Neutral chip; **Simulated** = dashed border, muted text; sentiment dots: green/grey/red; priority High/Med/Low; source-type chips |
| Table | Sticky header, row hover `--bg-panel-hover`, sortable columns, empty row state |
| Tabs / Segmented | Underline in `--signal` for active |
| Banner | Info / warning / honesty banner (e.g., "AI answers vary — small samples are directional") |
| EmptyState | Icon + one-sentence explanation + primary action (never a blank chart) |
| Skeleton | Shimmer blocks matching final layout |
| Toast | Bottom-right, auto-dismiss 4s, error toasts persist until closed |
| Modal / Drawer | For API-key reveal ("shown once"), report share links, row details |

## 4b. Charts (Recharts)
Dark gridlines `--border` dashed; axis text `--text-muted` 11px; tooltip = panel + border showing value **and n**; legends clickable to toggle series; every chart wrapped in a Card with title, one-line "what this shows", and an **export CSV** icon. Empty → EmptyState. Colors never carry meaning alone (add labels/patterns for sentiment).

## 5. Page specs
**Landing `/`** — hero ("Does AI recommend your brand?"), 3-step explainer, honest "how it works" (we ask AI repeatedly and log the answers), CTA to sign up, link to public checker. Footer: "Student project · not affiliated with any commercial vendor."

**Auth** — centered card, logo above, inline validation, generic error on bad login.

**Brands `/dashboard`** — grid of brand cards (name, site, last run, latest visibility); "+ Add brand" opens inline form (name, website, industry, aliases); empty state explains the 3 setup steps.

**Overview** — row of 4 stat cards (Visibility %, Avg rank, Positive sentiment %, Answers n) → Visibility trend (line per brand, 7-run moving-average toggle) → two-column: Sentiment donut · Visibility by platform bars → Share-of-voice horizontal bars with "vs you" delta → Top sources table (domain, type, used %, avg citations) → Recent chats (5). **Run tracking** button top-right with progress bar + signal ping while running. Honesty banner when simulated included.

**Prompts** — Tabs Active/Suggested/Inactive; topic groups collapsible with aggregate visibility; per-prompt: text, visibility (— when no runs), sentiment dot, rank, brand chips (+N), locale chip, tag chips; actions: Add prompt, Add topic, Suggest, bulk select, "Run all".

**Chats** — two panes: left searchable list grouped topic → prompt; right timeline for the selected prompt (each run → each platform answer). Answer text with **own brand highlighted amber, rivals muted**, "simulated" badge, sentiment dot, cited domains as chips. Filters: platform, mentioned, sentiment, date. Pagination 50.

**Sources** — Tabs Domains/URLs; donut of domain types + total citations; table with Used %, Avg citations, Type, "cited with"; **Gap analysis** toggle (domains citing rivals but never you).

**Ranking** — table: Brand · Visibility · Δ vs previous period · Sentiment · Avg rank · Mentions; your row badged "You"; optional radar; CSV export.

**Gaps** — table: Prompt · You % · Top rival (+%) · Opportunity bar · actions [Generate brief] [Find discussions]; rows with n<3 greyed "low data".

**Recommendations** — cards grouped by Off-page / On-page / Technical; each: priority badge, title, detail, **Evidence** (key numbers), **"Why this rule?"** expander (rationale + literature note, hedged wording), status control (Todo/In progress/Done/Decline).

**Discovery** — banner: "Read the thread, then reply as yourself if you have something genuinely useful to add." Cards: title, community, score/comments, why-shown, [Open ↗] [Save] [Dismiss]. **No reply/post buttons.**

**Tools** — *Content score:* paste/URL → score ring → passed ✓ list → failed ✗ list with fixes → history with delta. *Crawl audit:* URL → score ring + checklist (detail + fix) → history. *Briefs:* pick prompt → rendered markdown, Copy/Download. *llms.txt:* form left, live preview right, Copy/Download, "verify with Crawl audit" link.

**Report `/dashboard/[id]/report`** — light theme, print CSS: header, KPIs, monthly trend, prompt performance, competitors, sources, gaps, open recommendations, **methodology & limitations footer** (real vs simulated counts, n, date range). "Download PDF" = `window.print()`; "Share link" creates a snapshot.

**Alerts** — list with unread dots, rule settings (type + threshold toggles).
**Settings** — brand details, aliases, auto-track toggle, API keys (create/revoke; key shown once), MCP connect snippets.
**Public checker `/check`** — one centered card (brand, question), result shows "Mentioned in 2 of 3 answers · avg position · tone", answers collapsed, always shows sample size + variability note, CTA to sign up.

## 6. States & copy
Every view has **loading (skeleton) / empty (guidance) / error (retry)**. Copy is plain and specific: "Run tracking to see your first data point." Never "Oops". Numbers show units and n. Use "associated with", "in this sample", "estimated".

## 7. Accessibility
Contrast ≥ 4.5:1 for text; visible focus rings; all controls keyboard-operable; tables use `<th scope>`; charts have text summaries/`aria-label`; no color-only meaning; respect reduced motion; form errors tied to inputs via `aria-describedby`.

## 8. Icons & assets
`lucide-react` only. Logo = amber dot with two concentric rings (the "echo") + wordmark "EchoRank". No stock photos required.
