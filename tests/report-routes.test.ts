import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authenticatedUser: vi.fn(), getOwnedBrand: vi.fn(), createData: vi.fn(), save: vi.fn(), revoke: vi.fn(), getSqlite: vi.fn() }));
vi.mock("@/lib/api-auth", () => ({ authenticatedUser: mocks.authenticatedUser, readJson: async (request: Request) => { try { return { value: await request.json(), response: null }; } catch { return { value: null, response: new Response(JSON.stringify({ error: "Invalid request body." }), { status: 400 }) }; } } }));
vi.mock("@/lib/brand-access", () => ({ getOwnedBrand: mocks.getOwnedBrand }));
vi.mock("@/lib/reports", () => ({ createReportData: mocks.createData, saveReportSnapshot: mocks.save, revokeReportShare: mocks.revoke }));
vi.mock("@/db", () => ({ getSqlite: mocks.getSqlite }));

import { POST } from "@/app/api/brands/[brandId]/report-shares/route";
import { DELETE } from "@/app/api/brands/[brandId]/report-shares/[reportId]/route";
import { GET as exportCsv } from "@/app/api/brands/[brandId]/export.csv/route";

describe("report share and export routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticatedUser.mockResolvedValue({ user: { id: "user-a" }, response: null });
    mocks.getOwnedBrand.mockReturnValue(null);
    mocks.createData.mockReturnValue({ example: true }); mocks.save.mockReturnValue({ id: "share", token: "a".repeat(32) }); mocks.revoke.mockReturnValue(true);
  });

  it("checks brand ownership before creating or revoking a snapshot", async () => {
    const context = { params: Promise.resolve({ brandId: "foreign", reportId: "share" }) };
    const post = await POST(new Request("https://echorank.test/api/brands/foreign/report-shares", { method: "POST", body: JSON.stringify({ range: "30d", includeSimulated: false }) }), context);
    const del = await DELETE(new Request("https://echorank.test/api/brands/foreign/report-shares/share", { method: "DELETE" }), context);
    expect([post.status, del.status]).toEqual([404, 404]);
    expect(mocks.createData).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.revoke).not.toHaveBeenCalled();
  });

  it("validates snapshot ranges before saving", async () => {
    mocks.getOwnedBrand.mockReturnValue({ id: "brand-a", name: "Acme" });
    const context = { params: Promise.resolve({ brandId: "brand-a" }) };
    const request = (payload: unknown) => new Request("https://echorank.test/api/brands/brand-a/report-shares", { method: "POST", body: JSON.stringify(payload) });
    expect((await POST(request({ range: "custom", includeSimulated: false, from: "2026-10-02", to: "2026-10-01" }), context)).status).toBe(400);
    const response = await POST(request({ range: "30d", includeSimulated: false }), context);
    expect(response.status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith("brand-a", { example: true });
  });

  it("rejects CSV exports for unowned brands and unknown tables", async () => {
    const context = { params: Promise.resolve({ brandId: "brand-a" }) };
    expect((await exportCsv(new Request("https://echorank.test/api/brands/brand-a/export.csv?table=chats"), context)).status).toBe(404);
    mocks.getOwnedBrand.mockReturnValue({ id: "brand-a" });
    expect((await exportCsv(new Request("https://echorank.test/api/brands/brand-a/export.csv?table=unknown"), context)).status).toBe(400);
    expect(mocks.getSqlite).not.toHaveBeenCalled();
  });
});
