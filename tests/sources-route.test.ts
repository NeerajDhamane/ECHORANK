import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authenticatedUser: vi.fn(), getOwnedBrand: vi.fn(), getSources: vi.fn() }));
vi.mock("@/lib/api-auth", () => ({ authenticatedUser: mocks.authenticatedUser }));
vi.mock("@/lib/brand-access", () => ({ getOwnedBrand: mocks.getOwnedBrand }));
vi.mock("@/lib/sources", () => ({ getSources: mocks.getSources }));

import { GET } from "@/app/api/brands/[brandId]/sources/route";

describe("sources route scope and ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticatedUser.mockResolvedValue({ user: { id: "user-a" }, response: null });
    mocks.getOwnedBrand.mockReturnValue(null);
    mocks.getSources.mockReturnValue({ answers: 0, totalCitations: 0, domains: [], gapDomains: [], typeBreakdown: [] });
  });

  it("returns 404 for a foreign brand before querying source data", async () => {
    const response = await GET(new Request("https://echorank.test/api/brands/foreign/sources"), { params: Promise.resolve({ brandId: "foreign" }) });
    expect(response.status).toBe(404);
    expect(mocks.getSources).not.toHaveBeenCalled();
  });

  it("validates analytic filters before querying", async () => {
    mocks.getOwnedBrand.mockReturnValue({ id: "brand-a" });
    const invalid = await GET(new Request("https://echorank.test/api/brands/brand-a/sources?range=custom&from=not-a-date"), { params: Promise.resolve({ brandId: "brand-a" }) });
    expect(invalid.status).toBe(400);
    expect(mocks.getSources).not.toHaveBeenCalled();
    const valid = await GET(new Request("https://echorank.test/api/brands/brand-a/sources?range=7d&includeSimulated=true"), { params: Promise.resolve({ brandId: "brand-a" }) });
    expect(valid.status).toBe(200);
    expect(mocks.getSources).toHaveBeenCalledWith(expect.objectContaining({ brandId: "brand-a", includeSimulated: true }));
  });
});
