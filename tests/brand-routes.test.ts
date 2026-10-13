import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticatedUser: vi.fn(),
  getOwnedBrand: vi.fn(),
  softDeleteBrand: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({ authenticatedUser: mocks.authenticatedUser, readJson: vi.fn() }));
vi.mock("@/lib/brand-access", () => ({
  BrandConflictError: class BrandConflictError extends Error {},
  getOwnedBrand: mocks.getOwnedBrand,
  getCompetitors: vi.fn(),
  softDeleteBrand: mocks.softDeleteBrand,
  updateBrand: vi.fn(),
  createBrand: vi.fn(),
  listOwnedBrands: vi.fn(),
  createCompetitor: vi.fn(),
  softDeleteCompetitor: vi.fn(),
}));

import { DELETE, GET } from "@/app/api/brands/[brandId]/route";

describe("brand route ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticatedUser.mockResolvedValue({ user: { id: "user-a", name: "A", email: "a@example.test" }, response: null });
    mocks.getOwnedBrand.mockReturnValue(null);
  });

  it("returns 404 for another user's brand on read and delete without attempting removal", async () => {
    const context = { params: Promise.resolve({ brandId: "user-b-brand" }) };
    const read = await GET(new Request("https://echorank.test/api/brands/user-b-brand"), context);
    const deletion = await DELETE(new Request("https://echorank.test/api/brands/user-b-brand", { method: "DELETE" }), context);

    expect(read.status).toBe(404);
    expect(deletion.status).toBe(404);
    expect(mocks.getOwnedBrand).toHaveBeenCalledWith("user-b-brand", "user-a");
    expect(mocks.softDeleteBrand).not.toHaveBeenCalled();
  });
});
