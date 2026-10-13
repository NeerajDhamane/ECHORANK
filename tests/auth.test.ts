import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionToken, hashPassword, verifyPassword, verifySessionToken } from "@/lib/auth";

describe("authentication primitives", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("hashes passwords and verifies only the matching password", async () => {
    const password = "a-strong-test-password";
    const passwordHash = await hashPassword(password);

    expect(passwordHash).not.toBe(password);
    expect(await verifyPassword(password, passwordHash)).toBe(true);
    expect(await verifyPassword("a-different-password", passwordHash)).toBe(false);
  });

  it("signs and verifies a session token without exposing its secret", async () => {
    vi.stubEnv("AUTH_SECRET", "test-only-secret-with-more-than-32-bytes");
    const token = await createSessionToken("user-123");

    expect(token).not.toContain("test-only-secret");
    expect(await verifySessionToken(token)).toBe("user-123");
    expect(await verifySessionToken(`${token}invalid`)).toBeNull();
  });
});
