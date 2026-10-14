# EchoRank 5-minute demo

This walkthrough uses the local seeded account and simulated tracking data. It needs no provider API keys. The fixed demo credentials are public and local-only; never expose a seeded instance to the internet.

## Before the demo

From the project root in PowerShell, install dependencies first if needed (`npm ci`). Make sure `.env` has a private `AUTH_SECRET` of at least 32 bytes, then run:

```powershell
npm run db:migrate
npm run seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with `demo@echorank.local` / `demo1234`. The seed command prints the brand ID and counts. Open the **Acme Cloud** brand workspace. On a fresh seed its ID is `demo-brand-acme-cloud`; after `npm run seed -- --reset`, use the new ID printed by the command.

## Script (about five minutes)

1. **Overview (30 sec)** — Start at `/dashboard/<brandId>`. Point out the trend across six seeded runs, the visibility sample sizes, and the simulated-data labels. These are repeatable demonstration samples, not real provider measurements.
2. **Chats highlight (35 sec)** — Open `/dashboard/<brandId>/chats`. Open an answer to show the prompt, escaped answer text, highlighted own/competitor mentions, and cited-source links. Keep the simulated badge visible.
3. **Sources and gaps (35 sec)** — Open `/dashboard/<brandId>/sources` to show cited domains, then `/dashboard/<brandId>/gaps` to compare prompts and source coverage. The seeded answers include example citations for this walkthrough.
4. **Recommendations (40 sec)** — Open `/dashboard/<brandId>/recommendations`. The seed contains only simulated answers, and recommendation rules deliberately exclude simulated data, so the seeded account will show the honest empty state. To show evidence on an installation that already has eligible real-provider tracking history, open a recommendation and its evidence. Do not claim the seeded workspace has a recommendation or describe associations as causes.
5. **Content score before/after (50 sec)** — Open `/dashboard/<brandId>/tools/content-score`. Score a short draft labeled “Before”, add a clear heading and a short FAQ section to the text, then score it as “After”. Compare the heuristic checklist scores; they are not predictions of citations or rankings.
6. **Crawl audit (40 sec)** — Open `/dashboard/<brandId>/tools/crawl-audit` and enter `https://example.com`. Show the checklist and score history if the machine can reach the site. This step fetches a public URL and is the only network-dependent part of this walkthrough.
7. **Report print (30 sec)** — Open `/dashboard/<brandId>/report` and choose **Download PDF** to open the browser print dialog; print or save the current report as PDF. If time permits, also create a share snapshot and open its `/r/<token>` link.
8. **Research page (20 sec)** — Open `/research`. This page is independent of the demo account. If `research/results.json` has not been generated, show the “No analyzed results yet” state; the page explains how to produce the exploratory results.

## If the network fails

- Keep the app at `localhost`; the seeded account, six historical runs, answers, source coverage, and the overview/chats/gaps pages use local SQLite data and simulated providers.
- Recommendations require eligible real-provider tracking data. A zero-key seeded install correctly shows the empty state; simulated runs do not create recommendation evidence. Do not add fabricated or simulated recommendation evidence to the demo.
- Content scoring, report creation/printing, and the research page do not need an external provider. Research results may be absent; use its empty state rather than implying results exist.
- Skip the live crawl fetch when the machine is offline. Explain that crawl audit checks a public site and therefore needs network access; continue with the seeded analytics and other local tools. Do not present a failed fetch as a site failure.
- If local setup or sign-in fails, check `.env` and `AUTH_SECRET`, then run `npm run db:migrate` and `npm run seed` again. `npm run seed -- --reset` replaces the visible demo brand by soft-deleting it and creates a fresh one; it does not erase chat history.
