import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "@/db/migrate";
import { brands, chats, prompts, schema, trackingRuns } from "@/db/schema";
import { createMockProvider, MOCK_PLATFORMS } from "@/lib/providers/mock";
import type { AIProvider } from "@/lib/providers/types";
import { createTrackingRun, getRunStatus, runTracking } from "@/lib/tracking";
import { persistSources } from "@/lib/analysis/citations";

describe("tracking orchestration", () => {
  let connection: Database.Database | undefined;

  afterEach(() => {
    connection?.close();
    connection = undefined;
  });

  function setup() {
    connection = new Database(":memory:");
    migrateDatabase(connection);
    const database = drizzle(connection, { schema });
    database.insert(brands).values({
      id: "brand-acme", userId: "user-1", name: "Acme", aliases: JSON.stringify(["Acme Cloud"]),
      website: "https://acme.example", industry: "cloud hosting",
    }).run();
    database.insert(brands).values({
      id: "brand-rival", userId: "user-1", ownerBrandId: "brand-acme", name: "Rival", aliases: "[]",
      website: null, industry: null,
    }).run();
    database.insert(prompts).values([
      { id: "prompt-active", brandId: "brand-acme", text: "Compare cloud hosts", status: "active", locale: "en-US" },
      { id: "prompt-inactive", brandId: "brand-acme", text: "Inactive prompt", status: "inactive", locale: "global" },
    ]).run();
    return database;
  }

  it("processes all active prompt/provider pairs and keeps going after a provider fails", async () => {
    const database = setup();
    const successful: AIProvider = {
      id: "fake-good", label: "Test Platform", isMock: true,
      async run() { return `Acme is not reliable. docs.example.com ${" ".repeat(300)} Rival is a great choice.`; },
    };
    const failing: AIProvider = {
      id: "fake-failing", label: "Failing Platform", isMock: false,
      async run() { throw new Error("provider unavailable"); },
    };
    const created = createTrackingRun("brand-acme", [successful, failing], database);
    expect(created.totalExpected).toBe(2);
    await runTracking(created.runId, {
      id: "brand-acme", userId: "user-1", ownerBrandId: null, name: "Acme", aliases: ["Acme Cloud"],
      website: "https://acme.example", industry: "cloud hosting", autoTrack: 0, trackFrequency: "daily",
      deletedAt: null, createdAt: null,
    }, [successful, failing], {
      database,
      throttle: async () => undefined,
      saveSources: (chatId, citations, ownDomains) => persistSources(connection!, chatId, citations, ownDomains),
    });

    const rows = database.select().from(chats).where(eq(chats.runId, created.runId)).all();
    expect(rows).toHaveLength(2);
    const good = rows.find((row) => row.platform === "Test Platform");
    const failed = rows.find((row) => row.platform === "Failing Platform");
    expect(good).toMatchObject({ locale: "en-US", isSimulated: 1, mentioned: 1, sentiment: "negative" });
    expect(JSON.parse(good?.brandsFound ?? "[]")).toEqual([
      { brandId: "brand-acme", name: "Acme", position: 1, sentiment: "negative", sentimentScore: -1 },
      { brandId: "brand-rival", name: "Rival", position: 2, sentiment: "positive", sentimentScore: 1 },
    ]);
    expect(failed).toMatchObject({ locale: "en-US", isSimulated: 0, error: "Provider request failed.", rawResponse: null });
    expect(getRunStatus(created.runId, database)).toMatchObject({ status: "completed", completed: 2, totalExpected: 2, simulatedCount: 1 });
    expect(connection?.prepare("SELECT domain FROM sources").all()).toEqual([{ domain: "docs.example.com" }]);
  });

  it("uses mock platforms without provider keys and counts only active prompts", () => {
    const database = setup();
    const providers = MOCK_PLATFORMS.map(({ id, label }) => createMockProvider(id, label));
    expect(providers.every((provider) => provider.isMock)).toBe(true);
    expect(createTrackingRun("brand-acme", providers, database).totalExpected).toBe(providers.length);
  });

  it("stores expected count as prompts multiplied by providers", () => {
    const database = setup();
    const providers = [createMockProvider("one", "One"), createMockProvider("two", "Two")];
    const created = createTrackingRun("brand-acme", providers, database);
    expect(database.select().from(trackingRuns).where(eq(trackingRuns.id, created.runId)).get()?.totalExpected).toBe(2);
  });
});
