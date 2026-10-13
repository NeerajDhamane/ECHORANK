import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "@/db/migrate";
import { classifyDomain, extractCitations, persistSources } from "@/lib/analysis/citations";

describe("citation analysis", () => {
  let connection: Database.Database | undefined;

  afterEach(() => {
    connection?.close();
    connection = undefined;
  });

  it("deduplicates a URL and bare mention of the same domain", () => {
    expect(extractCitations("See https://reddit.com/r/test and reddit.com for discussion.")).toEqual([
      { domain: "reddit.com", url: "https://reddit.com/r/test" },
    ]);
  });

  it("classifies requested domains", () => {
    expect(classifyDomain("reddit.com")).toBe("forum");
    expect(classifyDomain("docs.stripe.com")).toBe("docs");
    expect(classifyDomain("blog.example.com", ["example.com"])).toBe("own");
  });

  it("persists sources and chat links idempotently", () => {
    connection = new Database(":memory:");
    migrateDatabase(connection);
    const citations = extractCitations("https://reddit.com/r/echorank reddit.com docs.stripe.com");
    persistSources(connection, "chat-1", citations);
    persistSources(connection, "chat-1", citations);
    expect(connection.prepare("SELECT domain, type FROM sources ORDER BY domain").all()).toEqual([
      { domain: "docs.stripe.com", type: "docs" },
      { domain: "reddit.com", type: "forum" },
    ]);
    expect(connection.prepare("SELECT COUNT(*) AS count FROM chat_sources").get()).toEqual({ count: 2 });
  });
});
