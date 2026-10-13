import { describe, expect, it, vi } from "vitest";
import { getProviders } from "@/lib/providers/registry";
import { createMockProvider } from "@/lib/providers/mock";
import { ProviderHttpError } from "@/lib/providers/types";
import { withRetry } from "@/lib/providers/throttle";

describe("provider layer", () => {
  it("returns only labelled simulated providers when no keys are configured", () => {
    const providers = getProviders({});
    expect(providers.length).toBeGreaterThan(0);
    expect(providers.every((provider) => provider.isMock && provider.label.includes("simulated"))).toBe(true);
  });

  it("adds only the real providers whose keys exist", () => {
    expect(getProviders({ GROQ_API_KEY: "g" }).map((provider) => provider.id)).toContain("groq");
    expect(getProviders({ GEMINI_API_KEY: "g" }).map((provider) => provider.id)).toContain("gemini");
  });

  it("produces deterministic mock output and sometimes omits the brand", async () => {
    const provider = createMockProvider("mock-test", "Test Model");
    const opts = { brandName: "Acme", date: "2026-10-14" };
    const first = await provider.run("Best hosting for a shop?", opts);
    expect(await provider.run("Best hosting for a shop?", opts)).toBe(first);
    const acrossDates = await Promise.all(Array.from({ length: 40 }, (_, day) =>
      provider.run("Best hosting for a shop?", { brandName: "Acme", date: `2026-10-${String(day + 1).padStart(2, "0")}` }),
    ));
    expect(acrossDates.some((answer) => !answer.includes("Acme"))).toBe(true);
  });

  it("retries temporary failures with exponential backoff", async () => {
    const operation = vi.fn<() => Promise<string>>()
      .mockRejectedValueOnce(new ProviderHttpError("busy", 503))
      .mockRejectedValueOnce(new ProviderHttpError("rate limited", 429))
      .mockResolvedValue("ok");
    const delays: number[] = [];
    await expect(withRetry(operation, { baseDelayMs: 10, sleepFn: async (ms) => { delays.push(ms); } })).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(3);
    expect(delays).toEqual([10, 20]);
  });

  it("does not retry non-retryable errors", async () => {
    const operation = vi.fn<() => Promise<string>>().mockRejectedValue(new ProviderHttpError("bad request", 400));
    await expect(withRetry(operation, { sleepFn: async () => undefined })).rejects.toThrow("bad request");
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
