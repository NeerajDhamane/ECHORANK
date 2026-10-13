# PART 0 — Read Me First (Handoff Protocol)

## 1. Why this pack is built the way it is
- **Free-tier agent budgets are small.** Work is cut into small tasks (one task ≈ one session). The agent should never need to read the whole pack — only `AGENTS.md`, `PROGRESS.md`, `TASKS.md`, and the section a task points to.
- **Accounts/tools can change.** Nothing important lives in a chat. State lives in: git history, `TASKS.md` checkboxes, `PROGRESS.md`, and the docs.
- **The agent's sandbox may have no internet.** Cloud coding agents often restrict network access while working. Verify this for your Codex setup. If it is restricted: install dependencies in the environment setup step (or locally), and **test live APIs (Groq, Gemini, Reddit) yourself on your own machine**, never inside the agent sandbox. All code must work with **zero API keys** (simulated providers) so the agent can verify everything offline.

## 2. One-time setup (you, ~15 minutes)
```bash
mkdir echorank && cd echorank
git init
# put the split bundle files here (AGENTS.md, TASKS.md, PROGRESS.md, docs/…)
# optional deep reference code: copy MASTER_BUILD_PLAN.md to docs/MASTER_BUILD_PLAN.md
git add -A && git commit -m "Add handoff pack"
# create a PRIVATE GitHub repo, then:
git remote add origin <your-repo-url> && git push -u origin main
```
Pin versions: after the first scaffold task, commit `package-lock.json` and **never run `npm update`** (version drift between sessions causes mysterious breakage).

## 3. Splitting this single file into repo files
Save as `split_handoff.py` next to `CODEX_HANDOFF.md` and run `python3 split_handoff.py`:
```python
import re, pathlib
src = pathlib.Path("CODEX_HANDOFF.md").read_text(encoding="utf-8")
# NOTE: the pattern is built with -{2} so this script never matches its own text
PAT = r"<!-{2} BEGIN FILE: ([^\n]+?) -{2}>\n(.*?)<!-{2} END FILE -{2}>"
for m in re.finditer(PAT, src, re.S):
    path, body = m.group(1).strip(), m.group(2).strip("\n")
    lines = body.split("\n")
    if lines and lines[0].startswith("```"):          # strip a wrapping code fence
        lines = lines[1:]
        if lines and lines[-1].startswith("```"): lines = lines[:-1]
    p = pathlib.Path(path); p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text("\n".join(lines) + "\n", encoding="utf-8"); print("wrote", path)
```

## 4. Session prompts (copy-paste)

**START (normal session):**
> Read `AGENTS.md`, the last 40 lines of `PROGRESS.md`, and `TASKS.md`. Implement ONLY task **T0xx** (or, if I don't name one, the first unchecked task whose dependencies are done). Follow `AGENTS.md` strictly. Run `npm run verify`. Tick the task in `TASKS.md`, append a short entry to `PROGRESS.md`, and commit as `T0xx: <title>`. Finish with a summary of at most 10 lines.

**RESUME (new account / new tool / new machine):**
> This repo is the source of truth; ignore any prior chat. Run `git log --oneline -10`, read `AGENTS.md` and the last 60 lines of `PROGRESS.md`, run `npm install` and `npm run verify`, and report the current state in ≤ 8 lines (what is done, what fails, the next task). Do not change code yet.

**END-OF-DAY (you, 2 minutes):**
```bash
npm run verify && git add -A && git commit -m "wip: <note>" && git push
```
Then paste the last 30 lines of `PROGRESS.md` somewhere safe (notes app) — that alone is enough to resume anywhere.

## 5. Account-switch checklist
1. `git push` everything from the old account. 2. On the new account, clone the repo (or connect it). 3. Create `.env` from `.env.example` (secrets are **never** committed). 4. Run the RESUME prompt. 5. Continue with the next unchecked task.
If you lost the repo but kept this document: re-run §2 and start at T001 — every task is re-creatable from the docs.

## 6. Mapping to Project Review 2 parameters
| Review parameter | Where the evidence comes from |
|---|---|
| SDG / societal / environmental considerations | PRD §9 (design decisions + honest limits) — add a slide using that table |
| Design implementation / prototype | The running app + `docs/DESIGN.md` + screenshots per finished task + `PROGRESS.md` as a build log |
| Individual learning reflection | **Yours to write.** Use `PROGRESS.md` "Learnings" lines as raw material |
| Presentation, documentation, academic integrity | PRD + Architecture + README; disclose AI-assistant use; cite papers you actually verified |
| External engagement / world-of-work | **Human tasks H3–H4 in TASKS.md** (real conversations + screenshots as proof — never fabricated) |

> Review-2 baseline demo: the earlier prototype (`echorank.zip`) is acceptable as "prototype v0"; this build is the full implementation that follows. Label what is done vs planned honestly.
