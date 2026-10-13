import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticatedUser: vi.fn(),
  getOwnedBrand: vi.fn(),
  getOverview: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({ authenticatedUser: mocks.authenticatedUser }));
vi.mock("@/lib/brand-access", () => ({ getOwnedBrand: mocks.getOwnedBrand }));
vi.mock("@/lib/analytics", () => ({ getOverview: mocks.getOverview }));

import { GET } from "@/app/api/brands/[brandId]/overview/route";

describe("overview route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticatedUser.mockResolvedValue({ user: { id: "user-a" }, response: null });
    mocks.getOwnedBrand.mockReturnValue({ id: "brand-a" });
    mocks.getOverview.mockReturnValue({ stats: { answers: 4 } });
  });

  it("checks ownership before responding with the scoped overview", async () => {
    const response = await GET(new Request("https://echorank.test/api/brands/brand-a/overview?range=7d&platform=ChatGPT"), {
      params: Promise.resolve({ brandId: "brand-a" }),
    });
    expect(response.status).toBe(200);
    expect(mocks.getOwnedBrand).toHaveBeenCalledWith("brand-a", "user-a");
    expect(mocks.getOverview).toHaveBeenCalledWith(expect.objectContaining({ brandId: "brand-a", platform: "ChatGPT", includeSimulated: false }));
    await expect(response.json()).resolves.toEqual({ stats: { answers: 4 } });
  });

  it("returns 404 for a brand the user does not own", async () => {
    mocks.getOwnedBrand.mockReturnValue(null);
    const response = await GET(new Request("https://echorank.test/api/brands/brand-b/overview"), {
      params: Promise.resolve({ brandId: "brand-b" }),
    });
    expect(response.status).toBe(404);
    expect(mocks.getOverview).not.toHaveBeenCalled();
  });

  it("rejects invalid filters", async () => {
    const response = await GET(new Request("https://echorank.test/api/brands/brand-a/overview?range=custom"), {
      params: Promise.resolve({ brandId: "brand-a" }),
    });
    expect(response.status).toBe(400);
    expect(mocks.getOverview).not.toHaveBeenCalled();
  });
});
