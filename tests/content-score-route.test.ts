import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authenticatedUser: vi.fn(), getOwnedBrand: vi.fn(), scoreAndSaveContent: vi.fn() }));
vi.mock("@/lib/api-auth", () => ({ authenticatedUser: mocks.authenticatedUser, readJson: async (request: Request) => { try { return { value: await request.json(), response: null }; } catch { return { value: null, response: new Response(JSON.stringify({ error: "Invalid request body." }), { status: 400 }) }; } } }));
vi.mock("@/lib/brand-access", () => ({ getOwnedBrand: mocks.getOwnedBrand }));
vi.mock("@/lib/content-scores", () => ({ scoreAndSaveContent: mocks.scoreAndSaveContent }));

import { POST } from "@/app/api/brands/[brandId]/content-score/route";

describe("content score route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticatedUser.mockResolvedValue({ user: { id: "user-a" }, response: null });
    mocks.getOwnedBrand.mockReturnValue(null);
    mocks.scoreAndSaveContent.mockReturnValue({ score: 42 });
  });

  it("returns 404 for an unowned workspace before scoring", async () => {
    const response = await POST(new Request("https://echorank.test/api/brands/foreign/content-score", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: "draft" }) }), { params: Promise.resolve({ brandId: "foreign" }) });
    expect(response.status).toBe(404);
    expect(mocks.scoreAndSaveContent).not.toHaveBeenCalled();
  });

  it("accepts pasted content and rejects URL mode until safe fetch is implemented", async () => {
    mocks.getOwnedBrand.mockReturnValue({ id: "brand-a" });
    const context = { params: Promise.resolve({ brandId: "brand-a" }) };
    const url = await POST(new Request("https://echorank.test/api/brands/brand-a/content-score", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: "https://example.com" }) }), context);
    expect(url.status).toBe(400);
    const ok = await POST(new Request("https://echorank.test/api/brands/brand-a/content-score", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label: "Draft", content: "Pasted page content." }) }), context);
    expect(ok.status).toBe(200);
    expect(mocks.scoreAndSaveContent).toHaveBeenCalledWith("brand-a", "Pasted page content.", "Draft");
  });
});
