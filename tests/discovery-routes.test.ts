import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authenticatedUser: vi.fn(), getOwnedBrand: vi.fn(), list: vi.fn(), refresh: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/api-auth", () => ({ authenticatedUser: mocks.authenticatedUser, readJson: async (request: Request) => { try { return { value: await request.json(), response: null }; } catch { return { value: null, response: new Response(JSON.stringify({ error: "Invalid request body." }), { status: 400 }) }; } } }));
vi.mock("@/lib/brand-access", () => ({ getOwnedBrand: mocks.getOwnedBrand }));
vi.mock("@/lib/discovery", () => ({ listDiscoveryItems: mocks.list, refreshDiscovery: mocks.refresh, updateDiscoveryStatus: mocks.update }));

import { GET } from "@/app/api/brands/[brandId]/discovery/route";
import { POST } from "@/app/api/brands/[brandId]/discovery/refresh/route";
import { PATCH } from "@/app/api/brands/[brandId]/discovery/[itemId]/route";

describe("discovery routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticatedUser.mockResolvedValue({ user: { id: "user-a" }, response: null });
    mocks.getOwnedBrand.mockReturnValue(null);
    mocks.list.mockReturnValue([]); mocks.refresh.mockResolvedValue({ promptsSearched: 0 }); mocks.update.mockReturnValue(true);
  });

  it("requires brand ownership before listing, refreshing, or updating", async () => {
    const context = { params: Promise.resolve({ brandId: "foreign", itemId: "item" }) };
    const get = await GET(new Request("https://echorank.test/api/brands/foreign/discovery"), context);
    const post = await POST(new Request("https://echorank.test/api/brands/foreign/discovery/refresh", { method: "POST" }), context);
    const patch = await PATCH(new Request("https://echorank.test/api/brands/foreign/discovery/item", { method: "PATCH", body: JSON.stringify({ status: "saved" }) }), context);
    expect([get.status, post.status, patch.status]).toEqual([404, 404, 404]);
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.refresh).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });

  it("validates list filters and permits only save/dismiss status changes", async () => {
    mocks.getOwnedBrand.mockReturnValue({ id: "brand-a" });
    const context = { params: Promise.resolve({ brandId: "brand-a", itemId: "item" }) };
    expect((await GET(new Request("https://echorank.test/api/brands/brand-a/discovery?status=other"), context)).status).toBe(400);
    expect((await PATCH(new Request("https://echorank.test/api/brands/brand-a/discovery/item", { method: "PATCH", body: JSON.stringify({ status: "new" }) }), context)).status).toBe(400);
    expect((await PATCH(new Request("https://echorank.test/api/brands/brand-a/discovery/item", { method: "PATCH", body: JSON.stringify({ status: "dismissed" }) }), context)).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith("brand-a", "item", "dismissed");
  });
});
