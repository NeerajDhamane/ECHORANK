import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authenticatedUser: vi.fn(), getOwnedBrand: vi.fn(), auditAndSave: vi.fn() }));
vi.mock("@/lib/api-auth", () => ({ authenticatedUser: mocks.authenticatedUser, readJson: async (request: Request) => { try { return { value: await request.json(), response: null }; } catch { return { value: null, response: new Response(JSON.stringify({ error: "Invalid request body." }), { status: 400 }) }; } } }));
vi.mock("@/lib/brand-access", () => ({ getOwnedBrand: mocks.getOwnedBrand }));
vi.mock("@/lib/crawl-audit", () => ({ auditAndSave: mocks.auditAndSave }));

import { POST } from "@/app/api/brands/[brandId]/crawl-audit/route";

describe("crawl audit route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticatedUser.mockResolvedValue({ user: { id: "user-a" }, response: null });
    mocks.getOwnedBrand.mockReturnValue(null);
    mocks.auditAndSave.mockResolvedValue({ score: 50 });
  });

  it("returns 404 for an unowned brand before auditing", async () => {
    const response = await POST(new Request("https://echorank.test/api/brands/foreign/crawl-audit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: "https://site.example" }) }), { params: Promise.resolve({ brandId: "foreign" }) });
    expect(response.status).toBe(404);
    expect(mocks.auditAndSave).not.toHaveBeenCalled();
  });

  it("validates HTTP(S) input and forwards an owned workspace URL", async () => {
    mocks.getOwnedBrand.mockReturnValue({ id: "brand-a" });
    const context = { params: Promise.resolve({ brandId: "brand-a" }) };
    const invalid = await POST(new Request("https://echorank.test/api/brands/brand-a/crawl-audit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: "file:///etc/passwd" }) }), context);
    expect(invalid.status).toBe(400);
    const valid = await POST(new Request("https://echorank.test/api/brands/brand-a/crawl-audit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: "https://public.example/path" }) }), context);
    expect(valid.status).toBe(200);
    expect(mocks.auditAndSave).toHaveBeenCalledWith("brand-a", "https://public.example/path");
  });
});
