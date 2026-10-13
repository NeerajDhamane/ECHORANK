import { beforeEach, describe, expect, it, vi } from "vitest";

const registry = vi.hoisted(() => ({ tools: new Map<string, (...args: unknown[]) => Promise<unknown>>() }));
const mocks = vi.hoisted(() => ({
  getOwnedBrand: vi.fn(), listOwnedBrands: vi.fn(), getOverview: vi.fn(), createPrompt: vi.fn(),
  consumeApiKeyTrackingRun: vi.fn(), createTrackingRun: vi.fn(), runTracking: vi.fn(), getProviders: vi.fn(),
  gapOpportunities: vi.fn(), listRecommendations: vi.fn(),
}));

vi.mock("@modelcontextprotocol/server", () => ({ McpServer: class {
  constructor() { registry.tools.clear(); }
  registerTool(name: string, _config: unknown, callback: (...args: unknown[]) => Promise<unknown>) { registry.tools.set(name, callback); }
} }));
vi.mock("@/lib/brand-access", () => ({ getOwnedBrand: mocks.getOwnedBrand, listOwnedBrands: mocks.listOwnedBrands }));
vi.mock("@/lib/analytics", () => ({ getOverview: mocks.getOverview }));
vi.mock("@/lib/prompt-access", () => ({ createPrompt: mocks.createPrompt }));
vi.mock("@/lib/api-keys", () => ({ consumeApiKeyTrackingRun: mocks.consumeApiKeyTrackingRun }));
vi.mock("@/lib/tracking", () => ({ createTrackingRun: mocks.createTrackingRun, runTracking: mocks.runTracking }));
vi.mock("@/lib/providers/registry", () => ({ getProviders: mocks.getProviders }));
vi.mock("@/lib/gaps", () => ({ gapOpportunities: mocks.gapOpportunities }));
vi.mock("@/lib/recommendations", () => ({ listRecommendations: mocks.listRecommendations }));

import { createEchoRankMcpServer } from "@/lib/mcp-tools";

describe("MCP tool ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOwnedBrand.mockReturnValue(null);
    mocks.listOwnedBrands.mockReturnValue([]);
    createEchoRankMcpServer("user-a", "key-a");
  });

  it("rechecks ownership before every brand-scoped tool reads or changes data", async () => {
    const id = "c6009a8a-e880-4233-a387-273a15343e0d";
    for (const name of ["get_overview", "add_prompt", "run_tracking", "get_gap_opportunities", "get_recommendations"]) {
      const result = await registry.tools.get(name)?.({ brandId: id, text: "Best project management for teams?" });
      expect(result).toMatchObject({ isError: true });
    }
    expect(mocks.getOwnedBrand).toHaveBeenCalledTimes(5);
    expect(mocks.getOwnedBrand).toHaveBeenCalledWith(id, "user-a");
    expect(mocks.getOverview).not.toHaveBeenCalled();
    expect(mocks.createPrompt).not.toHaveBeenCalled();
    expect(mocks.createTrackingRun).not.toHaveBeenCalled();
    expect(mocks.gapOpportunities).not.toHaveBeenCalled();
    expect(mocks.listRecommendations).not.toHaveBeenCalled();
  });

  it("lists only the authenticated user's brands", async () => {
    await registry.tools.get("list_brands")?.({});
    expect(mocks.listOwnedBrands).toHaveBeenCalledWith("user-a");
  });
});
