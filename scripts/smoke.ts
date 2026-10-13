import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { spawn, type ChildProcess } from "node:child_process";
import Database from "better-sqlite3";

type JsonObject = Record<string, unknown>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function freePort(): Promise<number> {
  const server: Server = createServer();
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolveListen());
  });
  const address = server.address();
  assert(address && typeof address !== "string", "Could not reserve a local port.");
  const { port } = address;
  await new Promise<void>((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
  return port;
}

async function main(): Promise<void> {
  const workDir = await mkdtemp(join(tmpdir(), "echorank-smoke-"));
  const databasePath = join(workDir, "smoke.db");
  const schema = await readFile(resolve("docs/schema.sql"), "utf8");
  const database = new Database(databasePath);
  database.pragma("foreign_keys = ON");
  database.exec(schema);
  database.close();

  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const nextCli = resolve("node_modules/next/dist/bin/next");
  const child: ChildProcess = spawn(process.execPath, [nextCli, "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AUTH_SECRET: randomBytes(32).toString("hex"),
      DATABASE_PATH: databasePath,
      GROQ_API_KEY: "",
      GEMINI_API_KEY: "",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverOutput = "";
  child.stdout?.on("data", (chunk: Buffer) => { serverOutput += chunk.toString(); });
  child.stderr?.on("data", (chunk: Buffer) => { serverOutput += chunk.toString(); });

  try {
    const startupDeadline = Date.now() + 60_000;
    let ready = false;
    while (Date.now() < startupDeadline && child.exitCode === null && child.signalCode === null) {
      try {
        const response = await fetch(origin);
        if (response.ok) { ready = true; break; }
      } catch { /* Server is still starting. */ }
      await delay(300);
    }
    assert(ready, `Next.js server did not become ready. ${serverOutput.slice(-3000)}`);

    let cookie = "";
    async function request(path: string, body?: JsonObject, method = body ? "POST" : "GET"): Promise<{ response: Response; data: JsonObject }> {
      const response = await fetch(`${origin}${path}`, {
        method,
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const setCookie = response.headers.get("set-cookie");
      if (setCookie) cookie = setCookie.split(";", 1)[0] ?? "";
      const data: unknown = response.status === 204 ? {} : await response.json();
      assert(typeof data === "object" && data !== null && !Array.isArray(data), `${method} ${path} returned invalid JSON.`);
      return { response, data: data as JsonObject };
    }

    const signup = await request("/api/auth/signup", {
      name: "EchoRank Smoke",
      email: `smoke-${randomUUID()}@example.test`,
      password: "Smoke-test-pass-2026",
    });
    assert(signup.response.status === 201 && cookie, "Signup did not create a session.");

    const brandResult = await request("/api/brands", {
      name: "Smoke Brand", website: "https://smoke.example", industry: "software", aliases: ["SmokeCo"],
    });
    assert(brandResult.response.status === 201, `Brand creation failed: ${JSON.stringify(brandResult.data)}`);
    const brandId = brandResult.data.id;
    assert(typeof brandId === "string", "Brand response did not contain an id.");

    for (const name of ["Smoke Rival One", "Smoke Rival Two"]) {
      const competitor = await request(`/api/brands/${brandId}/competitors`, {
        name, website: `https://${name.toLowerCase().replaceAll(" ", "-")}.example`, industry: "software", aliases: [],
      });
      assert(competitor.response.status === 201, `Competitor creation failed: ${JSON.stringify(competitor.data)}`);
    }
    for (const text of [
      "What is Smoke Brand best for?",
      "Compare Smoke Brand with its alternatives.",
      "Which software providers should a small team consider?",
    ]) {
      const prompt = await request(`/api/brands/${brandId}/prompts`, { text });
      assert(prompt.response.status === 201, `Prompt creation failed: ${JSON.stringify(prompt.data)}`);
    }

    const start = await request(`/api/brands/${brandId}/track`, {});
    assert(start.response.status === 202 && typeof start.data.runId === "string", "Tracking run did not start.");
    assert(start.data.hasSimulated === true && start.data.totalExpected === 9, "Run did not use the three mock providers for three prompts.");
    const runId = start.data.runId;
    let run: JsonObject = {};
    const runDeadline = Date.now() + 30_000;
    do {
      await delay(250);
      const polled = await request(`/api/runs/${runId}`);
      assert(polled.response.ok, `Run polling failed: ${JSON.stringify(polled.data)}`);
      run = polled.data;
      if (run.status === "completed") break;
      assert(run.status === "running", `Run ended unexpectedly: ${String(run.status)}`);
    } while (Date.now() < runDeadline);
    assert(run.status === "completed" && run.completed === 9 && run.simulatedCount === 9, "Run did not complete all nine simulated prompt/provider pairs.");

    const history = await request(`/api/brands/${brandId}/runs?limit=10`);
    assert(history.response.ok && Array.isArray(history.data.runs), "Run history request failed.");
    const historyRun = (history.data.runs as JsonObject[]).find((item) => item.runId === runId);
    assert(historyRun?.status === "completed" && historyRun.completed === run.completed, "Run history and status counts disagree.");

    const verificationDb = new Database(databasePath, { readonly: true });
    try {
      const totals = verificationDb.prepare(`
        SELECT COUNT(*) AS answers, SUM(is_simulated) AS simulated,
          SUM(CASE WHEN mentioned = 1 THEN 1 ELSE 0 END) AS mentions
        FROM chats WHERE run_id = @runId
      `).get({ runId }) as { answers: number; simulated: number | null; mentions: number | null };
      assert(totals.answers === run.completed && totals.simulated === run.simulatedCount, "Persisted answer totals do not match run overview counts.");
      assert((totals.mentions ?? 0) >= 0 && (totals.mentions ?? 0) <= totals.answers, "Persisted mention count is inconsistent with the answer sample.");
    } finally {
      verificationDb.close();
    }
    console.log("Smoke passed: signup, brand, 2 competitors, 3 prompts, mock run, polling, history, and persisted overview counts.");
  } finally {
    child.kill();
    await new Promise<void>((resolveClose) => {
      if (child.exitCode !== null || child.signalCode !== null) resolveClose();
      else {
        const timeout = setTimeout(resolveClose, 5_000);
        child.once("exit", () => { clearTimeout(timeout); resolveClose(); });
      }
    });
    await rm(workDir, { recursive: true, force: true });
  }
}

main().catch((cause: unknown) => {
  console.error(cause instanceof Error ? cause.message : "Smoke test failed.");
  process.exitCode = 1;
});
