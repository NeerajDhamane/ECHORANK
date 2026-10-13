# PART 1 — Product Requirements Document (PRD): EchoRank

## 1. Summary
EchoRank measures **whether AI assistants mention a brand** when users ask buyer-intent questions, **benchmarks it against competitors**, shows **which websites the AI cites**, and produces **evidence-backed recommendations**. It runs entirely on **free-tier** services and works end to end even with no API keys (clearly-labelled simulated providers).

Category: Generative Engine Optimization (GEO) / Answer Engine Optimization (AEO). Reference products (feature inspiration only — no code, copy, or assets copied): ZeroRank, Otterly.ai, Peec AI, AthenaHQ, CrowdReply.

## 2. Problem
- Users increasingly ask AI assistants for recommendations instead of searching.
- Brands cannot see whether they are mentioned, ranked, described positively, or absent. There is no "Search Console" for AI answers.
- One chat answer is a single noisy, non-deterministic sample, so "just ask ChatGPT" is not a measurement. Measurement needs **repeated, logged sampling over time**.

## 3. Users
| Persona | Need | Success looks like |
|---|---|---|
| **Growth marketer at a small SaaS/DTC brand** | Know if AI recommends them vs competitors; know what to fix | Opens dashboard, sees visibility %, gaps, and 3 prioritised actions |
| **Freelance SEO / agency analyst** | Track several brands, export a client report | Exports a one-page report with honest methodology footer |
| **Evaluator / reviewer (academic)** | Verify the system is real, rigorous, honest | Can trace any number to the raw AI text; sees real-vs-simulated labelled |

## 4. Goals and non-goals
**Goals**
1. A working end-to-end product covering the 26 modules below, ordered by priority.
2. Every metric traceable to stored raw answers (auditability).
3. Every recommendation shows the exact numbers that triggered it.
4. 100% free to run; works offline with simulated providers.
5. Honest research: a small replication experiment reported with confidence intervals and limitations.

**Non-goals (explicitly out of scope)**
Billing/SSO/white-label/agency seats · automated posting to Reddit/Quora · paid backlink marketplace · Google Analytics "AI traffic" integration · true query-fan-out traces · tracking paid platforms (ChatGPT/Claude/Perplexity real APIs) — architecture allows adding them later.

## 5. Feature catalogue (IDs = module numbers)
Priority: **MUST** = core demo slice · **SHOULD** = strong differentiators · **COULD** = if time permits. Build strictly in this order; a partial build must still be a coherent product.

| ID | Feature | Pri | Inspired by | One-line behavior |
|---|---|---|---|---|
| M1 | Auth & sessions | MUST | universal | Sign up/in/out; all data private to the user |
| M2 | Brands & competitors | MUST | ZeroRank/Peec | Track a brand + N competitors (competitors are rows in `brands`) |
| M3 | Prompts, topics, suggestions | MUST | ZeroRank/Otterly | Manage tracked questions grouped by topic; template-based suggestions |
| M4 | Multi-platform AI querying | MUST | all | Provider interface; Groq + Gemini real if keys; simulated fallback (labelled) |
| M5 | Mention detection, rank, orchestrator | MUST | ZeroRank/Peec | Find brands in answers; position = order of first mention; run pipeline |
| M6 | Sentiment | MUST | ZeroRank/AthenaHQ | Keyword-window scoring with negation; optional LLM judge |
| M7 | Citation/source extraction | MUST | ZeroRank/AthenaHQ | Extract domains from answers; classify type |
| M9–13 | Dashboard: visibility trend, sentiment, share of voice, Chats log, Sources view | MUST | ZeroRank/Peec | Charts and tables over the `chats` fact table, with drill-down |
| M14 | Recommendation engine | MUST | ZeroRank/AthenaHQ | Rule-based, evidence JSON, "why this rule?", status workflow |
| M15 | Gap opportunities | SHOULD | ZeroRank | Prompts where rivals appear and you don't |
| M19 | Ranking comparison | SHOULD | ZeroRank | Brand-vs-brand table with Δ vs previous period |
| M20 | Tags | SHOULD | ZeroRank | Tag prompts; filter every view by tag |
| M8 | Content compatibility score | SHOULD | Otterly (GEO audit) | Score text/page on citation-associated features, with fixes |
| M17 | Crawlability checker | SHOULD | Otterly | Lightweight AI-readiness audit with SSRF protection |
| M18 | Content brief generator | SHOULD | Otterly | Brief from a gap; works with no key (template tier) |
| M21 | Report export | SHOULD | ZeroRank/CrowdReply | Print-to-PDF report with methodology footer; CSV export |
| M16 | Discovery feed | SHOULD | CrowdReply (ToS-safe half) | Find public discussions (HN/StackExchange/Reddit); **read-only, never posts** |
| M22 | Alerts + scheduled tracking | COULD | CrowdReply | In-app alerts; cron/endpoint-driven runs |
| M23 | llms.txt / robots.txt generator | COULD | ZeroRank free tools | Generate files; honest about unproven llms.txt adoption |
| M24 | Public visibility checker | COULD | ZeroRank free tool | No-login demo with strict rate limits and caching |
| M25 | Locale tracking (approximate) | COULD | ZeroRank | Locale hint in prompt + filter; labelled approximate |
| M26 | API keys, REST v1, MCP server | COULD | ZeroRank (MCP) | Programmatic access; ownership-checked tools |
| R1 | Research: citation replication experiment | SHOULD | Aşkın & Baykara (2026) design | FAQ vs plain vs statistics-dense; Wilson CIs; honest comparison |
| R2 | Research: before/after case study | COULD | — | Baseline vs post-fix runs with variance; careful causal wording |

## 6. Core user stories and acceptance criteria
1. **Set up:** *As a marketer I add a brand, 3 competitors and 8 prompts in under 3 minutes.* — Suggestions can be added in one click; empty states guide each step.
2. **Measure:** *I click "Run tracking" and see progress.* — Run is async; progress bar from `completed/total`; UI never blocks > 2 s.
3. **Trust:** *I can open any chart's underlying answers.* — Click-through to Chats with filters; brand names highlighted; simulated rows badged.
4. **Compare:** *I see my visibility vs competitors over time.* — Trend lines per brand; tooltip shows n.
5. **Diagnose:** *I see where I lose.* — Gap list sorted by opportunity; minimum-sample guard.
6. **Act:** *I get ≤ 5 prioritised actions with evidence.* — Each shows triggering numbers and rationale; reruns don't duplicate.
7. **Verify a page:** *I paste a draft/URL and get a score with fixes.* — Every failed check has a concrete fix; rescoring shows delta.
8. **Report:** *I export a one-page report.* — KPIs equal dashboard; footer states real vs simulated counts and sample size.
9. **Safety:** *Another user's data is never reachable.* — Cross-user access returns 404; SSRF targets rejected.
10. **Offline demo:** *With no API keys the whole product still demos.* — Simulated data is always labelled and excluded from headline metrics by default.

## 7. Metric definitions (single source of truth — never redefine elsewhere)
| Metric | Definition |
|---|---|
| **Answer (sample)** | One row in `chats` with `error IS NULL` |
| **Visibility %** | answers where brand `mentioned=1` ÷ answers, within scope |
| **Avg. rank** | mean `position` over mentioned answers (lower is better) |
| **Sentiment score (0–100)** | mean of `(sentiment_score+1)/2*100` over mentioned answers |
| **Share of voice** | per brand: answers whose `brands_found` contains it ÷ answers |
| **Gap opportunity** | `rivalRate × (1 − yourRate)` per prompt; dominant rival defines the gap |
| **Scope** | brand + date range + optional platform / prompt / tag / locale + `includeSimulated` (default false) |
Every displayed percentage must be able to show **n** (sample size).

## 8. Success criteria (what "done" means for the project)
1. Demo flow works start to finish in ≤ 5 minutes (script in `TASKS.md` T038).
2. All MUST features pass acceptance; ≥ 6 SHOULD features done.
3. `npm run verify` green; core pure functions covered by tests with fixtures.
4. R1 experiment run with ≥ 300 trials/model, results + limitations written.
5. Documentation: README, PRD, architecture, honest limitations, AI-use disclosure.

## 9. SDG, societal and environmental considerations
Honest framing: these are **design intents and safeguards**, not measured impact claims.

| Area | How the design addresses it |
|---|---|
| **SDG 8 — Decent work & economic growth** | Gives small businesses/entrepreneurs visibility into a new discovery channel previously readable only by well-funded firms; free-tier operation keeps cost near zero |
| **SDG 9 — Industry, innovation & infrastructure** | Open, low-cost tooling and reproducible research (replication experiment, public methodology) for small-business digital capability |
| **SDG 10 — Reduced inequalities** | Evidence in the literature suggests established brands are favoured in AI answers (brand awareness correlates with AI mentions, r≈0.18 in one review); a measurement tool helps smaller brands see and address the gap. We do **not** claim to remove the bias |
| **Environmental (energy use of AI calls)** | Controls built in: caching, per-run prompt caps, small free models, scheduled (not continuous) runs, public-checker daily cap, no polling of AI APIs, simulated mode needs zero model calls |
| **Ethics & integrity** | No auto-posting/astroturfing; no manipulation tactics; simulated data always labelled and excluded from headline metrics; recommendations phrased as "associated with", not "causes"; always show sample size |
| **Privacy** | Store minimum personal data (name, email, hashed password); public checker stores IP + timestamp only for rate limiting; API keys stored hashed; raw AI answers are the user's own tracking data |
| **Fairness of recommendations** | Rules are transparent and evidence-linked; users can see and dismiss every recommendation |
> Verify exact SDG target numbers on un.org before citing a specific target in your slides.

## 10. Risks, assumptions, limitations
- AI answers are non-deterministic → all metrics are estimates; show n.
- Free-tier "platforms" are Llama (Groq) and Gemini, not ChatGPT/Perplexity/Google AI Overviews.
- Plain chat APIs don't fetch live pages or return structured citations → citation yield depends on prompting; label the prompting mode per run.
- Keyword sentiment is crude → report agreement with hand labels.
- Locale tracking is a prompt-level approximation.
- Literature is young and conflicting; rules are "associated with".
- External API terms/limits/model names change → adapters isolated, model names in config.
