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
