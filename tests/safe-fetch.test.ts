import { describe, expect, it, vi } from "vitest";
import { isPrivate, safeFetch } from "@/lib/safe-fetch";

describe("safeFetch SSRF controls", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "198.18.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) ("blocks private address %s", (ip) => expect(isPrivate(ip)).toBe(true));
  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) ("allows public address %s", (ip) => expect(isPrivate(ip)).toBe(false));

  it.each(["http://localhost/", "http://127.0.0.1/", "http://169.254.169.254/latest/meta-data", "http://10.0.0.1/"]) ("rejects unsafe URL %s before fetching", async (url) => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(safeFetch(url, {}, 8000, { fetch: fetcher })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects domains resolving to private IPs and revalidates redirect destinations", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 302, headers: { location: "http://127.0.0.1/secret" } }));
    await expect(safeFetch("https://echorank-public.com/", {}, 8000, { resolve: async () => [{ address: "10.0.0.3" }], fetch: fetcher })).rejects.toThrow(/non-public/u);
    expect(fetcher).not.toHaveBeenCalled();
    await expect(safeFetch("https://echorank-public.com/", {}, 8000, { resolve: async () => [{ address: "8.8.8.8" }], fetch: fetcher })).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("limits requests to GET and caps response size", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("too big", { headers: { "content-length": String(2 * 1024 * 1024 + 1) } }));
    const deps = { resolve: async () => [{ address: "8.8.8.8" }], fetch: fetcher };
    await expect(safeFetch("https://public-site.com/", { method: "POST" }, 8000, deps)).rejects.toThrow(/GET/u);
    await expect(safeFetch("https://public-site.com/", {}, 8000, deps)).rejects.toThrow(/2 MB/u);
  });
});
