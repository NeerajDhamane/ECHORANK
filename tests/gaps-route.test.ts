import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authenticatedUser: vi.fn(), getOwnedBrand: vi.fn(), gapOpportunities: vi.fn() }));
vi.mock("@/lib/api-auth", () => ({ authenticatedUser: mocks.authenticatedUser }));
vi.mock("@/lib/brand-access", () => ({ getOwnedBrand: mocks.getOwnedBrand }));
vi.mock("@/lib/gaps", () => ({ gapOpportunities: mocks.gapOpportunities }));

import { GET } from "@/app/api/brands/[brandId]/gaps/route";

describe("gaps route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticatedUser.mockResolvedValue({ user: { id: "user-a" }, response: null });
    mocks.getOwnedBrand.mockReturnValue(null);
    mocks.gapOpportunities.mockReturnValue([]);
  });

  it("returns 404 for an unowned brand before computing opportunities", async () => {
    const response = await GET(new Request("https://echorank.test/api/brands/foreign/gaps"), { params: Promise.resolve({ brandId: "foreign" }) });
    expect(response.status).toBe(404);
    expect(mocks.gapOpportunities).not.toHaveBeenCalled();
  });

  it("validates and forwards the shared analytic scope", async () => {
    mocks.getOwnedBrand.mockReturnValue({ id: "brand-a" });
    const context = { params: Promise.resolve({ brandId: "brand-a" }) };
    const invalid = await GET(new Request("https://echorank.test/api/brands/brand-a/gaps?range=custom&from=bad"), context);
    expect(invalid.status).toBe(400);
    const valid = await GET(new Request("https://echorank.test/api/brands/brand-a/gaps?range=7d&platform=Alpha&includeSimulated=true"), context);
    expect(valid.status).toBe(200);
    expect(mocks.gapOpportunities).toHaveBeenCalledWith(expect.objectContaining({ brandId: "brand-a", platform: "Alpha", includeSimulated: true }));
  });
});
