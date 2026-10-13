import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase } from "@/db/migrate";
import { schema, users } from "@/db/schema";
import { toSqlTime } from "@/lib/time";

describe("database foundation", () => {
  let connection: Database.Database | undefined;

  afterEach(() => {
    connection?.close();
    connection = undefined;
  });

  it("applies the schema idempotently and inserts and reads a user", () => {
    connection = new Database(":memory:");
    migrateDatabase(connection);
    migrateDatabase(connection);

    const database = drizzle(connection, { schema });
    database.insert(users).values({
      id: "user-1",
      name: "Echo User",
      email: "echo@example.test",
      passwordHash: "test-hash",
    }).run();

    const user = database.select().from(users).where(eq(users.id, "user-1")).get();
    expect(user).toMatchObject({
      id: "user-1",
      email: "echo@example.test",
      name: "Echo User",
      passwordHash: "test-hash",
    });
  });

  it("converts ISO timestamps to SQLite UTC format", () => {
    expect(toSqlTime("2026-08-30T10:00:00.000Z")).toBe("2026-08-30 10:00:00");
  });
});
