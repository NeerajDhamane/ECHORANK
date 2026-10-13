import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authenticatedUser: vi.fn(), getOwnedBrand: vi.fn(), readJson: vi.fn(), listRecommendations: vi.fn(), updateRecommendationStatus: vi.fn() }));
vi.mock("@/lib/api-auth", () => ({ authenticatedUser: mocks.authenticatedUser, readJson: mocks.readJson }));
vi.mock("@/lib/brand-access", () => ({ getOwnedBrand: mocks.getOwnedBrand }));
vi.mock("@/lib/recommendations", () => ({ listRecommendations: mocks.listRecommendations, updateRecommendationStatus: mocks.updateRecommendationStatus }));

import { GET } from "@/app/api/brands/[brandId]/recommendations/route";
import { PATCH } from "@/app/api/brands/[brandId]/recommendations/[recommendationId]/route";

describe("recommendation routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticatedUser.mockResolvedValue({ user: { id: "u1" }, response: null });
    mocks.getOwnedBrand.mockReturnValue({ id: "b1" });
    mocks.readJson.mockResolvedValue({ value: { status: "done" }, response: null });
    mocks.listRecommendations.mockReturnValue([]);
    mocks.updateRecommendationStatus.mockReturnValue(true);
  });

  it("returns 404 for an unowned brand without listing recommendations", async () => {
    mocks.getOwnedBrand.mockReturnValue(null);
    const response = await GET(new Request("https://echorank.test/api/brands/b2/recommendations"), { params: Promise.resolve({ brandId: "b2" }) });
    expect(response.status).toBe(404);
    expect(mocks.listRecommendations).not.toHaveBeenCalled();
  });

  it("hides done items by default and validates optional query params", async () => {
    const context = { params: Promise.resolve({ brandId: "b1" }) };
    expect((await GET(new Request("https://echorank.test/api/brands/b1/recommendations"), context)).status).toBe(200);
    expect(mocks.listRecommendations).toHaveBeenCalledWith("b1", false);
    const invalid = await GET(new Request("https://echorank.test/api/brands/b1/recommendations?unexpected=yes"), context);
    expect(invalid.status).toBe(400);
  });

  it("validates status changes and scopes updates to the owned brand", async () => {
    const context = { params: Promise.resolve({ brandId: "b1", recommendationId: "rec1" }) };
    mocks.readJson.mockResolvedValueOnce({ value: { status: "declined" }, response: null });
    expect((await PATCH(new Request("https://echorank.test/api/brands/b1/recommendations/rec1", { method: "PATCH" }), context)).status).toBe(400);
    const valid = await PATCH(new Request("https://echorank.test/api/brands/b1/recommendations/rec1", { method: "PATCH" }), context);
    expect(valid.status).toBe(200);
    expect(mocks.updateRecommendationStatus).toHaveBeenCalledWith("b1", "rec1", "done");
  });
});
