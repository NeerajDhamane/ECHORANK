import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { migrateDatabase } from "@/db/migrate";
import * as dbModule from "@/db";
import { POST } from "@/app/api/public/check/route";
import { reservePublicCheck, runPublicCheck } from "@/lib/public-check";
import type { AIProvider } from "@/lib/providers/types";

describe("public checker", () => {
  let database: Database.Database | undefined;
  afterEach(() => { database?.close(); database = undefined; });
  function db() { database = new Database(":memory:"); migrateDatabase(database); return database; }

  it("blocks a sixth request from the same IP within an hour", () => {
    const connection = db();
    for (let index = 0; index < 5; index += 1) expect(reservePublicCheck("203.0.113.4", connection)).toBe("allowed");
    expect(reservePublicCheck("203.0.113.4", connection)).toBe("ip_limit");
  });

  it("caches repeated checks for 24 hours without calling the provider again", async () => {
    const connection = db();
    const run = vi.fn(async () => "Acme Cloud is a reliable option. Sources: https://example.com");
    const provider: AIProvider = { id: "fake", label: "Fake", isMock: false, run };
    const options = { database: connection, provider, throttle: async () => undefined, retry: async <T>(operation: () => Promise<T>) => operation() };
    const input = { brand: "Acme Cloud", question: "What is a reliable cloud host?" };
    const first = await runPublicCheck(input, "203.0.113.5", options);
    const second = await runPublicCheck(input, "203.0.113.6", options);
    expect(run).toHaveBeenCalledTimes(3);
    expect(second).toEqual(first);
  });

  it("returns 429 for the sixth hourly request through the public API", async () => {
    const connection = db();
    for (let index = 0; index < 5; index += 1) reservePublicCheck("203.0.113.7", connection);
    // The route uses the shared connection; swap in the fixture for this isolated route test.
    vi.spyOn(dbModule, "getSqlite").mockReturnValue(connection);
    const response = await POST(new Request("http://localhost/api/public/check", {
      method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7" },
      body: JSON.stringify({ brand: "Acme", question: "Recommend a tool", website: "", startedAt: Date.now() - 3_000 }),
    }));
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("5 checks per hour") });
  });
});
