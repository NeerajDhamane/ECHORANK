# In-context citation form pilot: preregistration

## Question and scope

This small pilot asks whether source presentation form (plain prose, FAQ, or statistics-dense) is associated with citation selection when a model sees all three sources in context. It is not live retrieval and does not establish causal effects or generalize to other models, languages, queries, or real product information. The source facts are synthetic and held constant in the generator instructions.

## Fixed design, before any run

- Five topics and six informational queries per topic are listed in `design.json`.
- Three versions per topic: `plain`, `faq`, and `stats`.
- Fifteen repetitions per query, producing 450 trials per model before failures.
- A single selected provider/model per run; no provider pooling.
- Fixed seed: `20261014`; every trial's source order is a deterministic shuffle derived from seed + trial identity.
- The model is asked to cite sources as `[Source N]`; every cited source and its presented position is retained.
- A trial is one request. Failed requests are retained as failed rows, excluded from success denominators, and are not retried as new trials. Interrupted runs resume by skipping trial IDs already present in `research/trials.csv`.
- Analysis: per-version trial citation rate and Wilson 95% interval; uniform three-way chi-square goodness-of-fit over citation events; citation rate by presented position, model by model.

## Integrity and operational notes

Review generated versions for fact consistency and manipulation checks before collecting trials. Set `reviewed` to `true` in `research/experiment1/versions.json` only after that manual review. Automatic checks require approximately 180–280 words, at least three FAQ pairs, and a statistics numeric ratio of at least 2% that exceeds the plain version; they do not prove semantic equivalence. Do not edit preregistered queries, repetition count, or seed after observing outcomes; if a future run changes them, save a new dated design and identify the change. Live provider execution is an explicit human action and is not part of offline verification.

## Commands (live provider calls)

1. Set one provider key and generate source forms, for example `npm run experiment1:versions -- --provider=groq`.
2. Inspect all 15 texts and manipulation-check results; mark `reviewed` as `true` only after review.
3. Collect/resume trials with `npm run experiment1:run -- --provider=groq`.
4. Analyze the CSV with `npm run experiment1:analyze` to write `research/results.json` and `research/report.md`.

These commands are not part of `npm run verify` and the test suite does not call a provider.
